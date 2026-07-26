import assert from 'node:assert/strict';
import test from 'node:test';

import {
    adjudicateClaim,
    adjudicateTurnBoundary,
    createTurnBoundary,
} from '../v2/director/index.mjs';
import {
    createBranch,
    createMessageFingerprint,
    createTransactionKernel,
    hashCanonical,
    hashText,
} from '../v2/transaction/index.mjs';
import {
    DOMAIN_COMMAND_VERSION,
    createLazyLegacyDomainProjection,
    diagnoseLegacyDomainProjection,
    executePlannedDomainTransaction,
    planDirectorDomainTransaction,
    preparePlannedDomainTransaction,
    validateDirectorDomainCommand,
} from '../v2/domain-transaction/index.mjs';

function fingerprint({
    branchId = 'branch-phase4',
    messageId = 'message-phase4',
    generation = 1,
    content = 'phase 4 target',
} = {}) {
    const result = createMessageFingerprint({
        chatId: 'chat-phase4',
        logicalIndex: 8,
        messageId,
        swipeId: 0,
        generation,
        branchId,
        parentHash: hashText('phase 4 parent'),
        content,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function activeBranch(target = fingerprint()) {
    const result = createBranch({
        id: target.branchId,
        divergenceFingerprint: target,
        headFingerprint: target,
        checkpointRef: 'checkpoint:phase4',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function evidence(
    branchId = 'branch-phase4',
    kind = 'message',
    ref = 'message:phase4',
) {
    return { kind, ref, branchId };
}

const AUTHORIZATION_BY_COMMAND = Object.freeze({
    'item-use': 'resource-consumption',
    'equipment-equip': 'state-change',
    'equipment-unequip': 'state-change',
    'equipment-transfer': 'state-change',
    'skill-use': 'skill-use',
    'social-transition': 'state-change',
    'quest-transition': 'decision',
    'quest-supersede': 'decision',
});

function validatedNativeCommand(type, payload = {}, target = fingerprint()) {
    const authorizationKind = AUTHORIZATION_BY_COMMAND[type];
    const authorizationId = `authorization:${type}`;
    const turn = createTurnBoundary({
        id: `turn:${type}`,
        branchId: target.branchId,
        target,
        authorizations: [{
            id: authorizationId,
            kind: authorizationKind,
            actorId: 'player',
            evidence: [evidence(target.branchId)],
        }],
        negativeConstraints: [],
        claims: [],
        unselectedCandidateIds: [],
        protectedPlayerStateRefs: [],
        darkChoices: [],
    });
    assert.equal(turn.status, 'valid');
    const decision = adjudicateTurnBoundary(turn.value, {
        contributions: [{
            id: `contribution:${type}`,
            actor: 'player',
            actorId: 'player',
            kind: authorizationKind,
            source: 'player-input',
        }],
    }, {
        currentFingerprint: target,
        activeBranch: activeBranch(target),
    });
    assert.equal(decision.decision, 'accept');
    const command = {
        type,
        payload: {
            commandVersion: DOMAIN_COMMAND_VERSION,
            branchId: target.branchId,
            authorizationId,
            ...payload,
        },
    };
    return validateDirectorDomainCommand({
        command,
        target,
        currentFingerprint: target,
        activeBranch: activeBranch(target),
        sourceResult: decision,
        evidence: [evidence(target.branchId)],
    });
}

function campaign(target, {
    records = {},
    resources = [],
    slotTaxonomy = [],
    slotBindings = [],
    checks = [],
    effectBindings = {},
} = {}) {
    return {
        id: 'campaign:phase4',
        version: 'rules:1',
        branchId: target.branchId,
        records,
        resources,
        slotTaxonomy,
        slotBindings,
        checks,
        effectBindings,
    };
}

function baseRecord(id) {
    return {
        id,
        schemaVersion: '2.0',
        revision: 0,
    };
}

function item({
    id = 'potion',
    kind = 'consumable',
    quantity = 1,
    effects = [{
        type: 'resource-delta',
        delta: {
            resource: { ownerId: 'player', resourceId: 'hp' },
            amount: 20,
            reason: 'typed healing',
        },
    }],
} = {}) {
    return {
        ...baseRecord(id),
        name: id,
        kind,
        quantity,
        stackable: false,
        description: kind === 'consumable' ? '恢复生命。' : '装备。',
        ...(kind === 'consumable' ? {
            mechanics: {
                use: {
                    consumes: 1,
                    effects,
                },
            },
        } : {}),
        provenance: [evidence()],
    };
}

class MemoryHost {
    constructor(target, branch, state) {
        this.target = structuredClone(target);
        this.branch = structuredClone(branch);
        this.states = new Map([[hashCanonical(target), structuredClone(state)]]);
        this.writeCount = 0;
        this.transactions = [];
        this.recoveries = [];
    }

    async captureCurrent() {
        return {
            fingerprint: structuredClone(this.target),
            branch: structuredClone(this.branch),
        };
    }

    async readExact(target) {
        const value = this.states.get(hashCanonical(target));
        return value === undefined ? null : structuredClone(value);
    }

    async writeExact(target, state) {
        this.writeCount += 1;
        this.states.set(hashCanonical(target), structuredClone(state));
    }

    async persistRecovery(record) {
        this.recoveries.push(structuredClone(record));
    }

    async persistTransaction(transaction) {
        this.transactions.push(structuredClone(transaction));
    }

    current() {
        return structuredClone(this.states.get(hashCanonical(this.target)));
    }
}

test('phase-4 public entry validates Director commands before planning', () => {
    const target = fingerprint();
    const validated = validatedNativeCommand('item-use', {
        itemId: 'potion',
    }, target);
    assert.equal(validated.status, 'valid');
    assert.equal(validated.value.validationKind, 'director-domain-command');

    const forged = planDirectorDomainTransaction({
        validatedCommand: {
            ok: true,
            status: 'valid',
            value: {
                command: validated.value.command,
                target,
            },
            issues: [],
        },
        campaign: campaign(target),
        state: {},
    });
    assert.equal(forged.status, 'rejected');
    assert.ok(forged.issues.some((entry) => (
        entry.code === 'domain.director_command_invalid'
    )));
});

test('native domain authorization cannot be replayed onto another fingerprint', () => {
    const sourceTarget = fingerprint({
        messageId: 'message:authorization-source',
        content: 'authorization source',
    });
    const target = fingerprint({
        messageId: 'message:authorization-target',
        generation: 2,
        content: 'authorization target',
    });
    const authorizationId = 'authorization:item-use:source';
    const turn = createTurnBoundary({
        id: 'turn:authorization-source',
        branchId: sourceTarget.branchId,
        target: sourceTarget,
        authorizations: [{
            id: authorizationId,
            kind: 'resource-consumption',
            actorId: 'player',
            evidence: [evidence(sourceTarget.branchId)],
        }],
        negativeConstraints: [],
        claims: [],
        unselectedCandidateIds: [],
        protectedPlayerStateRefs: [],
        darkChoices: [],
    });
    const director = adjudicateTurnBoundary(turn.value, {
        contributions: [{
            id: 'contribution:item-use:source',
            actor: 'player',
            actorId: 'player',
            kind: 'resource-consumption',
            source: 'player-input',
        }],
    }, {
        currentFingerprint: sourceTarget,
        activeBranch: activeBranch(sourceTarget),
    });
    const validation = validateDirectorDomainCommand({
        command: {
            type: 'item-use',
            payload: {
                commandVersion: DOMAIN_COMMAND_VERSION,
                branchId: target.branchId,
                authorizationId,
                itemId: 'potion',
            },
        },
        target,
        currentFingerprint: target,
        activeBranch: activeBranch(target),
        sourceResult: director,
        evidence: [evidence(target.branchId)],
    });

    assert.equal(validation.status, 'rejected');
    assert.ok(validation.issues.some((entry) => (
        entry.code === 'domain.command_boundary_target_mismatch'
    )));
});

test('typed item use commits quantity and all effects atomically', async () => {
    const target = fingerprint();
    const potion = item();
    const validated = validatedNativeCommand('item-use', {
        itemId: potion.id,
    }, target);
    const config = campaign(target, {
        records: { item: { potion: '/items/potion' } },
        resources: [{
            resource: { ownerId: 'player', resourceId: 'hp' },
            path: '/resources/player/hp',
            minimum: 0,
            maximum: 100,
        }],
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                item: { path: '/items/potion', before: potion },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'hp' },
                path: '/resources/player/hp',
                before: 50,
            }],
        },
        createdAt: 100,
    });
    assert.equal(plan.status, 'valid');
    assert.equal(plan.value.transaction.kind, 'inventory');
    assert.deepEqual(
        plan.value.writePlan.map((entry) => entry.path).sort(),
        ['/items/potion', '/resources/player/hp'],
    );
    assert.ok(plan.value.transaction.preconditions.every((entry) => (
        entry.type === 'path-equals'
    )));

    const host = new MemoryHost(target, activeBranch(target), {
        items: { potion },
        resources: { player: { hp: 50 } },
    });
    const result = await executePlannedDomainTransaction(
        createTransactionKernel(host, { now: () => 101 }),
        plan,
    );
    assert.equal(result.status, 'committed');
    assert.equal(host.current().items.potion.quantity, 0);
    assert.equal(host.current().items.potion.revision, 1);
    assert.equal(host.current().resources.player.hp, 70);
    assert.equal(host.writeCount, 1);
});

test('semantic domain idempotency stays stable across reroll branches', () => {
    const firstTarget = fingerprint({
        branchId: 'branch:phase4:first',
        messageId: 'message:phase4:first',
        content: 'first generated reply',
    });
    const rerollTarget = fingerprint({
        branchId: 'branch:phase4:reroll',
        messageId: 'message:phase4:reroll',
        generation: 2,
        content: 'rerolled reply',
    });
    const potion = item();
    function itemPlan(target) {
        return planDirectorDomainTransaction({
            validatedCommand: validatedNativeCommand('item-use', {
                itemId: potion.id,
            }, target),
            campaign: campaign(target, {
                records: { item: { potion: '/items/potion' } },
                resources: [{
                    resource: { ownerId: 'player', resourceId: 'hp' },
                    path: '/resources/player/hp',
                    minimum: 0,
                    maximum: 100,
                }],
            }),
            state: {
                records: {
                    item: { path: '/items/potion', before: potion },
                },
                resources: [{
                    resource: { ownerId: 'player', resourceId: 'hp' },
                    path: '/resources/player/hp',
                    before: 50,
                }],
            },
        });
    }
    const first = itemPlan(firstTarget);
    const rerolled = itemPlan(rerollTarget);

    assert.equal(first.status, 'valid');
    assert.equal(rerolled.status, 'valid');
    assert.equal(first.value.idempotencyKey, rerolled.value.idempotencyKey);
    assert.notEqual(first.value.transaction.id, rerolled.value.transaction.id);
    assert.notEqual(
        first.value.transaction.branchId,
        rerolled.value.transaction.branchId,
    );
});

test('untyped consumable and insufficient resources never produce partial writes', async () => {
    const target = fingerprint();
    const untyped = item({ effects: [] });
    const validated = validatedNativeCommand('item-use', {
        itemId: 'potion',
    }, target);
    const config = campaign(target, {
        records: { item: { potion: '/items/potion' } },
    });
    const rejected = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                item: { path: '/items/potion', before: untyped },
            },
        },
    });
    assert.equal(rejected.status, 'unresolved');
    assert.equal(rejected.value.transaction, null);
    assert.ok(rejected.issues.some((entry) => (
        entry.code === 'item.missing_typed_effect'
    )));

    const host = new MemoryHost(target, activeBranch(target), {
        items: { potion: untyped },
        resources: { player: { hp: 50 } },
    });
    const result = await executePlannedDomainTransaction(
        createTransactionKernel(host),
        rejected,
    );
    assert.notEqual(result.status, 'committed');
    assert.equal(host.writeCount, 0);
    assert.equal(host.current().items.potion.quantity, 1);
    assert.equal(host.current().resources.player.hp, 50);
});

