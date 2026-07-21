import {
    deepClone,
    diffStates,
    extractLastUpdateBlock,
    extractSchemaScripts,
    findMvuRuleEntries,
    fingerprint,
    isPlainObject,
    preparePatch,
    statDataOf,
    validatePatchResult,
} from './core.mjs';
import {
    appendRepairJournal,
    attachChangedSourceRefs,
    buildContinuityInjection,
    continuityContentDigest,
    emptyContinuityState,
    extractContinuityMarkers,
    latestUndoRecord,
    markRepairUndone,
    mergeMarkerRecords,
    normalizeContinuityState,
    parseContinuityOutput,
} from './continuity-core.mjs';

const PLUGIN_ID = 'mvu_auto_doctor';
const VERSION = '1.2.0';
const STATUS_PLACEHOLDER = '<StatusPlaceHolderImpl/>';
const CHAT_NAMESPACE_VERSION = 2;
const CONTINUITY_INJECTION_NAME = 'mvu-auto-doctor-continuity';
const IN_CHAT_POSITION = 1;
const IN_CHAT_DEPTH = 1;
const DEFAULTS = Object.freeze({
    enabled: true,
    preferStoryOracle: true,
    preventDoubleWrite: true,
    notifyNoChange: false,
    delayMs: 1600,
    contextMessages: 8,
    maxTokens: 4096,
    modelTimeoutMs: 120000,
    continuityMode: 'auto',
    continuityMaxThreads: 4,
    continuityMaxVisible: 1,
    continuityContextMessages: 12,
    continuityMaxTokens: 2200,
});

let mvuPromise = null;
let runChain = Promise.resolve();
let continuityChain = Promise.resolve();
const automaticPendingKeys = new Set();
const automaticCompletedKeys = new Set();
const continuityPendingKeys = new Set();
const continuityCompletedKeys = new Set();
let lastUndo = null;
let latestStatus = '等待新的 AI 回复';
let latestContinuityStatus = '支线连续性：等待事件';
let oracleAutoDisabledNoticeShown = false;
let ui = null;
let operationEpoch = 0;
let generationSerial = 0;
let lastGeneration = { serial: 0, type: 'normal', dryRun: false };
let pendingChatSaveTimer = null;
let presetContinuityCache = { checkedAt: 0, active: false };

function getContext() {
    return window.SillyTavern?.getContext?.() || null;
}

function getSettings() {
    const context = getContext();
    if (!context) return { ...DEFAULTS };
    const root = context.extensionSettings || {};
    if (!isPlainObject(root[PLUGIN_ID])) root[PLUGIN_ID] = {};
    const settings = root[PLUGIN_ID];
    let changed = false;
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (settings[key] === undefined) {
            settings[key] = value;
            changed = true;
        }
    }
    if (!['auto', 'on', 'off'].includes(settings.continuityMode)) {
        settings.continuityMode = 'auto';
        changed = true;
    }
    if (changed) context.saveSettingsDebounced?.();
    return settings;
}

function saveSettings() {
    getContext()?.saveSettingsDebounced?.();
}

function toast(kind, message, title = 'MVU 自动医生') {
    try {
        const fn = window.toastr?.[kind];
        if (typeof fn === 'function') fn(message, title, { timeOut: kind === 'warning' ? 9000 : 6000 });
    } catch {
        // Toast is optional.
    }
}

function setStatus(text, kind = '') {
    latestStatus = String(text || '');
    if (!ui?.status) return;
    ui.status.textContent = latestStatus;
    ui.status.dataset.kind = kind;
}

function setContinuityStatus(text, kind = '') {
    latestContinuityStatus = String(text || '');
    if (!ui?.continuityStatus) return;
    ui.continuityStatus.textContent = latestContinuityStatus;
    ui.continuityStatus.dataset.kind = kind;
}

function invalidateOperations(reason = '') {
    operationEpoch += 1;
    automaticPendingKeys.clear();
    // A stale model request cannot be forcibly cancelled through every host API,
    // so detach the new queue. The old request may finish, but its epoch guard
    // prevents it from touching chat or MVU state.
    runChain = Promise.resolve();
    continuityChain = Promise.resolve();
    if (reason) console.info('[MVU Auto Doctor] 旧任务已失效：', reason);
}

function operationToken(captured) {
    return {
        epoch: captured?.epoch ?? operationEpoch,
        generationSerial: captured?.generationSerial ?? generationSerial,
        chatId: captured?.chatId || getContext()?.chatId || '',
    };
}

function operationIsCurrent(token) {
    const context = getContext();
    return !!(
        token
        && token.epoch === operationEpoch
        && token.chatId === context?.chatId
    );
}

function scheduleSafeChatSave(context, chatId) {
    if (!context || !chatId) return;
    clearTimeout(pendingChatSaveTimer);
    pendingChatSaveTimer = setTimeout(async () => {
        pendingChatSaveTimer = null;
        if (getContext()?.chatId !== chatId) return;
        try {
            await context.saveChat?.();
        } catch (error) {
            console.warn('[MVU Auto Doctor] 保存消息身份失败：', error);
        }
    }, 250);
}

function ensureMessageStableId(context, message, index) {
    if (!message) return '';
    const existing = message.extra?.mvu_auto_doctor_source_id
        || message.mesId
        || message.message_id
        || message.send_date;
    if (existing != null && String(existing).trim()) return String(existing);
    if (!message.extra || typeof message.extra !== 'object' || Array.isArray(message.extra)) {
        message.extra = {};
    }
    const id = [
        'mvuad',
        Date.now().toString(36),
        Number(index).toString(36),
        Math.random().toString(36).slice(2, 8),
    ].join('_');
    message.extra.mvu_auto_doctor_source_id = id;
    scheduleSafeChatSave(context, context?.chatId);
    return id;
}

function readChatNamespace(context = getContext()) {
    const value = context?.chatMetadata?.[PLUGIN_ID];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {
            version: CHAT_NAMESPACE_VERSION,
            rev: 0,
            chatId: context?.chatId || '',
            repairJournal: [],
            continuity: emptyContinuityState(context?.chatId || ''),
            continuityCheckpoint: null,
        };
    }
    return deepClone(value);
}

async function writeChatNamespace(next, expectedChatId, {
    force = false,
} = {}) {
    const context = getContext();
    if (!context || context.chatId !== expectedChatId) return false;
    const current = readChatNamespace(context);
    const candidate = {
        ...deepClone(next),
        version: CHAT_NAMESPACE_VERSION,
        chatId: expectedChatId,
    };
    const comparableCurrent = deepClone(current);
    const comparableNext = deepClone(candidate);
    delete comparableCurrent.rev;
    delete comparableNext.rev;
    if (!force && safeJson(comparableCurrent, 0) === safeJson(comparableNext, 0)) {
        return true;
    }
    candidate.rev = Math.max(Number(current.rev) || 0, Number(candidate.rev) || 0) + 1;
    if (context.chatId !== expectedChatId) return false;
    try {
        if (typeof context.updateChatMetadata === 'function') {
            context.updateChatMetadata({ [PLUGIN_ID]: candidate });
        } else if (context.chatMetadata) {
            context.chatMetadata[PLUGIN_ID] = candidate;
        } else {
            return false;
        }
        if (context.chatId !== expectedChatId) return false;
        if (typeof context.saveMetadataDebounced === 'function') {
            context.saveMetadataDebounced();
        } else if (typeof context.saveMetadata === 'function') {
            await context.saveMetadata();
        } else {
            await context.saveChat?.();
        }
        return context.chatId === expectedChatId;
    } catch (error) {
        console.warn('[MVU Auto Doctor] 保存聊天内记录失败：', error);
        return false;
    }
}

function currentCharacter(context) {
    if (!context || context.groupId != null) return null;
    return context.characters?.[context.characterId] || null;
}

function embeddedBooks(character) {
    return [
        character?.data?.character_book,
        character?.character_book,
        character?.json_data?.data?.character_book,
        character?.json_data?.character_book,
    ].filter((book) => book && typeof book === 'object');
}

