import { fingerprint } from './core.mjs';

export const SOVEREIGNTY_RUNTIME_VERSION = 2;
export const SOVEREIGNTY_CHECKPOINT_VERSION = 1;
export const SOVEREIGNTY_TASK_STATUSES = Object.freeze([
    'pending',
    'running',
    'retryable_failed',
    'deferred',
    'committed',
    'cancelled_stale',
]);
export const SOVEREIGNTY_MODULES = Object.freeze([
    'observation',
    'profile',
    'physiology',
    'actor',
    'world',
    'forum',
    'social',
]);

const STATUS_SET = new Set(SOVEREIGNTY_TASK_STATUSES);
const MODULE_SET = new Set(SOVEREIGNTY_MODULES);
const TERMINAL_STATUSES = new Set(['committed', 'cancelled_stale']);

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function cleanText(value, limit = 300) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, fallback = 0) {
    const parsed = Math.floor(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

function sourceIdentity(value = {}) {
    return [
        cleanText(value.chatId, 180),
        integer(value.logicalIndex ?? value.index),
        cleanText(value.messageId, 180),
        integer(value.swipeId),
        integer(value.generation),
        cleanText(value.branchId, 180),
        cleanText(value.contentHash ?? value.hash, 180),
    ].join('|');
}

export function normalizeSovereigntySourceRef(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = {
        chatId: cleanText(value.chatId, 180),
        logicalIndex: integer(value.logicalIndex ?? value.index),
        messageId: cleanText(value.messageId, 180),
        swipeId: integer(value.swipeId),
        generation: integer(value.generation),
        branchId: cleanText(value.branchId, 180),
        contentHash: cleanText(value.contentHash ?? value.hash, 180),
    };
    if (!source.chatId || !source.messageId || !source.branchId || !source.contentHash) {
        return null;
    }
    return source;
}

export function sovereigntySourceKey(value) {
    const source = normalizeSovereigntySourceRef(value);
    return source ? `SRC-${fingerprint(sourceIdentity(source)).slice(0, 24)}` : '';
}

function emptyCursor() {
    return { turn: 0, sourceKey: '', sourceRef: null, at: 0 };
}

function emptyModuleHealth() {
    return Object.fromEntries(SOVEREIGNTY_MODULES.map((module) => [module, {
        lastSuccessTurn: 0,
        lastSuccessAt: 0,
        technicalFailureCount: 0,
        lastFailureCode: '',
        nextRetryTurn: 0,
    }]));
}

export function emptySovereigntyRuntime(chatId = '', { mode = 'active' } = {}) {
    return {
        version: SOVEREIGNTY_RUNTIME_VERSION,
        checkpointVersion: SOVEREIGNTY_CHECKPOINT_VERSION,
        chatId: cleanText(chatId, 180),
        mode: ['legacy', 'shadow', 'active'].includes(mode) ? mode : 'active',
        observedThrough: emptyCursor(),
        simulatedThrough: emptyCursor(),
        observations: [],
        backlog: [],
        checkpoints: [],
        technicalReceipts: [],
        moduleHealth: emptyModuleHealth(),
        lastRecoveryAt: 0,
        updatedAt: 0,
    };
}

function normalizeCursor(value) {
    const sourceRef = normalizeSovereigntySourceRef(value?.sourceRef);
    return {
        turn: integer(value?.turn),
        sourceKey: sourceRef
            ? sovereigntySourceKey(sourceRef)
            : cleanText(value?.sourceKey, 80),
        sourceRef,
        at: integer(value?.at),
    };
}

function normalizeTask(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const sourceRef = normalizeSovereigntySourceRef(value.sourceRef);
    const module = MODULE_SET.has(value.module) ? value.module : '';
    if (!sourceRef || !module) return null;
    const sourceKey = sovereigntySourceKey(sourceRef);
    const turn = integer(value.turn, 1, Number.MAX_SAFE_INTEGER, 1);
    return {
        id: cleanText(value.id, 100)
            || `JOB-${fingerprint(`${sourceKey}|${turn}|${module}`).slice(0, 24)}`,
        sourceKey,
        sourceRef,
        turn,
        module,
        status: STATUS_SET.has(value.status) ? value.status : 'pending',
        attemptCount: integer(value.attemptCount),
        retryCount: integer(value.retryCount),
        technicalFailureCount: integer(value.technicalFailureCount),
        nextRetryTurn: integer(value.nextRetryTurn, 0, Number.MAX_SAFE_INTEGER, turn),
        claimedAt: integer(value.claimedAt),
        createdAt: integer(value.createdAt),
        updatedAt: integer(value.updatedAt),
        committedAt: integer(value.committedAt),
        lastFailureCode: cleanText(value.lastFailureCode, 160),
        recoveryMode: value.recoveryMode === 'latest_state' ? 'latest_state' : 'source_turn',
        historicalActionAllowed: value.historicalActionAllowed !== false,
        commitRef: cleanText(value.commitRef, 120),
        metadata: value.metadata && typeof value.metadata === 'object'
            ? clone(value.metadata)
            : {},
    };
}

function normalizeHealth(value) {
    const output = emptyModuleHealth();
    for (const module of SOVEREIGNTY_MODULES) {
        const source = value?.[module] || {};
        output[module] = {
            lastSuccessTurn: integer(source.lastSuccessTurn),
            lastSuccessAt: integer(source.lastSuccessAt),
            technicalFailureCount: integer(source.technicalFailureCount),
            lastFailureCode: cleanText(source.lastFailureCode, 160),
            nextRetryTurn: integer(source.nextRetryTurn),
        };
    }
    return output;
}

export function normalizeSovereigntyRuntime(value, { chatId = '' } = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const sourceVersion = integer(source.version);
    const observedThrough = normalizeCursor(source.observedThrough);
    const backlog = (Array.isArray(source.backlog) ? source.backlog : [])
        .map(normalizeTask)
        .filter(Boolean)
        .slice(-600);
    const usedTaskIds = new Set();
    const uniqueBacklog = backlog.filter((task) => {
        if (usedTaskIds.has(task.id)) return false;
        usedTaskIds.add(task.id);
        return true;
    });
    const moduleHealth = normalizeHealth(source.moduleHealth);
    if (sourceVersion < 2) {
        for (const task of uniqueBacklog) {
            if (!['retryable_failed', 'deferred'].includes(task.status)) continue;
            task.nextRetryTurn = Math.min(task.nextRetryTurn, observedThrough.turn);
            task.recoveryMode = 'latest_state';
            task.historicalActionAllowed = false;
        }
        for (const module of SOVEREIGNTY_MODULES) {
            const nextRetryTurns = uniqueBacklog
                .filter((task) => (
                    task.module === module
                    && ['retryable_failed', 'deferred'].includes(task.status)
                ))
                .map((task) => task.nextRetryTurn);
            moduleHealth[module].nextRetryTurn = nextRetryTurns.length
                ? Math.min(...nextRetryTurns)
                : 0;
        }
    }
    return {
        version: SOVEREIGNTY_RUNTIME_VERSION,
        checkpointVersion: SOVEREIGNTY_CHECKPOINT_VERSION,
        chatId: cleanText(chatId || source.chatId, 180),
        mode: ['legacy', 'shadow', 'active'].includes(source.mode)
            ? source.mode
            : 'active',
        observedThrough,
        simulatedThrough: normalizeCursor(source.simulatedThrough),
        observations: (Array.isArray(source.observations) ? source.observations : [])
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
                turn: integer(entry.turn),
                sourceKey: cleanText(entry.sourceKey, 80),
                sourceRef: normalizeSovereigntySourceRef(entry.sourceRef),
                observedAt: integer(entry.observedAt),
            }))
            .filter((entry) => entry.sourceRef && entry.sourceKey)
            .slice(-240),
        backlog: uniqueBacklog,
        checkpoints: (Array.isArray(source.checkpoints) ? source.checkpoints : [])
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
                version: SOVEREIGNTY_CHECKPOINT_VERSION,
                id: cleanText(entry.id, 120),
                taskId: cleanText(entry.taskId, 120),
                module: MODULE_SET.has(entry.module) ? entry.module : 'world',
                turn: integer(entry.turn),
                sourceKey: cleanText(entry.sourceKey, 80),
                sourceRef: normalizeSovereigntySourceRef(entry.sourceRef),
                stateDigest: cleanText(entry.stateDigest, 120),
                payload: clone(entry.payload),
                createdAt: integer(entry.createdAt),
            }))
            .filter((entry) => entry.id && entry.sourceRef)
            .slice(-80),
        technicalReceipts: (Array.isArray(source.technicalReceipts)
            ? source.technicalReceipts
            : [])
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
                id: cleanText(entry.id, 120),
                taskId: cleanText(entry.taskId, 120),
                module: MODULE_SET.has(entry.module) ? entry.module : 'world',
                turn: integer(entry.turn),
                code: cleanText(entry.code, 160),
                retryable: entry.retryable !== false,
                retryCount: integer(entry.retryCount),
                nextRetryTurn: integer(entry.nextRetryTurn),
                at: integer(entry.at),
                recovered: entry.recovered === true,
            }))
            .filter((entry) => entry.id && entry.taskId && entry.code)
            .slice(-240),
        moduleHealth,
        lastRecoveryAt: integer(source.lastRecoveryAt),
        updatedAt: integer(source.updatedAt),
    };
}

