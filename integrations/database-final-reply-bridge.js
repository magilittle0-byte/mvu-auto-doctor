const BRIDGE_ID = 'mvu_auto_doctor_database_final_reply_bridge';
const BRIDGE_VERSION = '1.0.0';
const TERMINAL_EVENT = 'mvu-auto-doctor-target-terminal';
const STATUS_EVENT = 'mvu-auto-doctor-database-bridge-status';

export function shouldRequestFinalDatabaseSync(detail) {
    // The database owns one independent read of the accepted <content> for the
    // turn. A later MVU settlement must never request a second generic fill.
    // Keep this exported predicate for compatibility with already-installed
    // bridge entries, but make the legacy post-doctor synchronization inert.
    void detail;
    return false;
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
    now = () => Date.now(),
} = {}) {
    if (!root?.addEventListener || !root?.removeEventListener) {
        throw new TypeError('数据库最终正文桥需要 EventTarget 兼容的窗口对象。');
    }

    let disposed = false;

    const state = {
        id: BRIDGE_ID,
        version: BRIDGE_VERSION,
        status: 'disabled-independent-database',
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

    function onTerminal(event) {
        if (disposed) return;
        state.received += 1;
        state.skipped += 1;
        state.lastResult = 'skipped';
        state.lastAttempts = 0;
        state.lastUpdatedAt = now();
        return { status: 'skipped', reason: 'post-doctor database refill disabled' };
    }

    root.addEventListener(TERMINAL_EVENT, onTerminal);
    const ready = Promise.resolve({
        status: 'disabled-independent-database',
        reason: '数据库按每轮接受的 <content> 独立处理，不在医生结算后重触发。',
    });

    return Object.freeze({
        id: BRIDGE_ID,
        version: BRIDGE_VERSION,
        ready,
        getState: snapshot,
        sync: (detail) => onTerminal({ detail }),
        dispose: () => {
            if (disposed) return;
            disposed = true;
            root.removeEventListener(TERMINAL_EVENT, onTerminal);
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
