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

const PLUGIN_ID = 'mvu_auto_doctor';
const VERSION = '1.0.0';
const STATUS_PLACEHOLDER = '<StatusPlaceHolderImpl/>';
const DEFAULTS = Object.freeze({
    enabled: true,
    preferStoryOracle: true,
    preventDoubleWrite: true,
    notifyNoChange: false,
    delayMs: 1600,
    contextMessages: 8,
    maxTokens: 4096,
});

let mvuPromise = null;
let runChain = Promise.resolve();
let lastUndo = null;
let latestStatus = '等待新的 AI 回复';
let oracleAutoDisabledNoticeShown = false;
let ui = null;

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
        swipeId: Number(message.swipe_id) || 0,
        fingerprint: fingerprint(message.mes),
    };
}

function targetIsCurrent(captured) {
    const context = getContext();
    if (!captured || !context || context.chatId !== captured.chatId) {
        return { ok: false, reason: '聊天已经切换' };
    }
    const latest = latestAiMessage(context);
    if (latest.index !== captured.index) {
        return { ok: false, reason: '主聊天已经出现更新的 AI 回复' };
    }
    const message = context.chat[captured.index];
    if (!message) return { ok: false, reason: '目标回复已不存在' };
    if ((Number(message.swipe_id) || 0) !== captured.swipeId) {
        return { ok: false, reason: '目标回复已经切换 swipe' };
    }
    if (fingerprint(message.mes) !== captured.fingerprint) {
        return { ok: false, reason: '目标回复正文已经变化' };
    }
    return { ok: true, reason: '' };
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

async function callModel(messages) {
    const settings = getSettings();
    disableStoryOracleAutoIfNeeded();

    if (settings.preferStoryOracle) {
        const api = window.StoryOracleAPI;
        if (api?.isCompatible?.(1) && typeof api.run === 'function') {
            try {
                const output = await api.run(messages, {
                    stream: false,
                    maxTokens: Math.max(2048, Number(settings.maxTokens) || 4096),
                });
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
    return await context.generateRaw({
        systemPrompt: messages[0].content,
        prompt: messages[1].content,
        responseLength: Math.max(2048, Number(settings.maxTokens) || 4096),
        trimNames: false,
    });
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

function applyBlockToCurrentSwipe(message, block, includeBlock) {
    if (!message || typeof message.mes !== 'string') return false;
    const before = message.mes;
    if (includeBlock && block && !message.mes.includes(block)) {
        message.mes = `${message.mes.trimEnd()}\n\n${block}`;
    }
    if (!message.mes.includes(STATUS_PLACEHOLDER)) {
        message.mes = `${message.mes.trimEnd()}\n\n${STATUS_PLACEHOLDER}`;
    }
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

async function refreshMessage(index, block = '', includeBlock = false) {
    const context = getContext();
    const message = context?.chat?.[index];
    if (!message) return;
    const changed = applyBlockToCurrentSwipe(message, block, includeBlock);
    if (changed) {
        try {
            await context.saveChat?.();
        } catch (error) {
            console.warn('[MVU Auto Doctor] 保存更新区块失败：', error);
        }
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
}

async function commitCandidate(Mvu, candidate, captured, originalBlock) {
    const current = targetIsCurrent(captured);
    if (!current.ok) {
        return { status: 'stale', reason: `${current.reason}，未写入` };
    }
    const options = { type: 'message', message_id: 'latest' };
    const oldData = await mvuDataAt(Mvu, 'latest');
    if (!oldData) return { status: 'failed', reason: '提交前无法读取当前 MVU 状态' };

    const reparsed = await Mvu.parseMessage(candidate.block, deepClone(oldData));
    const rechecked = validatePatchResult(oldData, reparsed, candidate.prepared);
    if (!rechecked.ok) {
        return {
            status: rechecked.nochange ? 'nochange' : 'failed',
            reason: rechecked.reason,
            details: rechecked.details,
        };
    }

    const snapshot = deepClone(oldData);
    await Mvu.replaceMvuData(reparsed, options);
    const landed = await mvuDataAt(Mvu, 'latest');
    const verified = validatePatchResult(oldData, landed, candidate.prepared);
    if (!verified.ok) {
        try {
            await Mvu.replaceMvuData(snapshot, options);
        } catch (rollbackError) {
            console.error('[MVU Auto Doctor] 回滚失败：', rollbackError);
        }
        await refreshMessage(captured.index);
        return {
            status: 'failed',
            reason: `写入后回读校验失败，已回滚：${verified.reason}`,
            details: verified.details,
        };
    }

    lastUndo = {
        chatId: captured.chatId,
        targetIndex: captured.index,
        snapshot,
    };
    await refreshMessage(captured.index, candidate.block, !originalBlock);
    return { status: 'applied', block: candidate.block };
}

async function ensureExistingFrontend(index, originalBlock) {
    if (!originalBlock) return;
    await refreshMessage(index);
}

async function runTarget(targetId, { manual = false } = {}) {
    const settings = getSettings();
    if (!manual && !settings.enabled) return { status: 'disabled' };
    disableStoryOracleAutoIfNeeded();

    const Mvu = await getMvu();
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
    await waitMvuIdle(Mvu);

    const context = getContext();
    const latest = latestAiMessage(context);
    const resolved = targetId == null || targetId < 0 ? latest.index : targetId;
    if (resolved !== latest.index) {
        return { status: 'stale', reason: '目标回复已不是最新 AI 楼层' };
    }
    const captured = captureTarget(context, resolved);
    if (!captured) return { status: 'stale', reason: '目标回复不可用' };

    const character = currentCharacter(context);
    const currentData = await mvuDataAt(Mvu, 'latest');
    if (!currentData || !statDataOf(currentData)) {
        const result = { status: 'failed', reason: '最新楼层没有可读取的 stat_data' };
        setStatus(result.reason, 'error');
        if (manual) toast('warning', result.reason);
        return result;
    }
    const previousData = await previousMvuData(Mvu, context, resolved);
    setStatus('正在核对最新回复与变量…', 'busy');

    let retry = null;
    let candidate = null;
    let originalBlock = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const targetCheck = targetIsCurrent(captured);
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
        if (output !== undefined) candidate = await parseCandidate(Mvu, currentData, output);
        if (candidate.status !== 'failed' || !candidate.retryable || attempt === 1) break;
        retry = candidate;
        setStatus('首个补丁未通过校验，正在自动重试…', 'busy');
    }

    if (candidate?.status === 'nochange') {
        await ensureExistingFrontend(resolved, originalBlock);
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
        result = await commitCandidate(Mvu, candidate, captured, originalBlock);
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

function enqueue(targetId, options = {}) {
    runChain = runChain
        .catch(() => undefined)
        .then(() => runTarget(targetId, options))
        .catch((error) => {
            console.error('[MVU Auto Doctor] 自动处理异常：', error);
            setStatus(`运行异常：${error.message || error}`, 'error');
            toast('warning', `运行异常，未改动变量：${error.message || error}`);
            return { status: 'failed', reason: String(error.message || error) };
        });
    return runChain;
}

async function undoLast() {
    const context = getContext();
    const Mvu = await getMvu();
    if (!lastUndo || !Mvu) {
        toast('info', '本次启动后还没有可撤销的自动修复。');
        return false;
    }
    const latest = latestAiMessage(context);
    if (
        context.chatId !== lastUndo.chatId
        || latest.index !== lastUndo.targetIndex
    ) {
        toast('warning', '聊天或最新楼层已经变化，为避免写错位置，不能撤销。');
        return false;
    }
    await Mvu.replaceMvuData(deepClone(lastUndo.snapshot), {
        type: 'message',
        message_id: 'latest',
    });
    await refreshMessage(lastUndo.targetIndex);
    lastUndo = null;
    setStatus('已撤销上一次自动修复', 'ok');
    toast('success', '已撤销上一次自动修复。');
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
    ui = { wrapper, status: wrapper.querySelector('.mvuad-status') };
    setStatus(latestStatus);
}

function bindEvents() {
    const context = getContext();
    if (!context?.eventSource?.on) {
        setTimeout(bindEvents, 1000);
        return;
    }
    const types = context.eventTypes || context.event_types || {};
    context.eventSource.on(
        types.MESSAGE_RECEIVED || 'message_received',
        (value) => {
            const index = resolveMessageId(value);
            enqueue(index);
        },
    );
    context.eventSource.on(
        types.CHAT_CHANGED || 'chat_changed',
        () => {
            lastUndo = null;
            setStatus('等待新的 AI 回复');
            disableStoryOracleAutoIfNeeded();
        },
    );
}

function initialize() {
    if (window.__MVU_AUTO_DOCTOR_INITIALIZED__) return;
    window.__MVU_AUTO_DOCTOR_INITIALIZED__ = true;
    getSettings();
    buildSettingsPanel();
    bindEvents();
    disableStoryOracleAutoIfNeeded();
    document.addEventListener('story-oracle-ready', disableStoryOracleAutoIfNeeded);
    window.MvuAutoDoctorAPI = Object.freeze({
        version: VERSION,
        runLatest: () => enqueue(null, { manual: true }),
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
