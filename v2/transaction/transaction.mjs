import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEffects,
    normalizeEvidenceList,
    requireEnum,
    requireFiniteNumber,
    requirePlainObject,
    requireString,
    validateEffects,
    validateEvidenceList,
    validationResult,
} from '../domain/common.mjs';
import { hashCanonical } from './canonical.mjs';
import {
    compareMessageFingerprints,
    normalizeMessageFingerprint,
    validateMessageFingerprint,
} from './fingerprint.mjs';
import {
    applyPathMutations,
    capturePathValues,
    evaluatePathPreconditions,
    validatePathMutations,
} from './paths.mjs';

export const TRANSACTION_KINDS = Object.freeze([
    'narrative-repair',
    'resource',
    'inventory',
    'equipment',
    'skill',
    'social',
    'quest',
    'compound',
]);

export const TRANSACTION_STATUSES = Object.freeze([
    'proposed',
    'prepared',
    'committed',
    'aborted',
    'rolled_back',
    'stale',
]);

export const TRANSACTION_TRANSITIONS = Object.freeze({
    proposed: Object.freeze(['prepared', 'aborted', 'stale']),
    prepared: Object.freeze(['committed', 'aborted', 'rolled_back', 'stale']),
    committed: Object.freeze(['rolled_back']),
    aborted: Object.freeze([]),
    rolled_back: Object.freeze([]),
    stale: Object.freeze([]),
});

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeStringList(value) {
    return Array.isArray(value) ? value.map(trimString) : [];
}

export function normalizeTransaction(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        id: trimString(source.id),
        protocolVersion: source.protocolVersion ?? '2.0',
        branchId: trimString(source.branchId),
        target: normalizeMessageFingerprint(source.target),
        idempotencyKey: trimString(source.idempotencyKey),
        kind: trimString(source.kind),
        status: trimString(source.status ?? 'proposed'),
        preconditions: Array.isArray(source.preconditions)
            ? source.preconditions.map((entry) => deepClone(entry))
            : [],
        effects: normalizeEffects(source.effects),
        touchedRefs: normalizeStringList(source.touchedRefs),
        ...(Object.hasOwn(source, 'beforeHash')
            ? { beforeHash: trimString(source.beforeHash) }
            : {}),
        ...(Object.hasOwn(source, 'afterHash')
            ? { afterHash: trimString(source.afterHash) }
            : {}),
        createdAt: source.createdAt,
        ...(Object.hasOwn(source, 'committedAt')
            ? { committedAt: source.committedAt }
            : {}),
        audit: normalizeEvidenceList(source.audit),
        ...(Object.hasOwn(source, 'terminalReason')
            ? { terminalReason: trimString(source.terminalReason) }
            : {}),
        ...(Object.hasOwn(source, 'rollback')
            ? { rollback: deepClone(source.rollback) }
            : {}),
    };
}

function validateStringList(value, issues, path) {
    if (!Array.isArray(value)) {
        addIssue(issues, 'transaction.string_list', path, '字段必须是字符串数组。');
        return;
    }
    value.forEach((entry, index) => {
        requireString(entry, issues, `${path}[${index}]`);
        if (entry && !entry.startsWith('/')) {
            addIssue(
                issues,
                'transaction.touched_ref_pointer',
                `${path}[${index}]`,
                'touchedRefs 必须使用 JSON Pointer。',
            );
        }
    });
    if (new Set(value).size !== value.length) {
        addIssue(issues, 'transaction.touched_ref_duplicate', path, 'touchedRefs 不能重复。');
    }
}

