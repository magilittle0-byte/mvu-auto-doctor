export const SCHEMA_VERSION = '2.0';

export const ISSUE_SEVERITIES = Object.freeze([
    'warning',
    'unresolved',
    'error',
]);

export const MIGRATION_STATUSES = Object.freeze([
    'native',
    'mapped',
    'unresolved',
    'quarantined',
]);

export const EVIDENCE_KINDS = Object.freeze([
    'message',
    'rule',
    'schema',
    'state',
    'roll',
    'user-confirmation',
]);

const BASE_RECORD_KEYS = Object.freeze([
    'id',
    'schemaVersion',
    'revision',
    'extensions',
    'narrative',
]);

export function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepClone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function cloneArray(value) {
    return Array.isArray(value) ? value.map((item) => deepClone(item)) : [];
}

export function createValidationIssue({
    code,
    path,
    message,
    severity = 'error',
    details,
}) {
    return {
        code: String(code || 'validation.unknown'),
        path: String(path || '$'),
        severity: ISSUE_SEVERITIES.includes(severity) ? severity : 'error',
        message: String(message || '领域记录未通过验证。'),
        ...(details === undefined ? {} : { details: deepClone(details) }),
    };
}

export function validationStatus(issues = []) {
    if (issues.some((item) => item?.severity === 'error')) return 'rejected';
    if (issues.some((item) => item?.severity === 'unresolved')) return 'unresolved';
    return 'valid';
}

export function validationResult(value, issues = [], extra = {}) {
    const status = validationStatus(issues);
    return {
        ok: status === 'valid',
        status,
        value,
        issues,
        ...extra,
    };
}

export function addIssue(issues, code, path, message, severity = 'error', details) {
    issues.push(createValidationIssue({
        code,
        path,
        message,
        severity,
        details,
    }));
}

export function requirePlainObject(value, issues, path = '$') {
    if (isPlainObject(value)) return true;
    addIssue(issues, 'record.type', path, '记录必须是普通对象。');
    return false;
}

export function requireString(value, issues, path, {
    allowEmpty = false,
    code = 'field.string',
} = {}) {
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
        addIssue(issues, code, path, '字段必须是非空字符串。');
        return false;
    }
    return true;
}

export function requireBoolean(value, issues, path, code = 'field.boolean') {
    if (typeof value !== 'boolean') {
        addIssue(issues, code, path, '字段必须是布尔值。');
        return false;
    }
    return true;
}

export function requireFiniteNumber(value, issues, path, {
    minimum,
    maximum,
    integer = false,
    code = 'field.finite_number',
    severity = 'error',
} = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        addIssue(issues, code, path, '机械字段必须是有限数字，不能使用数字字符串或模糊文本。', severity);
        return false;
    }
    if (integer && !Number.isInteger(value)) {
        addIssue(issues, code, path, '该机械字段必须是整数。', severity);
        return false;
    }
    if (minimum !== undefined && value < minimum) {
        addIssue(issues, code, path, `该机械字段不能小于 ${minimum}。`, severity);
        return false;
    }
    if (maximum !== undefined && value > maximum) {
        addIssue(issues, code, path, `该机械字段不能大于 ${maximum}。`, severity);
        return false;
    }
    return true;
}

export function requireEnum(value, allowed, issues, path, code = 'field.enum') {
    if (!allowed.includes(value)) {
        addIssue(
            issues,
            code,
            path,
            `字段值必须是：${allowed.join('、')}。`,
        );
        return false;
    }
    return true;
}

function mergeUnknownIntoExtensions(input, knownKeys) {
    const existing = isPlainObject(input?.extensions)
        ? deepClone(input.extensions)
        : {};
    const collisions = {};
    const known = new Set([...BASE_RECORD_KEYS, ...knownKeys]);

    for (const [key, value] of Object.entries(isPlainObject(input) ? input : {})) {
        if (known.has(key)) continue;
        if (!Object.hasOwn(existing, key)) {
            existing[key] = deepClone(value);
        } else {
            collisions[key] = deepClone(value);
        }
    }

    if (Object.keys(collisions).length) {
        const prior = isPlainObject(existing.unrecognizedRoot)
            ? existing.unrecognizedRoot
            : {};
        existing.unrecognizedRoot = { ...prior, ...collisions };
    }
    return existing;
}

