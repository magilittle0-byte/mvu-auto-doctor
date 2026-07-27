import {
    deepClone,
    isPlainObject,
} from '../domain/index.mjs';
import { diagnoseLegacyDomainProjection } from '../domain-transaction/index.mjs';
import { hashCanonical } from '../transaction/index.mjs';

export const DEFAULT_MIGRATION_LIMITS = Object.freeze({
    maxEntries: 256,
    // A user-authorized 57-message 1.x production record occupied 3.17 MiB
    // after JSON projection. Keep a bounded margin without turning migration
    // into an unbounded whole-history copy.
    maxChatBytes: 8 * 1024 * 1024,
});

function issue(code, path, message, details = undefined) {
    return {
        code,
        path,
        severity: 'error',
        message,
        ...(details ? { details } : {}),
    };
}

function byteLength(value) {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function prepareLegacyUpgradeDrill({
    chat,
    entries = [],
    limits = {},
} = {}) {
    const effectiveLimits = {
        ...DEFAULT_MIGRATION_LIMITS,
        ...limits,
    };
    const issues = [];
    if (!isPlainObject(chat)) {
        issues.push(issue(
            'migration.chat_shape',
            '$.chat',
            '1.x聊天快照必须是普通对象。',
        ));
    }
    if (!Array.isArray(entries)) {
        issues.push(issue(
            'migration.entries_shape',
            '$.entries',
            '1.x领域记录必须是数组。',
        ));
    }
    if (
        !Number.isInteger(effectiveLimits.maxEntries)
        || effectiveLimits.maxEntries < 1
        || !Number.isInteger(effectiveLimits.maxChatBytes)
        || effectiveLimits.maxChatBytes < 1
    ) {
        issues.push(issue(
            'migration.limit_shape',
            '$.limits',
            '迁移上限必须是正整数。',
        ));
    }
    if (issues.length) {
        return {
            ok: false,
            status: 'blocked',
            issues,
            legacyReadable: false,
            rollbackAvailable: false,
        };
    }

    const sourceChat = deepClone(chat);
    const sourceEntries = deepClone(entries);
    const serializedBytes = byteLength({
        chat: sourceChat,
        entries: sourceEntries,
    });
    if (serializedBytes > effectiveLimits.maxChatBytes) {
        return {
            ok: false,
            status: 'fallback',
            issues: [issue(
                'migration.capacity',
                '$',
                '1.x聊天超过显式迁移容量上限，保持1.x只读显示。',
                {
                    actualBytes: serializedBytes,
                    limitBytes: effectiveLimits.maxChatBytes,
                },
            )],
            legacyReadable: true,
            rollbackAvailable: true,
            legacySnapshot: sourceChat,
            legacyHash: hashCanonical(sourceChat),
        };
    }

    const projection = diagnoseLegacyDomainProjection({
        entries: sourceEntries,
        maxEntries: effectiveLimits.maxEntries,
    });
    const quarantined = projection.diagnostics?.some(
        (entry) => entry.status === 'quarantined',
    ) ?? false;
    const status = quarantined ? 'fallback' : 'ready';
    const legacyHash = hashCanonical(sourceChat);
    return {
        ok: !quarantined,
        status,
        issues: deepClone(projection.issues ?? []),
        legacyReadable: true,
        rollbackAvailable: true,
        legacySnapshot: sourceChat,
        legacyHash,
        sourceEntryCount: sourceEntries.length,
        serializedBytes,
        v2Sidecar: {
            schemaVersion: '2.0',
            authority: 'v2-sidecar',
            sourceVersion: '1.x',
            sourceHash: legacyHash,
            records: deepClone(projection.value ?? []),
            diagnostics: deepClone(projection.diagnostics ?? []),
        },
    };
}

export function rollbackLegacyUpgrade(drill) {
    if (
        !isPlainObject(drill)
        || !isPlainObject(drill.legacySnapshot)
        || typeof drill.legacyHash !== 'string'
    ) {
        return {
            ok: false,
            status: 'blocked',
            issues: [issue(
                'migration.rollback_receipt',
                '$',
                '回滚需要完整的1.x只读快照与摘要。',
            )],
        };
    }
    const restored = deepClone(drill.legacySnapshot);
    const restoredHash = hashCanonical(restored);
    if (restoredHash !== drill.legacyHash) {
        return {
            ok: false,
            status: 'blocked',
            issues: [issue(
                'migration.rollback_hash',
                '$.legacyHash',
                '1.x回滚快照摘要不匹配。',
            )],
        };
    }
    return {
        ok: true,
        status: 'rolled-back',
        issues: [],
        chat: restored,
        legacyHash: restoredHash,
        legacyReadable: true,
        v2AuthorityRemoved: true,
    };
}
