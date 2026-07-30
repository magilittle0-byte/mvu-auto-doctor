import { fingerprint } from './core.mjs';

export const ACTOR_LEDGER_VERSION = 1;
export const ACTOR_LEDGER_MAX_ACTORS = 96;
export const ACTOR_LEDGER_MAX_RECEIPTS = 240;

const TIERS = new Set(['key', 'secondary', 'background']);
const STATUSES = new Set(['active', 'dormant', 'resolved']);
const KNOWLEDGE_KINDS = new Set(['observed', 'reported', 'inferred']);
const INTENTS = new Set(['execute', 'replan', 'wait']);
const PRIVATE_NARRATION = /(?:心想|暗想|暗自|内心|心底|心理|秘密想|私下决定|未说出口|回忆起|玩家的秘密|玩家私密)/u;
const PLAYER_SOVEREIGNTY = /(?:让|迫使|命令|说服|要求)(?:了)?玩家(?:接受|同意|服从|支付|交出|前往|离开|攻击|回答|承诺|决定)|玩家(?:接受了|同意了|服从了|支付了|交出了|前往了|离开了|攻击了|回答了|承诺了|决定了)/u;
const GENERIC_WAIT = /^(?:等待|继续等待|暂时不动|按兵不动|保持现状|没有变化|暂无变化|无事发生|条件未成熟)[。.!！]?$/u;

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function cleanText(value, limit = 500) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function cleanList(value, limit = 12, itemLimit = 300) {
    if (!Array.isArray(value)) return [];
    const result = [];
    const seen = new Set();
    for (const raw of value) {
        const item = cleanText(raw, itemLimit);
        const key = item.toLocaleLowerCase();
        if (!item || seen.has(key)) continue;
        seen.add(key);
        result.push(item);
        if (result.length >= limit) break;
    }
    return result;
}

