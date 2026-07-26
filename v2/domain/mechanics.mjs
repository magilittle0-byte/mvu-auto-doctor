import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEffects,
    normalizeEvidenceList,
    normalizeMigrationState,
    normalizeResourceRef,
    normalizeV2Base,
    requireBoolean,
    requireEnum,
    requireFiniteNumber,
    requirePlainObject,
    requireString,
    validateEffects,
    validateEvidenceList,
    validateMigrationState,
    validateResourceRef,
    validateV2Base,
    validationResult,
} from './common.mjs';

export const ITEM_KINDS = Object.freeze([
    'material',
    'consumable',
    'quest',
    'equipment',
    'container',
    'misc',
]);

export const SKILL_MODES = Object.freeze([
    'active',
    'passive',
    'reaction',
    'toggle',
]);

export const SKILL_COST_TIMINGS = Object.freeze([
    'on-start',
    'on-success',
    'per-tick',
    'on-complete',
]);

export const HANDEDNESS_VALUES = Object.freeze([
    'none',
    'one-hand',
    'two-hand',
    'either',
]);

const ITEM_KEYS = Object.freeze([
    'name',
    'kind',
    'quantity',
    'stackable',
    'description',
    'unit',
    'mechanics',
    'provenance',
    'migration',
]);

const EQUIPMENT_KEYS = Object.freeze([
    'itemId',
    'allowedSlots',
    'occupies',
    'equippedAt',
    'handedness',
    'bonuses',
    'requirements',
    'provenance',
    'migration',
]);

