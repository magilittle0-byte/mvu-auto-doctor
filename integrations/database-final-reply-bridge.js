const BRIDGE_ID = 'mvu_auto_doctor_database_final_reply_bridge';
const BRIDGE_VERSION = '1.0.0';
const TERMINAL_EVENT = 'mvu-auto-doctor-target-terminal';
const STATUS_EVENT = 'mvu-auto-doctor-database-bridge-status';

function delay(setTimeoutFn, milliseconds) {
    return new Promise((resolve) => setTimeoutFn(resolve, milliseconds));
}

function boundedRemember(set, queue, value, limit = 200) {
    if (set.has(value)) return false;
    set.add(value);
    queue.push(value);
    while (queue.length > limit) {
        set.delete(queue.shift());
    }
    return true;
}

export function shouldRequestFinalDatabaseSync(detail) {
    return !!detail
        && detail.status === 'settled'
        && detail.contentChanged === true
        && typeof detail.chatId === 'string'
        && detail.chatId.length > 0
        && Number.isInteger(Number(detail.targetIndex))
        && detail.receipt?.writeAllowed !== false;
}

export function finalDatabaseSyncKey(detail) {
    return [
        String(detail?.chatId || ''),
        Number(detail?.targetIndex),
        Number(detail?.serial) || 0,
        String(detail?.generationId || ''),
        String(detail?.branchId || ''),
    ].join(':');
}

export function resolveBridgeHostRoot(localRoot) {
    const candidates = [];
    try {
        if (localRoot?.top) candidates.push(localRoot.top);
    } catch {}
    try {
        if (localRoot?.parent) candidates.push(localRoot.parent);
    } catch {}
    candidates.push(localRoot);
    const unique = [...new Set(candidates.filter(Boolean))];
    for (const candidate of unique) {
        try {
            if (
                candidate.MvuAutoDoctorAPI
                || candidate.AutoCardUpdaterAPI
                || candidate.SillyTavern
            ) {
                return candidate;
            }
        } catch {}
    }
    return unique.find((candidate) => {
        try {
            return candidate !== localRoot
                && typeof candidate.addEventListener === 'function';
        } catch {
            return false;
        }
    }) || localRoot;
}

