import { fingerprint } from './core.mjs';

export const SOVEREIGNTY_AGENT_TYPES = Object.freeze([
    'profile',
    'physiology',
    'actor',
    'world',
    'adjudicator',
]);

const AGENT_TYPE_SET = new Set(SOVEREIGNTY_AGENT_TYPES);

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

export function createSovereigntyBlackboard({
    turn = 0,
    sourceRef = null,
} = {}) {
    return {
        version: 1,
        turn: integer(turn),
        sourceRef: clone(sourceRef),
        candidates: [],
        failures: [],
        adjudication: null,
        rounds: 1,
    };
}

export function publishSovereigntyCandidate(value, {
    agentType,
    agentId,
    actorId = '',
    payload = null,
    evidence = [],
    createdAt = Date.now(),
} = {}) {
    const blackboard = value && typeof value === 'object'
        ? clone(value)
        : createSovereigntyBlackboard();
    if (!AGENT_TYPE_SET.has(agentType) || agentType === 'adjudicator') {
        return { blackboard, published: false, reason: 'agent_type_invalid' };
    }
    const normalizedAgentId = cleanText(agentId, 120);
    if (!normalizedAgentId) return { blackboard, published: false, reason: 'agent_id_missing' };
    const candidate = {
        id: `BBC-${fingerprint(JSON.stringify([
            blackboard.turn,
            agentType,
            normalizedAgentId,
            actorId,
            payload,
        ])).slice(0, 24)}`,
        agentType,
        agentId: normalizedAgentId,
        actorId: cleanText(actorId, 120),
        payload: clone(payload),
        evidence: (Array.isArray(evidence) ? evidence : [])
            .map((entry) => cleanText(entry, 300))
            .filter(Boolean)
            .slice(0, 16),
        status: 'candidate',
        writeAuthority: false,
        createdAt: integer(createdAt),
    };
    if (!blackboard.candidates.some((entry) => entry.id === candidate.id)) {
        blackboard.candidates.push(candidate);
    }
    return { blackboard, published: true, candidate: clone(candidate) };
}

export function recordSovereigntyAgentFailure(value, {
    agentType,
    agentId,
    actorId = '',
    code = 'agent_failed',
    at = Date.now(),
} = {}) {
    const blackboard = value && typeof value === 'object'
        ? clone(value)
        : createSovereigntyBlackboard();
    blackboard.failures.push({
        id: `BBF-${fingerprint(`${blackboard.turn}|${agentType}|${agentId}|${actorId}|${code}|${at}`).slice(0, 24)}`,
        agentType: AGENT_TYPE_SET.has(agentType) ? agentType : 'world',
        agentId: cleanText(agentId, 120),
        actorId: cleanText(actorId, 120),
        code: cleanText(code, 160),
        at: integer(at),
        isolated: true,
    });
    blackboard.failures = blackboard.failures.slice(-80);
    return blackboard;
}

function jobType(job) {
    return AGENT_TYPE_SET.has(job?.agentType) ? job.agentType : '';
}

function selectedJobs(jobs, limits) {
    const counts = new Map();
    const output = [];
    for (const raw of Array.isArray(jobs) ? jobs : []) {
        const agentType = jobType(raw);
        if (!agentType || agentType === 'adjudicator') continue;
        const maximum = integer(limits[agentType], 0, 8, 0);
        const count = counts.get(agentType) || 0;
        if (count >= maximum) continue;
        counts.set(agentType, count + 1);
        output.push({
            agentType,
            agentId: cleanText(raw.agentId, 120)
                || `${agentType}-${count + 1}`,
            actorId: cleanText(raw.actorId, 120),
            input: clone(raw.input),
            evidence: clone(raw.evidence || []),
            routeSlot: clone(raw.routeSlot || null),
        });
    }
    return output;
}

