import assert from 'node:assert/strict';
import test from 'node:test';

import {
    claimNextSovereigntyTask,
    commitSovereigntyTask,
    conservativeSovereigntyFallback,
    emptySovereigntyRuntime,
    extractFirstBalancedJsonObject,
    failSovereigntyTask,
    observeSovereigntyTurn,
    parseJsonObjectWithSingleRepair,
    recoverOrphanedSovereigntyTasks,
    restoreSovereigntyCheckpoint,
    retrySovereigntyTaskNow,
    sovereigntyHealthView,
} from '../sovereignty-runtime-core.mjs';

function source(index, suffix = 'a') {
    return {
        chatId: 'chat-sovereignty',
        logicalIndex: index,
        messageId: `message-${index}`,
        swipeId: 0,
        generation: index,
        branchId: `branch-${suffix}`,
        contentHash: `hash-${index}-${suffix}`,
    };
}

test('local observation advances observedThrough and persists module backlog without a model', () => {
    const observed = observeSovereigntyTurn(emptySovereigntyRuntime('chat-sovereignty'), {
        sourceRef: source(2),
        modules: ['profile', 'actor', 'world'],
        now: 100,
    });
    assert.equal(observed.observed, true);
    assert.equal(observed.runtime.observedThrough.turn, 1);
    assert.equal(observed.runtime.simulatedThrough.turn, 0);
    assert.equal(observed.runtime.backlog.length, 4);
    assert.equal(
        observed.runtime.backlog.find((task) => task.module === 'observation').status,
        'committed',
    );
    assert.deepEqual(
        observed.runtime.backlog.filter((task) => task.module !== 'observation')
            .map((task) => task.status),
        ['pending', 'pending', 'pending'],
    );
});

test('technical failure creates a receipt but never mutates actor semantic state', () => {
    const actor = {
        silenceTurns: 3,
        consecutiveActionFailures: 2,
        plan: { summary: 'keep plan' },
    };
    let runtime = observeSovereigntyTurn(emptySovereigntyRuntime('chat-sovereignty'), {
        sourceRef: source(2),
        modules: ['actor'],
        now: 100,
    }).runtime;
    const claimed = claimNextSovereigntyTask(runtime, { module: 'actor', now: 110 });
    runtime = failSovereigntyTask(claimed.runtime, {
        taskId: claimed.task.id,
        failureCode: 'actor_shard.json_missing',
        nextRetryTurn: 2,
        now: 120,
    }).runtime;
    assert.equal(runtime.technicalReceipts.length, 1);
    assert.equal(runtime.backlog.find((task) => task.module === 'actor').status, 'retryable_failed');
    assert.deepEqual(actor, {
        silenceTurns: 3,
        consecutiveActionFailures: 2,
        plan: { summary: 'keep plan' },
    });
});

test('restart recovers orphan running jobs and retries against latest state only', () => {
    let runtime = observeSovereigntyTurn(emptySovereigntyRuntime('chat-sovereignty'), {
        sourceRef: source(2),
        modules: ['actor'],
        now: 100,
    }).runtime;
    runtime = claimNextSovereigntyTask(runtime, { module: 'actor', now: 110 }).runtime;
    runtime = observeSovereigntyTurn(runtime, {
        sourceRef: source(4),
        modules: ['actor'],
        now: 200,
    }).runtime;
    const recovered = recoverOrphanedSovereigntyTasks(runtime, {
        now: 40_200,
        staleAfterMs: 35_000,
    });
    assert.equal(recovered.recovered.length, 1);
    const oldTask = recovered.runtime.backlog.find((task) => task.turn === 1 && task.module === 'actor');
    assert.equal(oldTask.status, 'retryable_failed');
    assert.equal(oldTask.recoveryMode, 'latest_state');
    assert.equal(oldTask.historicalActionAllowed, false);
});

