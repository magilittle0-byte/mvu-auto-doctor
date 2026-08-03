import { fingerprint } from './core.mjs';

export const ACTOR_LEDGER_VERSION = 3;
export const ACTOR_LEDGER_MAX_ACTORS = 96;
export const ACTOR_LEDGER_MAX_RECEIPTS = 240;

const TIERS = new Set(['key', 'secondary', 'background']);
const STATUSES = new Set(['active', 'dormant', 'departed', 'deceased', 'resolved']);
const KNOWLEDGE_KINDS = new Set(['observed', 'reported', 'inferred']);
const INTENTS = new Set(['execute', 'replan', 'wait']);
const PRIVATE_NARRATION = /(?:心想|暗想|暗自|内心|心底|心理|秘密想|私下决定|未说出口|回忆起|玩家的秘密|玩家私密)/u;
const PLAYER_SOVEREIGNTY = /(?:让|迫使|命令|说服|要求)(?:了)?玩家(?:接受|同意|服从|支付|交出|前往|离开|攻击|回答|承诺|决定)|玩家(?:接受了|同意了|服从了|支付了|交出了|前往了|离开了|攻击了|回答了|承诺了|决定了)/u;
const GENERIC_WAIT = /^(?:等待|继续等待|暂时不动|按兵不动|保持现状|没有变化|暂无变化|无事发生|条件未成熟)[。.!！]?$/u;
const GROUP_NAME = /(?:队|军|协会|组织|公司|家族|势力|居民|商户|人群|群众|议会|公会|商会)$/u;
const NON_ACTOR_NAME = /^(?:玩家|player|user|系统|system|环境|environment|世界|world|旁白|narrator|主持人|gm|game master)$/iu;
const DIRECT_OBSERVATION = /(?:看见|看到|目睹|注意到|发现|听见|听到|闻到|察觉|收到|读到|被告知|获悉|亲历|遭遇|触碰|检查到|观察到)/u;
const OBSERVATION_NEGATION = /(?:没看见|没有看见|未看见|没听见|没有听见|未听见|一无所知|并不知道|不知情|尚未知晓)/u;

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