test('skill costs use typed multi-resource bindings and fail as one unit', async () => {
    const target = fingerprint();
    const skill = {
        ...baseRecord('skill:hack'),
        name: '基础骇入协议',
        mode: 'active',
        costs: [
            {
                resource: { ownerId: 'player', resourceId: 'mp' },
                amount: 20,
                timing: 'on-start',
                refundable: false,
            },
            {
                resource: { ownerId: 'player', resourceId: 'stamina' },
                amount: 15,
                timing: 'on-start',
                refundable: false,
            },
        ],
        effects: [],
        displayCost: '20MP + 15耐力',
        provenance: [evidence()],
    };
    const validated = validatedNativeCommand('skill-use', {
        skillId: skill.id,
        timing: 'on-start',
    }, target);
    const config = campaign(target, {
        records: { skill: { [skill.id]: '/skills/hack' } },
        resources: [
            {
                resource: { ownerId: 'player', resourceId: 'mp' },
                path: '/resources/mp',
                minimum: 0,
            },
            {
                resource: { ownerId: 'player', resourceId: 'stamina' },
                path: '/resources/stamina',
                minimum: 0,
            },
        ],
    });
    const insufficient = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                skill: { path: '/skills/hack', before: skill },
            },
            resources: [
                {
                    resource: { ownerId: 'player', resourceId: 'mp' },
                    path: '/resources/mp',
                    before: 30,
                },
                {
                    resource: { ownerId: 'player', resourceId: 'stamina' },
                    path: '/resources/stamina',
                    before: 10,
                },
            ],
        },
    });
    assert.equal(insufficient.status, 'rejected');
    assert.ok(insufficient.issues.some((entry) => (
        entry.code === 'domain.resource_insufficient'
    )));

    const host = new MemoryHost(target, activeBranch(target), {
        skills: { hack: skill },
        resources: { mp: 30, stamina: 10 },
    });
    const failed = await executePlannedDomainTransaction(
        createTransactionKernel(host),
        insufficient,
    );
    assert.notEqual(failed.status, 'committed');
    assert.deepEqual(host.current().resources, { mp: 30, stamina: 10 });
    assert.equal(host.writeCount, 0);
});