function integer(value, minimum, maximum, fallback) {
    const parsed = Math.floor(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

function number(value, minimum, maximum, fallback) {
    const parsed = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

function stableActorId(name) {
    return `NPC-${fingerprint(cleanText(name, 160).toLocaleLowerCase()).slice(0, 16)}`;
}

function normalizeSourceRef(value) {
    if (!value || typeof value !== 'object') return null;
    const chatId = cleanText(value.chatId, 180);
    const messageId = cleanText(value.messageId, 180);
    const hash = cleanText(value.hash, 100);
    if (!chatId || !messageId || !hash) return null;
    return {
        chatId,
        messageId,
        index: integer(value.index, 0, Number.MAX_SAFE_INTEGER, 0),
        swipeId: integer(value.swipeId, 0, Number.MAX_SAFE_INTEGER, 0),
        hash,
    };
}

function normalizeKnowledge(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const claim = cleanText(value.claim, 700);
    if (!claim) return null;
    const sourceRef = normalizeSourceRef(value.sourceRef);
    return {
        id: cleanText(value.id, 100)
            || `K-${fingerprint(`${claim}|${sourceRef?.hash || index}`).slice(0, 16)}`,
        claim,
        kind: KNOWLEDGE_KINDS.has(value.kind) ? value.kind : 'reported',
        confidence: number(value.confidence, 0, 1, value.kind === 'observed' ? 1 : 0.6),
        learnedTurn: integer(value.learnedTurn, 0, Number.MAX_SAFE_INTEGER, turn),
        sourceRef,
        propagation: cleanList(value.propagation, 12, 160),
    };
}

function normalizeResources(value) {
    if (!Array.isArray(value)) return [];
    const result = [];
    const used = new Set();
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const name = cleanText(raw.name || raw.id, 120);
        const id = cleanText(raw.id, 100)
            || `RES-${fingerprint(name.toLocaleLowerCase()).slice(0, 12)}`;
        if (!name || used.has(id)) continue;
        used.add(id);
        result.push({
            id,
            name,
            amount: number(raw.amount, 0, 1_000_000_000, 0),
            unit: cleanText(raw.unit, 60),
            evidence: cleanList(raw.evidence, 6, 240),
        });
        if (result.length >= 24) break;
    }
    return result;
}

function normalizeCommitments(value, turn) {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => item && typeof item === 'object')
        .map((item, index) => ({
            id: cleanText(item.id, 100) || `COM-${index + 1}`,
            summary: cleanText(item.summary, 400),
            dueTurn: integer(item.dueTurn, 0, Number.MAX_SAFE_INTEGER, turn + 1),
            status: ['open', 'fulfilled', 'broken', 'cancelled'].includes(item.status)
                ? item.status
                : 'open',
            targetActorId: cleanText(item.targetActorId, 100),
            evidence: cleanList(item.evidence, 6, 240),
        }))
        .filter((item) => item.summary)
        .slice(0, 16);
}

function normalizeActor(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const name = cleanText(value.name || value.id, 160);
    if (!name) return null;
    const identity = value.identity && typeof value.identity === 'object' ? value.identity : {};
    const hidden = value.hidden && typeof value.hidden === 'object' ? value.hidden : {};
    const plan = value.plan && typeof value.plan === 'object' ? value.plan : {};
    const location = value.location && typeof value.location === 'object'
        ? value.location
        : { name: value.location };
    const id = cleanText(value.id, 120) || stableActorId(name);
    return {
        id,
        name,
        tier: TIERS.has(value.tier) ? value.tier : 'background',
        status: STATUSES.has(value.status) ? value.status : 'active',
        identity: {
            role: cleanText(identity.role, 180),
            aliases: cleanList(identity.aliases, 8, 120),
            traits: cleanList(identity.traits, 12, 180),
            desires: cleanList(identity.desires, 12, 240),
            boundaries: cleanList(identity.boundaries, 12, 240),
        },
        longTermGoals: cleanList(value.longTermGoals, 12, 400),
        currentGoals: cleanList(value.currentGoals, 8, 400),
        knowledge: (Array.isArray(value.knowledge) ? value.knowledge : [])
            .map((item, knowledgeIndex) => normalizeKnowledge(item, knowledgeIndex, turn))
            .filter(Boolean)
            .slice(-48),
        location: {
            name: cleanText(location.name, 180) || 'unknown',
            sinceTurn: integer(location.sinceTurn, 0, Number.MAX_SAFE_INTEGER, turn),
            evidence: cleanList(location.evidence, 8, 240),
        },
        resources: normalizeResources(value.resources),
        capabilities: cleanList(value.capabilities, 24, 160),
        relationships: (Array.isArray(value.relationships) ? value.relationships : [])
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                actorId: cleanText(item.actorId, 120),
                summary: cleanText(item.summary, 300),
                evidence: cleanList(item.evidence, 6, 240),
            }))
            .filter((item) => item.actorId && item.summary)
            .slice(0, 24),
        commitments: normalizeCommitments(value.commitments, turn),
        hidden: {
            emotionalInertia: cleanList(hidden.emotionalInertia, 12, 240),
            innerConflicts: cleanList(hidden.innerConflicts, 12, 300),
            privateIntentions: cleanList(hidden.privateIntentions, 12, 300),
        },
        plan: {
            summary: cleanText(plan.summary, 500),
            steps: cleanList(plan.steps, 12, 300),
            status: ['active', 'blocked', 'completed', 'abandoned'].includes(plan.status)
                ? plan.status
                : 'active',
        },
        lastAction: value.lastAction && typeof value.lastAction === 'object'
            ? {
                id: cleanText(value.lastAction.id, 120),
                turn: integer(value.lastAction.turn, 0, Number.MAX_SAFE_INTEGER, turn),
                summary: cleanText(value.lastAction.summary, 500),
                outcome: cleanText(value.lastAction.outcome, 120),
            }
            : null,
        nextActionTurn: integer(value.nextActionTurn, 0, Number.MAX_SAFE_INTEGER, turn + 1),
        deadlineTurn: integer(value.deadlineTurn, 0, Number.MAX_SAFE_INTEGER, 0),
        initiative: number(value.initiative, 0, 3, 1),
        opportunity: number(value.opportunity, 0, 3, 0),
        silenceTurns: integer(value.silenceTurns, 0, 10_000, 0),
        attentionScore: number(value.attentionScore, 0, 1_000_000, 0),
        evidence: cleanList(value.evidence, 24, 300),
        version: integer(value.version, 1, Number.MAX_SAFE_INTEGER, 1),
        createdTurn: integer(value.createdTurn, 0, Number.MAX_SAFE_INTEGER, turn),
        updatedTurn: integer(value.updatedTurn, 0, Number.MAX_SAFE_INTEGER, turn),
        settledActionCount: integer(value.settledActionCount, 0, Number.MAX_SAFE_INTEGER, 0),
    };
}

