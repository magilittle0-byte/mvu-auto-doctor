import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEvidenceList,
    requireEnum,
    requirePlainObject,
    requireString,
    validateEvidenceList,
} from '../domain/common.mjs';
import {
    normalizeFact,
    normalizeKnowledge,
    validateFact,
    validateKnowledge,
} from '../domain/state.mjs';
import { validateBranch } from '../transaction/branch.mjs';

export const FACT_PROPOSAL_SOURCES = Object.freeze([
    'user-claim',
    'model-proposal',
    'npc-suspicion',
    'forum-rumor',
    'random-code',
    'rule',
    'state-observation',
]);

export const FACT_CONFIRMATION_BASES = Object.freeze([
    'adjudicated-h1',
    'resolved-h2',
    'verified-state',
    'explicit-user-confirmation',
]);

export const KNOWLEDGE_ACQUISITION_MODES = Object.freeze([
    'suspicion',
    'direct-observation',
    'told-by-source',
    'public-disclosure',
    'verification',
]);

const FACT_CONFIRMING_EVIDENCE_KINDS = Object.freeze([
    'rule',
    'schema',
    'state',
    'roll',
    'user-confirmation',
]);

const UNVERIFIED_PROPOSAL_SOURCES = Object.freeze([
    'model-proposal',
    'npc-suspicion',
    'forum-rumor',
    'random-code',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function activeBranchMatches(branchInput, branchId, issues, path = '$.activeBranch') {
    const branch = validateBranch(branchInput);
    issues.push(...branch.issues);
    if (
        !branch.ok
        || branch.value.id !== branchId
        || branch.value.status !== 'active'
    ) {
        addIssue(
            issues,
            'ledger.branch_stale',
            path,
            '事实或知识记录不属于当前 active 分支。',
        );
        return false;
    }
    return true;
}

function dedupeEvidence(entries) {
    const result = [];
    const seen = new Set();
    for (const entry of normalizeEvidenceList(entries)) {
        const key = [
            entry.kind,
            entry.ref,
            entry.branchId,
            entry.excerptHash ?? '',
        ].join('\u0000');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(entry);
    }
    return result;
}

function transitionResult({
    before,
    value,
    decision,
    issues,
    changed,
    explanation,
}) {
    const status = issues.some((issue) => issue.severity === 'error')
        ? 'rejected'
        : issues.some((issue) => issue.severity === 'unresolved')
            ? 'unresolved'
            : 'valid';
    return {
        ok: status === 'valid' && decision === 'apply',
        status,
        decision,
        before: deepClone(before),
        value,
        changed,
        issues,
        explanation,
    };
}

export function createFactCandidate(input, {
    source = 'user-claim',
    activeBranch,
} = {}) {
    const sourceRecord = isPlainObject(input) ? input : {};
    const issues = [];
    requireEnum(
        source,
        FACT_PROPOSAL_SOURCES,
        issues,
        '$.source',
        'ledger.fact_proposal_source',
    );
    const value = normalizeFact({
        ...sourceRecord,
        schemaVersion: '2.0',
        revision: sourceRecord.revision ?? 0,
        status: 'candidate',
        evidence: sourceRecord.evidence ?? [],
        subjectIds: sourceRecord.subjectIds ?? [],
        impact: sourceRecord.impact ?? 'local',
        scope: sourceRecord.scope ?? 'branch',
        extensions: {
            ...(isPlainObject(sourceRecord.extensions)
                ? deepClone(sourceRecord.extensions)
                : {}),
            director: {
                ...(isPlainObject(sourceRecord.extensions?.director)
                    ? deepClone(sourceRecord.extensions.director)
                    : {}),
                proposalSource: source,
                confirmationCap: source === 'rule' || source === 'state-observation'
                    ? 'candidate-until-explicit-transition'
                    : 'candidate',
            },
        },
    });
    const validated = validateFact(value);
    issues.push(...validated.issues);
    if (activeBranch !== undefined) {
        activeBranchMatches(activeBranch, value.branchId, issues);
    }
    const decision = issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    )) ? 'hold' : 'apply';
    return transitionResult({
        before: null,
        value: validated.value,
        decision,
        issues,
        changed: decision === 'apply',
        explanation: source === 'random-code'
            ? '随机口令只能建立候选事实，不能确认协议。'
            : '提案先进入 candidate，后续确认需要独立证据与显式转换。',
    });
}