export function normalizeNarrativeExtension(value) {
    if (!isPlainObject(value)) return value;
    return {
        ...(Object.hasOwn(value, 'summary') ? { summary: trimString(value.summary) } : {}),
        ...(Object.hasOwn(value, 'tags') ? {
            tags: Array.isArray(value.tags)
                ? value.tags.map((item) => trimString(item))
                : value.tags,
        } : {}),
        ...(Object.hasOwn(value, 'lore') ? { lore: deepClone(value.lore) } : {}),
        ...(Object.hasOwn(value, 'presentation')
            ? { presentation: deepClone(value.presentation) }
            : {}),
    };
}

export function normalizeV2Base(input, knownKeys = []) {
    const source = isPlainObject(input) ? input : {};
    const extensions = mergeUnknownIntoExtensions(source, knownKeys);
    return {
        id: trimString(source.id),
        schemaVersion: source.schemaVersion ?? SCHEMA_VERSION,
        revision: source.revision ?? 0,
        ...(Object.keys(extensions).length ? { extensions } : {}),
        ...(Object.hasOwn(source, 'narrative')
            ? { narrative: normalizeNarrativeExtension(source.narrative) }
            : {}),
    };
}

function validateNarrative(value, issues, path) {
    if (value === undefined) return;
    if (!requirePlainObject(value, issues, path)) return;
    if (value.summary !== undefined) {
        requireString(value.summary, issues, `${path}.summary`, { allowEmpty: true });
    }
    if (value.tags !== undefined) {
        if (!Array.isArray(value.tags)) {
            addIssue(issues, 'narrative.tags.type', `${path}.tags`, 'tags 必须是字符串数组。');
        } else {
            value.tags.forEach((tag, index) => {
                requireString(tag, issues, `${path}.tags[${index}]`);
            });
        }
    }
    for (const key of ['lore', 'presentation']) {
        if (value[key] !== undefined && !isPlainObject(value[key])) {
            addIssue(
                issues,
                `narrative.${key}.type`,
                `${path}.${key}`,
                `${key} 必须是普通对象。`,
            );
        }
    }
}

export function validateV2Base(value, issues, hardKeys = []) {
    if (!requirePlainObject(value, issues)) return;
    requireString(value.id, issues, '$.id', { code: 'record.id' });
    if (value.schemaVersion !== SCHEMA_VERSION) {
        addIssue(
            issues,
            'record.schema_version',
            '$.schemaVersion',
            `schemaVersion 必须是 ${SCHEMA_VERSION}。`,
        );
    }
    requireFiniteNumber(value.revision, issues, '$.revision', {
        minimum: 0,
        integer: true,
        code: 'record.revision',
    });

    if (value.extensions !== undefined) {
        if (requirePlainObject(value.extensions, issues, '$.extensions')) {
            const forbidden = new Set([...BASE_RECORD_KEYS, ...hardKeys]);
            for (const key of Object.keys(value.extensions)) {
                if (forbidden.has(key)) {
                    addIssue(
                        issues,
                        'record.extensions_hard_field_collision',
                        `$.extensions.${key}`,
                        `扩展字段不得覆盖同级硬字段 ${key}。`,
                    );
                }
            }
        }
    }
    validateNarrative(value.narrative, issues, '$.narrative');
}

export function normalizeMigrationState(value, {
    sourceVersion = '1.x',
    status = 'mapped',
    sourceRefs = [],
    warnings = [],
} = {}) {
    const source = isPlainObject(value) ? value : {};
    return {
        sourceVersion: source.sourceVersion ?? sourceVersion,
        status: source.status ?? status,
        sourceRefs: Array.isArray(source.sourceRefs)
            ? source.sourceRefs.map((item) => trimString(item))
            : cloneArray(sourceRefs).map((item) => trimString(item)),
        warnings: Array.isArray(source.warnings)
            ? source.warnings.map((item) => trimString(item))
            : cloneArray(warnings).map((item) => trimString(item)),
    };
}