async function collectMvuRules(context, character) {
    const activeCandidates = [];
    const embeddedCandidates = embeddedBooks(character)
        .flatMap((book) => findMvuRuleEntries(book));

    try {
        const module = await import('/scripts/world-info.js');
        const sorted = typeof module.getSortedEntries === 'function'
            ? await module.getSortedEntries()
            : [];
        activeCandidates.push(...findMvuRuleEntries({ entries: sorted }));

        const names = new Set(
            (sorted || []).map((entry) => entry?.world).filter(Boolean),
        );
        for (const name of module.selected_world_info || []) {
            if (name) names.add(name);
        }
        const primaryWorld = character?.data?.extensions?.world
            || character?.extensions?.world
            || character?.json_data?.data?.extensions?.world
            || character?.json_data?.extensions?.world;
        if (primaryWorld) names.add(primaryWorld);
        if (context?.chatMetadata?.world_info) {
            names.add(context.chatMetadata.world_info);
        }

        for (const name of names) {
            try {
                if (typeof module.loadWorldInfo === 'function') {
                    const book = await module.loadWorldInfo(name);
                    if (book) activeCandidates.push(...findMvuRuleEntries(book));
                }
            } catch (error) {
                console.warn('[MVU Auto Doctor] 读取世界书失败：', name, error);
            }
        }
    } catch (error) {
        console.warn('[MVU Auto Doctor] 世界书模块不可用，将只读取角色卡内嵌规则。', error);
    }

    // The stored active book is authoritative. The raw character-card book is
    // only a fallback: after a user binds a newer external book, mixing the old
    // embedded rules back in would recreate the very version conflict this
    // extension is meant to avoid.
    const candidates = activeCandidates.length
        ? activeCandidates
        : embeddedCandidates;
    const primaryExists = candidates.some((entry) => entry.primary);
    const chosen = candidates
        .filter((entry) => (primaryExists ? entry.primary : true))
        .filter((entry) => entry.constant || entry.primary)
        .sort((left, right) => left.order - right.order);

    const seen = new Set();
    const contents = [];
    for (const entry of chosen) {
        let content = entry.content;
        try {
            content = context?.substituteParams?.(content) ?? content;
        } catch {
            // Keep the raw rule if macro substitution is unavailable.
        }
        content = String(content || '').trim();
        if (!content || seen.has(content)) continue;
        seen.add(content);
        contents.push(`【${entry.comment || 'MVU 更新规则'}】\n${content}`);
    }
    return contents;
}

async function getMvu() {
    if (window.Mvu) return window.Mvu;
    if (mvuPromise) return mvuPromise;
    mvuPromise = (async () => {
        const helper = window.TavernHelper;
        if (typeof helper?.waitGlobalInitialized === 'function') {
            try {
                const result = await Promise.race([
                    helper.waitGlobalInitialized('Mvu'),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('等待 MVU 超时')), 12000);
                    }),
                ]);
                if (result) return result;
            } catch (error) {
                console.warn('[MVU Auto Doctor] 等待 MVU 失败：', error);
            }
        }
        return window.Mvu || null;
    })();
    return mvuPromise;
}

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitMvuIdle(Mvu, capMs = 120000) {
    if (typeof Mvu?.isDuringExtraAnalysis !== 'function') return;
    const started = Date.now();
    while (Date.now() - started < capMs) {
        let busy = false;
        try {
            busy = !!Mvu.isDuringExtraAnalysis();
        } catch {
            return;
        }
        if (!busy) return;
        await sleep(350);
    }
}

function disableStoryOracleAutoIfNeeded() {
    const settings = getSettings();
    if (!settings.preventDoubleWrite) return;
    const api = window.StoryOracleAPI;
    if (!api?.isCompatible?.(1)) return;
    try {
        const oracleSettings = api.context?.getSettings?.();
        if (!oracleSettings?.autoDiagnoseEnabled) return;
        oracleSettings.autoDiagnoseEnabled = false;
        getContext()?.saveSettingsDebounced?.();
        if (!oracleAutoDisabledNoticeShown) {
            oracleAutoDisabledNoticeShown = true;
            toast(
                'info',
                '已关闭故事神谕自身的 AUTO 诊断，避免两个程序同时写变量；神谕手动诊断不受影响。',
            );
        }
    } catch (error) {
        console.warn('[MVU Auto Doctor] 无法关闭故事神谕 AUTO：', error);
    }
}

function resolveMessageId(value) {
    if (value == null) return -1;
    if (Number.isInteger(Number(value))) return Number(value);
    const candidates = [
        value?.messageId,
        value?.message_id,
        value?.id,
        value?.index,
    ];
    const hit = candidates.find((item) => Number.isInteger(Number(item)));
    return hit === undefined ? -1 : Number(hit);
}

function latestAiMessage(context) {
    const chat = context?.chat || [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
        const message = chat[index];
        if (
            message
            && !message.is_user
            && !message.is_system
            && typeof message.mes === 'string'
            && message.mes.trim()
        ) {
            return { index, message };
        }
    }
    return { index: -1, message: null };
}

function captureTarget(context, index) {
    const message = context?.chat?.[index];
    if (!message || message.is_user || message.is_system || !message.mes?.trim()) {
        return null;
    }
    return {
        chatId: context.chatId,
        index,
        messageId: ensureMessageStableId(context, message, index),
        swipeId: Number(message.swipe_id) || 0,
        fingerprint: fingerprint(message.mes),
        epoch: operationEpoch,
        generationSerial,
        generationType: lastGeneration.type || 'normal',
    };
}

function targetIsCurrent(captured, token = null, { requireLatest = true } = {}) {
    const context = getContext();
    if (token && !operationIsCurrent(token)) {
        return { ok: false, reason: '任务已被新的生成或聊天切换作废' };
    }
    if (!captured || !context || context.chatId !== captured.chatId) {
        return { ok: false, reason: '聊天已经切换' };
    }
    const latest = latestAiMessage(context);
    if (requireLatest && latest.index !== captured.index) {
        return { ok: false, reason: '主聊天已经出现更新的 AI 回复' };
    }
    const message = context.chat[captured.index];
    if (!message) return { ok: false, reason: '目标回复已不存在' };
    if (String(ensureMessageStableId(context, message, captured.index)) !== captured.messageId) {
        return { ok: false, reason: '目标楼层身份已经变化' };
    }
    if ((Number(message.swipe_id) || 0) !== captured.swipeId) {
        return { ok: false, reason: '目标回复已经切换 swipe' };
    }
    if (fingerprint(message.mes) !== captured.fingerprint) {
        return { ok: false, reason: '目标回复正文已经变化' };
    }
    return { ok: true, reason: '' };
}

function sourceRefOf(captured) {
    if (!captured) return null;
    return {
        chatId: captured.chatId,
        messageId: captured.messageId,
        index: captured.index,
        swipeId: captured.swipeId,
        hash: captured.fingerprint,
    };
}

function stripMechanism(text) {
    return String(text || '')
        .replace(/<UpdateVariable\b[\s\S]*?<\/UpdateVariable>/giu, '')
        .replace(/<UpdateVariable\b[\s\S]*$/iu, '')
        .split(STATUS_PLACEHOLDER)
        .join('')
        .trim();
}

function recentTranscript(context, targetIndex, limit) {
    const chat = context?.chat || [];
    return chat
        .slice(0, targetIndex)
        .filter((message) => message && !message.is_system && typeof message.mes === 'string')
        .slice(-Math.max(0, Number(limit) || 0))
        .map((message) => {
            const role = message.is_user ? '用户' : 'AI';
            return `${role}：${stripMechanism(message.mes)}`;
        })
        .join('\n\n');
}

function safeJson(value, indent = 2) {
    try {
        return JSON.stringify(value, null, indent);
    } catch {
        return String(value);
    }
}

function cropText(text, limit, label) {
    const source = String(text || '');
    if (source.length <= limit) return source;
    const head = Math.floor(limit * 0.58);
    const tail = limit - head;
    return [
        source.slice(0, head),
        `\n\n……【${label}过长，中间已省略 ${source.length - limit} 字】……\n\n`,
        source.slice(-tail),
    ].join('');
}

