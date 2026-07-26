import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEvidenceList,
    requireEnum,
    requirePlainObject,
    requireString,
    validateEvidenceList,
    validationResult,
} from '../domain/common.mjs';
import {
    validateClaimAdjudication,
    validateFact,
} from '../domain/state.mjs';
import { validateBranch } from '../transaction/branch.mjs';
import {
    compareMessageFingerprints,
    normalizeMessageFingerprint,
} from '../transaction/fingerprint.mjs';

export const CLAIM_IMPACT_LEVELS = Object.freeze([
    'cosmetic',
    'local',
    'material',
    'structural',
]);

export const H2_RESOLUTION_TYPES = Object.freeze([
    'check',
    'cost',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeClaim(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        id: trimString(source.id),
        factId: trimString(source.factId ?? `fact:${source.id ?? ''}`),
        proposition: trimString(source.proposition),
        branchId: trimString(source.branchId),
        subjectIds: Array.isArray(source.subjectIds)
            ? source.subjectIds.map(trimString)
            : [],
        evidence: normalizeEvidenceList(source.evidence),
    };
}

function normalizeAssessment(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        impact: trimString(source.impact),
        createsPersistentFact: source.createsPersistentFact === true,
        mechanicalAdvantage: source.mechanicalAdvantage === true,
        contradictsConfirmedFact: source.contradictsConfirmedFact === true,
        contradictsSettledTransaction: source.contradictsSettledTransaction === true,
        contradictsTerminalQuest: source.contradictsTerminalQuest === true,
        rewritesBranchHistory: source.rewritesBranchHistory === true,
        semanticBasis: Array.isArray(source.semanticBasis)
            ? source.semanticBasis.map(trimString)
            : [],
    };
}

function normalizeH2Resolution(value) {
    if (!isPlainObject(value)) return null;
    return {
        type: trimString(value.type),
        ...(Object.hasOwn(value, 'checkId')
            ? { checkId: trimString(value.checkId) }
            : {}),
        ...(Object.hasOwn(value, 'difficulty')
            ? { difficulty: deepClone(value.difficulty) }
            : {}),
        ...(Object.hasOwn(value, 'resource')
            ? { resource: deepClone(value.resource) }
            : {}),
        ...(Object.hasOwn(value, 'amount')
            ? { amount: value.amount }
            : {}),
        ...(Object.hasOwn(value, 'reason')
            ? { reason: trimString(value.reason) }
            : {}),
        ...(Object.hasOwn(value, 'extensions')
            ? { extensions: deepClone(value.extensions) }
            : {}),
    };
}

export function classifyClaimImpact(assessmentInput) {
    const assessment = normalizeAssessment(assessmentInput);
    const issues = [];
    requireEnum(
        assessment.impact,
        CLAIM_IMPACT_LEVELS,
        issues,
        '$.assessment.impact',
        'director.claim_impact',
    );
    if (!assessment.semanticBasis.length) {
        addIssue(
            issues,
            'director.semantic_basis_missing',
            '$.assessment.semanticBasis',
            '最终口胡分类必须携带结构化语义依据，不能只依赖关键词召回。',
            'unresolved',
        );
    }

    let level = 'H0';
    if (
        assessment.contradictsConfirmedFact
        || assessment.contradictsSettledTransaction
        || assessment.contradictsTerminalQuest
        || assessment.rewritesBranchHistory
    ) {
        level = 'H3';
    } else if (
        assessment.mechanicalAdvantage
        || ['material', 'structural'].includes(assessment.impact)
    ) {
        level = 'H2';
    } else if (
        assessment.createsPersistentFact
        || assessment.impact === 'local'
    ) {
        level = 'H1';
    }
    return {
        ok: !issues.some((issue) => ['error', 'unresolved'].includes(issue.severity)),
        status: issues.some((issue) => issue.severity === 'error')
            ? 'rejected'
            : issues.some((issue) => issue.severity === 'unresolved')
                ? 'unresolved'
                : 'valid',
        level,
        assessment,
        issues,
    };
}

