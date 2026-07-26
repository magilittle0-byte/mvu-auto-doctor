import {
    adaptLegacyEquipment,
    adaptLegacyFact,
    adaptLegacyItem,
    adaptLegacyKnowledge,
    adaptLegacyQuest,
    adaptLegacySkill,
    adaptLegacySocialState,
    deepClone,
    isPlainObject,
    validationResult,
} from '../domain/index.mjs';

export const LEGACY_DOMAIN_KINDS = Object.freeze([
    'item',
    'equipment',
    'skill',
    'fact',
    'knowledge',
    'social',
    'quest',
]);

const ADAPTERS = Object.freeze({
    item: adaptLegacyItem,
    equipment: adaptLegacyEquipment,
    skill: adaptLegacySkill,
    fact: adaptLegacyFact,
    knowledge: adaptLegacyKnowledge,
    social: adaptLegacySocialState,
    quest: adaptLegacyQuest,
});

function diagnosticFor(id, kind, result) {
    const status = result?.migration?.status
        ?? (result?.status === 'valid' ? 'mapped' : result?.status);
    return {
        id,
        kind,
        status,
        visibility: status === 'quarantined'
            ? 'quarantined-read-only'
            : status === 'unresolved'
                ? 'unresolved-read-only'
                : 'mapped-read-only',
        canTransact: result?.status === 'valid' && status === 'mapped',
        sourceRefs: deepClone(result?.migration?.sourceRefs ?? []),
        issues: deepClone(result?.issues ?? []),
        warnings: deepClone(result?.migration?.warnings ?? []),
    };
}

export function inspectLegacyDomainRecord({
    id,
    kind,
    source,
    options = {},
} = {}) {
    const issues = [];
    if (!LEGACY_DOMAIN_KINDS.includes(kind)) {
        issues.push({
            code: 'migration.domain_kind',
            path: '$.kind',
            severity: 'error',
            message: '未知的1.x领域记录类型。',
        });
        return validationResult(null, issues, {
            diagnostic: {
                id: String(id ?? ''),
                kind,
                status: 'quarantined',
                visibility: 'quarantined-read-only',
                canTransact: false,
                sourceRefs: [],
                issues: deepClone(issues),
                warnings: [],
            },
        });
    }
    const result = ADAPTERS[kind](deepClone(source), deepClone(options));
    return {
        ...result,
        diagnostic: diagnosticFor(String(id ?? result.value?.id ?? ''), kind, result),
    };
}

export function diagnoseLegacyDomainProjection({
    entries = [],
    maxEntries = 256,
} = {}) {
    const issues = [];
    if (!Array.isArray(entries)) {
        issues.push({
            code: 'migration.domain_entries',
            path: '$.entries',
            severity: 'error',
            message: '迁移诊断 entries 必须是数组。',
        });
        return validationResult([], issues, {
            diagnostics: [],
            summary: { total: 0, mapped: 0, unresolved: 0, quarantined: 0 },
        });
    }
    if (
        !Number.isInteger(maxEntries)
        || maxEntries < 1
        || entries.length > maxEntries
    ) {
        issues.push({
            code: 'migration.domain_entry_limit',
            path: '$.entries',
            severity: 'error',
            message: '迁移诊断对象数量超过显式上限。',
            details: { actual: entries.length, limit: maxEntries },
        });
    }
    const projected = issues.length
        ? []
        : entries.map((entry, index) => inspectLegacyDomainRecord({
            id: entry?.id ?? `legacy:${index}`,
            kind: entry?.kind,
            source: entry?.source,
            options: entry?.options,
        }));
    const diagnostics = projected.map((entry) => entry.diagnostic);
    const summary = {
        total: diagnostics.length,
        mapped: diagnostics.filter((entry) => entry.status === 'mapped').length,
        unresolved: diagnostics.filter((entry) => entry.status === 'unresolved').length,
        quarantined: diagnostics.filter((entry) => entry.status === 'quarantined').length,
    };
    const allIssues = [...issues, ...projected.flatMap((entry) => entry.issues)];
    return validationResult(
        projected.map((entry) => deepClone(entry.value)),
        allIssues,
        { diagnostics, summary },
    );
}

export function createLazyLegacyDomainProjection({
    entries = [],
    maxEntries = 256,
} = {}) {
    if (!Array.isArray(entries) || entries.length > maxEntries) {
        throw new TypeError('惰性迁移条目必须是未超过显式上限的数组。');
    }
    const sourceEntries = new Map();
    for (const [index, entry] of entries.entries()) {
        const id = String(entry?.id ?? `legacy:${index}`);
        if (sourceEntries.has(id)) {
            throw new TypeError(`惰性迁移条目 ID 重复：${id}`);
        }
        sourceEntries.set(id, deepClone({ ...entry, id }));
    }
    const cache = new Map();
    return Object.freeze({
        get size() {
            return sourceEntries.size;
        },
        has(id) {
            return sourceEntries.has(String(id));
        },
        get(id) {
            const key = String(id);
            if (!sourceEntries.has(key)) return null;
            if (!cache.has(key)) {
                const entry = sourceEntries.get(key);
                cache.set(key, inspectLegacyDomainRecord(entry));
            }
            return deepClone(cache.get(key));
        },
        diagnostics() {
            return [...sourceEntries.keys()].map((id) => (
                cache.has(id)
                    ? deepClone(cache.get(id).diagnostic)
                    : {
                        id,
                        kind: sourceEntries.get(id)?.kind,
                        status: 'pending',
                        visibility: 'lazy-not-read',
                        canTransact: false,
                        sourceRefs: [],
                        issues: [],
                        warnings: [],
                    }
            ));
        },
        diagnoseAll() {
            return diagnoseLegacyDomainProjection({
                entries: [...sourceEntries.values()],
                maxEntries,
            });
        },
    });
}
