import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeV2Base,
    requireEnum,
    requirePlainObject,
    requireString,
    validateV2Base,
    validationResult,
} from '../domain/common.mjs';
import { hashCanonical } from './canonical.mjs';
import {
    normalizeMessageFingerprint,
    validateMessageFingerprint,
} from './fingerprint.mjs';

export const BRANCH_STATUSES = Object.freeze([
    'active',
    'abandoned',
    'archived',
    'merged',
]);

export const BRANCH_TRANSITION_KINDS = Object.freeze([
    'normal',
    'continue',
    'regenerate',
    'swipe',
    'explicit-fork',
]);

const BRANCH_KEYS = Object.freeze([
    'parentBranchId',
    'divergenceFingerprint',
    'headFingerprint',
    'status',
    'checkpointRef',
    'transactionIds',
    'factIds',
    'questIds',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeStringList(value) {
    return Array.isArray(value) ? value.map(trimString) : [];
}

function validateStringList(value, issues, path) {
    if (!Array.isArray(value)) {
        addIssue(issues, 'branch.string_list', path, '分支引用字段必须是字符串数组。');
        return;
    }
    value.forEach((entry, index) => {
        requireString(entry, issues, `${path}[${index}]`);
    });
    if (new Set(value).size !== value.length) {
        addIssue(issues, 'branch.duplicate_reference', path, '分支引用字段不能包含重复项。');
    }
}

export function normalizeBranch(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, BRANCH_KEYS),
        ...(Object.hasOwn(source, 'parentBranchId')
            ? { parentBranchId: trimString(source.parentBranchId) }
            : {}),
        divergenceFingerprint: normalizeMessageFingerprint(source.divergenceFingerprint),
        headFingerprint: normalizeMessageFingerprint(source.headFingerprint),
        status: trimString(source.status),
        checkpointRef: trimString(source.checkpointRef),
        transactionIds: normalizeStringList(source.transactionIds),
        factIds: normalizeStringList(source.factIds),
        questIds: normalizeStringList(source.questIds),
    };
}

export function validateBranch(input) {
    const value = normalizeBranch(input);
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(value, issues);
    validateV2Base(value, issues, BRANCH_KEYS);
    if (value.parentBranchId !== undefined) {
        requireString(value.parentBranchId, issues, '$.parentBranchId', {
            code: 'branch.parent_id',
        });
        if (value.parentBranchId === value.id) {
            addIssue(issues, 'branch.self_parent', '$.parentBranchId', '分支不能以自身为父分支。');
        }
    }
    const divergence = validateMessageFingerprint(
        value.divergenceFingerprint,
        '$.divergenceFingerprint',
    );
    const head = validateMessageFingerprint(value.headFingerprint, '$.headFingerprint');
    issues.push(...divergence.issues, ...head.issues);
    requireEnum(value.status, BRANCH_STATUSES, issues, '$.status', 'branch.status');
    requireString(value.checkpointRef, issues, '$.checkpointRef', {
        code: 'branch.checkpoint_ref',
    });
    validateStringList(value.transactionIds, issues, '$.transactionIds');
    validateStringList(value.factIds, issues, '$.factIds');
    validateStringList(value.questIds, issues, '$.questIds');
    if (
        divergence.ok
        && divergence.value.branchId !== value.id
    ) {
        addIssue(
            issues,
            'branch.divergence_id_mismatch',
            '$.divergenceFingerprint.branchId',
            '分歧指纹必须绑定本分支 ID。',
        );
    }
    if (head.ok && head.value.branchId !== value.id) {
        addIssue(
            issues,
            'branch.head_id_mismatch',
            '$.headFingerprint.branchId',
            '分支头指纹必须绑定本分支 ID。',
        );
    }
    if (
        divergence.ok
        && head.ok
        && divergence.value.chatId !== head.value.chatId
    ) {
        addIssue(
            issues,
            'branch.chat_mismatch',
            '$.headFingerprint.chatId',
            '同一分支的分歧点和分支头必须属于同一聊天。',
        );
    }
    return validationResult(value, issues);
}

export function createBranch(input) {
    return validateBranch({
        ...input,
        schemaVersion: '2.0',
        revision: input?.revision ?? 0,
        status: input?.status ?? 'active',
        transactionIds: input?.transactionIds ?? [],
        factIds: input?.factIds ?? [],
        questIds: input?.questIds ?? [],
    });
}

