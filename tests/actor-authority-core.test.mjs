import assert from 'node:assert/strict';
import test from 'node:test';

import {
    actorActionNarrativeInjection,
    adjudicateActorActionAttempt,
    containsForgedPlayerSettlement,
    createActorActionAttempt,
    discloseActorActionResult,
    independentWorldProcessEvent,
    worldEventFromSettledActionReceipt,
} from '../actor-authority-core.mjs';

const actor = {
    id: 'NPC-ADA',
    name: '艾达',
    resources: [{ id: 'coins', amount: 5 }],
    capabilities: ['谈判'],
};

test('foreground player target settles only NPC attempt and never player participation consent or feeling', () => {
    const attempt = createActorActionAttempt({
        actorId: actor.id,
        actorName: actor.name,
        candidateAction: '艾达邀请玩家一起检查仓库',
        interactionTargets: [],
        stateChanges: [{ kind: 'plan', summary: '提出共同检查仓库的邀请' }],
        evidence: ['scene:warehouse'],
    }, { actor, turn: 3, playerNames: ['Roy'] });
    const settled = adjudicateActorActionAttempt(attempt, { actor });
    assert.equal(attempt.route, 'foreground_offer');
    assert.equal(settled.result.status, 'pending_player');
    assert.deepEqual(settled.result.appliedStateChanges, [{
        kind: 'attempt',
        summary: '艾达邀请玩家一起检查仓库',
    }]);
    assert.equal(containsForgedPlayerSettlement(settled.result), false);
    const injection = actorActionNarrativeInjection(attempt, settled.result);
    assert.equal(injection.includesAttempt, true);
    assert.equal(injection.includesResult, false);
    assert.equal(injection.includesPlayerAction, false);
    assert.equal(injection.includesPlayerConsent, false);
    assert.equal(injection.includesPlayerFeeling, false);
});

test('background NPC result is settled with time cost risk and receipt but remains hidden by default', () => {
    const attempt = createActorActionAttempt({
        actorId: actor.id,
        actorName: actor.name,
        candidateAction: '艾达私下核对三份货单',
        stateChanges: [{ kind: 'knowledge', summary: '发现一处账目时间不一致' }],
        resourceCosts: [{ resourceId: 'coins', amount: 1 }],
        capabilityUsed: '谈判',
        evidence: ['ledger:3'],
    }, { actor, turn: 4 });
    const settled = adjudicateActorActionAttempt(attempt, {
        actor,
        durationTurns: 1,
        risk: 'low',
        cost: ['one-hour'],
    });
    assert.equal(attempt.route, 'background_private');
    assert.equal(settled.result.status, 'settled');
    assert.equal(settled.result.visibility, 'hidden');
    assert.equal(settled.result.disclosure, 'pending');
    assert.equal(settled.receipt.stage, 'world_settled');
    assert.equal(settled.receipt.durationTurns, 1);
    assert.equal(actorActionNarrativeInjection(attempt, settled.result).text, '');
});

test('hidden result becomes injectable only after a later disclosure receipt', () => {
    const attempt = createActorActionAttempt({
        actorId: actor.id,
        candidateAction: '私下训练',
        stateChanges: [{ kind: 'condition', summary: '完成一次训练' }],
        evidence: ['training:scheduled'],
    }, { actor, turn: 2 });
    const settled = adjudicateActorActionAttempt(attempt, { actor, durationTurns: 2 });
    const before = actorActionNarrativeInjection(attempt, settled.result);
    assert.equal(before.includesResult, false);
    const disclosed = discloseActorActionResult(settled.result, {
        evidence: '艾达实际使用了训练成果',
        publicSummary: '艾达展示了已经练熟的新动作',
    });
    const after = actorActionNarrativeInjection(attempt, disclosed.result);
    assert.equal(after.includesResult, true);
    assert.equal(after.text, '艾达展示了已经练熟的新动作');
});

test('unknown resources or abilities cannot create hidden history or a settled result', () => {
    const attempt = createActorActionAttempt({
        actorId: actor.id,
        candidateAction: '使用未记录的传送能力',
        stateChanges: [{ kind: 'location', summary: '瞬间抵达远方' }],
        resourceCosts: [{ resourceId: 'mana', amount: 2 }],
        capabilityUsed: '传送',
        evidence: ['none'],
    }, { actor, turn: 5 });
    const settled = adjudicateActorActionAttempt(attempt, { actor });
    assert.equal(settled.result.status, 'rejected');
    assert.deepEqual(settled.result.appliedStateChanges, []);
    assert.equal(settled.result.historicalAbilityInvented, false);
});

test('events originate only from settled receipts or independent world processes', () => {
    assert.equal(worldEventFromSettledActionReceipt({ stage: 'planned' }), null);
    const event = worldEventFromSettledActionReceipt({
        receiptId: 'R1',
        resultId: 'X1',
        actorId: actor.id,
        stage: 'world_settled',
        status: 'settled',
        route: 'background_private',
        visibility: 'hidden',
        disclosure: 'pending',
        createdTurn: 4,
    });
    assert.equal(event.sourceKind, 'settled_action_receipt');
    const world = independentWorldProcessEvent({
        processId: 'weather-front',
        turn: 4,
        summary: '锋面移入港区',
    });
    assert.equal(world.sourceKind, 'independent_world_process');
});
