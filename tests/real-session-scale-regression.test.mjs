import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareActorLedgerProfilesV6 } from '../actor-profile-v6-core.mjs';
import {
    claimNextSovereigntyTask,
    commitSovereigntyTask,
    emptySovereigntyRuntime,
    failSovereigntyTask,
    normalizeSovereigntyRuntime,
    observeSovereigntyTurn,
    retrySovereigntyTaskNow,
    sovereigntyHealthView,
} from '../sovereignty-runtime-core.mjs';

function sourceRef(turn) {
    return {
        chatId: 'synthetic-long-campaign',
        logicalIndex: turn * 2,
        messageId: `synthetic-message-${turn}`,
        swipeId: 0,
        generation: turn,
        branchId: 'synthetic-main-branch',
        contentHash: `synthetic-content-hash-${turn}`,
    };
}

function syntheticActor(index) {
    return {
        id: `SYNTHETIC-ACTOR-${index}`,
        name: `合成人物${index}`,
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
            copingStyle: '',
            pressureResponse: '',
            recoveryPath: '',
            everydayHabits: [],
            blindSpots: [],
        },
        lineage: { rootActorId: `SYNTHETIC-ACTOR-${index}`, forms: [] },
        longTermGoals: [],
        currentGoals: [],
        constraints: [],
        stateFacts: [],
        knowledge: [],
        location: { name: `合成地点${(index % 3) + 1}`, evidence: [`SYNTH-E-${index}`] },
        resources: [],
        capabilities: [],
        relationships: [],
        commitments: [],
        stimuli: [],
        actionHistory: [],
        plan: { summary: '', status: 'active' },
        evidence: [`SYNTH-E-${index}`],
    };
}

test('sanitized 54-message, 9-actor, 19-turn replay preserves backlog and profile invariants', () => {
    const transcript = Array.from({ length: 54 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        content: `合成长局消息${index + 1}：${'只用于本地规模回归的虚构上下文。'.repeat(48)}`,
    }));
    assert.equal(transcript.length, 54);
    assert.ok(transcript.reduce((sum, message) => sum + message.content.length, 0) > 40_000);

    let ledger = {
        turn: 1,
        actors: Array.from({ length: 9 }, (_, index) => syntheticActor(index + 1)),
    };
    ledger = prepareActorLedgerProfilesV6(ledger, {
        mode: 'full',
        turn: 1,
        now: 100,
    }).ledger;
    const firstHistoryCounts = ledger.actors.map((actor) => actor.profileV6.history.length);
    for (let turn = 2; turn <= 54; turn += 1) {
        ledger.turn = turn;
        ledger = prepareActorLedgerProfilesV6(ledger, {
            mode: 'full',
            turn,
            now: 100 + turn,
        }).ledger;
    }
    assert.equal(ledger.actors.length, 9);
    assert.equal(ledger.actors.every((actor) => actor.profileV6.coverage === 100), true);
    assert.equal(ledger.actors.every((actor) => actor.profileV6.preparedForAction), true);
    assert.equal(ledger.actors.every((actor) => actor.plan.summary && actor.plan.steps.length), true);
    assert.deepEqual(
        ledger.actors.map((actor) => actor.profileV6.history.length),
        firstHistoryCounts,
    );

    let runtime = emptySovereigntyRuntime('synthetic-long-campaign');
    for (let turn = 1; turn <= 19; turn += 1) {
        runtime = observeSovereigntyTurn(runtime, {
            sourceRef: sourceRef(turn),
            modules: ['profile', 'actor', 'world'],
            now: 1_000 + turn,
        }).runtime;
    }
    assert.equal(runtime.observedThrough.turn, 19);
    assert.equal(runtime.simulatedThrough.turn, 0);
    assert.equal(runtime.backlog.length, 76, '19 turns × observation/profile/actor/world');

    for (const module of ['profile', 'actor', 'world']) {
        while (true) {
            const claimed = claimNextSovereigntyTask(runtime, {
                module,
                currentTurn: 19,
                now: 2_000,
            });
            runtime = claimed.runtime;
            if (!claimed.task) break;
            const shouldFail = (
                (module === 'actor' && claimed.task.turn <= 5)
                || (module === 'world' && claimed.task.turn <= 7)
            );
            runtime = shouldFail
                ? failSovereigntyTask(runtime, {
                    taskId: claimed.task.id,
                    failureCode: module === 'actor'
                        ? 'actor_shard.shape_not_whitelisted'
                        : 'world.transport_failed',
                    nextRetryTurn: 20,
                    now: 2_100 + claimed.task.turn,
                }).runtime
                : commitSovereigntyTask(runtime, {
                    taskId: claimed.task.id,
                    payload: { synthetic: true, module, turn: claimed.task.turn },
                    now: 2_100 + claimed.task.turn,
                }).runtime;
        }
    }
    const health = sovereigntyHealthView(runtime);
    assert.equal(health.retryableFailed, 0);
    assert.equal(health.backlog, 0);
    assert.equal(health.failingModules.length, 0);
    assert.equal(runtime.simulatedThrough.turn, 19);
    assert.equal(runtime.technicalReceipts.length, 12);
    assert.equal(ledger.actors.every((actor) => actor.actionHistory.length === 0), true);
    assert.equal(ledger.actors.every((actor) => actor.profileV6.modules.actionHistory.data.historicalActionsInvented === false), true);

    const retried = retrySovereigntyTaskNow(runtime, { now: 3_000 });
    assert.equal(retried.retried.length, 0);
    assert.equal(retried.runtime.backlog.filter((task) => task.status === 'pending').length, 0);
    assert.equal(retried.runtime.backlog.filter((task) => (
        task.status === 'pending'
        && task.recoveryMode === 'latest_state'
        && task.historicalActionAllowed === false
    )).length, 0);
});

