import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    adjudicateSocialTransition,
    validateEquipmentV2,
    validateItemV2,
    validateSkillV2,
} from '../v2/domain/index.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(TEST_DIR, '..', 'fixtures', '2.0', 'replay-cases.json');
const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));
const replayById = new Map(corpus.cases.map((entry) => [entry.id, entry]));

function replay(id) {
    const value = replayById.get(id);
    assert.ok(value, `missing replay fixture ${id}`);
    return value;
}

function recordBase(id) {
    return {
        id,
        schemaVersion: '2.0',
        revision: 0,
    };
}

test('replay.item.consumable_effect — RR-ITEM-CONSUMABLE-EFFECT', () => {
    const fixture = replay('RR-ITEM-CONSUMABLE-EFFECT');
    const item = fixture.input.operation.payload.item;
    const sourceSnapshot = structuredClone(item);
    const result = validateItemV2({
        ...recordBase(fixture.id),
        name: '脱敏回放消耗品',
        kind: item.kind,
        quantity: item.quantity,
        stackable: false,
        description: item.description,
        mechanics: {
            use: {
                effects: item.effects,
            },
        },
        provenance: [],
    }, {
        mechanicalEffectClaimed: true,
    });

    assert.equal(result.status, 'unresolved');
    assert.ok(result.issues.some((issue) => issue.code === 'item.missing_typed_effect'));
    assert.ok(result.issues.some((issue) => issue.code === 'item.unresolved_consumption'));
    assert.equal(result.value.quantity, item.quantity);
    assert.deepEqual(item, sourceSnapshot, 'the read-only validator must not spend the item');
    assert.equal(
        result.value.mechanics.use.effects.some((effect) => (
            effect?.type === 'resource-delta'
        )),
        false,
        'no guessed healing delta may be synthesized',
    );
});

test('replay.skill.text_cost — RR-SKILL-TEXT-COST', () => {
    const fixture = replay('RR-SKILL-TEXT-COST');
    const skill = fixture.input.operation.payload.skill;
    const sourceSnapshot = structuredClone(skill);
    const result = validateSkillV2({
        ...recordBase(fixture.id),
        name: skill.name,
        mode: 'active',
        costs: skill.costs,
        effects: [],
        displayCost: skill.costText,
        provenance: [],
    });

    assert.equal(result.status, 'unresolved');
    assert.ok(result.issues.some((issue) => issue.code === 'skill.unresolved_cost'));
    assert.deepEqual(result.value.costs, []);
    assert.deepEqual(skill, sourceSnapshot, 'display text must remain read-only');
});

test('replay.equipment.slots — RR-EQUIPMENT-SLOTS', () => {
    const fixture = replay('RR-EQUIPMENT-SLOTS');
    const items = fixture.input.operation.payload.items;
    const stateSnapshot = structuredClone(items);
    const system = fixture.input.context.slotTaxonomy;
    const results = items.map((item, index) => validateEquipmentV2({
        ...recordBase(`${fixture.id}:${index}`),
        itemId: `fixture-item:${index}`,
        allowedSlots: item.allowedSlots.map((slot) => ({ system, slot })),
        occupies: [],
        equippedAt: [{ system, slot: item.equippedAt }],
        bonuses: [],
        provenance: [],
    }));

    assert.ok(results.every((result) => result.status === 'rejected'));
    assert.ok(results.every((result) => (
        result.issues.some((issue) => issue.code === 'equipment.slot_mismatch')
    )));
    assert.deepEqual(items, stateSnapshot, 'a rejected batch must leave equipment unchanged');
});

test('replay.social.coercion_voluntary — RR-SOCIAL-COERCION-VOLUNTARY', () => {
    const fixture = replay('RR-SOCIAL-COERCION-VOLUNTARY');
    const { stateBefore, candidateState, context } = fixture.input;
    const before = {
        ...recordBase(fixture.id),
        fromActorId: 'fixture-npc',
        toActorId: 'fixture-player',
        voluntary: {
            affection: stateBefore.affection,
            trust: stateBefore.trust,
        },
        coercive: {
            control: stateBefore.coercion,
            sourceIds: [],
        },
        labels: [],
        evidence: [],
        branchId: context.branchId,
    };
    const candidate = {
        ...before,
        voluntary: {
            affection: candidateState.affection,
            trust: candidateState.trust,
        },
        coercive: {
            control: candidateState.coercion,
            sourceIds: ['fixture:threat'],
        },
    };
    const result = adjudicateSocialTransition(before, candidate, {
        voluntaryEvidence: context.voluntaryEvidence,
        coerciveEvidence: context.coerciveEvidence ? ['control'] : false,
    });

    assert.equal(result.decision, fixture.expected.decision);
    assert.equal(result.value.voluntary.affection, stateBefore.affection);
    assert.equal(result.value.voluntary.trust, stateBefore.trust);
    assert.equal(result.value.coercive.control, candidateState.coercion);
    assert.deepEqual(result.revertedPaths, [
        '$.voluntary.affection',
        '$.voluntary.trust',
    ]);
});
