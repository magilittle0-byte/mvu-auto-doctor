import assert from 'node:assert/strict';
import test from 'node:test';

import {
    adaptLegacyEquipment,
    adaptLegacyFact,
    adaptLegacyItem,
    adaptLegacyKnowledge,
    adaptLegacyQuest,
    adaptLegacySkill,
    adaptLegacySocialState,
    adjudicateSocialTransition,
    normalizeItemV2,
    parseLegacySkillCost,
    projectEquipmentToLegacy,
    projectFactToLegacy,
    projectItemToLegacy,
    projectKnowledgeToLegacy,
    projectQuestToLegacy,
    projectSkillToLegacy,
    projectSocialStateToLegacy,
    validateClaimAdjudication,
    validateEquipmentV2,
    validateFact,
    validateItemV2,
    validateKnowledge,
    validateQuest,
    validateQuestTransition,
    validateSkillV2,
    validateSocialState,
} from '../v2/domain/index.mjs';

const evidence = {
    kind: 'state',
    ref: 'state:fixture',
    branchId: 'branch-current',
};

function base(id) {
    return {
        id,
        schemaVersion: '2.0',
        revision: 0,
    };
}

test('V2 normalization preserves open fields without mutating the source', () => {
    const source = {
        ...base('item-open'),
        name: '旧钥匙',
        kind: 'quest',
        quantity: 1,
        stackable: false,
        description: '一把没有标明用途的钥匙。',
        provenance: [evidence],
        campaignFlavor: {
            origin: 'north-gate',
            nested: ['untouched'],
        },
    };
    const snapshot = structuredClone(source);
    const normalized = normalizeItemV2(source);
    assert.deepEqual(source, snapshot);
    assert.deepEqual(normalized.extensions.campaignFlavor, source.campaignFlavor);
    normalized.extensions.campaignFlavor.nested.push('changed');
    assert.deepEqual(source, snapshot, 'normalization must return an isolated copy');
});

test('extensions cannot shadow V2 hard fields', () => {
    const result = validateItemV2({
        ...base('item-shadow'),
        name: '硬字段冲突',
        kind: 'misc',
        quantity: 1,
        stackable: false,
        description: '',
        provenance: [],
        extensions: {
            quantity: 999,
        },
    });
    assert.equal(result.status, 'rejected');
    assert.ok(result.issues.some((issue) => (
        issue.code === 'record.extensions_hard_field_collision'
    )));
});

test('mechanical numbers reject strings, NaN and Infinity', () => {
    for (const quantity of ['1', Number.NaN, Number.POSITIVE_INFINITY]) {
        const result = validateItemV2({
            ...base(`bad-number-${String(quantity)}`),
            name: '坏数字',
            kind: 'material',
            quantity,
            stackable: true,
            description: '',
            provenance: [],
        });
        assert.equal(result.status, 'rejected');
        assert.ok(result.issues.some((issue) => issue.code === 'item.quantity'));
    }
});

test('legacy item keeps unknown fields through the read-only round trip', () => {
    const legacy = {
        id: 'legacy-item-1',
        name: '雾银粉',
        kind: 'material',
        quantity: 2,
        stackable: true,
        description: '炼金材料。',
        authorSpecific: {
            rarityText: '只在雨夜出现',
            customFlags: ['keep', { nested: true }],
        },
    };
    const snapshot = structuredClone(legacy);
    const adapted = adaptLegacyItem(legacy);
    assert.equal(adapted.status, 'valid');
    assert.deepEqual(
        adapted.value.extensions.legacy.authorSpecific,
        legacy.authorSpecific,
    );
    const projected = projectItemToLegacy(adapted.value);
    assert.deepEqual(projected.authorSpecific, legacy.authorSpecific);
    assert.deepEqual(legacy, snapshot, 'the adapter must be read-only');
});

test('legacy adapters quarantine inputs beyond configured migration bounds', () => {
    const legacy = {
        id: 'oversized-item',
        name: '过长旧字段',
        kind: 'material',
        quantity: 1,
        stackable: true,
        description: '',
        authorSpecific: 'x'.repeat(20),
    };
    const snapshot = structuredClone(legacy);
    const adapted = adaptLegacyItem(legacy, {
        limits: { maxStringLength: 10 },
    });
    assert.equal(adapted.status, 'rejected');
    assert.equal(adapted.migration.status, 'quarantined');
    assert.ok(adapted.issues.some((issue) => (
        issue.code === 'migration.string_limit'
    )));
    assert.deepEqual(legacy, snapshot);
});

