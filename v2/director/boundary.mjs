import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEvidenceList,
    normalizeV2Base,
    requireEnum,
    requirePlainObject,
    requireString,
    validateEvidenceList,
    validateV2Base,
    validationResult,
} from '../domain/common.mjs';
import { validateBranch } from '../transaction/branch.mjs';
import {
    compareMessageFingerprints,
    normalizeMessageFingerprint,
    validateMessageFingerprint,
} from '../transaction/fingerprint.mjs';
import { normalizeRiskRecall } from './recall.mjs';

export const PLAYER_CONTRIBUTION_KINDS = Object.freeze([
    'movement',
    'action',
    'dialogue',
    'decision',
    'skill-use',
    'resource-consumption',
    'check',
    'tone',
    'attitude',
    'psychology',
    'state-change',
]);

export const NARRATIVE_CONTRIBUTION_ACTORS = Object.freeze([
    'player',
    'npc',
    'environment',
    'world',
]);

export const NEGATIVE_CONSTRAINT_KINDS = Object.freeze([
    'no_movement',
    'no_extra_action',
    'no_dialogue',
    'no_decision',
    'no_skill_use',
    'no_resource_consumption',
    'no_check',
    'no_tone',
    'no_attitude',
    'no_psychology',
    'no_state_change',
]);

export const ALLOWED_NARRATIVE_KINDS = Object.freeze([
    'npc-action',
    'npc-dialogue',
    'npc-reaction',
    'environment',
    'sensory-detail',
    'world-reaction',
    'transition',
    'consequence',
]);

const CONSTRAINT_TO_CONTRIBUTION = Object.freeze({
    no_movement: 'movement',
    no_extra_action: 'action',
    no_dialogue: 'dialogue',
    no_decision: 'decision',
    no_skill_use: 'skill-use',
    no_resource_consumption: 'resource-consumption',
    no_check: 'check',
    no_tone: 'tone',
    no_attitude: 'attitude',
    no_psychology: 'psychology',
    no_state_change: 'state-change',
});

const BOUNDARY_KEYS = Object.freeze([
    'branchId',
    'target',
    'authorizations',
    'negativeConstraints',
    'claims',
    'unselectedCandidateIds',
    'allowedNarrativeKinds',
    'protectedPlayerStateRefs',
    'darkChoices',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeStringList(value) {
    return Array.isArray(value) ? value.map(trimString) : [];
}

function normalizeAuthorization(value) {
    if (!isPlainObject(value)) return value;
    return {
        id: trimString(value.id),
        kind: trimString(value.kind),
        actorId: trimString(value.actorId),
        ...(Object.hasOwn(value, 'exactText')
            ? { exactText: String(value.exactText) }
            : {}),
        ...(Object.hasOwn(value, 'resourceRef')
            ? { resourceRef: deepClone(value.resourceRef) }
            : {}),
        ...(Object.hasOwn(value, 'skillId')
            ? { skillId: trimString(value.skillId) }
            : {}),
        evidence: normalizeEvidenceList(value.evidence),
    };
}

function normalizeConstraint(value, index) {
    if (typeof value === 'string') {
        return {
            id: `constraint:${index}:${value}`,
            kind: trimString(value),
            actorId: 'player',
            evidence: [],
        };
    }
    if (!isPlainObject(value)) return value;
    return {
        id: trimString(value.id),
        kind: trimString(value.kind),
        actorId: trimString(value.actorId ?? 'player'),
        evidence: normalizeEvidenceList(value.evidence),
    };
}

function normalizeClaim(value) {
    if (!isPlainObject(value)) return value;
    return {
        id: trimString(value.id),
        proposition: trimString(value.proposition),
        selected: value.selected === true,
        evidence: normalizeEvidenceList(value.evidence),
    };
}

function normalizeDarkChoice(value) {
    if (!isPlainObject(value)) return value;
    return {
        id: trimString(value.id),
        selected: value.selected === true,
        summary: trimString(value.summary),
        evidence: normalizeEvidenceList(value.evidence),
    };
}

function validateUniqueIds(entries, issues, path) {
    if (!Array.isArray(entries)) {
        addIssue(issues, 'boundary.list_type', path, '边界字段必须是数组。');
        return;
    }
    const ids = [];
    entries.forEach((entry, index) => {
        if (!requirePlainObject(entry, issues, `${path}[${index}]`)) return;
        if (requireString(entry.id, issues, `${path}[${index}].id`)) {
            ids.push(entry.id);
        }
    });
    if (new Set(ids).size !== ids.length) {
        addIssue(issues, 'boundary.duplicate_id', path, '本轮边界条目 ID 必须唯一。');
    }
}

export function normalizeTurnBoundary(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, BOUNDARY_KEYS),
        branchId: trimString(source.branchId),
        target: normalizeMessageFingerprint(source.target),
        authorizations: Array.isArray(source.authorizations)
            ? source.authorizations.map(normalizeAuthorization)
            : [],
        negativeConstraints: Array.isArray(source.negativeConstraints)
            ? source.negativeConstraints.map(normalizeConstraint)
            : [],
        claims: Array.isArray(source.claims)
            ? source.claims.map(normalizeClaim)
            : [],
        unselectedCandidateIds: normalizeStringList(source.unselectedCandidateIds),
        allowedNarrativeKinds: Array.isArray(source.allowedNarrativeKinds)
            ? normalizeStringList(source.allowedNarrativeKinds)
            : [...ALLOWED_NARRATIVE_KINDS],
        protectedPlayerStateRefs: normalizeStringList(source.protectedPlayerStateRefs),
        darkChoices: Array.isArray(source.darkChoices)
            ? source.darkChoices.map(normalizeDarkChoice)
            : [],
    };
}