const SKILL_KEYS = Object.freeze([
    'name',
    'mode',
    'costs',
    'effects',
    'resolution',
    'displayCost',
    'provenance',
    'migration',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeMechanics(value) {
    if (!isPlainObject(value)) return value;
    const result = deepClone(value);
    if (Object.hasOwn(value, 'use')) {
        if (isPlainObject(value.use)) {
            result.use = {
                ...deepClone(value.use),
                consumes: value.use.consumes,
                effects: normalizeEffects(value.use.effects),
            };
        } else {
            result.use = value.use;
        }
    }
    if (Object.hasOwn(value, 'passiveEffects')) {
        result.passiveEffects = normalizeEffects(value.passiveEffects);
    }
    return result;
}

export function normalizeItemV2(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, ITEM_KEYS),
        name: trimString(source.name),
        kind: trimString(source.kind),
        quantity: source.quantity,
        stackable: source.stackable,
        description: trimString(source.description),
        ...(Object.hasOwn(source, 'unit') ? { unit: trimString(source.unit) } : {}),
        ...(Object.hasOwn(source, 'mechanics')
            ? { mechanics: normalizeMechanics(source.mechanics) }
            : {}),
        provenance: normalizeEvidenceList(source.provenance),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateItemV2(input, {
    mechanicalEffectClaimed = false,
    discrete = undefined,
} = {}) {
    const value = normalizeItemV2(input);
    const issues = [];
    validateV2Base(value, issues, ITEM_KEYS);
    requireString(value.name, issues, '$.name', { code: 'item.name' });
    requireEnum(value.kind, ITEM_KINDS, issues, '$.kind', 'item.kind');
    requireFiniteNumber(value.quantity, issues, '$.quantity', {
        minimum: 0,
        integer: discrete ?? value.unit === undefined,
        code: 'item.quantity',
    });
    requireBoolean(value.stackable, issues, '$.stackable', 'item.stackable');
    requireString(value.description, issues, '$.description', {
        allowEmpty: true,
        code: 'item.description',
    });
    if (value.unit !== undefined) {
        requireString(value.unit, issues, '$.unit', { code: 'item.unit' });
    }

    if (value.mechanics !== undefined) {
        if (requirePlainObject(value.mechanics, issues, '$.mechanics')) {
            if (value.mechanics.use !== undefined) {
                if (requirePlainObject(value.mechanics.use, issues, '$.mechanics.use')) {
                    if (value.mechanics.use.consumes === undefined) {
                        addIssue(
                            issues,
                            'item.unresolved_consumption',
                            '$.mechanics.use.consumes',
                            '消耗数量缺失，不能猜测或先扣除物品。',
                            'unresolved',
                        );
                    } else {
                        requireFiniteNumber(
                            value.mechanics.use.consumes,
                            issues,
                            '$.mechanics.use.consumes',
                            {
                                minimum: 0,
                                code: 'item.use.consumes',
                            },
                        );
                    }
                    validateEffects(
                        value.mechanics.use.effects,
                        issues,
                        '$.mechanics.use.effects',
                    );
                }
            }
            if (value.mechanics.passiveEffects !== undefined) {
                validateEffects(
                    value.mechanics.passiveEffects,
                    issues,
                    '$.mechanics.passiveEffects',
                );
            }
        }
    }

    if (value.kind === 'consumable' && mechanicalEffectClaimed) {
        const effects = value.mechanics?.use?.effects;
        if (!Array.isArray(effects) || effects.length === 0) {
            addIssue(
                issues,
                'item.missing_typed_effect',
                '$.mechanics.use.effects',
                '消耗品声明了机械效果，但没有机器可读效果；必须保持未解析且禁止自动结算。',
                'unresolved',
            );
        }
        if (!isPlainObject(value.mechanics?.use)) {
            addIssue(
                issues,
                'item.unresolved_consumption',
                '$.mechanics.use.consumes',
                '消耗数量没有无歧义的有限数值，不能猜测或先扣除物品。',
                'unresolved',
            );
        }
    }

    validateEvidenceList(value.provenance, issues, '$.provenance');
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}

export function normalizeSlotRef(value) {
    if (!isPlainObject(value)) return value;
    return {
        ...deepClone(value),
        system: trimString(value.system),
        slot: trimString(value.slot),
        ...(Object.hasOwn(value, 'layer') ? { layer: trimString(value.layer) } : {}),
    };
}

export function validateSlotRef(value, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    requireString(value.system, issues, `${path}.system`, {
        code: 'equipment.slot.system',
    });
    requireString(value.slot, issues, `${path}.slot`, {
        code: 'equipment.slot.name',
    });
    if (value.layer !== undefined) {
        requireString(value.layer, issues, `${path}.layer`, {
            code: 'equipment.slot.layer',
        });
    }
}

function normalizeSlotList(value) {
    return Array.isArray(value) ? value.map(normalizeSlotRef) : [];
}

function slotAccepts(allowed, actual) {
    if (!isPlainObject(allowed) || !isPlainObject(actual)) return false;
    return (
        allowed.system === actual.system
        && allowed.slot === actual.slot
        && (allowed.layer === undefined || allowed.layer === actual.layer)
    );
}

function slotEquals(left, right) {
    return (
        isPlainObject(left)
        && isPlainObject(right)
        && left.system === right.system
        && left.slot === right.slot
        && left.layer === right.layer
    );
}

function validateSlotList(value, issues, path) {
    if (!Array.isArray(value)) {
        addIssue(issues, 'equipment.slot_list.type', path, '槽位字段必须是 SlotRef 数组。');
        return;
    }
    value.forEach((slot, index) => validateSlotRef(slot, issues, `${path}[${index}]`));
}

export function normalizeEquipmentV2(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, EQUIPMENT_KEYS),
        itemId: trimString(source.itemId),
        allowedSlots: normalizeSlotList(source.allowedSlots),
        occupies: normalizeSlotList(source.occupies),
        ...(Object.hasOwn(source, 'equippedAt')
            ? { equippedAt: normalizeSlotList(source.equippedAt) }
            : {}),
        ...(Object.hasOwn(source, 'handedness')
            ? { handedness: trimString(source.handedness) }
            : {}),
        bonuses: normalizeEffects(source.bonuses),
        ...(Object.hasOwn(source, 'requirements')
            ? { requirements: deepClone(source.requirements) }
            : {}),
        provenance: normalizeEvidenceList(source.provenance),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateEquipmentV2(input) {
    const value = normalizeEquipmentV2(input);
    const issues = [];
    validateV2Base(value, issues, EQUIPMENT_KEYS);
    requireString(value.itemId, issues, '$.itemId', { code: 'equipment.item_id' });
    validateSlotList(value.allowedSlots, issues, '$.allowedSlots');
    validateSlotList(value.occupies, issues, '$.occupies');
    if (value.equippedAt !== undefined) {
        validateSlotList(value.equippedAt, issues, '$.equippedAt');
    }
    if (value.handedness !== undefined) {
        requireEnum(
            value.handedness,
            HANDEDNESS_VALUES,
            issues,
            '$.handedness',
            'equipment.handedness',
        );
    }
    validateEffects(value.bonuses, issues, '$.bonuses');
    if (value.requirements !== undefined) {
        requirePlainObject(value.requirements, issues, '$.requirements');
    }
    validateEvidenceList(value.provenance, issues, '$.provenance');
    validateMigrationState(value.migration, issues);

    if (Array.isArray(value.equippedAt) && value.equippedAt.length) {
        if (!value.allowedSlots.length) {
            addIssue(
                issues,
                'equipment.allowed_slots_unresolved',
                '$.allowedSlots',
                '只有当前穿戴位置，没有物品允许槽位元数据；不能据此猜测未来可装备槽位。',
                'unresolved',
            );
        } else {
            value.equippedAt.forEach((actual, index) => {
                if (!value.allowedSlots.some((allowed) => slotAccepts(allowed, actual))) {
                    addIssue(
                        issues,
                        'equipment.slot_mismatch',
                        `$.equippedAt[${index}]`,
                        '当前装备位置不被物品的 allowedSlots 合同接受。',
                        'error',
                        { actual: deepClone(actual), allowedSlots: deepClone(value.allowedSlots) },
                    );
                }
            });
        }
        value.occupies.forEach((occupied, index) => {
            if (!value.equippedAt.some((actual) => slotEquals(actual, occupied))) {
                addIssue(
                    issues,
                    'equipment.composite_occupancy_missing',
                    `$.occupies[${index}]`,
                    '复合占位没有在 equippedAt 中完整体现。',
                );
            }
        });
    }

    return validationResult(value, issues);
}

export function normalizeSkillCost(value) {
    if (!isPlainObject(value)) return value;
    return {
        ...deepClone(value),
        resource: normalizeResourceRef(value.resource),
        amount: value.amount,
        timing: trimString(value.timing),
        refundable: value.refundable,
    };
}

export function validateSkillCost(value, issues, path) {
    if (!requirePlainObject(value, issues, path)) return;
    validateResourceRef(value.resource, issues, `${path}.resource`);
    requireFiniteNumber(value.amount, issues, `${path}.amount`, {
        minimum: 0,
        code: 'skill.cost.amount',
    });
    requireEnum(
        value.timing,
        SKILL_COST_TIMINGS,
        issues,
        `${path}.timing`,
        'skill.cost.timing',
    );
    requireBoolean(
        value.refundable,
        issues,
        `${path}.refundable`,
        'skill.cost.refundable',
    );
}

function normalizeResolution(value) {
    if (!isPlainObject(value)) return value;
    return {
        ...deepClone(value),
        ...(Object.hasOwn(value, 'checkId') ? { checkId: trimString(value.checkId) } : {}),
        ...(Object.hasOwn(value, 'target') ? { target: trimString(value.target) } : {}),
        ...(Object.hasOwn(value, 'cooldown') ? { cooldown: value.cooldown } : {}),
    };
}

export function normalizeSkillV2(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        ...normalizeV2Base(source, SKILL_KEYS),
        name: trimString(source.name),
        mode: trimString(source.mode),
        costs: Array.isArray(source.costs) ? source.costs.map(normalizeSkillCost) : [],
        effects: normalizeEffects(source.effects),
        ...(Object.hasOwn(source, 'resolution')
            ? { resolution: normalizeResolution(source.resolution) }
            : {}),
        ...(Object.hasOwn(source, 'displayCost')
            ? { displayCost: trimString(source.displayCost) }
            : {}),
        provenance: normalizeEvidenceList(source.provenance),
        ...(Object.hasOwn(source, 'migration')
            ? { migration: normalizeMigrationState(source.migration) }
            : {}),
    };
}

export function validateSkillV2(input) {
    const value = normalizeSkillV2(input);
    const issues = [];
    validateV2Base(value, issues, SKILL_KEYS);
    requireString(value.name, issues, '$.name', { code: 'skill.name' });
    requireEnum(value.mode, SKILL_MODES, issues, '$.mode', 'skill.mode');
    if (!Array.isArray(value.costs)) {
        addIssue(issues, 'skill.costs.type', '$.costs', 'costs 必须是 SkillCost 数组。');
    } else {
        value.costs.forEach((cost, index) => {
            validateSkillCost(cost, issues, `$.costs[${index}]`);
        });
    }
    validateEffects(value.effects, issues, '$.effects');
    if (value.resolution !== undefined) {
        if (requirePlainObject(value.resolution, issues, '$.resolution')) {
            if (value.resolution.checkId !== undefined) {
                requireString(value.resolution.checkId, issues, '$.resolution.checkId');
            }
            if (value.resolution.target !== undefined) {
                requireString(value.resolution.target, issues, '$.resolution.target');
            }
            if (value.resolution.cooldown !== undefined) {
                requireFiniteNumber(
                    value.resolution.cooldown,
                    issues,
                    '$.resolution.cooldown',
                    { minimum: 0, code: 'skill.resolution.cooldown' },
                );
            }
        }
    }
    if (value.displayCost !== undefined) {
        requireString(value.displayCost, issues, '$.displayCost', {
            allowEmpty: true,
            code: 'skill.display_cost',
        });
    }
    if (
        value.mode === 'active'
        && typeof value.displayCost === 'string'
        && value.displayCost.trim()
        && value.costs.length === 0
    ) {
        addIssue(
            issues,
            'skill.unresolved_cost',
            '$.costs',
            '主动技能只有展示成本文本，没有唯一的类型化资源成本；禁止直接扣除资源。',
            'unresolved',
        );
    }
    validateEvidenceList(value.provenance, issues, '$.provenance');
    validateMigrationState(value.migration, issues);
    return validationResult(value, issues);
}
