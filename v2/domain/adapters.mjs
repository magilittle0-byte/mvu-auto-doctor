import {
    addIssue,
    deepClone,
    isPlainObject,
    legacyUnknownFields,
    migrationResult,
    normalizeEvidenceList,
    preserveLegacyExtensions,
    restoreLegacyExtensions,
    validateLegacyInputBounds,
} from './common.mjs';
import {
    ITEM_KINDS,
    SKILL_COST_TIMINGS,
    SKILL_MODES,
    normalizeEquipmentV2,
    normalizeItemV2,
    normalizeSkillV2,
    normalizeSlotRef,
    validateEquipmentV2,
    validateItemV2,
    validateSkillV2,
} from './mechanics.mjs';
import {
    FACT_IMPACTS,
    FACT_SCOPES,
    FACT_STATUSES,
    KNOWLEDGE_STATES,
    KNOWLEDGE_VISIBILITIES,
    QUEST_STATUSES,
    SOCIAL_COERCIVE_DIMENSIONS,
    SOCIAL_VOLUNTARY_DIMENSIONS,
    normalizeFact,
    normalizeKnowledge,
    normalizeQuest,
    normalizeSocialState,
    validateFact,
    validateKnowledge,
    validateQuest,
    validateSocialState,
} from './state.mjs';

const DEFAULT_ALIASES = Object.freeze({
    id: ['id', 'ID'],
    name: ['name', '名称'],
    kind: ['kind', '类型'],
    quantity: ['quantity', '数量'],
    stackable: ['stackable', '可堆叠'],
    description: ['description', '描述'],
    unit: ['unit', '单位'],
    mechanics: ['mechanics', '机制'],
    effects: ['effects', '效果'],
    consumes: ['consumes', '消耗数量'],
    provenance: ['provenance', '来源证据'],
    itemId: ['itemId', '物品ID'],
    allowedSlots: ['allowedSlots', '可装备槽位', '装备位置'],
    occupies: ['occupies', '占用槽位'],
    equippedAt: ['equippedAt', '当前槽位'],
    handedness: ['handedness', '持握'],
    bonuses: ['bonuses', '加成'],
    requirements: ['requirements', '需求'],
    mode: ['mode', '模式'],
    costs: ['costs', '类型化消耗'],
    displayCost: ['displayCost', 'costText', '消耗'],
    resolution: ['resolution', '结算'],
    proposition: ['proposition', '命题', '内容'],
    status: ['status', '状态'],
    scope: ['scope', '范围'],
    branchId: ['branchId', '分支ID'],
    subjectIds: ['subjectIds', '主体ID'],
    evidence: ['evidence', '证据'],
    contradictedBy: ['contradictedBy', '反证'],
    supersedes: ['supersedes', '替代事实'],
    impact: ['impact', '影响'],
    knowerId: ['knowerId', '知情者ID'],
    factId: ['factId', '事实ID'],
    state: ['state', '知情状态'],
    acquiredBy: ['acquiredBy', '获取证据'],
    visibility: ['visibility', '可见性'],
    fromActorId: ['fromActorId', '来源角色ID'],
    toActorId: ['toActorId', '目标角色ID'],
    voluntary: ['voluntary', '自愿关系'],
    coercive: ['coercive', '强制关系'],
    labels: ['labels', '标签'],
    title: ['title', '标题'],
    objectives: ['objectives', '目标'],
    settlementTransactionIds: ['settlementTransactionIds', '结算事务ID'],
    supersededBy: ['supersededBy', '替代任务ID'],
    terminalEvidence: ['terminalEvidence', '终态证据'],
});

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function aliasesFor(field, overrides = {}) {
    const custom = overrides[field];
    return Array.isArray(custom) && custom.length ? custom : DEFAULT_ALIASES[field] ?? [field];
}