function normalizeReceipt(value) {
    if (!value || typeof value !== 'object') return null;
    const receiptId = cleanText(value.receiptId, 180);
    if (!receiptId) return null;
    return {
        ...clone(value),
        receiptId,
        actionId: cleanText(value.actionId, 160),
        actorId: cleanText(value.actorId, 120),
        stage: ['planned', 'executed', 'world_settled', 'injected', 'response_settled']
            .includes(value.stage)
            ? value.stage
            : 'planned',
        status: cleanText(value.status, 80) || 'pending',
        observableConsequence: cleanText(value.observableConsequence, 500),
        createdTurn: integer(value.createdTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    };
}

export function emptyActorLedger(chatId = '') {
    return {
        version: ACTOR_LEDGER_VERSION,
        chatId: cleanText(chatId, 180),
        turn: 0,
        actors: [],
        actionReceipts: [],
        observationReceipts: [],
        migrations: { continuityV5: false },
        updatedAt: 0,
    };
}

export function normalizeActorLedger(value, {
    chatId = '',
    maxActors = ACTOR_LEDGER_MAX_ACTORS,
} = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const turn = integer(source.turn, 0, Number.MAX_SAFE_INTEGER, 0);
    const actors = [];
    const used = new Set();
    for (const raw of Array.isArray(source.actors) ? source.actors : []) {
        const item = normalizeActor(raw, actors.length, turn);
        if (!item || used.has(item.id)) continue;
        used.add(item.id);
        actors.push(item);
        if (actors.length >= integer(maxActors, 1, ACTOR_LEDGER_MAX_ACTORS, ACTOR_LEDGER_MAX_ACTORS)) {
            break;
        }
    }
    return {
        version: ACTOR_LEDGER_VERSION,
        chatId: cleanText(chatId || source.chatId, 180),
        turn,
        actors,
        actionReceipts: (Array.isArray(source.actionReceipts) ? source.actionReceipts : [])
            .map(normalizeReceipt)
            .filter(Boolean)
            .slice(-ACTOR_LEDGER_MAX_RECEIPTS),
        observationReceipts: (Array.isArray(source.observationReceipts)
            ? clone(source.observationReceipts)
            : []).slice(-120),
        migrations: {
            continuityV5: source.migrations?.continuityV5 === true,
        },
        updatedAt: integer(source.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    };
}

function mergeEvidence(current, additions, limit = 24) {
    return cleanList([...(current || []), ...(additions || [])], limit, 300);
}

export function migrateActorLedgerFromContinuity(value, continuity) {
    const ledger = normalizeActorLedger(value, { chatId: continuity?.chatId || value?.chatId });
    const byId = new Map(ledger.actors.map((item) => [item.id, item]));
    const turn = integer(continuity?.turn, 0, Number.MAX_SAFE_INTEGER, ledger.turn);
    for (const thread of Array.isArray(continuity?.threads) ? continuity.threads : []) {
        for (const actorName of cleanList(thread?.actors, 16, 160)) {
            const id = stableActorId(actorName);
            const current = byId.get(id) || normalizeActor({
                id,
                name: actorName,
                tier: 'background',
                location: {
                    name: cleanList(thread?.locations, 1, 180)[0] || 'unknown',
                    sinceTurn: turn,
                    evidence: cleanList([thread?.id, thread?.seedBasis], 8, 240),
                },
                currentGoals: thread?.knowledge === 'hidden'
                    ? []
                    : cleanList([thread?.nextBeat, thread?.trigger], 4, 400),
                nextActionTurn: turn + 1,
                evidence: cleanList([
                    thread?.id,
                    thread?.seedBasis,
                    ...(thread?.sourceRefs || []).map((ref) => ref?.hash),
                ], 12, 300),
                createdTurn: turn,
                updatedTurn: turn,
            }, byId.size, turn);
            current.evidence = mergeEvidence(current.evidence, [
                thread?.id,
                thread?.seedBasis,
                ...(thread?.sourceRefs || []).map((ref) => ref?.hash),
            ]);
            if (thread?.knowledge !== 'hidden') {
                current.currentGoals = mergeEvidence(current.currentGoals, [
                    thread?.nextBeat,
                    thread?.trigger,
                ], 8);
                const claim = cleanText(thread?.summary, 700);
                if (claim) {
                    const knowledge = normalizeKnowledge({
                        claim,
                        kind: thread?.knowledge === 'observed' ? 'observed' : 'reported',
                        confidence: thread?.knowledge === 'observed' ? 1 : 0.6,
                        learnedTurn: turn,
                        sourceRef: thread?.sourceRefs?.at?.(-1),
                        propagation: [thread?.id],
                    }, current.knowledge.length, turn);
                    if (
                        knowledge
                        && !current.knowledge.some((item) => item.id === knowledge.id)
                    ) current.knowledge.push(knowledge);
                }
            }
            byId.set(id, current);
        }
    }
    return normalizeActorLedger({
        ...ledger,
        turn: Math.max(ledger.turn, turn),
        actors: [...byId.values()],
        migrations: { ...ledger.migrations, continuityV5: true },
        updatedAt: Date.now(),
    }, { chatId: ledger.chatId || continuity?.chatId });
}

function observableStatements(content) {
    const accepted = String(content ?? '')
        .replace(/^[\s\S]*?<content\b[^>]*>/iu, '')
        .replace(/<\/content>[\s\S]*$/iu, '')
        .replace(/<[^>]+>/gu, ' ');
    return accepted
        .split(/(?<=[。！？.!?])\s*/u)
        .map((item) => cleanText(item, 700))
        .filter((item) => item.length >= 4 && !PRIVATE_NARRATION.test(item))
        .slice(0, 12);
}

export function applyAcceptedContentObservations(value, {
    content = '',
    sourceRef = null,
    observerActorIds = [],
} = {}) {
    const ledger = normalizeActorLedger(value);
    const ref = normalizeSourceRef(sourceRef);
    const observers = new Set(cleanList(observerActorIds, 32, 120));
    const statements = observableStatements(content);
    if (!ref || !observers.size || !statements.length) return ledger;
    const learnedIds = [];
    ledger.actors = ledger.actors.map((actor) => {
        if (!observers.has(actor.id)) return actor;
        const next = clone(actor);
        for (const claim of statements) {
            const knowledge = normalizeKnowledge({
                claim,
                kind: 'observed',
                confidence: 1,
                learnedTurn: ledger.turn,
                sourceRef: ref,
                propagation: ['accepted-content'],
            }, next.knowledge.length, ledger.turn);
            if (!knowledge || next.knowledge.some((item) => item.id === knowledge.id)) continue;
            next.knowledge.push(knowledge);
            learnedIds.push(knowledge.id);
        }
        next.knowledge = next.knowledge.slice(-48);
        next.updatedTurn = ledger.turn;
        next.version += 1;
        return next;
    });
    ledger.observationReceipts.push({
        receiptId: `actor-observation:${fingerprint(`${ref.messageId}|${ref.swipeId}|${ref.hash}`).slice(0, 18)}`,
        sourceRef: ref,
        observerActorIds: [...observers],
        knowledgeIds: [...new Set(learnedIds)],
        statementCount: statements.length,
        settledAt: Date.now(),
    });
    ledger.observationReceipts = ledger.observationReceipts.slice(-120);
    ledger.updatedAt = Date.now();
    return ledger;
}

export function inferObserverActorIds(value, content) {
    const ledger = normalizeActorLedger(value);
    const source = String(content ?? '');
    return ledger.actors
        .filter((actor) => {
            const names = [actor.name, ...actor.identity.aliases]
                .map((item) => cleanText(item, 160))
                .filter((item) => item.length >= 2);
            return names.some((name) => {
                const index = source.indexOf(name);
                if (index < 0) return false;
                const context = source.slice(Math.max(0, index - 12), index + name.length + 16);
                return !/(?:不在场|已经离场|远在|另一边|并未到场|缺席)/u.test(context);
            });
        })
        .map((actor) => actor.id);
}

function schedulingScore(actor, turn) {
    const due = actor.nextActionTurn <= turn;
    const deadlineDistance = actor.deadlineTurn > 0 ? actor.deadlineTurn - turn : Infinity;
    const openCommitments = actor.commitments.filter((item) => item.status === 'open');
    const overdueCommitments = openCommitments.filter((item) => item.dueTurn <= turn);
    const reasons = [];
    let score = 0;
    if (due) {
        score += 100;
        reasons.push('action-due');
    }
    if (deadlineDistance <= 0) {
        score += 90;
        reasons.push('deadline-due');
    } else if (deadlineDistance <= 2) {
        score += 45;
        reasons.push('deadline-near');
    }
    if (overdueCommitments.length) {
        score += 70 + overdueCommitments.length * 8;
        reasons.push('commitment-due');
    } else if (openCommitments.length) {
        score += 18;
        reasons.push('commitment-open');
    }
    score += actor.initiative * 12;
    score += actor.opportunity * 14;
    score += Math.min(40, actor.silenceTurns * 2);
    score += Math.min(20, actor.resources.reduce((total, item) => total + item.amount, 0));
    score -= Math.min(40, actor.attentionScore / 10);
    if (actor.status === 'dormant') score -= 10;
    if (actor.status === 'resolved') score = -Infinity;
    return { score, reasons };
}

export function scheduleActorTurns(value, {
    turn = null,
    maxActors = 2,
    explorationSlots = 1,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const currentTurn = integer(turn, 0, Number.MAX_SAFE_INTEGER, ledger.turn);
    const limit = integer(maxActors, 0, 5, 2);
    const explorationLimit = Math.min(
        limit,
        integer(explorationSlots, 0, 2, 1),
    );
    const scored = ledger.actors
        .map((actor) => ({ actor, ...schedulingScore(actor, currentTurn) }))
        .filter((item) => Number.isFinite(item.score))
        .sort((left, right) => (
            right.score - left.score
            || left.actor.nextActionTurn - right.actor.nextActionTurn
            || left.actor.id.localeCompare(right.actor.id)
        ));
    const coreLimit = Math.max(0, limit - explorationLimit);
    const selected = scored.slice(0, coreLimit).map((item) => ({
        actorId: item.actor.id,
        actorName: item.actor.name,
        slot: 'priority',
        score: item.score,
        reasons: item.reasons.length ? item.reasons : ['initiative-opportunity'],
    }));
    const selectedIds = new Set(selected.map((item) => item.actorId));
    const exploration = scored
        .filter((item) => !selectedIds.has(item.actor.id))
        .sort((left, right) => (
            left.actor.attentionScore - right.actor.attentionScore
            || right.actor.silenceTurns - left.actor.silenceTurns
            || right.actor.opportunity - left.actor.opportunity
            || left.actor.id.localeCompare(right.actor.id)
        ))
        .slice(0, explorationLimit)
        .map((item) => ({
            actorId: item.actor.id,
            actorName: item.actor.name,
            slot: 'exploration',
            score: item.score,
            reasons: ['low-attention-exploration'],
        }));
    return {
        turn: currentTurn,
        selected: [...selected, ...exploration],
        deferredActorIds: scored
            .filter((item) => !selectedIds.has(item.actor.id)
                && !exploration.some((candidate) => candidate.actorId === item.actor.id))
            .map((item) => item.actor.id),
    };
}

export function actorActionCandidatesFromShard(value, proposals, {
    turn = null,
    collisionIntensity = 2,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const currentTurn = integer(turn, 0, Number.MAX_SAFE_INTEGER, ledger.turn);
    const byId = new Map(ledger.actors.map((item) => [item.id, item]));
    const intensity = integer(collisionIntensity, 0, 3, 2);
    return (Array.isArray(proposals) ? proposals : []).map((proposal) => {
        const actor = byId.get(cleanText(proposal?.actorId, 120));
        if (!actor) return clone(proposal);
        const action = cleanText(proposal?.candidateAction, 700);
        const wait = /(?:等待|暂缓|按兵不动|尚缺|条件未满足)/u.test(action);
        const replan = /(?:改为|调整计划|重新计划|另寻|放弃原计划)/u.test(action);
        const contactMatch = intensity > 0 && action.match(
            intensity >= 2
                ? /(?:寻找|来访|拜访|寄信|传信|悬赏|跟踪|求助|袭击|取走|拿走|封锁|抬价|降价|散布|公告|布告|交通|舆论)/u
                : /(?:来访|拜访|寄信|传信|袭击|求助)/u,
        );
        const knowledgeRefs = (actor.knowledge || [])
            .filter((item) => (proposal?.knowledgeBasis || []).includes(item.claim))
            .map((item) => item.id);
        const allowedEvidence = new Set([
            ...actor.evidence,
            ...actor.knowledge.map((item) => item.id),
        ]);
        const evidence = cleanList([
            ...(proposal?.evidence || []),
            ...knowledgeRefs,
        ], 24, 300).filter((item) => allowedEvidence.has(item));
        return {
            actorId: actor.id,
            actorName: actor.name,
            intent: wait ? 'wait' : replan ? 'replan' : 'execute',
            time: { turn: currentTurn, window: cleanText(proposal?.time, 160) || 'now' },
            location: {
                from: actor.location.name,
                to: cleanText(proposal?.location, 180) || actor.location.name,
                travelTurns: 0,
            },
            action,
            knowledgeRefs,
            resourceCosts: [],
            capabilityUsed: '',
            contact: contactMatch
                ? {
                    mode: cleanText(contactMatch[0], 80),
                    target: cleanText(
                        proposal?.interactionTargets?.[0]?.actorName || '当前世界',
                        180,
                    ),
                    observableConsequence: action,
                }
                : null,
            planUpdate: cleanText(proposal?.currentGoal, 500),
            waitCondition: wait ? action : '',
            evidence: evidence.length ? evidence : actor.evidence.slice(0, 1),
        };
    });
}

export function mergeActorWorldEventsIntoContinuity(continuity, worldEvents) {
    const state = clone(continuity || {});
    state.threads = Array.isArray(state.threads) ? state.threads : [];
    const existing = new Set(state.threads.map((thread) => thread?.id));
    for (const event of Array.isArray(worldEvents) ? worldEvents : []) {
        const id = `ACTOR-${cleanText(event?.id, 90)}`;
        if (!event?.id || existing.has(id)) continue;
        existing.add(id);
        const observable = cleanText(event.observableConsequence, 500);
        state.threads.push({
            id,
            title: `${cleanText(event.actorName, 120)}的主动行动`,
            kind: 'personal',
            eventType: 'progress',
            level: 1,
            origin: 'setting_independent',
            relation: observable ? 'converging' : 'independent',
            stage: observable ? 'manifested' : 'advancing',
            summary: cleanText(event.summary, 700),
            offscreenBeat: cleanText(event.summary, 500),
            nextBeat: '等待可观察后果自然进入场景或在后台继续',
            trigger: observable || '等待行动留下可传播或可观察后果',
            intersection: observable,
            seedBasis: cleanText(event.id, 300),
            causedBy: [],
            effects: [observable].filter(Boolean),
            rumors: [],
            actors: [cleanText(event.actorName, 120)].filter(Boolean),
            locations: [cleanText(event.location, 120)].filter(Boolean),
            propagation: [],
            convergence: {
                score: observable ? 3 : 0,
                channels: observable ? ['actor', 'location'] : [],
                evidence: [cleanText(event.id, 240)],
                entryBeat: observable,
                lastCheckedTurn: Number(event.turn) || Number(state.turn) || 0,
            },
            knowledge: observable ? 'observed' : 'hidden',
            urgency: observable ? 2 : 1,
            stageProgress: 1,
            evolveResult: '',
            consecutiveFails: 0,
            stalled: false,
            outcome: '',
            createdTurn: Number(event.turn) || Number(state.turn) || 0,
            lastAdvancedTurn: Number(event.turn) || Number(state.turn) || 0,
            resolvedTurn: 0,
            sourceRefs: [],
        });
    }
    return state;
}

function validateCandidate(actor, candidate, turn) {
    const reasons = [];
    if (!actor || cleanText(candidate?.actorId, 120) !== actor.id) {
        return ['actor-identity-mismatch'];
    }
    if (cleanText(candidate?.actorName, 160) !== actor.name) {
        reasons.push('actor-identity-mismatch');
    }
    const intent = cleanText(candidate?.intent, 40);
    if (!INTENTS.has(intent)) reasons.push('intent-invalid');
    const action = cleanText(candidate?.action, 700);
    if (!action) reasons.push('action-missing');
    if (PLAYER_SOVEREIGNTY.test(action)) reasons.push('player-sovereignty');
    const time = candidate?.time && typeof candidate.time === 'object' ? candidate.time : {};
    if (integer(time.turn, 0, Number.MAX_SAFE_INTEGER, -1) !== turn) {
        reasons.push('time-invalid');
    }
    const location = candidate?.location && typeof candidate.location === 'object'
        ? candidate.location
        : {};
    const from = cleanText(location.from, 180);
    const to = cleanText(location.to, 180);
    const travelTurns = integer(location.travelTurns, 0, 10_000, 0);
    if (
        from !== actor.location.name
        || !to
        || (to !== from && travelTurns <= 0)
    ) reasons.push('location-or-travel-invalid');
    const knowledgeIds = new Set(actor.knowledge.map((item) => item.id));
    const actorEvidence = new Set([
        ...actor.evidence,
        ...actor.knowledge.map((item) => item.id),
    ]);
    const knowledgeRefs = cleanList(candidate?.knowledgeRefs, 24, 120);
    const evidence = cleanList(candidate?.evidence, 24, 300);
    if (knowledgeRefs.some((id) => !knowledgeIds.has(id))) {
        reasons.push('knowledge-out-of-bounds');
    }
    if (evidence.some((item) => !actorEvidence.has(item))) {
        reasons.push('evidence-out-of-bounds');
    }
    const resourceById = new Map(actor.resources.map((item) => [item.id, item]));
    const costs = Array.isArray(candidate?.resourceCosts) ? candidate.resourceCosts : [];
    if (costs.some((cost) => (
        !resourceById.has(cleanText(cost?.resourceId, 100))
        || number(cost?.amount, 0, 1_000_000_000, 0)
            > resourceById.get(cleanText(cost?.resourceId, 100)).amount
    ))) reasons.push('resource-insufficient');
    const capability = cleanText(candidate?.capabilityUsed, 160);
    if (capability && !actor.capabilities.includes(capability)) {
        reasons.push('capability-out-of-bounds');
    }
    if (intent === 'wait') {
        const condition = cleanText(candidate?.waitCondition, 500);
        if (condition.length < 8 || GENERIC_WAIT.test(condition)) {
            reasons.push('wait-condition-not-concrete');
        }
    }
    return [...new Set(reasons)];
}

function contactWorldEvent(actor, candidate, actionId, turn) {
    const contact = candidate?.contact && typeof candidate.contact === 'object'
        ? candidate.contact
        : null;
    const observable = cleanText(contact?.observableConsequence, 500);
    return {
        id: `AE-${fingerprint(`${actionId}|${observable}`).slice(0, 16)}`,
        actorId: actor.id,
        actorName: actor.name,
        actionId,
        turn,
        type: cleanText(contact?.mode, 80) || 'private_action',
        target: cleanText(contact?.target, 180),
        summary: cleanText(candidate.action, 700),
        observableConsequence: observable,
        location: cleanText(candidate?.location?.to, 180),
        knowledge: observable ? 'observed' : 'hidden',
        status: 'settled',
        sourceEvidence: cleanList(candidate.evidence, 24, 300),
    };
}

function stageReceipt(actionId, actorId, stage, turn, extra = {}) {
    return normalizeReceipt({
        receiptId: `actor-action:${actionId}:${stage}`,
        actionId,
        actorId,
        stage,
        status: stage === 'injected' ? 'pending' : 'settled',
        createdTurn: turn,
        ...extra,
    });
}

function updateTier(actor) {
    if (actor.tier === 'background' && actor.settledActionCount >= 3) return 'secondary';
    if (actor.tier === 'secondary' && actor.settledActionCount >= 8) return 'key';
    if (
        actor.tier === 'key'
        && actor.silenceTurns >= 24
        && !actor.commitments.some((item) => item.status === 'open')
    ) return 'secondary';
    return actor.tier;
}

export function settleActorActionCandidates(value, candidates, {
    turn = null,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const currentTurn = integer(turn, 0, Number.MAX_SAFE_INTEGER, ledger.turn);
    const byId = new Map(ledger.actors.map((item) => [item.id, item]));
    const accepted = [];
    const rejected = [];
    const worldEvents = [];
    const receipts = [];
    for (const raw of Array.isArray(candidates) ? candidates : []) {
        const candidate = clone(raw);
        const actor = byId.get(cleanText(candidate?.actorId, 120));
        const reasons = validateCandidate(actor, candidate, currentTurn);
        if (reasons.length) {
            rejected.push({
                actorId: cleanText(candidate?.actorId, 120),
                reasons,
            });
            continue;
        }
        const actionId = `ACT-${fingerprint(JSON.stringify([
            actor.id,
            currentTurn,
            candidate.intent,
            candidate.action,
            candidate.location,
        ])).slice(0, 18)}`;
        const next = clone(actor);
        for (const cost of Array.isArray(candidate.resourceCosts) ? candidate.resourceCosts : []) {
            const resource = next.resources.find(
                (item) => item.id === cleanText(cost.resourceId, 100),
            );
            if (resource) resource.amount -= number(cost.amount, 0, resource.amount, 0);
        }
        if (candidate.intent === 'execute' && candidate.location.to !== next.location.name) {
            next.location = {
                name: cleanText(candidate.location.to, 180),
                sinceTurn: currentTurn + integer(candidate.location.travelTurns, 0, 10_000, 0),
                evidence: mergeEvidence(next.location.evidence, candidate.evidence, 8),
            };
        }
        const planUpdate = cleanText(candidate.planUpdate, 500);
        if (planUpdate) next.plan.summary = planUpdate;
        if (candidate.intent === 'wait') next.plan.status = 'blocked';
        else if (candidate.intent === 'replan') next.plan.status = 'active';
        next.lastAction = {
            id: actionId,
            turn: currentTurn,
            summary: cleanText(candidate.action, 700),
            outcome: candidate.intent,
        };
        next.nextActionTurn = currentTurn + Math.max(
            1,
            integer(candidate.location.travelTurns, 0, 10_000, 0),
        );
        next.silenceTurns = 0;
        next.attentionScore += candidate.contact ? 1 : 0;
        next.settledActionCount += 1;
        next.tier = updateTier(next);
        next.status = 'active';
        next.updatedTurn = currentTurn;
        next.version += 1;
        byId.set(next.id, next);
        const event = contactWorldEvent(next, candidate, actionId, currentTurn);
        accepted.push({ ...candidate, actionId });
        receipts.push(stageReceipt(actionId, next.id, 'planned', currentTurn, {
            summary: cleanText(candidate.planUpdate || next.plan.summary, 500),
        }));
        receipts.push(stageReceipt(actionId, next.id, 'executed', currentTurn, {
            summary: cleanText(candidate.action, 700),
        }));
        receipts.push(stageReceipt(actionId, next.id, 'world_settled', currentTurn, {
            worldEventId: event?.id || '',
            observableConsequence: event?.observableConsequence || '',
        }));
        worldEvents.push(event);
        if (event.observableConsequence) {
            receipts.push(stageReceipt(actionId, next.id, 'injected', currentTurn, {
                worldEventId: event.id,
                observableConsequence: event.observableConsequence,
            }));
        }
    }
    ledger.turn = Math.max(ledger.turn, currentTurn);
    ledger.actors = ledger.actors.map((actor) => {
        const next = byId.get(actor.id) || actor;
        if (!accepted.some((item) => item.actorId === actor.id)) {
            next.silenceTurns = Math.min(10_000, next.silenceTurns + 1);
            if (
                next.status === 'active'
                && next.silenceTurns >= 12
                && !next.commitments.some((item) => item.status === 'open')
            ) next.status = 'dormant';
        }
        return next;
    });
    ledger.actionReceipts = [...ledger.actionReceipts, ...receipts]
        .slice(-ACTOR_LEDGER_MAX_RECEIPTS);
    ledger.updatedAt = Date.now();
    return { ledger, accepted, rejected, worldEvents, receipts };
}

export function settleActorInjectionReceipts(value, {
    content = '',
    sourceRef = null,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const accepted = String(content ?? '')
        .replace(/^[\s\S]*?<content\b[^>]*>/iu, '')
        .replace(/<\/content>[\s\S]*$/iu, '');
    const ref = normalizeSourceRef(sourceRef);
    if (!ref) return ledger;
    ledger.actionReceipts = ledger.actionReceipts.map((receipt) => {
        if (receipt.stage !== 'injected' || receipt.status !== 'pending') return receipt;
        const evidence = receipt.observableConsequence
            && accepted.includes(receipt.observableConsequence)
            ? receipt.observableConsequence
            : '';
        return {
            ...receipt,
            stage: 'response_settled',
            status: evidence ? 'consumed' : 'retained',
            consumptionEvidence: evidence,
            responseSourceRef: ref,
            settledAt: Date.now(),
        };
    });
    ledger.updatedAt = Date.now();
    return ledger;
}

export function actorLedgerView(value) {
    const ledger = normalizeActorLedger(value);
    return {
        version: ledger.version,
        turn: ledger.turn,
        actorCount: ledger.actors.length,
        activeCount: ledger.actors.filter((item) => item.status === 'active').length,
        dormantCount: ledger.actors.filter((item) => item.status === 'dormant').length,
        actors: ledger.actors.map((actor) => {
            const publicActor = clone(actor);
            delete publicActor.hidden;
            return publicActor;
        }),
        receipts: clone(ledger.actionReceipts),
        observationReceipts: clone(ledger.observationReceipts),
        privateThoughtsExposed: false,
    };
}