function flattenStateForPrompt(value, maxLeaves = 5000) {
    const result = {};
    let count = 0;
    let omitted = 0;

    function walk(current, parts) {
        if (count >= maxLeaves) {
            omitted += 1;
            return;
        }
        if (Array.isArray(current)) {
            if (!current.length) {
                result['/' + parts.join('/')] = [];
                count += 1;
                return;
            }
            current.forEach((item, index) => walk(item, [...parts, String(index)]));
            return;
        }
        if (isPlainObject(current)) {
            const entries = Object.entries(current);
            if (!entries.length) {
                result['/' + parts.join('/')] = {};
                count += 1;
                return;
            }
            entries.forEach(([key, item]) => {
                const escaped = key.replace(/~/gu, '~0').replace(/\//gu, '~1');
                walk(item, [...parts, escaped]);
            });
            return;
        }
        result['/' + parts.join('/')] = current;
        count += 1;
    }

    walk(value, []);
    return { paths: result, omitted };
}

function stateForPrompt(stat) {
    const full = safeJson(stat);
    if (full.length <= 160000) return full;
    const flat = flattenStateForPrompt(stat);
    return [
        '状态过大，以下改用“JSON Pointer 路径 -> 当前值”的等价扁平表示：',
        safeJson(flat.paths),
        flat.omitted ? `另有 ${flat.omitted} 个末端值因上下文上限省略。` : '',
    ].filter(Boolean).join('\n');
}

function observedDiff(previousData, currentData) {
    const previous = statDataOf(previousData);
    const current = statDataOf(currentData);
    if (!previous || !current) return '无法读取上一楼层状态；请以当前状态和正文为准。';
    const result = diffStates(previous, current);
    if (!result.changes.length) return '未检测到上一状态与当前状态的差异。';
    return [
        safeJson(result.changes),
        result.omitted ? `另有 ${result.omitted} 项差异未展开。` : '',
    ].filter(Boolean).join('\n');
}

async function mvuDataAt(Mvu, messageId) {
    if (typeof Mvu?.getMvuData !== 'function') return null;
    try {
        return await Promise.resolve(Mvu.getMvuData({
            type: 'message',
            message_id: messageId,
        }));
    } catch {
        return null;
    }
}

async function waitMvuStable(Mvu, capMs = 8000, intervalMs = 250, stableReads = 3) {
    const started = Date.now();
    let previous = '';
    let repeats = 0;
    while (Date.now() - started < capMs) {
        const data = await mvuDataAt(Mvu, 'latest');
        const current = fingerprint(safeJson(statDataOf(data), 0));
        if (current && current === previous) {
            repeats += 1;
            if (repeats >= stableReads) return true;
        } else {
            previous = current;
            repeats = 0;
        }
        await sleep(intervalMs);
    }
    return false;
}

async function previousMvuData(Mvu, context, targetIndex) {
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
        const message = context.chat[index];
        if (!message || message.is_user || message.is_system) continue;
        const data = await mvuDataAt(Mvu, index);
        if (data) return data;
    }
    return null;
}

async function buildAuditMessages({
    context,
    character,
    targetIndex,
    currentData,
    previousData,
    retry,
}) {
    const settings = getSettings();
    const message = context.chat[targetIndex];
    const originalBlock = extractLastUpdateBlock(message.mes);
    const schemas = extractSchemaScripts(character)
        .map((script) => `【${script.name}】\n${script.content}`)
        .join('\n\n');
    const rules = (await collectMvuRules(context, character)).join('\n\n');
    const transcript = recentTranscript(
        context,
        targetIndex,
        settings.contextMessages,
    );
    const currentStat = statDataOf(currentData);

    const system = [
        '你是一个通用、保守、可验证的 MVU 状态审计与修复引擎。',
        '你面对的是任意角色卡；绝不能套用其他卡的字段、路径、枚举或经验。',
        '',
        '【权威顺序】',
        '1. 当前角色卡的 MVU/Zod Schema。',
        '2. 当前启用世界书中的 [mvu_update] 更新规则和输出格式。',
        '3. 当前 stat_data 的真实结构与现值。',
        '三者冲突时优先遵守更严格、能被 Schema 接受的约束；不确定就不改。',
        '',
        '【审计语义】',
        '- 当前 stat_data 已经包含角色卡原本更新区块实际造成的结果。',
        '- “本回合已观察到的状态差异”只是证据，不等于都要再次更新。',
        '- 只输出叠加在当前 stat_data 上的纠错/补漏；已正确落地的变化绝不能重复，尤其不能重复 delta。',
        '- 根据最新 AI 回复正文判断本回合明确发生了什么。不得根据可能性、计划、比喻或未发生的动作改变量。',
        '- 对规则标为派生/只读/自动计算的字段，不要写入。',
        '- replace、delta、remove 只能用于当前已存在路径。',
        '- insert 只能用于父路径已存在、目标尚不存在的新键或合法数组位置。',
        '- move 必须使用 from 和 to。',
        '- 对象必须满足本卡 Schema 的字段名、类型、必填项与枚举；不要创造同义字段。',
        '- 若卡的规则要求更新到叶子字段，必须拆成叶子路径，禁止整体覆盖复杂节点。',
        '- 路径使用 JSON Pointer，键名中的 ~ 和 / 必须分别写成 ~0 和 ~1。',
        '- 不要修改任何路径段以“_”开头的只读字段。',
        '',
        '【唯一允许的输出】',
        '<UpdateVariable>',
        '<Analysis>不超过80字，禁止在这里写任何机制标签字面量</Analysis>',
        '<JSONPatch>',
        '[合法操作对象；没有需要修复时必须是 []]',
        '</JSONPatch>',
        '</UpdateVariable>',
        '不要输出代码围栏、解释、前言或尾注。',
    ].join('\n');

    const user = [
        '=== 当前角色卡 MVU/Zod Schema ===',
        cropText(schemas || '角色卡未暴露 Schema；只能依据规则与当前状态保守处理。', 70000, 'Schema'),
        '',
        '=== 当前启用的 MVU 更新规则 ===',
        cropText(rules || '未找到 [mvu_update] 规则；只能依据 Schema 与当前状态保守处理。', 70000, '规则'),
        '',
        '=== 当前 stat_data（原更新应用之后）===',
        stateForPrompt(currentStat),
        '',
        '=== 本回合已观察到的状态差异（上一 AI 楼层 -> 当前）===',
        observedDiff(previousData, currentData),
        '',
        '=== 最近剧情上下文（只读）===',
        cropText(transcript || '无', 36000, '剧情上下文'),
        '',
        '=== 本轮要审计的最新 AI 回复正文 ===',
        cropText(stripMechanism(message.mes), 60000, '最新回复'),
        '',
        '=== 该回复原有的变量更新区块 ===',
        cropText(originalBlock || '（没有；需要依据正文补出遗漏更新）', 36000, '原更新区块'),
        '',
        retry
            ? [
                '=== 上一次候选补丁被本地校验拒绝 ===',
                `失败原因：${retry.reason}`,
                retry.details?.length
                    ? `未落地明细：${cropText(safeJson(retry.details), 12000, '拒绝明细')}`
                    : '',
                retry.output
                    ? `上一次模型输出：\n${cropText(retry.output, 18000, '上次输出')}`
                    : '',
                '当前真实状态没有保留这次失败候选的任何修改。请重新核对路径、操作类型、Schema 字段和枚举，只返回修正后的区块。',
            ].filter(Boolean).join('\n')
            : '请审计错更、漏更和无效更新；若当前状态已经准确反映正文，输出空数组。',
    ].join('\n');

    return {
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
        originalBlock,
    };
}

async function withTimeout(promise, milliseconds, label) {
    const timeout = Math.max(10000, Number(milliseconds) || 120000);
    let timer;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`${label || '模型请求'}超时（${timeout}ms）`)),
                    timeout,
                );
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async function callModel(messages, options = {}) {
    const settings = getSettings();
    disableStoryOracleAutoIfNeeded();
    const maxTokens = Math.max(
        1024,
        Number(options.maxTokens ?? settings.maxTokens) || 4096,
    );
    const timeoutMs = Math.max(10000, Number(settings.modelTimeoutMs) || 120000);

    if (settings.preferStoryOracle) {
        const api = window.StoryOracleAPI;
        if (api?.isCompatible?.(1) && typeof api.run === 'function') {
            try {
                const output = await withTimeout(
                    api.run(messages, { stream: false, maxTokens }),
                    timeoutMs,
                    '故事神谕连接',
                );
                if (String(output || '').trim()) return String(output);
            } catch (error) {
                console.warn('[MVU Auto Doctor] 故事神谕连接调用失败，改用酒馆当前连接。', error);
            }
        }
    }

    const context = getContext();
    if (typeof context?.generateRaw !== 'function') {
        throw new Error('故事神谕连接和酒馆当前连接都不可用');
    }
    return await withTimeout(
        context.generateRaw({
            systemPrompt: messages[0].content,
            prompt: messages[1].content,
            responseLength: maxTokens,
            trimNames: false,
        }),
        timeoutMs,
        '酒馆当前连接',
    );
}