function technicalReceipt(task, code, {
    now,
    retryable = true,
    recovered = false,
} = {}) {
    return {
        id: `TECH-${fingerprint(`${task.id}|${code}|${task.retryCount}|${now}`).slice(0, 24)}`,
        taskId: task.id,
        module: task.module,
        turn: task.turn,
        code: cleanText(code, 160) || 'technical_failure',
        retryable,
        retryCount: task.retryCount,
        nextRetryTurn: task.nextRetryTurn,
        at: integer(now),
        recovered,
    };
}

function recomputeSimulatedThrough(runtime) {
    const observations = [...runtime.observations].sort((left, right) => left.turn - right.turn);
    let cursor = emptyCursor();
    for (const observation of observations) {
        const tasks = runtime.backlog.filter((task) => (
            task.turn === observation.turn
            && task.sourceKey === observation.sourceKey
            && task.module !== 'observation'
        ));
        if (tasks.length && tasks.every((task) => TERMINAL_STATUSES.has(task.status))) {
            cursor = {
                turn: observation.turn,
                sourceKey: observation.sourceKey,
                sourceRef: clone(observation.sourceRef),
                at: Math.max(0, ...tasks.map((task) => task.committedAt || task.updatedAt || 0)),
            };
            continue;
        }
        break;
    }
    runtime.simulatedThrough = cursor;
}