function confirmationEvidenceAllowed(basis, evidence) {
    if (!evidence.length) return false;
    if (basis === 'adjudicated-h1') {
        return evidence.some((entry) => (
            ['message', 'user-confirmation', 'rule', 'state'].includes(entry.kind)
        ));
    }
    if (basis === 'resolved-h2') {
        return evidence.some((entry) => (
            ['roll', 'state', 'rule', 'user-confirmation'].includes(entry.kind)
        ));
    }
    return evidence.some((entry) => (
        FACT_CONFIRMING_EVIDENCE_KINDS.includes(entry.kind)
    ));
}

function validateConfirmationAuthority(command, fact, issues) {
    requireEnum(
        command.basis,
        FACT_CONFIRMATION_BASES,
        issues,
        '$.command.basis',
        'ledger.fact_confirmation_basis',
    );
    const evidence = normalizeEvidenceList(command.evidence);
    validateEvidenceList(
        evidence,
        issues,
        '$.command.evidence',
        { minItems: 1 },
    );
    if (!confirmationEvidenceAllowed(command.basis, evidence)) {
        addIssue(
            issues,
            'ledger.fact_confirmation_evidence_insufficient',
            '$.command.evidence',
            '该证据只能证明有人说过、怀疑过或提出过，不能确认世界事实。',
            'unresolved',
        );
    }
    const proposalSource = fact.extensions?.director?.proposalSource;
    if (
        command.basis === 'adjudicated-h1'
        && UNVERIFIED_PROPOSAL_SOURCES.includes(proposalSource)
        && !evidence.some((entry) => entry.kind !== 'message')
    ) {
        addIssue(
            issues,
            'ledger.unverified_proposal_message_only',
            '$.command.evidence',
            '模型提案、NPC怀疑、论坛传闻或随机口令不能仅凭消息证据确认为事实。',
            'unresolved',
        );
    }
    if (
        command.basis === 'adjudicated-h1'
        && !['cosmetic', 'local'].includes(fact.impact)
    ) {
        addIssue(
            issues,
            'ledger.h1_confirmation_impact',
            '$.impact',
            'H1 权限不能确认 material/structural 事实。',
        );
    }
    if (
        command.basis === 'resolved-h2'
        && command.resolutionSucceeded !== true
    ) {
        addIssue(
            issues,
            'ledger.h2_resolution_missing',
            '$.command.resolutionSucceeded',
            'H2 只有在检定或代价事务成功后才能确认。',
            'unresolved',
        );
    }
    return evidence;
}