test('equipment wear updates item, contract, slots, and rejects wrong slots', async () => {
    const target = fingerprint();
    const torso = { system: 'campaign-slots', slot: 'torso' };
    const legs = { system: 'campaign-slots', slot: 'legs' };
    const vestItem = item({
        id: 'item:vest',
        kind: 'equipment',
        quantity: 1,
        effects: [],
    });
    const equipment = {
        ...baseRecord('equipment:vest'),
        itemId: vestItem.id,
        allowedSlots: [torso],
        occupies: [torso],
        equippedAt: [],
        bonuses: [],
        provenance: [evidence()],
    };
    const config = campaign(target, {
        records: {
            item: { [vestItem.id]: '/inventory/vest' },
            equipment: { [equipment.id]: '/equipment/vest' },
        },
        slotTaxonomy: [torso, legs],
        slotBindings: [
            { slot: torso, path: '/loadout/torso' },
            { slot: legs, path: '/loadout/legs' },
        ],
    });
    const wrong = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('equipment-equip', {
            equipmentId: equipment.id,
            itemId: vestItem.id,
            slots: [legs],
        }, target),
        campaign: config,
        state: {
            records: {
                equipment: { path: '/equipment/vest', before: equipment },
                item: { path: '/inventory/vest', before: vestItem },
            },
            slots: [
                { slot: torso, path: '/loadout/torso', before: null },
                { slot: legs, path: '/loadout/legs', before: null },
            ],
        },
    });
    assert.equal(wrong.status, 'rejected');
    assert.ok(wrong.issues.some((entry) => entry.code === 'equipment.slot_mismatch'));

    const plan = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('equipment-equip', {
            equipmentId: equipment.id,
            itemId: vestItem.id,
            slots: [torso],
        }, target),
        campaign: config,
        state: {
            records: {
                equipment: { path: '/equipment/vest', before: equipment },
                item: { path: '/inventory/vest', before: vestItem },
            },
            slots: [
                { slot: torso, path: '/loadout/torso', before: null },
                { slot: legs, path: '/loadout/legs', before: null },
            ],
        },
    });
    assert.equal(plan.status, 'valid');
    const host = new MemoryHost(target, activeBranch(target), {
        inventory: { vest: vestItem },
        equipment: { vest: equipment },
        loadout: { torso: null, legs: null },
    });
    const result = await executePlannedDomainTransaction(
        createTransactionKernel(host),
        plan,
    );
    assert.equal(result.status, 'committed');
    assert.equal(host.current().inventory.vest.quantity, 0);
    assert.deepEqual(host.current().equipment.vest.equippedAt, [torso]);
    assert.equal(host.current().loadout.torso, vestItem.id);
    assert.equal(host.current().loadout.legs, null);

    const repeatedEquip = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('equipment-equip', {
            equipmentId: equipment.id,
            itemId: vestItem.id,
            slots: [torso],
        }, target),
        campaign: config,
        state: {
            records: {
                equipment: {
                    path: '/equipment/vest',
                    before: host.current().equipment.vest,
                },
                item: {
                    path: '/inventory/vest',
                    before: {
                        ...host.current().inventory.vest,
                        quantity: 1,
                    },
                },
            },
            slots: [
                {
                    slot: torso,
                    path: '/loadout/torso',
                    before: vestItem.id,
                },
                { slot: legs, path: '/loadout/legs', before: null },
            ],
        },
    });
    assert.equal(repeatedEquip.status, 'rejected');
    assert.ok(repeatedEquip.issues.some((entry) => (
        entry.code === 'domain.equipment_already_equipped'
    )));
});