export function validateTransaction(input) {
    const value = normalizeTransaction(input);
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(value, issues);
    requireString(value.id, issues, '$.id', { code: 'transaction.id' });
    if (value.protocolVersion !== '2.0') {
        addIssue(
            issues,
            'transaction.protocol_version',
            '$.protocolVersion',
            'Transaction protocolVersion 必须是 2.0。',
        );
    }
    requireString(value.branchId, issues, '$.branchId', {
        code: 'transaction.branch_id',
    });
    const target = validateMessageFingerprint(value.target, '$.target');
    issues.push(...target.issues);
    if (target.ok && target.value.branchId !== value.branchId) {
        addIssue(
            issues,
            'transaction.target_branch_mismatch',
            '$.target.branchId',
            '事务目标指纹必须绑定同一 branchId。',
        );
    }
    requireString(value.idempotencyKey, issues, '$.idempotencyKey', {
        code: 'transaction.idempotency_key',
    });
    requireEnum(value.kind, TRANSACTION_KINDS, issues, '$.kind', 'transaction.kind');
    requireEnum(
        value.status,
        TRANSACTION_STATUSES,
        issues,
        '$.status',
        'transaction.status',
    );
    if (!Array.isArray(value.preconditions)) {
        addIssue(
            issues,
            'transaction.preconditions_type',
            '$.preconditions',
            'preconditions 必须是普通对象数组。',
        );
    } else {
        value.preconditions.forEach((entry, index) => {
            requirePlainObject(entry, issues, `$.preconditions[${index}]`);
        });
    }
    validateEffects(value.effects, issues, '$.effects');
    validateStringList(value.touchedRefs, issues, '$.touchedRefs');
    requireFiniteNumber(value.createdAt, issues, '$.createdAt', {
        minimum: 0,
        integer: true,
        code: 'transaction.created_at',
    });
    validateEvidenceList(value.audit, issues, '$.audit');
    if (['prepared', 'committed', 'rolled_back'].includes(value.status)) {
        requireString(value.beforeHash, issues, '$.beforeHash', {
            code: 'transaction.before_hash',
        });
        requireString(value.afterHash, issues, '$.afterHash', {
            code: 'transaction.after_hash',
        });
    }
    if (value.status === 'committed') {
        requireFiniteNumber(value.committedAt, issues, '$.committedAt', {
            minimum: value.createdAt,
            integer: true,
            code: 'transaction.committed_at',
        });
    }
    if (['aborted', 'rolled_back', 'stale'].includes(value.status)) {
        requireString(value.terminalReason, issues, '$.terminalReason', {
            code: 'transaction.terminal_reason',
        });
    }
    return validationResult(value, issues);
}

