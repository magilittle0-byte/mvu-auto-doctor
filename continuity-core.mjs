const STAGES = new Set([
    'seeded',
    'advancing',
    'manifested',
    'resolved',
    'dormant',
]);

const KINDS = new Set([
    'parallel',
    'personal',
    'promise',
    'enemy',
    'mystery',
]);

const EVENT_TYPES = new Set(['conflict', 'progress']);
const EVENT_RESULTS = new Set(['success', 'hold', 'setback']);
const EVENT_OUTCOMES = new Set(['', 'succeeded', 'failed', 'dissipated']);
const KNOWLEDGE = new Set(['hidden', 'rumor', 'observed']);
const KNOWLEDGE_RANK = Object.freeze({ hidden: 0, rumor: 1, observed: 2 });

const ORIGINS = new Set([
    'main_derivative',
    'setting_linked',
    'setting_independent',
    'ambient',
]);

const RELATIONS = new Set([
    'linked',
    'latent',
    'independent',
    'converging',
]);

const CONVERGENCE_CHANNELS = new Set([
    'actor',
    'faction',
    'location',
    'resource',
    'time',
    'causal',
    'public_signal',
]);

const TICK_ACTIONS = new Set([
    'created',
    'advanced',
    'manifested',
    'resolved',
    'dormant',
    'held',
]);

const FACTION_RELATIONS = new Set([
    'bonded',
    'allied',
    'friendly',
    'neutral',
    'distant',
    'hostile',
    'irreconcilable',
]);

const FACTION_CONDITIONS = new Set([
    'dominant',
    'stable',
    'divided',
    'strained',
    'declining',
    'collapsed',
]);

const WIND_TYPES = new Set(['notice', 'report', 'rumor', 'sentiment']);
const TREND_STATES = new Set(['active', 'resolved']);
const INCIDENT_STATES = new Set(['active', 'cooldown', 'resolved']);
const ENEMY_STATES = new Set(['watching', 'preparing', 'acting', 'dormant', 'resolved']);
const SECRET_STATES = new Set(['hidden', 'leaking', 'exposed', 'resolved']);
const ECONOMY_STATES = ['boom', 'stable', 'strained', 'recession', 'crisis'];
const REPUTATION_KEYS = ['authority', 'public', 'underworld', 'professional'];
const SCENARIO_STATUSES = new Set([
    'inactive',
    'active',
    'closing',
    'completed',
    'failed',
]);
const SCENARIO_PHASES = new Set([
    'setup',
    'exploration',
    'escalation',
    'climax',
    'aftermath',
    'closing',
    'completed',
    'failed',
]);
const SCENARIO_CLOSURES = new Set(['open', 'ready', 'blocked', 'completed', 'failed']);
const SCENARIO_CAUSE_TYPES = new Set([
    'player_action',
    'world_chain',
    'setting_fact',
    'system_rule',
]);
const SCENARIO_IMPACTS = new Set(['minor', 'material', 'structural']);
const SCENARIO_FIELDS = new Set([
    'goal',
    'completion',
    'failure',
    'activeApex',
    'route',
    'timeLimit',
    'stakes',
    'phase',
    'closure',
    'closureReason',
]);
const SCENARIO_TEXT_FIELDS = [
    'goal',
    'completion',
    'failure',
    'activeApex',
    'route',
    'timeLimit',
    'stakes',
];

export const SCENARIO_STATUS_LABELS = Object.freeze({
    inactive: '未建立',
    active: '进行中',
    closing: '可收束',
    completed: '已完成',
    failed: '已失败',
});

export const SCENARIO_PHASE_LABELS = Object.freeze({
    setup: '建立',
    exploration: '探索',
    escalation: '发展',
    climax: '终局',
    aftermath: '余波',
    closing: '收束',
    completed: '完成',
    failed: '失败',
});

export const SCENARIO_CAUSE_LABELS = Object.freeze({
    player_action: '玩家行动',
    world_chain: '世界因果链',
    setting_fact: '既有设定事实',
    system_rule: '系统规则',
});

export const CONTINUITY_STAGE_LABELS = Object.freeze({
    seeded: '已埋设',
    advancing: '推进中',
    manifested: '已显现',
    resolved: '已回收',
    dormant: '搁置',
});

export const CONTINUITY_KIND_LABELS = Object.freeze({
    parallel: '平行事件',
    personal: '人物线',
    promise: '约定/承诺',
    enemy: '敌方行动',
    mystery: '谜团线索',
});

export const CONTINUITY_KNOWLEDGE_LABELS = Object.freeze({
    hidden: '幕后隐藏（角色未知）',
    rumor: '传闻阶段（部分可知）',
    observed: '正文已观察',
});

export const CONTINUITY_ORIGIN_LABELS = Object.freeze({
    main_derivative: '主线衍生',
    setting_linked: '世界设定·暗中相关',
    setting_independent: '世界设定·当前独立',
    ambient: '世界脉动',
});

export const CONTINUITY_RELATION_LABELS = Object.freeze({
    linked: '已接入主线',
    latent: '潜在关联',
    independent: '保持独立',
    converging: '正在汇流',
});

export const CONTINUITY_TICK_LABELS = Object.freeze({
    created: '新事件成立',
    advanced: '事件推进',
    manifested: '影响显现',
    resolved: '事件结束',
    dormant: '事件休眠',
    held: '本轮合理保持',
});

const CONTINUITY_URGENCY_LABELS = Object.freeze([
    '暂缓',
    '低',
    '中',
    '高',
]);

const STAGE_SORT_ORDER = Object.freeze({
    manifested: 0,
    advancing: 1,
    seeded: 2,
    dormant: 3,
    resolved: 4,
});

const EVENT_PHASE_LABELS = Object.freeze({
    conflict: {
        seeded: '萌芽',
        advancing: '发酵',
        manifested: '逼近',
        resolved: '终局',
        dormant: '休眠',
    },
    progress: {
        seeded: '筹备',
        advancing: '执行',
        manifested: '关键',
        resolved: '终局',
        dormant: '休眠',
    },
});

const EVENT_PHASE_BASE = Object.freeze({
    conflict: { seeded: 95, advancing: 85, manifested: 75 },
    progress: { seeded: 75, advancing: 85, manifested: 95 },
});

export const WORLD_FACTION_RELATION_LABELS = Object.freeze({
    bonded: '牢固同盟',
    allied: '合作',
    friendly: '友好',
    neutral: '中立',
    distant: '冷淡',
    hostile: '敌对',
    irreconcilable: '不可调和',
});

export const WORLD_FACTION_CONDITION_LABELS = Object.freeze({
    dominant: '鼎盛',
    stable: '稳固',
    divided: '倾轧',
    strained: '困顿',
    declining: '衰落',
    collapsed: '瓦解',
});

export const WORLD_WIND_TYPE_LABELS = Object.freeze({
    notice: '公告',
    report: '消息',
    rumor: '流言',
    sentiment: '舆论',
});

export const WORLD_ECONOMY_LABELS = Object.freeze({
    boom: '繁荣',
    stable: '平稳',
    strained: '趋紧',
    recession: '萧条',
    crisis: '危机',
});

export const WORLD_REPUTATION_LABELS = Object.freeze({
    authority: '官方',
    public: '民间',
    underworld: '暗域',
    professional: '业界',
});

function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function cleanText(value, limit = 500) {
    return String(value || '')
        .replace(/\s+/gu, ' ')
        .trim()
        .slice(0, limit);
}

function cleanList(value, limit = 8) {
    const source = Array.isArray(value) ? value : [];
    return [...new Set(source.map((item) => cleanText(item, 80)).filter(Boolean))]
        .slice(0, limit);
}

function boundedInteger(value, minimum, maximum, fallback) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, number));
}

function cleanId(value, fallback) {
    return cleanText(value || fallback, 90)
        .replace(/[^\p{L}\p{N}_.:\-]/gu, '-');
}

function normalizeScenarioField(field, value) {
    if (field === 'phase') {
        return SCENARIO_PHASES.has(value) ? value : 'setup';
    }
    if (field === 'closure') {
        return SCENARIO_CLOSURES.has(value) ? value : 'open';
    }
    return cleanText(value, field === 'closureReason' ? 700 : 500);
}

function normalizeScenarioSnapshot(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        ...Object.fromEntries(
            SCENARIO_TEXT_FIELDS.map((field) => [
                field,
                normalizeScenarioField(field, source[field]),
            ]),
        ),
        phase: normalizeScenarioField('phase', source.phase),
        closure: normalizeScenarioField('closure', source.closure),
        closureReason: normalizeScenarioField('closureReason', source.closureReason),
    };
}

function normalizeScenarioChange(value) {
    if (!value || typeof value !== 'object' || !SCENARIO_FIELDS.has(value.field)) {
        return null;
    }
    const field = value.field;
    if (
        (field === 'phase' && (
            !SCENARIO_PHASES.has(value.before)
            || !SCENARIO_PHASES.has(value.after)
        ))
        || (field === 'closure' && (
            !SCENARIO_CLOSURES.has(value.before)
            || !SCENARIO_CLOSURES.has(value.after)
        ))
    ) {
        return null;
    }
    return {
        field,
        before: normalizeScenarioField(field, value.before),
        after: normalizeScenarioField(field, value.after),
    };
}

function normalizeScenarioAmendment(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const id = cleanId(value.id, '');
    if (!id) return null;
    const changes = [];
    const changedFields = new Set();
    let invalidChanges = 0;
    for (const raw of Array.isArray(value.changes) ? value.changes : []) {
        const change = normalizeScenarioChange(raw);
        if (!change || changedFields.has(change.field)) {
            invalidChanges += 1;
            continue;
        }
        changedFields.add(change.field);
        changes.push(change);
        if (changes.length >= 10) break;
    }
    return {
        id,
        revision: boundedInteger(value.revision, 1, 999, index + 1),
        turn: boundedInteger(value.turn, 0, Number.MAX_SAFE_INTEGER, turn),
        causeType: SCENARIO_CAUSE_TYPES.has(value.causeType) ? value.causeType : '',
        impact: SCENARIO_IMPACTS.has(value.impact) ? value.impact : '',
        sourceThreadIds: cleanList(value.sourceThreadIds, 8),
        trigger: cleanText(value.trigger, 500),
        mechanism: cleanText(value.mechanism, 700),
        evidence: cleanList(value.evidence, 8),
        changes,
        ...(invalidChanges ? { invalidChanges } : {}),
        preserves: cleanList(value.preserves, 10),
        visibility: KNOWLEDGE.has(value.visibility) ? value.visibility : '',
        reversible: value.reversible !== false,
        sourceRef: normalizeSourceRef(value.sourceRef),
    };
}

export function emptyScenarioPlan() {
    return {
        status: 'inactive',
        instanceId: '',
        title: '',
        revision: 0,
        baselineEvidence: [],
        baselineSourceRef: null,
        baseline: normalizeScenarioSnapshot({}),
        current: normalizeScenarioSnapshot({}),
        amendments: [],
        createdTurn: 0,
        updatedTurn: 0,
    };
}

