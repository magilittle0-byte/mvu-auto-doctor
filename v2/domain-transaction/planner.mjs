import {
    addIssue,
    adjudicateSocialTransition,
    deepClone,
    isPlainObject,
    normalizeEvidenceList,
    normalizeFact,
    normalizeQuest,
    normalizeSocialState,
    validateEquipmentV2,
    validateFact,
    validateItemV2,
    validateQuest,
    validateQuestTransition,
    validateSkillV2,
    validateSocialState,
    validationResult,
} from '../domain/index.mjs';
import { transitionFact } from '../director/index.mjs';
import {
    createIdempotencyKey,
    createTransaction,
    createTransactionId,
    hashCanonical,
    validatePathMutations,
} from '../transaction/index.mjs';
import {
    resourceKey,
    slotKey,
    validateCampaignDomainConfig,
} from './config.mjs';

function blocking(issues) {
    return issues.some((issue) => ['error', 'unresolved'].includes(issue.severity));
}

function valuesEqual(left, right) {
    try {
        return hashCanonical(left) === hashCanonical(right);
    } catch {
        return false;
    }
}

function escapePointerSegment(value) {
    return String(value).replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function stableCommandPayload(payload) {
    if (!isPlainObject(payload)) return payload;
    return Object.fromEntries(
        Object.entries(payload)
            .filter(([, value]) => value !== undefined)
            .filter(([key]) => ![
                'target',
                'sourceTarget',
                'branchId',
                'parentBranchId',
                'authorizationId',
            ].includes(key))
            .map(([key, value]) => [
                key,
                Array.isArray(value)
                    ? value.map((entry) => stableCommandPayload(entry))
                    : isPlainObject(value)
                        ? stableCommandPayload(value)
                        : deepClone(value),
            ]),
    );
}

function primarySubject(command) {
    const payload = command?.payload ?? {};
    return [
        payload.itemId,
        payload.skillId,
        payload.socialId,
        payload.questId,
        payload.replacementQuestId,
        payload.factId,
        payload.claimId,
        payload.checkId,
        payload.resource?.ownerId,
        payload.resource?.resourceId,
    ].filter(Boolean).map(String).sort().join('|');
}

function transactionKind(commandType) {
    if (commandType === 'item-use') return 'inventory';
    if (commandType.startsWith('equipment-')) return 'equipment';
    if (commandType === 'skill-use') return 'skill';
    if (commandType === 'social-transition') return 'social';
    if (commandType.startsWith('quest-')) return 'quest';
    if (['cost', 'check'].includes(commandType)) return 'compound';
    if (commandType.startsWith('fact-')) return 'compound';
    return 'compound';
}

function effectKey(prefix, index) {
    return `${prefix}:${index}`;
}

function normalizeSlot(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        system: typeof source.system === 'string' ? source.system.trim() : source.system,
        slot: typeof source.slot === 'string' ? source.slot.trim() : source.slot,
        ...(Object.hasOwn(source, 'layer') ? {
            layer: typeof source.layer === 'string'
                ? source.layer.trim()
                : source.layer,
        } : {}),
    };
}

function recordState(state, key) {
    return isPlainObject(state?.records?.[key]) ? state.records[key] : null;
}