function sameData(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function readAlias(source, field, issues, overrides = {}) {
    const aliases = aliasesFor(field, overrides);
    const matches = aliases
        .filter((key) => Object.hasOwn(source, key))
        .map((key) => ({ key, value: source[key] }));
    if (!matches.length) return { key: undefined, value: undefined, aliases };
    if (matches.length > 1 && !matches.every((entry) => sameData(entry.value, matches[0].value))) {
        addIssue(
            issues,
            'migration.alias_conflict',
            `$.${field}`,
            `${field} 同时命中多个值不一致的旧字段，不能猜测优先级。`,
            'unresolved',
            { keys: matches.map((entry) => entry.key) },
        );
        return { key: undefined, value: undefined, aliases };
    }
    return { ...matches[0], aliases };
}

function consumedAliasKeys(fields, overrides = {}) {
    return fields.flatMap((field) => aliasesFor(field, overrides));
}

function requireLegacyObject(source, issues, options = {}) {
    if (!isPlainObject(source)) {
        addIssue(issues, 'migration.source_type', '$', '1.x来源必须是普通对象。');
        return false;
    }
    return validateLegacyInputBounds(source, issues, options.limits);
}

function explicitOrAlias(optionsValue, source, field, issues, aliases) {
    if (optionsValue !== undefined) return optionsValue;
    return readAlias(source, field, issues, aliases).value;
}

function baseRecord(source, fields, {
    id,
    revision = 0,
    aliases,
    extensions,
} = {}) {
    const unknown = legacyUnknownFields(
        source,
        consumedAliasKeys(fields, aliases),
    );
    return {
        id,
        schemaVersion: '2.0',
        revision,
        extensions: preserveLegacyExtensions(extensions, unknown),
    };
}

function sourceRefsFor(options, fallback) {
    if (Array.isArray(options.sourceRefs) && options.sourceRefs.length) {
        return options.sourceRefs.map((item) => String(item));
    }
    return fallback ? [fallback] : [];
}

function combineIssues(...groups) {
    const result = [];
    const seen = new Set();
    for (const issue of groups.flat()) {
        const key = `${issue.code}\u0000${issue.path}\u0000${issue.severity}\u0000${issue.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(issue);
    }
    return result;
}

export function adaptLegacyItem(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeItemV2({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const kindRaw = explicitOrAlias(options.kind, source, 'kind', issues, aliases);
    let kind = kindRaw;
    if (typeof kindRaw === 'string' && !ITEM_KINDS.includes(kindRaw)) {
        kind = options.kindMap?.[kindRaw];
        if (!ITEM_KINDS.includes(kind)) {
            addIssue(
                issues,
                'migration.item_kind_unresolved',
                '$.kind',
                '旧物品类型没有唯一映射到 ItemV2 kind。',
                'unresolved',
                { sourceValue: kindRaw },
            );
            kind = undefined;
        }
    }

    const mechanicsRaw = explicitOrAlias(
        options.mechanics,
        source,
        'mechanics',
        issues,
        aliases,
    );
    const effectsRaw = explicitOrAlias(
        options.effects,
        source,
        'effects',
        issues,
        aliases,
    );
    const consumesRaw = explicitOrAlias(
        options.consumes,
        source,
        'consumes',
        issues,
        aliases,
    );
    let mechanics = isPlainObject(mechanicsRaw) ? deepClone(mechanicsRaw) : undefined;
    if (Array.isArray(effectsRaw) || consumesRaw !== undefined) {
        mechanics = {
            ...(mechanics ?? {}),
            use: {
                ...(isPlainObject(mechanics?.use) ? mechanics.use : {}),
                consumes: consumesRaw,
                effects: Array.isArray(effectsRaw) ? effectsRaw : [],
            },
        };
    }

    const fields = [
        'id',
        'name',
        'kind',
        'quantity',
        'stackable',
        'description',
        'unit',
        'mechanics',
        'effects',
        'consumes',
        'provenance',
    ];
    const value = normalizeItemV2({
        ...baseRecord(source, fields, {
            id: explicitOrAlias(options.id, source, 'id', issues, aliases),
            revision: options.revision,
            aliases,
            extensions: options.extensions,
        }),
        name: explicitOrAlias(options.name, source, 'name', issues, aliases),
        kind,
        quantity: explicitOrAlias(options.quantity, source, 'quantity', issues, aliases),
        stackable: explicitOrAlias(options.stackable, source, 'stackable', issues, aliases),
        description: explicitOrAlias(
            options.description,
            source,
            'description',
            issues,
            aliases,
        ),
        ...(explicitOrAlias(options.unit, source, 'unit', issues, aliases) === undefined
            ? {}
            : { unit: explicitOrAlias(options.unit, source, 'unit', issues, aliases) }),
        ...(mechanics === undefined ? {} : { mechanics }),
        provenance: normalizeEvidenceList(
            explicitOrAlias(options.provenance, source, 'provenance', issues, aliases)
            ?? options.defaultProvenance
            ?? [],
        ),
    });
    const validated = validateItemV2(value, {
        mechanicalEffectClaimed: options.mechanicalEffectClaimed === true,
        discrete: options.discrete,
    });
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, readAlias(source, 'id', [], aliases).value),
        legacyProjection: source,
    });
}

function slotFromLegacy(value, issues, path, {
    slotSystem,
} = {}) {
    if (isPlainObject(value)) return normalizeSlotRef(value);
    if (typeof value === 'string' && value.trim()) {
        if (typeof slotSystem === 'string' && slotSystem.trim()) {
            return { system: slotSystem.trim(), slot: value.trim() };
        }
        addIssue(
            issues,
            'migration.slot_system_unresolved',
            path,
            '旧槽位只有名称而没有槽位系统；必须由当前战役适配器提供 system。',
            'unresolved',
        );
        return null;
    }
    addIssue(
        issues,
        'migration.slot_ref_invalid',
        path,
        '旧槽位无法无歧义映射为 SlotRef。',
        'unresolved',
    );
    return null;
}

function slotListFromLegacy(value, issues, path, options) {
    const source = Array.isArray(value)
        ? value
        : value === undefined || value === null
            ? []
            : [value];
    return source
        .map((entry, index) => slotFromLegacy(entry, issues, `${path}[${index}]`, options))
        .filter(Boolean);
}

export function adaptLegacyEquipment(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeEquipmentV2({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const allowedRaw = explicitOrAlias(
        options.allowedSlots,
        source,
        'allowedSlots',
        issues,
        aliases,
    );
    const equippedRaw = options.currentSlot ?? explicitOrAlias(
        options.equippedAt,
        source,
        'equippedAt',
        issues,
        aliases,
    );
    const occupiesRaw = explicitOrAlias(
        options.occupies,
        source,
        'occupies',
        issues,
        aliases,
    );
    const fields = [
        'id',
        'itemId',
        'allowedSlots',
        'occupies',
        'equippedAt',
        'handedness',
        'bonuses',
        'requirements',
        'provenance',
    ];
    const value = normalizeEquipmentV2({
        ...baseRecord(source, fields, {
            id: explicitOrAlias(options.id, source, 'id', issues, aliases),
            revision: options.revision,
            aliases,
            extensions: options.extensions,
        }),
        itemId: explicitOrAlias(options.itemId, source, 'itemId', issues, aliases),
        allowedSlots: slotListFromLegacy(allowedRaw, issues, '$.allowedSlots', options),
        occupies: slotListFromLegacy(occupiesRaw, issues, '$.occupies', options),
        ...(equippedRaw === undefined ? {} : {
            equippedAt: slotListFromLegacy(equippedRaw, issues, '$.equippedAt', options),
        }),
        ...(explicitOrAlias(
            options.handedness,
            source,
            'handedness',
            issues,
            aliases,
        ) === undefined ? {} : {
            handedness: explicitOrAlias(
                options.handedness,
                source,
                'handedness',
                issues,
                aliases,
            ),
        }),
        bonuses: explicitOrAlias(options.bonuses, source, 'bonuses', issues, aliases) ?? [],
        ...(explicitOrAlias(
            options.requirements,
            source,
            'requirements',
            issues,
            aliases,
        ) === undefined ? {} : {
            requirements: explicitOrAlias(
                options.requirements,
                source,
                'requirements',
                issues,
                aliases,
            ),
        }),
        provenance: normalizeEvidenceList(
            explicitOrAlias(options.provenance, source, 'provenance', issues, aliases)
            ?? options.defaultProvenance
            ?? [],
        ),
    });
    const validated = validateEquipmentV2(value);
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, value.itemId),
        legacyProjection: source,
    });
}

function normalizedResourceAliasEntries(resourceAliases) {
    if (resourceAliases instanceof Map) return [...resourceAliases.entries()];
    if (!isPlainObject(resourceAliases)) return [];
    return Object.entries(resourceAliases);
}

export function parseLegacySkillCost(displayCost, {
    resourceAliases,
    timing,
    refundable,
} = {}) {
    const issues = [];
    if (typeof displayCost !== 'string' || !displayCost.trim()) {
        addIssue(
            issues,
            'migration.skill_cost_text_missing',
            '$.displayCost',
            '没有可解析的技能成本文本。',
            'unresolved',
        );
        return { cost: null, issues };
    }
    const match = displayCost.trim().match(
        /^(?:(?<amountA>[+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?<unitA>[^\d\s]+)|(?<unitB>[^\d\s]+)\s*(?<amountB>[+-]?(?:\d+(?:\.\d+)?|\.\d+)))$/u,
    );
    if (!match) {
        addIssue(
            issues,
            'migration.skill_cost_syntax_unresolved',
            '$.displayCost',
            '技能成本文本不是唯一的“数值+单位”结构，不能猜测。',
            'unresolved',
        );
        return { cost: null, issues };
    }
    const amount = Number(match.groups.amountA ?? match.groups.amountB);
    const unit = String(match.groups.unitA ?? match.groups.unitB).trim();
    if (!Number.isFinite(amount) || amount < 0) {
        addIssue(
            issues,
            'migration.skill_cost_amount_invalid',
            '$.displayCost',
            '技能成本数值必须是非负有限数字。',
            'unresolved',
        );
        return { cost: null, issues };
    }

    const matches = normalizedResourceAliasEntries(resourceAliases)
        .filter(([alias]) => String(alias).toLocaleLowerCase() === unit.toLocaleLowerCase())
        .flatMap(([, target]) => Array.isArray(target) ? target : [target])
        .filter(isPlainObject);
    const unique = matches.filter((target, index) => (
        matches.findIndex((candidate) => sameData(candidate, target)) === index
    ));
    if (unique.length !== 1) {
        addIssue(
            issues,
            'migration.skill_cost_resource_unresolved',
            '$.displayCost',
            unique.length
                ? '技能成本单位映射到多个资源，不能猜测结算目标。'
                : '技能成本单位没有由当前资源适配器确认。',
            'unresolved',
            { unit },
        );
        return { cost: null, issues };
    }
    if (!SKILL_COST_TIMINGS.includes(timing) || typeof refundable !== 'boolean') {
        addIssue(
            issues,
            'migration.skill_cost_policy_unresolved',
            '$.costs',
            '资源已识别，但 timing/refundable 没有由规则适配器明确提供。',
            'unresolved',
        );
        return { cost: null, issues };
    }
    return {
        cost: {
            resource: deepClone(unique[0]),
            amount,
            timing,
            refundable,
        },
        issues,
    };
}

export function adaptLegacySkill(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeSkillV2({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const displayCost = explicitOrAlias(
        options.displayCost,
        source,
        'displayCost',
        issues,
        aliases,
    );
    const typedCosts = explicitOrAlias(options.costs, source, 'costs', issues, aliases);
    let costs = Array.isArray(typedCosts) ? typedCosts : [];
    if (!costs.length && typeof displayCost === 'string' && displayCost.trim()) {
        const parsed = parseLegacySkillCost(displayCost, options);
        issues.push(...parsed.issues);
        if (parsed.cost) costs = [parsed.cost];
    }
    const fields = [
        'id',
        'name',
        'mode',
        'costs',
        'effects',
        'resolution',
        'displayCost',
        'provenance',
    ];
    const value = normalizeSkillV2({
        ...baseRecord(source, fields, {
            id: explicitOrAlias(options.id, source, 'id', issues, aliases),
            revision: options.revision,
            aliases,
            extensions: options.extensions,
        }),
        name: explicitOrAlias(options.name, source, 'name', issues, aliases),
        mode: explicitOrAlias(options.mode, source, 'mode', issues, aliases),
        costs,
        effects: explicitOrAlias(options.effects, source, 'effects', issues, aliases) ?? [],
        ...(explicitOrAlias(
            options.resolution,
            source,
            'resolution',
            issues,
            aliases,
        ) === undefined ? {} : {
            resolution: explicitOrAlias(
                options.resolution,
                source,
                'resolution',
                issues,
                aliases,
            ),
        }),
        ...(displayCost === undefined ? {} : { displayCost }),
        provenance: normalizeEvidenceList(
            explicitOrAlias(options.provenance, source, 'provenance', issues, aliases)
            ?? options.defaultProvenance
            ?? [],
        ),
    });
    if (typeof value.mode === 'string' && !SKILL_MODES.includes(value.mode)) {
        const mapped = options.modeMap?.[value.mode];
        if (SKILL_MODES.includes(mapped)) value.mode = mapped;
    }
    const validated = validateSkillV2(value);
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, value.id),
        legacyProjection: source,
    });
}

export function adaptLegacyFact(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeFact({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const rawStatus = explicitOrAlias(options.status, source, 'status', issues, aliases);
    let status = 'candidate';
    if (rawStatus !== undefined && rawStatus !== 'candidate') {
        if (
            options.allowConfirmed === true
            && rawStatus === 'confirmed'
            && (options.evidence?.length || readAlias(source, 'evidence', [], aliases).value?.length)
        ) {
            status = 'confirmed';
        } else if (FACT_STATUSES.includes(rawStatus) && rawStatus !== 'confirmed') {
            status = rawStatus;
        } else {
            addIssue(
                issues,
                'migration.fact_confirmation_unresolved',
                '$.status',
                '旧来源不能自动升级为 confirmed；已保守映射为 candidate。',
                'unresolved',
            );
        }
    }
    const fields = [
        'id',
        'proposition',
        'status',
        'scope',
        'branchId',
        'subjectIds',
        'evidence',
        'contradictedBy',
        'supersedes',
        'impact',
    ];
    const value = normalizeFact({
        ...baseRecord(source, fields, {
            id: explicitOrAlias(options.id, source, 'id', issues, aliases),
            revision: options.revision,
            aliases,
            extensions: options.extensions,
        }),
        proposition: explicitOrAlias(
            options.proposition,
            source,
            'proposition',
            issues,
            aliases,
        ),
        status,
        scope: explicitOrAlias(options.scope, source, 'scope', issues, aliases),
        branchId: explicitOrAlias(options.branchId, source, 'branchId', issues, aliases),
        subjectIds: explicitOrAlias(
            options.subjectIds,
            source,
            'subjectIds',
            issues,
            aliases,
        ) ?? [],
        evidence: explicitOrAlias(options.evidence, source, 'evidence', issues, aliases) ?? [],
        ...(explicitOrAlias(
            options.contradictedBy,
            source,
            'contradictedBy',
            issues,
            aliases,
        ) === undefined ? {} : {
            contradictedBy: explicitOrAlias(
                options.contradictedBy,
                source,
                'contradictedBy',
                issues,
                aliases,
            ),
        }),
        ...(explicitOrAlias(
            options.supersedes,
            source,
            'supersedes',
            issues,
            aliases,
        ) === undefined ? {} : {
            supersedes: explicitOrAlias(
                options.supersedes,
                source,
                'supersedes',
                issues,
                aliases,
            ),
        }),
        impact: explicitOrAlias(options.impact, source, 'impact', issues, aliases),
    });
    if (!FACT_SCOPES.includes(value.scope) && options.defaultScope) value.scope = options.defaultScope;
    if (!FACT_IMPACTS.includes(value.impact) && options.defaultImpact) {
        value.impact = options.defaultImpact;
    }
    const validated = validateFact(value);
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, value.id),
        legacyProjection: source,
    });
}

export function adaptLegacyKnowledge(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeKnowledge({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const rawState = explicitOrAlias(options.state, source, 'state', issues, aliases);
    let state = rawState ?? 'known';
    if (state === 'verified' && options.allowVerified !== true) {
        state = 'known';
        addIssue(
            issues,
            'migration.knowledge_verification_unresolved',
            '$.state',
            '旧来源不能自动升级为 verified；已保守映射为 known。',
            'unresolved',
        );
    }
    const fields = [
        'id',
        'knowerId',
        'factId',
        'state',
        'acquiredBy',
        'branchId',
        'visibility',
    ];
    const value = normalizeKnowledge({
        ...baseRecord(source, fields, {
            id: explicitOrAlias(options.id, source, 'id', issues, aliases),
            revision: options.revision,
            aliases,
            extensions: options.extensions,
        }),
        knowerId: explicitOrAlias(options.knowerId, source, 'knowerId', issues, aliases),
        factId: explicitOrAlias(options.factId, source, 'factId', issues, aliases),
        state,
        acquiredBy: explicitOrAlias(
            options.acquiredBy,
            source,
            'acquiredBy',
            issues,
            aliases,
        ) ?? [],
        branchId: explicitOrAlias(options.branchId, source, 'branchId', issues, aliases),
        visibility: explicitOrAlias(
            options.visibility,
            source,
            'visibility',
            issues,
            aliases,
        ),
    });
    if (!KNOWLEDGE_STATES.includes(value.state)) {
        addIssue(
            issues,
            'migration.knowledge_state_unresolved',
            '$.state',
            '旧知情状态没有唯一映射。',
            'unresolved',
        );
    }
    if (!KNOWLEDGE_VISIBILITIES.includes(value.visibility) && options.defaultVisibility) {
        value.visibility = options.defaultVisibility;
    }
    const validated = validateKnowledge(value);
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, value.id),
        legacyProjection: source,
    });
}

function mappedSocialDimensions(source, dimensionMap, issues) {
    const voluntary = {};
    const coercive = {};
    const consumed = [];
    for (const [legacyKey, mapping] of Object.entries(isPlainObject(dimensionMap) ? dimensionMap : {})) {
        if (!Object.hasOwn(source, legacyKey)) continue;
        consumed.push(legacyKey);
        if (
            mapping?.axis === 'voluntary'
            && SOCIAL_VOLUNTARY_DIMENSIONS.includes(mapping.dimension)
        ) {
            voluntary[mapping.dimension] = source[legacyKey];
        } else if (
            mapping?.axis === 'coercive'
            && SOCIAL_COERCIVE_DIMENSIONS.includes(mapping.dimension)
        ) {
            coercive[mapping.dimension] = source[legacyKey];
        } else {
            addIssue(
                issues,
                'migration.social_dimension_map_invalid',
                `$.${legacyKey}`,
                '关系维度映射必须明确区分 voluntary 与 coercive。',
                'unresolved',
            );
        }
    }
    return { voluntary, coercive, consumed };
}

export function adaptLegacySocialState(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeSocialState({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const mapped = mappedSocialDimensions(source, options.dimensionMap, issues);
    const nestedVoluntary = explicitOrAlias(
        options.voluntary,
        source,
        'voluntary',
        issues,
        aliases,
    );
    const nestedCoercive = explicitOrAlias(
        options.coercive,
        source,
        'coercive',
        issues,
        aliases,
    );
    if (Array.isArray(options.ambiguousRelationFields)) {
        for (const field of options.ambiguousRelationFields) {
            if (!Object.hasOwn(source, field)) continue;
            addIssue(
                issues,
                'migration.social_axis_unresolved',
                `$.${field}`,
                '旧关系字段无法区分强制/自愿轴，已保留在 extensions.legacy。',
                'unresolved',
            );
        }
    }
    const fields = [
        'id',
        'fromActorId',
        'toActorId',
        'voluntary',
        'coercive',
        'labels',
        'evidence',
        'branchId',
    ];
    const unknown = legacyUnknownFields(
        source,
        [...consumedAliasKeys(fields, aliases), ...mapped.consumed],
    );
    const value = normalizeSocialState({
        id: explicitOrAlias(options.id, source, 'id', issues, aliases),
        schemaVersion: '2.0',
        revision: options.revision ?? 0,
        extensions: preserveLegacyExtensions(options.extensions, unknown),
        fromActorId: explicitOrAlias(
            options.fromActorId,
            source,
            'fromActorId',
            issues,
            aliases,
        ),
        toActorId: explicitOrAlias(
            options.toActorId,
            source,
            'toActorId',
            issues,
            aliases,
        ),
        voluntary: {
            ...(isPlainObject(nestedVoluntary) ? nestedVoluntary : {}),
            ...mapped.voluntary,
        },
        coercive: {
            ...(isPlainObject(nestedCoercive) ? nestedCoercive : {}),
            ...mapped.coercive,
            sourceIds: options.sourceIds
                ?? (isPlainObject(nestedCoercive) ? nestedCoercive.sourceIds : [])
                ?? [],
        },
        labels: explicitOrAlias(options.labels, source, 'labels', issues, aliases) ?? [],
        evidence: explicitOrAlias(options.evidence, source, 'evidence', issues, aliases) ?? [],
        branchId: explicitOrAlias(options.branchId, source, 'branchId', issues, aliases),
    });
    const validated = validateSocialState(value);
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, value.id),
        legacyProjection: source,
    });
}

export function adaptLegacyQuest(source, options = {}) {
    const issues = [];
    if (!requireLegacyObject(source, issues, options)) {
        return migrationResult(normalizeQuest({}), issues, {
            sourceRefs: sourceRefsFor(options),
        });
    }
    const aliases = options.aliases ?? {};
    const rawStatus = explicitOrAlias(options.status, source, 'status', issues, aliases);
    let status = QUEST_STATUSES.includes(rawStatus)
        ? rawStatus
        : options.statusMap?.[rawStatus];
    if (!QUEST_STATUSES.includes(status)) {
        addIssue(
            issues,
            'migration.quest_status_unresolved',
            '$.status',
            '旧任务状态没有唯一映射，不能猜测是否已终态。',
            'unresolved',
            { sourceValue: rawStatus },
        );
        status = undefined;
    }
    const ended = options.ended ?? source.ended ?? source.已结束;
    if (ended === true && ['active', 'proposed', 'suspended'].includes(status)) {
        addIssue(
            issues,
            'migration.quest_status_conflict',
            '$.status',
            '旧任务同时声明已结束与非终态，必须隔离并禁止重复结算。',
        );
    }
    const fields = [
        'id',
        'title',
        'status',
        'branchId',
        'objectives',
        'settlementTransactionIds',
        'supersededBy',
        'terminalEvidence',
    ];
    const value = normalizeQuest({
        ...baseRecord(source, fields, {
            id: explicitOrAlias(options.id, source, 'id', issues, aliases),
            revision: options.revision,
            aliases,
            extensions: options.extensions,
        }),
        title: explicitOrAlias(options.title, source, 'title', issues, aliases),
        status,
        branchId: explicitOrAlias(options.branchId, source, 'branchId', issues, aliases),
        objectives: explicitOrAlias(
            options.objectives,
            source,
            'objectives',
            issues,
            aliases,
        ) ?? [],
        settlementTransactionIds: explicitOrAlias(
            options.settlementTransactionIds,
            source,
            'settlementTransactionIds',
            issues,
            aliases,
        ) ?? [],
        ...(explicitOrAlias(
            options.supersededBy,
            source,
            'supersededBy',
            issues,
            aliases,
        ) === undefined ? {} : {
            supersededBy: explicitOrAlias(
                options.supersededBy,
                source,
                'supersededBy',
                issues,
                aliases,
            ),
        }),
        ...(explicitOrAlias(
            options.terminalEvidence,
            source,
            'terminalEvidence',
            issues,
            aliases,
        ) === undefined ? {} : {
            terminalEvidence: explicitOrAlias(
                options.terminalEvidence,
                source,
                'terminalEvidence',
                issues,
                aliases,
            ),
        }),
    });
    const validated = validateQuest(value);
    return migrationResult(value, combineIssues(issues, validated.issues), {
        sourceVersion: options.sourceVersion,
        sourceRefs: sourceRefsFor(options, value.id),
        quarantined: issues.some((issue) => issue.code === 'migration.quest_status_conflict'),
        legacyProjection: source,
    });
}

export function projectItemToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        name: record.name,
        kind: record.kind,
        quantity: record.quantity,
        stackable: record.stackable,
        description: record.description,
        ...(record.unit === undefined ? {} : { unit: record.unit }),
        ...(record.mechanics === undefined ? {} : { mechanics: deepClone(record.mechanics) }),
    });
}

export function projectEquipmentToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        itemId: record.itemId,
        allowedSlots: deepClone(record.allowedSlots),
        occupies: deepClone(record.occupies),
        ...(record.equippedAt === undefined ? {} : { equippedAt: deepClone(record.equippedAt) }),
        bonuses: deepClone(record.bonuses),
    });
}

export function projectSkillToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        name: record.name,
        mode: record.mode,
        costs: deepClone(record.costs),
        effects: deepClone(record.effects),
        ...(record.displayCost === undefined ? {} : { displayCost: record.displayCost }),
    });
}

export function projectFactToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        proposition: record.proposition,
        status: record.status,
        scope: record.scope,
        branchId: record.branchId,
        subjectIds: deepClone(record.subjectIds),
        evidence: deepClone(record.evidence),
        impact: record.impact,
    });
}

export function projectKnowledgeToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        knowerId: record.knowerId,
        factId: record.factId,
        state: record.state,
        acquiredBy: deepClone(record.acquiredBy),
        branchId: record.branchId,
        visibility: record.visibility,
    });
}

export function projectSocialStateToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        fromActorId: record.fromActorId,
        toActorId: record.toActorId,
        voluntary: deepClone(record.voluntary),
        coercive: deepClone(record.coercive),
        labels: deepClone(record.labels),
        evidence: deepClone(record.evidence),
        branchId: record.branchId,
    });
}

export function projectQuestToLegacy(record) {
    return restoreLegacyExtensions(record, {
        id: record.id,
        title: record.title,
        status: record.status,
        branchId: record.branchId,
        objectives: deepClone(record.objectives),
        settlementTransactionIds: deepClone(record.settlementTransactionIds),
        ...(record.supersededBy === undefined ? {} : { supersededBy: record.supersededBy }),
        ...(record.terminalEvidence === undefined
            ? {}
            : { terminalEvidence: deepClone(record.terminalEvidence) }),
    });
}