export function createBranchId({
    parentBranchId = '',
    divergenceFingerprint,
    kind = 'explicit-fork',
}) {
    return `branch_${hashCanonical({
        parentBranchId,
        divergenceFingerprint: normalizeMessageFingerprint(divergenceFingerprint),
        kind,
    }).slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

function transitionFailure(current, issues, status = 'rejected') {
    return {
        ok: false,
        status,
        activeBranch: current?.value ?? current ?? null,
        abandonedBranch: null,
        issues,
    };
}

function expectSame(value, expected, issues, path, code, message) {
    if (value !== expected) addIssue(issues, code, path, message);
}

export function transitionBranch(currentInput, nextFingerprintInput, {
    kind,
    checkpointRef,
} = {}) {
    const current = validateBranch(currentInput);
    const next = validateMessageFingerprint(nextFingerprintInput, '$.nextFingerprint');
    const issues = [...current.issues, ...next.issues];
    if (!BRANCH_TRANSITION_KINDS.includes(kind)) {
        addIssue(
            issues,
            'branch.transition_kind',
            '$.kind',
            `分支转换类型必须是：${BRANCH_TRANSITION_KINDS.join('、')}。`,
        );
    }
    if (!current.ok || !next.ok || issues.some((issue) => issue.severity === 'error')) {
        return transitionFailure(current, issues);
    }
    if (current.value.status !== 'active') {
        addIssue(
            issues,
            'branch.source_inactive',
            '$.current.status',
            '只有 active 分支可以继续生成或产生新分支。',
        );
        return transitionFailure(current, issues);
    }

    const oldHead = current.value.headFingerprint;
    const nextHead = next.value;
    if (['normal', 'continue'].includes(kind)) {
        expectSame(
            nextHead.branchId,
            current.value.id,
            issues,
            '$.nextFingerprint.branchId',
            'branch.same_transition_id',
            'normal/continue 必须保持当前 branchId。',
        );
        expectSame(
            nextHead.parentHash,
            kind === 'continue' ? oldHead.parentHash : oldHead.contentHash,
            issues,
            '$.nextFingerprint.parentHash',
            'branch.parent_hash_mismatch',
            kind === 'continue'
                ? 'continue 必须保留该逻辑楼层的共同父内容。'
                : 'normal 生成必须引用上一个稳定分支头的 contentHash。',
        );
        if (nextHead.generation <= oldHead.generation) {
            addIssue(
                issues,
                'branch.generation_not_advanced',
                '$.nextFingerprint.generation',
                '同分支推进必须增加 generation。',
            );
        }
        if (kind === 'continue') {
            for (const field of ['chatId', 'logicalIndex', 'messageId', 'swipeId']) {
                expectSame(
                    nextHead[field],
                    oldHead[field],
                    issues,
                    `$.nextFingerprint.${field}`,
                    'branch.continue_identity_changed',
                    'continue 只能改变同一逻辑楼层的正文与 generation。',
                );
            }
        } else if (nextHead.logicalIndex <= oldHead.logicalIndex) {
            addIssue(
                issues,
                'branch.normal_floor_not_advanced',
                '$.nextFingerprint.logicalIndex',
                'normal 生成必须推进到新的逻辑 AI 楼层。',
            );
        }
        if (issues.some((issue) => issue.severity === 'error')) {
            return transitionFailure(current, issues);
        }
        const activeBranch = normalizeBranch({
            ...current.value,
            revision: current.value.revision + 1,
            headFingerprint: nextHead,
        });
        return {
            ok: true,
            status: 'advanced',
            activeBranch,
            abandonedBranch: null,
            issues,
        };
    }

    requireString(checkpointRef, issues, '$.checkpointRef', {
        code: 'branch.transition_checkpoint',
    });
    if (nextHead.branchId === current.value.id) {
        addIssue(
            issues,
            'branch.fork_id_reused',
            '$.nextFingerprint.branchId',
            'regenerate/swipe/显式分叉必须创建新的 branchId。',
        );
    }
    if (nextHead.chatId !== oldHead.chatId) {
        addIssue(
            issues,
            'branch.fork_chat_changed',
            '$.nextFingerprint.chatId',
            '分叉不能跨聊天复用分支证据。',
        );
    }
    if (['regenerate', 'swipe'].includes(kind)) {
        expectSame(
            nextHead.logicalIndex,
            oldHead.logicalIndex,
            issues,
            '$.nextFingerprint.logicalIndex',
            'branch.reroll_floor_changed',
            'regenerate/swipe 必须在同一逻辑分歧楼层建立新分支。',
        );
        expectSame(
            nextHead.parentHash,
            oldHead.parentHash,
            issues,
            '$.nextFingerprint.parentHash',
            'branch.reroll_parent_changed',
            'regenerate/swipe 必须引用旧回复之前的共同父内容。',
        );
    } else {
        expectSame(
            nextHead.parentHash,
            oldHead.contentHash,
            issues,
            '$.nextFingerprint.parentHash',
            'branch.explicit_fork_parent_changed',
            '显式分叉必须从当前稳定分支头派生。',
        );
    }
    if (issues.some((issue) => issue.severity === 'error')) {
        return transitionFailure(current, issues);
    }
    const abandonedBranch = normalizeBranch({
        ...current.value,
        revision: current.value.revision + 1,
        status: 'abandoned',
    });
    const activeBranch = normalizeBranch({
        id: nextHead.branchId,
        schemaVersion: '2.0',
        revision: 0,
        parentBranchId: current.value.id,
        divergenceFingerprint: nextHead,
        headFingerprint: nextHead,
        status: 'active',
        checkpointRef,
        transactionIds: [],
        factIds: [],
        questIds: [],
        extensions: {
            forkKind: kind,
        },
    });
    return {
        ok: true,
        status: 'forked',
        activeBranch,
        abandonedBranch,
        issues,
    };
}

export function appendBranchTransaction(branchInput, transactionId) {
    const branch = validateBranch(branchInput);
    const issues = [...branch.issues];
    requireString(transactionId, issues, '$.transactionId', {
        code: 'branch.transaction_id',
    });
    if (!branch.ok || issues.some((issue) => issue.severity === 'error')) {
        return validationResult(branch.value, issues);
    }
    const transactionIds = [...new Set([
        ...branch.value.transactionIds,
        transactionId,
    ])];
    return validateBranch({
        ...deepClone(branch.value),
        revision: branch.value.revision + (
            transactionIds.length === branch.value.transactionIds.length ? 0 : 1
        ),
        transactionIds,
    });
}