function plannerContext(input, validatedCommand, campaign) {
    const issues = [];
    const mutations = [];
    const preconditions = [];
    const effects = [];
    const domainResults = [];
    const diagnostics = [];
    const resourceDeltas = new Map();
    const command = validatedCommand.value.command;
    const target = validatedCommand.value.target;
    const branch = validatedCommand.value.activeBranch;
    const state = isPlainObject(input.state) ? deepClone(input.state) : {};

    function collect(result, label) {
        if (!result || !Array.isArray(result.issues)) {
            addIssue(
                issues,
                'domain.validation_result_missing',
                `$.domain.${label}`,
                '领域计划必须携带阶段1 ValidationResult。',
            );
            return result;
        }
        domainResults.push(result);
        issues.push(...result.issues);
        diagnostics.push({
            label,
            status: result.status,
            issues: deepClone(result.issues),
        });
        return result;
    }

    function configuredRecord(kind, id, stateKey = kind) {
        const entry = recordState(state, stateKey);
        const configuredPath = campaign.value.records?.[kind]?.[id];
        if (!entry) {
            addIssue(
                issues,
                'domain.record_state_missing',
                `$.state.records.${stateKey}`,
                `缺少 ${kind} 的阶段1前后值。`,
                'unresolved',
            );
            return null;
        }
        if (!configuredPath) {
            addIssue(
                issues,
                'domain.record_binding_missing',
                `$.campaign.records.${kind}.${escapePointerSegment(id)}`,
                `战役配置没有为 ${kind}/${id} 注册精确路径。`,
                'unresolved',
            );
            return null;
        }
        if (entry.path !== configuredPath) {
            addIssue(
                issues,
                'domain.record_path_mismatch',
                `$.state.records.${stateKey}.path`,
                '阶段1记录路径与战役注册表不一致。',
            );
            return null;
        }
        for (const [field, record] of [
            ['before', entry.before],
            ['candidate', entry.candidate],
            ['after', entry.after],
        ]) {
            if (
                isPlainObject(record)
                && record.id !== undefined
                && record.id !== id
            ) {
                addIssue(
                    issues,
                    'domain.record_id_mismatch',
                    `$.state.records.${stateKey}.${field}.id`,
                    '领域记录ID必须与命令主体及战役路径注册表一致。',
                );
            }
        }
        return {
            ...entry,
            path: configuredPath,
            found: entry.found !== false,
        };
    }

    function addMutation({
        path,
        before,
        found = true,
        after,
        effect,
    }) {
        if (mutations.some((entry) => entry.path === path)) {
            addIssue(
                issues,
                'domain.duplicate_effect_path',
                path,
                '复合领域事务不能重复写同一路径。',
            );
            return;
        }
        mutations.push({ operation: 'set', path, value: deepClone(after) });
        preconditions.push(found
            ? { type: 'path-equals', path, value: deepClone(before) }
            : { type: 'path-absent', path });
        if (effect) effects.push(deepClone(effect));
    }

    function configuredResource(ref) {
        const key = resourceKey(ref);
        const config = campaign.value.resources.find(
            (entry) => resourceKey(entry.resource) === key,
        );
        const current = Array.isArray(state.resources)
            ? state.resources.find((entry) => resourceKey(entry?.resource) === key)
            : null;
        if (!config) {
            addIssue(
                issues,
                'domain.resource_unregistered',
                '$.campaign.resources',
                `资源 ${ref?.ownerId}/${ref?.resourceId} 没有显式战役绑定。`,
                'unresolved',
            );
            return null;
        }
        if (!current) {
            addIssue(
                issues,
                'domain.resource_state_missing',
                '$.state.resources',
                `缺少资源 ${ref?.ownerId}/${ref?.resourceId} 的阶段1前值。`,
                'unresolved',
            );
            return null;
        }
        if (current.path !== config.path) {
            addIssue(
                issues,
                'domain.resource_path_mismatch',
                '$.state.resources',
                '资源前值路径与战役注册表不一致。',
            );
            return null;
        }
        if (typeof current.before !== 'number' || !Number.isFinite(current.before)) {
            addIssue(
                issues,
                'domain.resource_before_invalid',
                current.path,
                '资源前值必须是有限数字，不能从文本猜测。',
            );
            return null;
        }
        return { key, config, current };
    }

    function addResourceDelta(ref, amount, reason) {
        if (typeof amount !== 'number' || !Number.isFinite(amount)) {
            addIssue(
                issues,
                'domain.resource_delta_invalid',
                '$.effects',
                '资源变化必须是有限数字。',
            );
            return;
        }
        const resolved = configuredResource(ref);
        if (!resolved) return;
        const prior = resourceDeltas.get(resolved.key) ?? {
            ...resolved,
            amount: 0,
            reasons: [],
        };
        prior.amount += amount;
        prior.reasons.push(String(reason || command.type));
        resourceDeltas.set(resolved.key, prior);
        effects.push({
            type: 'resource-delta',
            delta: {
                resource: deepClone(ref),
                amount,
                reason: String(reason || command.type),
            },
        });
    }

    function addExplicitEffect(effect, key) {
        const configuredPath = campaign.value.effectBindings?.[key];
        const current = Array.isArray(state.effectValues)
            ? state.effectValues.find((entry) => entry?.key === key)
            : null;
        if (!configuredPath || !current) {
            addIssue(
                issues,
                'domain.effect_binding_unresolved',
                `$.campaign.effectBindings.${escapePointerSegment(key)}`,
                '非资源效果必须提供显式写入路径以及领域前后值。',
                'unresolved',
                { effect: deepClone(effect) },
            );
            return;
        }
        if (
            current.path !== configuredPath
            || !Object.hasOwn(current, 'before')
            || !Object.hasOwn(current, 'after')
        ) {
            addIssue(
                issues,
                'domain.effect_state_invalid',
                '$.state.effectValues',
                '扩展效果的路径、前值和后值必须全部显式给出。',
            );
            return;
        }
        addMutation({
            path: configuredPath,
            before: current.before,
            found: current.found !== false,
            after: current.after,
            effect: {
                type: 'custom',
                adapterId: 'phase4.explicit-effect',
                payload: { key, effect: deepClone(effect) },
            },
        });
    }

    function applyEffects(list, prefix) {
        if (!Array.isArray(list)) {
            addIssue(
                issues,
                'domain.effects_missing',
                '$.effects',
                '领域效果必须是数组。',
            );
            return;
        }
        list.forEach((effect, index) => {
            if (effect?.type === 'resource-delta') {
                addResourceDelta(
                    effect.delta?.resource,
                    effect.delta?.amount,
                    effect.delta?.reason,
                );
            } else {
                addExplicitEffect(effect, effectKey(prefix, index));
            }
        });
    }

    function flushResources() {
        for (const entry of resourceDeltas.values()) {
            const after = entry.current.before + entry.amount;
            if (after < entry.config.minimum) {
                addIssue(
                    issues,
                    'domain.resource_insufficient',
                    entry.config.path,
                    '资源不足，复合事务不得部分扣除。',
                    'error',
                    {
                        before: entry.current.before,
                        delta: entry.amount,
                        minimum: entry.config.minimum,
                    },
                );
            }
            if (
                entry.config.maximum !== undefined
                && after > entry.config.maximum
            ) {
                addIssue(
                    issues,
                    'domain.resource_above_maximum',
                    entry.config.path,
                    '资源变化超过显式最大值。',
                );
            }
            const result = validationResult({
                resource: deepClone(entry.config.resource),
                before: entry.current.before,
                after,
                path: entry.config.path,
            }, issues.filter((issue) => issue.path === entry.config.path));
            collect(result, `resource:${entry.config.resource.ownerId}/${entry.config.resource.resourceId}`);
            addMutation({
                path: entry.config.path,
                before: entry.current.before,
                after,
            });
        }
    }

    return {
        input,
        command,
        target,
        branch,
        state,
        issues,
        mutations,
        preconditions,
        effects,
        domainResults,
        diagnostics,
        collect,
        configuredRecord,
        addMutation,
        addResourceDelta,
        addExplicitEffect,
        applyEffects,
        flushResources,
    };
}