export async function runSovereigntyAgentPool({
    blackboard = createSovereigntyBlackboard(),
    jobs = [],
    runAgent,
    limits = {},
    timeoutMs = 0,
    signal = null,
} = {}) {
    if (typeof runAgent !== 'function') throw new TypeError('runAgent is required');
    const normalizedLimits = {
        profile: integer(limits.profile, 0, 4, 2),
        physiology: integer(limits.physiology, 0, 2, 1),
        actor: integer(limits.actor, 0, 5, 2),
        world: integer(limits.world, 0, 2, 1),
    };
    const selected = selectedJobs(jobs, normalizedLimits);
    const startedAt = Date.now();
    const boundedTimeoutMs = integer(timeoutMs, 0, Number.MAX_SAFE_INTEGER, 0);
    const results = await Promise.allSettled(selected.map(async (job) => {
        const controller = new AbortController();
        const abortFromParent = () => controller.abort(signal?.reason || 'agent-pool-aborted');
        if (signal?.aborted) abortFromParent();
        else signal?.addEventListener?.('abort', abortFromParent, { once: true });
        let timer = null;
        const work = Promise.resolve().then(() => runAgent(clone(job), {
            signal: controller.signal,
        }));
        try {
            if (!boundedTimeoutMs) return await work;
            const timeout = new Promise((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort('agent-pool-timeout');
                    const error = new Error(`agent pool exceeded ${boundedTimeoutMs}ms`);
                    error.code = 'AGENT_POOL_TIMEOUT';
                    reject(error);
                }, boundedTimeoutMs);
            });
            return await Promise.race([work, timeout]);
        } finally {
            if (timer) clearTimeout(timer);
            signal?.removeEventListener?.('abort', abortFromParent);
        }
    }));
    let next = clone(blackboard);
    const completed = [];
    for (let index = 0; index < selected.length; index += 1) {
        const job = selected[index];
        const result = results[index];
        if (result.status === 'fulfilled') {
            const published = publishSovereigntyCandidate(next, {
                agentType: job.agentType,
                agentId: job.agentId,
                actorId: job.actorId,
                payload: result.value,
                evidence: job.evidence,
                createdAt: Date.now(),
            });
            next = published.blackboard;
            completed.push({ ...job, status: published.published ? 'candidate' : 'rejected' });
        } else {
            next = recordSovereigntyAgentFailure(next, {
                agentType: job.agentType,
                agentId: job.agentId,
                actorId: job.actorId,
                code: cleanText(result.reason?.code || result.reason?.message, 160)
                    || 'agent_failed',
            });
            completed.push({ ...job, status: 'failed' });
        }
    }
    return {
        blackboard: next,
        selected: selected.length,
        succeeded: completed.filter((entry) => entry.status === 'candidate').length,
        failed: completed.filter((entry) => entry.status === 'failed').length,
        completed,
        rounds: 1,
        durationMs: Math.max(0, Date.now() - startedAt),
        agentConversationCount: 0,
    };
}

export function adjudicateSovereigntyBlackboard(value, {
    acceptCandidate = () => true,
} = {}) {
    const blackboard = value && typeof value === 'object'
        ? clone(value)
        : createSovereigntyBlackboard();
    const ordered = [...(blackboard.candidates || [])].sort((left, right) => (
        SOVEREIGNTY_AGENT_TYPES.indexOf(left.agentType)
            - SOVEREIGNTY_AGENT_TYPES.indexOf(right.agentType)
        || left.actorId.localeCompare(right.actorId)
        || left.id.localeCompare(right.id)
    ));
    const accepted = [];
    const rejected = [];
    for (const candidate of ordered) {
        const decision = acceptCandidate(clone(candidate), clone(blackboard));
        if (decision === true || decision?.accepted === true) {
            accepted.push({ ...candidate, status: 'accepted_candidate' });
        } else {
            rejected.push({
                ...candidate,
                status: 'rejected_candidate',
                reason: cleanText(decision?.reason, 160) || 'local_policy_rejected',
            });
        }
    }
    blackboard.adjudication = {
        id: `BBA-${fingerprint(JSON.stringify([
            blackboard.turn,
            accepted.map((entry) => entry.id),
            rejected.map((entry) => entry.id),
        ])).slice(0, 24)}`,
        accepted,
        rejected,
        deterministic: true,
        finalWriteAuthority: 'local_coordinator_only',
        agentWriteCount: 0,
    };
    return blackboard;
}

export function rankSovereigntyRouteSlots(value) {
    return (Array.isArray(value) ? value : [])
        .filter((slot) => slot && typeof slot === 'object' && slot.enabled !== false)
        .map((slot, index) => {
            const latencyMs = Math.max(0, Number(slot.latencyMs) || 0);
            const failureRate = Math.min(1, Math.max(0, Number(slot.failureRate) || 0));
            const active = Math.max(0, Number(slot.active) || 0);
            const capacity = Math.max(1, Number(slot.capacity) || 1);
            const load = active / capacity;
            const score = failureRate * 10_000 + latencyMs + load * 2_000;
            return {
                ...clone(slot),
                id: cleanText(slot.id, 120) || `slot-${index + 1}`,
                endpoint: cleanText(slot.endpoint, 1000),
                model: cleanText(slot.model, 300),
                preset: cleanText(slot.preset, 300),
                credentialRef: cleanText(slot.credentialRef, 300),
                route: cleanText(slot.route, 80),
                score,
                originalIndex: index,
            };
        })
        .sort((left, right) => left.score - right.score || left.originalIndex - right.originalIndex);
}

export function allocateSovereigntyRouteSlot(value, {
    excludeIds = [],
} = {}) {
    const excluded = new Set((Array.isArray(excludeIds) ? excludeIds : []).map(String));
    const selected = rankSovereigntyRouteSlots(value).find((slot) => !excluded.has(slot.id));
    return selected ? clone(selected) : null;
}