async function parseCandidate(Mvu, oldData, output) {
    const block = extractLastUpdateBlock(output);
    if (!block) {
        return {
            status: 'failed',
            retryable: true,
            reason: '模型没有返回完整的 <UpdateVariable> 区块',
            output,
        };
    }
    const prepared = preparePatch(block, oldData);
    if (prepared.error) {
        return {
            status: 'failed',
            retryable: true,
            reason: prepared.error,
            output,
            block,
        };
    }
    if (!prepared.ops.length) {
        return {
            status: 'nochange',
            retryable: false,
            block: prepared.block,
            output,
        };
    }

    let parsed;
    try {
        parsed = await Mvu.parseMessage(prepared.block, deepClone(oldData));
    } catch (error) {
        return {
            status: 'failed',
            retryable: true,
            reason: `MVU 解析候选补丁失败：${error.message || error}`,
            output,
            block: prepared.block,
        };
    }
    const checked = validatePatchResult(oldData, parsed, prepared);
    if (!checked.ok) {
        return {
            status: checked.nochange ? 'nochange' : 'failed',
            retryable: !checked.nochange,
            reason: checked.reason,
            details: checked.details,
            output,
            block: prepared.block,
        };
    }
    return {
        status: 'ready',
        retryable: false,
        output,
        block: prepared.block,
        prepared,
        newData: parsed,
    };
}

function applyBlockToCurrentSwipe(message, block, includeBlock, removeBlock = '') {
    if (!message || typeof message.mes !== 'string') return false;
    const before = message.mes;
    let content = message.mes.split(STATUS_PLACEHOLDER).join('').trimEnd();
    if (removeBlock && content.includes(removeBlock)) {
        content = content
            .replace(removeBlock, '')
            .replace(/\n{3,}/gu, '\n\n')
            .trimEnd();
    }
    if (includeBlock && block && !content.includes(block)) {
        content = `${content}\n\n${block}`.trim();
    }
    message.mes = `${content}\n\n${STATUS_PLACEHOLDER}`.trim();
    if (
        Array.isArray(message.swipes)
        && typeof message.swipes[message.swipe_id] === 'string'
    ) {
        message.swipes[message.swipe_id] = message.mes;
    }
    if (message.extra && typeof message.extra === 'object') {
        delete message.extra.display_text;
    }
    return message.mes !== before;
}

async function refreshMessage(
    index,
    block = '',
    includeBlock = false,
    removeBlock = '',
    captured = null,
    token = null,
) {
    if (captured) {
        const guard = targetIsCurrent(captured, token, { requireLatest: false });
        if (!guard.ok) return false;
    }
    const context = getContext();
    const message = context?.chat?.[index];
    if (!message) return false;
    const changed = applyBlockToCurrentSwipe(
        message,
        block,
        includeBlock,
        removeBlock,
    );
    const postMutationTarget = captured && changed
        ? { ...captured, fingerprint: fingerprint(message.mes) }
        : captured;
    if (changed) {
        if (captured) {
            const guard = targetIsCurrent(postMutationTarget, token, { requireLatest: false });
            if (!guard.ok) return false;
        }
        try {
            await context.saveChat?.();
        } catch (error) {
            console.warn('[MVU Auto Doctor] 保存更新区块失败：', error);
        }
    }
    if (captured) {
        const guard = targetIsCurrent(postMutationTarget, token, { requireLatest: false });
        if (!guard.ok) return false;
    }
    try {
        context.updateMessageBlock?.(index, message);
    } catch (error) {
        console.warn('[MVU Auto Doctor] 重绘消息失败：', error);
    }
    try {
        const eventName = context.eventTypes?.MESSAGE_UPDATED
            || context.event_types?.MESSAGE_UPDATED
            || 'message_updated';
        await Promise.resolve(context.eventSource?.emit?.(eventName, index));
    } catch (error) {
        console.warn('[MVU Auto Doctor] 触发前端刷新失败：', error);
    }
    return true;
}

async function persistRepairRecord(record, expectedChatId) {
    let namespace = readChatNamespace();
    namespace = appendRepairJournal(namespace, record, {
        maxEntries: 5,
        maxSnapshotChars: 180000,
    });
    const saved = await writeChatNamespace(namespace, expectedChatId);
    if (saved) lastUndo = latestUndoRecord(namespace);
    return saved;
}

