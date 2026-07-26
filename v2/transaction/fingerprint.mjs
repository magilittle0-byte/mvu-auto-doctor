import {
    addIssue,
    isPlainObject,
    requireFiniteNumber,
    requirePlainObject,
    requireString,
    validationResult,
} from '../domain/common.mjs';
import { hashCanonical, hashText } from './canonical.mjs';

export const MESSAGE_FINGERPRINT_FIELDS = Object.freeze([
    'chatId',
    'logicalIndex',
    'messageId',
    'swipeId',
    'generation',
    'branchId',
    'parentHash',
    'contentHash',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function computedHash(source, hashField, valueField, hashFunction) {
    if (typeof source[hashField] === 'string' && source[hashField].trim()) {
        return source[hashField].trim();
    }
    if (Object.hasOwn(source, valueField)) return hashFunction(source[valueField]);
    return source[hashField];
}

export function normalizeMessageFingerprint(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        chatId: trimString(source.chatId),
        logicalIndex: source.logicalIndex,
        messageId: trimString(source.messageId),
        swipeId: source.swipeId,
        generation: source.generation,
        branchId: trimString(source.branchId),
        parentHash: trimString(computedHash(
            source,
            'parentHash',
            'parentContent',
            hashCanonical,
        )),
        contentHash: trimString(computedHash(
            source,
            'contentHash',
            'content',
            hashText,
        )),
        ...(Object.hasOwn(source, 'stateHash') || Object.hasOwn(source, 'state')
            ? {
                stateHash: trimString(computedHash(
                    source,
                    'stateHash',
                    'state',
                    hashCanonical,
                )),
            }
            : {}),
    };
}

export function validateMessageFingerprint(input, path = '$') {
    const value = normalizeMessageFingerprint(input);
    const issues = [];
    if (!requirePlainObject(input, issues, path)) return validationResult(value, issues);
    requireString(value.chatId, issues, `${path}.chatId`, {
        code: 'fingerprint.chat_id',
    });
    requireFiniteNumber(value.logicalIndex, issues, `${path}.logicalIndex`, {
        minimum: 0,
        integer: true,
        code: 'fingerprint.logical_index',
    });
    requireString(value.messageId, issues, `${path}.messageId`, {
        code: 'fingerprint.message_id',
    });
    requireFiniteNumber(value.swipeId, issues, `${path}.swipeId`, {
        minimum: 0,
        integer: true,
        code: 'fingerprint.swipe_id',
    });
    requireFiniteNumber(value.generation, issues, `${path}.generation`, {
        minimum: 0,
        integer: true,
        code: 'fingerprint.generation',
    });
    requireString(value.branchId, issues, `${path}.branchId`, {
        code: 'fingerprint.branch_id',
    });
    requireString(value.parentHash, issues, `${path}.parentHash`, {
        code: 'fingerprint.parent_hash',
    });
    requireString(value.contentHash, issues, `${path}.contentHash`, {
        code: 'fingerprint.content_hash',
    });
    if (value.stateHash !== undefined) {
        requireString(value.stateHash, issues, `${path}.stateHash`, {
            code: 'fingerprint.state_hash',
        });
    }
    if (
        typeof input.contentHash === 'string'
        && Object.hasOwn(input, 'content')
        && input.contentHash.trim() !== hashText(input.content)
    ) {
        addIssue(
            issues,
            'fingerprint.content_hash_conflict',
            `${path}.contentHash`,
            '显式 contentHash 与同一输入正文的规范哈希不一致。',
        );
    }
    if (
        typeof input.parentHash === 'string'
        && Object.hasOwn(input, 'parentContent')
        && input.parentHash.trim() !== hashCanonical(input.parentContent)
    ) {
        addIssue(
            issues,
            'fingerprint.parent_hash_conflict',
            `${path}.parentHash`,
            '显式 parentHash 与同一输入父内容的规范哈希不一致。',
        );
    }
    return validationResult(value, issues);
}

export function createMessageFingerprint(input) {
    return validateMessageFingerprint(input);
}

export function compareMessageFingerprints(expectedInput, actualInput, {
    compareStateHash = Object.hasOwn(
        isPlainObject(expectedInput) ? expectedInput : {},
        'stateHash',
    ),
} = {}) {
    const expected = validateMessageFingerprint(expectedInput, '$.expected');
    const actual = validateMessageFingerprint(actualInput, '$.actual');
    const issues = [...expected.issues, ...actual.issues];
    if (!expected.ok || !actual.ok) {
        return {
            ok: false,
            status: 'unresolved',
            expected: expected.value,
            actual: actual.value,
            mismatches: [],
            issues,
        };
    }
    const fields = [
        ...MESSAGE_FINGERPRINT_FIELDS,
        ...(compareStateHash ? ['stateHash'] : []),
    ];
    const mismatches = fields
        .filter((field) => expected.value[field] !== actual.value[field])
        .map((field) => ({
            field,
            expected: expected.value[field],
            actual: actual.value[field],
        }));
    return {
        ok: mismatches.length === 0,
        status: mismatches.length ? 'stale' : 'match',
        expected: expected.value,
        actual: actual.value,
        mismatches,
        issues,
    };
}

function sameCandidateValues(values) {
    return values.every((value) => value === values[0]);
}

function firstUnambiguousTier(tiers, issues, path) {
    for (const tier of tiers) {
        const values = tier.values
            .filter((value) => value !== undefined && value !== null)
            .map((value) => String(value).trim())
            .filter(Boolean);
        if (!values.length) continue;
        if (!sameCandidateValues(values)) {
            addIssue(
                issues,
                'fingerprint.host_identity_ambiguous',
                path,
                `宿主消息身份在 ${tier.name} 优先级内互相冲突，不能猜测。`,
                'unresolved',
                { tier: tier.name, values },
            );
            return undefined;
        }
        return values[0];
    }
    return undefined;
}

function scalarFromAliases(source, names, issues, path) {
    const values = names
        .filter((name) => Object.hasOwn(source, name))
        .map((name) => source[name])
        .filter((value) => value !== undefined && value !== null);
    if (!values.length) return undefined;
    if (!values.every((value) => String(value) === String(values[0]))) {
        addIssue(
            issues,
            'fingerprint.host_field_ambiguous',
            path,
            '宿主同一指纹字段的多个别名值互相冲突，不能猜测。',
            'unresolved',
            { aliases: names, values },
        );
        return undefined;
    }
    return values[0];
}

/**
 * Convert a host snapshot without depending on SillyTavern globals.
 *
 * Stable message identity tiers are explicit override, persisted doctor ID,
 * native host ID, then opt-in legacy send_date. Conflicts inside a tier are
 * unresolved; lower tiers never override a higher durable identity.
 */
export function adaptHostMessageFingerprint(snapshot, options = {}) {
    const issues = [];
    if (!isPlainObject(snapshot)) {
        addIssue(issues, 'fingerprint.host_snapshot_type', '$', '宿主消息快照必须是普通对象。');
        return validationResult(normalizeMessageFingerprint({}), issues);
    }
    const swipeIndex = Number(options.swipeId ?? snapshot.swipeId ?? snapshot.swipe_id);
    const swipeInfo = Array.isArray(snapshot.swipe_info)
        && Number.isInteger(swipeIndex)
        && isPlainObject(snapshot.swipe_info[swipeIndex])
        ? snapshot.swipe_info[swipeIndex]
        : isPlainObject(snapshot.swipeInfo)
            ? snapshot.swipeInfo
            : {};
    const messageId = firstUnambiguousTier([
        { name: 'explicit', values: [options.messageId] },
        {
            name: 'persisted',
            values: [
                snapshot.extra?.mvu_auto_doctor_source_id,
                swipeInfo.extra?.mvu_auto_doctor_source_id,
            ],
        },
        {
            name: 'native',
            values: [
                snapshot.messageId,
                snapshot.message_id,
                snapshot.mesId,
            ],
        },
        {
            name: 'legacy-send-date',
            values: options.allowLegacySendDate ? [snapshot.send_date] : [],
        },
    ], issues, '$.messageId');

    const raw = {
        chatId: options.chatId ?? scalarFromAliases(
            snapshot,
            ['chatId', 'chat_id'],
            issues,
            '$.chatId',
        ),
        logicalIndex: options.logicalIndex ?? scalarFromAliases(
            snapshot,
            ['logicalIndex', 'index'],
            issues,
            '$.logicalIndex',
        ),
        messageId,
        swipeId: options.swipeId ?? scalarFromAliases(
            snapshot,
            ['swipeId', 'swipe_id'],
            issues,
            '$.swipeId',
        ),
        generation: options.generation ?? scalarFromAliases(
            snapshot,
            ['generation', 'generationSerial'],
            issues,
            '$.generation',
        ),
        branchId: options.branchId ?? scalarFromAliases(
            snapshot,
            ['branchId', 'branch_id'],
            issues,
            '$.branchId',
        ),
        parentHash: options.parentHash ?? scalarFromAliases(
            snapshot,
            ['parentHash', 'parent_hash'],
            issues,
            '$.parentHash',
        ),
        contentHash: options.contentHash ?? scalarFromAliases(
            snapshot,
            ['contentHash', 'content_hash', 'fingerprint'],
            issues,
            '$.contentHash',
        ),
        ...(options.stateHash !== undefined || snapshot.stateHash !== undefined
            ? { stateHash: options.stateHash ?? snapshot.stateHash }
            : {}),
    };
    if (!raw.contentHash) {
        const content = options.content ?? snapshot.content ?? snapshot.mes;
        if (typeof content === 'string') raw.contentHash = hashText(content);
    }
    if (!raw.parentHash && Object.hasOwn(options, 'parentContent')) {
        raw.parentHash = hashCanonical(options.parentContent);
    }
    const validated = validateMessageFingerprint(raw);
    return validationResult(validated.value, [...issues, ...validated.issues], {
        identitySource: messageId
            ? (
                options.messageId
                    ? 'explicit'
                    : snapshot.extra?.mvu_auto_doctor_source_id
                        || swipeInfo.extra?.mvu_auto_doctor_source_id
                        ? 'persisted'
                        : snapshot.messageId || snapshot.message_id || snapshot.mesId
                            ? 'native'
                            : 'legacy-send-date'
            )
            : 'unresolved',
    });
}