export function normalizeScenarioPlan(value, { turn = 0 } = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const amendments = [];
    const used = new Set();
    for (const raw of Array.isArray(source.amendments) ? source.amendments : []) {
        const amendment = normalizeScenarioAmendment(raw, amendments.length, turn);
        if (!amendment || used.has(amendment.id)) continue;
        used.add(amendment.id);
        amendments.push(amendment);
        if (amendments.length >= 24) break;
    }
    const baseline = normalizeScenarioSnapshot(source.baseline);
    const current = normalizeScenarioSnapshot(source.current || source.baseline);
    const status = SCENARIO_STATUSES.has(source.status) ? source.status : 'inactive';
    return {
        status,
        instanceId: cleanId(source.instanceId, ''),
        title: cleanText(source.title, 160),
        revision: boundedInteger(
            source.revision,
            0,
            999,
            amendments.length,
        ),
        baselineEvidence: cleanList(source.baselineEvidence, 10),
        baselineSourceRef: normalizeSourceRef(source.baselineSourceRef),
        ...(
            source.baseline
            && (
                (source.baseline.phase != null && !SCENARIO_PHASES.has(source.baseline.phase))
                || (
                    source.baseline.closure != null
                    && !SCENARIO_CLOSURES.has(source.baseline.closure)
                )
            )
                ? { invalidBaseline: true }
                : {}
        ),
        baseline,
        current,
        amendments,
        createdTurn: boundedInteger(source.createdTurn, 0, Number.MAX_SAFE_INTEGER, turn),
        updatedTurn: boundedInteger(source.updatedTurn, 0, Number.MAX_SAFE_INTEGER, turn),
    };
}

function normalizeWorldItemBase(value, fallbackId, turn) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        id: cleanId(source.id, fallbackId),
        knowledge: KNOWLEDGE.has(source.knowledge) ? source.knowledge : 'hidden',
        basis: cleanText(source.basis, 420),
        lastChange: cleanText(source.lastChange, 500),
        sourceThreads: cleanList(source.sourceThreads, 8),
        updatedTurn: boundedInteger(
            source.updatedTurn,
            0,
            Number.MAX_SAFE_INTEGER,
            turn,
        ),
    };
}

function normalizeFaction(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `FAC-${index + 1}`, turn);
    const name = cleanText(value.name || value.title || base.id, 120);
    if (!base.id || !name) return null;
    return {
        ...base,
        name,
        relation: FACTION_RELATIONS.has(value.relation) ? value.relation : 'neutral',
        condition: FACTION_CONDITIONS.has(value.condition) ? value.condition : 'stable',
        goal: cleanText(value.goal, 500),
        summary: cleanText(value.summary, 700),
        pillars: cleanList(value.pillars, 3),
        scope: cleanText(value.scope, 180),
    };
}

function normalizeTrend(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `TREND-${index + 1}`, turn);
    const name = cleanText(value.name || value.title || base.id, 120);
    if (!base.id || !name) return null;
    return {
        ...base,
        name,
        status: TREND_STATES.has(value.status) ? value.status : 'active',
        summary: cleanText(value.summary || value.description, 700),
        scope: cleanText(value.scope, 180),
        source: cleanText(value.source, 300),
    };
}

function normalizeWind(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `WIND-${index + 1}`, turn);
    const topic = cleanText(value.topic || value.title || value.content || base.id, 120);
    const content = cleanText(value.content || value.summary, 700);
    if (!base.id || (!topic && !content)) return null;
    return {
        ...base,
        topic,
        type: WIND_TYPES.has(value.type) ? value.type : 'report',
        strength: boundedInteger(value.strength, 1, 4, 1),
        content,
        source: cleanText(value.source, 180),
        scope: cleanText(value.scope, 180),
        quietTurns: boundedInteger(value.quietTurns, 0, 99, 0),
        expiresTurn: boundedInteger(value.expiresTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    };
}

function normalizeReputationDimension(value, turn) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        level: boundedInteger(source.level, -2, 2, 0),
        summary: cleanText(source.summary, 500),
        basis: cleanText(source.basis, 420),
        updatedTurn: boundedInteger(
            source.updatedTurn,
            0,
            Number.MAX_SAFE_INTEGER,
            turn,
        ),
    };
}

function normalizeIncident(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `INC-${index + 1}`, turn);
    const title = cleanText(value.title || value.summary || base.id, 120);
    if (!base.id || !title) return null;
    return {
        ...base,
        title,
        status: INCIDENT_STATES.has(value.status) ? value.status : 'active',
        summary: cleanText(value.summary, 700),
        scope: cleanText(value.scope, 180),
        remainingTurns: boundedInteger(value.remainingTurns, 0, 99, 0),
    };
}

function normalizeEnemy(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `ENEMY-${index + 1}`, turn);
    const name = cleanText(value.name || value.title || base.id, 120);
    if (!base.id || !name) return null;
    return {
        ...base,
        name,
        status: ENEMY_STATES.has(value.status) ? value.status : 'watching',
        summary: cleanText(value.summary, 700),
        motive: cleanText(value.motive, 420),
    };
}

function normalizeSecret(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `SECRET-${index + 1}`, turn);
    const title = cleanText(value.title || value.summary || base.id, 120);
    if (!base.id || !title) return null;
    return {
        ...base,
        title,
        status: SECRET_STATES.has(value.status) ? value.status : 'hidden',
        summary: cleanText(value.summary, 700),
        exposure: boundedInteger(value.exposure, 0, 4, 0),
        holders: cleanList(value.holders, 8),
    };
}

function normalizeInfluence(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const base = normalizeWorldItemBase(value, `CAUSE-${index + 1}`, turn);
    const trigger = cleanText(value.trigger || value.title || base.id, 180);
    const impact = cleanText(value.impact, 500);
    if (!base.id || !trigger || !impact) return null;
    return {
        ...base,
        trigger,
        impact,
        fallout: cleanText(value.fallout, 500),
        expiresTurn: boundedInteger(
            value.expiresTurn,
            turn,
            Number.MAX_SAFE_INTEGER,
            turn + 8,
        ),
    };
}

function normalizeUniqueItems(value, normalizer, turn, limit) {
    const result = [];
    const used = new Set();
    for (const item of Array.isArray(value) ? value : []) {
        const normalized = normalizer(item, result.length, turn);
        if (!normalized?.id || used.has(normalized.id)) continue;
        used.add(normalized.id);
        result.push(normalized);
        if (result.length >= limit) break;
    }
    return result;
}

export function emptyWorldState() {
    return {
        digest: '',
        trends: [],
        factions: [],
        winds: [],
        reputation: Object.fromEntries(
            REPUTATION_KEYS.map((key) => [
                key,
                { level: 0, summary: '', basis: '', updatedTurn: 0 },
            ]),
        ),
        environment: {
            economy: 'stable',
            summary: '',
            basis: '',
            updatedTurn: 0,
            incidents: [],
        },
        shadows: {
            enemies: [],
            secrets: [],
        },
        influences: [],
    };
}

export function normalizeWorldState(value, { turn = 0 } = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const environment = source.environment && typeof source.environment === 'object'
        ? source.environment
        : {};
    const shadows = source.shadows && typeof source.shadows === 'object'
        ? source.shadows
        : {};
    const reputation = source.reputation && typeof source.reputation === 'object'
        ? source.reputation
        : {};
    return {
        digest: cleanText(source.digest, 700),
        trends: normalizeUniqueItems(source.trends, normalizeTrend, turn, 6),
        factions: normalizeUniqueItems(source.factions, normalizeFaction, turn, 16),
        winds: normalizeUniqueItems(source.winds, normalizeWind, turn, 20),
        reputation: Object.fromEntries(
            REPUTATION_KEYS.map((key) => [
                key,
                normalizeReputationDimension(reputation[key], turn),
            ]),
        ),
        environment: {
            economy: ECONOMY_STATES.includes(environment.economy)
                ? environment.economy
                : 'stable',
            summary: cleanText(environment.summary, 700),
            basis: cleanText(environment.basis, 420),
            updatedTurn: boundedInteger(
                environment.updatedTurn,
                0,
                Number.MAX_SAFE_INTEGER,
                turn,
            ),
            incidents: normalizeUniqueItems(
                environment.incidents,
                normalizeIncident,
                turn,
                12,
            ),
        },
        shadows: {
            enemies: normalizeUniqueItems(shadows.enemies, normalizeEnemy, turn, 12),
            secrets: normalizeUniqueItems(shadows.secrets, normalizeSecret, turn, 16),
        },
        influences: normalizeUniqueItems(source.influences, normalizeInfluence, turn, 16)
            .filter((item) => item.expiresTurn >= turn),
    };
}

export function emptyContinuityState(chatId = '') {
    return {
        version: 5,
        chatId: cleanText(chatId, 180),
        turn: 0,
        lastTick: {
            turn: 0,
            action: '',
            threadId: '',
            reason: '',
        },
        lastSource: null,
        threads: [],
        world: emptyWorldState(),
        scenarioPlan: emptyScenarioPlan(),
        updatedAt: 0,
    };
}

export function normalizeSourceRef(value) {
    if (!value || typeof value !== 'object') return null;
    const chatId = cleanText(value.chatId, 180);
    const messageId = cleanText(value.messageId, 180);
    const hash = cleanText(value.hash, 80);
    if (!chatId || !messageId || !hash) return null;
    return {
        chatId,
        messageId,
        index: boundedInteger(value.index, 0, Number.MAX_SAFE_INTEGER, 0),
        swipeId: boundedInteger(value.swipeId, 0, Number.MAX_SAFE_INTEGER, 0),
        hash,
    };
}