test('every 1.x adapter preserves nested unknown fields in its read-only projection', () => {
    const unknown = {
        nested: {
            array: [1, { keep: 'exactly' }],
        },
    };
    const cases = [
        {
            adapt: adaptLegacyEquipment,
            project: projectEquipmentToLegacy,
            source: {
                id: 'legacy-equipment',
                itemId: 'legacy-item',
                allowedSlots: [{ system: 'campaign', slot: 'torso' }],
                occupies: [],
                bonuses: [],
                provenance: [],
                authorSpecific: unknown,
            },
        },
        {
            adapt: adaptLegacySkill,
            project: projectSkillToLegacy,
            source: {
                id: 'legacy-skill-roundtrip',
                name: '被动观察',
                mode: 'passive',
                costs: [],
                effects: [],
                provenance: [],
                authorSpecific: unknown,
            },
        },
        {
            adapt: adaptLegacyFact,
            project: projectFactToLegacy,
            source: {
                id: 'legacy-fact-roundtrip',
                proposition: '雨已经停了。',
                status: 'candidate',
                scope: 'branch',
                branchId: 'branch-current',
                subjectIds: [],
                evidence: [],
                impact: 'cosmetic',
                authorSpecific: unknown,
            },
        },
        {
            adapt: adaptLegacyKnowledge,
            project: projectKnowledgeToLegacy,
            source: {
                id: 'legacy-knowledge-roundtrip',
                knowerId: 'npc-a',
                factId: 'legacy-fact-roundtrip',
                state: 'unknown',
                acquiredBy: [],
                branchId: 'branch-current',
                visibility: 'private',
                authorSpecific: unknown,
            },
        },
        {
            adapt: adaptLegacySocialState,
            project: projectSocialStateToLegacy,
            source: {
                id: 'legacy-social-roundtrip',
                fromActorId: 'npc-a',
                toActorId: 'player',
                voluntary: {},
                coercive: { sourceIds: [] },
                labels: [],
                evidence: [],
                branchId: 'branch-current',
                authorSpecific: unknown,
            },
        },
        {
            adapt: adaptLegacyQuest,
            project: projectQuestToLegacy,
            source: {
                id: 'legacy-quest-roundtrip',
                title: '等待消息',
                status: 'active',
                branchId: 'branch-current',
                objectives: [],
                settlementTransactionIds: [],
                authorSpecific: unknown,
            },
        },
    ];

    for (const entry of cases) {
        const sourceSnapshot = structuredClone(entry.source);
        const adapted = entry.adapt(entry.source);
        assert.deepEqual(
            adapted.value.extensions.legacy.authorSpecific,
            unknown,
            `${entry.source.id} lost its legacy extension`,
        );
        assert.deepEqual(
            entry.project(adapted.value).authorSpecific,
            unknown,
            `${entry.source.id} lost its read-only projection`,
        );
        assert.deepEqual(entry.source, sourceSnapshot);
    }
});

test('legacy consumable with a claimed but untyped effect remains unresolved', () => {
    const adapted = adaptLegacyItem({
        id: 'legacy-potion',
        name: '强效治疗药剂',
        kind: 'consumable',
        quantity: 1,
        stackable: false,
        description: '恢复大量生命。',
    }, {
        mechanicalEffectClaimed: true,
    });
    assert.equal(adapted.status, 'unresolved');
    assert.equal(adapted.migration.status, 'unresolved');
    assert.ok(adapted.issues.some((issue) => issue.code === 'item.missing_typed_effect'));
    assert.ok(adapted.issues.some((issue) => issue.code === 'item.unresolved_consumption'));
    assert.equal(adapted.value.quantity, 1, 'validation must not spend the item');
});

test('equipment adapter maps the current path but never invents allowed slots', () => {
    const adapted = adaptLegacyEquipment({
        id: 'legacy-equipment-record',
        itemId: 'item-coat',
        当前槽位: 'outerwear',
        authorNote: 'layered garment',
    }, {
        slotSystem: 'campaign-slots',
    });
    assert.equal(adapted.status, 'unresolved');
    assert.deepEqual(adapted.value.equippedAt, [{
        system: 'campaign-slots',
        slot: 'outerwear',
    }]);
    assert.deepEqual(adapted.value.allowedSlots, []);
    assert.ok(adapted.issues.some((issue) => (
        issue.code === 'equipment.allowed_slots_unresolved'
    )));
    assert.equal(adapted.value.extensions.legacy.authorNote, 'layered garment');
});