async function commitCandidate(Mvu, candidate, captured, token) {
    let current = targetIsCurrent(captured, token);
    if (!current.ok) {
        return { status: 'stale', reason: `${current.reason}，未写入` };
    }
    const options = { type: 'message', message_id: captured.index };
    const oldData = await mvuDataAt(Mvu, captured.index);
    if (!oldData) return { status: 'failed', reason: '提交前无法读取当前 MVU 状态' };
    current = targetIsCurrent(captured, token);
    if (!current.ok) return { status: 'stale', reason: `${current.reason}，未写入` };

    const reparsed = await Mvu.parseMessage(candidate.block, deepClone(oldData));
    current = targetIsCurrent(captured, token);
    if (!current.ok) return { status: 'stale', reason: `${current.reason}，未写入` };
    const rechecked = validatePatchResult(oldData, reparsed, candidate.prepared);
    if (!rechecked.ok) {
        return {
            status: rechecked.nochange ? 'nochange' : 'failed',
            reason: rechecked.reason,
            details: rechecked.details,
        };
    }

    const snapshot = deepClone(oldData);
    // Final write barrier. No await is allowed between this guard and the
    // mutation call; every earlier asynchronous boundary has already rechecked.
    current = targetIsCurrent(captured, token);
    if (!current.ok) return { status: 'stale', reason: `${current.reason}，未写入` };
    await Mvu.replaceMvuData(reparsed, options);
    current = targetIsCurrent(captured, token);
    if (!current.ok) {
        return {
            status: 'stale',
            reason: `${current.reason}；精确楼层写入已结束，但未再读取或改动当前新目标`,
        };
    }
    const landed = await mvuDataAt(Mvu, captured.index);
    const verified = validatePatchResult(oldData, landed, candidate.prepared);
    if (!verified.ok) {
        const rollbackGuard = targetIsCurrent(captured, token, { requireLatest: false });
        if (rollbackGuard.ok) {
            try {
                await Mvu.replaceMvuData(snapshot, options);
            } catch (rollbackError) {
                console.error('[MVU Auto Doctor] 回滚失败：', rollbackError);
            }
        }
        await refreshMessage(captured.index, '', false, '', captured, token);
        return {
            status: 'failed',
            reason: `写入后回读校验失败${rollbackGuard.ok ? '，已回滚' : '；目标已变化，未对新目标执行回滚'}：${verified.reason}`,
            details: verified.details,
        };
    }

    const afterFingerprint = fingerprint(safeJson(landed, 0));
    const record = {
        id: `repair_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        status: 'applied',
        chatId: captured.chatId,
        targetIndex: captured.index,
        messageId: captured.messageId,
        swipeId: captured.swipeId,
        messageFingerprint: captured.fingerprint,
        generationType: captured.generationType,
        beforeFingerprint: fingerprint(safeJson(snapshot, 0)),
        afterFingerprint,
        snapshot,
        block: candidate.block,
    };
    // Always persist the corrective block in the swipe. Updating only the
    // in-memory MVU snapshot is not durable: a reload/reparse would otherwise
    // replay the original faulty block and silently resurrect the error.
    const refreshed = await refreshMessage(
        captured.index,
        candidate.block,
        true,
        '',
        captured,
        token,
    );
    if (!refreshed) {
        return { status: 'stale', reason: '变量已写入，但目标在刷新前发生变化；未改动新回复' };
    }
    await persistRepairRecord(record, captured.chatId);
    lastUndo = record;
    return { status: 'applied', block: candidate.block };
}

async function ensureExistingFrontend(index, originalBlock, captured, token) {
    if (!originalBlock) return;
    await refreshMessage(index, '', false, '', captured, token);
}

async function runTarget(targetId, { manual = false, queuedTarget = null } = {}) {
    const settings = getSettings();
    if (!manual && !settings.enabled) return { status: 'disabled' };
    disableStoryOracleAutoIfNeeded();

    const initialContext = getContext();
    const initialLatest = latestAiMessage(initialContext);
    const initialResolved = targetId == null || targetId < 0
        ? initialLatest.index
        : targetId;
    const captured = queuedTarget || captureTarget(initialContext, initialResolved);
    if (!captured) return { status: 'stale', reason: '目标回复不可用' };
    const token = operationToken(captured);

    const Mvu = await getMvu();
    let targetCheck = targetIsCurrent(captured, token);
    if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
    if (
        !Mvu
        || typeof Mvu.getMvuData !== 'function'
        || typeof Mvu.parseMessage !== 'function'
        || typeof Mvu.replaceMvuData !== 'function'
    ) {
        const result = { status: 'failed', reason: '未检测到完整的 MVU API' };
        setStatus(result.reason, 'error');
        if (manual) toast('warning', result.reason);
        return result;
    }

    if (!manual) await sleep(Math.max(300, Number(settings.delayMs) || 1600));
    targetCheck = targetIsCurrent(captured, token);
    if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
    await waitMvuIdle(Mvu);
    targetCheck = targetIsCurrent(captured, token);
    if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
    await waitMvuStable(Mvu);
    targetCheck = targetIsCurrent(captured, token);
    if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };

    const context = getContext();
    const latest = latestAiMessage(context);
    const resolved = captured.index;
    if (resolved !== latest.index) {
        return { status: 'stale', reason: '目标回复已不是最新 AI 楼层' };
    }

    const character = currentCharacter(context);
    const currentData = await mvuDataAt(Mvu, resolved);
    targetCheck = targetIsCurrent(captured, token);
    if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
    if (!currentData || !statDataOf(currentData)) {
        const result = { status: 'failed', reason: '最新楼层没有可读取的 stat_data' };
        setStatus(result.reason, 'error');
        if (manual) toast('warning', result.reason);
        return result;
    }
    const previousData = await previousMvuData(Mvu, context, resolved);
    targetCheck = targetIsCurrent(captured, token);
    if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
    setStatus('正在核对最新回复与变量…', 'busy');

    let retry = null;
    let candidate = null;
    let originalBlock = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
        targetCheck = targetIsCurrent(captured, token);
        if (!targetCheck.ok) {
            return { status: 'stale', reason: targetCheck.reason };
        }

        const built = await buildAuditMessages({
            context,
            character,
            targetIndex: resolved,
            currentData,
            previousData,
            retry,
        });
        targetCheck = targetIsCurrent(captured, token);
        if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
        originalBlock = built.originalBlock;

        let output;
        try {
            output = await callModel(built.messages);
        } catch (error) {
            candidate = {
                status: 'failed',
                retryable: attempt === 0,
                reason: `模型调用失败：${error.message || error}`,
                output: '',
            };
        }
        targetCheck = targetIsCurrent(captured, token);
        if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
        if (output !== undefined) candidate = await parseCandidate(Mvu, currentData, output);
        targetCheck = targetIsCurrent(captured, token);
        if (!targetCheck.ok) return { status: 'stale', reason: targetCheck.reason };
        if (candidate.status !== 'failed' || !candidate.retryable || attempt === 1) break;
        retry = candidate;
        setStatus('首个补丁未通过校验，正在自动重试…', 'busy');
    }

    if (candidate?.status === 'nochange') {
        await ensureExistingFrontend(resolved, originalBlock, captured, token);
        setStatus('已检查：本回合变量无需修正', 'ok');
        if (manual || settings.notifyNoChange) toast('info', '已检查，本回合变量无需修正。');
        return candidate;
    }
    if (candidate?.status !== 'ready') {
        const reason = candidate?.reason || '没有得到可安全应用的补丁';
        setStatus(`已跳过：${reason}`, 'error');
        toast('warning', `未改动变量。\n${reason}`);
        return candidate || { status: 'failed', reason };
    }

    let result;
    try {
        result = await commitCandidate(Mvu, candidate, captured, token);
    } catch (error) {
        result = { status: 'failed', reason: `提交补丁失败：${error.message || error}` };
    }

    if (result.status === 'applied') {
        setStatus('已修正变量并刷新正文状态栏', 'ok');
        toast('success', '已根据最新回复补齐/修正 MVU 变量，并刷新正文状态栏。');
    } else if (result.status === 'nochange') {
        setStatus('提交前复核：变量已无需修正', 'ok');
    } else if (result.status === 'stale') {
        setStatus(`已跳过：${result.reason}`, '');
    } else {
        setStatus(`已跳过：${result.reason}`, 'error');
        toast('warning', `未改动变量。\n${result.reason}`);
    }
    return result;
}

function automaticTargetKey(targetId) {
    const context = getContext();
    const latest = latestAiMessage(context);
    const resolved = targetId == null || targetId < 0 ? latest.index : targetId;
    const message = context?.chat?.[resolved];
    if (!context || !message) return '';
    return [
        context.chatId,
        resolved,
        Number(message.swipe_id) || 0,
        fingerprint(message.mes),
    ].join(':');
}

function capturedTargetKey(captured) {
    if (!captured) return '';
    return [
        captured.chatId,
        captured.index,
        captured.messageId,
        captured.swipeId,
        captured.fingerprint,
    ].join(':');
}

function enqueue(targetId, options = {}) {
    const automatic = !options.manual;
    const context = getContext();
    const latest = latestAiMessage(context);
    const resolved = targetId == null || targetId < 0 ? latest.index : targetId;
    const queuedTarget = options.queuedTarget || captureTarget(context, resolved);
    const dedupeKey = automatic ? capturedTargetKey(queuedTarget) : '';
    if (
        dedupeKey
        && (
            automaticPendingKeys.has(dedupeKey)
            || automaticCompletedKeys.has(dedupeKey)
        )
    ) {
        return Promise.resolve({ status: 'duplicate', reason: '同一楼层已处理' });
    }
    if (dedupeKey) automaticPendingKeys.add(dedupeKey);
    const queuedOptions = { ...options, queuedTarget };

    runChain = runChain
        .catch(() => undefined)
        .then(() => runTarget(targetId, queuedOptions))
        .then((result) => {
            if (
                dedupeKey
                && ['applied', 'nochange'].includes(result?.status)
            ) {
                automaticCompletedKeys.add(dedupeKey);
                const landedKey = automaticTargetKey(targetId);
                if (landedKey) automaticCompletedKeys.add(landedKey);
            }
            return result;
        })
        .catch((error) => {
            console.error('[MVU Auto Doctor] 自动处理异常：', error);
            setStatus(`运行异常：${error.message || error}`, 'error');
            toast('warning', `运行异常，未改动变量：${error.message || error}`);
            return { status: 'failed', reason: String(error.message || error) };
        })
        .finally(() => {
            if (dedupeKey) automaticPendingKeys.delete(dedupeKey);
        });
    return runChain;
}

async function undoLast() {
    const context = getContext();
    const Mvu = await getMvu();
    const namespace = readChatNamespace(context);
    const record = lastUndo || latestUndoRecord(namespace);
    if (!record || !Mvu) {
        toast('info', '当前聊天还没有可撤销的自动修复。');
        return false;
    }
    const latest = latestAiMessage(context);
    if (
        context.chatId !== record.chatId
        || latest.index !== record.targetIndex
    ) {
        toast('warning', '聊天或最新楼层已经变化，为避免写错位置，不能撤销。');
        return false;
    }
    const currentTarget = captureTarget(context, record.targetIndex);
    if (
        !currentTarget
        || currentTarget.messageId !== record.messageId
        || currentTarget.swipeId !== record.swipeId
    ) {
        toast('warning', '目标回复或 swipe 已变化，不能撤销旧修复。');
        return false;
    }
    if (!record.snapshot) {
        toast('warning', '该次修复快照过大，未随聊天保存，当前无法撤销。');
        return false;
    }
    const currentData = await mvuDataAt(Mvu, record.targetIndex);
    if (
        record.afterFingerprint
        && fingerprint(safeJson(currentData, 0)) !== record.afterFingerprint
    ) {
        toast('warning', '变量在修复后又发生了变化，为避免覆盖后续进度，不能撤销。');
        return false;
    }
    const token = operationToken(currentTarget);
    const guard = targetIsCurrent(currentTarget, token);
    if (!guard.ok) {
        toast('warning', `${guard.reason}，不能撤销。`);
        return false;
    }
    await Mvu.replaceMvuData(deepClone(record.snapshot), {
        type: 'message',
        message_id: record.targetIndex,
    });
    const landed = await mvuDataAt(Mvu, record.targetIndex);
    if (fingerprint(safeJson(landed, 0)) !== record.beforeFingerprint) {
        toast('warning', '撤销后的回读校验失败，请不要继续操作并检查当前变量。');
        return false;
    }
    await refreshMessage(
        record.targetIndex,
        '',
        false,
        record.block,
        currentTarget,
        token,
    );
    const updatedNamespace = markRepairUndone(readChatNamespace(), record.id);
    await writeChatNamespace(updatedNamespace, record.chatId, { force: true });
    lastUndo = null;
    setStatus('已撤销上一次自动修复', 'ok');
    toast('success', '已撤销上一次自动修复。');
    return true;
}

function recentTranscriptThrough(context, targetIndex, limit) {
    const chat = context?.chat || [];
    return chat
        .slice(0, targetIndex + 1)
        .filter((message) => message && !message.is_system && typeof message.mes === 'string')
        .slice(-Math.max(1, Number(limit) || 12))
        .map((message) => `${message.is_user ? '用户' : 'AI'}：${stripMechanism(message.mes)}`)
        .join('\n\n');
}

function detectContinuityDirector(context, text, markers) {
    const settingKeys = Object.keys(context?.extensionSettings || {}).join(' ');
    const hasStitches = markers.hasStitches
        || /stitch|缝合怪/iu.test(settingKeys)
        || !!(window.Stitches || window.STITCHES || window.stitches);
    const hasPreset = markers.hasPresetParallel
        || /<Parallel_Event_Lifecycle>|<parallel_event_record\b/iu.test(text);
    const hasWorldEngine = !!window.WORLD_ENGINE || !!window.WORLD_ENGINE_CORE;
    if (hasStitches && (hasPreset || hasWorldEngine)) return 'mixed';
    if (hasStitches) return 'stitches';
    if (hasPreset || hasWorldEngine) return 'preset';
    return 'standalone';
}

function continuityFeatureActive(settings, markers, state, force = false) {
    if (force) return true;
    if (settings.continuityMode === 'off') return false;
    if (settings.continuityMode === 'on') return true;
    return !!(
        markers.hasPresetParallel
        || markers.hasStitches
        || state?.threads?.some((thread) => thread.stage !== 'resolved')
    );
}

async function activePresetHasContinuityPrompt() {
    if (Date.now() - presetContinuityCache.checkedAt < 15000) {
        return presetContinuityCache.active;
    }
    let active = false;
    try {
        const module = await import('/scripts/openai.js');
        const preset = module.oai_settings || {};
        const prompts = Array.isArray(preset.prompts) ? preset.prompts : [];
        const enabled = new Set();
        for (const group of Array.isArray(preset.prompt_order) ? preset.prompt_order : []) {
            for (const item of Array.isArray(group?.order) ? group.order : []) {
                if (item?.enabled && item.identifier) enabled.add(item.identifier);
            }
        }
        active = prompts.some((prompt) => (
            /<Parallel_Event_Lifecycle>|<parallel_event_record\b/iu.test(prompt?.content || '')
            && (!enabled.size || enabled.has(prompt.identifier))
        ));
    } catch {
        // Non-OpenAI backends or test harnesses may not expose this module.
    }
    presetContinuityCache = { checkedAt: Date.now(), active };
    return active;
}

function registerContinuityInjection(content) {
    const context = getContext();
    try {
        if (typeof context?.setExtensionPrompt === 'function') {
            context.setExtensionPrompt(
                CONTINUITY_INJECTION_NAME,
                content || '',
                IN_CHAT_POSITION,
                IN_CHAT_DEPTH,
                false,
                'system',
            );
            return true;
        }
        if (typeof context?.registerInjection === 'function') {
            context.unregisterInjection?.(CONTINUITY_INJECTION_NAME);
            if (content) {
                context.registerInjection(CONTINUITY_INJECTION_NAME, content, {
                    position: IN_CHAT_POSITION,
                    depth: IN_CHAT_DEPTH,
                    role: 'system',
                });
            }
            return true;
        }
        if (Array.isArray(context?.extensionPrompts)) {
            context.extensionPrompts = context.extensionPrompts
                .filter((item) => item?.name !== CONTINUITY_INJECTION_NAME);
            if (content) {
                context.extensionPrompts.push({
                    name: CONTINUITY_INJECTION_NAME,
                    content,
                    role: 'system',
                    position: IN_CHAT_POSITION,
                    depth: IN_CHAT_DEPTH,
                });
            }
            return true;
        }
    } catch (error) {
        console.warn('[MVU Auto Doctor] 支线账本注入失败：', error);
    }
    return false;
}

function continuityStateForInjection(namespace, { isReroll = false } = {}) {
    const context = getContext();
    const latest = latestAiMessage(context);
    const latestId = latest.message
        ? ensureMessageStableId(context, latest.message, latest.index)
        : '';
    if (
        isReroll
        && namespace?.continuityCheckpoint?.state
        && namespace.continuityCheckpoint.targetIndex === latest.index
        && namespace.continuityCheckpoint.messageId === latestId
    ) {
        return namespace.continuityCheckpoint.state;
    }
    return namespace?.continuity;
}

function applyContinuityInjection({ isReroll = false } = {}) {
    const settings = getSettings();
    if (settings.continuityMode === 'off') {
        registerContinuityInjection('');
        return false;
    }
    const namespace = readChatNamespace();
    const state = normalizeContinuityState(
        continuityStateForInjection(namespace, { isReroll }),
        {
            chatId: getContext()?.chatId || '',
            maxThreads: settings.continuityMaxThreads,
        },
    );
    let content = buildContinuityInjection(state, {
        director: namespace.continuityDirector || 'standalone',
        maxVisible: settings.continuityMaxVisible,
    });
    if (
        !content
        && (settings.continuityMode === 'on' || namespace.continuityDetected === true)
    ) {
        content = [
            '<Parallel_Continuity_Bridge>',
            '当前没有未结支线。不要为了完成指标硬造剧情。',
            '若本回合已有离场角色的明确意图、敌方计划、未兑现约定、异常物证或主线后果，可依当前预设/缝合怪原格式建立至多一条支线；必须来自已出场人物与既有事实。',
            '只能推动NPC与世界；禁止替玩家角色行动、回答、移动、消费资源或追加检定。',
            '</Parallel_Continuity_Bridge>',
        ].join('\n');
    }
    registerContinuityInjection(content);
    const active = state.threads.filter((thread) => thread.stage !== 'resolved').length;
    setContinuityStatus(
        active
            ? `支线连续性：${active} 条未结${isReroll ? '（已使用重抽前存档点）' : ''}`
            : '支线连续性：等待事件',
        active ? 'ok' : '',
    );
    return !!content;
}

function continuityBase(namespace, captured) {
    const checkpoint = namespace?.continuityCheckpoint;
    const isReroll = ['swipe', 'regenerate'].includes(captured?.generationType);
    if (
        isReroll
        && checkpoint?.state
        && checkpoint.targetIndex === captured.index
        && checkpoint.messageId === captured.messageId
    ) {
        return normalizeContinuityState(checkpoint.state, {
            chatId: captured.chatId,
            maxThreads: getSettings().continuityMaxThreads,
        });
    }
    return normalizeContinuityState(namespace?.continuity, {
        chatId: captured.chatId,
        maxThreads: getSettings().continuityMaxThreads,
    });
}

function preserveMissingThreads(previous, next, maximum) {
    const present = new Set((next.threads || []).map((thread) => thread.id));
    for (const thread of previous.threads || []) {
        if (present.has(thread.id)) continue;
        next.threads.push(deepClone(thread));
        present.add(thread.id);
        if (next.threads.length >= maximum) break;
    }
    return next;
}

function buildContinuityMessages({
    context,
    captured,
    base,
    director,
    markers,
}) {
    const settings = getSettings();
    const bridgeOnly = director !== 'standalone';
    const system = [
        '你是一个通用的跑团支线连续性记账与调度引擎。你不写主回复，只维护结构化支线账本。',
        '你必须服从当前角色卡与已发生正文，不得套用别的角色卡设定。',
        '',
        '【职责边界】',
        '- MVU仍是数值、资源、任务状态的唯一实时权威；不得输出或修改MVU、JSONPatch、数据库或SQL。',
        '- 只推动NPC、势力、环境、敌方、约定、谜团和离场角色，不得替玩家角色决定、说话、移动、消费资源或追加检定。',
        '- 每回合最多推进一条未结支线。已有支线优先，禁止为同一因果另造同义ID。',
        '- 区分hidden、rumor、observed。隐藏事实不能令不知情角色全知，必须经过观察、传播、调查或后果显现。',
        '- 计划、建议、选项、传闻和未来可能性不是已发生事实。',
        '- 已完成的支线标记resolved，不要删除；暂时无接口可标记dormant。',
        bridgeOnly
            ? '- 已检测到预设平行事件或缝合怪：它们保留剧情提案权。只有在本回合正文已经出现明确的未决意图、敌方计划、约定、异常线索或离场角色行动时，才可把该既有事实登记为至多一条seeded支线；不得补造幕后真相或无来源阴谋。你的任务是接续、去重、安排下一拍。'
            : '- 未检测到外部剧情推进器：允许从已出场人物、既有势力、地点、任务、物件或已发生后果中建立至多一条新支线；不得凭空创造无接口阴谋。',
        '',
        '【stage枚举】seeded / advancing / manifested / resolved / dormant',
        '【kind枚举】parallel / personal / promise / enemy / mystery',
        '【knowledge枚举】hidden / rumor / observed',
        '只输出一个<ContinuityState>包裹的JSON对象；必须保留所有旧线程及稳定ID。',
    ].join('\n');
    const markerText = markers.taggedSections
        .map((item) => `<${item.tag}>${item.content}</${item.tag}>`)
        .join('\n');
    const user = [
        `当前导演模式：${director}`,
        `目标回复身份：chat=${captured.chatId} index=${captured.index} swipe=${captured.swipeId}`,
        '',
        '=== 更新前支线账本 ===',
        safeJson(base),
        '',
        '=== 本回合可识别的预设/缝合怪记录 ===',
        markerText || '无结构化记录；只能依据正文中的明确事实更新。',
        '',
        '=== 最近剧情（含本轮回复）===',
        cropText(
            recentTranscriptThrough(
                context,
                captured.index,
                settings.continuityContextMessages,
            ),
            52000,
            '支线剧情上下文',
        ),
        '',
        '输出格式：',
        '<ContinuityState>',
        '{',
        '  "turn": 1,',
        '  "threads": [{',
        '    "id": "稳定ID", "title": "短标题", "kind": "parallel",',
        '    "stage": "seeded", "summary": "目前已成立的事实",',
        '    "nextBeat": "下次自然推进的一拍", "trigger": "可验证触发条件",',
        '    "actors": [], "locations": [], "knowledge": "hidden",',
        '    "urgency": 1, "lastAdvancedTurn": 1',
        '  }]',
        '}',
        '</ContinuityState>',
    ].join('\n');
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runContinuityTarget(captured, { force = false } = {}) {
    const token = operationToken(captured);
    let guard = targetIsCurrent(captured, token);
    if (!guard.ok) return { status: 'stale', reason: guard.reason };
    const settings = getSettings();
    const context = getContext();
    const message = context.chat[captured.index];
    const messageText = String(message?.mes || '');
    const markers = extractContinuityMarkers(messageText);
    if (settings.continuityMode === 'auto' && !markers.hasPresetParallel) {
        markers.hasPresetParallel = await activePresetHasContinuityPrompt();
        guard = targetIsCurrent(captured, token);
        if (!guard.ok) return { status: 'stale', reason: guard.reason };
    }
    let namespace = readChatNamespace(context);
    const checkpointBase = continuityBase(namespace, captured);
    let base = checkpointBase;
    base = mergeMarkerRecords(base, markers.records, {
        chatId: captured.chatId,
        maxThreads: settings.continuityMaxThreads,
    });
    if (!continuityFeatureActive(settings, markers, base, force)) {
        applyContinuityInjection();
        return { status: 'disabled' };
    }
    const director = detectContinuityDirector(context, messageText, markers);
    setContinuityStatus('支线连续性：正在整理因果…', 'busy');

    const messages = buildContinuityMessages({
        context,
        captured,
        base,
        director,
        markers,
    });
    let output = '';
    try {
        output = await callModel(messages, { maxTokens: settings.continuityMaxTokens });
    } catch (error) {
        console.warn('[MVU Auto Doctor] 支线连续性模型调用失败：', error);
    }
    guard = targetIsCurrent(captured, token);
    if (!guard.ok) return { status: 'stale', reason: guard.reason };

    let next = base;
    if (output) {
        const parsed = parseContinuityOutput(output, {
            chatId: captured.chatId,
            maxThreads: settings.continuityMaxThreads,
        });
        if (parsed.state) next = parsed.state;
        else console.warn('[MVU Auto Doctor] 支线账本输出未通过解析：', parsed.error);
    }
    next = preserveMissingThreads(base, next, settings.continuityMaxThreads);
    next.turn = Math.max(base.turn + 1, Number(next.turn) || 0);
    next.updatedAt = Date.now();
    next = attachChangedSourceRefs(base, next, sourceRefOf(captured));
    next = normalizeContinuityState(next, {
        chatId: captured.chatId,
        maxThreads: settings.continuityMaxThreads,
    });

    guard = targetIsCurrent(captured, token);
    if (!guard.ok) return { status: 'stale', reason: guard.reason };
    const isReroll = ['swipe', 'regenerate'].includes(captured.generationType);
    const oldDigest = continuityContentDigest(namespace.continuity);
    const newDigest = continuityContentDigest(next);
    namespace.continuity = next;
    namespace.continuityDirector = director;
    namespace.continuityDetected = true;
    if (!isReroll) {
        namespace.continuityCheckpoint = {
            targetIndex: captured.index,
            messageId: captured.messageId,
            swipeId: captured.swipeId,
            state: checkpointBase,
        };
    }
    if (oldDigest !== newDigest || isReroll) {
        await writeChatNamespace(namespace, captured.chatId);
    }
    guard = targetIsCurrent(captured, token);
    if (!guard.ok) return { status: 'stale', reason: guard.reason };
    applyContinuityInjection();
    const active = next.threads.filter((thread) => thread.stage !== 'resolved').length;
    setContinuityStatus(`支线连续性：已记录 ${active} 条未结支线`, 'ok');
    return { status: 'applied', active, director };
}

function sameTargetExceptContent(left, right) {
    return !!(
        left
        && right
        && left.chatId === right.chatId
        && left.index === right.index
        && left.messageId === right.messageId
        && left.swipeId === right.swipeId
        && left.epoch === operationEpoch
    );
}

function enqueueContinuity(targetId, {
    after = Promise.resolve(),
    force = false,
    expectedTarget = null,
} = {}) {
    const context = getContext();
    const latest = latestAiMessage(context);
    const resolved = targetId == null || targetId < 0 ? latest.index : targetId;
    const expected = expectedTarget || captureTarget(context, resolved);
    const dedupeKey = capturedTargetKey(expected);
    if (
        !force
        && dedupeKey
        && (continuityPendingKeys.has(dedupeKey) || continuityCompletedKeys.has(dedupeKey))
    ) {
        return Promise.resolve({ status: 'duplicate' });
    }
    if (dedupeKey) continuityPendingKeys.add(dedupeKey);

    continuityChain = continuityChain
        .catch(() => undefined)
        .then(() => after.catch?.(() => undefined) ?? after)
        .then(() => {
            if (!expected || expected.epoch !== operationEpoch) {
                return { status: 'stale', reason: '任务已被新的生成作废' };
            }
            const freshContext = getContext();
            const fresh = captureTarget(freshContext, expected.index);
            if (!sameTargetExceptContent(expected, fresh)) {
                return { status: 'stale', reason: '目标回复身份已经变化' };
            }
            return runContinuityTarget(fresh, { force });
        })
        .then((result) => {
            if (dedupeKey && ['applied', 'disabled'].includes(result?.status)) {
                continuityCompletedKeys.add(dedupeKey);
            }
            return result;
        })
        .catch((error) => {
            console.error('[MVU Auto Doctor] 支线连续性处理异常：', error);
            setContinuityStatus(`支线连续性异常：${error.message || error}`, 'error');
            return { status: 'failed', reason: String(error.message || error) };
        })
        .finally(() => {
            if (dedupeKey) continuityPendingKeys.delete(dedupeKey);
        });
    return continuityChain;
}

async function clearContinuityState() {
    const context = getContext();
    if (!context?.chatId) return false;
    if (!window.confirm?.('只清空当前聊天的支线连续性账本？不会删除正文、MVU或数据库内容。')) {
        return false;
    }
    const namespace = readChatNamespace(context);
    namespace.continuity = emptyContinuityState(context.chatId);
    namespace.continuityCheckpoint = null;
    namespace.continuityDirector = 'standalone';
    await writeChatNamespace(namespace, context.chatId, { force: true });
    registerContinuityInjection('');
    setContinuityStatus('支线连续性：当前聊天账本已清空');
    return true;
}

function makeCheckbox(label, key) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'mvuad-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!settings[key];
    input.addEventListener('change', () => {
        getSettings()[key] = input.checked;
        saveSettings();
        if (key === 'preventDoubleWrite' && input.checked) {
            disableStoryOracleAutoIfNeeded();
        }
    });
    const span = document.createElement('span');
    span.textContent = label;
    row.append(input, span);
    return row;
}

function buildSettingsPanel() {
    if (document.querySelector('#mvu-auto-doctor-settings')) return;
    const host = document.querySelector('#extensions_settings2')
        || document.querySelector('#extensions_settings');
    if (!host) {
        setTimeout(buildSettingsPanel, 1200);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'mvu-auto-doctor-settings';
    wrapper.className = 'extension_container';
    wrapper.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>MVU 自动医生（通用）</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="mvuad-body">
                    <div class="mvuad-description">
                        每条 AI 回复后读取当前卡的 Schema、MVU 规则和实时状态；
                        只在补丁完整通过路径检查、MVU/Zod 解析和写后回读时提交。
                    </div>
                    <div class="mvuad-options"></div>
                    <label class="mvuad-number">
                        <span>回复后等待（毫秒）</span>
                        <input class="text_pole" type="number" min="300" max="10000" step="100">
                    </label>
                    <div class="mvuad-actions">
                        <button class="menu_button mvuad-run" type="button">检查最新回复</button>
                        <button class="menu_button mvuad-undo" type="button">撤销上次修复</button>
                    </div>
                    <div class="mvuad-status" role="status"></div>
                    <div class="mvuad-section-title">平行支线连续性</div>
                    <div class="mvuad-description">
                        复用预设的平行事件与缝合怪记录，给支线建立稳定账本并注入下一回合；
                        不替玩家行动，不写MVU或数据库。
                    </div>
                    <label class="mvuad-select">
                        <span>运行模式</span>
                        <select class="text_pole mvuad-continuity-mode">
                            <option value="auto">自动兼容（推荐）</option>
                            <option value="on">始终开启</option>
                            <option value="off">关闭</option>
                        </select>
                    </label>
                    <div class="mvuad-actions">
                        <button class="menu_button mvuad-continuity-run" type="button">立即整理支线</button>
                        <button class="menu_button mvuad-continuity-clear" type="button">清空当前账本</button>
                    </div>
                    <div class="mvuad-status mvuad-continuity-status" role="status"></div>
                    <div class="mvuad-version">v${VERSION} · 独立安装，不修改角色卡或故事神谕文件</div>
                </div>
            </div>
        </div>`;
    host.appendChild(wrapper);

    const options = wrapper.querySelector('.mvuad-options');
    options.append(
        makeCheckbox('自动检查每条新回复', 'enabled'),
        makeCheckbox('优先复用故事神谕的模型连接', 'preferStoryOracle'),
        makeCheckbox('自动关闭故事神谕 AUTO，避免双写', 'preventDoubleWrite'),
        makeCheckbox('无需修正时也弹提示', 'notifyNoChange'),
    );
    const delay = wrapper.querySelector('.mvuad-number input');
    delay.value = String(getSettings().delayMs);
    delay.addEventListener('change', () => {
        getSettings().delayMs = Math.min(
            10000,
            Math.max(300, Number(delay.value) || 1600),
        );
        delay.value = String(getSettings().delayMs);
        saveSettings();
    });
    wrapper.querySelector('.mvuad-run').addEventListener('click', () => {
        enqueue(null, { manual: true });
    });
    wrapper.querySelector('.mvuad-undo').addEventListener('click', undoLast);
    const continuityMode = wrapper.querySelector('.mvuad-continuity-mode');
    continuityMode.value = getSettings().continuityMode;
    continuityMode.addEventListener('change', () => {
        getSettings().continuityMode = continuityMode.value;
        saveSettings();
        applyContinuityInjection();
    });
    wrapper.querySelector('.mvuad-continuity-run').addEventListener('click', () => {
        enqueueContinuity(null, { force: true });
    });
    wrapper.querySelector('.mvuad-continuity-clear').addEventListener('click', clearContinuityState);
    ui = {
        wrapper,
        status: wrapper.querySelector('.mvuad-status:not(.mvuad-continuity-status)'),
        continuityStatus: wrapper.querySelector('.mvuad-continuity-status'),
    };
    setStatus(latestStatus);
    setContinuityStatus(latestContinuityStatus);
}

function bindEvents() {
    const context = getContext();
    if (!context?.eventSource?.on) {
        setTimeout(bindEvents, 1000);
        return;
    }
    const types = context.eventTypes || context.event_types || {};
    context.eventSource.on(
        types.GENERATION_STARTED || 'generation_started',
        (type, _options, dryRun) => {
            if (dryRun) {
                console.info('[MVU Auto Doctor] 已忽略数据库/算量 dryRun。');
                return;
            }
            generationSerial += 1;
            lastGeneration = {
                serial: generationSerial,
                type: String(type || 'normal'),
                dryRun: false,
            };
            invalidateOperations(`开始新的${lastGeneration.type}生成`);
            applyContinuityInjection({
                isReroll: ['swipe', 'regenerate'].includes(lastGeneration.type),
            });
        },
    );
    context.eventSource.on(
        types.MESSAGE_RECEIVED || 'message_received',
        (value) => {
            const index = resolveMessageId(value);
            const current = getContext();
            const latest = latestAiMessage(current);
            const resolved = index < 0 ? latest.index : index;
            const captured = captureTarget(current, resolved);
            if (!captured) return;
            const repair = enqueue(resolved, { queuedTarget: captured });
            enqueueContinuity(resolved, {
                after: repair,
                expectedTarget: captured,
            });
        },
    );
    const onChatChanged = () => {
            clearTimeout(pendingChatSaveTimer);
            pendingChatSaveTimer = null;
            invalidateOperations('聊天已经切换');
            automaticPendingKeys.clear();
            automaticCompletedKeys.clear();
            continuityPendingKeys.clear();
            continuityCompletedKeys.clear();
            presetContinuityCache = { checkedAt: 0, active: false };
            lastUndo = latestUndoRecord(readChatNamespace());
            setStatus('等待新的 AI 回复');
            applyContinuityInjection();
            disableStoryOracleAutoIfNeeded();
        };
    const chatEvents = new Set([
        types.CHAT_CHANGED || 'chat_changed',
        types.CHAT_LOADED || 'chat_loaded',
    ]);
    for (const eventName of chatEvents) {
        context.eventSource.on(eventName, onChatChanged);
    }
}

function initialize() {
    if (window.__MVU_AUTO_DOCTOR_INITIALIZED__) return;
    window.__MVU_AUTO_DOCTOR_INITIALIZED__ = true;
    getSettings();
    buildSettingsPanel();
    bindEvents();
    disableStoryOracleAutoIfNeeded();
    lastUndo = latestUndoRecord(readChatNamespace());
    applyContinuityInjection();
    document.addEventListener('story-oracle-ready', disableStoryOracleAutoIfNeeded);
    window.MvuAutoDoctorAPI = Object.freeze({
        version: VERSION,
        runLatest: () => enqueue(null, { manual: true }),
        runContinuity: () => enqueueContinuity(null, { force: true }),
        getContinuityState: () => deepClone(readChatNamespace().continuity),
        clearContinuityState,
        undoLast,
        getStatus: () => latestStatus,
    });
    console.info(`[MVU Auto Doctor] v${VERSION} initialized`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
    initialize();
}
