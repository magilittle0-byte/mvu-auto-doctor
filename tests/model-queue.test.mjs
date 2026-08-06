import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ConnectionTaskScheduler,
    countDistinctFailoverReservations,
} from '../model-queue.mjs';

test('deadline reservation counts only distinct healthy failover connections', () => {
    const duplicateOnly = countDistinctFailoverReservations({
        maxFailovers: 1,
        currentSlotIndex: 0,
        currentKey: 'same-api',
        routes: [
            { slotIndex: 0, key: 'same-api', openedUntil: 0 },
            { slotIndex: 1, key: 'same-api', openedUntil: 0 },
            { slotIndex: 2, key: 'same-api', openedUntil: 0 },
        ],
        now: 100,
    });
    assert.equal(duplicateOnly, 0);

    const distinctHealthy = countDistinctFailoverReservations({
        maxFailovers: 2,
        currentSlotIndex: 0,
        currentKey: 'primary',
        routes: [
            { slotIndex: 0, key: 'primary', openedUntil: 0 },
            { slotIndex: 1, key: 'backup-a', openedUntil: 0 },
            { slotIndex: 2, key: 'backup-a', openedUntil: 0 },
            { slotIndex: 3, key: 'backup-b', openedUntil: 200 },
        ],
        now: 100,
    });
    assert.equal(distinctHealthy, 1);
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

async function waitFor(predicate, message = 'condition was not met') {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setImmediate(resolve));
    }
    assert.fail(message);
}

test('同一连接严格串行且待执行任务按优先级排序', async () => {
    const scheduler = new ConnectionTaskScheduler();
    const gate = deferred();
    const order = [];

    const active = scheduler.enqueue('shared-api', async () => {
        order.push('active-start');
        await gate.promise;
        order.push('active-end');
    }, { priority: 10, label: '已运行论坛' });
    const forum = scheduler.enqueue('shared-api', async () => {
        order.push('forum');
    }, { priority: 10, label: '待执行论坛' });
    const world = scheduler.enqueue('shared-api', async () => {
        order.push('world');
    }, { priority: 30, label: '世界' });

    await Promise.resolve();
    assert.deepEqual(order, ['active-start']);
    gate.resolve();
    await Promise.all([active, forum, world]);
    assert.deepEqual(order, ['active-start', 'active-end', 'world', 'forum']);
});

test('不同连接可以并行', async () => {
    const scheduler = new ConnectionTaskScheduler();
    const firstGate = deferred();
    const secondGate = deferred();
    const started = [];

    const first = scheduler.enqueue('m3', async () => {
        started.push('m3');
        await firstGate.promise;
    });
    const second = scheduler.enqueue('gemini', async () => {
        started.push('gemini');
        await secondGate.promise;
    });

    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(new Set(started), new Set(['m3', 'gemini']));
    firstGate.resolve();
    secondGate.resolve();
    await Promise.all([first, second]);
});

test('同一连接按可配置上限并发且空出槽位后仍按优先级启动', async () => {
    const scheduler = new ConnectionTaskScheduler();
    const gates = [deferred(), deferred(), deferred(), deferred(), deferred()];
    const started = [];
    const runs = [
        scheduler.enqueue('shared-api', async () => {
            started.push('first');
            await gates[0].promise;
        }, { maxConcurrent: 3, priority: 10, label: 'first' }),
        scheduler.enqueue('shared-api', async () => {
            started.push('second');
            await gates[1].promise;
        }, { maxConcurrent: 3, priority: 10, label: 'second' }),
        scheduler.enqueue('shared-api', async () => {
            started.push('third');
            await gates[2].promise;
        }, { maxConcurrent: 3, priority: 10, label: 'third' }),
        scheduler.enqueue('shared-api', async () => {
            started.push('low');
            await gates[3].promise;
        }, { maxConcurrent: 3, priority: 10, label: 'low' }),
        scheduler.enqueue('shared-api', async () => {
            started.push('high');
            await gates[4].promise;
        }, { maxConcurrent: 3, priority: 30, label: 'high' }),
    ];

    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(started, ['first', 'second', 'third']);
    assert.deepEqual(scheduler.snapshot().map((state) => ({
        activeCount: state.activeCount,
        maxConcurrent: state.maxConcurrent,
        pending: state.pending.map((entry) => entry.label),
    })), [{
        activeCount: 3,
        maxConcurrent: 3,
        pending: ['high', 'low'],
    }]);

    gates[0].resolve();
    await waitFor(() => started.length >= 4, 'high-priority task did not start');
    assert.equal(started[3], 'high');
    gates[1].resolve();
    await waitFor(() => started.length >= 5, 'remaining task did not start');
    assert.equal(started[4], 'low');
    for (const gate of gates.slice(2)) gate.resolve();
    await Promise.all(runs);
    assert.deepEqual(scheduler.snapshot(), []);
});

test('尚未开始的任务可通过 AbortSignal 从队列取消', async () => {
    const scheduler = new ConnectionTaskScheduler();
    const gate = deferred();
    const controller = new AbortController();
    let queuedRan = false;

    const active = scheduler.enqueue('shared-api', () => gate.promise);
    const queued = scheduler.enqueue('shared-api', async () => {
        queuedRan = true;
    }, { signal: controller.signal });
    controller.abort('聊天已切换');

    await assert.rejects(queued, (error) => error?.name === 'AbortError');
    gate.resolve();
    await active;
    assert.equal(queuedRan, false);
    assert.deepEqual(scheduler.snapshot(), []);
});