test('equipment validator rejects a configured slot mismatch without a built-in taxonomy', () => {
    const result = validateEquipmentV2({
        ...base('equipment-slot-test'),
        itemId: 'item-vest',
        allowedSlots: [{ system: 'campaign-a', slot: 'torso' }],
        occupies: [],
        equippedAt: [{ system: 'campaign-a', slot: 'legs' }],
        bonuses: [],
        provenance: [evidence],
    });
    assert.equal(result.status, 'rejected');
    assert.ok(result.issues.some((issue) => issue.code === 'equipment.slot_mismatch'));
});

test('skill text cost maps only through one explicit resource alias', () => {
    const unresolved = parseLegacySkillCost('20MP', {
        resourceAliases: {},
        timing: 'on-start',
        refundable: false,
    });
    assert.equal(unresolved.cost, null);
    assert.ok(unresolved.issues.some((issue) => (
        issue.code === 'migration.skill_cost_resource_unresolved'
    )));

    const ambiguous = parseLegacySkillCost('20MP', {
        resourceAliases: {
            MP: [
                { ownerId: 'actor-a', resourceId: 'mana' },
                { ownerId: 'actor-a', resourceId: 'mental-points' },
            ],
        },
        timing: 'on-start',
        refundable: false,
    });
    assert.equal(ambiguous.cost, null);

    const mapped = parseLegacySkillCost('20MP', {
        resourceAliases: {
            MP: { ownerId: 'actor-a', resourceId: 'mana' },
        },
        timing: 'on-start',
        refundable: false,
    });
    assert.deepEqual(mapped.cost, {
        resource: { ownerId: 'actor-a', resourceId: 'mana' },
        amount: 20,
        timing: 'on-start',
        refundable: false,
    });
});

test('legacy skill display text stays unresolved until its unit and policy are explicit', () => {
    const source = {
        id: 'legacy-skill',
        name: '基础骇入协议',
        mode: 'active',
        costText: '20MP',
        effects: [],
    };
    const unresolved = adaptLegacySkill(source);
    assert.equal(unresolved.status, 'unresolved');
    assert.deepEqual(unresolved.value.costs, []);
    assert.ok(unresolved.issues.some((issue) => issue.code === 'skill.unresolved_cost'));

    const mapped = adaptLegacySkill(source, {
        resourceAliases: {
            MP: { ownerId: 'actor-a', resourceId: 'mana' },
        },
        timing: 'on-start',
        refundable: false,
    });
    assert.equal(mapped.status, 'valid');
    assert.equal(mapped.value.costs[0].amount, 20);
});

test('typed skill costs validate without using display text as ledger input', () => {
    const result = validateSkillV2({
        ...base('skill-typed'),
        name: '稳定技能',
        mode: 'active',
        costs: [{
            resource: { ownerId: 'actor-a', resourceId: 'stamina' },
            amount: 15,
            timing: 'on-success',
            refundable: false,
        }],
        effects: [],
        displayCost: '15 耐力',
        provenance: [evidence],
    });
    assert.equal(result.status, 'valid');
});

test('legacy facts and knowledge are not bulk-upgraded to confirmed or verified', () => {
    const fact = adaptLegacyFact({
        id: 'legacy-fact',
        proposition: '某短语是秘密协议',
        status: 'confirmed',
        scope: 'branch',
        branchId: 'branch-current',
        subjectIds: [],
        evidence: [],
        impact: 'material',
    });
    assert.equal(fact.value.status, 'candidate');
    assert.equal(fact.status, 'unresolved');

    const knowledge = adaptLegacyKnowledge({
        id: 'legacy-knowledge',
        knowerId: 'npc-a',
        factId: 'legacy-fact',
        state: 'verified',
        acquiredBy: [evidence],
        branchId: 'branch-current',
        visibility: 'private',
    });
    assert.equal(knowledge.value.state, 'known');
    assert.equal(knowledge.status, 'unresolved');
});