export function validateTurnBoundary(input) {
    const value = normalizeTurnBoundary(input);
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(value, issues);
    validateV2Base(value, issues, BOUNDARY_KEYS);
    requireString(value.branchId, issues, '$.branchId', {
        code: 'boundary.branch_id',
    });
    const target = validateMessageFingerprint(value.target, '$.target');
    issues.push(...target.issues);
    if (target.ok && target.value.branchId !== value.branchId) {
        addIssue(
            issues,
            'boundary.target_branch_mismatch',
            '$.target.branchId',
            'Turn Boundary 必须与目标消息绑定同一 branchId。',
        );
    }

    validateUniqueIds(value.authorizations, issues, '$.authorizations');
    value.authorizations.forEach((entry, index) => {
        const path = `$.authorizations[${index}]`;
        requireEnum(
            entry?.kind,
            PLAYER_CONTRIBUTION_KINDS,
            issues,
            `${path}.kind`,
            'boundary.authorization_kind',
        );
        requireString(entry?.actorId, issues, `${path}.actorId`);
        validateEvidenceList(entry?.evidence, issues, `${path}.evidence`);
    });

    validateUniqueIds(value.negativeConstraints, issues, '$.negativeConstraints');
    value.negativeConstraints.forEach((entry, index) => {
        const path = `$.negativeConstraints[${index}]`;
        requireEnum(
            entry?.kind,
            NEGATIVE_CONSTRAINT_KINDS,
            issues,
            `${path}.kind`,
            'boundary.constraint_kind',
        );
        requireString(entry?.actorId, issues, `${path}.actorId`);
        validateEvidenceList(entry?.evidence, issues, `${path}.evidence`);
    });

    validateUniqueIds(value.claims, issues, '$.claims');
    value.claims.forEach((entry, index) => {
        const path = `$.claims[${index}]`;
        requireString(entry?.proposition, issues, `${path}.proposition`);
        validateEvidenceList(entry?.evidence, issues, `${path}.evidence`);
    });

    validateUniqueIds(value.darkChoices, issues, '$.darkChoices');
    value.darkChoices.forEach((entry, index) => {
        const path = `$.darkChoices[${index}]`;
        requireString(entry?.summary, issues, `${path}.summary`);
        validateEvidenceList(entry?.evidence, issues, `${path}.evidence`);
    });

    for (const [path, list] of [
        ['$.unselectedCandidateIds', value.unselectedCandidateIds],
        ['$.allowedNarrativeKinds', value.allowedNarrativeKinds],
        ['$.protectedPlayerStateRefs', value.protectedPlayerStateRefs],
    ]) {
        if (!Array.isArray(list)) {
            addIssue(issues, 'boundary.string_list', path, '字段必须是字符串数组。');
            continue;
        }
        list.forEach((entry, index) => requireString(entry, issues, `${path}[${index}]`));
        if (new Set(list).size !== list.length) {
            addIssue(issues, 'boundary.string_list_duplicate', path, '字符串列表不能重复。');
        }
    }
    value.allowedNarrativeKinds.forEach((entry, index) => {
        requireEnum(
            entry,
            ALLOWED_NARRATIVE_KINDS,
            issues,
            `$.allowedNarrativeKinds[${index}]`,
            'boundary.narrative_kind',
        );
    });

    const selectedClaimIds = new Set(
        value.claims.filter((claim) => claim.selected).map((claim) => claim.id),
    );
    for (const id of value.unselectedCandidateIds) {
        if (selectedClaimIds.has(id)) {
            addIssue(
                issues,
                'boundary.candidate_selection_conflict',
                '$.unselectedCandidateIds',
                '同一候选不能同时标为已选择和未选择。',
            );
        }
    }
    return validationResult(value, issues);
}