export function validateMigrationState(value, issues, path = '$.migration') {
    if (value === undefined) return;
    if (!requirePlainObject(value, issues, path)) return;
    requireEnum(
        value.sourceVersion,
        ['1.x', 'legacy'],
        issues,
        `${path}.sourceVersion`,
        'migration.source_version',
    );
    requireEnum(
        value.status,
        MIGRATION_STATUSES,
        issues,
        `${path}.status`,
        'migration.status',
    );
    for (const [key, code] of [
        ['sourceRefs', 'migration.source_refs'],
        ['warnings', 'migration.warnings'],
    ]) {
        if (!Array.isArray(value[key])) {
            addIssue(issues, code, `${path}.${key}`, `${key} 必须是字符串数组。`);
            continue;
        }
        value[key].forEach((entry, index) => {
            requireString(entry, issues, `${path}.${key}[${index}]`);
        });
    }
}

export function normalizeEvidenceRef(value) {
    if (!isPlainObject(value)) return value;
    return {
        kind: trimString(value.kind),
        ref: trimString(value.ref),
        branchId: trimString(value.branchId),
        ...(Object.hasOwn(value, 'fingerprint')
            ? { fingerprint: deepClone(value.fingerprint) }
            : {}),
        ...(Object.hasOwn(value, 'excerptHash')
            ? { excerptHash: trimString(value.excerptHash) }
            : {}),
        ...(Object.hasOwn(value, 'note') ? { note: trimString(value.note) } : {}),
    };
}

export function normalizeEvidenceList(value) {
    return Array.isArray(value) ? value.map(normalizeEvidenceRef) : [];
}

export function validateEvidenceRef(value, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    requireEnum(value.kind, EVIDENCE_KINDS, issues, `${path}.kind`, 'evidence.kind');
    requireString(value.ref, issues, `${path}.ref`, { code: 'evidence.ref' });
    requireString(value.branchId, issues, `${path}.branchId`, {
        code: 'evidence.branch_id',
    });
    if (value.fingerprint !== undefined && !isPlainObject(value.fingerprint)) {
        addIssue(
            issues,
            'evidence.fingerprint.type',
            `${path}.fingerprint`,
            'fingerprint 必须是普通对象。',
        );
    }
    if (value.excerptHash !== undefined) {
        requireString(value.excerptHash, issues, `${path}.excerptHash`);
    }
    if (value.note !== undefined) {
        requireString(value.note, issues, `${path}.note`, { allowEmpty: true });
    }
}

export function validateEvidenceList(value, issues, path, { minItems = 0 } = {}) {
    if (!Array.isArray(value)) {
        addIssue(issues, 'evidence.list.type', path, '证据字段必须是数组。');
        return;
    }
    if (value.length < minItems) {
        addIssue(
            issues,
            'evidence.list.empty',
            path,
            '该状态需要至少一条可追溯证据。',
            'unresolved',
        );
    }
    value.forEach((entry, index) => {
        validateEvidenceRef(entry, issues, `${path}[${index}]`);
    });
}

export function normalizeResourceRef(value) {
    if (!isPlainObject(value)) return value;
    return {
        ownerId: trimString(value.ownerId),
        resourceId: trimString(value.resourceId),
    };
}

export function validateResourceRef(value, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    requireString(value.ownerId, issues, `${path}.ownerId`, {
        code: 'resource.owner_id',
    });
    requireString(value.resourceId, issues, `${path}.resourceId`, {
        code: 'resource.resource_id',
    });
}

