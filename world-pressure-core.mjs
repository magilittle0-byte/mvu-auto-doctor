import { fingerprint } from './core.mjs';

export const WORLD_PRESSURE_VERSION = 1;
export const WORLD_PRESSURE_MAX_RECEIPTS = 160;

const ACTION_KINDS = new Set([
    'threat',
    'recovery',
    'information',
    'relationship',
    'choice',
    'remote',
]);
const THREAT_LEVELS = new Set(['ordinary', 'elite', 'boss']);

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function cleanText(value, limit = 300) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function integer(value, minimum, maximum, fallback) {
    const parsed = Math.floor(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

function normalizeExternal(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        turn: integer(source.turn, 0, Number.MAX_SAFE_INTEGER, 0),
        sameSceneBossCount: integer(source.sameSceneBossCount, 0, 99, 0),
        threatMentions: integer(source.threatMentions, 0, 999, 0),
        pressureEstimate: integer(source.pressureEstimate, 0, 999, 0),
        overCap: source.overCap === true,
        evidenceHash: cleanText(source.evidenceHash, 100),
    };
}

export function emptyWorldPressureState() {
    return {
        version: WORLD_PRESSURE_VERSION,
        turn: 0,
        phase: 'opening',
        doctorPressure: 0,
        sameSceneBossCount: 0,
        recoveryDebt: 0,
        lastReliefTurn: 0,
        external: normalizeExternal(),
        receipts: [],
    };
}

export function normalizeWorldPressureState(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        version: WORLD_PRESSURE_VERSION,
        turn: integer(source.turn, 0, Number.MAX_SAFE_INTEGER, 0),
        phase: ['opening', 'exploration', 'escalation', 'climax', 'recovery']
            .includes(source.phase)
            ? source.phase
            : 'opening',
        doctorPressure: integer(source.doctorPressure, 0, 99, 0),
        sameSceneBossCount: integer(source.sameSceneBossCount, 0, 99, 0),
        recoveryDebt: integer(source.recoveryDebt, 0, 20, 0),
        lastReliefTurn: integer(source.lastReliefTurn, 0, Number.MAX_SAFE_INTEGER, 0),
        external: normalizeExternal(source.external),
        receipts: (Array.isArray(source.receipts) ? clone(source.receipts) : [])
            .slice(-WORLD_PRESSURE_MAX_RECEIPTS),
    };
}

function acceptedBody(content) {
    return String(content ?? '')
        .replace(/^[\s\S]*?<content\b[^>]*>/iu, '')
        .replace(/<\/content>[\s\S]*$/iu, '');
}

export function observeAcceptedContentPressure(value, {
    turn = 0,
    content = '',
    sameSceneBossCap = 1,
    pressureCap = 3,
    knownThreatPressure = 0,
} = {}) {
    const state = normalizeWorldPressureState(value);
    const body = acceptedBody(content);
    const taggedBosses = [...body.matchAll(
        /(?:【|\[)\s*(?:BOSS|首领)\s*[：:]\s*([^】\]\n]{1,80})(?:】|\])/giu,
    )].map((match) => cleanText(match[1], 80).toLocaleLowerCase());
    const namedBosses = [...body.matchAll(
        /(?:首领级|BOSS级)(?:敌人|威胁|怪物|事实)?\s*[：:]?\s*([^\s，。；、【\[]+)/giu,
    )].map((match) => cleanText(match[1], 80).toLocaleLowerCase());
    const uniqueBosses = new Set([...taggedBosses, ...namedBosses].filter(Boolean));
    const threatMentions = (body.match(
        /(?:BOSS|首领|精英|强敌|伏击|围攻|追杀|倒计时|致命机关|更强敌人)/giu,
    ) || []).length;
    const count = uniqueBosses.size;
    const eliteCount = new Set(
        [...body.matchAll(
            /(?:【|\[)\s*精英\s*[：:]?\s*([^】\]\n]{1,80})(?:】|\])/gu,
        )].map((match) => cleanText(match[1], 80).toLocaleLowerCase()),
    ).size;
    const pressureEstimate = Math.max(
        integer(knownThreatPressure, 0, 999, 0),
        count * 3 + eliteCount * 2 + Math.min(3, threatMentions),
    );
    state.turn = Math.max(state.turn, integer(turn, 0, Number.MAX_SAFE_INTEGER, state.turn));
    state.external = {
        turn: state.turn,
        sameSceneBossCount: count,
        threatMentions,
        pressureEstimate,
        overCap: count > integer(sameSceneBossCap, 0, 9, 1)
            || pressureEstimate > integer(pressureCap, 0, 9, 3),
        evidenceHash: fingerprint(body),
    };
    return state;
}

function normalizeCandidate(value, index) {
    const source = value && typeof value === 'object' ? value : {};
    const actionKind = ACTION_KINDS.has(source.actionKind)
        ? source.actionKind
        : 'information';
    return {
        ...clone(source),
        id: cleanText(source.id, 160) || `candidate-${index + 1}`,
        channel: ['actor', 'faction', 'environment'].includes(source.channel)
            ? source.channel
            : 'environment',
        actionKind,
        pressureCost: integer(source.pressureCost, 0, 9, actionKind === 'threat' ? 1 : 0),
        threatLevel: THREAT_LEVELS.has(source.threatLevel)
            ? source.threatLevel
            : 'ordinary',
        sameScene: source.sameScene !== false,
    };
}