test('equipment removal reverses bonuses and slot transfer never reapplies them', async () => {
    const target = fingerprint();
    const torso = { system: 'campaign-slots', slot: 'torso' };
    const outerwear = { system: 'campaign-slots', slot: 'outerwear' };
    const coatItem = item({
        id: 'item:coat',
        kind: 'equipment',
        quantity: 0,
        effects: [],
    });
    const equipped = {
        ...baseRecord('equipment:coat'),
        itemId: coatItem.id,
        allowedSlots: [torso],
        occupies: [torso],
        equippedAt: [torso],
        bonuses: [{
            type: 'resource-delta',
            delta: {
                resource: { ownerId: 'player', resourceId: 'armor' },
                amount: 5,
                reason: 'coat armor',
            },
        }],
        provenance: [evidence()],
    };
    const removalConfig = campaign(target, {
        records: {
            item: { [coatItem.id]: '/inventory/coat' },
            equipment: { [equipped.id]: '/equipment/coat' },
        },
        resources: [{
            resource: { ownerId: 'player', resourceId: 'armor' },
            path: '/resources/armor',
            minimum: 0,
        }],
        slotTaxonomy: [torso],
        slotBindings: [{ slot: torso, path: '/loadout/torso' }],
    });
    const removal = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('equipment-unequip', {
            equipmentId: equipped.id,
            itemId: coatItem.id,
        }, target),
        campaign: removalConfig,
        state: {
            records: {
                equipment: { path: '/equipment/coat', before: equipped },
                item: { path: '/inventory/coat', before: coatItem },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'armor' },
                path: '/resources/armor',
                before: 5,
            }],
            slots: [{
                slot: torso,
                path: '/loadout/torso',
                before: coatItem.id,
            }],
        },
    });
    assert.equal(removal.status, 'valid');
    const removalHost = new MemoryHost(target, activeBranch(target), {
        inventory: { coat: coatItem },
        equipment: { coat: equipped },
        resources: { armor: 5 },
        loadout: { torso: coatItem.id },
    });
    const removed = await executePlannedDomainTransaction(
        createTransactionKernel(removalHost),
        removal,
    );
    assert.equal(removed.status, 'committed');
    assert.equal(removalHost.current().inventory.coat.quantity, 1);
    assert.deepEqual(removalHost.current().equipment.coat.equippedAt, []);
    assert.equal(removalHost.current().resources.armor, 0);
    assert.equal(removalHost.current().loadout.torso, null);

    const transferable = {
        ...baseRecord('equipment:scarf'),
        itemId: 'item:scarf',
        allowedSlots: [torso, outerwear],
        occupies: [],
        equippedAt: [torso],
        bonuses: [{
            type: 'resource-delta',
            delta: {
                resource: { ownerId: 'player', resourceId: 'style' },
                amount: 2,
                reason: 'scarf style',
            },
        }],
        provenance: [evidence()],
    };
    const transfer = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('equipment-transfer', {
            equipmentId: transferable.id,
            itemId: transferable.itemId,
            slots: [outerwear],
        }, target),
        campaign: campaign(target, {
            records: {
                equipment: { [transferable.id]: '/equipment/scarf' },
            },
            slotTaxonomy: [torso, outerwear],
            slotBindings: [
                { slot: torso, path: '/loadout/torso' },
                { slot: outerwear, path: '/loadout/outerwear' },
            ],
        }),
        state: {
            records: {
                equipment: {
                    path: '/equipment/scarf',
                    before: transferable,
                },
            },
            slots: [
                {
                    slot: torso,
                    path: '/loadout/torso',
                    before: transferable.itemId,
                },
                {
                    slot: outerwear,
                    path: '/loadout/outerwear',
                    before: null,
                },
            ],
        },
    });
    assert.equal(transfer.status, 'valid');
    assert.equal(
        transfer.value.transaction.effects.some((effect) => (
            effect.type === 'resource-delta'
        )),
        false,
    );
    const transferHost = new MemoryHost(target, activeBranch(target), {
        equipment: { scarf: transferable },
        loadout: {
            torso: transferable.itemId,
            outerwear: null,
        },
    });
    const transferred = await executePlannedDomainTransaction(
        createTransactionKernel(transferHost),
        transfer,
    );
    assert.equal(transferred.status, 'committed');
    assert.equal(transferHost.current().loadout.torso, null);
    assert.equal(transferHost.current().loadout.outerwear, transferable.itemId);
});

