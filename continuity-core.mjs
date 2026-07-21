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
        version: 1,
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
    const refs = (Array.isArray(value.sourceRefs) ? value.sourceRefs : [])
        .map(normalizeSourceRef)
        .filter(Boolean)
        .slice(-8);
    return {
        id,
        title,
        kind,
        stage,
        summary,
        nextBeat: cleanText(value.nextBeat, 500),
        trigger: cleanText(value.trigger, 350),
        actors: cleanList(value.actors),
        locations: cleanList(value.locations),
        knowledge,
        urgency: boundedInteger(value.urgency, 0, 3, 1),
        lastAdvancedTurn: boundedInteger(
            value.lastAdvancedTurn,
            0,
            Number.MAX_SAFE_INTEGER,
            turn,
        ),
        sourceRefs: refs,
    };
}

export function normalizeContinuityState(value, {
    chatId = '',
    maxThreads = 6,
} = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const turn = boundedInteger(source.turn, 0, Number.MAX_SAFE_INTEGER, 0);
    const threads = [];
    const used = new Set();
    for (const item of Array.isArray(source.threads) ? source.threads : []) {
        const thread = normalizeThread(item, threads.length, turn);
        if (!thread || used.has(thread.id)) continue;
        used.add(thread.id);
        threads.push(thread);
        if (threads.length >= boundedInteger(maxThreads, 1, 12, 6)) break;
    }
    return {
        version: 1,
        chatId: cleanText(chatId || source.chatId, 180),
        turn,
        threads,
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
                knowledgeLabel: CONTINUITY_KNOWLEDGE_LABELS[thread.knowledge]
                    || thread.knowledge,
                urgencyLabel: CONTINUITY_URGENCY_LABELS[thread.urgency]
                    || CONTINUITY_URGENCY_LABELS[1],
                latestSource,
                isResolved: thread.stage === 'resolved',
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
    return JSON.stringify(copy);
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
            stage: stageFromChinese(stateText),
            summary: cleanText(fields['新增变化'] || fields['当前状态'] || body, 700),
            nextBeat: cleanText(fields['主线接口'] || fields['下一步'] || '', 500),
            trigger: cleanText(fields['触发条件'] || '', 350),
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
    const normalized = normalizeContinuityState(state);
    const active = normalized.threads.filter((thread) => thread.stage !== 'resolved');
    if (!active.length) return '';
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
            `认知=${thread.knowledge}`,
            `现状=${thread.summary || '无新增事实'}`,
            `触发=${thread.trigger || '等待自然接口'}`,
            `下一拍=${thread.nextBeat || '保持，不强推'}`,
        ].join('；'));
    return [
        '<Parallel_Continuity_Bridge>',
        directorText,
        '以下内容是支线连续性账本，不是玩家行动授权，也不是要求本回合全部发生。',
        `本回合最多让${Math.max(0, Number(maxVisible) || 1)}条支线产生可观察变化；已有事件优先，不得另造同义支线。`,
        '只可推动NPC、势力、环境、约定与敌方行动；禁止替玩家角色决定、说话、移动、消费资源或追加检定。',
        'hidden信息只能形成符合传播路径的痕迹，不能让不知情角色突然全知。计划、传闻和未来可能性不得写成已经发生的事实。',
        '若触发条件尚未满足，保持或低调铺垫；满足时先在正文写出可观察因果，再按原预设/缝合怪格式更新对应事件。',
        ...rows,
        '</Parallel_Continuity_Bridge>',
    ].join('\n');
}

export function continuityContentDigest(state) {
    const normalized = normalizeContinuityState(state);
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