function requirePositive(value, ctx, path, code, message) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        addIssue(ctx.issues, code, path, message);
        return false;
    }
    return true;
}

function buildItemUse(ctx) {
    const id = ctx.command.payload.itemId;
    const entry = ctx.configuredRecord('item', id);
    if (!entry) return;
    const item = ctx.collect(validateItemV2(entry.before, {
        mechanicalEffectClaimed: true,
    }), 'item:before');
    const consumes = item?.value?.mechanics?.use?.consumes;
    requirePositive(
        consumes,
        ctx,
        '$.state.records.item.before.mechanics.use.consumes',
        'domain.item_consumption_invalid',
        '物品消耗数量必须是正的有限数字。',
    );
    if (
        typeof item?.value?.quantity === 'number'
        && typeof consumes === 'number'
        && item.value.quantity < consumes
    ) {
        addIssue(
            ctx.issues,
            'domain.item_quantity_insufficient',
            '$.state.records.item.before.quantity',
            '物品数量不足；不得先扣物品再尝试效果。',
        );
    }
    if (blocking(ctx.issues)) return;
    const after = {
        ...deepClone(item.value),
        revision: item.value.revision + 1,
        quantity: item.value.quantity - consumes,
    };
    const afterResult = ctx.collect(validateItemV2(after, {
        mechanicalEffectClaimed: true,
    }), 'item:after');
    ctx.addMutation({
        path: entry.path,
        before: entry.before,
        after: afterResult.value,
        effect: {
            type: 'custom',
            adapterId: 'phase4.item-use',
            payload: {
                itemId: id,
                consumes,
                path: entry.path,
            },
        },
    });
    ctx.applyEffects(item.value.mechanics.use.effects, `item:${id}`);
}

function findStateSlot(ctx, slot) {
    const key = slotKey(slot);
    const configured = ctx.campaign.value.slotBindings.find(
        (entry) => slotKey(entry.slot) === key,
    );
    const current = Array.isArray(ctx.state.slots)
        ? ctx.state.slots.find((entry) => slotKey(entry?.slot) === key)
        : null;
    if (!ctx.campaign.value.slotTaxonomy.some((entry) => slotKey(entry) === key)) {
        addIssue(
            ctx.issues,
            'domain.slot_unregistered',
            '$.command.payload.slots',
            '命令槽位没有出现在显式战役槽位表中。',
            'unresolved',
        );
        return null;
    }
    if (!configured || !current) {
        addIssue(
            ctx.issues,
            'domain.slot_state_unresolved',
            '$.state.slots',
            '装备事务需要每个来源/目标槽位的显式路径与前值。',
            'unresolved',
        );
        return null;
    }
    if (configured.path !== current.path) {
        addIssue(
            ctx.issues,
            'domain.slot_path_mismatch',
            '$.state.slots',
            '槽位前值路径与战役注册表不一致。',
        );
        return null;
    }
    return { configured, current };
}

function slotSet(slots) {
    return new Set((slots ?? []).map(slotKey));
}

function equipmentEffects(record, operation) {
    if (operation === 'equipment-transfer') return [];
    if (operation !== 'equipment-unequip') return record.bonuses ?? [];
    return (record.bonuses ?? []).map((effect) => {
        if (effect.type === 'resource-delta') {
            return {
                ...deepClone(effect),
                delta: {
                    ...deepClone(effect.delta),
                    amount: -effect.delta.amount,
                    reason: `remove:${effect.delta.reason}`,
                },
            };
        }
        if (effect.type === 'status') {
            return {
                ...deepClone(effect),
                operation: effect.operation === 'add' ? 'remove' : 'add',
            };
        }
        return deepClone(effect);
    });
}

