import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.dirname(here);
const playwrightCandidates = [
    process.env.PLAYWRIGHT_PATH,
    'C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs',
].filter(Boolean);
const playwrightPath = playwrightCandidates.find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) {
    console.log('browser runtime tests skipped: Playwright is unavailable');
    process.exit(0);
}
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const harness = String.raw`<!doctype html>
<html><body>
<div id="extensions_settings2"></div>
<script>
const calls = { model: [], replace: [], prompts: [], saves: 0, continuitySystem: '', continuityUser: '' };
const listeners = {};
let latestData = { stat_data: { 账户: { 代币: 2 } }, display_data: {} };
let deferredResolve = null;
let mode = 'normal';
const chat = [
  { is_user: false, is_system: false, mes: '开场', swipe_id: 0, extra: {} },
  { is_user: true, is_system: false, mes: '继续观察港口', swipe_id: 0, extra: {} },
  { is_user: false, is_system: false, swipe_id: 0, extra: {}, mes:
    '巡逻队开始核对异常货单。\\n' +
    '<UpdateVariable><Analysis>正确</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>' },
];
const context = {
  chat,
  chatId: 'chat-a',
  chatMetadata: {},
  extensionSettings: {},
  characterId: 0,
  groupId: null,
  characters: [{ data: { extensions: { tavern_helper: { scripts: [{
    name: '变量结构', enabled: true,
    content: 'registerMvuSchema(z.object({账户:z.object({代币:z.number()})}))',
  }] } }, character_book: { entries: [{
    comment: '[mvu_update]变量更新规则', constant: true, disable: false,
    order: 1, content: '代币按正文明确变化更新。',
  }] } } }],
  substituteParams: (text) => text,
  saveSettingsDebounced() {},
  saveMetadataDebounced() { calls.saves += 1; },
  updateChatMetadata(patch) { Object.assign(this.chatMetadata, patch); },
  async saveChat() { calls.saves += 1; },
  updateMessageBlock() {},
  setExtensionPrompt(name, content) { calls.prompts.push([name, content]); },
  eventTypes: {
    GENERATION_STARTED: 'generation_started',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_UPDATED: 'message_updated',
    CHAT_CHANGED: 'chat_changed',
    CHAT_LOADED: 'chat_loaded',
  },
  eventSource: {
    on(name, fn) { (listeners[name] ||= []).push(fn); },
    async emit(name, ...args) {
      for (const fn of listeners[name] || []) await fn(...args);
    },
  },
  async generateRaw() { throw new Error('Story Oracle should be used'); },
};
window.SillyTavern = { getContext: () => context };
window.TavernHelper = { waitGlobalInitialized: async () => window.Mvu };
window.toastr = { info() {}, success() {}, warning() {} };
window.Mvu = {
  isDuringExtraAnalysis: () => false,
  getMvuData: () => structuredClone(latestData),
  async parseMessage(block, data) {
    const match = block.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/i);
    const ops = match ? JSON.parse(match[1]) : [];
    for (const op of ops) {
      if (op.path === '/账户/代币' && op.op === 'delta') data.stat_data.账户.代币 += op.value;
      if (op.op === 'replace') {
        const parts = op.path.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        let parent = data.stat_data;
        for (const part of parts.slice(0, -1)) parent = parent[part];
        parent[parts.at(-1)] = op.value;
      }
    }
    return data;
  },
  async replaceMvuData(data, options) {
    calls.replace.push({ chatId: context.chatId, options: structuredClone(options) });
    latestData = structuredClone(data);
  },
};
window.StoryOracleAPI = {
  isCompatible: () => true,
  context: { getSettings: () => ({ autoDiagnoseEnabled: false }) },
  async run(messages) {
    const system = messages[0].content;
    calls.model.push(system.includes('活世界事件') ? 'continuity' : 'repair');
    if (system.includes('活世界事件')) {
      calls.continuitySystem = messages[0].content;
      calls.continuityUser = messages[1].content;
      return '<ContinuityState>{"turn":1,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","origin":"ambient","relation":"independent","stage":"seeded","summary":"新巡检员在交接册里发现缺失的一页。","offscreenBeat":"他先私下核对了三个月的报时记录。","nextBeat":"巡检员会询问上一班的抄录员。","trigger":"巡检制度自行推进，无需玩家触发。","intersection":"只有主线涉及钟楼、报时记录或城防调查时才可能汇流。","seedBasis":"世界书：港城 / 钟楼巡检制度","actors":["新巡检员","上一班抄录员"],"locations":["港城钟楼"],"knowledge":"hidden","urgency":1,"lastAdvancedTurn":1}]}</ContinuityState>';
    }
    if (mode === 'defer') {
      return await new Promise((resolve) => { deferredResolve = resolve; });
    }
    return '<UpdateVariable><Analysis>补齐明确变化</Analysis><JSONPatch>[{"op":"delta","path":"/账户/代币","value":1}]</JSONPatch></UpdateVariable>';
  },
};
window.__TEST__ = {
  calls, context,
  setMode(value) { mode = value; },
  setLatestData(value) { latestData = structuredClone(value); },
  getLatestData() { return structuredClone(latestData); },
  resolveRepair(value) { deferredResolve?.(value); },
  hasDeferred: () => !!deferredResolve,
};
</script>
<script type="module" src="/index.js"></script>
</body></html>`;