export function transitionFact(factInput, commandInput, {
    activeBranch,
} = {}) {
    const current = validateFact(factInput);
    const issues = [...current.issues];
    const fact = current.value;
    const command = isPlainObject(commandInput) ? commandInput : {};
    if (!requirePlainObject(commandInput, issues, '$.command')) {
        return transitionResult({
            before: fact,
            value: fact,
            decision: 'hold',
            issues,
            changed: false,
            explanation: '事实命令结构无效，保持原值。',
        });
    }
    requireEnum(
        command.type,
        ['confirm', 'dispute', 'retract', 'rewrite'],
        issues,
        '$.command.type',
        'ledger.fact_transition_type',
    );
    if (activeBranch !== undefined) {
        activeBranchMatches(activeBranch, fact.branchId, issues);
    }
    if (!current.ok || issues.some((issue) => issue.severity === 'error')) {
        return transitionResult({
            before: fact,
            value: fact,
            decision: 'hold',
            issues,
            changed: false,
            explanation: '事实记录或分支证据无效，保持原值。',
        });
    }

    if (command.type === 'rewrite') {
        addIssue(
            issues,
            'ledger.fact_rewrite_requires_branch',
            '$.command.type',
            '已确认事实不能在当前分支内重写；必须使用 H3 显式新分支命令。',
            'unresolved',
        );
        return transitionResult({
            before: fact,
            value: fact,
            decision: 'branch-required',
            issues,
            changed: false,
            explanation: '当前分支事实保持不变。',
        });
    }

    if (command.type === 'confirm') {
        if (fact.status !== 'candidate' && fact.status !== 'disputed') {
            addIssue(
                issues,
                'ledger.fact_confirm_from_status',
                '$.status',
                '只有 candidate/disputed 事实可以进入 confirmed。',
            );
        }
        const evidence = validateConfirmationAuthority(command, fact, issues);
        if (issues.some((issue) => (
            ['error', 'unresolved'].includes(issue.severity)
        ))) {
            return transitionResult({
                before: fact,
                value: fact,
                decision: 'hold',
                issues,
                changed: false,
                explanation: '确认依据不足；事实保持 candidate/disputed。',
            });
        }
        const value = validateFact({
            ...fact,
            revision: fact.revision + 1,
            status: 'confirmed',
            evidence: dedupeEvidence([...fact.evidence, ...evidence]),
        });
        issues.push(...value.issues);
        return transitionResult({
            before: fact,
            value: value.value,
            decision: value.ok ? 'apply' : 'hold',
            issues,
            changed: value.ok,
            explanation: '事实通过显式证据门进入 confirmed。',
        });
    }

    const evidence = normalizeEvidenceList(command.evidence);
    validateEvidenceList(
        evidence,
        issues,
        '$.command.evidence',
        { minItems: 1 },
    );
    if (issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    ))) {
        return transitionResult({
            before: fact,
            value: fact,
            decision: 'hold',
            issues,
            changed: false,
            explanation: '争议或撤回缺少证据，保持原值。',
        });
    }

    if (command.type === 'dispute') {
        if (fact.status === 'retracted') {
            addIssue(
                issues,
                'ledger.fact_dispute_retracted',
                '$.status',
                '已撤回事实保留审计记录，不重新进入 disputed。',
            );
            return transitionResult({
                before: fact,
                value: fact,
                decision: 'hold',
                issues,
                changed: false,
                explanation: '已撤回事实保持终止状态。',
            });
        }
        const value = validateFact({
            ...fact,
            revision: fact.revision + 1,
            status: 'disputed',
            contradictedBy: dedupeEvidence([
                ...(fact.contradictedBy ?? []),
                ...evidence,
            ]),
        });
        issues.push(...value.issues);
        return transitionResult({
            before: fact,
            value: value.value,
            decision: value.ok ? 'apply' : 'hold',
            issues,
            changed: value.ok,
            explanation: '反证使事实进入 disputed，原记录未被删除。',
        });
    }

    const value = validateFact({
        ...fact,
        revision: fact.revision + 1,
        status: 'retracted',
        contradictedBy: dedupeEvidence([
            ...(fact.contradictedBy ?? []),
            ...evidence,
        ]),
    });
    issues.push(...value.issues);
    return transitionResult({
        before: fact,
        value: value.value,
        decision: value.ok ? 'apply' : 'hold',
        issues,
        changed: value.ok,
        explanation: '事实已撤回但保留完整审计记录。',
    });
}

