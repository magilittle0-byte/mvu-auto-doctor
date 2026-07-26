import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeMigrationState,
    normalizeV2Base,
    preserveLegacyExtensions,
    requirePlainObject,
    requireString,
    validateMigrationState,
    validateV2Base,
    validationResult,
} from '../domain/common.mjs';
import { hashCanonical } from './canonical.mjs';
import {
    normalizeMessageFingerprint,
    validateMessageFingerprint,
} from './fingerprint.mjs';

const CHECKPOINT_KEYS = Object.freeze([
    'branchId',
    'fingerprint',
    'checkpointRef',
    'stateHash',
    'payload',
    'migration',
]);

export function normalizeBranchCheckpoint(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, CHECKPOINT_KEYS),
        branchId: typeof source.branchId === 'string' ? source.branchId.trim() : source.branchId,
        fingerprint: normalizeMessageFingerprint(source.fingerprint),
        checkpointRef: typeof source.checkpointRef === 'string'
            ? source.checkpointRef.trim()
            : source.checkpointRef,
        stateHash: typeof source.stateHash === 'string'
            ? source.stateHash.trim()
            : source.stateHash,
        payload: deepClone(source.payload),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateBranchCheckpoint(input) {
    const value = normalizeBranchCheckpoint(input);
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(value, issues);
    validateV2Base(value, issues, CHECKPOINT_KEYS);
    requireString(value.branchId, issues, '$.branchId', {
        code: 'checkpoint.branch_id',
    });
    const fingerprint = validateMessageFingerprint(value.fingerprint, '$.fingerprint');
    issues.push(...fingerprint.issues);
    if (fingerprint.ok && fingerprint.value.branchId !== value.branchId) {
        addIssue(
            issues,
            'checkpoint.fingerprint_branch_mismatch',
            '$.fingerprint.branchId',
            'checkpoint 指纹必须绑定同一个 branchId。',
        );
    }
    requireString(value.checkpointRef, issues, '$.checkpointRef', {
        code: 'checkpoint.ref',
    });
    requireString(value.stateHash, issues, '$.stateHash', {
        code: 'checkpoint.state_hash',
    });
    if (!Object.hasOwn(value, 'payload')) {
        addIssue(issues, 'checkpoint.payload_missing', '$.payload', 'checkpoint 必须保留迁移载荷。');
    }
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}

export function migrateLegacyBranchCheckpoint(legacyInput, options = {}) {
    const issues = [];
    if (!isPlainObject(legacyInput)) {
        addIssue(issues, 'checkpoint.legacy_type', '$', '旧 checkpoint 必须是普通对象。');
        return validationResult(normalizeBranchCheckpoint({}), issues);
    }
    const logicalIndex = options.logicalIndex ?? legacyInput.logicalIndex
        ?? legacyInput.targetIndex;
    const messageId = options.messageId ?? legacyInput.messageId;
    const swipeId = options.swipeId ?? legacyInput.swipeId;
    const contentHash = options.contentHash ?? legacyInput.contentHash;
    const generation = options.generation ?? legacyInput.generation;
    const parentHash = options.parentHash ?? legacyInput.parentHash;
    const chatId = options.chatId ?? legacyInput.chatId;
    const branchId = options.branchId ?? legacyInput.branchId;
    const payload = Object.hasOwn(options, 'payload')
        ? options.payload
        : legacyInput.state;
    for (const [field, value] of Object.entries({
        chatId,
        logicalIndex,
        messageId,
        swipeId,
        generation,
        branchId,
        parentHash,
        contentHash,
    })) {
        if (value === undefined || value === null || value === '') {
            addIssue(
                issues,
                'checkpoint.migration_identity_unresolved',
                `$.${field}`,
                `旧 checkpoint 缺少 ${field}，必须由宿主桥显式提供，不能猜测。`,
                'unresolved',
            );
        }
    }
    if (!Object.hasOwn(legacyInput, 'state') && !Object.hasOwn(options, 'payload')) {
        addIssue(
            issues,
            'checkpoint.migration_payload_unresolved',
            '$.payload',
            '旧 checkpoint 没有可迁移状态载荷。',
            'unresolved',
        );
    }
    const fingerprint = normalizeMessageFingerprint({
        chatId,
        logicalIndex,
        messageId,
        swipeId,
        generation,
        branchId,
        parentHash,
        contentHash,
        ...(Object.hasOwn(options, 'stateHash')
            ? { stateHash: options.stateHash }
            : {}),
    });
    const checkpointIdentity = Object.fromEntries(
        Object.entries({
            branchId,
            logicalIndex,
            messageId,
            swipeId,
            contentHash,
        }).filter(([, entry]) => entry !== undefined),
    );
    const checkpointRef = options.checkpointRef
        ?? `checkpoint_${hashCanonical(checkpointIdentity)
            .slice('sha256:'.length, 'sha256:'.length + 24)}`;
    const unknown = Object.fromEntries(
        Object.entries(legacyInput).filter(([key]) => (
            !['targetIndex', 'logicalIndex', 'messageId', 'swipeId', 'state'].includes(key)
        )),
    );
    const value = normalizeBranchCheckpoint({
        ...normalizeV2Base({
            id: options.id ?? checkpointRef,
            schemaVersion: '2.0',
            revision: 0,
            extensions: preserveLegacyExtensions(options.extensions, unknown),
        }, CHECKPOINT_KEYS),
        branchId,
        fingerprint,
        checkpointRef,
        stateHash: options.stateHash ?? (
            payload === undefined ? undefined : hashCanonical(payload)
        ),
        payload,
        migration: {
            sourceVersion: '1.x',
            status: issues.some((issue) => issue.severity === 'unresolved')
                ? 'unresolved'
                : 'mapped',
            sourceRefs: options.sourceRefs ?? ['chatMetadata.continuityCheckpoint'],
            warnings: issues.map((issue) => `${issue.code}: ${issue.message}`),
        },
    });
    const validated = validateBranchCheckpoint(value);
    const allIssues = [...issues, ...validated.issues];
    value.migration = normalizeMigrationState(value.migration, {
        status: allIssues.some((issue) => issue.severity === 'error')
            ? 'quarantined'
            : allIssues.some((issue) => issue.severity === 'unresolved')
                ? 'unresolved'
                : 'mapped',
    });
    value.migration.status = allIssues.some((issue) => issue.severity === 'error')
        ? 'quarantined'
        : allIssues.some((issue) => issue.severity === 'unresolved')
            ? 'unresolved'
            : 'mapped';
    value.migration.warnings = allIssues.map((issue) => `${issue.code}: ${issue.message}`);
    return validationResult(value, allIssues, { migration: value.migration });
}