const worldInfoModule = `
export const selected_world_info = ['港城'];
const entry = {
  uid: 7, world: '港城', comment: '钟楼巡检制度',
  constant: true, disable: false, order: 7,
  key: ['钟楼', '报时'],
  content: '港城钟楼由三班巡检员轮值，交接册记录报时、维修和城防联络。巡检员与玩家互不认识。'
};
export async function getSortedEntries() { return [entry]; }
export async function loadWorldInfo() { return { entries: { 7: entry } }; }`;

const openaiModule = `
export const oai_settings = {
  prompts: [{ identifier: 'parallel-active', content: '<Parallel_Event_Lifecycle>持续支线</Parallel_Event_Lifecycle>' }],
  prompt_order: [{ order: [{ identifier: 'parallel-active', enabled: true }] }]
};`;

function typeOf(file) {
    if (file.endsWith('.html')) return 'text/html; charset=utf-8';
    if (file.endsWith('.css')) return 'text/css; charset=utf-8';
    return 'text/javascript; charset=utf-8';
}

const server = http.createServer((request, response) => {
    if (request.url === '/') {
        response.writeHead(200, { 'content-type': typeOf('.html') });
        response.end(harness);
        return;
    }
    if (request.url === '/scripts/world-info.js') {
        response.writeHead(200, { 'content-type': typeOf('.js') });
        response.end(worldInfoModule);
        return;
    }
    if (request.url === '/scripts/openai.js') {
        response.writeHead(200, { 'content-type': typeOf('.js') });
        response.end(openaiModule);
        return;
    }
    const file = path.join(pluginRoot, request.url.slice(1));
    if (file.startsWith(pluginRoot) && fs.existsSync(file)) {
        response.writeHead(200, { 'content-type': typeOf(file) });
        response.end(fs.readFileSync(file));
        return;
    }
    response.writeHead(404); response.end('not found');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI);

    await page.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, true);
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await page.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.continuity?.threads?.length === 1
    ), null, { timeout: 20000 }).catch(async (error) => {
        console.error('continuity timeout diagnostics', await page.evaluate(() => ({
            metadata: window.__TEST__.context.chatMetadata,
            calls: window.__TEST__.calls,
            apiState: window.MvuAutoDoctorAPI?.getContinuityState?.(),
            status: document.querySelector('.mvuad-status')?.textContent,
        })));
        throw error;
    });
    const continuity = await page.evaluate(() => ({
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        calls: structuredClone(window.__TEST__.calls),
        version: window.MvuAutoDoctorAPI.version,
        ledgerText: document.querySelector('.mvuad-ledger')?.textContent || '',
        cardCount: document.querySelectorAll('.mvuad-thread-card').length,
        openCardCount: document.querySelectorAll('.mvuad-thread-card[open]').length,
    }));
    assert.equal(continuity.version, '1.3.1');
    assert.equal(continuity.state.threads[0].id, 'WE-港城-钟楼-01');
    assert.equal(continuity.state.threads[0].origin, 'ambient');
    assert.equal(continuity.state.threads[0].relation, 'independent');
    assert.equal(continuity.cardCount, 1);
    assert.equal(continuity.openCardCount, 0, '未显现的幕后事件默认折叠');
    assert.match(continuity.ledgerText, /幕后独立事件（点击查看剧透）/u);
    assert.match(continuity.ledgerText, /世界脉动/u);
    assert.match(continuity.ledgerText, /保持独立/u);
    assert.equal(
        await page.locator('.mvuad-thread-card summary .mvuad-thread-title').textContent(),
        '幕后独立事件（点击查看剧透）',
    );
    await page.click('.mvuad-thread-card summary');
    assert.match(
        await page.locator('.mvuad-thread-card .mvuad-thread-body').textContent(),
        /钟楼巡检的缺页交接册/u,
    );
    const mobileLedgerLayout = await page.evaluate(() => {
        const ledger = document.querySelector('.mvuad-ledger');
        const field = document.querySelector('.mvuad-thread-field');
        const rect = ledger?.getBoundingClientRect();
        return {
            viewportWidth: window.innerWidth,
            left: rect?.left ?? -1,
            right: rect?.right ?? Number.MAX_SAFE_INTEGER,
            fieldColumns: field ? getComputedStyle(field).gridTemplateColumns : '',
        };
    });
    assert.ok(mobileLedgerLayout.left >= 0);
    assert.ok(mobileLedgerLayout.right <= mobileLedgerLayout.viewportWidth + 1);
    assert.doesNotMatch(mobileLedgerLayout.fieldColumns, /\s/u, '手机字段应为单列');
    assert.ok(continuity.calls.model.includes('continuity'));
    assert.match(continuity.calls.continuitySystem, /setting_independent/u);
    assert.match(continuity.calls.continuitySystem, /可以永远不与主线相交/u);
    assert.match(continuity.calls.continuityUser, /钟楼巡检制度/u);
    assert.match(continuity.calls.continuityUser, /巡检员与玩家互不认识/u);
    assert.ok(continuity.calls.prompts.some(([, content]) => /禁止替玩家角色决定/u.test(content)));
    assert.equal(continuity.calls.replace[0].chatId, 'chat-a');
    assert.equal(continuity.calls.replace[0].options.message_id, 2);
    assert.equal(
        await page.evaluate(() => (
            window.__TEST__.context.chatMetadata.mvu_auto_doctor.repairJournal.length
        )),
        1,
    );

    const openingSync = await page.evaluate(async () => {
        const t = window.__TEST__;
        t.context.characters[0].data.character_book.entries.push({
            comment: '[initvar]变量初始化勿开',
            disable: true,
            content: [
                '契约者:',
                '  衍生属性:',
                '    MP_当前: 50',
                '    MP_最大: 50',
                '    负重_当前: 0',
                '    负重_上限: 25',
            ].join('\n'),
        });
        t.setLatestData({
            stat_data: {
                契约者: {
                    衍生属性: {
                        MP_当前: 50,
                        MP_最大: 110,
                        负重_当前: 0,
                        负重_上限: 55,
                    },
                },
            },
            display_data: {},
        });
        const modelCallsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.syncOpeningResources();
        return {
            result,
            state: t.getLatestData(),
            modelCallsBefore,
            modelCallsAfter: t.calls.model.length,
            lastReplace: structuredClone(t.calls.replace.at(-1)),
            journalLength: t.context.chatMetadata.mvu_auto_doctor.repairJournal.length,
        };
    });
    assert.equal(openingSync.result.status, 'applied');
    assert.equal(openingSync.state.stat_data.契约者.衍生属性.MP_当前, 110);
    assert.equal(openingSync.state.stat_data.契约者.衍生属性.负重_当前, 0);
    assert.equal(openingSync.modelCallsAfter, openingSync.modelCallsBefore, '开局同步不得调用模型');
    assert.equal(openingSync.lastReplace.options.message_id, 2);
    assert.equal(openingSync.journalLength, 2);

    const openingUndo = await page.evaluate(async () => {
        const undone = await window.MvuAutoDoctorAPI.undoLast();
        const retried = await window.MvuAutoDoctorAPI.syncOpeningResources();
        return {
            undone,
            retried,
            state: window.__TEST__.getLatestData(),
            openingState: structuredClone(
                window.__TEST__.context.chatMetadata.mvu_auto_doctor.openingResourceSync,
            ),
        };
    });
    assert.equal(openingUndo.undone, true);
    assert.equal(openingUndo.state.stat_data.契约者.衍生属性.MP_当前, 50);
    assert.equal(openingUndo.retried.status, 'nochange', '手动撤销后不得立即自动补回');
    assert.ok(openingUndo.openingState.suppressed['/契约者/衍生属性/MP_当前']);

    const beforeRefreshCalls = continuity.calls.model.length;
    await page.click('.mvuad-ledger-refresh');
    assert.equal(
        await page.evaluate(() => window.__TEST__.calls.model.length),
        beforeRefreshCalls,
        '刷新显示不得额外调用模型',
    );

    const rerollPrompt = await page.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'regenerate', {}, false);
        return t.calls.prompts.at(-1)?.[1] || '';
    });
    assert.match(rerollPrompt, /当前没有登记中的未结支线/u);
    assert.doesNotMatch(rerollPrompt, /PE-港口-哨兵-01/u);

    await page.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('defer');
        t.context.chat.push({ is_user: true, is_system: false, mes: '等待', swipe_id: 0, extra: {} });
        t.context.chat.push({ is_user: false, is_system: false, mes: '新回复', swipe_id: 0, extra: {} });
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 4);
    });
    await page.waitForFunction(() => window.__TEST__.hasDeferred(), null, { timeout: 20000 });
    const before = await page.evaluate(() => window.__TEST__.calls.replace.length);
    await page.evaluate(async () => {
        const t = window.__TEST__;
        t.setLatestData({ stat_data: { 账户: { 代币: 3 } }, display_data: {} });
        t.context.chatId = 'chat-b';
        t.context.chat = [{ is_user: false, is_system: false, mes: '另一个聊天', swipe_id: 0, extra: {} }];
        t.context.chatMetadata = {};
        await t.context.eventSource.emit('chat_loaded');
        t.resolveRepair('<UpdateVariable><Analysis>不应落地</Analysis><JSONPatch>[{"op":"delta","path":"/账户/代币","value":99}]</JSONPatch></UpdateVariable>');
    });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.__TEST__.calls.replace.length);
    assert.equal(after, before, '切聊天后的旧模型结果不得写入新聊天');
    assert.equal(
        await page.evaluate(() => document.querySelectorAll('.mvuad-thread-card').length),
        0,
        '切换到空聊天后不得显示上一个聊天的支线',
    );
    assert.match(
        await page.evaluate(() => document.querySelector('.mvuad-ledger-empty')?.textContent || ''),
        /当前没有未结支线/u,
    );
} finally {
    await browser.close();
    server.close();
}

console.log('browser runtime race and continuity tests passed');