test('social audit reverts ordinary kindness and separates coercive axes', async () => {
    const target = fingerprint();
    const before = {
        ...baseRecord('social:npc-player'),
        fromActorId: 'npc',
        toActorId: 'player',
        voluntary: { affection: 18, trust: 22 },
        coercive: { obedience: 0, sourceIds: [] },
        labels: ['acquaintance'],
        evidence: [evidence()],
        branchId: target.branchId,
    };
    const ordinary = {
        ...structuredClone(before),
        voluntary: { affection: 127, trust: 138 },
        labels: ['domesticated', 'fanatical'],
    };
    const config = campaign(target, {
        records: { social: { [before.id]: '/social/link' } },
    });
    const ordinaryPlan = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('social-transition', {
            socialId: before.id,
            voluntaryEvidence: false,
            coerciveEvidence: false,
            labelEvidence: false,
        }, target),
        campaign: config,
        state: {
            records: {
                social: {
                    path: '/social/link',
                    before,
                    candidate: ordinary,
                },
            },
        },
    });
    assert.equal(ordinaryPlan.status, 'valid');
    assert.equal(ordinaryPlan.value.decision, 'revert');
    assert.equal(ordinaryPlan.value.transaction, null);
    assert.ok(ordinaryPlan.value.domainResults.some((entry) => (
        entry.revertedPaths?.includes('$.labels')
    )));

    const coerced = {
        ...structuredClone(before),
        voluntary: { affection: 72, trust: 65 },
        coercive: { obedience: 80, sourceIds: ['threat:event'] },
    };
    const coercedPlan = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('social-transition', {
            socialId: before.id,
            voluntaryEvidence: false,
            coerciveEvidence: ['obedience'],
            labelEvidence: false,
        }, target),
        campaign: config,
        state: {
            records: {
                social: {
                    path: '/social/link',
                    before,
                    candidate: coerced,
                },
            },
        },
    });
    assert.equal(coercedPlan.status, 'valid');
    const host = new MemoryHost(target, activeBranch(target), {
        social: { link: before },
    });
    const result = await executePlannedDomainTransaction(
        createTransactionKernel(host),
        coercedPlan,
    );
    assert.equal(result.status, 'committed');
    assert.deepEqual(host.current().social.link.voluntary, before.voluntary);
    assert.equal(host.current().social.link.coercive.obedience, 80);
});

