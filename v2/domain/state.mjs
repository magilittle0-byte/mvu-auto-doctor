import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEvidenceList,
    normalizeMigrationState,
    normalizeV2Base,
    requireEnum,
    requireFiniteNumber,
    requirePlainObject,
    requireString,
    validateEvidenceList,
    validateMigrationState,
    validateV2Base,
    validationResult,
} from './common.mjs';

export const FACT_STATUSES = Object.freeze([
    'candidate',
    'confirmed',
    'disputed',
    'retracted',
]);

export const FACT_SCOPES = Object.freeze([
    'turn',
    'branch',
    'chat',
    'world',
]);

export const FACT_IMPACTS = Object.freeze([
    'cosmetic',
    'local',
    'material',
    'structural',
]);

export const KNOWLEDGE_STATES = Object.freeze([
    'unknown',
    'suspected',
    'known',
    'verified',
]);

export const KNOWLEDGE_VISIBILITIES = Object.freeze([
    'private',
    'group',
    'public',
]);

export const QUEST_STATUSES = Object.freeze([
    'proposed',
    'active',
    'suspended',
    'completed',
    'failed',
    'cancelled',
    'superseded',
]);

export const QUEST_OBJECTIVE_STATUSES = Object.freeze([
    'pending',
    'active',
    'completed',
    'failed',
    'cancelled',
]);

export const TERMINAL_QUEST_STATUSES = Object.freeze([
    'completed',
    'failed',
    'cancelled',
    'superseded',
]);

export const SOCIAL_VOLUNTARY_DIMENSIONS = Object.freeze([
    'affection',
    'trust',
    'intimacy',
    'loyalty',
    'respect',
    'fear',
]);

export const SOCIAL_COERCIVE_DIMENSIONS = Object.freeze([
    'obedience',
    'control',
    'compulsion',
]);

const FACT_KEYS = Object.freeze([
    'proposition',
    'status',
    'scope',
    'branchId',
    'subjectIds',
    'evidence',
    'contradictedBy',
    'supersedes',
    'impact',
    'migration',
]);

const KNOWLEDGE_KEYS = Object.freeze([
    'knowerId',
    'factId',
    'state',
    'acquiredBy',
    'branchId',
    'visibility',
    'migration',
]);

const SOCIAL_KEYS = Object.freeze([
    'fromActorId',
    'toActorId',
    'voluntary',
    'coercive',
    'labels',
    'evidence',
    'branchId',
    'migration',
]);

