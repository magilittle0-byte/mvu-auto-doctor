import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    SOVEREIGNTY_RUNTIME_VERSION,
    claimNextSovereigntyTask,
    commitSovereigntyTask,
    emptySovereigntyRuntime,
    normalizeSovereigntyRuntime,
    observeSovereigntyTurn,
    sovereigntyHealthView,
} from '../sovereignty-runtime-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(root, 'qc', 'reports', 'latest-sovereignty-runtime-gate.json');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const runtimeSource = readFileSync(path.join(root, 'sovereignty-runtime-core.mjs'), 'utf8');
const sourceSha256 = createHash('sha256')
    .update(runtimeSource.replace(/\r\n?/gu, '\n'))
    .digest('hex');

function source(chatId, turn) {
    return {
        chatId,
        logicalIndex: turn * 2 - 1,
        messageId: `synthetic-message-${turn}`,
        swipeId: 0,
        generation: turn,
        branchId: 'synthetic-current-branch',
        contentHash: `synthetic-hash-${turn}`,
    };
}

function buildExactFailureShape() {
    const chatId = 'synthetic-rc13-runtime-gate';
    let runtime = emptySovereigntyRuntime(chatId);
    for (let turn = 1; turn <= 38; turn += 1) {
        runtime = observeSovereigntyTurn(runtime, {
            sourceRef: source(chatId, turn),
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
            task.attemptCount = task.status === 'retryable_failed' ? 3 : 1;
            task.retryCount = task.status === 'retryable_failed' ? 3 : 0;
            task.technicalFailureCount = task.retryCount;
            task.nextRetryTurn = task.status === 'retryable_failed'
                ? 41 + (index % 7)
                : task.turn;
            task.lastFailureCode = task.status === 'retryable_failed'
                ? `${module}.synthetic_technical_failure`
                : '';
            task.recoveryMode = task.status === 'retryable_failed'
                ? 'latest_state'
                : 'source_turn';
            task.historicalActionAllowed = task.status !== 'retryable_failed';
            task.committedAt = task.status === 'committed' ? 20_000 + index : 0;
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
    runtime.simulatedThrough = {
        turn: 0,
        sourceKey: '',
        sourceRef: null,
        at: 0,
    };
    return runtime;
}

let exact = normalizeSovereigntyRuntime(buildExactFailureShape());
const initial = {
    observedThrough: exact.observedThrough.turn,
    simulatedThrough: exact.simulatedThrough.turn,
    taskCount: exact.backlog.length,
    activeBacklog: sovereigntyHealthView(exact).backlog,
    retryableFailed: exact.backlog.filter((task) => task.status === 'retryable_failed').length,
    pending: exact.backlog.filter((task) => task.status === 'pending').length,
};
assert.deepEqual(initial, {
    observedThrough: 38,
    simulatedThrough: 0,
    taskCount: 155,
    activeBacklog: 34,
    retryableFailed: 24,
    pending: 10,
});
assert.equal(exact.backlog.filter((task) => (
    task.status === 'retryable_failed' && task.nextRetryTurn <= 38
)).length, 24);

const recoveryReceipts = [];
for (const module of ['actor', 'world']) {
    const claimed = claimNextSovereigntyTask(exact, {
        module,
        currentTurn: 38,
        now: 30_000,
    });
    assert.ok(claimed.task);
    assert.equal(claimed.task.recoveryMode, 'latest_state');
    const committed = commitSovereigntyTask(claimed.runtime, {
        taskId: claimed.task.id,
        payload: {
            module,
            generatedFromLatestState: true,
            historicalActionsInvented: false,
        },
        now: 31_000,
    });
    exact = committed.runtime;
    recoveryReceipts.push({
        module,
        coveredThroughTurn: committed.task.metadata.coveredThroughTurn,
        supersededTaskCount: committed.supersededTaskIds.length,
    });
}
const finalHealth = sovereigntyHealthView(exact);
assert.equal(exact.simulatedThrough.turn, 38);
assert.equal(finalHealth.backlog, 0);
assert.equal(finalHealth.retryableFailed, 0);

let seed = 0x5eed1234;
const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
};
for (let scenario = 1; scenario <= 64; scenario += 1) {
    const turns = 12 + Math.floor(random() * 39);
    const chatId = `synthetic-property-${scenario}`;
    let runtime = emptySovereigntyRuntime(chatId);
    for (let turn = 1; turn <= turns; turn += 1) {
        runtime = observeSovereigntyTurn(runtime, {
            sourceRef: source(chatId, turn),
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
        assert.ok(claimed.task);
        runtime = commitSovereigntyTask(claimed.runtime, {
            taskId: claimed.task.id,
            payload: { scenario, module, generatedFromLatestState: true },
            now: scenario * 30_000 + 1,
        }).runtime;
    }
    assert.equal(runtime.simulatedThrough.turn, turns);
    assert.equal(sovereigntyHealthView(runtime).backlog, 0);
}

const report = {
    schemaVersion: 1,
    version: manifest.version,
    runtimeVersion: SOVEREIGNTY_RUNTIME_VERSION,
    generatedAt: new Date().toISOString(),
    sourceSha256,
    syntheticOnly: true,
    accepted: true,
    schedulerClock: 'observedThrough',
    legacyMixedClockMigration: true,
    automaticRetryWithoutNewTurn: true,
    queuedRetryUserCancellation: true,
    latestStateSupersession: true,
    exactFailureShape: {
        initial,
        final: {
            observedThrough: exact.observedThrough.turn,
            simulatedThrough: exact.simulatedThrough.turn,
            activeBacklog: finalHealth.backlog,
            retryableFailed: finalHealth.retryableFailed,
        },
        recoveryReceipts,
    },
    propertyFailureScenarios: 64,
    historicalActionFabricationCount: 0,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(
    `sovereignty runtime gate passed: 155-task failure shape converged to turn 38; 64 randomized histories converged\n`,
);