export function normalizeEffect(value) {
    if (!isPlainObject(value)) return value;
    if (value.type === 'resource-delta') {
        const delta = isPlainObject(value.delta) ? value.delta : value.delta;
        return {
            type: value.type,
            delta: isPlainObject(delta) ? {
                resource: normalizeResourceRef(delta.resource),
                amount: delta.amount,
                reason: trimString(delta.reason),
            } : delta,
        };
    }
    if (value.type === 'status') {
        return {
            type: value.type,
            statusId: trimString(value.statusId),
            operation: trimString(value.operation),
            ...(Object.hasOwn(value, 'magnitude') ? { magnitude: value.magnitude } : {}),
            ...(Object.hasOwn(value, 'duration') ? { duration: value.duration } : {}),
        };
    }
    if (value.type === 'fact') {
        return {
            type: value.type,
            factId: trimString(value.factId),
            operation: trimString(value.operation),
        };
    }
    if (value.type === 'custom') {
        return {
            type: value.type,
            adapterId: trimString(value.adapterId),
            payload: deepClone(value.payload),
        };
    }
    return deepClone(value);
}

export function normalizeEffects(value) {
    return Array.isArray(value) ? value.map(normalizeEffect) : [];
}

export function validateEffect(value, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    if (!requireEnum(
        value.type,
        ['resource-delta', 'status', 'fact', 'custom'],
        issues,
        `${path}.type`,
        'effect.type',
    )) return;

    if (value.type === 'resource-delta') {
        if (!requirePlainObject(value.delta, issues, `${path}.delta`)) return;
        validateResourceRef(value.delta.resource, issues, `${path}.delta.resource`);
        requireFiniteNumber(value.delta.amount, issues, `${path}.delta.amount`, {
            code: 'effect.resource_delta.amount',
        });
        requireString(value.delta.reason, issues, `${path}.delta.reason`, {
            code: 'effect.resource_delta.reason',
        });
    } else if (value.type === 'status') {
        requireString(value.statusId, issues, `${path}.statusId`, {
            code: 'effect.status.id',
        });
        requireEnum(
            value.operation,
            ['add', 'remove'],
            issues,
            `${path}.operation`,
            'effect.status.operation',
        );
        if (value.magnitude !== undefined) {
            requireFiniteNumber(value.magnitude, issues, `${path}.magnitude`, {
                code: 'effect.status.magnitude',
            });
        }
        if (value.duration !== undefined) {
            requireFiniteNumber(value.duration, issues, `${path}.duration`, {
                minimum: 0,
                code: 'effect.status.duration',
            });
        }
    } else if (value.type === 'fact') {
        requireString(value.factId, issues, `${path}.factId`, {
            code: 'effect.fact.id',
        });
        requireEnum(
            value.operation,
            ['propose', 'confirm', 'retract'],
            issues,
            `${path}.operation`,
            'effect.fact.operation',
        );
    } else if (value.type === 'custom') {
        requireString(value.adapterId, issues, `${path}.adapterId`, {
            code: 'effect.custom.adapter_id',
        });
        requirePlainObject(value.payload, issues, `${path}.payload`);
    }
}

export function validateEffects(value, issues, path) {
    if (!Array.isArray(value)) {
        addIssue(issues, 'effect.list.type', path, '效果字段必须是数组。');
        return;
    }
    value.forEach((entry, index) => validateEffect(entry, issues, `${path}[${index}]`));
}

export function preserveLegacyExtensions(extensions, legacyUnknown) {
    const next = isPlainObject(extensions) ? deepClone(extensions) : {};
    if (!isPlainObject(legacyUnknown) || !Object.keys(legacyUnknown).length) return next;
    next.legacy = {
        ...(isPlainObject(next.legacy) ? next.legacy : {}),
        ...deepClone(legacyUnknown),
    };
    return next;
}

function mergeObjects(base, overlay) {
    const result = isPlainObject(base) ? deepClone(base) : {};
    for (const [key, value] of Object.entries(isPlainObject(overlay) ? overlay : {})) {
        if (isPlainObject(value) && isPlainObject(result[key])) {
            result[key] = mergeObjects(result[key], value);
        } else {
            result[key] = deepClone(value);
        }
    }
    return result;
}

