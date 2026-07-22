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
<html><head><link rel="stylesheet" href="/style.css"><style>
:root {
  --SmartThemeBodyColor: #dbe8f1;
  --SmartThemeEmColor: #91a9ba;
  --SmartThemeQuoteColor: #79c8ee;
  --SmartThemeBlurTintColor: #101b27;
  --SmartThemeBorderColor: #415668;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 12px;
  color: var(--SmartThemeBodyColor);
  background: #0d1721;
  font: 14px/1.45 "Microsoft YaHei UI", system-ui, sans-serif;
}
button, select, input {
  min-height: 32px;
  border: 1px solid var(--SmartThemeBorderColor);
  border-radius: 7px;
  color: var(--SmartThemeBodyColor);
  background: #162432;
}
input[type="checkbox"] { min-height: auto; }
</style></head><body>
<div id="extensions_settings2"></div>
<script>
const calls = { model: [], replace: [], prompts: [], toasts: [], order: [], saves: 0, maxConcurrentReplacements: 0, continuitySystem: '', continuityUser: '', continuityRuns: 0, forumSystem: '', forumUser: '', forumRuns: 0 };
const listeners = {};
let latestData = { stat_data: { 账户: { 代币: 2 } }, display_data: {} };
let deferredResolve = null;
let replaceDeferredResolve = null;
let replaceDelayArmed = false;
let activeReplacements = 0;
let mode = 'normal';
let metadataSavesBeforeSwipeChange = -1;
let mvuAlwaysBusy = false;
let corruptNextReplace = false;
let throwNextReplace = false;
let throwRollbackAfterCorruption = false;
let normalizeReplacements = false;
let normalizationVersion = 0;
const chat = [
  { is_user: false, is_system: false, mes: '开场', swipe_id: 0, extra: {} },
  { is_user: true, is_system: false, mes: '继续观察港口', swipe_id: 0, extra: {} },
  { is_user: false, is_system: false, swipe_id: 0, extra: {}, mes:
    '巡逻队开始核对异常货单。私下密谈代号黑雨，只在密室里出现。\\n' +
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
  saveMetadataDebounced() {
    calls.order.push('saveMetadataDebounced');
    calls.saves += 1;
    if (metadataSavesBeforeSwipeChange >= 0) {
      if (metadataSavesBeforeSwipeChange === 0) {
        metadataSavesBeforeSwipeChange = -1;
        context.chat.at(-1).swipe_id = Number(context.chat.at(-1).swipe_id || 0) + 1;
      } else {
        metadataSavesBeforeSwipeChange -= 1;
      }
    }
  },
  updateChatMetadata(patch) { Object.assign(this.chatMetadata, patch); },
  async saveChat() { calls.order.push('saveChat'); calls.saves += 1; },
  updateMessageBlock() {},
  setExtensionPrompt(name, content) { calls.prompts.push([name, content]); },
  eventTypes: {
    GENERATION_STARTED: 'generation_started',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_UPDATED: 'message_updated',
    MESSAGE_SWIPED: 'message_swiped',
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
window.toastr = {
  info(message) { calls.toasts.push(['info', String(message)]); },
  success(message) { calls.toasts.push(['success', String(message)]); },
  warning(message) { calls.toasts.push(['warning', String(message)]); },
};
window.Mvu = {
  isDuringExtraAnalysis: () => mvuAlwaysBusy,
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
    activeReplacements += 1;
    calls.order.push('replace');
    calls.maxConcurrentReplacements = Math.max(calls.maxConcurrentReplacements, activeReplacements);
    calls.replace.push({ chatId: context.chatId, options: structuredClone(options) });
    try {
      if (throwNextReplace) {
        throwNextReplace = false;
        throw new Error('模拟回滚写入失败');
      }
      if (replaceDelayArmed) {
        replaceDelayArmed = false;
        await new Promise((resolve) => { replaceDeferredResolve = resolve; });
        replaceDeferredResolve = null;
      }
      latestData = structuredClone(data);
      if (normalizeReplacements) {
        latestData.display_data ||= {};
        latestData.display_data.__mvu_version = ++normalizationVersion;
      }
      if (corruptNextReplace) {
        corruptNextReplace = false;
        latestData.stat_data.账户.代币 = 999;
        latestData.stat_data.外部并发 = { 标记: '必须保留' };
        if (throwRollbackAfterCorruption) {
          throwRollbackAfterCorruption = false;
          throwNextReplace = true;
        }
      }
    } finally {
      activeReplacements -= 1;
    }
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
      const firstPage = messages[1].content.includes('"posts":[]');
      const pageMark = firstPage ? '' : '（续页' + calls.forumRuns + '）';
      const newPosts = [
        { id: id + '-A', board: '闲聊广场', title: '北门面摊今天是不是淡了点' + pageMark, author: '盐汽水', body: '路过吃了一碗，老板说盐车晚到了。排队时又听见后厨的人讨论北门进货，说昨夜那场雨把盐车堵在旧桥外，今天午后才可能送到。有人觉得只是清淡一点，也有人说汤底和前几日完全不同。摊主没有涨价，还给等得久的人添了半勺肉末。旁边卖饼的倒是趁机忙了起来，不少人端着面去配咸饼。要是傍晚补货真的到了，我再来回一帖，省得大家白跑。顺便提醒第一次去的人，北门这家没有挂大招牌，看到修鞋摊之后往里走十几步就是。午时人最多，想坐靠窗的位置最好提前一点。今天还有两个外地客误以为摊子关门，绕去南街后才听说只是盐车晚到。老板说晚饭照常开火，汤底补齐以后不会另外加价，已经买过午饭的人拿木牌回来还能添一小碗。' + pageMark, kind: 'chat', tags: ['吃喝', '北门'], source: '港城普通生活', heat: 57 },
        { id: id + '-B', board: '求助攻略', title: '夜里去北岸要注意什么' + pageMark, author: '赶夜路的人', body: '第一次走北岸，求问渡船和照明情况。' + pageMark, kind: 'guide', tags: ['求助'], source: '世界书中的港城交通', heat: 4 },
        { id: id + '-C', board: '交易集市', title: '收两盏防风提灯', author: '旧船票', body: '码头风大，普通灯罩用不了多久。', kind: 'trade', tags: ['收购'], source: '港城普通交易', heat: 5 },
        { id: id + '-D', board: '街巷杂谈', title: '钟楼旁那群灰鸽子又回来了', author: '晒网人', body: '一到午后就落满屋檐，看着挺热闹。', kind: 'chat', tags: ['日常'], source: '港城普通生活', heat: 6 },
      ].slice(0, firstPage ? 4 : 2);
      const comments = firstPage ? [
        { postId: id + '-A', author: '老食客', body: '没换老板，是盐车被雨耽搁了。', tone: '解释', likes: 3 },
        { postId: id + '-A', author: '椒粉加倍', body: '难怪今天辣味也压不住清淡。', tone: '打趣', likes: 1 },
        { postId: id + '-B', author: '北岸摆渡', body: '末班看潮水，最好提前半刻钟。', tone: '提醒', likes: 4 },
        { postId: id + '-B', author: '不走夜路', body: '照明还好，石阶湿滑才麻烦。', tone: '补充', likes: 2 },
        { postId: id + '-C', author: '修灯匠', body: '旧市集有铜罩的，价格不便宜。', tone: '建议', likes: 2 },
        { postId: id + '-D', author: '钟声太早', body: '鸽子一直都在，只是前几天躲雨。', tone: '闲聊', likes: 1 },
      ] : [
        { postId: id + '-A', author: '老食客', body: '这一批盐已经补到了。', tone: '更新', likes: 2 },
        { postId: id + '-A', author: '路过北门', body: '晚饭那锅味道正常。', tone: '附和', likes: 1 },
        { postId: id + '-A', author: '盐车学徒', body: '明早还有一车会进北门。', tone: '补充', likes: 1 },
        { postId: id + '-B', author: '北岸摆渡', body: '今夜末班没有改点。', tone: '答复', likes: 3 },
        { postId: id + '-B', author: '潮汐表', body: '还是建议别卡最后一班。', tone: '提醒', likes: 2 },
        { postId: id + '-B', author: '码头灯夫', body: '石阶边的灯今晚会提前点。', tone: '补充', likes: 2 },
      ];
      const orphanSection = (messages[1].content.split('=== 当前零回复孤帖')[1] || '').split('=== 可公开引用')[0] || '';
      const orphanId = orphanSection.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
      if (!firstPage && orphanId) {
        comments.push({ postId: orphanId, author: '挖坟路人', body: '刚看到这个问题，补一条我今天确认过的情况。', tone: '补充', likes: 1 });
      }
      return '<ForumUpdate>' + JSON.stringify({ summary: '港城网友正在聊日常与公开见闻', newPosts, comments, heat: [], archive: [] }) + '</ForumUpdate>';
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
  armReplaceDelay() { replaceDelayArmed = true; },
  releaseReplace() { replaceDeferredResolve?.(); },
  hasDeferredReplace: () => !!replaceDeferredResolve,
  armSwipeChangeOnMetadataSave(skip = 0) { metadataSavesBeforeSwipeChange = Math.max(0, Number(skip) || 0); },
  setSwipeId(value) { context.chat.at(-1).swipe_id = value; },
  setMvuBusy(value) { mvuAlwaysBusy = !!value; },
  setNormalizeReplacements(value) { normalizeReplacements = !!value; },
  armCorruptReplace() { corruptNextReplace = true; },
  armCorruptThenThrowRollback() {
    corruptNextReplace = true;
    throwRollbackAfterCorruption = true;
  },
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
const secretEntry = {
  uid: 8, world: '港城', comment: '隐藏幕后密令',
  constant: true, disable: false, order: 8,
  key: ['秘密', '城防'],
  content: '地下密令要求城防在午夜秘密清洗知情者，此事绝不能出现在公开论坛。'
};
const disguisedSecretEntry = {
  uid: 9, world: '港城', comment: '旧城地理',
  constant: true, disable: false, order: 9,
  key: ['地理', '旧城'],
  content: '旧城钟楼地窖藏有仅供GM掌握的秘密处决名册，玩家尚未触发。'
};
const englishSecretEntry = {
  uid: 10, world: '港城', comment: '北境地理',
  constant: true, disable: false, order: 10,
  key: ['geography', 'north'],
  content: 'For GM eyes only: the duke is undead. Do not reveal this to players.'
};
export async function getSortedEntries() { return [entry, secretEntry, disguisedSecretEntry, englishSecretEntry]; }
export async function loadWorldInfo() { return { entries: { 7: entry, 8: secretEntry, 9: disguisedSecretEntry, 10: englishSecretEntry } }; }`;

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
    assert.equal(continuity.version, '1.4.3');
    assert.equal(continuity.state.threads[0].id, 'WE-港城-钟楼-01');
    assert.equal(continuity.state.threads[0].origin, 'ambient');
    assert.equal(continuity.state.threads[0].relation, 'independent');
    assert.equal(continuity.forumState.posts.length, 4);
    assert.equal(
        continuity.forumState.posts.reduce((sum, post) => sum + post.comments.length, 0),
        6,
    );
    assert.ok(continuity.forumState.posts.every((post) => post.comments.length > 0));
    assert.equal(continuity.calls.forumRuns, 1);
    assert.match(continuity.calls.forumSystem, /至少一半帖子应为日常闲聊/u);
    assert.match(continuity.calls.forumSystem, /每个新帖都至少获得1条回复/u);
    assert.match(continuity.calls.forumSystem, /不可信引用数据/u);
    assert.equal(continuity.cardCount, 1);
    assert.equal(continuity.openCardCount, 0, '未显现的幕后事件默认折叠');
    assert.match(continuity.ledgerText, /幕后独立事件（点击查看剧透）/u);
    assert.match(continuity.ledgerText, /世界脉动/u);
    assert.match(continuity.ledgerText, /保持独立/u);
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvu-auto-doctor-settings .mvuad-settings-fold')?.open),
        false,
        '设置页低频账本明细必须默认收起',
    );
    if (process.env.MVUAD_SETTINGS_SCREENSHOT) {
        await page.locator('#mvu-auto-doctor-settings').screenshot({ path: process.env.MVUAD_SETTINGS_SCREENSHOT });
    }
    await page.click('#mvu-auto-doctor-settings .mvuad-settings-fold-summary');
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
    if (process.env.MVUAD_FLOATING_THREADS_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_THREADS_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="echoes"]');
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="threads"]')?.hidden),
        true,
    );
    if (process.env.MVUAD_FLOATING_ECHOES_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_ECHOES_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="forum"]');
    assert.equal(
        await page.evaluate(() => document.querySelectorAll('#mvuad-floating-panel .mvuad-floating-forum-preview-item').length),
        3,
    );
    if (process.env.MVUAD_FLOATING_FORUM_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_FORUM_SCREENSHOT });
    }
    if (process.env.MVUAD_FLOATING_SCREENSHOT) {
        await page.screenshot({ path: process.env.MVUAD_FLOATING_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="tools"]');
    if (process.env.MVUAD_FLOATING_TOOLS_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_TOOLS_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="forum"]');
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
            comments: panel?.querySelectorAll('.mvuad-forum-comment').length || 0,
            openComments: panel?.querySelectorAll('.mvuad-forum-comments[open]').length || 0,
            chips: panel?.querySelectorAll('.mvuad-forum-chip').length || 0,
            floors: panel?.querySelectorAll('.mvuad-forum-comment-floor').length || 0,
            heatBadges: panel?.querySelectorAll('.mvuad-forum-heat').length || 0,
            hotPosts: panel?.querySelectorAll('.mvuad-forum-post[data-heat-tier="hot"]').length || 0,
            longBodies: panel?.querySelectorAll('.mvuad-forum-body-details').length || 0,
            feedEnds: panel?.querySelectorAll('.mvuad-forum-feed-end').length || 0,
            clearInsideToolbar: panel?.querySelectorAll('.mvuad-forum-toolbar .mvuad-forum-clear').length || 0,
            statusHidden: !!panel?.querySelector('.mvuad-forum-status')?.hidden,
            statusKind: panel?.querySelector('.mvuad-forum-status')?.dataset.kind || '',
            text: panel?.textContent || '',
            externalHidden: !!panel?.querySelector('.mvuad-forum-external')?.hidden,
        };
    });
    assert.equal(forumPanel.hidden, false);
    assert.ok(forumPanel.left >= 0 && forumPanel.right <= 391);
    assert.equal(forumPanel.posts, 4);
    assert.equal(forumPanel.comments, 6);
    assert.equal(forumPanel.openComments, 1, '首个活跃帖应默认展开回复，让论坛打开即有互动感');
    assert.equal(forumPanel.chips, 5);
    assert.equal(forumPanel.floors, 6);
    assert.equal(forumPanel.heatBadges, 4);
    assert.equal(forumPanel.hotPosts, 1);
    assert.equal(forumPanel.longBodies, 1);
    assert.equal(forumPanel.feedEnds, 1);
    assert.equal(forumPanel.clearInsideToolbar, 0, '清空操作不得继续与刷新按钮同级拥挤');
    assert.equal(forumPanel.statusHidden, false);
    assert.equal(forumPanel.statusKind, 'ok', '刚完成刷新时只保留明确的成功状态行');
    assert.match(forumPanel.text, /北门面摊/u);
    assert.match(forumPanel.text, /评论 2/u);
    assert.match(forumPanel.text, /来源：医生内置论坛/u);
    assert.match(forumPanel.text, /内置自动：每 1 个 AI 回合/u);
    assert.equal(forumPanel.externalHidden, true, '未安装Zsd时仍必须显示内置论坛，而不是空跳转');
    await page.click('.mvuad-forum-body-details > summary');
    assert.equal(
        await page.evaluate(() => document.querySelector('.mvuad-forum-body-details')?.open),
        true,
        '长帖必须可以展开查看全文',
    );
    await page.click('.mvuad-forum-body-details > summary');
    if (process.env.MVUAD_FORUM_PANEL_SCREENSHOT) {
        await page.locator('#mvuad-forum-panel .mvuad-forum-shell').screenshot({
            path: process.env.MVUAD_FORUM_PANEL_SCREENSHOT,
        });
    }
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
    assert.match(continuity.calls.continuitySystem, /不可信引用数据/u);
    assert.match(continuity.calls.continuitySystem, /可以永远不与主线相交/u);
    assert.match(continuity.calls.continuitySystem, /禁止从骰池挑成功数字或先写结果后补检定/u);
    assert.match(continuity.calls.continuityUser, /钟楼巡检制度/u);
    assert.match(continuity.calls.continuityUser, /巡检员与玩家互不认识/u);
    assert.match(continuity.calls.continuityUser, /地下密令/u, '连续性调度仍需读取幕后设定');
    assert.doesNotMatch(
        continuity.calls.forumUser,
        /地下密令|私下密谈代号黑雨|秘密处决名册|the duke is undead/iu,
        '论坛模型不得接收隐藏世界书或最近私密正文',
    );
    assert.match(continuity.calls.forumUser, /钟楼巡检制度/u, '明确公开的世界制度仍可供论坛取材');
    assert.ok(continuity.calls.prompts.some(([, content]) => /禁止替玩家角色决定/u.test(content)));
    assert.equal(continuity.calls.replace[0].chatId, 'chat-a');
    assert.equal(continuity.calls.replace[0].options.message_id, 2);
    assert.ok(
        continuity.calls.order.indexOf('saveChat') >= 0
        && continuity.calls.order.indexOf('saveChat') < continuity.calls.order.indexOf('replace'),
        '写前恢复记录必须等待可持久化保存完成，之后才能调用 replaceMvuData',
    );
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
                if (step === 2) {
                    const orphan = t.context.chatMetadata?.mvu_auto_doctor?.forum?.posts?.find((post) => post.id === 'FP-1-A');
                    if (orphan) orphan.comments = [];
                }
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
        await lifecyclePage.waitForFunction((expected) => (
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.turn === expected
        ), turn, { timeout: 30000 }).catch(async (error) => {
            console.error('forum lifecycle timeout diagnostics', await lifecyclePage.evaluate((expected) => ({
                expected,
                forum: window.MvuAutoDoctorAPI.getForumState(),
                forumRuns: window.__TEST__.calls.forumRuns,
                forumStatus: document.querySelector('.mvuad-settings-forum-status')?.textContent || '',
                forumUser: window.__TEST__.calls.forumUser,
            }), turn));
            throw error;
        });
    }
    const lifecycle = await lifecyclePage.evaluate(() => ({
        version: window.MvuAutoDoctorAPI.version,
        calls: structuredClone(window.__TEST__.calls),
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        forumState: window.MvuAutoDoctorAPI.getForumState(),
        ledgerText: document.querySelector('#mvu-auto-doctor-settings .mvuad-ledger')?.textContent || '',
    }));
    assert.equal(lifecycle.version, '1.4.3');
    assert.equal(lifecycle.calls.continuityRuns, 4, '每个完成的AI回复都必须运行一次世界节拍');
    assert.equal(lifecycle.calls.forumRuns, 4, '内置来源必须在每个完成的AI回复后自动刷新');
    assert.equal(lifecycle.state.turn, 4);
    assert.equal(
        lifecycle.forumState.turn,
        4,
    );
    assert.ok(
        lifecycle.forumState.posts.find((post) => post.id === 'FP-1-A')?.comments.length > 0,
        '后续自动刷新必须优先给零回复旧帖补楼',
    );
    assert.equal(lifecycle.state.threads.find((thread) => thread.id === 'PE-货单-追查-01').stage, 'advancing');
    const ended = lifecycle.state.threads.find((thread) => thread.id === 'WE-港城-钟楼-01');
    assert.equal(ended.stage, 'resolved');
    assert.match(ended.effects.join(''), /双人签字/u);
    assert.match(ended.rumors.join(''), /秘密复核/u);
    assert.ok(lifecycle.state.threads.some((thread) => (
        thread.id === 'WE-钟楼-双签-01'
        && thread.causedBy.includes('WE-港城-钟楼-01')
    )));
    const lifecyclePrompts = lifecycle.calls.prompts.map(([, content]) => content).join('\n');
    assert.doesNotMatch(
        lifecyclePrompts,
        /钟楼巡检的缺页交接册|补办了归档手续|双人签字的交接制度|秘密复核夜间报时/u,
        '隐藏且未汇流的已收束事件必须保留在后台账本，不得泄露进正文提示',
    );
    assert.match(lifecycle.ledgerText, /烧毁货单后的泄密追查/u);
    assert.match(lifecycle.ledgerText, /已收束支线（1）/u);
    await lifecyclePage.close();

    const doubleWriterPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await doubleWriterPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await doubleWriterPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await doubleWriterPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 300;
        const lockedSettings = {};
        Object.defineProperty(lockedSettings, 'autoDiagnoseEnabled', {
            configurable: false,
            enumerable: true,
            get: () => true,
            set: () => { throw new Error('Story Oracle settings are read-only'); },
        });
        window.StoryOracleAPI.context.getSettings = () => lockedSettings;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await doubleWriterPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getForumState().turn === 1
    ), null, { timeout: 30000 });
    const doubleWriter = await doubleWriterPage.evaluate(() => ({
        replacements: window.__TEST__.calls.replace.length,
        status: window.MvuAutoDoctorAPI.getStatus(),
        continuityTurn: window.MvuAutoDoctorAPI.getContinuityState().turn,
        forumTurn: window.MvuAutoDoctorAPI.getForumState().turn,
    }));
    assert.equal(doubleWriter.replacements, 0, '无法关闭故事神谕 AUTO 时不得写 MVU');
    assert.match(doubleWriter.status, /避免双写/u);
    assert.equal(doubleWriter.continuityTurn, 1, '只读支线调度仍应继续');
    assert.equal(doubleWriter.forumTurn, 1, '独立论坛仍应继续');
    await doubleWriterPage.close();

    const copiedSettingsPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await copiedSettingsPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await copiedSettingsPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await copiedSettingsPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 300;
        window.StoryOracleAPI.context.getSettings = () => ({ autoDiagnoseEnabled: true });
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await copiedSettingsPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getForumState().turn === 1
    ), null, { timeout: 30000 });
    assert.equal(
        await copiedSettingsPage.evaluate(() => window.__TEST__.calls.replace.length),
        0,
        '故事神谕每次返回新设置副本且 AUTO 仍开启时不得写 MVU',
    );
    await copiedSettingsPage.close();

    const commitGuardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await commitGuardPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await commitGuardPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await commitGuardPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 0;
        t.setMode('defer');
        let settingsReads = 0;
        window.StoryOracleAPI.context.getSettings = () => {
            settingsReads += 1;
            return { autoDiagnoseEnabled: settingsReads > 1 };
        };
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await commitGuardPage.waitForFunction(() => window.__TEST__.hasDeferred(), null, { timeout: 20000 });
    await commitGuardPage.evaluate(() => {
        window.__TEST__.resolveRepair('<UpdateVariable><Analysis>提交前复查</Analysis><JSONPatch>[{"op":"delta","path":"/账户/代币","value":1}]</JSONPatch></UpdateVariable>');
    });
    await commitGuardPage.waitForTimeout(1200);
    const commitGuard = await commitGuardPage.evaluate(() => ({
        replacements: window.__TEST__.calls.replace.length,
        status: window.MvuAutoDoctorAPI.getStatus(),
    }));
    assert.equal(commitGuard.replacements, 0, '提交屏障前发现神谕 AUTO 重开时不得写 MVU');
    assert.match(commitGuard.status, /避免双写/u);
    await commitGuardPage.close();

    const legacyGuardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await legacyGuardPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await legacyGuardPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const legacyGuard = await legacyGuardPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 0;
        t.setLatestData({
            stat_data: { 账户: { 代币: 2 }, 其他: { 旧字段: 7 } },
            display_data: {},
        });
        const originalParse = window.Mvu.parseMessage.bind(window.Mvu);
        window.Mvu.parseMessage = async (...args) => {
            const parsed = await originalParse(...args);
            delete parsed.stat_data.其他;
            return parsed;
        };
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            replacements: t.calls.replace.length,
            state: t.getLatestData(),
        };
    });
    assert.equal(legacyGuard.result.status, 'failed');
    assert.match(legacyGuard.result.reason, /旧字段/u);
    assert.equal(legacyGuard.replacements, 0, '解析器剥离未触碰旧字段时不得进入写入阶段');
    assert.equal(legacyGuard.state.stat_data.其他.旧字段, 7);
    await legacyGuardPage.close();

    const writeMutexPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await writeMutexPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await writeMutexPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await writeMutexPage.evaluate(() => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 0;
        t.setNormalizeReplacements(true);
        t.armReplaceDelay();
        window.__WRITE_MUTEX__ = {
            repair: window.MvuAutoDoctorAPI.runLatest(),
        };
    });
    await writeMutexPage.waitForFunction(() => window.__TEST__.hasDeferredReplace(), null, { timeout: 20000 });
    await writeMutexPage.evaluate(() => {
        window.__WRITE_MUTEX__.undo = window.MvuAutoDoctorAPI.undoLast();
    });
    await writeMutexPage.waitForTimeout(150);
    const writeMutexMid = await writeMutexPage.evaluate(() => ({
        replacements: window.__TEST__.calls.replace.length,
        maxConcurrent: window.__TEST__.calls.maxConcurrentReplacements,
    }));
    assert.equal(writeMutexMid.replacements, 1, '撤销必须等待正在进行的 MVU 写入完成');
    assert.equal(writeMutexMid.maxConcurrent, 1);
    const writeMutex = await writeMutexPage.evaluate(async () => {
        window.__TEST__.releaseReplace();
        const [repair, undone] = await Promise.all([
            window.__WRITE_MUTEX__.repair,
            window.__WRITE_MUTEX__.undo,
        ]);
        return {
            repair,
            undone,
            state: window.__TEST__.getLatestData(),
            calls: structuredClone(window.__TEST__.calls),
            journal: structuredClone(
                window.__TEST__.context.chatMetadata.mvu_auto_doctor.repairJournal,
            ),
        };
    });
    assert.equal(writeMutex.repair.status, 'applied');
    assert.equal(writeMutex.undone, true);
    assert.equal(writeMutex.state.stat_data.账户.代币, 2);
    assert.equal(writeMutex.state.display_data.__mvu_version, 2, '普通撤销须容忍 MVU 每次写入重建归一化字段');
    assert.equal(writeMutex.calls.replace.length, 2);
    assert.equal(writeMutex.calls.maxConcurrentReplacements, 1, '所有 MVU 写入必须严格串行');
    assert.equal(writeMutex.journal.at(-1).status, 'undone');
    await writeMutexPage.close();

    const continueInterruptPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await continueInterruptPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await continueInterruptPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await continueInterruptPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 0;
        t.setMode('defer');
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await continueInterruptPage.waitForFunction(() => window.__TEST__.hasDeferred(), null, { timeout: 20000 });
    await continueInterruptPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].mes += '\n续写已经开始。';
        await t.context.eventSource.emit('generation_started', 'continue', {}, false);
        t.resolveRepair('<UpdateVariable><Analysis>旧请求不得落地</Analysis><JSONPatch>[{"op":"delta","path":"/账户/代币","value":9}]</JSONPatch></UpdateVariable>');
    });
    await continueInterruptPage.waitForTimeout(1200);
    assert.equal(
        await continueInterruptPage.evaluate(() => window.__TEST__.calls.replace.length),
        0,
        'continue 开始后，挂起的旧 repair 结果不得写入同一楼层',
    );
    await continueInterruptPage.close();

    const undoGuardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await undoGuardPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await undoGuardPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await undoGuardPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 0;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await undoGuardPage.waitForFunction(() => window.__TEST__.calls.replace.length === 1, null, { timeout: 20000 });
    const guardedUndo = await undoGuardPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setLatestData({ stat_data: { 账户: { 代币: 99 } }, display_data: {} });
        const undone = await window.MvuAutoDoctorAPI.undoLast();
        return { undone, data: t.getLatestData() };
    });
    assert.equal(guardedUndo.undone, false, '修复后出现其他进度时必须拒绝撤销');
    assert.equal(guardedUndo.data.stat_data.账户.代币, 99, '拒绝撤销不得覆盖后续进度');
    await undoGuardPage.close();

    const metadataRacePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await metadataRacePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await metadataRacePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await metadataRacePage.evaluate(() => {
        const originalRun = window.StoryOracleAPI.run;
        const pending = {};
        window.__METADATA_RACE__ = { pending };
        window.StoryOracleAPI.run = (messages) => {
            const system = messages[0].content;
            if (system.includes('活世界事件')) {
                return new Promise((resolve) => { pending.continuity = resolve; });
            }
            if (system.includes('独立网络论坛模拟器')) {
                return new Promise((resolve) => { pending.forum = resolve; });
            }
            return originalRun(messages);
        };
        window.__METADATA_RACE__.forumPromise = window.MvuAutoDoctorAPI.runForum();
    });
    await metadataRacePage.waitForFunction(() => (
        !!window.__METADATA_RACE__?.pending?.forum
    ), null, { timeout: 20000 });
    await metadataRacePage.evaluate(() => {
        window.__METADATA_RACE__.continuityPromise = window.MvuAutoDoctorAPI.runContinuity();
    });
    await metadataRacePage.waitForFunction(() => (
        !!window.__METADATA_RACE__?.pending?.continuity
    ), null, { timeout: 20000 });
    await metadataRacePage.evaluate(() => {
        const posts = ['A', 'B', 'C', 'D'].map((suffix, index) => ({
            id: `RACE-${suffix}`,
            board: '公开广场',
            title: `并发测试帖子${suffix}`,
            author: `网友${suffix}`,
            body: `这是第${index + 1}条公开日常帖子。`,
            kind: 'chat',
            source: '公开日常',
            heat: index + 1,
        }));
        const comments = [
            ['A', '甲'], ['A', '乙'], ['B', '丙'],
            ['B', '丁'], ['C', '戊'], ['D', '己'],
        ].map(([suffix, author]) => ({
            postId: `RACE-${suffix}`,
            author,
            body: `${author}的公开回复`,
            likes: 1,
        }));
        window.__METADATA_RACE__.pending.forum(
            `<ForumUpdate>${JSON.stringify({ summary: '并发论坛页', newPosts: posts, comments })}</ForumUpdate>`,
        );
    });
    await metadataRacePage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getForumState().turn === 1
    ), null, { timeout: 20000 });
    await metadataRacePage.evaluate(() => {
        window.__METADATA_RACE__.pending.continuity(
            '<ContinuityState>{"turn":1,"threads":[{"id":"RACE-WORLD-01","title":"并发世界事件","origin":"ambient","relation":"independent","stage":"seeded","summary":"公开市集照常轮换摊位。","nextBeat":"下一批摊主登记。","trigger":"市集日程推进。","intersection":"玩家到访市集时才可能观察到。","seedBasis":"公开制度：市集轮换","knowledge":"hidden"}]}</ContinuityState>',
        );
    });
    await metadataRacePage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 1
    ), null, { timeout: 20000 });
    const metadataRace = await metadataRacePage.evaluate(async () => {
        await Promise.all([
            window.__METADATA_RACE__.continuityPromise,
            window.__METADATA_RACE__.forumPromise,
        ]);
        return {
            continuity: window.MvuAutoDoctorAPI.getContinuityState(),
            forum: window.MvuAutoDoctorAPI.getForumState(),
        };
    });
    assert.equal(metadataRace.continuity.turn, 1);
    assert.equal(metadataRace.forum.turn, 1, '并发连续性写入不得覆盖刚保存的论坛页');
    assert.equal(metadataRace.forum.posts.length, 4);
    await metadataRacePage.close();

    const continueCheckpointPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await continueCheckpointPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await continueCheckpointPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await continueCheckpointPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 300;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await continueCheckpointPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 1
        && window.MvuAutoDoctorAPI.getForumState().turn === 1
    ), null, { timeout: 30000 });
    const checkpointBeforeContinue = await continueCheckpointPage.evaluate(() => ({
        continuityTurn: window.__TEST__.context.chatMetadata.mvu_auto_doctor.continuityCheckpoint?.state?.turn,
        forumTurn: window.__TEST__.context.chatMetadata.mvu_auto_doctor.forumCheckpoint?.state?.turn,
    }));
    assert.equal(checkpointBeforeContinue.continuityTurn, 0);
    assert.equal(checkpointBeforeContinue.forumTurn, 0);
    await continueCheckpointPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].mes += '\n同一楼层的继续生成内容。';
        await t.context.eventSource.emit('generation_started', 'continue', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await continueCheckpointPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 2
        && window.MvuAutoDoctorAPI.getForumState().turn === 2
    ), null, { timeout: 30000 });
    const checkpointAfterContinue = await continueCheckpointPage.evaluate(() => ({
        continuityTurn: window.__TEST__.context.chatMetadata.mvu_auto_doctor.continuityCheckpoint?.state?.turn,
        forumTurn: window.__TEST__.context.chatMetadata.mvu_auto_doctor.forumCheckpoint?.state?.turn,
    }));
    assert.equal(
        checkpointAfterContinue.continuityTurn,
        0,
        'continue 不得把整楼生成前的连续性存档点覆盖成中间状态',
    );
    assert.equal(
        checkpointAfterContinue.forumTurn,
        0,
        'continue 不得把整楼生成前的论坛存档点覆盖成中间状态',
    );
    await continueCheckpointPage.close();

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
    assert.equal(forumReroll.state.posts.length, 4);
    assert.ok(forumReroll.state.posts.every((post) => post.id.startsWith('FP-2')));
    assert.ok(!forumReroll.state.posts.some((post) => post.id.startsWith('FP-1')));
    await forumRerollPage.close();

    const externalForumPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await externalForumPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await externalForumPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await externalForumPage.evaluate(async () => {
        const external = document.createElement('button');
        external.id = 'zsd-forum-orb';
        external.addEventListener('click', () => { window.__zsdClicks = (window.__zsdClicks || 0) + 1; });
        document.body.appendChild(external);
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await externalForumPage.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.turn === 1
    ), null, { timeout: 30000 });
    const externalForumBuiltin = await externalForumPage.evaluate(() => ({
        forum: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
        externalButtonHidden: document.querySelector('.mvuad-forum-external')?.hidden,
        summary: document.querySelector('.mvuad-forum-summary')?.textContent || '',
        note: document.querySelector('.mvuad-forum-source-note')?.textContent || '',
    }));
    assert.equal(externalForumBuiltin.forum.turn, 1, '安装Zsd不得让默认内置论坛静默停更');
    assert.equal(externalForumBuiltin.calls.forumRuns, 1);
    assert.equal(externalForumBuiltin.externalButtonHidden, false);
    assert.match(externalForumBuiltin.summary, /来源：医生内置论坛/u);
    assert.match(externalForumBuiltin.note, /额外产生模型请求/u);
    await externalForumPage.selectOption('.mvuad-forum-provider-settings', 'zsd');
    await externalForumPage.click('.mvuad-forum-open');
    await externalForumPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat.push({ is_user: true, is_system: false, mes: '继续看看街上', swipe_id: 0, extra: {} });
        t.context.chat.push({ is_user: false, is_system: false, mes: '街面依旧热闹。', swipe_id: 0, extra: {} });
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 4);
    });
    await externalForumPage.waitForFunction(() => (
        /当前来源为 Zsd/u.test(document.querySelector('.mvuad-settings-forum-status')?.textContent || '')
    ), null, { timeout: 30000 });
    const externalForumSelected = await externalForumPage.evaluate(() => ({
        forum: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
        provider: window.__TEST__.context.extensionSettings.mvu_auto_doctor.forumProvider,
        zsdClicks: window.__zsdClicks || 0,
    }));
    assert.equal(externalForumSelected.provider, 'zsd');
    assert.equal(externalForumSelected.forum.turn, 1, '主动选择Zsd后医生内置论坛才暂停');
    assert.equal(externalForumSelected.calls.forumRuns, 1);
    assert.equal(externalForumSelected.zsdClicks, 1);
    await externalForumPage.close();

    const swipeOnlyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await swipeOnlyPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await swipeOnlyPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await swipeOnlyPage.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await swipeOnlyPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 1
        && window.MvuAutoDoctorAPI.getForumState().turn === 1
    ), null, { timeout: 30000 });
    const modelCallsBeforeSwipe = await swipeOnlyPage.evaluate(() => (
        window.__TEST__.calls.model.length
    ));
    await swipeOnlyPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].swipe_id = 1;
        t.context.chat[2].mes = '手动切换到已有的另一个 swipe，没有触发生成。';
        await t.context.eventSource.emit('message_swiped', 2);
    });
    await swipeOnlyPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 0
        && window.MvuAutoDoctorAPI.getForumState().turn === 0
    ), null, { timeout: 10000 });
    const swipeOnly = await swipeOnlyPage.evaluate(() => ({
        continuity: window.MvuAutoDoctorAPI.getContinuityState(),
        forum: window.MvuAutoDoctorAPI.getForumState(),
        modelCalls: window.__TEST__.calls.model.length,
        continuityStatus: document.querySelector('.mvuad-continuity-status')?.textContent || '',
        forumStatus: document.querySelector('.mvuad-settings-forum-status')?.textContent || '',
    }));
    assert.equal(swipeOnly.modelCalls, modelCallsBeforeSwipe, '手动切 swipe 不得暗中产生模型费用');
    assert.equal(swipeOnly.continuity.threads.length, 0, '手动切 swipe 必须回退本楼的连续性分支');
    assert.equal(swipeOnly.forum.posts.length, 0, '手动切 swipe 必须回退本楼的论坛分支');
    assert.match(swipeOnly.continuityStatus, /生成前存档点/u);
    assert.match(swipeOnly.forumStatus, /生成前存档点/u);
    await swipeOnlyPage.close();

    const swipeFallbackPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await swipeFallbackPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await swipeFallbackPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await swipeFallbackPage.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await swipeFallbackPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 1
        && window.MvuAutoDoctorAPI.getForumState().turn === 1
    ), null, { timeout: 30000 });
    const fallbackCallsBefore = await swipeFallbackPage.evaluate(() => (
        window.__TEST__.calls.model.length
    ));
    await swipeFallbackPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].swipe_id = 1;
        t.context.chat[2].mes = '宿主没有发出 message_swiped，但下一次生成即将开始。';
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
    });
    const swipeFallback = await swipeFallbackPage.evaluate(() => ({
        continuityTurn: window.MvuAutoDoctorAPI.getContinuityState().turn,
        forumTurn: window.MvuAutoDoctorAPI.getForumState().turn,
        modelCalls: window.__TEST__.calls.model.length,
    }));
    assert.equal(swipeFallback.continuityTurn, 0);
    assert.equal(swipeFallback.forumTurn, 0);
    assert.equal(
        swipeFallback.modelCalls,
        fallbackCallsBefore,
        '缺少 swipe 事件时也必须在下一次生成注入前无模型回退分支',
    );
    await swipeFallbackPage.close();

    const refreshFailurePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await refreshFailurePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await refreshFailurePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const refreshFailure = await refreshFailurePage.evaluate(async () => {
        const t = window.__TEST__;
        // The write-ahead journal uses awaited saveChat and does not enter this
        // debounced hook. Change swipe on the first post-write journal save,
        // immediately before frontend refresh.
        t.armSwipeChangeOnMetadataSave(0);
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            swipeId: t.context.chat[2].swipe_id,
            message: t.context.chat[2].mes,
            journal: structuredClone(t.context.chatMetadata.mvu_auto_doctor.repairJournal),
            toasts: structuredClone(t.calls.toasts),
        };
    });
    assert.equal(refreshFailure.result.status, 'applied');
    assert.equal(refreshFailure.result.frontendSynced, false);
    assert.equal(refreshFailure.result.journalPersisted, true);
    assert.equal(refreshFailure.data.stat_data.账户.代币, 3);
    assert.equal(refreshFailure.swipeId, 1);
    assert.equal(refreshFailure.journal.length, 1, '刷新失败前必须先留下修复日志');
    assert.equal(refreshFailure.journal[0].frontendSynced, false);
    assert.doesNotMatch(refreshFailure.message, /补齐明确变化/u, '不得把纠错块写进新 swipe');
    assert.ok(refreshFailure.toasts.some(([kind, message]) => (
        kind === 'warning' && /可回到原 swipe 撤销/u.test(message)
    )), '刷新失败必须明确告知变量已改且仍可撤销');
    const refreshFailureUndo = await refreshFailurePage.evaluate(async () => {
        const t = window.__TEST__;
        t.setSwipeId(0);
        const undone = await window.MvuAutoDoctorAPI.undoLast();
        return {
            undone,
            data: t.getLatestData(),
            journal: structuredClone(t.context.chatMetadata.mvu_auto_doctor.repairJournal),
        };
    });
    assert.equal(refreshFailureUndo.undone, true, '回到原 swipe 后，刷新失败的修复仍必须可撤销');
    assert.equal(refreshFailureUndo.data.stat_data.账户.代币, 2);
    assert.equal(refreshFailureUndo.journal.at(-1).status, 'undone');
    await refreshFailurePage.close();

    const writeCompletionRacePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await writeCompletionRacePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await writeCompletionRacePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await writeCompletionRacePage.evaluate(() => {
        const t = window.__TEST__;
        t.setNormalizeReplacements(true);
        t.armReplaceDelay();
        window.__WRITE_COMPLETION_RACE__ = window.MvuAutoDoctorAPI.runLatest();
    });
    await writeCompletionRacePage.waitForFunction(() => window.__TEST__.hasDeferredReplace());
    const writeCompletionRace = await writeCompletionRacePage.evaluate(async () => {
        const t = window.__TEST__;
        t.setSwipeId(1);
        t.releaseReplace();
        const result = await window.__WRITE_COMPLETION_RACE__;
        return {
            result,
            data: t.getLatestData(),
            message: t.context.chat[2].mes,
            journal: structuredClone(t.context.chatMetadata.mvu_auto_doctor.repairJournal),
            toasts: structuredClone(t.calls.toasts),
        };
    });
    assert.equal(writeCompletionRace.result.status, 'applied');
    assert.equal(writeCompletionRace.result.frontendSynced, false);
    assert.equal(writeCompletionRace.result.journalPersisted, true);
    assert.equal(writeCompletionRace.data.stat_data.账户.代币, 3);
    assert.equal(writeCompletionRace.journal.length, 1, '异步写入完成前目标失效也必须保留写前恢复记录');
    assert.equal(writeCompletionRace.journal[0].status, 'applied');
    assert.equal(writeCompletionRace.journal[0].writeCompleted, true);
    assert.doesNotMatch(writeCompletionRace.message, /补齐明确变化/u, '目标失效后不得刷新新 swipe 正文');
    assert.ok(writeCompletionRace.toasts.some(([kind, message]) => (
        kind === 'warning' && /写前快照已保存/u.test(message)
    )), '异步写入完成后目标失效必须明确告警且指出恢复记录');
    const writeCompletionRaceUndo = await writeCompletionRacePage.evaluate(async () => {
        const t = window.__TEST__;
        t.setSwipeId(0);
        const undone = await window.MvuAutoDoctorAPI.undoLast();
        return {
            undone,
            data: t.getLatestData(),
            journal: structuredClone(t.context.chatMetadata.mvu_auto_doctor.repairJournal),
        };
    });
    assert.equal(writeCompletionRaceUndo.undone, true, '回到原 swipe 后必须可撤销完成后失效的写入');
    assert.equal(writeCompletionRaceUndo.data.stat_data.账户.代币, 2);
    assert.equal(writeCompletionRaceUndo.data.display_data.__mvu_version, 2, '撤销须容忍 MVU 每次写入重建归一化字段');
    assert.equal(writeCompletionRaceUndo.journal.at(-1).status, 'undone');
    await writeCompletionRacePage.close();

    const rollbackPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await rollbackPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await rollbackPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const rollback = await rollbackPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setNormalizeReplacements(true);
        t.armCorruptReplace();
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            replacements: t.calls.replace.length,
            journal: t.context.chatMetadata.mvu_auto_doctor?.repairJournal || [],
        };
    });
    assert.equal(rollback.result.status, 'failed');
    assert.match(rollback.result.reason, /已回滚并确认本次触碰路径/u);
    assert.equal(rollback.data.stat_data.账户.代币, 2);
    assert.equal(rollback.data.stat_data.外部并发.标记, '必须保留');
    assert.equal(rollback.data.display_data.__mvu_version, 2, '路径级回滚回读须容忍 MVU 每次写入重建归一化字段');
    assert.equal(rollback.replacements, 2, '失败写入后必须执行并回读一次路径级回滚');
    assert.equal(rollback.journal.length, 0, '未落地的修复不得成为可撤销成功记录');
    await rollbackPage.close();

    const rollbackFailurePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await rollbackFailurePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await rollbackFailurePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const rollbackFailure = await rollbackFailurePage.evaluate(async () => {
        const t = window.__TEST__;
        t.armCorruptThenThrowRollback();
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            replacements: t.calls.replace.length,
            journal: structuredClone(t.context.chatMetadata.mvu_auto_doctor.repairJournal),
            toasts: structuredClone(t.calls.toasts),
        };
    });
    assert.equal(rollbackFailure.result.status, 'applied');
    assert.equal(rollbackFailure.result.frontendSynced, false);
    assert.match(rollbackFailure.result.reason, /回滚未能确认|写前快照已保留/u);
    assert.equal(rollbackFailure.replacements, 2);
    assert.equal(rollbackFailure.data.stat_data.账户.代币, 999);
    assert.equal(rollbackFailure.journal.length, 1, '回滚失败时必须保留可核验恢复记录');
    assert.equal(rollbackFailure.journal[0].status, 'applied');
    assert.ok(rollbackFailure.toasts.some(([kind, message]) => (
        kind === 'warning' && /写前快照已保留/u.test(message)
    )));
    await rollbackFailurePage.close();

    const busyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await busyPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await busyPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const busy = await busyPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor = {
            mvuIdleTimeoutMs: 100,
            mvuStableTimeoutMs: 100,
        };
        t.setMvuBusy(true);
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return { result, calls: structuredClone(t.calls) };
    });
    assert.equal(busy.result.status, 'busy');
    assert.match(busy.result.reason, /仍在更新/u);
    assert.equal(busy.calls.replace.length, 0);
    assert.equal(busy.calls.model.length, 0, 'MVU 持续繁忙时必须在调用模型前安全终止');
    await busyPage.close();

    const deletionRacePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await deletionRacePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await deletionRacePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await deletionRacePage.evaluate(() => {
        const t = window.__TEST__;
        t.setMode('defer');
        window.__DELETION_RACE__ = window.MvuAutoDoctorAPI.runLatest();
    });
    await deletionRacePage.waitForFunction(() => window.__TEST__.hasDeferred(), null, { timeout: 20000 });
    const deletionRace = await deletionRacePage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat.splice(2, 1);
        t.resolveRepair('<UpdateVariable><Analysis>目标已删除</Analysis><JSONPatch>[{"op":"delta","path":"/账户/代币","value":1}]</JSONPatch></UpdateVariable>');
        const result = await window.__DELETION_RACE__;
        return { result, replacements: t.calls.replace.length, data: t.getLatestData() };
    });
    assert.equal(deletionRace.result.status, 'stale');
    assert.equal(deletionRace.replacements, 0, '模型飞行途中删除目标楼层后不得写入任何 MVU 状态');
    assert.equal(deletionRace.data.stat_data.账户.代币, 2);
    await deletionRacePage.close();

    const omittedSnapshotPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await omittedSnapshotPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await omittedSnapshotPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const omittedSnapshot = await omittedSnapshotPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setLatestData({
            stat_data: { 账户: { 代币: 2 }, 大型状态: 'x'.repeat(181000) },
            display_data: {},
        });
        const applied = await window.MvuAutoDoctorAPI.runLatest();
        await t.context.eventSource.emit('chat_loaded');
        const undone = await window.MvuAutoDoctorAPI.undoLast();
        return {
            applied,
            undone,
            data: t.getLatestData(),
            journal: structuredClone(t.context.chatMetadata.mvu_auto_doctor.repairJournal),
            toasts: structuredClone(t.calls.toasts),
        };
    });
    assert.equal(omittedSnapshot.applied.status, 'applied');
    assert.equal(omittedSnapshot.journal[0].snapshotOmitted, true);
    assert.equal(omittedSnapshot.undone, false);
    assert.equal(omittedSnapshot.data.stat_data.账户.代币, 3);
    assert.ok(omittedSnapshot.toasts.some(([kind, message]) => (
        kind === 'warning' && /快照过大/u.test(message)
    )), '重载后遇到省略快照必须明确说明无法撤销');
    await omittedSnapshotPage.close();

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