test('only committed transactions advance simulatedThrough and create versioned checkpoints', () => {
    let runtime = observeSovereigntyTurn(emptySovereigntyRuntime('chat-sovereignty'), {
        sourceRef: source(2),
        modules: ['profile', 'actor'],
        now: 100,
    }).runtime;
    for (const module of ['profile', 'actor']) {
        const claimed = claimNextSovereigntyTask(runtime, { module, now: 110 });
        runtime = commitSovereigntyTask(claimed.runtime, {
            taskId: claimed.task.id,
            payload: { module, committed: true },
            now: 120,
        }).runtime;
    }
    assert.equal(runtime.simulatedThrough.turn, 1);
    assert.equal(runtime.checkpoints.length, 2);
    assert.equal(runtime.checkpoints.every((entry) => entry.version === 1), true);
    assert.equal(sovereigntyHealthView(runtime).color, 'green');
});

test('late branch cancels nonterminal work instead of overwriting the active branch', () => {
    let runtime = observeSovereigntyTurn(emptySovereigntyRuntime('chat-sovereignty'), {
        sourceRef: source(2, 'old'),
        modules: ['actor', 'world'],
        now: 100,
    }).runtime;
    runtime = observeSovereigntyTurn(runtime, {
        sourceRef: source(2, 'new'),
        modules: ['actor', 'world'],
        now: 200,
    }).runtime;
    assert.equal(
        runtime.backlog.filter((task) => task.turn === 1 && task.module !== 'observation')
            .every((task) => task.status === 'cancelled_stale'),
        true,
    );
    assert.equal(runtime.observedThrough.sourceRef.branchId, 'branch-new');
});

test('retry-now and checkpoint restore keep deferred work recoverable', () => {
    let runtime = observeSovereigntyTurn(emptySovereigntyRuntime('chat-sovereignty'), {
        sourceRef: source(2),
        modules: ['world'],
        now: 100,
    }).runtime;
    let claimed = claimNextSovereigntyTask(runtime, { module: 'world', now: 110 });
    runtime = commitSovereigntyTask(claimed.runtime, {
        taskId: claimed.task.id,
        payload: { world: 'stable' },
        now: 120,
    }).runtime;
    runtime = observeSovereigntyTurn(runtime, {
        sourceRef: source(4),
        modules: ['world'],
        now: 200,
    }).runtime;
    claimed = claimNextSovereigntyTask(runtime, { module: 'world', now: 210 });
    runtime = failSovereigntyTask(claimed.runtime, {
        taskId: claimed.task.id,
        failureCode: 'timeout',
        deferred: true,
        nextRetryTurn: 99,
        now: 220,
    }).runtime;
    const retried = retrySovereigntyTaskNow(runtime, { module: 'world', now: 230 });
    assert.equal(retried.retried.length, 1);
    const restored = restoreSovereigntyCheckpoint(retried.runtime, { now: 240 });
    assert.equal(restored.restored, true);
    assert.deepEqual(restored.payload, { world: 'stable' });
});

test('balanced JSON extraction accepts prose fences and the first complete object', async () => {
    const output = '说明文字\n```json\n{"ok":true,"nested":{"value":"}"}}\n```\n尾注';
    assert.deepEqual(extractFirstBalancedJsonObject(output).value, {
        ok: true,
        nested: { value: '}' },
    });
    const repaired = await parseJsonObjectWithSingleRepair('bad output', {
        repair: async () => 'prefix {"fixed":true} suffix',
    });
    assert.equal(repaired.repaired, true);
    assert.deepEqual(repaired.value, { fixed: true });
});

test('all-slot failure returns a conservative deferred result with zero fabricated history', () => {
    const fallback = conservativeSovereigntyFallback({
        module: 'actor',
        reason: 'all_slots_failed',
        turn: 8,
    });
    assert.equal(fallback.deferred, true);
    assert.deepEqual(fallback.semanticChanges, []);
    assert.equal(fallback.historicalActionFabricated, false);
    assert.equal(fallback.playerActionFabricated, false);
});