function buildEquipment(ctx) {
    const payload = ctx.command.payload;
    const equipmentEntry = ctx.configuredRecord('equipment', payload.equipmentId);
    if (!equipmentEntry) return;
    const beforeResult = ctx.collect(
        validateEquipmentV2(equipmentEntry.before),
        'equipment:before',
    );
    if (beforeResult.value.itemId !== payload.itemId) {
        addIssue(
            ctx.issues,
            'domain.equipment_item_mismatch',
            '$.command.payload.itemId',
            'EquipmentV2.itemId 与命令物品不一致。',
        );
    }
    const beforeSlots = beforeResult.value.equippedAt ?? [];
    if (
        ctx.command.type === 'equipment-equip'
        && beforeSlots.length > 0
    ) {
        addIssue(
            ctx.issues,
            'domain.equipment_already_equipped',
            '$.state.records.equipment.before.equippedAt',
            '已穿戴装备必须使用显式 transfer，不能再次扣减背包或重复应用加成。',
        );
    }
    if (
        ['equipment-unequip', 'equipment-transfer'].includes(ctx.command.type)
        && beforeSlots.length === 0
    ) {
        addIssue(
            ctx.issues,
            'domain.equipment_not_equipped',
            '$.state.records.equipment.before.equippedAt',
            '卸下或转移装备必须提供当前已占用槽位，不能猜测来源。',
        );
    }
    const targetSlots = ctx.command.type === 'equipment-unequip'
        ? []
        : Array.isArray(payload.slots)
            ? payload.slots.map(normalizeSlot)
            : [];
    if (
        ctx.command.type !== 'equipment-unequip'
        && targetSlots.length === 0
    ) {
        addIssue(
            ctx.issues,
            'domain.equipment_slots_missing',
            '$.command.payload.slots',
            '穿戴或转移必须显式给出全部 equippedAt/occupies 槽位。',
            'unresolved',
        );
    }
    const afterRecord = {
        ...deepClone(beforeResult.value),
        revision: beforeResult.value.revision + 1,
        equippedAt: targetSlots,
    };
    const afterResult = ctx.collect(
        validateEquipmentV2(afterRecord),
        'equipment:after',
    );
    const targetSet = slotSet(targetSlots);
    const beforeSet = slotSet(beforeSlots);

    for (const slot of beforeSlots) {
        if (targetSet.has(slotKey(slot))) continue;
        const resolved = findStateSlot(ctx, slot);
        if (!resolved) continue;
        if (resolved.current.before !== payload.itemId) {
            addIssue(
                ctx.issues,
                'domain.equipment_source_occupant',
                resolved.configured.path,
                '来源槽位前值不是当前装备，禁止猜测转移。',
            );
            continue;
        }
        ctx.addMutation({
            path: resolved.configured.path,
            before: resolved.current.before,
            after: null,
            effect: {
                type: 'custom',
                adapterId: 'phase4.equipment-slot',
                payload: { slot: deepClone(slot), occupantItemId: null },
            },
        });
    }
    for (const slot of targetSlots) {
        if (beforeSet.has(slotKey(slot))) continue;
        const resolved = findStateSlot(ctx, slot);
        if (!resolved) continue;
        if (
            resolved.current.before !== null
            && resolved.current.before !== undefined
            && resolved.current.before !== payload.itemId
        ) {
            addIssue(
                ctx.issues,
                'domain.equipment_target_occupied',
                resolved.configured.path,
                '目标槽位已有其他装备；不得部分穿戴。',
            );
            continue;
        }
        ctx.addMutation({
            path: resolved.configured.path,
            before: resolved.current.before,
            after: payload.itemId,
            effect: {
                type: 'custom',
                adapterId: 'phase4.equipment-slot',
                payload: { slot: deepClone(slot), occupantItemId: payload.itemId },
            },
        });
    }
    ctx.addMutation({
        path: equipmentEntry.path,
        before: equipmentEntry.before,
        after: afterResult.value,
        effect: {
            type: 'custom',
            adapterId: `phase4.${ctx.command.type}`,
            payload: {
                equipmentId: payload.equipmentId,
                itemId: payload.itemId,
                from: deepClone(beforeSlots),
                to: deepClone(targetSlots),
            },
        },
    });

    if (ctx.command.type !== 'equipment-transfer') {
        const itemEntry = ctx.configuredRecord('item', payload.itemId);
        if (itemEntry) {
            const beforeItem = ctx.collect(
                validateItemV2(itemEntry.before),
                'equipment-item:before',
            );
            if (beforeItem.value.kind !== 'equipment') {
                addIssue(
                    ctx.issues,
                    'domain.equipment_item_kind',
                    '$.state.records.item.before.kind',
                    '穿戴对象必须是 kind=equipment 的 ItemV2。',
                );
            }
            const delta = ctx.command.type === 'equipment-equip' ? -1 : 1;
            if (beforeItem.value.quantity + delta < 0) {
                addIssue(
                    ctx.issues,
                    'domain.equipment_inventory_insufficient',
                    '$.state.records.item.before.quantity',
                    '背包数量不足，不能先占槽位。',
                );
            }
            const afterItem = {
                ...deepClone(beforeItem.value),
                revision: beforeItem.value.revision + 1,
                quantity: beforeItem.value.quantity + delta,
            };
            const afterItemResult = ctx.collect(
                validateItemV2(afterItem),
                'equipment-item:after',
            );
            ctx.addMutation({
                path: itemEntry.path,
                before: itemEntry.before,
                after: afterItemResult.value,
                effect: {
                    type: 'custom',
                    adapterId: 'phase4.inventory-equipment-transfer',
                    payload: { itemId: payload.itemId, quantityDelta: delta },
                },
            });
        }
    }
    ctx.applyEffects(
        equipmentEffects(beforeResult.value, ctx.command.type),
        `equipment:${payload.equipmentId}:${ctx.command.type}`,
    );
}