export function createKnowledgeState(input, {
    source = 'suspicion',
    activeBranch,
} = {}) {
    const sourceRecord = isPlainObject(input) ? input : {};
    const issues = [];
    requireEnum(
        source,
        KNOWLEDGE_ACQUISITION_MODES,
        issues,
        '$.source',
        'ledger.knowledge_source',
    );
    const initialState = source === 'suspicion'
        ? 'suspected'
        : source === 'verification'
            ? 'unknown'
            : 'known';
    const value = normalizeKnowledge({
        ...sourceRecord,
        schemaVersion: '2.0',
        revision: sourceRecord.revision ?? 0,
        state: initialState,
        acquiredBy: sourceRecord.acquiredBy ?? [],
        visibility: sourceRecord.visibility ?? 'private',
        extensions: {
            ...(isPlainObject(sourceRecord.extensions)
                ? deepClone(sourceRecord.extensions)
                : {}),
            director: {
                ...(isPlainObject(sourceRecord.extensions?.director)
                    ? deepClone(sourceRecord.extensions.director)
                    : {}),
                acquisitionMode: source,
            },
        },
    });
    const validated = validateKnowledge(value);
    issues.push(...validated.issues);
    if (activeBranch !== undefined) {
        activeBranchMatches(activeBranch, value.branchId, issues);
    }
    const decision = issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    )) ? 'hold' : 'apply';
    return transitionResult({
        before: null,
        value: validated.value,
        decision,
        issues,
        changed: decision === 'apply',
        explanation: source === 'suspicion'
            ? 'NPC 怀疑只能建立 suspected 知识，不确认事实。'
            : '知情状态由显式获取路径建立。',
    });
}