export function createTurnBoundary(input) {
    return validateTurnBoundary({
        ...input,
        id: input?.id ?? `turn-boundary:${input?.branchId ?? 'unresolved'}`,
        schemaVersion: '2.0',
        revision: input?.revision ?? 0,
        authorizations: input?.authorizations ?? [],
        negativeConstraints: input?.negativeConstraints ?? [],
        claims: input?.claims ?? [],
        unselectedCandidateIds: input?.unselectedCandidateIds ?? [],
        protectedPlayerStateRefs: input?.protectedPlayerStateRefs ?? [],
        darkChoices: input?.darkChoices ?? [],
    });
}

function normalizeContribution(value, index) {
    if (!isPlainObject(value)) return value;
    return {
        id: trimString(value.id ?? `contribution:${index}`),
        actor: trimString(value.actor),
        actorId: trimString(value.actorId),
        kind: trimString(value.kind),
        source: trimString(value.source),
        ...(Object.hasOwn(value, 'authorizationId')
            ? { authorizationId: trimString(value.authorizationId) }
            : {}),
        ...(Object.hasOwn(value, 'candidateId')
            ? { candidateId: trimString(value.candidateId) }
            : {}),
        ...(Object.hasOwn(value, 'darkChoiceId')
            ? { darkChoiceId: trimString(value.darkChoiceId) }
            : {}),
        ...(Object.hasOwn(value, 'content')
            ? { content: String(value.content) }
            : {}),
        ...(Object.hasOwn(value, 'stateRef')
            ? { stateRef: trimString(value.stateRef) }
            : {}),
    };
}

function violation(code, contribution, message, details) {
    return {
        code,
        contributionId: contribution?.id ?? '',
        message,
        ...(details === undefined ? {} : { details: deepClone(details) }),
    };
}

function authorizationFor(boundary, contribution) {
    if (contribution.authorizationId) {
        return boundary.authorizations.find(
            (entry) => entry.id === contribution.authorizationId,
        );
    }
    const matches = boundary.authorizations.filter((entry) => (
        entry.kind === contribution.kind
        && entry.actorId === contribution.actorId
    ));
    return matches.length === 1 ? matches[0] : null;
}

function contributionNeedsPositiveAuthorization(contribution) {
    return (
        contribution.actor === 'player'
        && contribution.source !== 'player-input'
        && PLAYER_CONTRIBUTION_KINDS.includes(contribution.kind)
    );
}