function buildSkillUse(ctx) {
    const payload = ctx.command.payload;
    const entry = ctx.configuredRecord('skill', payload.skillId);
    if (!entry) return;
    const skill = ctx.collect(validateSkillV2(entry.before), 'skill:before');
    if (skill.value.mode !== 'active') {
        addIssue(
            ctx.issues,
            'domain.skill_not_active',
            '$.state.records.skill.before.mode',
            '阶段4主动发动入口只接受 mode=active 的技能。',
        );
    }
    const timing = payload.timing;
    const costs = skill.value.costs.filter((cost) => cost.timing === timing);
    if (!['on-start', 'on-success', 'per-tick', 'on-complete'].includes(timing)) {
        addIssue(
            ctx.issues,
            'domain.skill_timing_missing',
            '$.command.payload.timing',
            '技能发动必须显式指定成本 timing。',
            'unresolved',
        );
    }
    if (skill.value.costs.length && !costs.length) {
        addIssue(
            ctx.issues,
            'domain.skill_timing_no_cost',
            '$.command.payload.timing',
            '当前 timing 没有可结算的类型化成本。',
            'unresolved',
        );
    }
    if (!skill.value.costs.length && !skill.value.effects.length) {
        addIssue(
            ctx.issues,
            'domain.skill_no_typed_ledger_effect',
            '$.state.records.skill.before',
            '主动技能没有类型化成本或效果，不能仅按展示文本结算。',
            'unresolved',
        );
    }
    costs.forEach((cost) => {
        ctx.addResourceDelta(
            cost.resource,
            -cost.amount,
            `skill:${payload.skillId}:${cost.timing}`,
        );
    });
    ctx.applyEffects(skill.value.effects, `skill:${payload.skillId}`);
}

function buildSocialTransition(ctx) {
    const payload = ctx.command.payload;
    const entry = ctx.configuredRecord('social', payload.socialId);
    if (!entry) return;
    const before = ctx.collect(
        validateSocialState(entry.before),
        'social:before',
    );
    const candidate = ctx.collect(
        validateSocialState(entry.candidate),
        'social:candidate',
    );
    if (
        before.value.branchId !== ctx.target.branchId
        || candidate.value.branchId !== ctx.target.branchId
    ) {
        addIssue(
            ctx.issues,
            'domain.social_branch_mismatch',
            '$.state.records.social',
            '社会关系前后值必须属于当前 active Branch。',
        );
    }
    const adjudicated = adjudicateSocialTransition(
        before.value,
        candidate.value,
        {
            voluntaryEvidence: payload.voluntaryEvidence ?? false,
            coerciveEvidence: payload.coerciveEvidence ?? false,
        },
    );
    let value = deepClone(adjudicated.value);
    const extraIssues = [...adjudicated.issues];
    const labelsChanged = !valuesEqual(before.value.labels, candidate.value.labels);
    if (labelsChanged && payload.labelEvidence !== true) {
        value.labels = deepClone(before.value.labels);
        addIssue(
            extraIssues,
            'social.labels_without_evidence',
            '$.labels',
            '普通善意或强制证据不能创建极端关系标签；标签恢复为本轮前值。',
            'warning',
        );
    }
    value.revision = before.value.revision + (valuesEqual(
        { ...before.value, revision: 0 },
        { ...value, revision: 0 },
    ) ? 0 : 1);
    const validatedValue = validateSocialState(value);
    const finalResult = ctx.collect(
        validationResult(
            validatedValue.value,
            [...extraIssues, ...validatedValue.issues],
            {
                decision: (
                    adjudicated.decision === 'revert'
                    || (labelsChanged && payload.labelEvidence !== true)
                ) ? 'revert' : adjudicated.decision,
                revertedPaths: [
                    ...adjudicated.revertedPaths,
                    ...(labelsChanged && payload.labelEvidence !== true
                        ? ['$.labels']
                        : []),
                ],
            },
        ),
        'social:adjudicated',
    );
    if (valuesEqual(finalResult.value, before.value)) {
        ctx.noop = {
            reason: '社会关系候选的无证据变化已全部回退。',
            decision: 'revert',
        };
        return;
    }
    ctx.addMutation({
        path: entry.path,
        before: entry.before,
        after: finalResult.value,
        effect: {
            type: 'custom',
            adapterId: 'phase4.social-transition',
            payload: {
                socialId: payload.socialId,
                decision: finalResult.decision,
                revertedPaths: finalResult.revertedPaths,
            },
        },
    });
}

function terminalStatus(status) {
    return ['completed', 'failed', 'cancelled', 'superseded'].includes(status);
}

function sameStringSet(left, right) {
    return (
        Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((entry) => right.includes(entry))
    );
}

function addQuestSettlementDeltas(ctx) {
    const deltas = ctx.command.payload.resourceDeltas ?? [];
    if (!Array.isArray(deltas)) {
        addIssue(
            ctx.issues,
            'domain.quest_resource_deltas',
            '$.command.payload.resourceDeltas',
            '任务结算资源必须是显式数组。',
        );
        return;
    }
    deltas.forEach((entry, index) => {
        if (!isPlainObject(entry?.resource)) {
            addIssue(
                ctx.issues,
                'domain.quest_resource_ref',
                `$.command.payload.resourceDeltas[${index}].resource`,
                '任务资源结算必须使用类型化 ResourceRef。',
            );
            return;
        }
        ctx.addResourceDelta(
            entry.resource,
            entry.amount,
            entry.reason ?? `quest:${ctx.command.payload.questId}`,
        );
    });
}