export function transitionKnowledge(knowledgeInput, commandInput, {
    fact,
    activeBranch,
} = {}) {
    const current = validateKnowledge(knowledgeInput);
    const factResult = fact === undefined ? null : validateFact(fact);
    const issues = [
        ...current.issues,
        ...(factResult?.issues ?? []),
    ];
    const knowledge = current.value;
    const command = isPlainObject(commandInput) ? commandInput : {};
    requirePlainObject(commandInput, issues, '$.command');
    requireEnum(
        command.type,
        ['suspect', 'acquire', 'verify', 'forget'],
        issues,
        '$.command.type',
        'ledger.knowledge_transition_type',
    );
    if (activeBranch !== undefined) {
        activeBranchMatches(activeBranch, knowledge.branchId, issues);
    }
    if (
        factResult
        && (
            factResult.value.id !== knowledge.factId
            || factResult.value.branchId !== knowledge.branchId
        )
    ) {
        addIssue(
            issues,
            'ledger.knowledge_fact_mismatch',
            '$.fact',
            'Knowledge 必须引用同分支的准确 Fact。',
        );
    }
    if (
        !current.ok
        || issues.some((issue) => issue.severity === 'error')
    ) {
        return transitionResult({
            before: knowledge,
            value: knowledge,
            decision: 'hold',
            issues,
            changed: false,
            explanation: '知识记录、事实引用或分支证据无效，保持原值。',
        });
    }

    if (command.type === 'forget') {
        const value = validateKnowledge({
            ...knowledge,
            revision: knowledge.revision + 1,
            state: 'unknown',
            acquiredBy: [],
        });
        issues.push(...value.issues);
        return transitionResult({
            before: knowledge,
            value: value.value,
            decision: value.ok ? 'apply' : 'hold',
            issues,
            changed: value.ok,
            explanation: '知情者回到 unknown；Fact 本身不受影响。',
        });
    }

    const mode = command.type === 'suspect' && command.mode === undefined
        ? 'suspicion'
        : trimString(command.mode);
    requireEnum(
        mode,
        KNOWLEDGE_ACQUISITION_MODES,
        issues,
        '$.command.mode',
        'ledger.knowledge_acquisition_mode',
    );
    const evidence = normalizeEvidenceList(command.evidence);
    validateEvidenceList(
        evidence,
        issues,
        '$.command.evidence',
        { minItems: 1 },
    );
    if (issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    ))) {
        return transitionResult({
            before: knowledge,
            value: knowledge,
            decision: 'hold',
            issues,
            changed: false,
            explanation: '知识获取路径或证据不完整，保持原知识状态。',
        });
    }

    if (command.type === 'suspect' || mode === 'suspicion') {
        const value = validateKnowledge({
            ...knowledge,
            revision: knowledge.revision + 1,
            state: 'suspected',
            acquiredBy: dedupeEvidence([...knowledge.acquiredBy, ...evidence]),
        });
        issues.push(...value.issues);
        return transitionResult({
            before: knowledge,
            value: value.value,
            decision: value.ok ? 'apply' : 'hold',
            issues,
            changed: value.ok,
            explanation: '怀疑只升级到 suspected，不改变 Fact 状态。',
        });
    }

    if (command.type === 'acquire') {
        if (mode === 'verification') {
            addIssue(
                issues,
                'ledger.knowledge_verify_explicit',
                '$.command.type',
                'verification 必须使用 verify 命令并通过独立证据门。',
                'unresolved',
            );
        }
        if (issues.some((issue) => (
            ['error', 'unresolved'].includes(issue.severity)
        ))) {
            return transitionResult({
                before: knowledge,
                value: knowledge,
                decision: 'hold',
                issues,
                changed: false,
                explanation: '获取路径不完整，保持原知识状态。',
            });
        }
        const value = validateKnowledge({
            ...knowledge,
            revision: knowledge.revision + 1,
            state: 'known',
            acquiredBy: dedupeEvidence([...knowledge.acquiredBy, ...evidence]),
        });
        issues.push(...value.issues);
        return transitionResult({
            before: knowledge,
            value: value.value,
            decision: value.ok ? 'apply' : 'hold',
            issues,
            changed: value.ok,
            explanation: '显式获取路径使该知情者进入 known；不自动传播给其他角色。',
        });
    }

    if (!factResult || factResult.value.status !== 'confirmed') {
        addIssue(
            issues,
            'ledger.knowledge_verified_fact_unconfirmed',
            '$.fact.status',
            'Knowledge verified 需要同分支 confirmed Fact。',
            'unresolved',
        );
    }
    if (mode !== 'verification') {
        addIssue(
            issues,
            'ledger.knowledge_verification_mode',
            '$.command.mode',
            'verified 必须来自显式 verification 获取路径。',
            'unresolved',
        );
    }
    if (!evidence.some((entry) => (
        FACT_CONFIRMING_EVIDENCE_KINDS.includes(entry.kind)
    ))) {
        addIssue(
            issues,
            'ledger.knowledge_verification_evidence',
            '$.command.evidence',
            '消息、传闻或 NPC 怀疑不能单独把知识升级为 verified。',
            'unresolved',
        );
    }
    if (issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    ))) {
        return transitionResult({
            before: knowledge,
            value: knowledge,
            decision: 'hold',
            issues,
            changed: false,
            explanation: '验证证据不足，保持原知识状态。',
        });
    }
    const value = validateKnowledge({
        ...knowledge,
        revision: knowledge.revision + 1,
        state: 'verified',
        acquiredBy: dedupeEvidence([...knowledge.acquiredBy, ...evidence]),
    });
    issues.push(...value.issues);
    return transitionResult({
        before: knowledge,
        value: value.value,
        decision: value.ok ? 'apply' : 'hold',
        issues,
        changed: value.ok,
        explanation: '该知情者通过独立验证路径进入 verified；其他知情者不受影响。',
    });
}

/**
 * Convenience guard for the historical random-code failure. It creates only a
 * candidate fact and, optionally, suspected knowledge for an NPC. No social
 * identity or access grant is produced.
 */
export function adjudicateUnverifiedCode({
    fact,
    npcKnowledge,
    activeBranch,
} = {}) {
    const factResult = createFactCandidate(fact, {
        source: 'random-code',
        activeBranch,
    });
    const knowledgeResult = npcKnowledge
        ? createKnowledgeState(npcKnowledge, {
            source: 'suspicion',
            activeBranch,
        })
        : null;
    return {
        ok: factResult.status === 'valid'
            && (!knowledgeResult || knowledgeResult.status === 'valid'),
        decision: 'reject-confirmation',
        fact: factResult.value,
        knowledge: knowledgeResult?.value ?? null,
        grants: [],
        issues: [
            ...factResult.issues,
            ...(knowledgeResult?.issues ?? []),
        ],
        explanation: [
            '随机短语只保留为候选事实。',
            'NPC 反应最多是 suspected。',
            '没有生成自己人身份、通行权或 verified 知识。',
        ],
    };
}