test('quest terminal settlement is atomic, idempotent, and cannot reopen', async () => {
    const target = fingerprint();
    const before = {
        ...baseRecord('quest:escort'),
        title: '护送向导',
        status: 'active',
        branchId: target.branchId,
        objectives: [{
            id: 'objective:escort',
            description: '护送到门口',
            status: 'active',
            evidence: [evidence()],
        }],
        settlementTransactionIds: [],
    };
    const cancelled = {
        ...structuredClone(before),
        status: 'cancelled',
        objectives: [{
            ...structuredClone(before.objectives[0]),
            status: 'cancelled',
        }],
        terminalEvidence: [evidence(target.branchId, 'state', 'quest:cancelled')],
    };
    const command = validatedNativeCommand('quest-transition', {
        questId: before.id,
        terminalStatus: 'cancelled',
        resourceDeltas: [{
            resource: { ownerId: 'player', resourceId: 'gold' },
            amount: 10,
            reason: 'cancel settlement',
        }],
    }, target);
    const config = campaign(target, {
        records: { quest: { [before.id]: '/quests/escort' } },
        resources: [{
            resource: { ownerId: 'player', resourceId: 'gold' },
            path: '/resources/gold',
            minimum: 0,
        }],
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: command,
        campaign: config,
        state: {
            records: {
                quest: {
                    path: '/quests/escort',
                    before,
                    candidate: cancelled,
                },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'gold' },
                path: '/resources/gold',
                before: 0,
            }],
        },
        createdAt: 100,
    });
    assert.equal(plan.status, 'valid');
    assert.ok(
        plan.value.writePlan.find((entry) => entry.path === '/quests/escort')
            .value.settlementTransactionIds.includes(plan.value.transaction.id),
    );
    const host = new MemoryHost(target, activeBranch(target), {
        quests: { escort: before },
        resources: { gold: 0 },
    });
    const kernel = createTransactionKernel(host, { now: () => 101 });
    const firstPrepared = await preparePlannedDomainTransaction(kernel, plan);
    const secondPrepared = await preparePlannedDomainTransaction(kernel, plan);
    const first = await kernel.commit(firstPrepared);
    const second = await kernel.commit(secondPrepared);
    assert.equal(first.status, 'committed');
    assert.equal(second.status, 'duplicate');
    assert.equal(host.current().resources.gold, 10);
    assert.equal(host.current().quests.escort.status, 'cancelled');
    assert.equal(host.writeCount, 1);

    const reopened = planDirectorDomainTransaction({
        validatedCommand: validatedNativeCommand('quest-transition', {
            questId: before.id,
            terminalStatus: 'active',
            resourceDeltas: [],
        }, target),
        campaign: config,
        state: {
            records: {
                quest: {
                    path: '/quests/escort',
                    before: host.current().quests.escort,
                    candidate: {
                        ...host.current().quests.escort,
                        status: 'active',
                        terminalEvidence: undefined,
                    },
                },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'gold' },
                path: '/resources/gold',
                before: 10,
            }],
        },
    });
    assert.equal(reopened.status, 'rejected');
    assert.ok(reopened.issues.some((entry) => entry.code === 'quest.terminal_reopen'));

    const forgedSettlementHistory = planDirectorDomainTransaction({
        validatedCommand: command,
        campaign: config,
        state: {
            records: {
                quest: {
                    path: '/quests/escort',
                    before,
                    candidate: {
                        ...cancelled,
                        settlementTransactionIds: ['transaction:forged'],
                    },
                },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'gold' },
                path: '/resources/gold',
                before: 0,
            }],
        },
    });
    assert.equal(forgedSettlementHistory.status, 'rejected');
    assert.ok(forgedSettlementHistory.issues.some((entry) => (
        entry.code === 'domain.quest_settlement_history_mismatch'
    )));
});

test('quest supersession creates its replacement and settles resources once', async () => {
    const target = fingerprint();
    const before = {
        ...baseRecord('quest:old-route'),
        title: 'Old route',
        status: 'active',
        branchId: target.branchId,
        objectives: [{
            id: 'objective:old-route',
            description: 'Follow the old route',
            status: 'active',
            evidence: [evidence()],
        }],
        settlementTransactionIds: [],
    };
    const candidate = {
        ...structuredClone(before),
        status: 'superseded',
        objectives: [{
            ...structuredClone(before.objectives[0]),
            status: 'cancelled',
        }],
        terminalEvidence: [
            evidence(target.branchId, 'state', 'quest:superseded'),
        ],
    };
    const replacement = {
        ...baseRecord('quest:new-route'),
        title: 'New route',
        status: 'active',
        branchId: target.branchId,
        objectives: [{
            id: 'objective:new-route',
            description: 'Follow the replacement route',
            status: 'active',
            evidence: [evidence()],
        }],
        settlementTransactionIds: [],
    };
    const validated = validatedNativeCommand('quest-supersede', {
        questId: before.id,
        replacementQuestId: replacement.id,
        resourceDeltas: [{
            resource: { ownerId: 'player', resourceId: 'gold' },
            amount: 5,
            reason: 'supersession settlement',
        }],
    }, target);
    const config = campaign(target, {
        records: {
            quest: {
                [before.id]: '/quests/old',
                [replacement.id]: '/quests/new',
            },
        },
        resources: [{
            resource: { ownerId: 'player', resourceId: 'gold' },
            path: '/resources/gold',
            minimum: 0,
        }],
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                quest: {
                    path: '/quests/old',
                    before,
                    candidate,
                },
                replacementQuest: {
                    path: '/quests/new',
                    found: false,
                    after: replacement,
                },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'gold' },
                path: '/resources/gold',
                before: 0,
            }],
        },
        createdAt: 200,
    });
    assert.equal(plan.status, 'valid');
    assert.ok(plan.value.transaction.preconditions.some((entry) => (
        entry.type === 'path-absent' && entry.path === '/quests/new'
    )));
    const oldAfter = plan.value.writePlan.find((entry) => (
        entry.path === '/quests/old'
    )).value;
    assert.equal(oldAfter.status, 'superseded');
    assert.equal(oldAfter.supersededBy, replacement.id);
    assert.equal(oldAfter.settlementTransactionIds.length, 1);

    const host = new MemoryHost(target, activeBranch(target), {
        quests: { old: before },
        resources: { gold: 0 },
    });
    const kernel = createTransactionKernel(host);
    const firstPrepared = await preparePlannedDomainTransaction(kernel, plan);
    const secondPrepared = await preparePlannedDomainTransaction(kernel, plan);
    const first = await kernel.commit(firstPrepared);
    const second = await kernel.commit(secondPrepared);
    assert.equal(first.status, 'committed');
    assert.equal(second.status, 'duplicate');
    assert.equal(host.current().quests.old.status, 'superseded');
    assert.equal(host.current().quests.new.id, replacement.id);
    assert.equal(host.current().resources.gold, 5);
    assert.equal(host.writeCount, 1);
});

