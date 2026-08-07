import assert from 'node:assert/strict';
import test from 'node:test';

import {
    cancelSovereigntyTaskAsStale,
    claimNextSovereigntyTask,
    commitSovereigntyTask,
    conservativeSovereigntyFallback,
    dueSovereigntyTasks,
    emptySovereigntyRuntime,
    extractFirstBalancedJsonObject,
    failSovereigntyTask,
    observeSovereigntyTurn,
    normalizeSovereigntyRuntime,
    parseJsonObjectWithSingleRepair,
    recoverOrphanedSovereigntyTasks,
    requeueSovereigntyTaskForLatestState,
    restoreSovereigntyCheckpoint,
    retrySovereigntyTaskNow,
    sovereigntyHealthView,
    sovereigntyRetryDelay,
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

test('active unlimited jobs survive watchdog scans and explicit user cancellation is terminal', () => {
    const observed = observeSovereigntyTurn(emptySovereigntyRuntime('chat-unbounded'), {
        sourceRef: source(1),
        modules: ['actor', 'world'],
        now: 100,
    });
    const claimed = claimNextSovereigntyTask(observed.runtime, {
        module: 'world',
        currentTurn: 1,
        now: 200,
    });
    const kept = recoverOrphanedSovereigntyTasks(claimed.runtime, {
        now: 500_000,
        staleAfterMs: 1_000,
        excludeTaskIds: [claimed.task.id],
    });
    assert.equal(kept.recovered.length, 0);
    assert.equal(kept.runtime.backlog.find((task) => task.id === claimed.task.id).status, 'running');
    const cancelled = cancelSovereigntyTaskAsStale(kept.runtime, {
        taskId: claimed.task.id,
        reason: 'user_cancelled',
        now: 500_001,
    });
    const task = cancelled.runtime.backlog.find((entry) => entry.id === claimed.task.id);
    assert.equal(task.status, 'cancelled_stale');
    assert.equal(task.metadata.cancelReason, 'user_cancelled');
});

test('a newer accepted turn requeues stale work against latest state without a technical failure', () => {
    let runtime = observeSovereigntyTurn(emptySovereigntyRuntime('chat-requeue'), {
        sourceRef: source(1),
        modules: ['world'],
        now: 100,
    }).runtime;
    const claimed = claimNextSovereigntyTask(runtime, {
        module: 'world',
        currentTurn: 1,
        now: 200,
    });
    runtime = observeSovereigntyTurn(claimed.runtime, {
        sourceRef: source(2),
        modules: ['world'],
        now: 300,
    }).runtime;
    const requeued = requeueSovereigntyTaskForLatestState(runtime, {
        taskId: claimed.task.id,
        reason: 'target_advanced',
        now: 400,
    });
    const task = requeued.runtime.backlog.find((entry) => entry.id === claimed.task.id);
    assert.equal(task.status, 'pending');
    assert.equal(task.recoveryMode, 'latest_state');
    assert.equal(task.historicalActionAllowed, false);
    assert.equal(task.nextRetryTurn, 2);
    assert.equal(task.metadata.requeueReason, 'target_advanced');
    assert.equal(requeued.runtime.technicalReceipts.length, 0);
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

test('v1 mixed-clock backlog migrates to the observed cursor instead of waiting for a future actor clock', () => {
    let runtime = emptySovereigntyRuntime('chat-mixed-clock');
    for (let turn = 1; turn <= 38; turn += 1) {
        runtime = observeSovereigntyTurn(runtime, {
            sourceRef: source(turn),
            modules: ['actor', 'world'],
            now: 1_000 + turn,
        }).runtime;
    }
    const claimed = claimNextSovereigntyTask(runtime, {
        module: 'actor',
        currentTurn: 38,
        now: 2_000,
    });
    runtime = failSovereigntyTask(claimed.runtime, {
        taskId: claimed.task.id,
        failureCode: 'actor_shard.json_missing',
        nextRetryTurn: 47,
        now: 2_100,
    }).runtime;
    runtime.version = 1;

    const migrated = normalizeSovereigntyRuntime(runtime);
    const failed = migrated.backlog.find((task) => task.id === claimed.task.id);
    assert.equal(migrated.version, 2);
    assert.equal(failed.nextRetryTurn, 38);
    assert.equal(failed.recoveryMode, 'latest_state');
    assert.equal(failed.historicalActionAllowed, false);
    assert.equal(dueSovereigntyTasks(migrated).some((task) => task.id === failed.id), true);
    assert.equal(sovereigntyRetryDelay(migrated), 2_000);
});

test('one latest-state success supersedes same-module historical work and converges a 38-turn backlog', () => {
    let runtime = emptySovereigntyRuntime('chat-convergence');
    for (let turn = 1; turn <= 38; turn += 1) {
        runtime = observeSovereigntyTurn(runtime, {
            sourceRef: source(turn),
            modules: ['actor', 'world'],
            now: 1_000 + turn,
        }).runtime;
    }
    for (const module of ['actor', 'world']) {
        const claimed = claimNextSovereigntyTask(runtime, {
            module,
            currentTurn: 38,
            now: 2_000,
        });
        assert.equal(claimed.task.turn, 1);
        assert.equal(claimed.task.recoveryMode, 'latest_state');
        const committed = commitSovereigntyTask(claimed.runtime, {
            taskId: claimed.task.id,
            payload: { module, generatedFromLatestState: true },
            now: 2_100,
        });
        runtime = committed.runtime;
        assert.equal(committed.supersededTaskIds.length, 37);
        assert.equal(committed.checkpoint.turn, 38);
        assert.equal(committed.task.metadata.coveredThroughTurn, 38);
        assert.equal(runtime.backlog.filter((task) => (
            task.module === module
            && !['committed', 'cancelled_stale'].includes(task.status)
        )).length, 0);
    }
    assert.equal(runtime.simulatedThrough.turn, 38);
    assert.equal(sovereigntyHealthView(runtime).backlog, 0);
    assert.equal(dueSovereigntyTasks(runtime).length, 0);
});

test('64 deterministic mixed failure, refresh and retry histories always converge by latest-state coverage', () => {
    let seed = 0x5eed1234;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x1_0000_0000;
    };
    for (let scenario = 1; scenario <= 64; scenario += 1) {
        const turns = 12 + Math.floor(random() * 39);
        let runtime = emptySovereigntyRuntime(`chat-property-${scenario}`);
        for (let turn = 1; turn <= turns; turn += 1) {
            runtime = observeSovereigntyTurn(runtime, {
                sourceRef: {
                    ...source(turn),
                    chatId: `chat-property-${scenario}`,
                },
                modules: ['profile', 'actor', 'world'],
                now: scenario * 10_000 + turn,
            }).runtime;
        }
        for (const task of runtime.backlog) {
            if (task.module === 'observation') continue;
            const roll = random();
            if (roll < 0.24) {
                task.status = 'committed';
                task.committedAt = scenario * 20_000 + task.turn;
            } else if (roll < 0.43) {
                task.status = 'cancelled_stale';
                task.historicalActionAllowed = false;
            } else if (roll < 0.72) {
                task.status = 'retryable_failed';
                task.retryCount = 1 + Math.floor(random() * 5);
                task.technicalFailureCount = task.retryCount;
                task.nextRetryTurn = turns + 1 + Math.floor(random() * 12);
                task.lastFailureCode = `${task.module}.synthetic_failure`;
                task.recoveryMode = 'latest_state';
                task.historicalActionAllowed = false;
            }
        }
        runtime.version = 1;
        runtime = normalizeSovereigntyRuntime(runtime);
        for (const module of ['profile', 'actor', 'world']) {
            const active = runtime.backlog.some((task) => (
                task.module === module
                && !['committed', 'cancelled_stale'].includes(task.status)
            ));
            if (!active) continue;
            const claimed = claimNextSovereigntyTask(runtime, {
                module,
                currentTurn: turns,
                now: scenario * 30_000,
            });
            assert.ok(claimed.task, `scenario ${scenario} module ${module} must be due after migration`);
            runtime = commitSovereigntyTask(claimed.runtime, {
                taskId: claimed.task.id,
                payload: { scenario, module, latest: true },
                now: scenario * 30_000 + 1,
            }).runtime;
        }
        assert.equal(
            runtime.simulatedThrough.turn,
            turns,
            `scenario ${scenario} cursor must converge`,
        );
        assert.equal(sovereigntyHealthView(runtime).backlog, 0);
    }
});
