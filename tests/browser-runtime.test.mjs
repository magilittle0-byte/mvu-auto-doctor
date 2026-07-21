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
const calls = { model: [], replace: [], prompts: [], saves: 0 };
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
    calls.model.push(system.includes('支线连续性') ? 'continuity' : 'repair');
    if (system.includes('支线连续性')) {
      return '<ContinuityState>{"turn":1,"threads":[{"id":"PE-港口-哨兵-01","title":"异常货单","kind":"parallel","stage":"advancing","summary":"巡逻队开始核对货单","nextBeat":"门禁盘问留下痕迹","trigger":"再次进入港区","actors":["哨兵"],"locations":["港口"],"knowledge":"rumor","urgency":2,"lastAdvancedTurn":1}]}</ContinuityState>';
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
  resolveRepair(value) { deferredResolve?.(value); },
  hasDeferred: () => !!deferredResolve,
};
</script>
<script type="module" src="/index.js"></script>
</body></html>`;

const worldInfoModule = `
export async function getSortedEntries() { return []; }
export async function loadWorldInfo() { return { entries: {} }; }`;

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
    const page = await browser.newPage();
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
    ), null, { timeout: 20000 });
    const continuity = await page.evaluate(() => ({
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        calls: structuredClone(window.__TEST__.calls),
    }));
    assert.equal(continuity.state.threads[0].id, 'PE-港口-哨兵-01');
    assert.ok(continuity.calls.model.includes('continuity'));
    assert.ok(continuity.calls.prompts.some(([, content]) => /禁止替玩家角色决定/u.test(content)));
    assert.equal(continuity.calls.replace[0].chatId, 'chat-a');
    assert.equal(continuity.calls.replace[0].options.message_id, 2);
    assert.equal(
        await page.evaluate(() => (
            window.__TEST__.context.chatMetadata.mvu_auto_doctor.repairJournal.length
        )),
        1,
    );

    const rerollPrompt = await page.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'regenerate', {}, false);
        return t.calls.prompts.at(-1)?.[1] || '';
    });
    assert.match(rerollPrompt, /当前没有未结支线/u);
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
        t.context.chatId = 'chat-b';
        t.context.chat = [{ is_user: false, is_system: false, mes: '另一个聊天', swipe_id: 0, extra: {} }];
        t.context.chatMetadata = {};
        await t.context.eventSource.emit('chat_loaded');
        t.resolveRepair('<UpdateVariable><Analysis>不应落地</Analysis><JSONPatch>[{"op":"delta","path":"/账户/代币","value":99}]</JSONPatch></UpdateVariable>');
    });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.__TEST__.calls.replace.length);
    assert.equal(after, before, '切聊天后的旧模型结果不得写入新聊天');
} finally {
    await browser.close();
    server.close();
}

console.log('browser runtime race and continuity tests passed');