test('H2 check confirms a candidate Fact only after explicit success evidence', async () => {
    const target = fingerprint();
    const branch = activeBranch(target);
    const director = adjudicateClaim({
        claim: {
            id: 'claim:checkpoint',
            factId: 'fact:checkpoint',
            proposition: 'The guard accepts this passage attempt',
            branchId: target.branchId,
            subjectIds: ['guard'],
            evidence: [evidence()],
        },
        assessment: {
            impact: 'material',
            mechanicalAdvantage: true,
            semanticBasis: ['passage grants a material advantage'],
        },
        context: {
            target,
            currentFingerprint: target,
            activeBranch: branch,
            h2Resolution: {
                type: 'check',
                checkId: 'campaign:passage',
                difficulty: 14,
            },
        },
    });
    assert.equal(director.status, 'valid');
    const command = director.adjudication.commands.find((entry) => (
        entry.type === 'check'
    ));
    const validated = validateDirectorDomainCommand({
        command,
        target,
        currentFingerprint: target,
        activeBranch: branch,
        sourceResult: director,
        evidence: [evidence()],
    });
    const config = campaign(target, {
        records: { fact: { [director.fact.id]: '/facts/checkpoint' } },
        checks: [{ checkId: 'campaign:passage' }],
    });
    const failure = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                fact: { path: '/facts/checkpoint', before: director.fact },
            },
            checkResult: {
                checkId: 'campaign:passage',
                outcome: 'failure',
                evidence: [evidence(target.branchId, 'roll', 'roll:failure')],
            },
        },
    });
    assert.equal(failure.status, 'valid');
    assert.equal(failure.value.decision, 'hold');
    assert.equal(failure.value.transaction, null);

    const success = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                fact: { path: '/facts/checkpoint', before: director.fact },
            },
            checkResult: {
                checkId: 'campaign:passage',
                outcome: 'success',
                evidence: [evidence(target.branchId, 'roll', 'roll:success')],
            },
        },
    });
    assert.equal(success.status, 'valid');
    const host = new MemoryHost(target, branch, {
        facts: { checkpoint: director.fact },
    });
    const result = await executePlannedDomainTransaction(
        createTransactionKernel(host),
        success,
    );
    assert.equal(result.status, 'committed');
    assert.equal(host.current().facts.checkpoint.status, 'confirmed');
});

test('H2 cost confirms its candidate Fact only in the successful compound commit', async () => {
    const target = fingerprint();
    const branch = activeBranch(target);
    const director = adjudicateClaim({
        claim: {
            id: 'claim:passage',
            factId: 'fact:passage',
            proposition: '守卫允许本次通行',
            branchId: target.branchId,
            subjectIds: ['guard'],
            evidence: [evidence()],
        },
        assessment: {
            impact: 'material',
            mechanicalAdvantage: true,
            semanticBasis: ['通行属于显著机械优势'],
        },
        context: {
            target,
            currentFingerprint: target,
            activeBranch: branch,
            h2Resolution: {
                type: 'cost',
                resource: { ownerId: 'player', resourceId: 'favor' },
                amount: 1,
                reason: '支付一份人情',
            },
        },
    });
    assert.equal(director.status, 'valid');
    assert.equal(director.fact.status, 'candidate');
    const command = director.adjudication.commands.find((entry) => entry.type === 'cost');
    const validated = validateDirectorDomainCommand({
        command,
        target,
        currentFingerprint: target,
        activeBranch: branch,
        sourceResult: director,
        evidence: [evidence()],
    });
    assert.equal(validated.status, 'valid');
    const config = campaign(target, {
        records: { fact: { [director.fact.id]: '/facts/passage' } },
        resources: [{
            resource: { ownerId: 'player', resourceId: 'favor' },
            path: '/resources/favor',
            minimum: 0,
        }],
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                fact: { path: '/facts/passage', before: director.fact },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'favor' },
                path: '/resources/favor',
                before: 1,
            }],
            resolutionEvidence: [
                evidence(target.branchId, 'rule', 'campaign:h2-cost'),
            ],
        },
    });
    assert.equal(plan.status, 'valid');
    const host = new MemoryHost(target, branch, {
        facts: { passage: director.fact },
        resources: { favor: 1 },
    });
    const result = await executePlannedDomainTransaction(
        createTransactionKernel(host),
        plan,
    );
    assert.equal(result.status, 'committed');
    assert.equal(host.current().resources.favor, 0);
    assert.equal(host.current().facts.passage.status, 'confirmed');

    const insufficient = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: config,
        state: {
            records: {
                fact: { path: '/facts/passage', before: director.fact },
            },
            resources: [{
                resource: { ownerId: 'player', resourceId: 'favor' },
                path: '/resources/favor',
                before: 0,
            }],
            resolutionEvidence: [
                evidence(target.branchId, 'rule', 'campaign:h2-cost'),
            ],
        },
    });
    assert.equal(insufficient.status, 'rejected');
    assert.equal(insufficient.value.transaction, null);
});