function factImpact(level, assessment) {
    if (level === 'H0') return 'cosmetic';
    if (level === 'H1') return assessment.impact === 'cosmetic'
        ? 'local'
        : assessment.impact;
    return assessment.impact;
}

function buildFact(claim, assessment, level, status) {
    return validateFact({
        id: claim.factId,
        schemaVersion: '2.0',
        revision: 0,
        proposition: claim.proposition,
        status,
        scope: level === 'H0' ? 'turn' : 'branch',
        branchId: claim.branchId,
        subjectIds: claim.subjectIds,
        evidence: claim.evidence,
        impact: factImpact(level, assessment),
        extensions: {
            director: {
                claimId: claim.id,
                adjudicationLevel: level,
            },
        },
    });
}

function checkCommand(claim, context, resolution) {
    return {
        type: 'check',
        payload: {
            commandVersion: '2.0-phase3',
            claimId: claim.id,
            factId: claim.factId,
            branchId: claim.branchId,
            target: normalizeMessageFingerprint(context.target),
            checkId: resolution.checkId,
            ...(resolution.difficulty === undefined
                ? {}
                : { difficulty: deepClone(resolution.difficulty) }),
            resolutionEffect: 'confirm-candidate-fact-on-success',
            ...(resolution.extensions === undefined
                ? {}
                : { extensions: deepClone(resolution.extensions) }),
        },
    };
}

function costCommand(claim, context, resolution) {
    return {
        type: 'cost',
        payload: {
            commandVersion: '2.0-phase3',
            claimId: claim.id,
            factId: claim.factId,
            branchId: claim.branchId,
            target: normalizeMessageFingerprint(context.target),
            resource: deepClone(resolution.resource),
            amount: resolution.amount,
            reason: resolution.reason,
            resolutionEffect: 'confirm-candidate-fact-after-transaction',
            ...(resolution.extensions === undefined
                ? {}
                : { extensions: deepClone(resolution.extensions) }),
        },
    };
}

function validateH2Resolution(resolution, issues) {
    if (!resolution) {
        addIssue(
            issues,
            'director.h2_policy_unresolved',
            '$.context.h2Resolution',
            'H2 需要由战役规则显式提供检定或代价策略。',
            'unresolved',
        );
        return false;
    }
    requireEnum(
        resolution.type,
        H2_RESOLUTION_TYPES,
        issues,
        '$.context.h2Resolution.type',
        'director.h2_resolution_type',
    );
    if (resolution.type === 'check') {
        requireString(
            resolution.checkId,
            issues,
            '$.context.h2Resolution.checkId',
        );
    } else if (resolution.type === 'cost') {
        if (!isPlainObject(resolution.resource)) {
            addIssue(
                issues,
                'director.h2_cost_resource',
                '$.context.h2Resolution.resource',
                'H2 代价必须引用显式类型化资源。',
            );
        } else {
            requireString(
                resolution.resource.ownerId,
                issues,
                '$.context.h2Resolution.resource.ownerId',
            );
            requireString(
                resolution.resource.resourceId,
                issues,
                '$.context.h2Resolution.resource.resourceId',
            );
        }
        if (
            typeof resolution.amount !== 'number'
            || !Number.isFinite(resolution.amount)
            || resolution.amount <= 0
        ) {
            addIssue(
                issues,
                'director.h2_cost_amount',
                '$.context.h2Resolution.amount',
                'H2 代价必须是正的有限数字；不得从描述文本猜值。',
            );
        }
        requireString(
            resolution.reason,
            issues,
            '$.context.h2Resolution.reason',
        );
    }
    return !issues.some((issue) => ['error', 'unresolved'].includes(issue.severity));
}