export function adjudicateTurnBoundary(boundaryInput, assessmentInput, {
    currentFingerprint,
    activeBranch,
} = {}) {
    const boundaryResult = validateTurnBoundary(boundaryInput);
    const issues = [...boundaryResult.issues];
    const boundary = boundaryResult.value;
    const assessment = isPlainObject(assessmentInput) ? assessmentInput : {};
    const recall = normalizeRiskRecall(assessment.riskRecall);
    const contributions = Array.isArray(assessment.contributions)
        ? assessment.contributions.map(normalizeContribution)
        : [];

    if (!boundaryResult.ok) {
        return {
            ok: false,
            validationStatus: boundaryResult.status,
            decision: 'unresolved',
            boundary,
            allowedContributions: [],
            blockedContributions: [],
            violations: [],
            issues,
            explanation: ['Turn Boundary 本身没有通过结构验证。'],
        };
    }

    if (currentFingerprint !== undefined) {
        const target = compareMessageFingerprints(boundary.target, currentFingerprint);
        issues.push(...target.issues);
        if (!target.ok) {
            return {
                ok: false,
                validationStatus: 'rejected',
                decision: 'stale',
                boundary,
                allowedContributions: [],
                blockedContributions: contributions,
                violations: [{
                    code: 'boundary.target_stale',
                    contributionId: '',
                    message: '本轮目标消息指纹已经变化。',
                    details: { mismatches: target.mismatches },
                }],
                issues,
                explanation: ['目标消息已过期，任何本轮裁定都不能落到新目标。'],
            };
        }
    }

    if (activeBranch !== undefined) {
        const branch = validateBranch(activeBranch);
        issues.push(...branch.issues);
        if (
            !branch.ok
            || branch.value.id !== boundary.branchId
            || branch.value.status !== 'active'
        ) {
            return {
                ok: false,
                validationStatus: 'rejected',
                decision: 'stale',
                boundary,
                allowedContributions: [],
                blockedContributions: contributions,
                violations: [{
                    code: 'boundary.branch_stale',
                    contributionId: '',
                    message: 'Turn Boundary 不再属于当前 active 分支。',
                }],
                issues,
                explanation: ['旧分支边界不能裁定当前分支。'],
            };
        }
    }

    if (recall.semanticReviewRequired && !Array.isArray(assessment.contributions)) {
        return {
            ok: false,
            validationStatus: 'unresolved',
            decision: 'unresolved',
            boundary,
            allowedContributions: [],
            blockedContributions: [],
            violations: [{
                code: 'boundary.semantic_assessment_missing',
                contributionId: '',
                message: '风险召回已命中，但没有结构化语义贡献供最终裁决。',
            }],
            issues,
            explanation: ['风险召回不是最终裁决；缺少语义输入时保持未决。'],
        };
    }

    const violations = [];
    const blocked = new Set();
    const prohibitedContributions = new Set(
        boundary.negativeConstraints.map((entry) => (
            `${entry.actorId}\u0000${CONSTRAINT_TO_CONTRIBUTION[entry.kind]}`
        )),
    );
    const unselected = new Set(boundary.unselectedCandidateIds);
    const selectedDarkChoices = new Set(
        boundary.darkChoices
            .filter((entry) => entry.selected)
            .map((entry) => entry.id),
    );

    contributions.forEach((contribution, index) => {
        const path = `$.assessment.contributions[${index}]`;
        if (!requirePlainObject(contribution, issues, path)) {
            blocked.add(contribution);
            return;
        }
        const issueCountBeforeValidation = issues.length;
        requireEnum(
            contribution.actor,
            NARRATIVE_CONTRIBUTION_ACTORS,
            issues,
            `${path}.actor`,
            'boundary.contribution_actor',
        );
        requireString(contribution.actorId, issues, `${path}.actorId`);
        requireString(contribution.source, issues, `${path}.source`);

        if (contribution.actor === 'player') {
            requireEnum(
                contribution.kind,
                PLAYER_CONTRIBUTION_KINDS,
                issues,
                `${path}.kind`,
                'boundary.contribution_kind',
            );
        }
        if (issues.slice(issueCountBeforeValidation).some((issue) => (
            ['error', 'unresolved'].includes(issue.severity)
        ))) {
            blocked.add(contribution);
            return;
        }

        if (contribution.actor === 'player') {
            if (prohibitedContributions.has(
                `${contribution.actorId}\u0000${contribution.kind}`,
            )) {
                violations.push(violation(
                    'boundary.explicit_negative_constraint',
                    contribution,
                    `玩家明确禁止本轮新增 ${contribution.kind}。`,
                    { kind: contribution.kind },
                ));
                blocked.add(contribution);
            }
            if (contribution.candidateId && unselected.has(contribution.candidateId)) {
                violations.push(violation(
                    'boundary.unselected_candidate',
                    contribution,
                    '未选择候选不能被当成玩家已采取的行动或事实。',
                    { candidateId: contribution.candidateId },
                ));
                blocked.add(contribution);
            }
            if (contributionNeedsPositiveAuthorization(contribution)) {
                const authorization = authorizationFor(boundary, contribution);
                if (!authorization) {
                    violations.push(violation(
                        'boundary.player_action_unauthorized',
                        contribution,
                        '模型不得替玩家新增未经授权的行动、状态或表达。',
                        { kind: contribution.kind },
                    ));
                    blocked.add(contribution);
                } else if (
                    authorization.exactText !== undefined
                    && contribution.content !== authorization.exactText
                ) {
                    violations.push(violation(
                        'boundary.authorized_dialogue_changed',
                        contribution,
                        '只授权精确对白时不得改写措辞、语气或附加内容。',
                        { authorizationId: authorization.id },
                    ));
                    blocked.add(contribution);
                }
            }
            if (
                contribution.darkChoiceId
                && !selectedDarkChoices.has(contribution.darkChoiceId)
            ) {
                violations.push(violation(
                    'boundary.dark_choice_not_selected',
                    contribution,
                    '未明确选择的黑暗候选不能被视为玩家决定。',
                ));
                blocked.add(contribution);
            }
        } else if (!boundary.allowedNarrativeKinds.includes(contribution.kind)) {
            violations.push(violation(
                'boundary.narrative_space_exceeded',
                contribution,
                'NPC、环境或世界扩展超出本轮允许的叙事空间。',
                { kind: contribution.kind },
            ));
            blocked.add(contribution);
        }

        if (
            contribution.stateRef
            && boundary.protectedPlayerStateRefs.includes(contribution.stateRef)
            && contribution.source !== 'player-input'
        ) {
            violations.push(violation(
                'boundary.protected_player_state',
                contribution,
                '受保护的玩家状态路径缺少本轮明确授权。',
                { stateRef: contribution.stateRef },
            ));
            blocked.add(contribution);
        }
    });

    if (assessment.reframesSelectedDarkChoice === true && selectedDarkChoices.size) {
        violations.push({
            code: 'boundary.dark_choice_reframed',
            contributionId: '',
            message: '明确选择的黑暗行为必须保留其机制和后果，不能被二审洗白。',
            details: { darkChoiceIds: [...selectedDarkChoices] },
        });
    }

    const blockedContributions = contributions.filter((entry) => blocked.has(entry));
    const allowedContributions = contributions.filter((entry) => !blocked.has(entry));
    const validationStatus = issues.some((issue) => issue.severity === 'error')
        ? 'rejected'
        : issues.some((issue) => issue.severity === 'unresolved')
            ? 'unresolved'
            : 'valid';
    const decision = violations.length
        ? 'reject'
        : validationStatus === 'valid'
            ? 'accept'
            : 'unresolved';
    return {
        ok: decision === 'accept' && validationStatus === 'valid',
        validationStatus,
        decision,
        boundary,
        allowedContributions,
        blockedContributions,
        violations,
        issues,
        riskRecall: recall,
        preservesSelectedDarkChoices: assessment.reframesSelectedDarkChoice !== true,
        explanation: violations.length
            ? violations.map((entry) => entry.message)
            : validationStatus !== 'valid'
                ? ['结构化语义贡献存在歧义或非法字段；未作接受裁决。']
                : ['候选叙事位于本轮授权与自然叙事空间内。'],
    };
}
