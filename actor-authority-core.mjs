import { fingerprint } from './core.mjs';

export const ACTOR_ACTION_ROUTES = Object.freeze([
    'foreground_offer',
    'foreground_attempt',
    'background_private',
    'background_public',
]);

const ROUTE_SET = new Set(ACTOR_ACTION_ROUTES);
const PLAYER_SETTLEMENT = /(?:玩家|主角|user|player).{0,24}(?:接受|同意|参与|感到|觉得|支付|交出|服从|移动|到达|回答|承诺|决定)/iu;
const OFFER = /(?:邀请|请求|询问|提议|报价|递交|展示|说明|警告|劝告|尝试说服)/u;
const PUBLIC_ACTION = /(?:公告|布告|公开|广播|游行|演说|当众|市场|道路|交通|价格|舆论)/u;

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function cleanText(value, limit = 700) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function cleanList(value, limit = 16, itemLimit = 300) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((entry) => cleanText(entry, itemLimit)).filter(Boolean))]
        .slice(0, limit);
}

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, fallback = 0) {
    const parsed = Math.floor(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

function normalizedNames(value) {
    return new Set(cleanList(value, 32, 160).map((entry) => entry.toLocaleLowerCase()));
}

function targetsPlayer(candidate, playerNames = []) {
    const names = normalizedNames(['玩家', '主角', 'user', 'player', ...playerNames]);
    const action = cleanText(candidate?.action || candidate?.candidateAction, 700).toLocaleLowerCase();
    if ([...names].some((name) => name && action.includes(name))) return true;
    return (Array.isArray(candidate?.interactionTargets) ? candidate.interactionTargets : [])
        .some((target) => names.has(cleanText(target?.actorName, 160).toLocaleLowerCase()));
}

export function routeActorActionAttempt(candidate, {
    playerNames = [],
} = {}) {
    const action = cleanText(candidate?.action || candidate?.candidateAction, 700);
    if (targetsPlayer(candidate, playerNames)) {
        return OFFER.test(action) ? 'foreground_offer' : 'foreground_attempt';
    }
    if (candidate?.contact || candidate?.foreground === true) return 'foreground_attempt';
    if (candidate?.public === true || PUBLIC_ACTION.test(action)) return 'background_public';
    return 'background_private';
}

export function createActorActionAttempt(candidate, {
    actor = null,
    turn = 0,
    sourceRef = null,
    playerNames = [],
} = {}) {
    const action = cleanText(candidate?.action || candidate?.candidateAction, 700);
    const actorId = cleanText(candidate?.actorId || actor?.id, 120);
    const route = routeActorActionAttempt(candidate, { playerNames });
    const id = `ATT-${fingerprint(JSON.stringify([
        actorId,
        turn,
        action,
        route,
        sourceRef,
    ])).slice(0, 24)}`;
    return {
        id,
        actorId,
        actorName: cleanText(candidate?.actorName || actor?.name, 160),
        turn: integer(turn),
        route,
        action,
        intent: ['execute', 'replan', 'wait'].includes(candidate?.intent)
            ? candidate.intent
            : 'execute',
        proposedStateChanges: (Array.isArray(candidate?.stateChanges)
            ? candidate.stateChanges
            : []).map((entry) => ({
            kind: cleanText(entry?.kind, 80),
            summary: cleanText(entry?.summary, 500),
        })).filter((entry) => entry.kind && entry.summary),
        resourceCosts: (Array.isArray(candidate?.resourceCosts)
            ? candidate.resourceCosts
            : []).map((entry) => ({
            resourceId: cleanText(entry?.resourceId, 100),
            amount: Math.max(0, Number(entry?.amount) || 0),
        })).filter((entry) => entry.resourceId && entry.amount > 0),
        capabilityUsed: cleanText(candidate?.capabilityUsed, 160),
        interactionTargets: clone(candidate?.interactionTargets || []),
        location: clone(candidate?.location || null),
        evidence: cleanList(candidate?.evidence, 16, 300),
        sourceRef: clone(sourceRef),
        playerTargeted: targetsPlayer(candidate, playerNames),
        playerActionSettled: false,
        playerConsentSettled: false,
        playerFeelingSettled: false,
        status: 'attempted',
        outcome: null,
    };
}

function availableResource(actor, resourceId) {
    return (Array.isArray(actor?.resources) ? actor.resources : [])
        .find((entry) => cleanText(entry?.id, 100) === resourceId);
}

function knownCapability(actor, capability) {
    if (!capability) return true;
    return (Array.isArray(actor?.capabilities) ? actor.capabilities : [])
        .some((entry) => cleanText(entry, 160) === capability);
}

export function adjudicateActorActionAttempt(attempt, {
    actor = null,
    risk = 'ordinary',
    cost = [],
    durationTurns = 0,
    now = Date.now(),
} = {}) {
    const value = clone(attempt || {});
    const reasons = [];
    if (!value.id || !value.actorId || !value.action || !ROUTE_SET.has(value.route)) {
        reasons.push('attempt_invalid');
    }
    if (!knownCapability(actor, value.capabilityUsed)) reasons.push('capability_unconfirmed');
    for (const entry of value.resourceCosts || []) {
        const resource = availableResource(actor, entry.resourceId);
        if (!resource || Number(resource.amount) < Number(entry.amount)) {
            reasons.push('resource_unavailable');
        }
    }
    const playerBoundary = value.playerTargeted === true;
    const outcomeStatus = reasons.length
        ? 'rejected'
        : playerBoundary
            ? 'pending_player'
            : value.intent === 'wait'
                ? 'held'
                : 'settled';
    const appliesStateChanges = outcomeStatus === 'settled';
    const playerSafeAttemptChanges = outcomeStatus === 'pending_player'
        ? [{ kind: 'attempt', summary: cleanText(value.action, 500) }]
        : [];
    const result = {
        id: `RESULT-${fingerprint(`${value.id}|${outcomeStatus}`).slice(0, 24)}`,
        attemptId: value.id,
        actorId: value.actorId,
        actorName: value.actorName,
        turn: integer(value.turn),
        route: value.route,
        status: outcomeStatus,
        reasons: [...new Set(reasons)],
        appliedStateChanges: appliesStateChanges
            ? clone(value.proposedStateChanges || [])
            : playerSafeAttemptChanges,
        playerActionSettled: false,
        playerConsentSettled: false,
        playerFeelingSettled: false,
        visibility: value.route.startsWith('foreground_') ? 'attempt_only' : 'hidden',
        disclosure: value.route.startsWith('foreground_') ? 'attempt_visible' : 'pending',
        risk: cleanText(risk, 80) || 'ordinary',
        costs: clone(cost),
        resourceCosts: appliesStateChanges ? clone(value.resourceCosts || []) : [],
        durationTurns: integer(durationTurns),
        capabilityUsed: appliesStateChanges ? value.capabilityUsed : '',
        evidence: cleanList(value.evidence, 16, 300),
        settledAt: integer(now),
        historicalAbilityInvented: false,
    };
    const receipt = {
        receiptId: `AR-${fingerprint(`${result.id}|world_settled`).slice(0, 24)}`,
        actionId: value.id,
        actorId: value.actorId,
        stage: 'world_settled',
        status: outcomeStatus,
        route: value.route,
        resultId: result.id,
        visibility: result.visibility,
        disclosure: result.disclosure,
        risk: result.risk,
        durationTurns: result.durationTurns,
        resourceCosts: clone(result.resourceCosts),
        playerActionSettled: false,
        playerConsentSettled: false,
        playerFeelingSettled: false,
        createdTurn: integer(value.turn),
        settledAt: integer(now),
        evidence: cleanList(result.evidence, 16, 300),
    };
    return { attempt: value, result, receipt };
}

export function actorActionNarrativeInjection(attempt, result) {
    const route = ROUTE_SET.has(attempt?.route) ? attempt.route : result?.route;
    if (route === 'foreground_offer' || route === 'foreground_attempt') {
        return {
            route,
            text: cleanText(attempt?.action, 700),
            includesAttempt: true,
            includesResult: false,
            includesPlayerAction: false,
            includesPlayerConsent: false,
            includesPlayerFeeling: false,
        };
    }
    const disclosed = result?.disclosure === 'disclosed';
    return {
        route,
        text: disclosed
            ? cleanText(result?.publicSummary || result?.summary, 700)
            : '',
        includesAttempt: disclosed,
        includesResult: disclosed,
        includesPlayerAction: false,
        includesPlayerConsent: false,
        includesPlayerFeeling: false,
    };
}

export function discloseActorActionResult(result, {
    evidence = '',
    sourceRef = null,
    publicSummary = '',
    now = Date.now(),
} = {}) {
    const next = clone(result || {});
    const disclosureEvidence = cleanText(evidence, 700);
    if (!next.id || !disclosureEvidence) {
        return { result: next, disclosed: false };
    }
    next.disclosure = 'disclosed';
    next.visibility = 'observed';
    next.disclosureEvidence = disclosureEvidence;
    next.disclosureSourceRef = clone(sourceRef);
    next.publicSummary = cleanText(publicSummary, 700);
    next.disclosedAt = integer(now);
    return { result: next, disclosed: true };
}

export function worldEventFromSettledActionReceipt(receipt, {
    result = null,
} = {}) {
    if (
        receipt?.stage !== 'world_settled'
        || !['settled', 'partial'].includes(receipt?.status)
        || !receipt?.resultId
    ) return null;
    return {
        id: `EVENT-${fingerprint(`${receipt.receiptId}|${receipt.resultId}`).slice(0, 24)}`,
        sourceKind: 'settled_action_receipt',
        sourceReceiptId: cleanText(receipt.receiptId, 120),
        actorId: cleanText(receipt.actorId, 120),
        route: cleanText(receipt.route, 80),
        visibility: cleanText(result?.visibility || receipt.visibility, 80),
        disclosure: cleanText(result?.disclosure || receipt.disclosure, 80),
        summary: cleanText(result?.publicSummary || result?.summary, 700),
        createdTurn: integer(receipt.createdTurn),
    };
}

export function independentWorldProcessEvent(value) {
    const source = value && typeof value === 'object' ? value : {};
    const summary = cleanText(source.summary, 700);
    if (!summary || !cleanText(source.processId, 120)) return null;
    return {
        id: `EVENT-${fingerprint(`${source.processId}|${source.turn}|${summary}`).slice(0, 24)}`,
        sourceKind: 'independent_world_process',
        sourceReceiptId: '',
        actorId: '',
        route: 'background_public',
        visibility: source.visibility === 'observed' ? 'observed' : 'hidden',
        disclosure: source.visibility === 'observed' ? 'disclosed' : 'pending',
        summary,
        createdTurn: integer(source.turn),
    };
}

export function containsForgedPlayerSettlement(value) {
    const serialized = JSON.stringify(value ?? {});
    return PLAYER_SETTLEMENT.test(serialized)
        || value?.playerActionSettled === true
        || value?.playerConsentSettled === true
        || value?.playerFeelingSettled === true;
}