export function restoreLegacyExtensions(record, mappedProjection = {}) {
    const legacy = isPlainObject(record?.extensions?.legacy)
        ? record.extensions.legacy
        : {};
    return mergeObjects(legacy, mappedProjection);
}

export function legacyUnknownFields(source, consumedKeys = []) {
    if (!isPlainObject(source)) return {};
    const consumed = new Set(consumedKeys);
    return Object.fromEntries(
        Object.entries(source)
            .filter(([key]) => !consumed.has(key))
            .map(([key, value]) => [key, deepClone(value)]),
    );
}

export const DEFAULT_MIGRATION_LIMITS = Object.freeze({
    maxDepth: 32,
    maxObjects: 1_000,
    maxKeys: 5_000,
    maxStringLength: 10_000,
});

export function validateLegacyInputBounds(value, issues, limits = {}) {
    const configured = {
        ...DEFAULT_MIGRATION_LIMITS,
        ...(isPlainObject(limits) ? limits : {}),
    };
    const seen = new WeakSet();
    let objectCount = 0;
    let keyCount = 0;
    let stopped = false;

    function reject(code, path, message, details) {
        addIssue(issues, code, path, message, 'error', details);
        stopped = true;
    }

    function visit(current, path, depth) {
        if (stopped || current === null || current === undefined) return;
        if (typeof current === 'string') {
            if (current.length > configured.maxStringLength) {
                reject(
                    'migration.string_limit',
                    path,
                    '旧字段文本超过只读迁移上限。',
                    { actual: current.length, limit: configured.maxStringLength },
                );
            }
            return;
        }
        if (typeof current !== 'object') return;
        if (seen.has(current)) {
            reject('migration.cyclic_input', path, '旧对象包含循环引用，不能安全投影。');
            return;
        }
        seen.add(current);
        objectCount += 1;
        if (objectCount > configured.maxObjects) {
            reject(
                'migration.object_limit',
                path,
                '旧对象数量超过只读迁移上限。',
                { actual: objectCount, limit: configured.maxObjects },
            );
            return;
        }
        if (depth > configured.maxDepth) {
            reject(
                'migration.depth_limit',
                path,
                '旧对象嵌套深度超过只读迁移上限。',
                { actual: depth, limit: configured.maxDepth },
            );
            return;
        }
        const entries = Array.isArray(current)
            ? current.map((entry, index) => [String(index), entry])
            : Object.entries(current);
        keyCount += entries.length;
        if (keyCount > configured.maxKeys) {
            reject(
                'migration.key_limit',
                path,
                '旧字段数量超过只读迁移上限。',
                { actual: keyCount, limit: configured.maxKeys },
            );
            return;
        }
        for (const [key, entry] of entries) {
            visit(entry, `${path}.${key}`, depth + 1);
            if (stopped) return;
        }
    }

    visit(value, '$', 0);
    return !stopped;
}

export function migrationResult(value, issues, {
    sourceVersion = '1.x',
    sourceRefs = [],
    quarantined = false,
    legacyProjection,
} = {}) {
    const derivedStatus = quarantined
        ? 'quarantined'
        : issues.some((item) => item.severity === 'error')
            ? 'quarantined'
            : issues.some((item) => item.severity === 'unresolved')
                ? 'unresolved'
                : 'mapped';
    const warnings = issues
        .filter((item) => item.severity !== 'warning' || item.message)
        .map((item) => `${item.code}: ${item.message}`);
    value.migration = normalizeMigrationState(value.migration, {
        sourceVersion,
        status: derivedStatus,
        sourceRefs,
        warnings,
    });
    value.migration.status = derivedStatus;
    value.migration.warnings = warnings;
    return validationResult(value, issues, {
        migration: value.migration,
        ...(legacyProjection === undefined
            ? {}
            : { legacyProjection: deepClone(legacyProjection) }),
    });
}
