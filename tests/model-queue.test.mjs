import assert from 'node:assert/strict';
import test from 'node:test';
import { ConnectionTaskScheduler } from '../model-queue.mjs';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
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
