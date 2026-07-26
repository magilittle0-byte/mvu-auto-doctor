import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    adjudicateTurnBoundary,
    createTurnBoundary,
} from '../v2/director/index.mjs';
import {
    createBranch,
    createMessageFingerprint,
    hashText,
} from '../v2/transaction/index.mjs';
import {
    DOMAIN_COMMAND_VERSION,
    planDirectorDomainTransaction,
    validateDirectorDomainCommand,
} from '../v2/domain-transaction/index.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(TEST_DIR, '..', 'fixtures', '2.0', 'replay-cases.json');
const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));
const replayById = new Map(corpus.cases.map((entry) => [entry.id, entry]));

const AUTHORIZATION_BY_COMMAND = Object.freeze({
    'item-use': 'resource-consumption',
    'equipment-equip': 'state-change',
    'skill-use': 'skill-use',
    'social-transition': 'state-change',
});

function replay(id) {
    const value = replayById.get(id);
    assert.ok(value, `missing replay fixture ${id}`);
    return value;
}

function targetFor(fixture) {
    const result = createMessageFingerprint({
        chatId: 'chat:phase4-replay',
        logicalIndex: 4,
        messageId: `message:${fixture.id}`,
        swipeId: 0,
        generation: 1,
        branchId: fixture.input.context.branchId,
        parentHash: hashText('phase4 replay parent'),
        content: fixture.input.turns.map((entry) => entry.text).join('\n'),
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function branchFor(target) {
    const result = createBranch({
        id: target.branchId,
        divergenceFingerprint: target,
        headFingerprint: target,
        checkpointRef: 'checkpoint:phase4-replay',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function replayEvidence(target) {
    return [{
        kind: 'message',
        ref: `message:${target.messageId}`,
        branchId: target.branchId,
    }];
}

function validateNativeCommand(fixture, type, payload) {
    const target = targetFor(fixture);
    const authorizationKind = AUTHORIZATION_BY_COMMAND[type];
    const authorizationId = `authorization:${fixture.id}`;
    const evidence = replayEvidence(target);
    const boundary = createTurnBoundary({
        id: `turn:${fixture.id}`,
        branchId: target.branchId,
        target,
        authorizations: [{
            id: authorizationId,
            kind: authorizationKind,
            actorId: 'player',
            evidence,
        }],
        negativeConstraints: [],
        claims: [],
        unselectedCandidateIds: [],
        protectedPlayerStateRefs: [],
        darkChoices: [],
    });
    assert.equal(boundary.status, 'valid');
    const branch = branchFor(target);
    const director = adjudicateTurnBoundary(boundary.value, {
        contributions: [{
            id: `contribution:${fixture.id}`,
            actor: 'player',
            actorId: 'player',
            kind: authorizationKind,
            source: 'player-input',
        }],
    }, {
        currentFingerprint: target,
        activeBranch: branch,
    });
    assert.equal(director.decision, 'accept');
    const command = {
        type,
        payload: {
            commandVersion: DOMAIN_COMMAND_VERSION,
            branchId: target.branchId,
            authorizationId,
            ...payload,
        },
    };
    const validated = validateDirectorDomainCommand({
        command,
        target,
        currentFingerprint: target,
        activeBranch: branch,
        sourceResult: director,
        evidence,
    });
    assert.equal(validated.status, 'valid');
    return { target, validated };
}

function campaign(target, {
    records = {},
    slotTaxonomy = [],
    slotBindings = [],
} = {}) {
    return {
        id: 'campaign:phase4-replays',
        version: 'rules:1',
        branchId: target.branchId,
        records,
        resources: [],
        slotTaxonomy,
        slotBindings,
        checks: [],
        effectBindings: {},
    };
}

function recordBase(id) {
    return {
        id,
        schemaVersion: '2.0',
        revision: 0,
    };
}

function itemRecord(id, source) {
    return {
        ...recordBase(id),
        name: id,
        kind: source.kind,
        quantity: source.quantity,
        stackable: false,
        description: source.description,
        mechanics: {
            use: {
                effects: source.effects,
            },
        },
        provenance: [],
    };
}

function socialRecord(fixture, candidate = false) {
    const source = candidate ? fixture.input.candidateState : fixture.input.stateBefore;
    const coercion = source.coercion ?? 0;
    return {
        ...recordBase(fixture.id),
        fromActorId: 'fixture:npc',
        toActorId: 'fixture:player',
        voluntary: {
            affection: source.affection,
            trust: source.trust,
        },
        coercive: {
            control: coercion,
            sourceIds: coercion ? ['fixture:threat'] : [],
        },
        labels: source.relationshipTags ?? [],
        evidence: [],
        branchId: fixture.input.context.branchId,
    };
}

test('replay.item.consumable_effect — RR-ITEM-CONSUMABLE-EFFECT uses the phase-4 planner', () => {
    const fixture = replay('RR-ITEM-CONSUMABLE-EFFECT');
    const source = fixture.input.operation.payload.item;
    const item = itemRecord(fixture.id, source);
    const { target, validated } = validateNativeCommand(fixture, 'item-use', {
        itemId: item.id,
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: campaign(target, {
            records: { item: { [item.id]: '/inventory/replay-item' } },
        }),
        state: {
            records: {
                item: { path: '/inventory/replay-item', before: item },
            },
        },
    });

    assert.equal(plan.status, 'rejected');
    assert.equal(plan.value.transaction, null);
    assert.equal(plan.value.writePlan.length, 0);
    assert.ok(plan.issues.some((entry) => entry.code === 'item.missing_typed_effect'));
    assert.ok(plan.issues.some((entry) => entry.code === 'item.unresolved_consumption'));
});

test('replay.skill.text_cost — RR-SKILL-TEXT-COST uses the phase-4 planner', () => {
    const fixture = replay('RR-SKILL-TEXT-COST');
    const source = fixture.input.operation.payload.skill;
    const skill = {
        ...recordBase(fixture.id),
        name: source.name,
        mode: 'active',
        costs: source.costs,
        effects: [],
        displayCost: source.costText,
        provenance: [],
    };
    const { target, validated } = validateNativeCommand(fixture, 'skill-use', {
        skillId: skill.id,
        timing: 'on-start',
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: campaign(target, {
            records: { skill: { [skill.id]: '/skills/replay-skill' } },
        }),
        state: {
            records: {
                skill: { path: '/skills/replay-skill', before: skill },
            },
        },
    });

    assert.equal(plan.status, 'unresolved');
    assert.equal(plan.value.transaction, null);
    assert.equal(plan.value.writePlan.length, 0);
    assert.ok(plan.issues.some((entry) => entry.code === 'skill.unresolved_cost'));
});

test('replay.equipment.slots — RR-EQUIPMENT-SLOTS uses the phase-4 planner', () => {
    const fixture = replay('RR-EQUIPMENT-SLOTS');
    const system = fixture.input.context.slotTaxonomy;
    const plans = fixture.input.operation.payload.items.map((source, index) => {
        const itemId = `fixture:item:${index}`;
        const equipmentId = `fixture:equipment:${index}`;
        const allowed = { system, slot: source.allowedSlots[0] };
        const attempted = { system, slot: source.equippedAt };
        const item = {
            ...recordBase(itemId),
            name: source.name,
            kind: 'equipment',
            quantity: 1,
            stackable: false,
            description: 'fixture equipment',
            provenance: [],
        };
        const equipment = {
            ...recordBase(equipmentId),
            itemId,
            allowedSlots: [allowed],
            occupies: [allowed],
            equippedAt: [],
            bonuses: [],
            provenance: [],
        };
        const { target, validated } = validateNativeCommand(fixture, 'equipment-equip', {
            equipmentId,
            itemId,
            slots: [attempted],
        });
        return planDirectorDomainTransaction({
            validatedCommand: validated,
            campaign: campaign(target, {
                records: {
                    item: { [itemId]: `/inventory/${index}` },
                    equipment: { [equipmentId]: `/equipment/${index}` },
                },
                slotTaxonomy: [allowed, attempted],
                slotBindings: [
                    { slot: allowed, path: `/loadout/${index}/allowed` },
                    { slot: attempted, path: `/loadout/${index}/attempted` },
                ],
            }),
            state: {
                records: {
                    item: { path: `/inventory/${index}`, before: item },
                    equipment: { path: `/equipment/${index}`, before: equipment },
                },
                slots: [
                    { slot: allowed, path: `/loadout/${index}/allowed`, before: null },
                    { slot: attempted, path: `/loadout/${index}/attempted`, before: null },
                ],
            },
        });
    });

    assert.ok(plans.every((plan) => plan.status === 'rejected'));
    assert.ok(plans.every((plan) => plan.value.transaction === null));
    assert.ok(plans.every((plan) => (
        plan.issues.some((entry) => entry.code === 'equipment.slot_mismatch')
    )));
});

test('replay.social.ordinary_kindness — RR-SOCIAL-ORDINARY-KINDNESS uses the phase-4 planner', () => {
    const fixture = replay('RR-SOCIAL-ORDINARY-KINDNESS');
    const before = socialRecord(fixture);
    const candidate = socialRecord(fixture, true);
    const { target, validated } = validateNativeCommand(fixture, 'social-transition', {
        socialId: before.id,
        voluntaryEvidence: false,
        coerciveEvidence: false,
        labelEvidence: false,
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: campaign(target, {
            records: { social: { [before.id]: '/social/replay-link' } },
        }),
        state: {
            records: {
                social: {
                    path: '/social/replay-link',
                    before,
                    candidate,
                },
            },
        },
    });

    assert.equal(plan.status, 'valid');
    assert.equal(plan.value.decision, fixture.expected.decision);
    assert.equal(plan.value.transaction, null);
    assert.equal(plan.value.writePlan.length, 0);
    assert.ok(plan.value.domainResults.some((entry) => (
        entry.revertedPaths?.includes('$.labels')
    )));
});

test('replay.social.coercion_voluntary — RR-SOCIAL-COERCION-VOLUNTARY uses the phase-4 planner', () => {
    const fixture = replay('RR-SOCIAL-COERCION-VOLUNTARY');
    const before = socialRecord(fixture);
    const candidate = socialRecord(fixture, true);
    const { target, validated } = validateNativeCommand(fixture, 'social-transition', {
        socialId: before.id,
        voluntaryEvidence: fixture.input.context.voluntaryEvidence,
        coerciveEvidence: fixture.input.context.coerciveEvidence ? ['control'] : false,
        labelEvidence: false,
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: campaign(target, {
            records: { social: { [before.id]: '/social/replay-link' } },
        }),
        state: {
            records: {
                social: {
                    path: '/social/replay-link',
                    before,
                    candidate,
                },
            },
        },
    });

    assert.equal(plan.status, 'valid');
    assert.equal(plan.value.decision, 'propose');
    assert.ok(plan.value.transaction);
    const after = plan.value.writePlan.find((entry) => (
        entry.path === '/social/replay-link'
    )).value;
    assert.deepEqual(after.voluntary, before.voluntary);
    assert.equal(after.coercive.control, fixture.input.candidateState.coercion);
});
