import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BRIDGE_ID,
    BRIDGE_VERSION,
    createDatabaseFinalReplyBridge,
    finalDatabaseSyncKey,
    resolveBridgeHostRoot,
    shouldRequestFinalDatabaseSync,
} from '../integrations/database-final-reply-bridge.js';

class FakeCustomEvent extends Event {
    constructor(type, options = {}) {
        super(type);
        this.detail = options.detail;
    }
}

function createRoot(triggerUpdate) {
    const root = new EventTarget();
    root.CustomEvent = FakeCustomEvent;
    const callbacks = {
        fillStart: new Set(),
        update: new Set(),
    };
    root.AutoCardUpdaterAPI = {
        triggerUpdate,
        registerTableFillStartCallback(callback) {
            callbacks.fillStart.add(callback);
        },
        registerTableUpdateCallback(callback) {
            callbacks.update.add(callback);
        },
        unregisterTableUpdateCallback(callback) {
            callbacks.update.delete(callback);
        },
    };
    return { root, callbacks };
}

function settledDetail(overrides = {}) {
    return {
        status: 'settled',
        chatId: 'synthetic-chat',
        targetIndex: 4,
        serial: 7,
        generationId: 'generation-1',
        branchId: 'branch-1',
        contentChanged: true,
        receipt: { writeAllowed: true },
        ...overrides,
    };
}

test('independent database bridge exposes stable metadata and sync key', () => {
    const detail = settledDetail();
    assert.equal(BRIDGE_ID, 'mvu_auto_doctor_database_final_reply_bridge');
    assert.equal(BRIDGE_VERSION, '1.0.0');
    assert.equal(shouldRequestFinalDatabaseSync(detail), true);
    assert.equal(
        finalDatabaseSyncKey(detail),
        'synthetic-chat:4:7:generation-1:branch-1',
    );
});

test('bridge resolves the TavernHelper iframe to the same-origin host window', () => {
    const host = new EventTarget();
    host.AutoCardUpdaterAPI = { triggerUpdate() {} };
    const frame = new EventTarget();
    frame.parent = host;
    frame.top = host;
    assert.equal(resolveBridgeHostRoot(frame), host);
});

test('bridge ignores unchanged, stale and denied terminal events', async () => {
    let calls = 0;
    const { root } = createRoot(async () => {
        calls += 1;
        return { ok: true };
    });
    const bridge = createDatabaseFinalReplyBridge({
        root,
        apiWaitMs: 20,
        pollMs: 1,
    });
    await bridge.ready;
    await bridge.sync(settledDetail({ contentChanged: false }));
    await bridge.sync(settledDetail({ status: 'stale', serial: 8 }));
    await bridge.sync(settledDetail({
        serial: 9,
        receipt: { writeAllowed: false },
    }));
    assert.equal(calls, 0);
    assert.equal(bridge.getState().skipped, 3);
    bridge.dispose();
});

test('bridge uses only the public trigger once and deduplicates event storms', async () => {
    let calls = 0;
    const { root } = createRoot(async () => {
        calls += 1;
        return { updated: true };
    });
    const bridge = createDatabaseFinalReplyBridge({
        root,
        apiWaitMs: 20,
        pollMs: 1,
    });
    await bridge.ready;
    const detail = settledDetail();
    await Promise.all([
        bridge.sync(detail),
        bridge.sync(detail),
        bridge.sync(detail),
    ]);
    const state = bridge.getState();
    assert.equal(calls, 1);
    assert.equal(state.completed, 1);
    assert.equal(state.skipped, 2);
    assert.equal(state.lastResult, 'synchronized');
    bridge.dispose();
});

test('bridge retries one public busy result, then stops after one success', async () => {
    let calls = 0;
    const { root } = createRoot(async () => {
        calls += 1;
        return calls === 1 ? false : { updated: true };
    });
    const bridge = createDatabaseFinalReplyBridge({
        root,
        apiWaitMs: 20,
        pollMs: 1,
        retryDelayMs: 1,
        busyWaitMs: 5,
        maxAttempts: 2,
    });
    await bridge.ready;
    const result = await bridge.sync(settledDetail());
    assert.equal(result.status, 'synchronized');
    assert.equal(result.attempts, 2);
    assert.equal(calls, 2);
    assert.equal(bridge.getState().completed, 1);
    bridge.dispose();
});

test('bridge fails closed after the bounded busy retry', async () => {
    let calls = 0;
    const { root } = createRoot(async () => {
        calls += 1;
        return false;
    });
    const bridge = createDatabaseFinalReplyBridge({
        root,
        apiWaitMs: 20,
        pollMs: 1,
        retryDelayMs: 1,
        busyWaitMs: 5,
        maxAttempts: 2,
    });
    await bridge.ready;
    const result = await bridge.sync(settledDetail());
    assert.equal(result.status, 'database-busy-or-failed');
    assert.equal(calls, 2);
    assert.equal(bridge.getState().failed, 1);
    bridge.dispose();
});