function buildQuestTransition(ctx, transactionId) {
    const payload = ctx.command.payload;
    const entry = ctx.configuredRecord('quest', payload.questId);
    if (!entry) return;
    const before = ctx.collect(validateQuest(entry.before), 'quest:before');
    const candidateValue = normalizeQuest(entry.candidate);
    if (
        candidateValue.branchId !== ctx.target.branchId
        || before.value.branchId !== ctx.target.branchId
    ) {
        addIssue(
            ctx.issues,
            'domain.quest_branch_mismatch',
            '$.state.records.quest',
            '任务前后值必须属于当前 active Branch。',
        );
    }
    const candidate = ctx.collect(
        validateQuestTransition(before.value, candidateValue),
        'quest:transition',
    );
    if (!terminalStatus(payload.terminalStatus)) {
        addIssue(
            ctx.issues,
            'domain.quest_terminal_status_required',
            '$.command.payload.terminalStatus',
            '阶段4任务结算入口必须显式指定 completed/failed/cancelled/superseded 终态。',
            payload.terminalStatus === undefined ? 'unresolved' : 'error',
        );
    }
    if (candidate.value.status !== payload.terminalStatus) {
        addIssue(
            ctx.issues,
            'domain.quest_terminal_status_mismatch',
            '$.command.payload.terminalStatus',
            '命令终态与阶段1任务后值不一致。',
        );
    }
    if (!sameStringSet(
        before.value.settlementTransactionIds,
        candidate.value.settlementTransactionIds,
    )) {
        addIssue(
            ctx.issues,
            'domain.quest_settlement_history_mismatch',
            '$.state.records.quest.candidate.settlementTransactionIds',
            '阶段1候选不得新增、删除或伪造任务结算事务ID。',
        );
    }
    if (terminalStatus(candidate.value.status)) {
        candidate.value.settlementTransactionIds = [
            ...before.value.settlementTransactionIds,
            transactionId,
        ];
    }
    candidate.value.revision = before.value.revision + 1;
    const final = ctx.collect(validateQuest(candidate.value), 'quest:after');
    ctx.addMutation({
        path: entry.path,
        before: entry.before,
        after: final.value,
        effect: {
            type: 'custom',
            adapterId: 'phase4.quest-transition',
            payload: {
                questId: payload.questId,
                status: final.value.status,
                settlementTransactionId: transactionId,
            },
        },
    });
    addQuestSettlementDeltas(ctx);
}

function buildQuestSupersede(ctx, transactionId) {
    const payload = ctx.command.payload;
    const entry = ctx.configuredRecord('quest', payload.questId);
    const replacement = ctx.configuredRecord(
        'quest',
        payload.replacementQuestId,
        'replacementQuest',
    );
    if (!entry || !replacement) return;
    const before = ctx.collect(validateQuest(entry.before), 'quest:before');
    if (!sameStringSet(
        before.value.settlementTransactionIds,
        entry.candidate?.settlementTransactionIds,
    )) {
        addIssue(
            ctx.issues,
            'domain.quest_settlement_history_mismatch',
            '$.state.records.quest.candidate.settlementTransactionIds',
            '替代候选必须完整保留既有任务结算事务ID。',
        );
    }
    const candidate = normalizeQuest({
        ...deepClone(entry.candidate),
        status: 'superseded',
        supersededBy: payload.replacementQuestId,
        revision: before.value.revision + 1,
        settlementTransactionIds: [
            ...before.value.settlementTransactionIds,
            transactionId,
        ],
    });
    const transition = ctx.collect(
        validateQuestTransition(before.value, candidate),
        'quest:superseded',
    );
    const replacementResult = ctx.collect(
        validateQuest(replacement.after),
        'quest:replacement',
    );
    if (
        transition.value.branchId !== ctx.target.branchId
        || replacementResult.value.branchId !== ctx.target.branchId
    ) {
        addIssue(
            ctx.issues,
            'domain.quest_branch_mismatch',
            '$.state.records',
            '原任务与替代任务必须属于当前 active Branch。',
        );
    }
    if (terminalStatus(replacementResult.value.status)) {
        addIssue(
            ctx.issues,
            'domain.quest_replacement_terminal',
            '$.state.records.replacementQuest.after.status',
            '替代任务必须作为新的 proposed/active/suspended 任务建立，不能一创建即终态。',
        );
    }
    if (replacement.found !== false) {
        addIssue(
            ctx.issues,
            'domain.quest_replacement_exists',
            replacement.path,
            '替代任务路径必须显式证明尚不存在。',
        );
    }
    ctx.addMutation({
        path: entry.path,
        before: entry.before,
        after: transition.value,
        effect: {
            type: 'custom',
            adapterId: 'phase4.quest-supersede',
            payload: {
                questId: payload.questId,
                supersededBy: payload.replacementQuestId,
                settlementTransactionId: transactionId,
            },
        },
    });
    ctx.addMutation({
        path: replacement.path,
        before: undefined,
        found: false,
        after: replacementResult.value,
        effect: {
            type: 'custom',
            adapterId: 'phase4.quest-replacement',
            payload: { questId: payload.replacementQuestId },
        },
    });
    addQuestSettlementDeltas(ctx);
}

function currentFact(ctx) {
    const payload = ctx.command.payload;
    const entry = ctx.configuredRecord('fact', payload.factId);
    if (!entry) return null;
    const before = ctx.collect(validateFact(entry.before), 'fact:before');
    return { entry, before };
}

