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

const KNOWLEDGE = new Set(['hidden', 'rumor', 'observed']);

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

export function emptyContinuityState(chatId = '') {
    return {
        version: 2,
        chatId: cleanText(chatId, 180),
        turn: 0,
        threads: [],
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
    return {
        id,
        title,
        kind,
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
        knowledge,
        urgency: boundedInteger(value.urgency, 0, 3, 1),
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
    const active = allThreads
        .filter((thread) => thread.stage !== 'resolved')
        .slice(0, activeLimit);
    const resolved = allThreads
        .filter((thread) => thread.stage === 'resolved')
        .sort((left, right) => (
            right.resolvedTurn - left.resolvedTurn
            || right.lastAdvancedTurn - left.lastAdvancedTurn
        ))
        .slice(0, resolvedLimit);
    return {
        version: 2,
        chatId: cleanText(chatId || source.chatId, 180),
        turn,
        threads: [...active, ...resolved],
        updatedAt: boundedInteger(source.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
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
                stageLabel: CONTINUITY_STAGE_LABELS[thread.stage] || thread.stage,
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
    return {
        turn: state.turn,
        updatedAt: state.updatedAt,
        activeCount: active.length,
        resolvedCount: resolved.length,
        active,
        resolved,
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
    return {
        activeBefore: before.threads.filter((thread) => thread.stage !== 'resolved').length,
        changedExisting: changedExisting.length,
        added: added.length,
        newlyResolved: changedExisting.filter((thread) => thread.stage === 'resolved').length,
        removed: before.threads.filter((thread) => !newById.has(thread.id)).length,
    };
}

export function enforceContinuityPolicy(previous, candidate, {
    autonomy = 'living',
    allowAutonomous = true,
    maxThreads = 8,
} = {}) {
    const before = normalizeContinuityState(previous, { maxThreads });
    const after = normalizeContinuityState(candidate, { maxThreads });
    const oldById = new Map(before.threads.map((thread) => [thread.id, thread]));
    const newById = new Map(after.threads.map((thread) => [thread.id, thread]));
    const changedExisting = after.threads
        .filter((thread) => {
            const old = oldById.get(thread.id);
            return old && stableThreadContent(old) !== stableThreadContent(thread);
        })
        .sort((left, right) => (
            right.lastAdvancedTurn - left.lastAdvancedTurn
            || right.urgency - left.urgency
        ));
    const selectedChangedId = changedExisting[0]?.id || '';
    const threads = before.threads.map((old) => {
        if (old.id !== selectedChangedId) return clone(old);
        const proposed = clone(newById.get(old.id));
        proposed.origin = old.origin;
        proposed.createdTurn = old.createdTurn;
        proposed.lastAdvancedTurn = before.turn + 1;
        if (
            ['independent', 'latent'].includes(old.relation)
            && proposed.relation === 'linked'
        ) {
            proposed.relation = 'converging';
        }
        if (
            ['independent', 'latent'].includes(proposed.relation)
            && (
                proposed.knowledge === 'observed'
                || proposed.stage === 'manifested'
            )
        ) {
            proposed.relation = 'converging';
        }
        if (proposed.stage === 'resolved') {
            proposed.resolvedTurn = before.turn + 1;
            proposed.resolution ||= proposed.summary || proposed.offscreenBeat;
            if (!proposed.effects.length && proposed.offscreenBeat) {
                proposed.effects = [proposed.offscreenBeat];
            }
        }
        return proposed;
    });

    const newCandidates = after.threads.filter((thread) => !oldById.has(thread.id));
    const autonomousBefore = before.threads.filter((thread) => (
        thread.origin !== 'main_derivative'
        && thread.stage !== 'resolved'
    ));
    const cadence = autonomy === 'expansive' ? 2 : 3;
    const autonomousLimit = autonomy === 'expansive' ? 4 : 3;
    const latestAutonomousCreation = autonomousBefore.reduce(
        (maximum, thread) => Math.max(maximum, thread.createdTurn || 0),
        0,
    );
    const cadenceReady = !autonomousBefore.length
        || before.turn - latestAutonomousCreation >= cadence;

    const activeIds = new Set(
        threads.filter((thread) => thread.stage !== 'resolved').map((thread) => thread.id),
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
        if (remaining <= 0 || accepted.length >= 2) break;
        accepted.push(thread);
        remaining -= thread.stage === 'resolved' ? 0 : 1;
    }
    if (
        remaining > 0
        && accepted.length < 2
        && autonomy !== 'conservative'
        && allowAutonomous
        && cadenceReady
        && autonomousBefore.length < autonomousLimit
    ) {
        accepted.push(autonomous[0]);
    }
    for (const item of accepted.filter(Boolean)) {
        const fresh = clone(item);
        fresh.createdTurn = before.turn + 1;
        fresh.lastAdvancedTurn = before.turn + 1;
        if (fresh.stage === 'resolved') fresh.resolvedTurn = before.turn + 1;
        threads.push(fresh);
    }

    return normalizeContinuityState({
        ...after,
        threads,
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
        return { state: normalizeContinuityState(parsed, options) };
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
        byId.set(incoming.id, old ? {
            ...old,
            ...incoming,
            origin: old.origin || incoming.origin,
            relation: incoming.relation === 'linked' ? 'linked' : old.relation,
            seedBasis: incoming.seedBasis || old.seedBasis,
            intersection: incoming.intersection || old.intersection,
            sourceRefs: old.sourceRefs || [],
        } : incoming);
    }
    normalized.threads = [...byId.values()].slice(0, maxThreads);
    return normalized;
}

export function buildContinuityInjection(state, {
    director = 'standalone',
    maxVisible = 1,
} = {}) {
    const normalized = normalizeContinuityState(state, { maxThreads: 12 });
    const active = normalized.threads.filter((thread) => thread.stage !== 'resolved');
    const aftermath = normalized.threads.filter((thread) => (
        thread.stage === 'resolved'
        && normalized.turn - thread.resolvedTurn <= 6
        && (thread.effects.length || thread.rumors.length)
    ));
    if (!active.length && !aftermath.length) return '';
    const directorText = director === 'stitches'
        ? '缝合怪负责场景与剧情提案；本账本只约束连续性。'
        : director === 'preset'
            ? '当前预设负责平行事件写作；本账本只约束连续性。'
            : director === 'mixed'
                ? '当前预设与缝合怪负责剧情提案；本账本只做去重、接续与回收。'
                : '当前没有检测到外部剧情推进器；可按账本低频推进世界支线。';
    const rows = active
        .sort((left, right) => right.urgency - left.urgency)
        .map((thread) => [
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
            thread.causedBy.length ? `因果父项=${thread.causedBy.join('、')}` : '',
            thread.effects.length ? `已生效影响=${thread.effects.join('；')}` : '',
            thread.rumors.length ? `传播中的流言=${thread.rumors.join('；')}` : '',
        ].filter(Boolean).join('；'));
    const aftermathRows = aftermath.map((thread) => [
        `[${thread.id}] ${thread.title}（已结束）`,
        `收束=${thread.resolution || thread.summary || '事件已经结束'}`,
        thread.effects.length ? `持续影响=${thread.effects.join('；')}` : '',
        thread.rumors.length ? `仍在传播=${thread.rumors.join('；')}` : '',
    ].filter(Boolean).join('；'));
    return [
        '<Parallel_Continuity_Bridge>',
        directorText,
        '以下内容是支线连续性账本，不是玩家行动授权，也不是要求本回合全部发生。',
        `本回合最多让${Math.max(0, Number(maxVisible) || 1)}条支线产生可观察变化；已有事件优先，不得另造同义支线。`,
        '只可推动NPC、势力、环境、约定与敌方行动；禁止替玩家角色决定、说话、移动、消费资源或追加检定。',
        'hidden信息只能形成符合传播路径的痕迹，不能让不知情角色突然全知。计划、传闻和未来可能性不得写成已经发生的事实。',
        'relation=independent或latent的事件默认只在后台账本推进，禁止为了展示伏笔而强行写入正文；只有真实传播路径、地点/时间重合或因果后果满足intersection时，才能转为converging并产生可观察痕迹。',
        '独立事件可以始终不与主线相交，也可以在幕后自行解决；不要把所有世界变化都变成围着玩家转的任务。',
        '已结束事件不是被抹除：其effects与rumors仍是世界事实；若影响仍会自行发展，应沿causedBy建立新的稳定事件，禁止把同一事件无限续命。',
        '若触发条件尚未满足，保持或低调铺垫；满足时先在正文写出可观察因果，再按原预设/缝合怪格式更新对应事件。',
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

export function appendRepairJournal(namespace, record, {
    maxEntries = 5,
    maxSnapshotChars = 180000,
} = {}) {
    const next = namespace && typeof namespace === 'object' ? clone(namespace) : {};
    const journal = Array.isArray(next.repairJournal) ? next.repairJournal : [];
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
    journal.push(clean);
    next.repairJournal = journal.slice(-Math.max(1, Number(maxEntries) || 5));
    return next;
}

export function latestUndoRecord(namespace) {
    const journal = Array.isArray(namespace?.repairJournal)
        ? namespace.repairJournal
        : [];
    for (let index = journal.length - 1; index >= 0; index -= 1) {
        const record = journal[index];
        if (record?.snapshot && record?.status !== 'undone') return clone(record);
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