test('H3 new-branch command is preserved as a branch boundary, not a write', () => {
    const target = fingerprint();
    const director = adjudicateClaim({
        claim: {
            id: 'claim:retcon',
            factId: 'fact:retcon',
            proposition: '改写已确认历史',
            branchId: target.branchId,
            subjectIds: [],
            evidence: [evidence()],
        },
        assessment: {
            impact: 'structural',
            contradictsConfirmedFact: true,
            semanticBasis: ['结构化事实冲突'],
        },
        context: {
            target,
            currentFingerprint: target,
            activeBranch: activeBranch(target),
            explicitRetcon: true,
            checkpointRef: 'checkpoint:phase4',
        },
    });
    const command = director.adjudication.commands[0];
    const validated = validateDirectorDomainCommand({
        command,
        target,
        activeBranch: activeBranch(target),
        sourceResult: director,
        evidence: [evidence()],
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand: validated,
        campaign: campaign(target),
        state: {},
    });
    assert.equal(plan.status, 'valid');
    assert.equal(plan.value.decision, 'branch-required');
    assert.equal(plan.value.transaction, null);
});

test('5.4.1-shaped legacy projection is lazy, visible, and preserves unknown fields', () => {
    const entries = [
        {
            id: 'legacy:item-material',
            kind: 'item',
            source: {
                id: 'legacy:item-material',
                name: '雾银粉',
                kind: 'material',
                quantity: 2,
                stackable: true,
                description: '炼金材料',
                作者字段: { 稀有度: '雨夜' },
            },
        },
        {
            id: 'legacy:potion',
            kind: 'item',
            source: {
                id: 'legacy:potion',
                name: '强效治疗药剂',
                kind: 'consumable',
                quantity: 1,
                stackable: false,
                description: '恢复大量生命',
            },
            options: { mechanicalEffectClaimed: true },
        },
        {
            id: 'legacy:coat',
            kind: 'equipment',
            source: {
                id: 'legacy:coat',
                itemId: 'item:coat',
                当前槽位: 'outerwear',
                作者注释: '保留',
            },
            options: { slotSystem: 'campaign-slots' },
        },
        {
            id: 'legacy:skill',
            kind: 'skill',
            source: {
                id: 'legacy:skill',
                name: '基础骇入协议',
                mode: 'active',
                costText: '20MP',
                effects: [],
            },
        },
        {
            id: 'legacy:social',
            kind: 'social',
            source: {
                id: 'legacy:social',
                fromActorId: 'npc',
                toActorId: 'player',
                关系分数: 90,
                labels: ['旧标签'],
                evidence: [],
                branchId: 'branch-phase4',
            },
            options: { ambiguousRelationFields: ['关系分数'] },
        },
        {
            id: 'legacy:quest',
            kind: 'quest',
            source: {
                id: 'legacy:quest',
                title: '冲突旧任务',
                status: 'active',
                ended: true,
                branchId: 'branch-phase4',
                objectives: [],
                settlementTransactionIds: [],
            },
        },
    ];
    const lazy = createLazyLegacyDomainProjection({ entries });
    assert.equal(lazy.size, entries.length);
    assert.ok(lazy.diagnostics().every((entry) => entry.status === 'pending'));
    const material = lazy.get('legacy:item-material');
    assert.equal(material.status, 'valid');
    assert.deepEqual(
        material.value.extensions.legacy.作者字段,
        { 稀有度: '雨夜' },
    );
    assert.equal(
        lazy.diagnostics().find((entry) => entry.id === 'legacy:item-material').status,
        'mapped',
    );
    assert.equal(
        lazy.diagnostics().find((entry) => entry.id === 'legacy:potion').status,
        'pending',
    );

    const diagnosed = diagnoseLegacyDomainProjection({ entries });
    assert.equal(diagnosed.summary.total, entries.length);
    assert.equal(diagnosed.summary.mapped, 1);
    assert.ok(diagnosed.summary.unresolved >= 4);
    assert.equal(diagnosed.summary.quarantined, 1);
    assert.ok(diagnosed.diagnostics.every((entry) => entry.canTransact === (
        entry.status === 'mapped'
    )));
    assert.equal(entries[0].source.作者字段.稀有度, '雨夜');
});