export function observeSovereigntyTurn(value, {
    sourceRef,
    modules = ['profile', 'actor', 'world'],
    now = Date.now(),
} = {}) {
    const source = normalizeSovereigntySourceRef(sourceRef);
    const runtime = normalizeSovereigntyRuntime(value, { chatId: source?.chatId });
    if (!source) return { runtime, observed: false, reason: 'source_ref_invalid', tasks: [] };
    const sourceKey = sovereigntySourceKey(source);
    const existingObservation = runtime.observations.find((entry) => entry.sourceKey === sourceKey);
    if (existingObservation) {
        return {
            runtime,
            observed: false,
            reason: 'duplicate',
            turn: existingObservation.turn,
            tasks: runtime.backlog.filter((task) => task.sourceKey === sourceKey),
        };
    }

    const staleLogicalIndex = source.logicalIndex;
    for (const task of runtime.backlog) {
        if (
            task.sourceRef.chatId === source.chatId
            && task.sourceRef.logicalIndex === staleLogicalIndex
            && task.sourceKey !== sourceKey
            && !TERMINAL_STATUSES.has(task.status)
        ) {
            task.status = 'cancelled_stale';
            task.updatedAt = now;
            task.historicalActionAllowed = false;
        }
    }

    const turn = runtime.observations.length
        ? Math.max(...runtime.observations.map((entry) => entry.turn)) + 1
        : 1;
    runtime.observations.push({ turn, sourceKey, sourceRef: source, observedAt: now });
    runtime.observations = runtime.observations.slice(-240);
    runtime.observedThrough = { turn, sourceKey, sourceRef: source, at: now };
    const normalizedModules = [...new Set(['observation', ...modules])]
        .filter((module) => MODULE_SET.has(module));
    const tasks = normalizedModules.map((module) => normalizeTask({
        sourceRef: source,
        turn,
        module,
        status: module === 'observation' ? 'committed' : 'pending',
        nextRetryTurn: turn,
        createdAt: now,
        updatedAt: now,
        committedAt: module === 'observation' ? now : 0,
        commitRef: module === 'observation' ? `OBS-${sourceKey}` : '',
        metadata: module === 'observation'
            ? { localOnly: true, modelRequired: false }
            : { latestStateRequired: true },
    }));
    runtime.backlog.push(...tasks);
    runtime.backlog = runtime.backlog.slice(-600);
    runtime.moduleHealth.observation.lastSuccessTurn = turn;
    runtime.moduleHealth.observation.lastSuccessAt = now;
    runtime.updatedAt = now;
    recomputeSimulatedThrough(runtime);
    return { runtime, observed: true, turn, tasks: clone(tasks) };
}