function normalizeThread(value, index, turn) {
    if (!value || typeof value !== 'object') return null;
    const fallbackId = `PT-${String(index + 1).padStart(2, '0')}`;
    const id = cleanText(value.id || fallbackId, 90)
        .replace(/[^\p{L}\p{N}_.:\-]/gu, '-');
    const title = cleanText(value.title || value.summary || id, 120);
    const summary = cleanText(value.summary, 700);
    if (!id || (!title && !summary)) return null;
    const stage = STAGES.has(value.stage) ? value.stage : 'seeded';
    const kind = KINDS.has(value.kind) ? value.kind : 'parallel';
    const knowledge = KNOWLEDGE.has(value.knowledge)
        ? value.knowledge
        : (stage === 'manifested' || stage === 'resolved' ? 'observed' : 'hidden');
    const origin = ORIGINS.has(value.origin) ? value.origin : 'main_derivative';
    const relation = RELATIONS.has(value.relation)
        ? value.relation
        : (origin === 'main_derivative' ? 'linked'
            : origin === 'setting_linked' ? 'latent' : 'independent');
    const refs = (Array.isArray(value.sourceRefs) ? value.sourceRefs : [])
        .map(normalizeSourceRef)
        .filter(Boolean)
        .slice(-8);
    const convergenceSource = value.convergence && typeof value.convergence === 'object'
        ? value.convergence
        : {};
    const convergenceChannels = cleanList(convergenceSource.channels, 7)
        .filter((channel) => CONVERGENCE_CHANNELS.has(channel));
    return {
        id,
        title,
        kind,
        eventType: EVENT_TYPES.has(value.eventType) ? value.eventType : (
            ['promise', 'personal'].includes(kind) ? 'progress' : 'conflict'
        ),
        level: boundedInteger(value.level, 1, 4, 1),
        origin,
        relation,
        stage,
        summary,
        offscreenBeat: cleanText(value.offscreenBeat, 500),
        nextBeat: cleanText(value.nextBeat, 500),
        trigger: cleanText(value.trigger, 350),
        intersection: cleanText(value.intersection, 450),
        seedBasis: cleanText(value.seedBasis, 400),
        causedBy: cleanList(value.causedBy, 6),
        effects: cleanList(value.effects, 12),
        rumors: cleanList(value.rumors, 8),
        resolution: cleanText(value.resolution, 700),
        actors: cleanList(value.actors),
        locations: cleanList(value.locations),
        propagation: cleanList(value.propagation, 12),
        convergence: {
            score: boundedInteger(convergenceSource.score, 0, 4, 0),
            channels: convergenceChannels,
            evidence: cleanList(convergenceSource.evidence, 8),
            entryBeat: cleanText(convergenceSource.entryBeat, 500),
            lastCheckedTurn: boundedInteger(
                convergenceSource.lastCheckedTurn,
                0,
                Number.MAX_SAFE_INTEGER,
                0,
            ),
        },
        knowledge,
        urgency: boundedInteger(value.urgency, 0, 3, 1),
        stageProgress: stage === 'resolved'
            ? 9
            : boundedInteger(value.stageProgress, 1, 8, 1),
        evolveResult: EVENT_RESULTS.has(value.evolveResult) ? value.evolveResult : '',
        consecutiveFails: boundedInteger(value.consecutiveFails, 0, 99, 0),
        stalled: value.stalled === true,
        outcome: EVENT_OUTCOMES.has(value.outcome) ? value.outcome : '',
        createdTurn: boundedInteger(
            value.createdTurn,
            0,
            Number.MAX_SAFE_INTEGER,
            turn,
        ),
        lastAdvancedTurn: boundedInteger(
            value.lastAdvancedTurn,
            0,
            Number.MAX_SAFE_INTEGER,
            turn,
        ),
        resolvedTurn: stage === 'resolved'
            ? boundedInteger(
                value.resolvedTurn,
                0,
                Number.MAX_SAFE_INTEGER,
                value.lastAdvancedTurn ?? turn,
            )
            : 0,
        sourceRefs: refs,
    };
}

function normalizeTick(value, turn) {
    const source = value && typeof value === 'object' ? value : {};
    const action = TICK_ACTIONS.has(source.action) ? source.action : '';
    return {
        turn: boundedInteger(source.turn, 0, Number.MAX_SAFE_INTEGER, action ? turn : 0),
        action,
        threadId: cleanText(source.threadId, 90),
        reason: cleanText(source.reason, 500),
    };
}