test('sanitized 38-observation rc12 failure shape converges 155 persisted tasks after refresh', () => {
    let runtime = emptySovereigntyRuntime('synthetic-rc12-recovery');
    for (let turn = 1; turn <= 38; turn += 1) {
        runtime = observeSovereigntyTurn(runtime, {
            sourceRef: {
                ...sourceRef(turn),
                chatId: 'synthetic-rc12-recovery',
            },
            modules: [
                'profile',
                'actor',
                'world',
                ...(turn <= 3 ? ['physiology'] : []),
            ],
            now: 10_000 + turn,
        }).runtime;
    }
    const assign = (module, statuses) => {
        const tasks = runtime.backlog.filter((task) => task.module === module);
        assert.equal(tasks.length, statuses.length);
        tasks.forEach((task, index) => {
            task.status = statuses[index];
            task.attemptCount = statuses[index] === 'retryable_failed' ? 3 : 1;
            task.retryCount = statuses[index] === 'retryable_failed' ? 3 : 0;
            task.technicalFailureCount = statuses[index] === 'retryable_failed' ? 3 : 0;
            task.nextRetryTurn = statuses[index] === 'retryable_failed'
                ? 41 + (index % 7)
                : task.turn;
            task.lastFailureCode = statuses[index] === 'retryable_failed'
                ? `${module}.synthetic_technical_failure`
                : '';
            task.recoveryMode = statuses[index] === 'retryable_failed'
                ? 'latest_state'
                : 'source_turn';
            task.historicalActionAllowed = statuses[index] !== 'retryable_failed';
            task.committedAt = statuses[index] === 'committed' ? 20_000 + index : 0;
        });
    };
    assign('profile', [
        ...Array(29).fill('committed'),
        ...Array(9).fill('cancelled_stale'),
    ]);
    assign('actor', [
        ...Array(13).fill('retryable_failed'),
        ...Array(18).fill('cancelled_stale'),
        ...Array(2).fill('committed'),
        ...Array(5).fill('pending'),
    ]);
    assign('world', [
        ...Array(11).fill('retryable_failed'),
        ...Array(4).fill('committed'),
        ...Array(18).fill('cancelled_stale'),
        ...Array(5).fill('pending'),
    ]);
    assign('physiology', [
        ...Array(2).fill('committed'),
        'cancelled_stale',
    ]);
    runtime.version = 1;
    runtime.simulatedThrough = { turn: 0, sourceKey: '', sourceRef: null, at: 0 };

    runtime = normalizeSovereigntyRuntime(runtime);
    assert.equal(runtime.backlog.length, 155);
    assert.equal(runtime.observedThrough.turn, 38);
    assert.equal(runtime.simulatedThrough.turn, 0);
    assert.equal(runtime.backlog.filter((task) => task.status === 'committed').length, 75);
    assert.equal(runtime.backlog.filter((task) => task.status === 'retryable_failed').length, 24);
    assert.equal(runtime.backlog.filter((task) => task.status === 'cancelled_stale').length, 46);
    assert.equal(runtime.backlog.filter((task) => task.status === 'pending').length, 10);
    assert.equal(runtime.backlog.filter((task) => (
        task.status === 'retryable_failed' && task.nextRetryTurn <= 38
    )).length, 24);

    for (const module of ['actor', 'world']) {
        const claimed = claimNextSovereigntyTask(runtime, {
            module,
            currentTurn: 38,
            now: 30_000,
        });
        assert.ok(claimed.task);
        assert.equal(claimed.task.recoveryMode, 'latest_state');
        runtime = commitSovereigntyTask(claimed.runtime, {
            taskId: claimed.task.id,
            payload: {
                module,
                currentActorClock: 46,
                observedClock: 38,
                generatedFromLatestState: true,
            },
            now: 31_000,
        }).runtime;
    }
    const health = sovereigntyHealthView(runtime);
    assert.equal(runtime.simulatedThrough.turn, 38);
    assert.equal(health.backlog, 0);
    assert.equal(health.retryableFailed, 0);
    assert.equal(health.pending, 0);
});