function resolvedFact(ctx, basis) {
    const current = currentFact(ctx);
    if (!current) return null;
    const { entry, before } = current;
    const payload = ctx.command.payload;
    const resolutionEvidence = normalizeEvidenceList(
        ctx.state.resolutionEvidence ?? ctx.state.checkResult?.evidence,
    );
    const transition = transitionFact(before.value, {
        type: 'confirm',
        basis,
        resolutionSucceeded: basis === 'resolved-h2' ? true : undefined,
        evidence: resolutionEvidence,
    }, {
        activeBranch: ctx.branch,
    });
    ctx.collect(transition, 'fact:confirmed');
    if (transition.decision !== 'apply') {
        addIssue(
            ctx.issues,
            'domain.fact_confirmation_held',
            '$.state.records.fact',
            '事实证据门没有允许确认；保持 candidate。',
            transition.status === 'unresolved' ? 'unresolved' : 'error',
        );
        return null;
    }
    ctx.addMutation({
        path: entry.path,
        before: entry.before,
        after: transition.value,
        effect: {
            type: 'fact',
            factId: payload.factId,
            operation: 'confirm',
        },
    });
    return transition;
}

function buildCost(ctx) {
    const payload = ctx.command.payload;
    if (!requirePositive(
        payload.amount,
        ctx,
        '$.command.payload.amount',
        'domain.cost_amount',
        'H2代价必须是正的有限数字。',
    )) return;
    ctx.addResourceDelta(
        payload.resource,
        -payload.amount,
        payload.reason,
    );
    resolvedFact(ctx, 'resolved-h2');
}

function buildCheck(ctx) {
    const payload = ctx.command.payload;
    if (!ctx.campaign.value.checks.some((entry) => entry.checkId === payload.checkId)) {
        addIssue(
            ctx.issues,
            'domain.check_unregistered',
            '$.campaign.checks',
            'H2检定ID没有在战役配置中显式注册。',
            'unresolved',
        );
        return;
    }
    if (!isPlainObject(ctx.state.checkResult)) {
        addIssue(
            ctx.issues,
            'domain.check_result_missing',
            '$.state.checkResult',
            '检定命令必须消费显式结果和roll证据。',
            'unresolved',
        );
        return;
    }
    if (ctx.state.checkResult.checkId !== payload.checkId) {
        addIssue(
            ctx.issues,
            'domain.check_result_mismatch',
            '$.state.checkResult.checkId',
            '检定结果与Director命令不匹配。',
        );
        return;
    }
    if (ctx.state.checkResult.outcome === 'failure') {
        const current = currentFact(ctx);
        if (
            current
            && !['candidate', 'disputed'].includes(current.before.value.status)
        ) {
            addIssue(
                ctx.issues,
                'domain.check_fact_status',
                '$.state.records.fact.before.status',
                'H2失败只能保持 candidate/disputed Fact，不能旁路其他事实状态。',
            );
        }
        ctx.noop = {
            reason: 'H2检定失败，candidate Fact保持未确认。',
            decision: 'hold',
        };
        return;
    }
    if (ctx.state.checkResult.outcome !== 'success') {
        addIssue(
            ctx.issues,
            'domain.check_outcome_unresolved',
            '$.state.checkResult.outcome',
            '检定结果必须显式为 success 或 failure。',
            'unresolved',
        );
        return;
    }
    resolvedFact(ctx, 'resolved-h2');
}

function buildFactCommand(ctx) {
    const payload = ctx.command.payload;
    const entry = ctx.configuredRecord('fact', payload.factId);
    if (!entry) return;
    if (ctx.command.type === 'fact-candidate') {
        const fact = ctx.sourceFact ?? ctx.input.validatedCommand?.value?.sourceResult?.fact;
        const result = ctx.collect(validateFact(fact), 'fact:candidate');
        if (result.value.status !== 'candidate') {
            addIssue(
                ctx.issues,
                'domain.fact_candidate_status',
                '$.sourceResult.fact.status',
                'fact-candidate命令只能写入candidate。',
            );
        }
        ctx.addMutation({
            path: entry.path,
            before: entry.before,
            found: entry.found,
            after: result.value,
            effect: {
                type: 'fact',
                factId: payload.factId,
                operation: 'propose',
            },
        });
    } else {
        resolvedFact(ctx, 'adjudicated-h1');
    }
}

function semanticDescriptor(ctx) {
    const stateDescriptor = Object.fromEntries(
        Object.entries(ctx.state.records ?? {}).map(([key, entry]) => [
            key,
            {
                path: entry?.path,
                ...(entry?.before?.id ?? entry?.after?.id ?? entry?.candidate?.id
                    ? { id: entry?.before?.id ?? entry?.after?.id ?? entry?.candidate?.id }
                    : {}),
                ...(entry?.candidate === undefined
                    ? {}
                    : { candidate: stableCommandPayload(entry.candidate) }),
                ...(entry?.after === undefined
                    ? {}
                    : { after: stableCommandPayload(entry.after) }),
            },
        ]),
    );
    return hashCanonical({
        campaign: {
            id: ctx.campaign.value.id,
            version: ctx.campaign.value.version,
        },
        command: {
            type: ctx.command.type,
            payload: stableCommandPayload(ctx.command.payload),
        },
        records: stateDescriptor,
    });
}

function noTransactionResult(ctx, decision, reason) {
    return validationResult({
        command: deepClone(ctx.command),
        transaction: null,
        writePlan: [],
        domainResults: deepClone(ctx.domainResults),
        diagnostics: deepClone(ctx.diagnostics),
        decision,
        reason,
    }, ctx.issues);
}