export function recoverOrphanedSovereigntyTasks(value, {
    now = Date.now(),
    staleAfterMs = 35_000,
    excludeTaskIds = [],
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const excluded = new Set((Array.isArray(excludeTaskIds) ? excludeTaskIds : []).map(String));
    const recovered = [];
    for (const task of runtime.backlog) {
        if (
            task.status !== 'running'
            || excluded.has(task.id)
            || now - task.claimedAt < Math.max(1_000, Number(staleAfterMs) || 35_000)
        ) continue;
        task.status = 'retryable_failed';
        task.retryCount += 1;
        task.technicalFailureCount += 1;
        task.nextRetryTurn = Math.max(task.turn, runtime.observedThrough.turn);
        task.lastFailureCode = 'orphaned_running_recovered';
        task.recoveryMode = 'latest_state';
        task.historicalActionAllowed = false;
        task.updatedAt = now;
        runtime.technicalReceipts.push(technicalReceipt(task, task.lastFailureCode, {
            now,
            recovered: true,
        }));
        const health = runtime.moduleHealth[task.module];
        health.technicalFailureCount += 1;
        health.lastFailureCode = task.lastFailureCode;
        health.nextRetryTurn = task.nextRetryTurn;
        recovered.push(task.id);
    }
    runtime.technicalReceipts = runtime.technicalReceipts.slice(-240);
    runtime.lastRecoveryAt = recovered.length ? now : runtime.lastRecoveryAt;
    runtime.updatedAt = recovered.length ? now : runtime.updatedAt;
    return { runtime, recovered };
}

export function claimNextSovereigntyTask(value, {
    module = '',
    currentTurn = null,
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const turn = currentTurn === null || currentTurn === undefined || currentTurn === ''
        ? runtime.observedThrough.turn
        : integer(currentTurn, 0, Number.MAX_SAFE_INTEGER, runtime.observedThrough.turn);
    const candidate = runtime.backlog
        .filter((task) => (
            task.module !== 'observation'
            && (!module || task.module === module)
            && ['pending', 'retryable_failed', 'deferred'].includes(task.status)
            && task.nextRetryTurn <= turn
        ))
        .sort((left, right) => (
            Number(right.status === 'retryable_failed') - Number(left.status === 'retryable_failed')
            || left.turn - right.turn
            || left.id.localeCompare(right.id)
        ))[0];
    if (!candidate) return { runtime, task: null };
    candidate.status = 'running';
    candidate.attemptCount += 1;
    candidate.claimedAt = now;
    candidate.updatedAt = now;
    if (candidate.turn < runtime.observedThrough.turn || candidate.retryCount > 0) {
        candidate.recoveryMode = 'latest_state';
        candidate.historicalActionAllowed = false;
    }
    runtime.updatedAt = now;
    return { runtime, task: clone(candidate) };
}

export function failSovereigntyTask(value, {
    taskId,
    failureCode = 'technical_failure',
    retryable = true,
    deferred = false,
    nextRetryTurn = null,
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const task = runtime.backlog.find((entry) => entry.id === taskId);
    if (!task || TERMINAL_STATUSES.has(task.status)) return { runtime, changed: false };
    task.retryCount += retryable || deferred ? 1 : 0;
    task.technicalFailureCount += 1;
    task.status = deferred ? 'deferred' : retryable ? 'retryable_failed' : 'deferred';
    task.nextRetryTurn = nextRetryTurn === null || nextRetryTurn === undefined
        ? Math.max(task.turn + 1, runtime.observedThrough.turn + 1)
        : integer(nextRetryTurn, 0, Number.MAX_SAFE_INTEGER, task.turn + 1);
    task.lastFailureCode = cleanText(failureCode, 160) || 'technical_failure';
    task.recoveryMode = 'latest_state';
    task.historicalActionAllowed = false;
    task.updatedAt = now;
    const health = runtime.moduleHealth[task.module];
    health.technicalFailureCount += 1;
    health.lastFailureCode = task.lastFailureCode;
    health.nextRetryTurn = task.nextRetryTurn;
    runtime.technicalReceipts.push(technicalReceipt(task, task.lastFailureCode, {
        now,
        retryable,
    }));
    runtime.technicalReceipts = runtime.technicalReceipts.slice(-240);
    runtime.updatedAt = now;
    return { runtime, changed: true, task: clone(task) };
}

export function commitSovereigntyTask(value, {
    taskId,
    payload = null,
    commitRef = '',
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const task = runtime.backlog.find((entry) => entry.id === taskId);
    if (!task || task.status === 'cancelled_stale') return { runtime, changed: false };
    const latestStateCoverage = (
        task.recoveryMode === 'latest_state'
        && runtime.observedThrough.turn >= task.turn
    );
    const coveredThroughTurn = latestStateCoverage
        ? runtime.observedThrough.turn
        : task.turn;
    const coveredCursor = latestStateCoverage && runtime.observedThrough.sourceRef
        ? runtime.observedThrough
        : {
            turn: task.turn,
            sourceKey: task.sourceKey,
            sourceRef: task.sourceRef,
        };
    task.status = 'committed';
    task.committedAt = now;
    task.updatedAt = now;
    task.nextRetryTurn = 0;
    task.commitRef = cleanText(commitRef, 120)
        || `COMMIT-${fingerprint(`${task.id}|${now}`).slice(0, 20)}`;
    task.lastFailureCode = '';
    const supersededTaskIds = [];
    if (latestStateCoverage) {
        for (const entry of runtime.backlog) {
            if (
                entry.id === task.id
                || entry.module !== task.module
                || entry.turn > coveredThroughTurn
                || TERMINAL_STATUSES.has(entry.status)
            ) continue;
            entry.status = 'cancelled_stale';
            entry.historicalActionAllowed = false;
            entry.claimedAt = 0;
            entry.updatedAt = now;
            entry.metadata = {
                ...(entry.metadata || {}),
                cancelReason: 'latest_state_superseded',
                supersededByTaskId: task.id,
                supersededAt: now,
            };
            supersededTaskIds.push(entry.id);
        }
        task.metadata = {
            ...(task.metadata || {}),
            coveredThroughTurn,
            supersededTaskCount: supersededTaskIds.length,
        };
    }
    const stateDigest = `sha256:${fingerprint(JSON.stringify(payload ?? null))}`;
    const checkpoint = {
        version: SOVEREIGNTY_CHECKPOINT_VERSION,
        id: `SCP-${fingerprint(`${task.id}|${stateDigest}|${now}`).slice(0, 24)}`,
        taskId: task.id,
        module: task.module,
        turn: coveredCursor.turn,
        sourceKey: coveredCursor.sourceKey,
        sourceRef: clone(coveredCursor.sourceRef),
        stateDigest,
        payload: clone(payload),
        createdAt: now,
    };
    runtime.checkpoints.push(checkpoint);
    runtime.checkpoints = runtime.checkpoints.slice(-80);
    const health = runtime.moduleHealth[task.module];
    health.lastSuccessTurn = Math.max(health.lastSuccessTurn, coveredThroughTurn);
    health.lastSuccessAt = now;
    health.lastFailureCode = '';
    const remainingRetryTurns = runtime.backlog
        .filter((entry) => (
            entry.module === task.module
            && ['retryable_failed', 'deferred'].includes(entry.status)
        ))
        .map((entry) => entry.nextRetryTurn);
    health.nextRetryTurn = remainingRetryTurns.length
        ? Math.min(...remainingRetryTurns)
        : 0;
    runtime.updatedAt = now;
    recomputeSimulatedThrough(runtime);
    return {
        runtime,
        changed: true,
        task: clone(task),
        checkpoint: clone(checkpoint),
        supersededTaskIds,
    };
}

export function cancelSovereigntyTaskAsStale(value, {
    taskId,
    reason = 'target_stale',
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const task = runtime.backlog.find((entry) => entry.id === taskId);
    if (!task || task.status === 'committed') return { runtime, changed: false };
    task.status = 'cancelled_stale';
    task.historicalActionAllowed = false;
    task.metadata = {
        ...(task.metadata || {}),
        cancelReason: cleanText(reason, 160) || 'target_stale',
        cancelledAt: now,
    };
    task.updatedAt = now;
    runtime.updatedAt = now;
    recomputeSimulatedThrough(runtime);
    return { runtime, changed: true, task: clone(task) };
}

export function requeueSovereigntyTaskForLatestState(value, {
    taskId,
    reason = 'target_advanced',
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const task = runtime.backlog.find((entry) => entry.id === taskId);
    if (!task || TERMINAL_STATUSES.has(task.status)) return { runtime, changed: false };
    task.status = 'pending';
    task.nextRetryTurn = runtime.observedThrough.turn;
    task.recoveryMode = 'latest_state';
    task.historicalActionAllowed = false;
    task.claimedAt = 0;
    task.updatedAt = now;
    task.metadata = {
        ...(task.metadata || {}),
        requeueReason: cleanText(reason, 160) || 'target_advanced',
        requeuedAt: now,
    };
    runtime.updatedAt = now;
    return { runtime, changed: true, task: clone(task) };
}

export function retrySovereigntyTaskNow(value, {
    taskId = '',
    module = '',
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const tasks = runtime.backlog.filter((task) => (
        (!taskId || task.id === taskId)
        && (!module || task.module === module)
        && ['retryable_failed', 'deferred'].includes(task.status)
    ));
    for (const task of tasks) {
        task.status = 'pending';
        task.nextRetryTurn = runtime.observedThrough.turn;
        task.updatedAt = now;
    }
    runtime.updatedAt = tasks.length ? now : runtime.updatedAt;
    return { runtime, retried: tasks.map((task) => task.id) };
}

export function dueSovereigntyTasks(value, { currentTurn = null } = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const turn = currentTurn === null || currentTurn === undefined || currentTurn === ''
        ? runtime.observedThrough.turn
        : integer(currentTurn, 0, Number.MAX_SAFE_INTEGER, runtime.observedThrough.turn);
    return clone(runtime.backlog.filter((task) => (
        ['pending', 'retryable_failed', 'deferred'].includes(task.status)
        && task.nextRetryTurn <= turn
    )));
}

export function sovereigntyRetryDelay(value, {
    baseMs = 2_000,
    maximumMs = 30_000,
} = {}) {
    const due = dueSovereigntyTasks(value);
    if (!due.length) return 0;
    const retryCount = Math.min(
        ...due.map((task) => Math.max(1, task.retryCount || task.attemptCount || 1)),
    );
    return Math.min(
        Math.max(1_000, integer(maximumMs, 1_000, 300_000, 30_000)),
        Math.max(250, integer(baseMs, 250, 60_000, 2_000))
            * (2 ** Math.min(4, Math.max(0, retryCount - 1))),
    );
}

export function restoreSovereigntyCheckpoint(value, {
    checkpointId = '',
    now = Date.now(),
} = {}) {
    const runtime = normalizeSovereigntyRuntime(value);
    const checkpoint = checkpointId
        ? runtime.checkpoints.find((entry) => entry.id === checkpointId)
        : runtime.checkpoints.at(-1);
    if (!checkpoint) return { runtime, restored: false, payload: null };
    for (const task of runtime.backlog) {
        if (task.turn <= checkpoint.turn || TERMINAL_STATUSES.has(task.status)) continue;
        task.status = 'pending';
        task.nextRetryTurn = runtime.observedThrough.turn;
        task.recoveryMode = 'latest_state';
        task.historicalActionAllowed = false;
        task.updatedAt = now;
    }
    runtime.simulatedThrough = {
        turn: checkpoint.turn,
        sourceKey: checkpoint.sourceKey,
        sourceRef: clone(checkpoint.sourceRef),
        at: now,
    };
    runtime.updatedAt = now;
    return {
        runtime,
        restored: true,
        checkpoint: clone(checkpoint),
        payload: clone(checkpoint.payload),
    };
}

export function sovereigntyHealthView(value) {
    const runtime = normalizeSovereigntyRuntime(value);
    const active = runtime.backlog.filter((task) => !TERMINAL_STATUSES.has(task.status));
    const running = active.filter((task) => task.status === 'running');
    const failed = active.filter((task) => task.status === 'retryable_failed');
    const deferred = active.filter((task) => task.status === 'deferred');
    const pending = active.filter((task) => task.status === 'pending');
    const failingModules = [...new Set([...failed, ...deferred].map((task) => task.module))];
    const lastSuccessTurn = Math.max(
        0,
        ...Object.values(runtime.moduleHealth).map((entry) => entry.lastSuccessTurn),
    );
    const nextRetryTurn = Math.min(
        ...[...failed, ...deferred].map((task) => task.nextRetryTurn),
        Number.MAX_SAFE_INTEGER,
    );
    const lag = Math.max(0, runtime.observedThrough.turn - runtime.simulatedThrough.turn);
    const color = running.length
        ? 'blue'
        : failed.length && lastSuccessTurn === 0
            ? 'red'
            : failed.length || deferred.length
                ? 'orange'
                : pending.length || lag > 0
                    ? 'yellow'
                    : 'green';
    return {
        color,
        mode: runtime.mode,
        observedThrough: clone(runtime.observedThrough),
        simulatedThrough: clone(runtime.simulatedThrough),
        lastSuccessTurn,
        backlog: active.length,
        pending: pending.length,
        running: running.length,
        retryableFailed: failed.length,
        deferred: deferred.length,
        lag,
        failingModules,
        nextRetryTurn: Number.isFinite(nextRetryTurn) && nextRetryTurn < Number.MAX_SAFE_INTEGER
            ? nextRetryTurn
            : 0,
        lastFailureCodes: [...new Set([...failed, ...deferred]
            .map((task) => task.lastFailureCode)
            .filter(Boolean))].slice(0, 8),
        checkpointCount: runtime.checkpoints.length,
        technicalReceiptCount: runtime.technicalReceipts.length,
    };
}

export function extractFirstBalancedJsonObject(output) {
    const text = String(output ?? '');
    for (let start = 0; start < text.length; start += 1) {
        if (text[start] !== '{') continue;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
            const character = text[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (character === '\\') escaped = true;
                else if (character === '"') inString = false;
                continue;
            }
            if (character === '"') {
                inString = true;
                continue;
            }
            if (character === '{') depth += 1;
            else if (character === '}') depth -= 1;
            if (depth !== 0) continue;
            const source = text.slice(start, index + 1);
            try {
                const value = JSON.parse(source);
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    return { value, source, start, end: index + 1 };
                }
            } catch {
                break;
            }
            break;
        }
    }
    return { error: 'json_object_missing' };
}

export async function parseJsonObjectWithSingleRepair(output, {
    repair = null,
} = {}) {
    const first = extractFirstBalancedJsonObject(output);
    if (!first.error) return { ...first, repaired: false, repairAttempts: 0 };
    if (typeof repair !== 'function') return { ...first, repaired: false, repairAttempts: 0 };
    let repairedOutput = '';
    try {
        repairedOutput = await repair(String(output ?? ''));
    } catch {
        return { error: 'json_repair_failed', repaired: false, repairAttempts: 1 };
    }
    const second = extractFirstBalancedJsonObject(repairedOutput);
    return second.error
        ? { error: 'json_repair_invalid', repaired: false, repairAttempts: 1 }
        : { ...second, repaired: true, repairAttempts: 1 };
}

export function conservativeSovereigntyFallback({
    module = 'world',
    reason = 'model_unavailable',
    turn = 0,
} = {}) {
    return {
        module: MODULE_SET.has(module) ? module : 'world',
        turn: integer(turn),
        semanticChanges: [],
        actionAttempts: [],
        worldResults: [],
        deferred: true,
        retryable: true,
        reason: cleanText(reason, 160),
        historicalActionFabricated: false,
        playerActionFabricated: false,
    };
}