function isActorName(value) {
    const name = cleanText(value, 160);
    return !!name
        && name.length >= 2
        && !NON_ACTOR_NAME.test(name)
        && !GROUP_NAME.test(name);
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
        generation: integer(value.generation, 0, Number.MAX_SAFE_INTEGER, 0),
        branchId: cleanText(value.branchId, 180),
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
    const lineage = value.lineage && typeof value.lineage === 'object' ? value.lineage : {};
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
        inactiveReason: ['sleep', 'absence', 'quiet'].includes(value.inactiveReason)
            ? value.inactiveReason
            : '',
        identity: {
            role: cleanText(identity.role, 180),
            aliases: cleanList(identity.aliases, 8, 120),
            traits: cleanList(identity.traits, 12, 180),
            desires: cleanList(identity.desires, 12, 240),
            boundaries: cleanList(identity.boundaries, 12, 240),
            socialStyle: cleanText(identity.socialStyle, 240),
            decisionStyle: cleanText(identity.decisionStyle, 240),
            speechStyle: cleanText(identity.speechStyle, 240),
            copingStyle: cleanText(identity.copingStyle, 240),
            everydayHabits: cleanList(identity.everydayHabits, 8, 180),
            blindSpots: cleanList(identity.blindSpots, 8, 220),
        },
        lineage: {
            rootActorId: cleanText(lineage.rootActorId, 120) || id,
            currentForm: cleanText(lineage.currentForm, 160) || name,
            forms: (Array.isArray(lineage.forms) ? lineage.forms : [{
                name,
                turn: integer(value.createdTurn, 0, Number.MAX_SAFE_INTEGER, turn),
                evidence: cleanList(value.evidence, 4, 240),
            }])
                .filter((item) => item && typeof item === 'object')
                .map((item) => ({
                    name: cleanText(item.name, 160),
                    turn: integer(item.turn, 0, Number.MAX_SAFE_INTEGER, turn),
                    evidence: cleanList(item.evidence, 8, 240),
                }))
                .filter((item) => item.name)
                .slice(-12),
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
        target: value.target && typeof value.target === 'object'
            ? {
                chatId: cleanText(value.target.chatId, 180),
                messageId: cleanText(value.target.messageId, 180),
                swipeId: integer(value.target.swipeId, 0, Number.MAX_SAFE_INTEGER, 0),
                generation: integer(value.target.generation, 0, Number.MAX_SAFE_INTEGER, 0),
                branchId: cleanText(value.target.branchId, 180),
                hash: cleanText(value.target.hash, 100),
            }
            : null,
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
        migrations: { continuityV5: false, actorLedgerV2: true, actorLedgerV3: true },
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
            actorLedgerV2: true,
            actorLedgerV3: true,
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
            if (!isActorName(actorName)) continue;
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

function mergeProfileText(current, proposed, limit = 240) {
    const oldValue = cleanText(current, limit);
    return oldValue || cleanText(proposed, limit);
}

const VOLATILE_PROFILE_LABEL_RE = /^(?:冷酷|冰冷|暴躁|粗暴|凶狠|残忍|疯狂|狂热|病态|绝望|恐惧|怯懦|结巴|空洞|麻木|杀意|致命武器|忠诚|服从)$/iu;
const TOTALIZING_PROFILE_RE = /(?:不再是.{0,18}而是(?:一件|一个)|彻底(?:失去|抹去|变成|沦为)|(?:全部人格|整个人).{0,12}(?:只剩|化作|变成))/iu;

function stableProfileText(value, limit = 240) {
    const cleaned = cleanText(value, limit);
    if (!cleaned || VOLATILE_PROFILE_LABEL_RE.test(cleaned) || TOTALIZING_PROFILE_RE.test(cleaned)) {
        return '';
    }
    return cleaned;
}

function stableProfileList(value, limit = 12, itemLimit = 240) {
    return cleanList(value, limit, itemLimit).filter((item) => (
        !VOLATILE_PROFILE_LABEL_RE.test(item)
        && !TOTALIZING_PROFILE_RE.test(item)
    ));
}

function evidenceLookupText(value) {
    return cleanText(value, 240000)
        .toLocaleLowerCase('zh-CN')
        .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function mergeProfileList(current, proposed, limit = 12, itemLimit = 240) {
    return cleanList([...(current || []), ...(Array.isArray(proposed) ? proposed : [])], limit, itemLimit);
}

function actorProfileSnapshot(actor) {
    return JSON.stringify({
        identity: actor.identity,
        longTermGoals: actor.longTermGoals,
        capabilities: actor.capabilities,
        hidden: actor.hidden,
    });
}

export function mergeActorProfilePatches(value, patches, {
    turn = null,
    sourceRef = null,
    maxPatches = 8,
    evidenceCorpus = '',
} = {}) {
    const ledger = normalizeActorLedger(value);
    const currentTurn = integer(turn, 0, Number.MAX_SAFE_INTEGER, ledger.turn);
    const ref = normalizeSourceRef(sourceRef);
    const evidenceHaystack = evidenceLookupText(evidenceCorpus);
    const accepted = [];
    const rejected = [];
    const candidates = (Array.isArray(patches) ? patches : []).slice(
        0,
        integer(maxPatches, 0, 24, 8),
    );
    for (const raw of candidates) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            rejected.push({ actorId: '', reason: 'profile-not-object' });
            continue;
        }
        const requestedId = cleanText(raw.actorId, 120);
        const requestedName = cleanText(raw.name, 160);
        const actorIndex = ledger.actors.findIndex((actor) => (
            (requestedId && actor.id === requestedId)
            || (requestedName && (
                actor.name === requestedName
                || actor.identity.aliases.includes(requestedName)
            ))
        ));
        if (actorIndex < 0) {
            rejected.push({
                actorId: requestedId,
                name: requestedName,
                reason: 'unknown-actor',
            });
            continue;
        }
        const evidence = cleanList(raw.evidence, 8, 300);
        if (!evidence.length) {
            rejected.push({
                actorId: ledger.actors[actorIndex].id,
                name: ledger.actors[actorIndex].name,
                reason: 'evidence-missing',
            });
            continue;
        }
        const groundedEvidence = evidence.filter((item) => {
            const needle = evidenceLookupText(item);
            return needle.length >= 4 && evidenceHaystack.includes(needle);
        });
        if (!groundedEvidence.length) {
            rejected.push({
                actorId: ledger.actors[actorIndex].id,
                name: ledger.actors[actorIndex].name,
                reason: evidenceHaystack ? 'evidence-not-grounded' : 'evidence-corpus-missing',
            });
            continue;
        }
        const actor = clone(ledger.actors[actorIndex]);
        const before = actorProfileSnapshot(actor);
        const identity = raw.identity && typeof raw.identity === 'object'
            && !Array.isArray(raw.identity)
            ? raw.identity
            : {};
        const hidden = raw.hidden && typeof raw.hidden === 'object'
            && !Array.isArray(raw.hidden)
            ? raw.hidden
            : {};
        actor.identity = {
            ...actor.identity,
            role: mergeProfileText(actor.identity.role, identity.role, 180),
            traits: mergeProfileList(actor.identity.traits, stableProfileList(identity.traits, 12, 180), 12, 180),
            desires: mergeProfileList(actor.identity.desires, stableProfileList(identity.desires, 12, 240), 12, 240),
            boundaries: mergeProfileList(actor.identity.boundaries, stableProfileList(identity.boundaries, 12, 240), 12, 240),
            socialStyle: mergeProfileText(actor.identity.socialStyle, stableProfileText(identity.socialStyle)),
            decisionStyle: mergeProfileText(actor.identity.decisionStyle, stableProfileText(identity.decisionStyle)),
            speechStyle: mergeProfileText(actor.identity.speechStyle, stableProfileText(identity.speechStyle)),
            copingStyle: mergeProfileText(actor.identity.copingStyle, stableProfileText(identity.copingStyle)),
            everydayHabits: mergeProfileList(
                actor.identity.everydayHabits,
                stableProfileList(identity.everydayHabits, 8, 180),
                8,
                180,
            ),
            blindSpots: mergeProfileList(actor.identity.blindSpots, stableProfileList(identity.blindSpots, 8, 220), 8, 220),
        };
        actor.longTermGoals = mergeProfileList(actor.longTermGoals, stableProfileList(raw.longTermGoals, 12, 400), 12, 400);
        actor.capabilities = mergeProfileList(actor.capabilities, stableProfileList(raw.capabilities, 24, 160), 24, 160);
        actor.hidden = {
            emotionalInertia: mergeProfileList(
                actor.hidden.emotionalInertia,
                stableProfileList(hidden.emotionalInertia, 12, 240),
                12,
                240,
            ),
            innerConflicts: mergeProfileList(
                actor.hidden.innerConflicts,
                stableProfileList(hidden.innerConflicts, 12, 300),
                12,
                300,
            ),
            privateIntentions: mergeProfileList(
                actor.hidden.privateIntentions,
                stableProfileList(hidden.privateIntentions, 12, 300),
                12,
                300,
            ),
        };
        if (actorProfileSnapshot(actor) === before) {
            rejected.push({
                actorId: actor.id,
                name: actor.name,
                reason: 'no-new-profile-facts',
            });
            continue;
        }
        actor.evidence = mergeEvidence(actor.evidence, [
            ...groundedEvidence,
            ref ? `${ref.messageId}:${ref.swipeId}:${ref.generation}:${ref.hash}` : '',
        ]);
        actor.updatedTurn = currentTurn;
        actor.version += 1;
        ledger.actors[actorIndex] = actor;
        accepted.push({ actorId: actor.id, name: actor.name, evidence: groundedEvidence });
    }
    if (accepted.length) {
        ledger.turn = Math.max(ledger.turn, currentTurn);
        ledger.observationReceipts.push({
            receiptId: `actor-profile:${fingerprint(JSON.stringify([
                ref?.chatId || ledger.chatId,
                ref?.messageId || '',
                ref?.swipeId || 0,
                ref?.generation || 0,
                ref?.branchId || '',
                ref?.hash || '',
                accepted.map((item) => item.actorId),
            ])).slice(0, 18)}`,
            kind: 'profile-enrichment',
            sourceRef: ref,
            actorIds: accepted.map((item) => item.actorId),
            settledAt: Date.now(),
        });
        ledger.observationReceipts = ledger.observationReceipts.slice(-120);
        ledger.updatedAt = Date.now();
    }
    return {
        ledger: normalizeActorLedger(ledger),
        accepted,
        rejected,
    };
}

export function mergeActorIdentityReveal(value, {
    actorId = '',
    revealedName = '',
    aliases = [],
    evidence = [],
    turn = null,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const id = cleanText(actorId, 120);
    const name = cleanText(revealedName, 160);
    if (!id || !isActorName(name)) return ledger;
    const index = ledger.actors.findIndex((actor) => (
        actor.id === id
        || actor.name === id
        || actor.identity.aliases.includes(id)
    ));
    if (index < 0) return ledger;
    const actor = clone(ledger.actors[index]);
    const previousName = actor.name;
    actor.name = name;
    actor.identity.aliases = cleanList([
        ...actor.identity.aliases,
        previousName,
        ...aliases,
    ], 12, 160).filter((item) => item !== name);
    actor.evidence = mergeEvidence(actor.evidence, evidence);
    actor.updatedTurn = integer(turn, 0, Number.MAX_SAFE_INTEGER, ledger.turn);
    actor.version += 1;
    ledger.actors[index] = actor;
    ledger.updatedAt = Date.now();
    return ledger;
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

function actorNames(actor) {
    return [actor.name, ...actor.identity.aliases]
        .map((item) => cleanText(item, 160))
        .filter((item) => item.length >= 2);
}

function directlyObservedBy(statement, actor) {
    if (!DIRECT_OBSERVATION.test(statement) || OBSERVATION_NEGATION.test(statement)) return false;
    return actorNames(actor).some((name) => {
        const index = statement.indexOf(name);
        if (index < 0) return false;
        const local = statement.slice(index, index + name.length + 28);
        return DIRECT_OBSERVATION.test(local) && !OBSERVATION_NEGATION.test(local);
    });
}

function escapePattern(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function reconcileActorIdentityRevealsFromAcceptedContent(value, {
    content = '',
    sourceRef = null,
} = {}) {
    let ledger = normalizeActorLedger(value);
    const ref = normalizeSourceRef(sourceRef);
    if (!ref) return ledger;
    const body = String(content ?? '')
        .replace(/^[\s\S]*?<content\b[^>]*>/iu, '')
        .replace(/<\/content>[\s\S]*$/iu, '');
    for (const current of [...ledger.actors]) {
        const names = actorNames(current);
        let revealedName = '';
        for (const alias of names) {
            const pattern = new RegExp(
                `${escapePattern(alias)}[^。！？.!?]{0,48}`
                + '(?:真实身份(?:是|为)|原来(?:就是|是)|自称(?:为)?)'
                + '\\s*([\\p{L}\\p{N}·・_-]{2,40})',
                'u',
            );
            const match = body.match(pattern);
            if (match) {
                revealedName = cleanText(match[1], 160)
                    .replace(/(?:本人|自己)$/u, '');
                break;
            }
        }
        if (!isActorName(revealedName) || revealedName === current.name) continue;
        const duplicate = ledger.actors.find((actor) => (
            actor.id !== current.id
            && (
                actor.name === revealedName
                || actor.identity.aliases.includes(revealedName)
            )
        ));
        ledger = mergeActorIdentityReveal(ledger, {
            actorId: current.id,
            revealedName,
            aliases: names,
            evidence: [`${ref.messageId}:${ref.swipeId}:${ref.generation}:${ref.hash}`],
            turn: ledger.turn,
        });
        if (!duplicate) continue;
        const stable = ledger.actors.find((actor) => actor.id === current.id);
        stable.knowledge = [
            ...stable.knowledge,
            ...duplicate.knowledge.filter((item) => (
                !stable.knowledge.some((known) => known.id === item.id)
            )),
        ].slice(-48);
        stable.evidence = mergeEvidence(stable.evidence, duplicate.evidence);
        stable.identity.aliases = cleanList([
            ...stable.identity.aliases,
            duplicate.name,
            ...duplicate.identity.aliases,
        ], 12, 160).filter((item) => item !== stable.name);
        stable.resources = stable.resources.length ? stable.resources : clone(duplicate.resources);
        stable.capabilities = mergeEvidence(stable.capabilities, duplicate.capabilities, 24);
        stable.version += 1;
        ledger.actors = ledger.actors.filter((actor) => actor.id !== duplicate.id);
    }
    ledger.updatedAt = Date.now();
    return normalizeActorLedger(ledger, { chatId: ledger.chatId });
}

export function reconcileActorMutationLineageFromAcceptedContent(value, {
    content = '',
    sourceRef = null,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const ref = normalizeSourceRef(sourceRef);
    if (!ref) return ledger;
    const body = String(content ?? '')
        .replace(/^[\s\S]*?<content\b[^>]*>/iu, '')
        .replace(/<\/content>[\s\S]*$/iu, '');
    for (const actor of [...ledger.actors]) {
        let form = '';
        for (const name of actorNames(actor)) {
            const pattern = new RegExp(
                `${escapePattern(name)}[^。！？.!?]{0,36}`
                + '(?:异变为|变异成|转化为|进化为|蜕变为)'
                + '\\s*([\\p{L}\\p{N}·・_-]{2,60})',
                'u',
            );
            const match = body.match(pattern);
            if (match) {
                form = cleanText(match[1], 160);
                break;
            }
        }
        if (!isActorName(form)) continue;
        const stable = ledger.actors.find((item) => item.id === actor.id);
        const evidence = `${ref.messageId}:${ref.swipeId}:${ref.generation}:${ref.hash}`;
        if (!stable.lineage.forms.some((item) => item.name === form)) {
            stable.lineage.forms.push({
                name: form,
                turn: ledger.turn,
                evidence: [evidence],
            });
        }
        stable.lineage.forms = stable.lineage.forms.slice(-12);
        stable.lineage.currentForm = form;
        stable.identity.aliases = cleanList([
            ...stable.identity.aliases,
            form,
        ], 12, 160).filter((item) => item !== stable.name);
        stable.evidence = mergeEvidence(stable.evidence, [evidence]);
        stable.version += 1;
        const duplicate = ledger.actors.find((item) => (
            item.id !== stable.id
            && (item.name === form || item.identity.aliases.includes(form))
        ));
        if (duplicate) {
            stable.knowledge = [
                ...stable.knowledge,
                ...duplicate.knowledge.filter((item) => (
                    !stable.knowledge.some((known) => known.id === item.id)
                )),
            ].slice(-48);
            stable.resources = stable.resources.length
                ? stable.resources
                : clone(duplicate.resources);
            stable.capabilities = mergeEvidence(stable.capabilities, duplicate.capabilities, 24);
            ledger.actors = ledger.actors.filter((item) => item.id !== duplicate.id);
        }
    }
    ledger.updatedAt = Date.now();
    return normalizeActorLedger(ledger, { chatId: ledger.chatId });
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
    const receiptId = `actor-observation:${fingerprint(JSON.stringify([
        ref.chatId,
        ref.messageId,
        ref.swipeId,
        ref.generation,
        ref.branchId,
        ref.hash,
    ])).slice(0, 18)}`;
    if (ledger.observationReceipts.some((receipt) => receipt.receiptId === receiptId)) {
        return ledger;
    }
    const learnedIds = [];
    ledger.actors = ledger.actors.map((actor) => {
        if (!observers.has(actor.id)) return actor;
        const next = clone(actor);
        for (const claim of statements.filter((item) => directlyObservedBy(item, actor))) {
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
    if (!learnedIds.length) return ledger;
    ledger.observationReceipts.push({
        receiptId,
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
    const statements = observableStatements(content);
    return ledger.actors
        .filter((actor) => ['active', 'dormant'].includes(actor.status))
        .filter((actor) => statements.some((statement) => directlyObservedBy(statement, actor)))
        .map((actor) => actor.id);
}

export function reconcileActorLifecycleFromAcceptedContent(value, {
    content = '',
    sourceRef = null,
} = {}) {
    const ledger = normalizeActorLedger(value);
    const ref = normalizeSourceRef(sourceRef);
    if (!ref) return ledger;
    const statements = observableStatements(content);
    const transitions = [];
    ledger.actors = ledger.actors.map((current) => {
        const actor = clone(current);
        const relevant = statements.filter((statement) => (
            actorNames(actor).some((name) => statement.includes(name))
        ));
        if (!relevant.length) return actor;
        let nextStatus = actor.status;
        if (relevant.some((statement) => /(?:已经|确认|当场|彻底)?(?:死亡|身亡|毙命|被杀死|咽气|尸体)/u.test(statement))) {
            nextStatus = 'deceased';
        } else if (
            actor.status !== 'deceased'
            && relevant.some((statement) => /(?:已经)?(?:离开|离场|撤离|远走|失踪|退出)(?:了|当前|此地|港区|现场)?/u.test(statement))
        ) {
            nextStatus = 'departed';
        } else if (
            actor.status !== 'deceased'
            && relevant.some((statement) => /(?:昏迷|沉睡|休眠|失去意识|无法行动)/u.test(statement))
        ) {
            nextStatus = 'dormant';
        } else if (
            actor.status !== 'deceased'
            && relevant.some((statement) => /(?:苏醒|醒来|回归|返回|重新回到|恢复行动)/u.test(statement))
        ) {
            nextStatus = 'active';
        }
        if (nextStatus === actor.status) return actor;
        transitions.push({
            actorId: actor.id,
            from: actor.status,
            to: nextStatus,
        });
        actor.status = nextStatus;
        actor.inactiveReason = nextStatus === 'dormant'
            ? 'sleep'
            : nextStatus === 'departed'
                ? 'absence'
                : '';
        actor.updatedTurn = ledger.turn;
        actor.version += 1;
        actor.evidence = mergeEvidence(actor.evidence, [
            `${ref.messageId}:${ref.swipeId}:${ref.generation}:${ref.hash}`,
        ]);
        return actor;
    });
    if (!transitions.length) return ledger;
    ledger.observationReceipts.push({
        receiptId: `actor-lifecycle:${fingerprint(JSON.stringify([
            ref.chatId,
            ref.messageId,
            ref.swipeId,
            ref.generation,
            ref.branchId,
            ref.hash,
        ])).slice(0, 18)}`,
        sourceRef: ref,
        transitions,
        settledAt: Date.now(),
    });
    ledger.observationReceipts = ledger.observationReceipts.slice(-120);
    ledger.updatedAt = Date.now();
    return ledger;
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
    if (actor.status === 'dormant' && actor.inactiveReason === 'sleep') score = -Infinity;
    if (!['active', 'dormant'].includes(actor.status)) score = -Infinity;
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
                travelTurns: integer(proposal?.travelTurns, 0, 10_000, 0),
            },
            action,
            knowledgeRefs,
            resourceCosts: (Array.isArray(proposal?.resourceCosts)
                ? proposal.resourceCosts
                : []).map((item) => ({
                resourceId: cleanText(item?.resourceId, 100),
                amount: number(item?.amount, 0, 1_000_000_000, 0),
            })),
            capabilityUsed: cleanText(proposal?.capabilityUsed, 160),
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
            waitCondition: wait
                ? cleanText(proposal?.waitCondition, 500) || action
                : '',
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
    if (
        !['active', 'dormant'].includes(actor.status)
        || (actor.status === 'dormant' && actor.inactiveReason === 'sleep')
    ) {
        reasons.push('actor-not-actionable');
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
        const target = receipt.target && typeof receipt.target === 'object'
            ? receipt.target
            : null;
        if (target && (
            (target.chatId && target.chatId !== ref.chatId)
            || (target.messageId && target.messageId !== ref.messageId)
            || (target.swipeId && target.swipeId !== ref.swipeId)
            || (target.generation && target.generation !== ref.generation)
            || (target.branchId && target.branchId !== ref.branchId)
            || (target.hash && target.hash !== ref.hash)
        )) return receipt;
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