export function createTransactionId(input) {
    return `tx_${hashCanonical({
        branchId: input?.branchId,
        target: normalizeMessageFingerprint(input?.target),
        idempotencyKey: input?.idempotencyKey,
        kind: input?.kind,
    }).slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

export function createIdempotencyKey({
    operation,
    target,
    subject = '',
    effect = '',
}) {
    const normalizedTarget = normalizeMessageFingerprint(target);
    return `idem_${hashCanonical({
        operation,
        target: {
            chatId: normalizedTarget.chatId,
            logicalIndex: normalizedTarget.logicalIndex,
            parentHash: normalizedTarget.parentHash,
        },
        subject,
        effect,
    }).slice('sha256:'.length, 'sha256:'.length + 32)}`;
}

export function idempotencyScopeKey(branchId, idempotencyKey) {
    return `${String(branchId)}\u0000${String(idempotencyKey)}`;
}

export function createTransaction(input) {
    const value = {
        ...input,
        id: input?.id ?? createTransactionId(input),
        protocolVersion: '2.0',
        status: input?.status ?? 'proposed',
        preconditions: input?.preconditions ?? [],
        effects: input?.effects ?? [],
        touchedRefs: input?.touchedRefs ?? [],
        createdAt: input?.createdAt ?? Date.now(),
        audit: input?.audit ?? [],
    };
    return validateTransaction(value);
}

export function transitionTransaction(input, nextStatus, patch = {}) {
    const current = validateTransaction(input);
    const issues = [...current.issues];
    if (!current.ok) return validationResult(current.value, issues);
    const allowed = TRANSACTION_TRANSITIONS[current.value.status] ?? [];
    if (!allowed.includes(nextStatus)) {
        addIssue(
            issues,
            'transaction.invalid_transition',
            '$.status',
            `事务不能从 ${current.value.status} 转换为 ${nextStatus}。`,
        );
        return validationResult(current.value, issues);
    }
    return validateTransaction({
        ...current.value,
        ...deepClone(patch),
        status: nextStatus,
    });
}

export function abortTransaction(input, reason) {
    return transitionTransaction(input, 'aborted', {
        terminalReason: String(reason || '事务已中止。'),
    });
}

export function markTransactionStale(input, reason) {
    return transitionTransaction(input, 'stale', {
        terminalReason: String(reason || '事务目标已经过期。'),
    });
}

export function markTransactionCommitted(input, committedAt = Date.now()) {
    return transitionTransaction(input, 'committed', { committedAt });
}

export function markTransactionRolledBack(input, reason, rollback = {}) {
    return transitionTransaction(input, 'rolled_back', {
        terminalReason: String(reason || '事务已按路径回滚。'),
        rollback: deepClone(rollback),
    });
}

function transitionOutcome(transaction, issues, prepared = null) {
    return {
        ok: transaction.status === 'prepared',
        status: transaction.status,
        transaction,
        issues,
        ...(prepared ? { prepared } : {}),
    };
}

export function prepareTransaction(input, {
    activeBranch,
    currentFingerprint,
    beforeState,
    writePlan,
    domainResults = [],
} = {}) {
    const validated = validateTransaction(input);
    const issues = [...validated.issues];
    let transaction = validated.value;
    if (!validated.ok || transaction.status !== 'proposed') {
        if (transaction.status !== 'proposed') {
            addIssue(
                issues,
                'transaction.prepare_status',
                '$.status',
                '只有 proposed 事务可以 prepare。',
            );
        }
        transaction = {
            ...transaction,
            status: 'aborted',
            terminalReason: '事务结构未通过 prepare 前验证。',
        };
        return transitionOutcome(transaction, issues);
    }
    for (const [index, result] of domainResults.entries()) {
        if (!isPlainObject(result) || result.status !== 'valid' || result.ok !== true) {
            addIssue(
                issues,
                result?.status === 'unresolved'
                    ? 'transaction.domain_unresolved'
                    : 'transaction.domain_rejected',
                `$.domainResults[${index}]`,
                '事务 prepare 只接受阶段1返回的 valid 领域结果。',
                result?.status === 'unresolved' ? 'unresolved' : 'error',
            );
        }
    }
    if (!isPlainObject(activeBranch)) {
        addIssue(issues, 'transaction.branch_missing', '$.activeBranch', '缺少当前分支证据。');
    } else if (
        activeBranch.id !== transaction.branchId
        || activeBranch.status !== 'active'
    ) {
        const stale = markTransactionStale(
            transaction,
            '事务分支不是当前 active 分支。',
        ).value;
        return transitionOutcome(stale, issues);
    }
    const fingerprint = compareMessageFingerprints(
        transaction.target,
        currentFingerprint,
    );
    if (!fingerprint.ok) {
        issues.push(...fingerprint.issues);
        const stale = markTransactionStale(
            transaction,
            '完整 MessageFingerprint 已变化。',
        ).value;
        return transitionOutcome(stale, issues);
    }
    const plan = validatePathMutations(writePlan);
    issues.push(...plan.issues);
    const preconditions = evaluatePathPreconditions(
        beforeState,
        transaction.preconditions,
    );
    issues.push(...preconditions.issues);
    const applied = plan.ok
        ? applyPathMutations(beforeState, writePlan)
        : { ok: false, issues: [], value: null };
    issues.push(...applied.issues);
    if (
        issues.some((issue) => ['error', 'unresolved'].includes(issue.severity))
        || !preconditions.ok
        || !applied.ok
    ) {
        const aborted = abortTransaction(
            transaction,
            '事务包含 rejected/unresolved 领域结果或无效写入计划。',
        ).value;
        return transitionOutcome(aborted, issues);
    }
    const beforeTouched = capturePathValues(beforeState, applied.touchedRefs);
    const afterTouched = capturePathValues(applied.value, applied.touchedRefs);
    const preparedResult = transitionTransaction(transaction, 'prepared', {
        touchedRefs: applied.touchedRefs,
        beforeHash: hashCanonical(beforeTouched),
        afterHash: hashCanonical(afterTouched),
    });
    issues.push(...preparedResult.issues);
    transaction = preparedResult.value;
    return transitionOutcome(transaction, issues, {
        writePlan: deepClone(writePlan),
        beforeTouched,
        afterTouched,
        preparedState: applied.value,
    });
}
