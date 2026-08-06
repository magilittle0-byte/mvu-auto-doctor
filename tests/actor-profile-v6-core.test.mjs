import assert from 'node:assert/strict';
import test from 'node:test';

import {
    actorProfileReadyForAction,
    actorProfileV6View,
    applyActorProfileV6Override,
    prepareActorLedgerProfilesV6,
    prepareActorProfileV6,
    regenerateActorProfileV6Module,
    setActorProfileV6Lock,
} from '../actor-profile-v6-core.mjs';

function actor(id = 'NPC-ADA', name = '艾达') {
    return {
        id,
        name,
        status: 'active',
        identity: {
            role: '',
            aliases: [],
            traits: [],
            desires: [],
            boundaries: [],
            socialStyle: '',
            decisionStyle: '',
            speechStyle: '',
            everydayHabits: [],
            blindSpots: [],
        },
        lineage: { rootActorId: id, currentForm: name, forms: [] },
        longTermGoals: [],
        currentGoals: [],
        constraints: [],
        stateFacts: [],
        knowledge: [],
        location: { name: '港口', evidence: ['scene:port'] },
        resources: [],
        capabilities: [],
        relationships: [],
        commitments: [],
        stimuli: [],
        actionHistory: [],
        plan: { summary: '', status: 'active' },
        evidence: ['scene:port'],
    };
}

test('full completion prepares every actor before first formal action with varied designed seeds', () => {
    const ledger = { turn: 3, actors: [actor('NPC-A', '艾达'), actor('NPC-B', '贝拉')] };
    const result = prepareActorLedgerProfilesV6(ledger, { mode: 'full', turn: 3, now: 100 });
    assert.equal(result.coverage, 100);
    assert.equal(result.prepared.length, 2);
    assert.equal(result.ledger.actors.every(actorProfileReadyForAction), true);
    assert.notEqual(
        result.ledger.actors[0].profileV6.modules.personality.data.socialStyle,
        result.ledger.actors[1].profileV6.modules.personality.data.socialStyle,
    );
    assert.equal(
        result.ledger.actors.every((entry) => (
            entry.profileV6.modules.actionHistory.data.historicalActionsInvented === false
        )),
        true,
    );
});

test('confirmed card or narrative facts remain confirmed while designed gaps are labeled', () => {
    const ada = actor();
    ada.identity.role = '港口抄写员';
    ada.identity.speechStyle = '先复述问题，再给出短答案';
    ada.longTermGoals = ['攒钱赎回旧宅'];
    const profile = prepareActorProfileV6(ada, { mode: 'full', turn: 2, now: 100 });
    assert.equal(profile.modules.identity.source, 'confirmed');
    assert.equal(profile.modules.personality.source, 'confirmed');
    assert.equal(profile.modules.goals.source, 'confirmed');
    assert.equal(profile.modules.resourcesCapabilities.data.noUnconfirmedAbilityGranted, true);
});

test('completion off leaves an incomplete new actor out of formal action scheduling', () => {
    const profile = prepareActorProfileV6(actor(), { mode: 'off', turn: 1 });
    assert.equal(profile.preparedForAction, false);
    assert.equal(profile.backgroundPending, true);
});

test('adult physiology is optional complete schema and never infers morality or personality', () => {
    const profile = prepareActorProfileV6(actor(), { mode: 'full_adult', turn: 1 });
    const physiology = profile.modules.physiology.data;
    assert.equal(physiology.enabled, true);
    assert.equal(physiology.adultEnabled, true);
    assert.equal(physiology.personalityInferenceAllowed, false);
    assert.ok(physiology.reproductiveAnatomy);
    assert.ok(physiology.morphology);
    assert.ok(physiology.sensitivity);
    assert.ok(physiology.physiologicalResponses);
    assert.ok(physiology.secretionCycle);
    assert.ok(physiology.fertility);
    assert.ok(physiology.specialSpecies);
    assert.ok(physiology.currentBodyState);
});

test('manual overrides, locks, module regeneration and version history are durable', () => {
    const ada = actor();
    let profile = prepareActorProfileV6(ada, { mode: 'full', turn: 1, now: 100 });
    const overridden = applyActorProfileV6Override(profile, {
        path: 'modules.personality.data.speechStyle',
        value: '只在确认事实后下结论',
        turn: 2,
        now: 200,
    });
    assert.equal(overridden.applied, true);
    profile = setActorProfileV6Lock(overridden.profile, {
        path: 'modules.personality',
        locked: true,
    });
    const regenerated = regenerateActorProfileV6Module(profile, ada, {
        module: 'personality',
        turn: 3,
        now: 300,
    });
    assert.equal(regenerated.regenerated, false);
    assert.equal(regenerated.reason, 'module_locked');
    assert.equal(profile.history.length > 0, true);
});

test('field, module and actor locks survive later automatic profile preparation', () => {
    const ada = actor();
    let profile = prepareActorProfileV6(ada, { mode: 'full', turn: 1, now: 100 });
    const overridden = applyActorProfileV6Override(profile, {
        path: 'modules.personality.data.speechStyle',
        value: '先核实来源，再用一句话回答',
        turn: 2,
        now: 200,
    });
    profile = setActorProfileV6Lock(overridden.profile, {
        path: 'modules.personality.data.speechStyle',
        locked: true,
    });
    profile = setActorProfileV6Lock(profile, {
        path: 'modules.personality',
        locked: true,
    });
    const preparedAgain = prepareActorProfileV6({ ...ada, profileV6: profile }, {
        mode: 'full_adult',
        turn: 3,
        now: 300,
    });
    assert.equal(
        preparedAgain.modules.personality.data.speechStyle,
        '先核实来源，再用一句话回答',
    );
    assert.equal(
        preparedAgain.manualOverrides['modules.personality.data.speechStyle'],
        '先核实来源，再用一句话回答',
    );
    assert.equal(preparedAgain.locks['modules.personality'], true);

    const actorLocked = setActorProfileV6Lock(preparedAgain, { path: 'actor', locked: true });
    const rejectedOverride = applyActorProfileV6Override(actorLocked, {
        path: 'modules.identity.data.role',
        value: '越权改写',
        turn: 4,
    });
    assert.equal(rejectedOverride.applied, false);
    assert.equal(rejectedOverride.reason, 'field_locked');
    const rejectedRegeneration = regenerateActorProfileV6Module(actorLocked, ada, {
        module: 'identity',
        turn: 4,
    });
    assert.equal(rejectedRegeneration.regenerated, false);
    assert.equal(rejectedRegeneration.reason, 'module_locked');
});

test('diagnostic view exposes source and counts without profile prose', () => {
    const ada = actor();
    ada.profileV6 = prepareActorProfileV6(ada, { mode: 'full', turn: 1 });
    const view = actorProfileV6View(ada);
    const serialized = JSON.stringify(view);
    assert.equal(view.coverage, 100);
    assert.equal(serialized.includes(ada.profileV6.modules.personality.data.socialStyle), false);
    assert.equal(view.physiologyInfersPersonality, false);
});