function recoveryDebtFor(level, cadence) {
    const base = level === 'boss' ? 2 : level === 'elite' ? 1 : 0;
    if (cadence === 'fast') return Math.max(0, base - 1);
    if (cadence === 'gentle') return base + (base > 0 ? 1 : 0);
    return base;
}

function pressureReceipt(candidate, turn, decision, reason) {
    return {
        receiptId: `world-pressure:${turn}:${fingerprint(`${candidate.id}|${decision}`).slice(0, 16)}`,
        turn,
        candidateId: candidate.id,
        channel: candidate.channel,
        decision,
        reason,
        status: decision === 'admitted' ? 'planned' : 'retained',
    };
}

export function admitDoctorWorldCandidates(value, candidates, {
    turn = 0,
    phase = 'exploration',
    pressureCap = 3,
    sameSceneBossCap = 1,
    recoveryCadence = 'balanced',
    injectionLimit = 2,
} = {}) {
    const state = normalizeWorldPressureState(value);
    const currentTurn = integer(turn, 0, Number.MAX_SAFE_INTEGER, state.turn);
    const cap = integer(pressureCap, 0, 9, 3);
    const bossCap = integer(sameSceneBossCap, 0, 4, 1);
    const limit = integer(injectionLimit, 0, 12, 2);
    state.turn = currentTurn;
    state.phase = ['opening', 'exploration', 'escalation', 'climax', 'recovery']
        .includes(phase)
        ? phase
        : 'exploration';
    const phaseCap = {
        opening: 1,
        exploration: 2,
        escalation: 3,
        climax: cap,
        recovery: 1,
    }[state.phase];
    const effectiveCap = Math.min(cap, phaseCap);
    const recoveryDebtAtBatchStart = state.recoveryDebt;
    if (currentTurn > Number(value?.turn || 0)) {
        const decay = state.phase === 'recovery' ? 2 : 1;
        state.doctorPressure = Math.max(0, state.doctorPressure - decay);
        state.sameSceneBossCount = 0;
    }

    const admitted = [];
    const delayed = [];
    const retained = [];
    const receipts = [];
    const normalized = (Array.isArray(candidates) ? candidates : [])
        .map(normalizeCandidate);
    const ordered = [
        ...normalized.filter((item) => item.actionKind !== 'threat'),
        ...normalized.filter((item) => item.actionKind === 'threat'),
    ];
    for (const candidate of ordered) {
        if (candidate.actionKind === 'threat') {
            let reason = '';
            if (state.external.overCap) reason = 'external-pressure-over-cap';
            else if (recoveryDebtAtBatchStart > 0) reason = 'recovery-debt';
            else if (state.doctorPressure + candidate.pressureCost > effectiveCap) {
                reason = 'doctor-pressure-cap';
            } else if (
                candidate.threatLevel === 'boss'
                && candidate.sameScene
                && state.sameSceneBossCount + state.external.sameSceneBossCount >= bossCap
            ) {
                reason = 'same-scene-boss-cap';
            } else if (
                ['opening', 'exploration'].includes(state.phase)
                && candidate.threatLevel === 'boss'
            ) {
                reason = 'phase-minimum-playability';
            }
            if (reason) {
                delayed.push({ ...candidate, decisionReason: reason });
                receipts.push(pressureReceipt(candidate, currentTurn, 'delayed', reason));
                continue;
            }
            if (admitted.length >= limit) {
                retained.push({ ...candidate, decisionReason: 'injection-limit' });
                receipts.push(pressureReceipt(candidate, currentTurn, 'retained', 'injection-limit'));
                continue;
            }
            state.doctorPressure += candidate.pressureCost;
            if (candidate.threatLevel === 'boss' && candidate.sameScene) {
                state.sameSceneBossCount += 1;
            }
            state.recoveryDebt = Math.max(
                state.recoveryDebt,
                recoveryDebtFor(candidate.threatLevel, recoveryCadence),
            );
        } else {
            if (admitted.length >= limit) {
                retained.push({ ...candidate, decisionReason: 'injection-limit' });
                receipts.push(pressureReceipt(candidate, currentTurn, 'retained', 'injection-limit'));
                continue;
            }
            if (candidate.actionKind !== 'recovery') {
                if (
                    state.phase === 'recovery'
                    && ['information', 'relationship', 'choice'].includes(candidate.actionKind)
                ) {
                    state.recoveryDebt = Math.max(0, state.recoveryDebt - 1);
                    state.lastReliefTurn = currentTurn;
                }
                admitted.push(candidate);
                receipts.push(pressureReceipt(candidate, currentTurn, 'admitted', 'within-budget'));
                continue;
            }
            state.recoveryDebt = Math.max(0, state.recoveryDebt - 1);
            state.doctorPressure = Math.max(0, state.doctorPressure - 1);
            state.lastReliefTurn = currentTurn;
        }
        admitted.push(candidate);
        receipts.push(pressureReceipt(candidate, currentTurn, 'admitted', 'within-budget'));
    }
    state.receipts = [...state.receipts, ...receipts].slice(-WORLD_PRESSURE_MAX_RECEIPTS);
    return {
        state,
        admitted,
        delayed,
        retained,
        receipts,
    };
}