const QUEST_KEYS = Object.freeze([
    'title',
    'status',
    'branchId',
    'objectives',
    'settlementTransactionIds',
    'supersededBy',
    'terminalEvidence',
    'migration',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeStringList(value) {
    return Array.isArray(value) ? value.map((item) => trimString(item)) : [];
}

function validateStringList(value, issues, path, { unique = false } = {}) {
    if (!Array.isArray(value)) {
        addIssue(issues, 'field.string_list', path, '字段必须是字符串数组。');
        return;
    }
    value.forEach((entry, index) => {
        requireString(entry, issues, `${path}[${index}]`);
    });
    if (unique && new Set(value).size !== value.length) {
        addIssue(issues, 'field.string_list_duplicates', path, '字符串数组不能包含重复项。');
    }
}

export function normalizeFact(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, FACT_KEYS),
        proposition: trimString(source.proposition),
        status: trimString(source.status),
        scope: trimString(source.scope),
        branchId: trimString(source.branchId),
        subjectIds: normalizeStringList(source.subjectIds),
        evidence: normalizeEvidenceList(source.evidence),
        ...(Object.hasOwn(source, 'contradictedBy')
            ? { contradictedBy: normalizeEvidenceList(source.contradictedBy) }
            : {}),
        ...(Object.hasOwn(source, 'supersedes')
            ? { supersedes: normalizeStringList(source.supersedes) }
            : {}),
        impact: trimString(source.impact),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateFact(input) {
    const value = normalizeFact(input);
    const issues = [];
    validateV2Base(value, issues, FACT_KEYS);
    requireString(value.proposition, issues, '$.proposition', { code: 'fact.proposition' });
    requireEnum(value.status, FACT_STATUSES, issues, '$.status', 'fact.status');
    requireEnum(value.scope, FACT_SCOPES, issues, '$.scope', 'fact.scope');
    requireString(value.branchId, issues, '$.branchId', { code: 'fact.branch_id' });
    validateStringList(value.subjectIds, issues, '$.subjectIds', { unique: true });
    validateEvidenceList(
        value.evidence,
        issues,
        '$.evidence',
        { minItems: value.status === 'confirmed' ? 1 : 0 },
    );
    if (value.contradictedBy !== undefined) {
        validateEvidenceList(value.contradictedBy, issues, '$.contradictedBy');
    }
    if (value.supersedes !== undefined) {
        validateStringList(value.supersedes, issues, '$.supersedes', { unique: true });
    }
    requireEnum(value.impact, FACT_IMPACTS, issues, '$.impact', 'fact.impact');
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}

export function normalizeKnowledge(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, KNOWLEDGE_KEYS),
        knowerId: trimString(source.knowerId),
        factId: trimString(source.factId),
        state: trimString(source.state),
        acquiredBy: normalizeEvidenceList(source.acquiredBy),
        branchId: trimString(source.branchId),
        visibility: trimString(source.visibility),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateKnowledge(input) {
    const value = normalizeKnowledge(input);
    const issues = [];
    validateV2Base(value, issues, KNOWLEDGE_KEYS);
    requireString(value.knowerId, issues, '$.knowerId', { code: 'knowledge.knower_id' });
    requireString(value.factId, issues, '$.factId', { code: 'knowledge.fact_id' });
    requireEnum(value.state, KNOWLEDGE_STATES, issues, '$.state', 'knowledge.state');
    validateEvidenceList(
        value.acquiredBy,
        issues,
        '$.acquiredBy',
        { minItems: value.state === 'unknown' ? 0 : 1 },
    );
    requireString(value.branchId, issues, '$.branchId', {
        code: 'knowledge.branch_id',
    });
    requireEnum(
        value.visibility,
        KNOWLEDGE_VISIBILITIES,
        issues,
        '$.visibility',
        'knowledge.visibility',
    );
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}

function normalizeDimensions(value, allowedKeys) {
    if (!isPlainObject(value)) return value;
    const result = deepClone(value);
    for (const key of allowedKeys) {
        if (Object.hasOwn(value, key)) result[key] = value[key];
    }
    return result;
}

function validateDimensions(value, allowedKeys, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    for (const [key, entry] of Object.entries(value)) {
        if (!allowedKeys.includes(key)) {
            addIssue(
                issues,
                'social.dimension_unknown',
                `${path}.${key}`,
                '未知关系维度必须放入 extensions，不能伪装成协议硬字段。',
            );
            continue;
        }
        requireFiniteNumber(entry, issues, `${path}.${key}`, {
            code: 'social.dimension_value',
        });
    }
}

export function normalizeSocialState(input) {
    const source = isPlainObject(input) ? input : {};
    const coerciveSource = isPlainObject(source.coercive) ? source.coercive : {};
    return {
        ...normalizeV2Base(source, SOCIAL_KEYS),
        fromActorId: trimString(source.fromActorId),
        toActorId: trimString(source.toActorId),
        voluntary: normalizeDimensions(source.voluntary, SOCIAL_VOLUNTARY_DIMENSIONS),
        coercive: isPlainObject(source.coercive) ? {
            ...normalizeDimensions(source.coercive, SOCIAL_COERCIVE_DIMENSIONS),
            sourceIds: normalizeStringList(coerciveSource.sourceIds),
        } : source.coercive,
        labels: normalizeStringList(source.labels),
        evidence: normalizeEvidenceList(source.evidence),
        branchId: trimString(source.branchId),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateSocialState(input) {
    const value = normalizeSocialState(input);
    const issues = [];
    validateV2Base(value, issues, SOCIAL_KEYS);
    requireString(value.fromActorId, issues, '$.fromActorId', {
        code: 'social.from_actor_id',
    });
    requireString(value.toActorId, issues, '$.toActorId', {
        code: 'social.to_actor_id',
    });
    validateDimensions(
        value.voluntary,
        SOCIAL_VOLUNTARY_DIMENSIONS,
        issues,
        '$.voluntary',
    );
    if (requirePlainObject(value.coercive, issues, '$.coercive')) {
        const numeric = Object.fromEntries(
            Object.entries(value.coercive).filter(([key]) => key !== 'sourceIds'),
        );
        validateDimensions(numeric, SOCIAL_COERCIVE_DIMENSIONS, issues, '$.coercive');
        validateStringList(value.coercive.sourceIds, issues, '$.coercive.sourceIds', {
            unique: true,
        });
    }
    validateStringList(value.labels, issues, '$.labels', { unique: true });
    validateEvidenceList(value.evidence, issues, '$.evidence');
    requireString(value.branchId, issues, '$.branchId', {
        code: 'social.branch_id',
    });
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}

function evidenceAllows(flag, dimension) {
    return flag === true || (Array.isArray(flag) && flag.includes(dimension));
}

function sameValue(left, right) {
    return Object.is(left, right);
}

function restoreDimension(target, before, group, dimension) {
    if (isPlainObject(before[group]) && Object.hasOwn(before[group], dimension)) {
        target[group][dimension] = deepClone(before[group][dimension]);
    } else {
        delete target[group][dimension];
    }
}

export function adjudicateSocialTransition(beforeInput, candidateInput, {
    voluntaryEvidence = false,
    coerciveEvidence = false,
} = {}) {
    const beforeValidation = validateSocialState(beforeInput);
    const candidateValidation = validateSocialState(candidateInput);
    const issues = [...beforeValidation.issues, ...candidateValidation.issues];
    if (
        beforeValidation.status === 'rejected'
        || candidateValidation.status === 'rejected'
    ) {
        return {
            decision: 'reject',
            ...validationResult(candidateValidation.value, issues),
            revertedPaths: [],
        };
    }

    const before = beforeValidation.value;
    const candidate = deepClone(candidateValidation.value);
    const revertedPaths = [];

    for (const dimension of SOCIAL_VOLUNTARY_DIMENSIONS) {
        const beforeValue = before.voluntary?.[dimension];
        const afterValue = candidate.voluntary?.[dimension];
        if (
            !sameValue(beforeValue, afterValue)
            && !evidenceAllows(voluntaryEvidence, dimension)
        ) {
            restoreDimension(candidate, before, 'voluntary', dimension);
            const path = `$.voluntary.${dimension}`;
            revertedPaths.push(path);
            addIssue(
                issues,
                'social.voluntary_without_evidence',
                path,
                '强制证据不能证明自愿关系变化；该路径恢复为本轮前值。',
                'warning',
            );
        }
    }

    for (const dimension of SOCIAL_COERCIVE_DIMENSIONS) {
        const beforeValue = before.coercive?.[dimension];
        const afterValue = candidate.coercive?.[dimension];
        if (
            !sameValue(beforeValue, afterValue)
            && !evidenceAllows(coerciveEvidence, dimension)
        ) {
            restoreDimension(candidate, before, 'coercive', dimension);
            const path = `$.coercive.${dimension}`;
            revertedPaths.push(path);
            addIssue(
                issues,
                'social.coercive_without_evidence',
                path,
                '强制关系轴缺少可追溯证据；该路径恢复为本轮前值。',
                'warning',
            );
        }
    }

    const finalValidation = validateSocialState(candidate);
    const allIssues = [...issues, ...finalValidation.issues];
    return {
        decision: revertedPaths.length ? 'revert' : 'allow',
        ...validationResult(finalValidation.value, allIssues),
        revertedPaths,
    };
}

export function normalizeQuestObjective(value) {
    if (!isPlainObject(value)) return value;
    return {
        ...deepClone(value),
        id: trimString(value.id),
        description: trimString(value.description),
        status: trimString(value.status),
        evidence: normalizeEvidenceList(value.evidence),
    };
}

export function validateQuestObjective(value, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    requireString(value.id, issues, `${path}.id`, { code: 'quest.objective.id' });
    requireString(value.description, issues, `${path}.description`, {
        code: 'quest.objective.description',
    });
    requireEnum(
        value.status,
        QUEST_OBJECTIVE_STATUSES,
        issues,
        `${path}.status`,
        'quest.objective.status',
    );
    validateEvidenceList(value.evidence, issues, `${path}.evidence`);
}

export function normalizeQuest(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, QUEST_KEYS),
        title: trimString(source.title),
        status: trimString(source.status),
        branchId: trimString(source.branchId),
        objectives: Array.isArray(source.objectives)
            ? source.objectives.map(normalizeQuestObjective)
            : [],
        settlementTransactionIds: normalizeStringList(source.settlementTransactionIds),
        ...(Object.hasOwn(source, 'supersededBy')
            ? { supersededBy: trimString(source.supersededBy) }
            : {}),
        ...(Object.hasOwn(source, 'terminalEvidence')
            ? { terminalEvidence: normalizeEvidenceList(source.terminalEvidence) }
            : {}),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateQuest(input) {
    const value = normalizeQuest(input);
    const issues = [];
    validateV2Base(value, issues, QUEST_KEYS);
    requireString(value.title, issues, '$.title', { code: 'quest.title' });
    requireEnum(value.status, QUEST_STATUSES, issues, '$.status', 'quest.status');
    requireString(value.branchId, issues, '$.branchId', { code: 'quest.branch_id' });
    if (!Array.isArray(value.objectives)) {
        addIssue(issues, 'quest.objectives.type', '$.objectives', 'objectives 必须是数组。');
    } else {
        value.objectives.forEach((objective, index) => {
            validateQuestObjective(objective, issues, `$.objectives[${index}]`);
        });
        const ids = value.objectives.map((objective) => objective?.id);
        if (new Set(ids).size !== ids.length) {
            addIssue(
                issues,
                'quest.objective.duplicate_id',
                '$.objectives',
                '任务目标 ID 必须唯一。',
            );
        }
    }
    validateStringList(
        value.settlementTransactionIds,
        issues,
        '$.settlementTransactionIds',
        { unique: true },
    );
    if (value.supersededBy !== undefined) {
        requireString(value.supersededBy, issues, '$.supersededBy', {
            code: 'quest.superseded_by',
        });
    }
    if (TERMINAL_QUEST_STATUSES.includes(value.status)) {
        validateEvidenceList(
            value.terminalEvidence,
            issues,
            '$.terminalEvidence',
            { minItems: 1 },
        );
        if (value.status === 'superseded' && !value.supersededBy) {
            addIssue(
                issues,
                'quest.superseded_target_missing',
                '$.supersededBy',
                'superseded 任务必须指向替代任务。',
                'unresolved',
            );
        }
    } else if (value.terminalEvidence !== undefined) {
        validateEvidenceList(value.terminalEvidence, issues, '$.terminalEvidence');
    }
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}

export function validateQuestTransition(beforeInput, candidateInput) {
    const before = validateQuest(beforeInput);
    const candidate = validateQuest(candidateInput);
    const issues = [...before.issues, ...candidate.issues];
    let value = candidate.value;
    if (
        TERMINAL_QUEST_STATUSES.includes(before.value.status)
        && candidate.value.status !== before.value.status
    ) {
        addIssue(
            issues,
            'quest.terminal_reopen',
            '$.status',
            '终态任务不得复开；余波必须建立新的 Quest 或 Fact。',
        );
        value = before.value;
    }
    return validationResult(value, issues);
}

export const CLAIM_ADJUDICATION_LEVELS = Object.freeze([
    'H0',
    'H1',
    'H2',
    'H3',
]);

export const CLAIM_ADJUDICATION_DECISIONS = Object.freeze([
    'accept',
    'accept_with_cost',
    'roll_required',
    'reject',
    'branch_required',
    'pending',
]);

export const CLAIM_COMMAND_TYPES = Object.freeze([
    'fact-candidate',
    'fact-confirm',
    'check',
    'cost',
    'new-branch',
]);

export function normalizeClaimAdjudication(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        level: trimString(source.level),
        decision: trimString(source.decision),
        claimIds: normalizeStringList(source.claimIds),
        reason: trimString(source.reason),
        evidence: normalizeEvidenceList(source.evidence),
        commands: Array.isArray(source.commands)
            ? source.commands.map((command) => (
                isPlainObject(command)
                    ? {
                        type: trimString(command.type),
                        payload: deepClone(command.payload),
                    }
                    : command
            ))
            : [],
    };
}

export function validateClaimAdjudication(input) {
    const value = normalizeClaimAdjudication(input);
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(value, issues);
    requireEnum(
        value.level,
        CLAIM_ADJUDICATION_LEVELS,
        issues,
        '$.level',
        'adjudication.level',
    );
    requireEnum(
        value.decision,
        CLAIM_ADJUDICATION_DECISIONS,
        issues,
        '$.decision',
        'adjudication.decision',
    );
    validateStringList(value.claimIds, issues, '$.claimIds', { unique: true });
    requireString(value.reason, issues, '$.reason', {
        code: 'adjudication.reason',
    });
    validateEvidenceList(value.evidence, issues, '$.evidence');
    if (!Array.isArray(value.commands)) {
        addIssue(issues, 'adjudication.commands.type', '$.commands', 'commands 必须是数组。');
    } else {
        value.commands.forEach((command, index) => {
            const path = `$.commands[${index}]`;
            if (!requirePlainObject(command, issues, path)) return;
            requireEnum(
                command.type,
                CLAIM_COMMAND_TYPES,
                issues,
                `${path}.type`,
                'adjudication.command.type',
            );
            requirePlainObject(command.payload, issues, `${path}.payload`);
        });
    }

    const decisionByLevel = {
        H0: ['accept'],
        H1: ['accept'],
        H2: ['accept_with_cost', 'roll_required', 'pending'],
        H3: ['reject', 'branch_required'],
    };
    if (
        CLAIM_ADJUDICATION_LEVELS.includes(value.level)
        && !decisionByLevel[value.level].includes(value.decision)
    ) {
        addIssue(
            issues,
            'adjudication.level_decision_mismatch',
            '$.decision',
            '裁定决定与口胡等级不匹配；阶段1只校验结构，不推断等级。',
        );
    }
    if (
        value.level === 'H2'
        && !value.commands.some((command) => ['check', 'cost'].includes(command?.type))
    ) {
        addIssue(
            issues,
            'adjudication.h2_command_missing',
            '$.commands',
            'H2 必须提供检定或代价命令，不能只返回建议文字。',
            'unresolved',
        );
    }
    if (
        value.level === 'H3'
        && value.decision === 'branch_required'
        && !value.commands.some((command) => command?.type === 'new-branch')
    ) {
        addIssue(
            issues,
            'adjudication.h3_branch_command_missing',
            '$.commands',
            '显式 H3 重写必须提供新分支命令。',
            'unresolved',
        );
    }
    return validationResult(value, issues);
}