function branchCommand(claim, context) {
    return {
        type: 'new-branch',
        payload: {
            commandVersion: '2.0-phase3',
            kind: 'explicit-fork',
            claimId: claim.id,
            parentBranchId: claim.branchId,
            checkpointRef: context.checkpointRef,
            sourceTarget: normalizeMessageFingerprint(context.target),
            requiresNewFingerprint: true,
            preservesParentBranch: true,
            auditReason: 'explicit-h3-retcon',
        },
    };
}

function validateContext(claim, context, issues) {
    const branch = validateBranch(context.activeBranch);
    issues.push(...branch.issues);
    if (
        !branch.ok
        || branch.value.id !== claim.branchId
        || branch.value.status !== 'active'
    ) {
        addIssue(
            issues,
            'director.claim_branch_stale',
            '$.context.activeBranch',
            '主张不属于当前 active 分支。',
        );
    }
    const target = compareMessageFingerprints(
        context.target,
        context.currentFingerprint ?? context.target,
    );
    issues.push(...target.issues);
    if (!target.ok) {
        addIssue(
            issues,
            'director.claim_target_stale',
            '$.context.target',
            '主张目标指纹已经变化。',
        );
    }
    if (
        normalizeMessageFingerprint(context.target).branchId !== claim.branchId
    ) {
        addIssue(
            issues,
            'director.claim_target_branch_mismatch',
            '$.context.target.branchId',
            '主张、目标消息与分支必须一致。',
        );
    }
}

function resultWithValidation(adjudication, fact, issues, extra = {}) {
    const validated = validateClaimAdjudication(adjudication);
    const allIssues = [...issues, ...validated.issues, ...(fact?.issues ?? [])];
    const status = allIssues.some((issue) => issue.severity === 'error')
        ? 'rejected'
        : allIssues.some((issue) => issue.severity === 'unresolved')
            ? 'unresolved'
            : 'valid';
    return {
        ok: status === 'valid',
        status,
        adjudication: validated.value,
        fact: fact?.value ?? null,
        issues: allIssues,
        ...extra,
    };
}

/**
 * The caller supplies bounded semantic assessment. This function deliberately
 * performs no keyword classification; regular-expression recall is a separate
 * stage and cannot directly influence the final level.
 */