export function createDatabaseFinalReplyBridge({
    root = globalThis,
    apiWaitMs = 60000,
    pollMs = 250,
    busyWaitMs = 120000,
    retryDelayMs = 1500,
    maxAttempts = 2,
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    now = () => Date.now(),
} = {}) {
    if (!root?.addEventListener || !root?.removeEventListener) {
        throw new TypeError('数据库最终正文桥需要 EventTarget 兼容的窗口对象。');
    }

    const processed = new Set();
    const processedOrder = [];
    const idleWaiters = new Set();
    let disposed = false;
    let databaseBusy = false;
    let databaseApi = null;
    let apiPromise = null;
    let serialQueue = Promise.resolve();
    let unregisterUpdate = null;

    const state = {
        id: BRIDGE_ID,
        version: BRIDGE_VERSION,
        status: 'waiting-for-database',
        databaseApiReady: false,
        received: 0,
        skipped: 0,
        requested: 0,
        completed: 0,
        failed: 0,
        lastResult: '',
        lastAttempts: 0,
        lastUpdatedAt: 0,
    };

    function snapshot() {
        return Object.freeze({ ...state });
    }

    function emitStatus(status, attempts = 0) {
        state.status = status;
        state.lastResult = status;
        state.lastAttempts = attempts;
        state.lastUpdatedAt = now();
        try {
            root.dispatchEvent(new root.CustomEvent(STATUS_EVENT, {
                detail: {
                    bridgeId: BRIDGE_ID,
                    version: BRIDGE_VERSION,
                    status,
                    attempts,
                },
            }));
        } catch {}
    }

    function resolveIdleWaiters() {
        for (const resolve of idleWaiters) resolve();
        idleWaiters.clear();
    }

    function attachDatabaseLifecycle(api) {
        if (databaseApi === api) return api;
        databaseApi = api;
        state.databaseApiReady = true;
        state.status = 'ready';
        const onFillStart = () => {
            if (!disposed) databaseBusy = true;
        };
        const onTableUpdate = () => {
            databaseBusy = false;
            resolveIdleWaiters();
        };
        try {
            api.registerTableFillStartCallback?.(onFillStart);
            api.registerTableUpdateCallback?.(onTableUpdate);
            if (typeof api.unregisterTableUpdateCallback === 'function') {
                unregisterUpdate = () => api.unregisterTableUpdateCallback(onTableUpdate);
            }
        } catch {}
        return api;
    }

    async function waitForDatabaseApi() {
        if (databaseApi?.triggerUpdate) return databaseApi;
        if (apiPromise) return apiPromise;
        apiPromise = (async () => {
            const startedAt = now();
            while (!disposed && now() - startedAt <= apiWaitMs) {
                const candidate = root.AutoCardUpdaterAPI;
                if (typeof candidate?.triggerUpdate === 'function') {
                    return attachDatabaseLifecycle(candidate);
                }
                await delay(setTimeoutFn, pollMs);
            }
            throw new Error('等待数据库公开 API 超时。');
        })().finally(() => {
            apiPromise = null;
        });
        return apiPromise;
    }

    async function waitForDatabaseIdle() {
        if (!databaseBusy) return;
        let idleResolve;
        const idlePromise = new Promise((resolve) => {
            idleResolve = resolve;
            idleWaiters.add(resolve);
        });
        await Promise.race([
            idlePromise,
            delay(setTimeoutFn, busyWaitMs),
        ]);
        idleWaiters.delete(idleResolve);
    }

    async function requestFinalSync(detail) {
        const key = finalDatabaseSyncKey(detail);
        state.requested += 1;
        let attempts = 0;
        try {
            const api = await waitForDatabaseApi();
            while (!disposed && attempts < Math.max(1, Number(maxAttempts) || 1)) {
                await waitForDatabaseIdle();
                if (disposed) break;
                attempts += 1;
                const result = await api.triggerUpdate();
                if (result !== false && result != null) {
                    state.completed += 1;
                    emitStatus('synchronized', attempts);
                    return { status: 'synchronized', attempts, result };
                }
                if (attempts < maxAttempts) {
                    await delay(setTimeoutFn, retryDelayMs);
                }
            }
            state.failed += 1;
            emitStatus('database-busy-or-failed', attempts);
            return { status: 'database-busy-or-failed', attempts };
        } catch (error) {
            state.failed += 1;
            emitStatus('failed', attempts);
            return {
                status: 'failed',
                attempts,
                reason: String(error?.message || error || '数据库最终正文同步失败'),
            };
        }
    }

    function onTerminal(event) {
        if (disposed) return;
        state.received += 1;
        const detail = event?.detail;
        if (!shouldRequestFinalDatabaseSync(detail)) {
            state.skipped += 1;
            return;
        }
        const key = finalDatabaseSyncKey(detail);
        if (!boundedRemember(processed, processedOrder, key)) {
            state.skipped += 1;
            return;
        }
        serialQueue = serialQueue.then(() => requestFinalSync(detail));
    }

    root.addEventListener(TERMINAL_EVENT, onTerminal);
    const ready = waitForDatabaseApi().catch((error) => {
        if (!disposed) emitStatus('waiting-for-database', 0);
        return { error: String(error?.message || error) };
    });

    return Object.freeze({
        id: BRIDGE_ID,
        version: BRIDGE_VERSION,
        ready,
        getState: snapshot,
        sync: (detail) => {
            onTerminal({ detail });
            return serialQueue;
        },
        dispose: () => {
            if (disposed) return;
            disposed = true;
            root.removeEventListener(TERMINAL_EVENT, onTerminal);
            try {
                unregisterUpdate?.();
            } catch {}
            resolveIdleWaiters();
            state.status = 'disposed';
        },
    });
}

if (typeof window !== 'undefined' && window?.addEventListener) {
    const bridgeRoot = resolveBridgeHostRoot(window);
    try {
        bridgeRoot.MvuAutoDoctorDatabaseBridge?.dispose?.();
    } catch {}
    bridgeRoot.MvuAutoDoctorDatabaseBridge = createDatabaseFinalReplyBridge({
        root: bridgeRoot,
    });
}

export {
    BRIDGE_ID,
    BRIDGE_VERSION,
    STATUS_EVENT,
    TERMINAL_EVENT,
};