export function normalizeContinuityState(value, {
    chatId = '',
    maxThreads = 6,
    maxResolved = 12,
} = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const turn = boundedInteger(source.turn, 0, Number.MAX_SAFE_INTEGER, 0);
    const allThreads = [];
    const used = new Set();
    for (const item of Array.isArray(source.threads) ? source.threads : []) {
        const thread = normalizeThread(item, allThreads.length, turn);
        if (!thread || used.has(thread.id)) continue;
        used.add(thread.id);
        allThreads.push(thread);
        if (allThreads.length >= 64) break;
    }
    const activeLimit = boundedInteger(maxThreads, 1, 24, 6);
    const resolvedLimit = boundedInteger(maxResolved, 0, 24, 12);
    const runnable = allThreads.filter((thread) => (
        thread.stage !== 'resolved' && thread.stage !== 'dormant'
    ));
    const active = runnable.slice(0, activeLimit);
    const overflow = runnable.slice(activeLimit).map((thread) => ({
        ...thread,
        stage: 'dormant',
    }));
    const dormant = [
        ...allThreads.filter((thread) => thread.stage === 'dormant'),
        ...overflow,
    ];
    const resolved = allThreads
        .filter((thread) => thread.stage === 'resolved')
        .sort((left, right) => (
            right.resolvedTurn - left.resolvedTurn
            || right.lastAdvancedTurn - left.lastAdvancedTurn
        ))
        .slice(0, resolvedLimit);
    return {
        version: 5,
        chatId: cleanText(chatId || source.chatId, 180),
        turn,
        lastTick: normalizeTick(source.lastTick, turn),
        lastSource: normalizeSourceRef(source.lastSource),
        threads: [...active, ...dormant, ...resolved],
        world: normalizeWorldState(source.world, { turn }),
        scenarioPlan: normalizeScenarioPlan(source.scenarioPlan, { turn }),
        droppedCount: overflow.length,
        deferredCount: dormant.length,
        updatedAt: boundedInteger(source.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    };
}

function advanceThreadClock(thread, random) {
    const next = clone(thread);
    if (['resolved', 'dormant'].includes(next.stage)) {
        next.evolveResult = '';
        return next;
    }
    const level = boundedInteger(next.level, 1, 4, 1);
    const maximumFails = next.eventType === 'progress'
        ? 2 + level
        : Math.max(1, 6 - level);
    let successful = next.consecutiveFails >= maximumFails;
    let result = 'success';
    if (!successful) {
        const ratio = Math.min(1, next.stageProgress / 9);
        const stageBase = EVENT_PHASE_BASE[next.eventType]?.[next.stage] || 85;
        const levelAdjust = next.eventType === 'progress'
            ? (level - 1) * 10
            : -((level - 1) * 10);
        const threshold = Math.round(
            stageBase - 200 * ratio * (1 - ratio) + levelAdjust,
        );
        const dice = Math.floor(Math.max(0, Math.min(0.999999, random())) * 100) + 1;
        successful = dice > threshold;
        if (!successful) {
            result = dice < threshold * 0.4 ? 'setback' : 'hold';
        }
    }
    if (successful) {
        next.stageProgress += 1;
        next.consecutiveFails = 0;
        if (next.stageProgress >= 9) {
            const phases = ['seeded', 'advancing', 'manifested'];
            const index = phases.indexOf(next.stage);
            if (index >= 0 && index < phases.length - 1) {
                next.stage = phases[index + 1];
                next.stageProgress = 1;
            } else {
                next.stage = 'resolved';
                next.stageProgress = 9;
                next.outcome = 'succeeded';
            }
        }
    } else {
        next.consecutiveFails += 1;
        if (result === 'setback') {
            next.stageProgress = Math.max(1, next.stageProgress - 1);
        }
    }
    next.evolveResult = result;
    return next;
}

function decayWorldClocks(world, turn, random) {
    const next = clone(world);
    const decay = {
        notice: { base: 10, grace: 4, linear: 3, quadratic: 1 },
        report: { base: 20, grace: 2, linear: 4, quadratic: 2 },
        rumor: { base: 25, grace: 1, linear: 5, quadratic: 3 },
        sentiment: { base: 8, grace: 5, linear: 2, quadratic: 1 },
    };
    next.winds = next.winds.filter((wind) => {
        const params = decay[wind.type] || decay.rumor;
        wind.quietTurns = Math.max(0, Number(wind.quietTurns) || 0) + 1;
        if (wind.quietTurns <= params.grace) return true;
        const n = wind.quietTurns - params.grace - 1;
        const chance = Math.min(
            95,
            Math.max(
                5,
                params.base
                    + params.linear * n
                    + params.quadratic * n * n
                    - (wind.strength - 1) * 10,
            ),
        );
        return Math.floor(Math.max(0, Math.min(0.999999, random())) * 100) + 1
            > chance;
    });
    next.environment.incidents = next.environment.incidents.map((incident) => {
        if (incident.status !== 'active' || incident.remainingTurns <= 0) return incident;
        const updated = clone(incident);
        updated.remainingTurns -= 1;
        if (updated.remainingTurns <= 0) {
            updated.status = 'cooldown';
            updated.lastChange = '持续期结束，进入冷却';
            updated.updatedTurn = turn;
        }
        return updated;
    });
    next.influences = next.influences.filter((item) => item.expiresTurn >= turn);
    return next;
}

export function advanceContinuityClocks(value, {
    chatId = '',
    maxThreads = 8,
    random = Math.random,
} = {}) {
    const state = normalizeContinuityState(value, { chatId, maxThreads });
    const beforeThreads = new Map(state.threads.map((thread) => [thread.id, thread]));
    state.threads = state.threads.map((thread) => advanceThreadClock(thread, random));
    state.world = decayWorldClocks(state.world, state.turn + 1, random);
    const changedThreadIds = state.threads
        .filter((thread) => (
            stableThreadContent(beforeThreads.get(thread.id)) !== stableThreadContent(thread)
        ))
        .map((thread) => thread.id);
    return {
        state,
        changedThreadIds,
    };
}

export function scheduleWorldLanes(value, {
    turn,
    maxLanes = 2,
    factionSlots = null,
    environmentSlots = null,
    receiptScope = '',
} = {}) {
    const state = normalizeContinuityState(value, { maxThreads: 12 });
    const scheduledTurn = boundedInteger(
        turn,
        state.turn,
        Number.MAX_SAFE_INTEGER,
        state.turn,
    );
    const limit = boundedInteger(maxLanes, 0, 8, 2);
    const factionLimit = factionSlots === null || factionSlots === undefined
        ? limit
        : boundedInteger(factionSlots, 0, 4, limit);
    const environmentLimit = environmentSlots === null || environmentSlots === undefined
        ? limit
        : boundedInteger(environmentSlots, 0, 4, limit);
    const candidates = [];
    const addCandidate = ({
        laneType,
        sourceId,
        label,
        updatedTurn = 0,
        baseScore = 0,
        dueScore = 0,
        dueReason = '',
        knowledge = 'hidden',
        sourceThreads = [],
    }) => {
        const silenceTurns = Math.max(0, scheduledTurn - Number(updatedTurn || 0));
        candidates.push({
            laneType,
            channel: laneType === 'faction' ? 'faction' : 'environment',
            sourceId,
            label: cleanText(label, 180),
            score: baseScore + dueScore + Math.min(18, silenceTurns * 2),
            due: dueScore > 0,
            dueReason: cleanText(
                dueReason || `已沉默${silenceTurns}轮，进入低频世界探索`,
                300,
            ),
            silenceTurns,
            knowledge: KNOWLEDGE.has(knowledge) ? knowledge : 'hidden',
            sourceThreads: cleanList(sourceThreads, 8),
            independentOfActors: true,
        });
    };

    for (const item of state.world.environment.incidents) {
        if (item.status === 'resolved') continue;
        const remaining = Number(item.remainingTurns || 0);
        const due = item.status === 'active' && remaining <= 1;
        addCandidate({
            laneType: 'environment',
            sourceId: item.id,
            label: item.title,
            updatedTurn: item.updatedTurn,
            baseScore: item.status === 'active' ? 80 : 45,
            dueScore: due ? 35 : 0,
            dueReason: due
                ? `环境事件剩余窗口${remaining}轮，必须结算、转入冷却或说明具体阻塞`
                : item.lastChange || item.summary,
            knowledge: item.knowledge,
            sourceThreads: item.sourceThreads,
        });
    }
    if (state.world.environment.summary) {
        addCandidate({
            laneType: 'environment',
            sourceId: 'environment:ambient',
            label: `环境变化：${state.world.environment.summary}`,
            updatedTurn: state.world.environment.updatedTurn,
            baseScore: 48,
            dueScore: 0,
            dueReason: state.world.environment.summary,
            knowledge: 'observed',
        });
    }
    if (state.world.environment.economy !== 'stable') {
        addCandidate({
            laneType: 'environment',
            sourceId: 'environment:economy',
            label: `经济状态：${state.world.environment.economy}`,
            updatedTurn: state.world.environment.updatedTurn,
            baseScore: 58,
            dueScore: 0,
            dueReason: state.world.environment.basis
                || state.world.environment.summary,
            knowledge: 'observed',
        });
    }
    for (const item of state.world.factions) {
        if (item.condition === 'collapsed') continue;
        const pressure = {
            dominant: 4,
            stable: 0,
            divided: 12,
            strained: 20,
            declining: 24,
        }[item.condition] || 0;
        addCandidate({
            laneType: 'faction',
            sourceId: item.id,
            label: item.name,
            updatedTurn: item.updatedTurn,
            baseScore: 60 + pressure,
            dueScore: pressure >= 20 ? 8 : 0,
            dueReason: item.goal || item.lastChange || item.summary,
            knowledge: item.knowledge,
            sourceThreads: item.sourceThreads,
        });
    }
    for (const item of state.world.trends) {
        if (item.status !== 'active') continue;
        addCandidate({
            laneType: 'trend',
            sourceId: item.id,
            label: item.name,
            updatedTurn: item.updatedTurn,
            baseScore: 50,
            dueReason: item.summary || item.source,
            knowledge: item.knowledge,
            sourceThreads: item.sourceThreads,
        });
    }
    for (const item of state.world.winds) {
        const expiresSoon = item.expiresTurn > 0
            && item.expiresTurn <= scheduledTurn + 1;
        addCandidate({
            laneType: 'public_signal',
            sourceId: item.id,
            label: item.topic,
            updatedTurn: item.updatedTurn,
            baseScore: 42 + item.strength * 5,
            dueScore: expiresSoon ? 12 : 0,
            dueReason: expiresSoon
                ? `传播窗口将在第${item.expiresTurn}轮结束`
                : item.content || item.source,
            knowledge: item.knowledge,
            sourceThreads: item.sourceThreads,
        });
    }
    for (const item of state.world.influences) {
        const expiresSoon = item.expiresTurn <= scheduledTurn + 1;
        addCandidate({
            laneType: 'causal',
            sourceId: item.id,
            label: item.trigger,
            updatedTurn: item.updatedTurn,
            baseScore: 52,
            dueScore: expiresSoon ? 18 : 0,
            dueReason: expiresSoon
                ? `因果余波窗口将在第${item.expiresTurn}轮结束`
                : item.fallout || item.impact,
            knowledge: item.knowledge,
            sourceThreads: item.sourceThreads,
        });
    }

    const sorted = candidates.sort((left, right) => (
        right.score - left.score
        || Number(right.due) - Number(left.due)
        || right.silenceTurns - left.silenceTurns
        || left.laneType.localeCompare(right.laneType)
        || left.sourceId.localeCompare(right.sourceId)
    ));
    const selected = [];
    const selectedByChannel = { faction: 0, environment: 0 };
    const channelLimit = { faction: factionLimit, environment: environmentLimit };
    for (const candidate of sorted) {
        if (selected.length >= limit) break;
        if (selectedByChannel[candidate.channel] >= channelLimit[candidate.channel]) continue;
        selected.push(candidate);
        selectedByChannel[candidate.channel] += 1;
    }
    const scope = cleanText(receiptScope, 260)
        .replace(/[^\p{L}\p{N}_.:-]+/gu, '-')
        .replace(/^-+|-+$/gu, '');
    const receipts = selected.map((candidate, index) => ({
        receiptId: `world-lane:${scope ? `${scope}:` : ''}${scheduledTurn}:${candidate.laneType}:${candidate.sourceId}`,
        turn: scheduledTurn,
        rank: index + 1,
        laneType: candidate.laneType,
        channel: candidate.channel,
        sourceId: candidate.sourceId,
        status: candidate.due ? 'scheduled' : 'retained',
        due: candidate.due,
        mode: candidate.due ? 'settlement' : 'exploration',
        dueReason: candidate.dueReason,
        independentOfActors: true,
    }));
    return {
        turn: scheduledTurn,
        maxLanes: limit,
        factionSlots: factionLimit,
        environmentSlots: environmentLimit,
        selected,
        receipts,
    };
}

export function continuityLedgerView(value, {
    chatId = '',
    maxThreads = 12,
} = {}) {
    const state = normalizeContinuityState(value, { chatId, maxThreads });
    const items = state.threads
        .map((thread) => {
            const latestSource = thread.sourceRefs.at(-1) || null;
            return {
                ...clone(thread),
                stageLabel: EVENT_PHASE_LABELS[thread.eventType]?.[thread.stage]
                    || CONTINUITY_STAGE_LABELS[thread.stage]
                    || thread.stage,
                kindLabel: CONTINUITY_KIND_LABELS[thread.kind] || thread.kind,
                originLabel: CONTINUITY_ORIGIN_LABELS[thread.origin] || thread.origin,
                relationLabel: CONTINUITY_RELATION_LABELS[thread.relation]
                    || thread.relation,
                knowledgeLabel: CONTINUITY_KNOWLEDGE_LABELS[thread.knowledge]
                    || thread.knowledge,
                urgencyLabel: CONTINUITY_URGENCY_LABELS[thread.urgency]
                    || CONTINUITY_URGENCY_LABELS[1],
                latestSource,
                isResolved: thread.stage === 'resolved',
                isSpoiler: thread.knowledge === 'hidden'
                    && !['linked', 'converging'].includes(thread.relation)
                    && !['manifested', 'resolved'].includes(thread.stage),
            };
        })
        .sort((left, right) => (
            (STAGE_SORT_ORDER[left.stage] ?? 9) - (STAGE_SORT_ORDER[right.stage] ?? 9)
            || right.urgency - left.urgency
            || right.lastAdvancedTurn - left.lastAdvancedTurn
            || left.title.localeCompare(right.title, 'zh-CN')
        ));
    const active = items.filter((thread) => !thread.isResolved);
    const resolved = items.filter((thread) => thread.isResolved);
    const echoes = items.flatMap((thread) => thread.rumors.map((content, index) => ({
        id: `${thread.id}:rumor:${index}`,
        threadId: thread.id,
        threadTitle: thread.title,
        content,
        knowledge: thread.knowledge,
        stage: thread.stage,
        isSpoiler: thread.isSpoiler,
    }))).slice(0, 16);
    const world = clone(state.world);
    const scenarioPlan = clone(state.scenarioPlan);
    scenarioPlan.statusLabel = SCENARIO_STATUS_LABELS[scenarioPlan.status]
        || scenarioPlan.status;
    scenarioPlan.phaseLabel = SCENARIO_PHASE_LABELS[scenarioPlan.current.phase]
        || scenarioPlan.current.phase;
    scenarioPlan.amendments = scenarioPlan.amendments.map((item) => ({
        ...item,
        causeLabel: SCENARIO_CAUSE_LABELS[item.causeType] || item.causeType,
    }));
    scenarioPlan.latestAmendment = scenarioPlan.amendments.at(-1) || null;
    const visibleWorldCount = [
        ...world.trends,
        ...world.factions,
        ...world.winds,
        ...world.environment.incidents,
        ...world.shadows.enemies,
        ...world.shadows.secrets,
        ...world.influences,
    ].length;
    return {
        turn: state.turn,
        updatedAt: state.updatedAt,
        lastTick: clone(state.lastTick),
        activeCount: active.length,
        dormantCount: active.filter((thread) => thread.stage === 'dormant').length,
        resolvedCount: resolved.length,
        echoCount: echoes.length,
        active,
        resolved,
        echoes,
        world,
        scenarioPlan,
        worldCount: visibleWorldCount,
        worldCounts: {
            factions: world.factions.length,
            winds: world.winds.length + echoes.length,
            reputation: REPUTATION_KEYS.filter((key) => (
                world.reputation[key].level !== 0
                || world.reputation[key].summary
            )).length,
            environment: world.environment.incidents.length
                + world.trends.length
                + (world.environment.summary ? 1 : 0),
            shadows: world.shadows.enemies.length + world.shadows.secrets.length,
            influences: world.influences.length,
        },
    };
}

function stableThreadContent(thread) {
    const copy = clone(thread);
    delete copy.sourceRefs;
    delete copy.createdTurn;
    delete copy.lastAdvancedTurn;
    delete copy.resolvedTurn;
    return JSON.stringify(copy);
}

function stableWorldContent(value) {
    const copy = clone(value);
    const stripTurn = (item) => {
        if (item && typeof item === 'object') delete item.updatedTurn;
        return item;
    };
    for (const item of copy.trends || []) stripTurn(item);
    for (const item of copy.factions || []) stripTurn(item);
    for (const item of copy.winds || []) stripTurn(item);
    for (const item of Object.values(copy.reputation || {})) stripTurn(item);
    stripTurn(copy.environment);
    for (const item of copy.environment?.incidents || []) stripTurn(item);
    for (const item of copy.shadows?.enemies || []) stripTurn(item);
    for (const item of copy.shadows?.secrets || []) stripTurn(item);
    for (const item of copy.influences || []) stripTurn(item);
    return JSON.stringify(copy);
}

function stableScenarioContent(value) {
    const copy = clone(value);
    delete copy.updatedTurn;
    delete copy.baselineSourceRef;
    for (const amendment of copy.amendments || []) {
        delete amendment.sourceRef;
    }
    return JSON.stringify(copy);
}

export function continuityWorldDigest(state) {
    const normalized = normalizeContinuityState(state, {
        maxThreads: 24,
        maxResolved: 24,
    });
    return stableWorldContent(normalized.world);
}

export function continuityScenarioDigest(state) {
    const normalized = normalizeContinuityState(state, {
        maxThreads: 24,
        maxResolved: 24,
    });
    return stableScenarioContent(normalized.scenarioPlan);
}

export function continuityLifecycleDigest(state) {
    const normalized = normalizeContinuityState(state, { maxThreads: 24, maxResolved: 24 });
    return JSON.stringify(
        normalized.threads.map((thread) => [thread.id, stableThreadContent(thread)]),
    );
}

export function continuityLifecycleStats(previous, next) {
    const before = normalizeContinuityState(previous, { maxThreads: 24, maxResolved: 24 });
    const after = normalizeContinuityState(next, { maxThreads: 24, maxResolved: 24 });
    const oldById = new Map(before.threads.map((thread) => [thread.id, thread]));
    const newById = new Map(after.threads.map((thread) => [thread.id, thread]));
    const changedExisting = after.threads.filter((thread) => {
        const old = oldById.get(thread.id);
        return old && stableThreadContent(old) !== stableThreadContent(thread);
    });
    const added = after.threads.filter((thread) => !oldById.has(thread.id));
    const schedulerAdvanced = after.lastTick.turn > before.lastTick.turn
        && !!after.lastTick.action
        && !!after.lastTick.reason;
    return {
        activeBefore: before.threads.filter((thread) => thread.stage !== 'resolved').length,
        changedExisting: changedExisting.length,
        added: added.length,
        newlyResolved: changedExisting.filter((thread) => thread.stage === 'resolved').length,
        removed: before.threads.filter((thread) => !newById.has(thread.id)).length,
        schedulerAdvanced,
        tickAction: after.lastTick.action,
    };
}

function nextWorldId(items, prefix) {
    let number = 1;
    const used = new Set(items.map((item) => item.id));
    while (used.has(`${prefix}-${String(number).padStart(2, '0')}`)) number += 1;
    return `${prefix}-${String(number).padStart(2, '0')}`;
}

function mergeWorldItems(current, updates, {
    prefix,
    identityKey,
    turn,
    cap,
    wind = false,
} = {}) {
    const result = clone(current);
    if (!Array.isArray(updates)) return result;
    for (const raw of updates) {
        if (!raw || typeof raw !== 'object') continue;
        const explicitId = cleanText(raw.id, 90);
        let index = explicitId
            ? result.findIndex((item) => item.id === explicitId)
            : -1;
        if (index < 0 && !explicitId && raw[identityKey]) {
            const matches = result
                .map((item, itemIndex) => (
                    item[identityKey] === cleanText(raw[identityKey], 120)
                        ? itemIndex
                        : -1
                ))
                .filter((itemIndex) => itemIndex >= 0);
            if (matches.length === 1) index = matches[0];
        }
        if (explicitId && index < 0) continue;
        if (index >= 0) {
            const previous = result[index];
            const merged = { ...previous, ...clone(raw), id: previous.id };
            if (wind) merged.quietTurns = 0;
            const beforeText = JSON.stringify({ ...previous, updatedTurn: 0 });
            const afterText = JSON.stringify({ ...merged, updatedTurn: 0 });
            if (beforeText !== afterText) merged.updatedTurn = turn;
            result[index] = merged;
            continue;
        }
        const hasBasis = cleanText(raw.basis, 420)
            || (wind ? cleanText(raw.source, 180) : '');
        if (!hasBasis) continue;
        const fresh = {
            ...clone(raw),
            id: nextWorldId(result, prefix),
            updatedTurn: turn,
        };
        if (wind) fresh.quietTurns = 0;
        result.unshift(fresh);
        if (result.length > cap) result.length = cap;
    }
    return result;
}

export function applyWorldUpdate(current, update, {
    turn = 0,
} = {}) {
    const before = normalizeWorldState(current, { turn });
    const delta = update && typeof update === 'object' ? update : {};
    const environmentDelta = delta.environment && typeof delta.environment === 'object'
        ? delta.environment
        : {};
    const shadowsDelta = delta.shadows && typeof delta.shadows === 'object'
        ? delta.shadows
        : {};
    const result = clone(before);

    if (typeof delta.digest === 'string' && cleanText(delta.digest, 700)) {
        result.digest = cleanText(delta.digest, 700);
    }
    result.trends = mergeWorldItems(before.trends, delta.trends, {
        prefix: 'TREND',
        identityKey: 'name',
        turn,
        cap: 6,
    });
    result.factions = mergeWorldItems(before.factions, delta.factions, {
        prefix: 'FAC',
        identityKey: 'name',
        turn,
        cap: 16,
    });
    result.winds = mergeWorldItems(before.winds, delta.winds, {
        prefix: 'WIND',
        identityKey: 'topic',
        turn,
        cap: 20,
        wind: true,
    });

    if (delta.reputation && typeof delta.reputation === 'object') {
        for (const key of REPUTATION_KEYS) {
            if (!delta.reputation[key] || typeof delta.reputation[key] !== 'object') continue;
            const previous = before.reputation[key];
            const proposed = { ...previous, ...clone(delta.reputation[key]) };
            if (!cleanText(proposed.basis, 420)) continue;
            proposed.level = Math.max(
                previous.level - 1,
                Math.min(previous.level + 1, Number(proposed.level) || 0),
            );
            proposed.updatedTurn = turn;
            result.reputation[key] = proposed;
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(environmentDelta, 'economy')
        || Object.prototype.hasOwnProperty.call(environmentDelta, 'summary')
    ) {
        const proposedBasis = cleanText(
            environmentDelta.basis || before.environment.basis,
            420,
        );
        if (proposedBasis) {
            const oldIndex = ECONOMY_STATES.indexOf(before.environment.economy);
            const requested = ECONOMY_STATES.includes(environmentDelta.economy)
                ? ECONOMY_STATES.indexOf(environmentDelta.economy)
                : oldIndex;
            result.environment = {
                ...result.environment,
                ...clone(environmentDelta),
                economy: ECONOMY_STATES[
                    Math.max(oldIndex - 1, Math.min(oldIndex + 1, requested))
                ],
                basis: proposedBasis,
                updatedTurn: turn,
            };
        }
    }
    result.environment.incidents = mergeWorldItems(
        before.environment.incidents,
        environmentDelta.incidents,
        {
            prefix: 'INC',
            identityKey: 'title',
            turn,
            cap: 12,
        },
    );
    result.shadows.enemies = mergeWorldItems(
        before.shadows.enemies,
        shadowsDelta.enemies,
        {
            prefix: 'ENEMY',
            identityKey: 'name',
            turn,
            cap: 12,
        },
    );
    result.shadows.secrets = mergeWorldItems(
        before.shadows.secrets,
        shadowsDelta.secrets,
        {
            prefix: 'SECRET',
            identityKey: 'title',
            turn,
            cap: 16,
        },
    );
    result.influences = mergeWorldItems(before.influences, delta.influences, {
        prefix: 'CAUSE',
        identityKey: 'trigger',
        turn,
        cap: 16,
    });
    return normalizeWorldState(result, { turn });
}

function enforceWorldPolicy(beforeState, afterState) {
    const before = normalizeWorldState(beforeState.world, { turn: beforeState.turn });
    const after = normalizeWorldState(afterState.world, { turn: beforeState.turn + 1 });
    for (const key of REPUTATION_KEYS) {
        after.reputation[key].level = Math.max(
            before.reputation[key].level - 1,
            Math.min(before.reputation[key].level + 1, after.reputation[key].level),
        );
    }
    const oldIndex = ECONOMY_STATES.indexOf(before.environment.economy);
    const newIndex = ECONOMY_STATES.indexOf(after.environment.economy);
    after.environment.economy = ECONOMY_STATES[
        Math.max(oldIndex - 1, Math.min(oldIndex + 1, newIndex))
    ];
    return after;
}

function worldItems(value) {
    const world = value && typeof value === 'object' ? value : emptyWorldState();
    return [
        ...(world.trends || []),
        ...(world.factions || []),
        ...(world.winds || []),
        ...(world.environment?.incidents || []),
        ...(world.shadows?.enemies || []),
        ...(world.shadows?.secrets || []),
        ...(world.influences || []),
    ];
}

function sanitizeWorldSourceThreads(value, validThreadIds, turn) {
    const next = clone(value);
    for (const item of worldItems(next)) {
        item.sourceThreads = cleanList(item.sourceThreads, 8)
            .filter((id) => validThreadIds.has(id));
    }
    return normalizeWorldState(next, { turn });
}

function enrichThreadPropagation(thread, world) {
    const next = clone(thread);
    const linkedItems = worldItems(world).filter((item) => (
        Array.isArray(item.sourceThreads)
        && item.sourceThreads.includes(next.id)
    ));
    next.propagation = cleanList([
        ...(next.propagation || []),
        ...linkedItems.map((item) => item.id),
    ], 12);
    const hasPublicSurface = linkedItems.some((item) => item.knowledge !== 'hidden');
    if (
        next.convergence?.channels?.includes('public_signal')
        && !hasPublicSurface
    ) {
        next.convergence.channels = next.convergence.channels
            .filter((channel) => channel !== 'public_signal');
        if (!next.convergence.channels.length) {
            next.convergence.score = Math.min(
                Number(next.convergence.score) || 0,
                1,
            );
        }
    }
    return next;
}

function threadHasMatureConvergence(thread, world) {
    const convergence = thread?.convergence || {};
    const channels = Array.isArray(convergence.channels) ? convergence.channels : [];
    const evidence = Array.isArray(convergence.evidence) ? convergence.evidence : [];
    if (
        Number(convergence.score) < 2
        || !channels.length
        || !evidence.length
        || !String(convergence.entryBeat || '').trim()
    ) {
        return false;
    }
    if (!channels.includes('public_signal')) return true;
    const publicRefs = new Set(
        worldItems(world)
            .filter((item) => (
                item.knowledge !== 'hidden'
                && Array.isArray(item.sourceThreads)
                && item.sourceThreads.includes(thread.id)
            ))
            .map((item) => item.id),
    );
    return (thread.propagation || []).some((id) => publicRefs.has(id));
}

function scenarioStatusFromCurrent(current) {
    if (current.closure === 'completed' || current.phase === 'completed') return 'completed';
    if (current.closure === 'failed' || current.phase === 'failed') return 'failed';
    if (current.closure === 'ready' || current.phase === 'closing') return 'closing';
    return 'active';
}

function scenarioPlanIsInitializable(plan) {
    return (
        ['active', 'closing'].includes(plan.status)
        && !plan.invalidBaseline
        && !!plan.instanceId
        && !!plan.title
        && !!plan.baseline.goal
        && !!plan.baseline.completion
        && plan.baselineEvidence.length > 0
    );
}

function scenarioSourceIsMature(thread) {
    return !!(
        thread
        && (
            ['manifested', 'resolved'].includes(thread.stage)
            || Number(thread.stageProgress) >= 2
            || (thread.sourceRefs || []).length > 0
        )
        && !!(thread.seedBasis || thread.summary || thread.offscreenBeat)
    );
}

export function enforceScenarioPlanPolicy(previous, candidate, {
    beforeThreads = [],
    afterThreads = [],
    turn = 0,
} = {}) {
    const before = normalizeScenarioPlan(previous, { turn });
    const proposed = normalizeScenarioPlan(candidate, { turn });
    if (before.status === 'inactive') {
        if (!scenarioPlanIsInitializable(proposed)) return before;
        const baseline = normalizeScenarioSnapshot(proposed.baseline);
        const current = normalizeScenarioSnapshot(baseline);
        return normalizeScenarioPlan({
            status: scenarioStatusFromCurrent(current),
            instanceId: proposed.instanceId,
            title: proposed.title,
            revision: 0,
            baselineEvidence: proposed.baselineEvidence,
            baselineSourceRef: proposed.baselineSourceRef,
            baseline,
            current,
            amendments: [],
            createdTurn: turn,
            updatedTurn: turn,
        }, { turn });
    }
    if (['completed', 'failed'].includes(before.status)) return before;

    const oldAmendmentIds = new Set(before.amendments.map((item) => item.id));
    const oldThreads = new Map(beforeThreads.map((thread) => [thread.id, thread]));
    const allThreads = new Map(afterThreads.map((thread) => [thread.id, thread]));
    for (const thread of beforeThreads) {
        if (!allThreads.has(thread.id)) allThreads.set(thread.id, thread);
    }
    const structuralFields = new Set([
        'goal',
        'completion',
        'failure',
        'activeApex',
        'closure',
    ]);
    const requested = proposed.amendments
        .filter((item) => !oldAmendmentIds.has(item.id))
        .slice(0, 1);
    if (!requested.length) return before;
    const amendment = clone(requested[0]);
    const sources = amendment.sourceThreadIds
        .map((id) => allThreads.get(id))
        .filter(Boolean);
    if (
        amendment.invalidChanges
        || !amendment.causeType
        || !amendment.impact
        || !amendment.visibility
        || !amendment.trigger
        || !amendment.mechanism
        || !amendment.evidence.length
        || !amendment.changes.length
        || !amendment.sourceThreadIds.length
        || sources.length !== amendment.sourceThreadIds.length
    ) {
        return before;
    }
    if (amendment.causeType === 'world_chain') {
        const matureOldSources = amendment.sourceThreadIds
            .map((id) => oldThreads.get(id))
            .filter(scenarioSourceIsMature);
        if (matureOldSources.length !== amendment.sourceThreadIds.length) return before;
    } else if (amendment.causeType === 'player_action') {
        const hasDirectPlayerDerivative = sources.some((thread) => (
            thread.origin === 'main_derivative'
            && !!thread.seedBasis
            && (thread.causedBy || []).length > 0
        ));
        if (!hasDirectPlayerDerivative) return before;
    } else {
        const hasPriorTrace = amendment.sourceThreadIds.some((id) => (
            scenarioSourceIsMature(oldThreads.get(id))
        ));
        if (!hasPriorTrace) return before;
    }

    const current = clone(before.current);
    const acceptedChanges = [];
    const requiredNonEmptyFields = new Set(['goal', 'completion', 'phase', 'closure']);
    for (const change of amendment.changes) {
        const actualBefore = normalizeScenarioField(change.field, current[change.field]);
        if (
            change.before !== actualBefore
            || change.after === actualBefore
            || (
                requiredNonEmptyFields.has(change.field)
                && !String(change.after || '').trim()
            )
        ) {
            continue;
        }
        current[change.field] = change.after;
        acceptedChanges.push({ ...change, before: actualBefore });
    }
    if (acceptedChanges.length !== amendment.changes.length) return before;
    const isStructural = acceptedChanges.some((change) => (
        structuralFields.has(change.field)
    ));
    if (
        (isStructural || amendment.impact === 'structural')
        && !amendment.preserves.length
    ) return before;
    if (
        ['ready', 'completed', 'failed'].includes(current.closure)
        && !current.closureReason
    ) return before;
    if (
        (current.closure === 'completed' && current.phase !== 'completed')
        || (current.closure === 'failed' && current.phase !== 'failed')
        || (current.phase === 'completed' && current.closure !== 'completed')
        || (current.phase === 'failed' && current.closure !== 'failed')
    ) return before;
    if (
        before.current.closure === 'completed'
        || before.current.closure === 'failed'
        || before.current.phase === 'completed'
        || before.current.phase === 'failed'
    ) {
        return before;
    }

    amendment.revision = before.revision + 1;
    amendment.turn = turn;
    amendment.changes = acceptedChanges;
    return normalizeScenarioPlan({
        ...before,
        status: scenarioStatusFromCurrent(current),
        revision: amendment.revision,
        current,
        amendments: [...before.amendments, amendment],
        updatedTurn: turn,
    }, { turn });
}

export function enforceContinuityPolicy(previous, candidate, {
    autonomy = 'living',
    allowAutonomous = true,
    maxThreads = 8,
} = {}) {
    const before = normalizeContinuityState(previous, { maxThreads });
    const after = normalizeContinuityState(candidate, { maxThreads });
    const validThreadIds = new Set([
        ...before.threads.map((thread) => thread.id),
        ...after.threads.map((thread) => thread.id),
    ]);
    const policyWorld = sanitizeWorldSourceThreads(
        enforceWorldPolicy(before, after, { autonomy }),
        validThreadIds,
        before.turn + 1,
    );
    const gateUnmanifestedKnowledge = (baseline, proposed) => {
        const protectedThread = enrichThreadPropagation(proposed, policyWorld);
        const previousRelation = baseline?.relation || (
            protectedThread.origin === 'main_derivative'
                ? 'linked'
                : protectedThread.origin === 'setting_linked'
                    ? 'latent'
                    : 'independent'
        );
        const requestedBridge = ['linked', 'converging'].includes(
            protectedThread.relation,
        ) && ['independent', 'latent'].includes(previousRelation);
        const requestedConvergence = protectedThread.relation === 'converging'
            && previousRelation !== 'converging';
        if (requestedBridge || requestedConvergence) {
            const mature = threadHasMatureConvergence(
                protectedThread,
                policyWorld,
            );
            if (requestedBridge) {
                protectedThread.relation = mature ? 'converging' : previousRelation;
            } else if (!mature) {
                protectedThread.relation = previousRelation;
            }
        }
        const mayBePublic = ['linked', 'converging'].includes(protectedThread.relation)
            || ['manifested', 'resolved'].includes(protectedThread.stage);
        if (
            !mayBePublic
            && ['independent', 'latent'].includes(protectedThread.relation)
            && (baseline?.knowledge || 'hidden') === 'hidden'
            && protectedThread.knowledge !== 'hidden'
        ) {
            protectedThread.knowledge = 'hidden';
            protectedThread.rumors = clone(baseline?.rumors || []);
        }
        return protectedThread;
    };
    const oldById = new Map(before.threads.map((thread) => [thread.id, thread]));
    const newById = new Map(after.threads.map((thread) => {
        const enriched = enrichThreadPropagation(thread, policyWorld);
        return [enriched.id, enriched];
    }));
    const changeLimit = autonomy === 'expansive'
        ? 6
        : autonomy === 'living'
            ? 3
            : 1;
    const requestedTickId = String(after.lastTick?.threadId || '');
    const changedExisting = [...newById.values()]
        .filter((thread) => {
            const old = oldById.get(thread.id);
            return old && stableThreadContent(old) !== stableThreadContent(thread);
        })
        .sort((left, right) => (
            Number(right.id === requestedTickId) - Number(left.id === requestedTickId)
            || right.urgency - left.urgency
            || left.lastAdvancedTurn - right.lastAdvancedTurn
        ));
    const selectedChangedIds = changedExisting
        .slice(0, changeLimit)
        .map((thread) => thread.id);
    const selectedChangedIdSet = new Set(selectedChangedIds);
    const selectedChangedId = selectedChangedIds[0] || '';
    const threads = before.threads.map((old) => {
        if (!selectedChangedIdSet.has(old.id)) return clone(old);
        const proposed = gateUnmanifestedKnowledge(old, newById.get(old.id));
        proposed.origin = old.origin;
        proposed.createdTurn = old.createdTurn;
        proposed.lastAdvancedTurn = before.turn + 1;
        if (proposed.stage === 'resolved') {
            proposed.resolvedTurn = before.turn + 1;
            proposed.resolution ||= proposed.summary || proposed.offscreenBeat;
            if (!proposed.effects.length && proposed.offscreenBeat) {
                proposed.effects = [proposed.offscreenBeat];
            }
        }
        return proposed;
    });

    const newCandidates = [...newById.values()]
        .filter((thread) => !oldById.has(thread.id));
    const autonomousBefore = before.threads.filter((thread) => (
        thread.origin !== 'main_derivative'
        && thread.stage !== 'resolved'
        && thread.stage !== 'dormant'
    ));
    const cadence = 1;
    const autonomousLimit = autonomy === 'expansive' ? 12 : 8;
    const latestAutonomousCreation = autonomousBefore.reduce(
        (maximum, thread) => Math.max(maximum, thread.createdTurn || 0),
        0,
    );
    const cadenceReady = !autonomousBefore.length
        || before.turn - latestAutonomousCreation >= cadence;

    const activeIds = new Set(
        threads
            .filter((thread) => !['resolved', 'dormant'].includes(thread.stage))
            .map((thread) => thread.id),
    );
    let remaining = Math.max(0, maxThreads - activeIds.size);
    const accepted = [];
    const causal = newCandidates.filter((thread) => (
        thread.seedBasis
        && (
            thread.origin === 'main_derivative'
            || thread.causedBy.some((id) => oldById.has(id))
        )
    ));
    const autonomous = newCandidates.filter((thread) => (
        !causal.includes(thread)
        && thread.origin !== 'main_derivative'
        && thread.seedBasis
    ));

    for (const thread of causal) {
        if (remaining <= 0 || accepted.length >= 3) break;
        accepted.push(thread);
        remaining -= ['resolved', 'dormant'].includes(thread.stage) ? 0 : 1;
    }
    if (
        remaining > 0
        && accepted.length < 3
        && autonomy !== 'conservative'
        && allowAutonomous
        && cadenceReady
        && autonomousBefore.length < autonomousLimit
    ) {
        accepted.push(autonomous[0]);
    }
    for (const item of accepted.filter(Boolean)) {
        const fresh = gateUnmanifestedKnowledge(null, item);
        fresh.createdTurn = before.turn + 1;
        fresh.lastAdvancedTurn = before.turn + 1;
        if (fresh.stage === 'resolved') fresh.resolvedTurn = before.turn + 1;
        threads.push(fresh);
    }

    const scenarioPlan = enforceScenarioPlanPolicy(
        before.scenarioPlan,
        after.scenarioPlan,
        {
            beforeThreads: before.threads,
            afterThreads: threads,
            turn: before.turn + 1,
        },
    );
    const scenarioChanged = JSON.stringify(before.scenarioPlan)
        !== JSON.stringify(scenarioPlan);
    let lastTick = clone(before.lastTick);
    if (selectedChangedId) {
        const changed = threads.find((thread) => thread.id === selectedChangedId);
        const action = changed?.stage === 'resolved'
            ? 'resolved'
            : changed?.stage === 'manifested'
                ? 'manifested'
                : changed?.stage === 'dormant'
                    ? 'dormant'
                    : 'advanced';
        lastTick = {
            turn: before.turn + 1,
            action,
            threadId: selectedChangedId,
            reason: after.lastTick?.reason
                || changed?.offscreenBeat
                || changed?.resolution
                || changed?.summary
                || '事件状态发生实质变化',
        };
    } else if (accepted.filter(Boolean).length) {
        const created = accepted.find(Boolean);
        lastTick = {
            turn: before.turn + 1,
            action: 'created',
            threadId: created.id,
            reason: after.lastTick?.reason || created.seedBasis || '新的持续因果已经成立',
        };
    } else if (scenarioChanged) {
        lastTick = {
            turn: before.turn + 1,
            action: 'advanced',
            threadId: 'SCENARIO_PLAN',
            reason: scenarioPlan.revision > before.scenarioPlan.revision
                ? `副本/场景规划已通过第 ${scenarioPlan.revision} 次可追溯修订`
                : '副本/场景规划基线已建立',
        };
    } else if (
        after.lastTick?.action === 'held'
        && after.lastTick.reason.length >= 8
        && after.lastTick.turn > (before.lastTick?.turn || 0)
        && oldById.has(after.lastTick.threadId)
        && oldById.get(after.lastTick.threadId)?.stage !== 'resolved'
    ) {
        lastTick = {
            turn: before.turn + 1,
            action: 'held',
            threadId: after.lastTick.threadId,
            reason: after.lastTick.reason,
        };
    }

    return normalizeContinuityState({
        ...after,
        lastTick,
        threads,
        world: policyWorld,
        scenarioPlan,
    }, { chatId: before.chatId || after.chatId, maxThreads });
}

export function attachChangedSourceRefs(previous, next, sourceRef) {
    const ref = normalizeSourceRef(sourceRef);
    const oldById = new Map((previous?.threads || []).map((thread) => [thread.id, thread]));
    const result = clone(next);
    result.threads = (result.threads || []).map((thread) => {
        const old = oldById.get(thread.id);
        const refs = Array.isArray(old?.sourceRefs) ? clone(old.sourceRefs) : [];
        const changed = !old || stableThreadContent(old) !== stableThreadContent(thread);
        if (changed && ref) {
            const key = `${ref.chatId}:${ref.messageId}:${ref.swipeId}:${ref.hash}`;
            const deduped = refs.filter((item) => (
                `${item.chatId}:${item.messageId}:${item.swipeId}:${item.hash}` !== key
            ));
            deduped.push(ref);
            thread.sourceRefs = deduped.slice(-8);
        } else {
            thread.sourceRefs = refs.slice(-8);
        }
        return thread;
    });
    const previousPlan = normalizeScenarioPlan(previous?.scenarioPlan, {
        turn: Number(previous?.turn) || 0,
    });
    const nextPlan = normalizeScenarioPlan(result.scenarioPlan, {
        turn: Number(result?.turn) || 0,
    });
    if (ref && nextPlan.revision > previousPlan.revision) {
        const newest = nextPlan.amendments.find(
            (item) => item.revision === nextPlan.revision,
        );
        if (newest) newest.sourceRef = ref;
    }
    if (
        ref
        && previousPlan.status === 'inactive'
        && nextPlan.status !== 'inactive'
    ) {
        nextPlan.baselineSourceRef = ref;
    }
    result.scenarioPlan = nextPlan;
    return result;
}

export function parseContinuityOutput(output, options = {}) {
    const text = String(output || '');
    const tagged = text.match(/<ContinuityState>\s*([\s\S]*?)\s*<\/ContinuityState>/iu);
    let body = tagged ? tagged[1] : text;
    body = body.replace(/```(?:json)?/giu, '').trim();
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) {
        return { error: '没有找到完整的 ContinuityState JSON' };
    }
    try {
        const parsed = JSON.parse(body.slice(start, end + 1));
        return {
            state: normalizeContinuityState(parsed, options),
            raw: clone(parsed),
        };
    } catch (error) {
        return { error: `ContinuityState JSON 解析失败：${error.message || error}` };
    }
}

function stageFromChinese(value) {
    const source = String(value || '');
    if (/已回收|已完成|已解决/u.test(source)) return 'resolved';
    if (/已显现|已爆发|已触发/u.test(source)) return 'manifested';
    if (/推进中|进行中|活跃/u.test(source)) return 'advancing';
    if (/搁置|沉寂|暂停/u.test(source)) return 'dormant';
    return 'seeded';
}

export function extractContinuityMarkers(text) {
    const source = String(text || '');
    const records = [];
    const recordPattern = /<parallel_event_record\b[^>]*>([\s\S]*?)<\/parallel_event_record>/giu;
    let match;
    while ((match = recordPattern.exec(source)) !== null) {
        const body = match[1].trim();
        const fields = {};
        for (const item of body.matchAll(/\[([^\]|]{1,30})\|([^\]]*)\]/gu)) {
            fields[item[1].trim()] = item[2].trim();
        }
        const id = cleanText(fields['事件ID'] || fields.ID || body.match(/PE-[\p{L}\p{N}_.:\-]+/u)?.[0], 90);
        if (!id) continue;
        const stateText = fields['状态'] || body;
        records.push({
            id,
            title: cleanText(fields['标题'] || id, 120),
            kind: 'parallel',
            origin: 'main_derivative',
            relation: 'linked',
            stage: stageFromChinese(stateText),
            summary: cleanText(fields['新增变化'] || fields['当前状态'] || body, 700),
            offscreenBeat: cleanText(fields['新增变化'] || '', 500),
            nextBeat: cleanText(fields['主线接口'] || fields['下一步'] || '', 500),
            trigger: cleanText(fields['触发条件'] || '', 350),
            intersection: '已由正文或预设平行事件记录接入主线',
            seedBasis: '正文/预设平行事件记录',
            actors: cleanList((fields['角色'] || '').split(/[、,，;；]/u)),
            locations: cleanList((fields['时间地点'] || fields['地点'] || '').split(/[、,，;；]/u)),
            knowledge: /已显现|已回收/u.test(stateText) ? 'observed' : 'hidden',
            urgency: /紧急|迫近|立即/u.test(body) ? 3 : 1,
        });
    }
    const taggedSections = [];
    for (const tag of ['dm_story', 'npc_track', 'current_event']) {
        const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'giu');
        for (const item of source.matchAll(pattern)) {
            taggedSections.push({ tag, content: cleanText(item[1], 5000) });
        }
    }
    return {
        records,
        taggedSections,
        hasPresetParallel: records.length > 0
            || /<parallel_event_record\b/iu.test(source)
            || taggedSections.some((item) => (
                item.tag === 'current_event' && /支线|SQ\./iu.test(item.content)
            )),
        hasStitches: /<dm_story\b|<npc_track\b/iu.test(source),
    };
}

export function mergeMarkerRecords(state, records, {
    chatId = '',
    maxThreads = 6,
} = {}) {
    const normalized = normalizeContinuityState(state, { chatId, maxThreads });
    const byId = new Map(normalized.threads.map((thread) => [thread.id, thread]));
    for (const raw of records || []) {
        const incoming = normalizeThread(raw, byId.size, normalized.turn);
        if (!incoming) continue;
        const old = byId.get(incoming.id);
        if (!old) {
            byId.set(incoming.id, incoming);
            continue;
        }
        const stage = old.stage === 'resolved' && incoming.stage !== 'resolved'
            ? 'resolved'
            : incoming.stage === 'seeded' && old.stage !== 'seeded'
                ? old.stage
                : incoming.stage;
        const knowledge = KNOWLEDGE_RANK[incoming.knowledge] >= KNOWLEDGE_RANK[old.knowledge]
            ? incoming.knowledge
            : old.knowledge;
        byId.set(incoming.id, {
            ...old,
            ...incoming,
            title: incoming.title === incoming.id ? old.title : incoming.title || old.title,
            stage,
            origin: old.origin || incoming.origin,
            relation: incoming.relation === 'linked' ? 'linked' : old.relation,
            offscreenBeat: incoming.offscreenBeat || old.offscreenBeat,
            nextBeat: incoming.nextBeat || old.nextBeat,
            trigger: incoming.trigger || old.trigger,
            seedBasis: incoming.seedBasis || old.seedBasis,
            intersection: incoming.intersection || old.intersection,
            causedBy: incoming.causedBy.length ? incoming.causedBy : old.causedBy,
            effects: incoming.effects.length ? incoming.effects : old.effects,
            rumors: incoming.rumors.length ? incoming.rumors : old.rumors,
            resolution: incoming.resolution || old.resolution,
            actors: incoming.actors.length ? incoming.actors : old.actors,
            locations: incoming.locations.length ? incoming.locations : old.locations,
            propagation: incoming.propagation.length
                ? incoming.propagation
                : old.propagation,
            convergence: incoming.convergence.score
                || incoming.convergence.channels.length
                || incoming.convergence.evidence.length
                || incoming.convergence.entryBeat
                ? incoming.convergence
                : old.convergence,
            knowledge,
            urgency: Math.max(old.urgency, incoming.urgency),
            createdTurn: old.createdTurn,
            resolvedTurn: stage === 'resolved'
                ? old.resolvedTurn || incoming.resolvedTurn
                : 0,
            sourceRefs: old.sourceRefs || [],
        });
    }
    return normalizeContinuityState({
        ...normalized,
        threads: [...byId.values()],
    }, { chatId, maxThreads });
}

export function buildContinuityInjection(state, {
    director = 'standalone',
    maxVisible = 2,
} = {}) {
    const normalized = normalizeContinuityState(state, { maxThreads: 12 });
    const canReachMain = (thread) => !!thread
        && (
            thread.origin === 'main_derivative'
            || ['linked', 'converging'].includes(thread.relation)
        );
    const active = normalized.threads.filter((thread) => (
        thread.stage !== 'resolved' && canReachMain(thread)
    ));
    const aftermath = normalized.threads.filter((thread) => (
        thread.stage === 'resolved'
        && normalized.turn - thread.resolvedTurn <= 6
        && (thread.effects.length || thread.rumors.length)
        && canReachMain(thread)
    ));
    const scenario = normalized.scenarioPlan;
    const hasScenarioPlan = scenario.status !== 'inactive' && !!scenario.instanceId;
    const scenarioRows = hasScenarioPlan
        ? [
            `当前副本/场景规划[${scenario.instanceId}] ${scenario.title}；版本=v${scenario.revision}；状态=${SCENARIO_STATUS_LABELS[scenario.status] || scenario.status}；阶段=${SCENARIO_PHASE_LABELS[scenario.current.phase] || scenario.current.phase}；收束=${scenario.current.closure}`,
            `当前主目标=${scenario.current.goal}；当前完成条件=${scenario.current.completion}；失败边界=${scenario.current.failure || '未单列'}`,
            `当前终局冲突/最高威胁=${scenario.current.activeApex || '无固定战斗型终局'}；路线结构=${scenario.current.route || '由玩家选择形成'}；时限=${scenario.current.timeLimit || '无明确时限'}；代价/赌注=${scenario.current.stakes || '以已发生事实为准'}`,
            scenario.current.closureReason
                ? `当前收束判定依据=${scenario.current.closureReason}`
                : '',
            ...scenario.amendments.slice(-3).map((item) => (
                `规划修订v${item.revision}[${item.id}]：原因=${SCENARIO_CAUSE_LABELS[item.causeType] || item.causeType}；`
                + `来源=${item.sourceThreadIds.join('、')}；触发=${item.trigger}；机制=${item.mechanism}；`
                + `变更=${item.changes.map((change) => `${change.field}:${change.before}→${change.after}`).join('，')}；`
                + `保留既有成果=${item.preserves.join('；') || '无结构性改写'}`
            )),
        ].filter(Boolean)
        : [];
    const visibleWorldRows = [
        ...normalized.world.trends
            .filter((item) => item.status === 'active' && item.knowledge !== 'hidden')
            .map((item) => (
                `长期趋势[${item.name}]：${item.summary}`
                + `${item.scope ? `；范围=${item.scope}` : ''}`
            )),
        ...normalized.world.factions
            .filter((item) => item.knowledge !== 'hidden')
            .map((item) => (
                `势力[${item.name}]：${WORLD_FACTION_RELATION_LABELS[item.relation]}／`
                + `${WORLD_FACTION_CONDITION_LABELS[item.condition]}；`
                + `${item.summary || item.lastChange || item.goal || '暂无公开变化'}`
            )),
        ...normalized.world.winds
            .filter((item) => item.knowledge !== 'hidden')
            .map((item) => (
                `风声[${WORLD_WIND_TYPE_LABELS[item.type]}·${item.strength}级·${item.topic}]：`
                + `${item.content}${item.scope ? `；范围=${item.scope}` : ''}`
            )),
        ...REPUTATION_KEYS
            .filter((key) => (
                normalized.world.reputation[key].level !== 0
                || normalized.world.reputation[key].summary
            ))
            .map((key) => {
                const item = normalized.world.reputation[key];
                return `声誉[${WORLD_REPUTATION_LABELS[key]}]：${item.level >= 0 ? '+' : ''}${item.level}；${item.summary || '评价发生变化'}`;
            }),
        normalized.world.environment.summary
            ? `环境[经济·${WORLD_ECONOMY_LABELS[normalized.world.environment.economy]}]：${normalized.world.environment.summary}`
            : '',
        ...normalized.world.environment.incidents
            .filter((item) => item.knowledge !== 'hidden' && item.status !== 'resolved')
            .map((item) => `环境[${item.title}]：${item.summary || item.lastChange}`),
        ...normalized.world.shadows.enemies
            .filter((item) => item.knowledge !== 'hidden' && item.status !== 'resolved')
            .map((item) => `敌情[${item.name}]：${item.summary || item.lastChange}`),
        ...normalized.world.shadows.secrets
            .filter((item) => (
                item.knowledge !== 'hidden'
                && ['leaking', 'exposed'].includes(item.status)
            ))
            .map((item) => `隐秘[${item.title}]：${item.summary || item.lastChange}`),
        ...normalized.world.influences
            .filter((item) => item.knowledge !== 'hidden')
            .map((item) => (
                `因果联动[${item.trigger}]：${item.impact}`
                + `${item.fallout ? `；余波=${item.fallout}` : ''}`
            )),
    ].filter(Boolean).slice(0, 12);
    if (
        !active.length
        && !aftermath.length
        && !visibleWorldRows.length
        && !hasScenarioPlan
    ) return '';
    const tickThread = normalized.threads.find(
        (thread) => thread.id === normalized.lastTick.threadId,
    );
    const tickReason = tickThread
        && canReachMain(tickThread)
        && tickThread.knowledge !== 'hidden'
        ? normalized.lastTick.reason || '未登记'
        : '幕后条件变化已记录（细节已折叠）';
    const directorText = director === 'stitches'
        ? '缝合怪负责场景与剧情提案；本账本只约束连续性。'
        : director === 'world'
            ? '世界引擎负责世界推演提案；本账本只补足因果连续性并避免重复推进。'
            : director === 'world_preset'
                ? '世界引擎与当前预设负责世界/平行事件提案；本账本只做去重、接续与回收。'
                : director === 'preset'
                    ? '当前预设负责平行事件写作；本账本只约束连续性。'
                    : director === 'mixed'
                        ? '预设、缝合怪或世界引擎负责剧情与世界提案；本账本只做去重、接续与回收。'
                        : '当前没有检测到外部剧情推进器；可按账本低频推进世界支线。';
    const visibleLimit = Math.min(
        4,
        Math.max(1, Math.round(Number(maxVisible) || 2)),
    );
    const candidateLimit = visibleLimit;
    const rows = active
        .sort((left, right) => (
            Number(right.relation === 'converging')
                - Number(left.relation === 'converging')
            || right.convergence.score - left.convergence.score
            || right.urgency - left.urgency
            || right.lastAdvancedTurn - left.lastAdvancedTurn
        ))
        .slice(0, candidateLimit)
        .map((thread) => {
            const hiddenConvergence = thread.knowledge === 'hidden'
                && thread.relation === 'converging';
            if (hiddenConvergence) {
                return [
                    `[${thread.id}] 汇流候选（幕后原因保密）`,
                    `阶段=${CONTINUITY_STAGE_LABELS[thread.stage] || thread.stage}`,
                    `来源=${CONTINUITY_ORIGIN_LABELS[thread.origin] || thread.origin}`,
                    '认知=hidden',
                    `汇流强度=${thread.convergence.score}/4`,
                    `成立依据=${thread.convergence.evidence.join('；')}`,
                    `可观察入口=${thread.convergence.entryBeat}`,
                    '调度=只可描写可观察入口，不得揭露幕后标题、真相或不知情角色无法取得的信息',
                ].join('；');
            }
            return [
                `[${thread.id}] ${thread.title}`,
                `阶段=${CONTINUITY_STAGE_LABELS[thread.stage] || thread.stage}`,
                `来源=${CONTINUITY_ORIGIN_LABELS[thread.origin] || thread.origin}`,
                `主线关系=${CONTINUITY_RELATION_LABELS[thread.relation] || thread.relation}`,
                `认知=${thread.knowledge}`,
                `现状=${thread.summary || '无新增事实'}`,
                `幕后变化=${thread.offscreenBeat || '本轮未推进'}`,
                `触发=${thread.trigger || '等待自然接口'}`,
                `下一拍=${thread.nextBeat || '保持，不强推'}`,
                `汇流条件=${thread.intersection || '无；允许独立发展或在幕后结束'}`,
                thread.convergence.score
                    ? `当前汇流=${thread.convergence.score}/4；${thread.convergence.evidence.join('；')}`
                    : '',
                thread.convergence.entryBeat
                    ? `可观察入口=${thread.convergence.entryBeat}`
                    : '',
                thread.propagation.length
                    ? `传播节点=${thread.propagation.join('、')}`
                    : '',
                thread.causedBy.length ? `因果父项=${thread.causedBy.join('、')}` : '',
                thread.effects.length ? `已生效影响=${thread.effects.join('；')}` : '',
                thread.rumors.length ? `传播中的流言=${thread.rumors.join('；')}` : '',
            ].filter(Boolean).join('；');
        });
    const aftermathRows = aftermath.map((thread) => [
        `[${thread.id}] ${thread.title}（已结束）`,
        `收束=${thread.resolution || thread.summary || '事件已经结束'}`,
        thread.effects.length ? `持续影响=${thread.effects.join('；')}` : '',
        thread.rumors.length ? `仍在传播=${thread.rumors.join('；')}` : '',
    ].filter(Boolean).join('；'));
    return [
        '<Parallel_Continuity_Bridge>',
        directorText,
        normalized.lastTick.action
            ? `最近世界调度=${CONTINUITY_TICK_LABELS[normalized.lastTick.action] || normalized.lastTick.action}；对象=${normalized.lastTick.threadId || '全局'}；依据=${tickReason}`
            : '最近世界调度=尚未运行。',
        '以下只包含已经接入主线或具备真实汇流证据的“小型主线接口”，不是完整后台账本；未列出的复杂支线仍会在幕后独立演化。',
        `本回合可自然采用0—${visibleLimit}条接口；没有合适叙事位置时必须采用0条，禁止为了证明世界引擎存在而生硬插入。`,
        '多个触发条件在同一时点分别成熟，或事件共享同一时间、地点、人物、势力、资源或直接因果簇时，可以在同一回合共同爆发；上限不是要求凑数，也不得把互不相关、尚未成熟的事件强行拼成一场。',
        '只可推动NPC、势力、环境、约定与敌方行动；禁止替玩家角色决定、说话、移动、消费资源或追加检定。',
        '外部预设、缝合怪或世界引擎安排的未来桥段都只是条件式导演提案：成功路线只在真实成功后启用，失败路线也必须保留，不得把计划目标当成已发生事实。',
        hasScenarioPlan
            ? '副本/场景规划是“当前有效、允许因果修订”的幕后结构，不是要求照演的剧本。玩家仍可自由选路、绕行、谈判、失败或制造意外；主回复不得自行改写规划，只有后续世界调度通过证据门槛并登记新版本后，新的目标、完成条件、终局威胁、路线、时限或赌注才生效。'
            : '',
        hasScenarioPlan
            ? '必须尊重规划中已经取得的胜利与进度。当前完成条件已经满足或closure=ready/completed时，应自然结算或收束；禁止为了延长副本临时追加更强怪物、隐藏阶段、第二个“真正最终Boss”或新主目标。'
            : '',
        hasScenarioPlan
            ? '比原终局威胁更强的新敌人只有在当前版本activeApex已经被可追溯修订时才能成为本副本的新终局；否则只能是另一个有独立因果与边界的后续世界事件。completed/failed的规划不可复开。'
            : '',
        '裁决与规划必须隔离：先按当前卡/骰子前端规则锁定行动、DC、应消费的唯一骰值与成功等级，再选择匹配的剧情分支。若提供骰池或随机序列，只能按其规定位置/顺序取值，禁止为了配合规划浏览后挑选成功数字；禁止先写结果再补造检定。',
        'hidden信息只能形成符合传播路径的痕迹，不能让不知情角色突然全知。计划、传闻和未来可能性不得写成已经发生的事实。',
        'relation=independent或latent的事件默认只在后台账本推进，禁止为了展示伏笔而强行写入正文；只有传播、人物/势力、地点、资源、时间或因果证据通过账本校验并转为converging后，才会出现在这里。',
        '独立事件可以始终不与主线相交，也可以在幕后自行解决；不要把所有世界变化都变成围着玩家转的任务。',
        '已结束事件不是被抹除：其effects与rumors仍是世界事实；若影响仍会自行发展，应沿causedBy建立新的稳定事件，禁止把同一事件无限续命。',
        '采用汇流候选时，只写“可观察入口”及其自然后果；入口可以是风声、价格/供给、公告、环境异常、NPC态度或行动，不必让支线人物直接登场。若入口与当前叙事节奏不合，继续不写。',
        visibleWorldRows.length
            ? '以下是已经公开或正在产生客观影响的世界表面，不是逐项播报清单；仅当当前人物、地点、资源或行动实际会接触时才自然体现，没有列出的隐藏条目不得泄露：'
            : '',
        ...scenarioRows,
        ...visibleWorldRows,
        ...rows,
        ...aftermathRows,
        '</Parallel_Continuity_Bridge>',
    ].join('\n');
}

export function continuityContentDigest(state) {
    const normalized = normalizeContinuityState(state, { maxThreads: 12 });
    delete normalized.updatedAt;
    return JSON.stringify(normalized);
}

export function continuityConsumptionEvidence(receipt, content) {
    const accepted = String(content || '');
    return (Array.isArray(receipt?.semanticEvidenceTerms)
        ? receipt.semanticEvidenceTerms
        : [])
        .map((term) => cleanText(term, 700))
        .find((term) => term.length >= 4 && accepted.includes(term)) || '';
}

export function appendRepairJournal(namespace, record, {
    maxEntries = 5,
    maxSnapshotChars = 180000,
} = {}) {
    const next = namespace && typeof namespace === 'object' ? clone(namespace) : {};
    const journal = Array.isArray(next.repairJournal) ? clone(next.repairJournal) : [];
    const clean = clone(record || {});
    if (clean.snapshot) {
        try {
            if (JSON.stringify(clean.snapshot).length > maxSnapshotChars) {
                delete clean.snapshot;
                clean.snapshotOmitted = true;
            }
        } catch {
            delete clean.snapshot;
            clean.snapshotOmitted = true;
        }
    }
    const existingIndex = clean.id
        ? journal.findIndex((item) => item?.id === clean.id)
        : -1;
    if (existingIndex >= 0) journal[existingIndex] = clean;
    else journal.push(clean);
    next.repairJournal = journal.slice(-Math.max(1, Number(maxEntries) || 5));
    return next;
}

export function latestUndoRecord(namespace) {
    const journal = Array.isArray(namespace?.repairJournal)
        ? namespace.repairJournal
        : [];
    for (let index = journal.length - 1; index >= 0; index -= 1) {
        const record = journal[index];
        if (['applied', 'prepared'].includes(record?.status)) return clone(record);
    }
    return null;
}

export function markRepairUndone(namespace, recordId) {
    const next = namespace && typeof namespace === 'object' ? clone(namespace) : {};
    next.repairJournal = (Array.isArray(next.repairJournal) ? next.repairJournal : [])
        .map((record) => record?.id === recordId
            ? { ...record, status: 'undone', undoneAt: Date.now() }
            : record);
    return next;
}