export function adjudicateClaim(input) {
    const source = isPlainObject(input) ? input : {};
    const claim = normalizeClaim(source.claim);
    const assessmentResult = classifyClaimImpact(source.assessment);
    const assessment = assessmentResult.assessment;
    const context = isPlainObject(source.context) ? source.context : {};
    const issues = [...assessmentResult.issues];

    requirePlainObject(source.claim, issues, '$.claim');
    requireString(claim.id, issues, '$.claim.id');
    requireString(claim.factId, issues, '$.claim.factId');
    requireString(claim.proposition, issues, '$.claim.proposition');
    requireString(claim.branchId, issues, '$.claim.branchId');
    validateEvidenceList(claim.evidence, issues, '$.claim.evidence', { minItems: 1 });
    validateContext(claim, context, issues);

    if (issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    ))) {
        return resultWithValidation({
            level: assessmentResult.level,
            decision: assessmentResult.level === 'H3' ? 'reject' : 'pending',
            claimIds: [claim.id].filter(Boolean),
            reason: '主张上下文或证据存在歧义，未执行语义裁决。',
            evidence: claim.evidence,
            commands: assessmentResult.level === 'H3' ? [] : [{
                type: 'fact-candidate',
                payload: { claimId: claim.id, branchId: claim.branchId },
            }],
        }, null, issues);
    }

    const level = assessmentResult.level;
    if (level === 'H0') {
        return resultWithValidation({
            level,
            decision: 'accept',
            claimIds: [claim.id],
            reason: '主张仅补充无机械收益且不需持久化的叙事细节。',
            evidence: claim.evidence,
            commands: [],
        }, null, issues, {
            explanation: {
                levelBasis: assessment.semanticBasis,
                stateEffect: 'narrative-only',
            },
        });
    }

    if (level === 'H1') {
        const fact = buildFact(claim, assessment, level, 'confirmed');
        return resultWithValidation({
            level,
            decision: 'accept',
            claimIds: [claim.id],
            reason: '低影响局部主张在当前分支内接纳，并保留来源证据。',
            evidence: claim.evidence,
            commands: [{
                type: 'fact-confirm',
                payload: {
                    commandVersion: '2.0-phase3',
                    claimId: claim.id,
                    factId: claim.factId,
                    branchId: claim.branchId,
                    scope: 'branch',
                    authority: 'adjudicated-h1',
                },
            }],
        }, fact, issues, {
            explanation: {
                levelBasis: assessment.semanticBasis,
                stateEffect: 'branch-local-confirmed-fact',
            },
        });
    }

    if (level === 'H2') {
        const fact = buildFact(claim, assessment, level, 'candidate');
        const resolution = normalizeH2Resolution(context.h2Resolution);
        const resolutionValid = validateH2Resolution(resolution, issues);
        const commands = [{
            type: 'fact-candidate',
            payload: {
                commandVersion: '2.0-phase3',
                claimId: claim.id,
                factId: claim.factId,
                branchId: claim.branchId,
            },
        }];
        if (resolutionValid) {
            commands.push(
                resolution.type === 'check'
                    ? checkCommand(claim, context, resolution)
                    : costCommand(claim, context, resolution),
            );
        }
        return resultWithValidation({
            level,
            decision: resolutionValid
                ? resolution.type === 'check'
                    ? 'roll_required'
                    : 'accept_with_cost'
                : 'pending',
            claimIds: [claim.id],
            reason: resolutionValid
                ? '主张会带来显著优势；结算前保持候选，并执行显式检定或代价命令。'
                : '缺少战役级检定/代价策略；保持候选，不猜规则。',
            evidence: claim.evidence,
            commands,
        }, fact, issues, {
            explanation: {
                levelBasis: assessment.semanticBasis,
                stateEffect: 'candidate-until-resolution',
            },
        });
    }

    if (context.explicitRetcon !== true) {
        return resultWithValidation({
            level: 'H3',
            decision: 'reject',
            claimIds: [claim.id],
            reason: '主张会改写已确认事实、已结算事务、终态任务或分支历史。',
            evidence: claim.evidence,
            commands: [],
        }, null, issues, {
            explanation: {
                levelBasis: assessment.semanticBasis,
                stateEffect: 'preserve-current-branch',
            },
        });
    }

    requireString(
        context.checkpointRef,
        issues,
        '$.context.checkpointRef',
        { code: 'director.h3_checkpoint_ref' },
    );
    if (issues.some((issue) => (
        ['error', 'unresolved'].includes(issue.severity)
    ))) {
        return resultWithValidation({
            level: 'H3',
            decision: 'reject',
            claimIds: [claim.id],
            reason: '显式改写缺少唯一 checkpoint；当前分支保持不变。',
            evidence: claim.evidence,
            commands: [],
        }, null, issues, {
            explanation: {
                levelBasis: assessment.semanticBasis,
                stateEffect: 'preserve-current-branch',
            },
        });
    }
    const command = branchCommand(claim, context);
    return resultWithValidation({
        level: 'H3',
        decision: 'branch_required',
        claimIds: [claim.id],
        reason: '显式改写已授权；保留原分支并要求从明确 checkpoint 新建分支。',
        evidence: claim.evidence,
        commands: [command],
    }, null, issues, {
        explanation: {
            levelBasis: assessment.semanticBasis,
            stateEffect: 'explicit-new-branch-only',
        },
    });
}

export function validateDirectorClaimInput(input) {
    const source = isPlainObject(input) ? input : {};
    const claim = normalizeClaim(source.claim);
    const issues = [];
    requireString(claim.id, issues, '$.claim.id');
    requireString(claim.proposition, issues, '$.claim.proposition');
    requireString(claim.branchId, issues, '$.claim.branchId');
    validateEvidenceList(claim.evidence, issues, '$.claim.evidence');
    return validationResult(claim, issues);
}