test('Fact and Knowledge validators keep truth and knowledge as separate records', () => {
    const fact = validateFact({
        ...base('fact-1'),
        proposition: '北门关闭。',
        status: 'confirmed',
        scope: 'branch',
        branchId: 'branch-current',
        subjectIds: ['north-gate'],
        evidence: [evidence],
        impact: 'local',
    });
    const knowledge = validateKnowledge({
        ...base('knowledge-1'),
        knowerId: 'npc-uninformed',
        factId: 'fact-1',
        state: 'unknown',
        acquiredBy: [],
        branchId: 'branch-current',
        visibility: 'private',
    });
    assert.equal(fact.status, 'valid');
    assert.equal(knowledge.status, 'valid');
    assert.equal(knowledge.value.state, 'unknown');
});

test('legacy ambiguous social scores stay in legacy extensions', () => {
    const adapted = adaptLegacySocialState({
        id: 'legacy-social',
        fromActorId: 'npc-a',
        toActorId: 'player',
        关系分数: 90,
        labels: ['旧标签'],
        evidence: [],
        branchId: 'branch-current',
    }, {
        ambiguousRelationFields: ['关系分数'],
    });
    assert.equal(adapted.status, 'unresolved');
    assert.deepEqual(adapted.value.voluntary, {});
    assert.equal(adapted.value.extensions.legacy.关系分数, 90);
});

test('social transition preserves evidenced coercion and reverts unproven voluntary axes', () => {
    const before = {
        ...base('social-transition'),
        fromActorId: 'npc-a',
        toActorId: 'player',
        voluntary: { affection: 12, trust: 9 },
        coercive: { control: 0, sourceIds: [] },
        labels: [],
        evidence: [evidence],
        branchId: 'branch-current',
    };
    const candidate = {
        ...before,
        voluntary: { affection: 72, trust: 65 },
        coercive: { control: 80, sourceIds: ['threat-event'] },
    };
    const result = adjudicateSocialTransition(before, candidate, {
        voluntaryEvidence: false,
        coerciveEvidence: ['control'],
    });
    assert.equal(result.decision, 'revert');
    assert.deepEqual(result.value.voluntary, before.voluntary);
    assert.equal(result.value.coercive.control, 80);
    assert.deepEqual(result.revertedPaths, [
        '$.voluntary.affection',
        '$.voluntary.trust',
    ]);
    assert.equal(validateSocialState(result.value).status, 'valid');
});

test('legacy quest conflicts are quarantined and terminal quests cannot reopen', () => {
    const quarantined = adaptLegacyQuest({
        id: 'legacy-quest',
        title: '旧任务',
        status: 'active',
        ended: true,
        branchId: 'branch-current',
        objectives: [],
        settlementTransactionIds: [],
    });
    assert.equal(quarantined.migration.status, 'quarantined');
    assert.ok(quarantined.issues.some((issue) => (
        issue.code === 'migration.quest_status_conflict'
    )));

    const terminal = {
        ...base('quest-terminal'),
        title: '已完成任务',
        status: 'completed',
        branchId: 'branch-current',
        objectives: [],
        settlementTransactionIds: ['tx-settlement'],
        terminalEvidence: [evidence],
    };
    assert.equal(validateQuest(terminal).status, 'valid');
    const reopened = validateQuestTransition(terminal, {
        ...terminal,
        status: 'active',
        terminalEvidence: undefined,
    });
    assert.equal(reopened.status, 'rejected');
    assert.equal(reopened.value.status, 'completed');
    assert.ok(reopened.issues.some((issue) => issue.code === 'quest.terminal_reopen'));
});

test('H0-H3 adjudication is a structured result contract, not a classifier', () => {
    const h2 = validateClaimAdjudication({
        level: 'H2',
        decision: 'roll_required',
        claimIds: ['claim-access'],
        reason: '该主张会带来通行优势。',
        evidence: [evidence],
        commands: [{
            type: 'check',
            payload: { checkId: 'campaign-check' },
        }],
    });
    assert.equal(h2.status, 'valid');

    const textOnly = validateClaimAdjudication({
        level: 'H2',
        decision: 'roll_required',
        claimIds: ['claim-access'],
        reason: '只给了一句建议。',
        evidence: [],
        commands: [],
    });
    assert.equal(textOnly.status, 'unresolved');
    assert.ok(textOnly.issues.some((issue) => (
        issue.code === 'adjudication.h2_command_missing'
    )));
});
