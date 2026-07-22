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
<html><head><link rel="stylesheet" href="/style.css"></head><body>
<div id="extensions_settings2"></div>
<script>
const calls = { model: [], replace: [], prompts: [], saves: 0, continuitySystem: '', continuityUser: '', continuityRuns: 0, forumSystem: '', forumUser: '', forumRuns: 0 };
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
    const isContinuity = system.includes('活世界事件');
    const isForum = system.includes('独立网络论坛模拟器');
    calls.model.push(isContinuity ? 'continuity' : isForum ? 'forum' : 'repair');
    if (isForum) {
      calls.forumRuns += 1;
      calls.forumSystem = messages[0].content;
      calls.forumUser = messages[1].content;
      const id = 'FP-' + calls.forumRuns;
      return '<ForumUpdate>{"summary":"港城网友正在聊日常与公开见闻","newPosts":[{"id":"' + id + '","board":"闲聊广场","title":"北门面摊今天是不是淡了点","author":"盐汽水","body":"路过吃了一碗，老板说盐车晚到了。","kind":"chat","tags":["吃喝","北门"],"source":"港城普通生活","heat":7},{"id":"' + id + '-G","board":"求助攻略","title":"夜里去北岸要注意什么","author":"赶夜路的人","body":"第一次走北岸，求问渡船和照明情况。","kind":"guide","tags":["求助"],"source":"世界书中的港城交通","heat":4}],"comments":[],"heat":[],"archive":[]}</ForumUpdate>';
    }
    if (system.includes('活世界事件')) {
      calls.continuityRuns += 1;
      calls.continuitySystem = messages[0].content;
      calls.continuityUser = messages[1].content;
      if (calls.continuityRuns === 1) return '<ContinuityState>{"turn":1,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","origin":"ambient","relation":"independent","stage":"seeded","summary":"新巡检员在交接册里发现缺失的一页。","offscreenBeat":"他先私下核对了三个月的报时记录。","nextBeat":"巡检员会询问上一班的抄录员。","trigger":"巡检制度自行推进，无需玩家触发。","intersection":"只有主线涉及钟楼、报时记录或城防调查时才可能汇流。","seedBasis":"世界书：港城 / 钟楼巡检制度","actors":["新巡检员","上一班抄录员"],"locations":["港城钟楼"],"knowledge":"hidden","urgency":1,"lastAdvancedTurn":1}]}</ContinuityState>';
      if (calls.continuityRuns === 2) return '<ContinuityState>{"turn":2,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","origin":"ambient","relation":"independent","stage":"advancing","summary":"巡检员找到上一班抄录员并确认缺页被人为撕走。","offscreenBeat":"两人比对墨迹，锁定缺页发生在昨夜换班。","nextBeat":"他们会查问昨夜进入钟楼的人。","trigger":"巡检制度自行推进，无需玩家触发。","intersection":"只有主线涉及钟楼、报时记录或城防调查时才可能汇流。","seedBasis":"世界书：港城 / 钟楼巡检制度","knowledge":"hidden","urgency":1},{"id":"PE-货单-追查-01","title":"烧毁货单后的泄密追查","kind":"enemy","origin":"main_derivative","relation":"linked","stage":"seeded","summary":"玩家烧毁异常货单后，仓主开始追查接触过货单的人。","nextBeat":"仓主会先核对仓库值班表。","trigger":"本轮正文已经造成持续追查。","intersection":"追查接触玩家或其同伴时进入主线。","seedBasis":"本轮正文：玩家烧毁异常货单并惊动仓主","causedBy":["ACTION-烧毁货单"],"knowledge":"hidden","urgency":2}]}</ContinuityState>';
      if (calls.continuityRuns === 3) return '<ContinuityState>{"turn":3,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","origin":"ambient","relation":"independent","stage":"resolved","summary":"巡检员确认缺页被城防书记带走归档。","resolution":"书记承认临时取走记录并补办了归档手续。","effects":["钟楼开始执行双人签字的交接制度"],"rumors":["巡检员之间流传城防正在秘密复核夜间报时"],"seedBasis":"世界书：港城 / 钟楼巡检制度","knowledge":"hidden","urgency":1},{"id":"PE-货单-追查-01","title":"烧毁货单后的泄密追查","kind":"enemy","origin":"main_derivative","relation":"linked","stage":"seeded","summary":"玩家烧毁异常货单后，仓主开始追查接触过货单的人。","nextBeat":"仓主会先核对仓库值班表。","trigger":"本轮正文已经造成持续追查。","intersection":"追查接触玩家或其同伴时进入主线。","seedBasis":"本轮正文：玩家烧毁异常货单并惊动仓主","causedBy":["ACTION-烧毁货单"],"knowledge":"hidden","urgency":2},{"id":"WE-钟楼-双签-01","title":"钟楼双签制度的磨合","kind":"personal","origin":"setting_linked","relation":"latent","stage":"seeded","summary":"新双签制度令夜班交接变慢。","nextBeat":"夜班人员会要求调整排班。","trigger":"双签制度持续执行。","intersection":"主线需要夜间报时或城防通行时才可能汇流。","seedBasis":"钟楼缺页事件结束后建立双人签字制度","causedBy":["WE-港城-钟楼-01"],"effects":["夜班交接延长"],"knowledge":"hidden","urgency":1}]}</ContinuityState>';
      return '<ContinuityState>{"turn":4,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","origin":"ambient","relation":"independent","stage":"resolved","summary":"巡检员确认缺页被城防书记带走归档。","resolution":"书记承认临时取走记录并补办了归档手续。","effects":["钟楼开始执行双人签字的交接制度"],"rumors":["巡检员之间流传城防正在秘密复核夜间报时"],"seedBasis":"世界书：港城 / 钟楼巡检制度","knowledge":"hidden"},{"id":"PE-货单-追查-01","title":"烧毁货单后的泄密追查","kind":"enemy","origin":"main_derivative","relation":"linked","stage":"advancing","summary":"仓主从值班表锁定了两名可能接触货单的人。","offscreenBeat":"仓主派人分别试探两名值班人。","nextBeat":"其中一人会试图向外求助。","trigger":"追查持续进行。","intersection":"追查接触玩家或其同伴时进入主线。","seedBasis":"本轮正文：玩家烧毁异常货单并惊动仓主","causedBy":["ACTION-烧毁货单"],"knowledge":"hidden","urgency":2},{"id":"WE-钟楼-双签-01","title":"钟楼双签制度的磨合","kind":"personal","origin":"setting_linked","relation":"latent","stage":"seeded","summary":"新双签制度令夜班交接变慢。","nextBeat":"夜班人员会要求调整排班。","trigger":"双签制度持续执行。","intersection":"主线需要夜间报时或城防通行时才可能汇流。","seedBasis":"钟楼缺页事件结束后建立双人签字制度","causedBy":["WE-港城-钟楼-01"],"effects":["夜班交接延长"],"knowledge":"hidden","urgency":1}]}</ContinuityState>';
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
    await page.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.turn === 1
    ), null, { timeout: 20000 });
    const continuity = await page.evaluate(() => ({
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        forumState: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
        version: window.MvuAutoDoctorAPI.version,
        ledgerText: document.querySelector('#mvu-auto-doctor-settings .mvuad-ledger')?.textContent || '',
        cardCount: document.querySelectorAll('#mvu-auto-doctor-settings .mvuad-thread-card').length,
        openCardCount: document.querySelectorAll('#mvu-auto-doctor-settings .mvuad-thread-card[open]').length,
    }));
    assert.equal(continuity.version, '1.4.1');
    assert.equal(continuity.state.threads[0].id, 'WE-港城-钟楼-01');
    assert.equal(continuity.state.threads[0].origin, 'ambient');
    assert.equal(continuity.state.threads[0].relation, 'independent');
    assert.equal(continuity.forumState.posts.length, 2);
    assert.equal(continuity.calls.forumRuns, 1);
    assert.match(continuity.calls.forumSystem, /至少一半内容应为日常闲聊/u);
    assert.equal(continuity.cardCount, 1);
    assert.equal(continuity.openCardCount, 0, '未显现的幕后事件默认折叠');
    assert.match(continuity.ledgerText, /幕后独立事件（点击查看剧透）/u);
    assert.match(continuity.ledgerText, /世界脉动/u);
    assert.match(continuity.ledgerText, /保持独立/u);
    assert.equal(
        await page.locator('#mvu-auto-doctor-settings .mvuad-thread-card summary .mvuad-thread-title').textContent(),
        '幕后独立事件（点击查看剧透）',
    );
    await page.click('#mvu-auto-doctor-settings .mvuad-thread-card summary');
    assert.match(
        await page.locator('#mvu-auto-doctor-settings .mvuad-thread-card .mvuad-thread-body').textContent(),
        /钟楼巡检的缺页交接册/u,
    );
    const mobileLedgerLayout = await page.evaluate(() => {
        const ledger = document.querySelector('#mvu-auto-doctor-settings .mvuad-ledger');
        const field = document.querySelector('#mvu-auto-doctor-settings .mvuad-thread-field');
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
    const orbBeforeOpen = await page.evaluate(() => {
        const orb = document.querySelector('#mvuad-floating-orb');
        const rect = orb?.getBoundingClientRect();
        return {
            exists: !!orb,
            hidden: !!orb?.hidden,
            top: rect?.top ?? -1,
            bottom: rect?.bottom ?? Number.MAX_SAFE_INTEGER,
            count: orb?.querySelector('.mvuad-orb-count')?.textContent,
        };
    });
    assert.equal(orbBeforeOpen.exists, true, '必须建立游玩时悬浮入口');
    assert.equal(orbBeforeOpen.hidden, false);
    assert.ok(
        orbBeforeOpen.top >= 0 && orbBeforeOpen.bottom <= 844,
        JSON.stringify(orbBeforeOpen),
    );
    assert.equal(orbBeforeOpen.count, '1');
    await page.click('#mvuad-floating-orb');
    const floatingPanel = await page.evaluate(() => {
        const panel = document.querySelector('#mvuad-floating-panel');
        const rect = panel?.getBoundingClientRect();
        return {
            hidden: !!panel?.hidden,
            left: rect?.left ?? -1,
            right: rect?.right ?? Number.MAX_SAFE_INTEGER,
            cards: panel?.querySelectorAll('.mvuad-thread-card').length || 0,
            text: panel?.textContent || '',
        };
    });
    assert.equal(floatingPanel.hidden, false);
    assert.ok(floatingPanel.left >= 0 && floatingPanel.right <= 391);
    assert.equal(floatingPanel.cards, 1);
    assert.match(floatingPanel.text, /世界风声/u);
    assert.match(floatingPanel.text, /打开完整论坛/u);
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="threads"]')?.hidden),
        false,
    );
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="echoes"]')?.hidden),
        true,
        '支线页不得与世界风声纵向堆叠',
    );
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="echoes"]');
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="threads"]')?.hidden),
        true,
    );
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="forum"]');
    assert.equal(
        await page.evaluate(() => document.querySelectorAll('#mvuad-floating-panel .mvuad-floating-forum-preview-item').length),
        2,
    );
    if (process.env.MVUAD_FLOATING_SCREENSHOT) {
        await page.screenshot({ path: process.env.MVUAD_FLOATING_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-forum');
    await page.waitForFunction(() => !document.querySelector('#mvuad-forum-panel')?.hidden);
    const forumPanel = await page.evaluate(() => {
        const panel = document.querySelector('#mvuad-forum-panel');
        const shell = panel?.querySelector('.mvuad-forum-shell');
        const rect = shell?.getBoundingClientRect();
        return {
            hidden: !!panel?.hidden,
            left: rect?.left ?? -1,
            right: rect?.right ?? Number.MAX_SAFE_INTEGER,
            posts: panel?.querySelectorAll('.mvuad-forum-post').length || 0,
            text: panel?.textContent || '',
            externalHidden: !!panel?.querySelector('.mvuad-forum-external')?.hidden,
        };
    });
    assert.equal(forumPanel.hidden, false);
    assert.ok(forumPanel.left >= 0 && forumPanel.right <= 391);
    assert.equal(forumPanel.posts, 2);
    assert.match(forumPanel.text, /北门面摊/u);
    assert.match(forumPanel.text, /评论 0/u);
    assert.equal(forumPanel.externalHidden, true, '未安装Zsd时仍必须显示内置论坛，而不是空跳转');
    if (process.env.MVUAD_SCREENSHOT) {
        await page.screenshot({ path: process.env.MVUAD_SCREENSHOT, fullPage: true });
    }
    await page.click('#mvuad-forum-panel .mvuad-forum-close');
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-forum-panel')?.hidden),
        true,
    );
    assert.ok(continuity.calls.model.includes('continuity'));
    assert.match(continuity.calls.continuitySystem, /setting_independent/u);
    assert.match(continuity.calls.continuitySystem, /可以永远不与主线相交/u);
    assert.match(continuity.calls.continuitySystem, /禁止从骰池挑成功数字或先写结果后补检定/u);
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
    await page.click('#mvu-auto-doctor-settings .mvuad-ledger-refresh');
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
        await page.evaluate(() => document.querySelector('#mvu-auto-doctor-settings .mvuad-ledger-empty')?.textContent || ''),
        /当前没有未结支线/u,
    );
    assert.equal(
        await page.evaluate(() => document.querySelectorAll('#mvuad-forum-panel .mvuad-forum-post').length),
        0,
        '切换到空聊天后不得显示上一个聊天的论坛帖子',
    );

    const lifecyclePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await lifecyclePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await lifecyclePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    for (const turn of [1, 2, 3, 4]) {
        await lifecyclePage.evaluate(async (step) => {
            const t = window.__TEST__;
            if (step > 1) {
                t.context.chat.push({ is_user: true, is_system: false, mes: step === 2 ? '烧毁异常货单' : '继续处理眼前事务', swipe_id: 0, extra: {} });
                t.context.chat.push({ is_user: false, is_system: false, mes: step === 2 ? '货单烧毁，仓主察觉有人动过仓库记录。' : `第${step}回合主线回复`, swipe_id: 0, extra: {} });
            }
            const index = t.context.chat.length - 1;
            await t.context.eventSource.emit('generation_started', 'normal', {}, false);
            await t.context.eventSource.emit('message_received', index);
        }, turn);
        await lifecyclePage.waitForFunction((expected) => (
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.continuity?.turn === expected
        ), turn, { timeout: 30000 });
    }
    const lifecycle = await lifecyclePage.evaluate(() => ({
        version: window.MvuAutoDoctorAPI.version,
        calls: structuredClone(window.__TEST__.calls),
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        ledgerText: document.querySelector('#mvu-auto-doctor-settings .mvuad-ledger')?.textContent || '',
    }));
    assert.equal(lifecycle.version, '1.4.1');
    assert.equal(lifecycle.calls.continuityRuns, 4, '每个完成的AI回复都必须运行一次世界节拍');
    assert.equal(lifecycle.state.turn, 4);
    assert.equal(lifecycle.state.threads.find((thread) => thread.id === 'PE-货单-追查-01').stage, 'advancing');
    const ended = lifecycle.state.threads.find((thread) => thread.id === 'WE-港城-钟楼-01');
    assert.equal(ended.stage, 'resolved');
    assert.match(ended.effects.join(''), /双人签字/u);
    assert.match(ended.rumors.join(''), /秘密复核/u);
    assert.ok(lifecycle.state.threads.some((thread) => (
        thread.id === 'WE-钟楼-双签-01'
        && thread.causedBy.includes('WE-港城-钟楼-01')
    )));
    assert.match(lifecycle.ledgerText, /烧毁货单后的泄密追查/u);
    assert.match(lifecycle.ledgerText, /已收束支线（1）/u);
    await lifecyclePage.close();

    const forumRerollPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await forumRerollPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await forumRerollPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await forumRerollPage.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await forumRerollPage.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.turn === 1
    ), null, { timeout: 30000 });
    await forumRerollPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].swipe_id = 1;
        t.context.chat[2].mes = '重抽后的港口回复';
        await t.context.eventSource.emit('generation_started', 'regenerate', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await forumRerollPage.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.lastSource?.swipeId === '1'
    ), null, { timeout: 30000 });
    const forumReroll = await forumRerollPage.evaluate(() => ({
        state: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
    }));
    assert.equal(forumReroll.state.turn, 1, '重抽必须从本楼刷新前存档点重算');
    assert.equal(forumReroll.state.posts.length, 2);
    assert.ok(forumReroll.state.posts.every((post) => post.id.startsWith('FP-2')));
    assert.ok(!forumReroll.state.posts.some((post) => post.id.startsWith('FP-1')));
    await forumRerollPage.close();

    const externalForumPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await externalForumPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await externalForumPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await externalForumPage.evaluate(async () => {
        const external = document.createElement('button');
        external.id = 'zsd-forum-orb';
        document.body.appendChild(external);
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await externalForumPage.waitForFunction(() => (
        /暂停内置自动刷帖/u.test(document.querySelector('.mvuad-settings-forum-status')?.textContent || '')
    ), null, { timeout: 30000 });
    const externalForum = await externalForumPage.evaluate(() => ({
        forum: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
        externalButtonHidden: document.querySelector('.mvuad-forum-external')?.hidden,
    }));
    assert.equal(externalForum.forum.turn, 0, '检测到Zsd时不得自动生成第二套论坛');
    assert.equal(externalForum.calls.forumRuns, 0);
    assert.equal(externalForum.externalButtonHidden, false);
    await externalForumPage.close();

    const heldPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await heldPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await heldPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await heldPage.evaluate(() => {
        const t = window.__TEST__;
        const originalRun = window.StoryOracleAPI.run;
        let localContinuityRuns = 0;
        window.StoryOracleAPI.run = async (messages) => {
            const system = messages[0].content;
            if (!system.includes('活世界事件')) return originalRun(messages);
            localContinuityRuns += 1;
            t.calls.model.push('continuity');
            t.calls.continuityRuns += 1;
            if (localContinuityRuns === 1) {
                return '<ContinuityState>{"turn":1,"threads":[{"id":"WE-渡船-潮汐-01","title":"渡船等待退潮","origin":"ambient","relation":"independent","stage":"seeded","summary":"渡船仍系在北岸码头。","nextBeat":"退潮后船工才会检查缆绳。","trigger":"游戏内时间推进到退潮时段。","intersection":"玩家前往北岸码头时可能观察到。","seedBasis":"世界书：港城潮汐与渡船班次","knowledge":"hidden"}]}</ContinuityState>';
            }
            return '<ContinuityState>{"turn":2,"lastTick":{"turn":2,"action":"held","threadId":"WE-渡船-潮汐-01","reason":"正文只过去十几秒，尚未到世界书规定的退潮时段"},"threads":[{"id":"WE-渡船-潮汐-01","title":"渡船等待退潮","origin":"ambient","relation":"independent","stage":"seeded","summary":"渡船仍系在北岸码头。","nextBeat":"退潮后船工才会检查缆绳。","trigger":"游戏内时间推进到退潮时段。","intersection":"玩家前往北岸码头时可能观察到。","seedBasis":"世界书：港城潮汐与渡船班次","knowledge":"hidden"}]}</ContinuityState>';
        };
    });
    for (const step of [1, 2]) {
        await heldPage.evaluate(async (turn) => {
            const t = window.__TEST__;
            if (turn === 2) {
                t.context.chat.push({ is_user: true, is_system: false, mes: '原地看了一眼路牌', swipe_id: 0, extra: {} });
                t.context.chat.push({ is_user: false, is_system: false, mes: '十几秒后，你仍站在路牌旁。', swipe_id: 0, extra: {} });
            }
            const index = t.context.chat.length - 1;
            await t.context.eventSource.emit('generation_started', 'normal', {}, false);
            await t.context.eventSource.emit('message_received', index);
        }, step);
        await heldPage.waitForFunction((turn) => (
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.continuity?.turn === turn
        ), step, { timeout: 30000 });
    }
    const heldResult = await heldPage.evaluate(() => ({
        calls: structuredClone(window.__TEST__.calls),
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        status: document.querySelector('.mvuad-continuity-status')?.textContent || '',
    }));
    assert.equal(heldResult.calls.continuityRuns, 2, '有具体依据的held不得触发无意义重试');
    assert.equal(heldResult.state.lastTick.action, 'held');
    assert.match(heldResult.state.lastTick.reason, /尚未到/u);
    assert.match(heldResult.status, /条件未成熟/u);
    await heldPage.close();

    const retryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await retryPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await retryPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await retryPage.evaluate(async () => {
        const t = window.__TEST__;
        const originalRun = window.StoryOracleAPI.run;
        let localContinuityRuns = 0;
        window.StoryOracleAPI.run = async (messages) => {
            const system = messages[0].content;
            if (!system.includes('活世界事件')) return originalRun(messages);
            localContinuityRuns += 1;
            t.calls.model.push('continuity');
            t.calls.continuityRuns += 1;
            if (localContinuityRuns === 1) {
                return '<ContinuityState>{"turn":1,"threads":[]}</ContinuityState>';
            }
            return '<ContinuityState>{"turn":1,"threads":[{"id":"WE-重试-街巷-01","title":"街巷水管检修","origin":"ambient","relation":"independent","stage":"seeded","summary":"维修队封闭了一段旧街。","nextBeat":"商户会协商临时进货路线。","trigger":"市政检修按日程推进。","intersection":"玩家进入旧街时才可能观察到。","seedBasis":"世界书：港城街区与市政维护","knowledge":"hidden"}]}</ContinuityState>';
        };
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await retryPage.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.continuity?.turn === 1
    ), null, { timeout: 30000 });
    const retryResult = await retryPage.evaluate(() => ({
        calls: structuredClone(window.__TEST__.calls),
        state: window.MvuAutoDoctorAPI.getContinuityState(),
    }));
    assert.equal(retryResult.calls.continuityRuns, 2, '无实质世界节拍时必须自动重试一次');
    assert.equal(retryResult.state.threads[0].id, 'WE-重试-街巷-01');
    await retryPage.close();
} finally {
    await browser.close();
    server.close();
}

console.log('browser runtime race and continuity tests passed');