export function planDirectorDomainTransaction(input) {
    const source = isPlainObject(input) ? input : {};
    const validatedCommand = source.validatedCommand;
    const initialIssues = [];
    if (
        validatedCommand?.ok !== true
        || validatedCommand?.status !== 'valid'
        || validatedCommand?.value?.validationKind !== 'director-domain-command'
    ) {
        addIssue(
            initialIssues,
            'domain.director_command_invalid',
            '$.validatedCommand',
            '第一个阶段4入口只接受 validateDirectorDomainCommand 的 valid 结果。',
        );
        return validationResult({
            command: validatedCommand?.value?.command ?? null,
            transaction: null,
            writePlan: [],
            domainResults: [],
            diagnostics: [],
            decision: 'reject',
        }, [
            ...initialIssues,
            ...(validatedCommand?.issues ?? []),
        ]);
    }
    const campaign = validateCampaignDomainConfig(source.campaign, {
        branchId: validatedCommand.value.target.branchId,
    });
    const ctx = plannerContext(source, validatedCommand, campaign);
    ctx.campaign = campaign;
    ctx.issues.push(...campaign.issues);
    ctx.input = source;

    if (ctx.command.type === 'new-branch') {
        return noTransactionResult(
            ctx,
            'branch-required',
            'H3显式改写必须交给阶段2 Branch Manager建立新分支，不能伪装成领域事务。',
        );
    }

    const idempotencyKey = createIdempotencyKey({
        operation: `phase4:${ctx.command.type}`,
        target: ctx.target,
        subject: primarySubject(ctx.command),
        effect: semanticDescriptor(ctx),
    });
    const kind = transactionKind(ctx.command.type);
    const transactionId = createTransactionId({
        branchId: ctx.target.branchId,
        target: ctx.target,
        idempotencyKey,
        kind,
    });

    switch (ctx.command.type) {
        case 'item-use':
            buildItemUse(ctx);
            break;
        case 'equipment-equip':
        case 'equipment-unequip':
        case 'equipment-transfer':
            buildEquipment(ctx);
            break;
        case 'skill-use':
            buildSkillUse(ctx);
            break;
        case 'social-transition':
            buildSocialTransition(ctx);
            break;
        case 'quest-transition':
            buildQuestTransition(ctx, transactionId);
            break;
        case 'quest-supersede':
            buildQuestSupersede(ctx, transactionId);
            break;
        case 'cost':
            buildCost(ctx);
            break;
        case 'check':
            buildCheck(ctx);
            break;
        case 'fact-candidate':
        case 'fact-confirm':
            buildFactCommand(ctx);
            break;
        default:
            addIssue(
                ctx.issues,
                'domain.command_unsupported',
                '$.command.type',
                '该命令不属于阶段4领域事务。',
            );
    }
    ctx.flushResources();

    if (ctx.noop && ctx.mutations.length === 0 && !blocking(ctx.issues)) {
        return noTransactionResult(
            ctx,
            ctx.noop.decision ?? 'no-op',
            ctx.noop.reason,
        );
    }
    if (blocking(ctx.issues)) {
        return validationResult({
            command: deepClone(ctx.command),
            transaction: null,
            writePlan: deepClone(ctx.mutations),
            domainResults: deepClone(ctx.domainResults),
            diagnostics: deepClone(ctx.diagnostics),
            decision: 'reject',
            idempotencyKey,
        }, ctx.issues);
    }
    if (ctx.mutations.length === 0 && !blocking(ctx.issues)) {
        addIssue(
            ctx.issues,
            'domain.empty_effect_plan',
            '$.state',
            '领域命令没有产生任何显式写入，不能创建空事务。',
            'unresolved',
        );
    }
    const pathValidation = validatePathMutations(ctx.mutations);
    ctx.issues.push(...pathValidation.issues);
    if (blocking(ctx.issues)) {
        return validationResult({
            command: deepClone(ctx.command),
            transaction: null,
            writePlan: deepClone(ctx.mutations),
            domainResults: deepClone(ctx.domainResults),
            diagnostics: deepClone(ctx.diagnostics),
            decision: 'reject',
            idempotencyKey,
        }, ctx.issues);
    }

    const transaction = createTransaction({
        id: transactionId,
        branchId: ctx.target.branchId,
        target: ctx.target,
        idempotencyKey,
        kind,
        preconditions: ctx.preconditions,
        effects: ctx.effects,
        touchedRefs: [],
        createdAt: source.createdAt ?? 0,
        audit: validatedCommand.value.evidence,
    });
    ctx.issues.push(...transaction.issues);
    if (!transaction.ok) {
        return validationResult({
            command: deepClone(ctx.command),
            transaction: transaction.value,
            writePlan: deepClone(ctx.mutations),
            domainResults: deepClone(ctx.domainResults),
            diagnostics: deepClone(ctx.diagnostics),
            decision: 'reject',
            idempotencyKey,
        }, ctx.issues);
    }
    return validationResult({
        command: deepClone(ctx.command),
        transaction: transaction.value,
        writePlan: deepClone(ctx.mutations),
        domainResults: deepClone(ctx.domainResults),
        diagnostics: deepClone(ctx.diagnostics),
        decision: 'propose',
        idempotencyKey,
    }, ctx.issues);
}
