import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.dirname(here);
const bundledNodeModules = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
    '.pnpm',
);
const bundledDirectPlaywright = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
    'playwright',
    'index.mjs',
);
const bundledPlaywright = fs.existsSync(bundledNodeModules)
    ? fs.readdirSync(bundledNodeModules)
        .filter((name) => /^playwright@/u.test(name))
        .map((name) => path.join(
            bundledNodeModules,
            name,
            'node_modules',
            'playwright',
            'index.mjs',
        ))
        .find((candidate) => fs.existsSync(candidate))
    : '';
const playwrightCandidates = [
    process.env.PLAYWRIGHT_PATH,
    path.join(pluginRoot, 'node_modules', 'playwright', 'index.mjs'),
    bundledPlaywright,
    bundledDirectPlaywright,
].filter(Boolean);
const playwrightPath = playwrightCandidates.find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) {
    if (process.env.CI) {
        throw new Error('Playwright is unavailable in CI; browser regression must not be silently skipped');
    }
    console.log('browser runtime tests skipped: Playwright is unavailable');
    process.exit(0);
}
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const systemBrowser = [
    process.env.MVUAD_BROWSER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

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
.menu_button {
  display: flex;
  width: min-content;
  margin: 5px 0;
  align-items: center;
  justify-content: center;
}
input[type="checkbox"] { min-height: auto; }
</style></head><body>
<div id="extensions_settings2"></div>
<script>
const calls = { model: [], raw: 0, replace: [], prompts: [], extensionPrompts: {}, toasts: [], order: [], saves: 0, maxConcurrentReplacements: 0, repairSystem: '', repairUser: '', repairOptions: [], socialSystem: '', socialUser: '', socialRuns: 0, actorSystem: '', actorUser: '', actorRuns: 0, actorActive: 0, actorPeak: 0, actorBarrierStates: [], continuitySystem: '', continuityUser: '', continuityRuns: 0, forumSystem: '', forumUser: '', forumRuns: 0 };
const listeners = {};
let latestData = { stat_data: { 账户: { 代币: 2 } }, display_data: {} };
let messageMvuData = null;
let deferredResolve = null;
let replaceDeferredResolve = null;
let replaceDelayArmed = false;
let activeReplacements = 0;
let mode = 'normal';
const modeRuns = {};
let metadataSavesBeforeSwipeChange = -1;
let mvuAlwaysBusy = false;
let messageScopedMvuUnavailable = false;
let corruptNextReplace = false;
let throwNextReplace = false;
let throwRollbackAfterCorruption = false;
let normalizeReplacements = false;
let normalizationVersion = 0;
let recomputeDerivedFields = false;
let recomputeUnlistedLifeState = false;
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
  extensionSettings: {
    mvu_auto_doctor: {
      strictModelProvider: 'story-oracle',
      fastModelProvider: 'story-oracle',
      modelRoutingSettingsVersion: 2,
    },
  },
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
  setExtensionPrompt(name, content, position, depth, scan = false, role = 0) {
    const stored = {
      name,
      content: String(content),
      position: Number(position),
      depth: Number(depth),
      scan: !!scan,
      role: Number(role),
    };
    calls.prompts.push([name, content, position, depth, scan, role]);
    calls.extensionPrompts[name] = stored;
  },
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
  async generateRaw() { calls.raw += 1; throw new Error('Story Oracle should be used'); },
};
window.SillyTavern = { getContext: () => context };
window.TavernHelper = { waitGlobalInitialized: async () => window.Mvu };
window.toastr = {
  info(message) { calls.toasts.push(['info', String(message)]); },
  success(message) { calls.toasts.push(['success', String(message)]); },
  warning(message) { calls.toasts.push(['warning', String(message)]); },
};
const delayedMvuParam = new URLSearchParams(location.search).get('delayedMvu');
const delayedMvuBoot = delayedMvuParam !== null;
const delayedMvuDelay = Math.max(100, Number(delayedMvuParam) || 100);
const mvuApi = {
  isDuringExtraAnalysis: () => mvuAlwaysBusy,
  getMvuData: (options = {}) => {
    if (messageScopedMvuUnavailable && options.message_id !== 'latest') return null;
    const key = String(options.message_id);
    if (messageMvuData && Object.prototype.hasOwnProperty.call(messageMvuData, key)) {
      return structuredClone(messageMvuData[key]);
    }
    return structuredClone(latestData);
  },
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
      if (op.op === 'insert') {
        const parts = op.path.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        let parent = data.stat_data;
        for (const part of parts.slice(0, -1)) parent = parent[part];
        parent[parts.at(-1)] = structuredClone(op.value);
      }
    }
    if (recomputeDerivedFields) {
      const base = data.stat_data?.角色?.属性?.基础;
      const actual = data.stat_data?.角色?.属性?.实际;
      const derived = data.stat_data?.角色?.衍生;
      if (base && actual && derived) {
        actual.STR = base.STR;
        derived.MP_最大 = base.STR * 10;
        derived.闪避值 = base.STR + 5;
      }
    }
    if (recomputeUnlistedLifeState) {
      const base = data.stat_data?.角色?.属性?.基础;
      const actual = data.stat_data?.角色?.属性?.实际;
      const derived = data.stat_data?.角色?.衍生;
      const status = data.stat_data?.角色?.状态;
      if (base && actual && derived && status) {
        actual.CON = base.CON;
        derived.HP_最大 = base.CON * 15;
        status.生命状态 = derived.HP_当前 < derived.HP_最大 ? '受伤' : '健康';
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
      if (messageMvuData && options?.message_id !== undefined) {
        messageMvuData[String(options.message_id)] = structuredClone(data);
      }
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
window.Mvu = delayedMvuBoot ? null : mvuApi;
if (delayedMvuBoot) {
  setTimeout(() => {
    window.Mvu = mvuApi;
    context.eventSource.emit('global_Mvu_initialized');
  }, delayedMvuDelay);
}
window.StoryOracleAPI = {
  isCompatible: () => true,
  context: { getSettings: () => ({ autoDiagnoseEnabled: false }) },
  async run(messages, options = {}) {
    const system = messages[0].content;
    const isSocial = system.includes('人物动机、人格自主性');
    const isSocialRepair = system.includes('人物关系二审输出的JSON结构');
    const isActor = system.includes('NPC幕后模拟worker');
    const isContinuity = system.includes('活世界事件');
    const isForum = system.includes('独立网络论坛模拟器');
    calls.model.push(isSocial ? 'social' : isActor ? 'actor' : isContinuity ? 'continuity' : isForum ? 'forum' : 'repair');
    if (mode === 'rate-limit') {
      const error = new Error('HTTP 429: rate limit exceeded');
      error.status = 429;
      throw error;
    }
    if (mode === 'transport-error') {
      throw new Error('connection refused');
    }
    if (isActor) {
      calls.actorRuns += 1;
      calls.actorSystem = messages[0].content;
      calls.actorUser = messages[1].content;
      calls.actorActive += 1;
      calls.actorPeak = Math.max(calls.actorPeak, calls.actorActive);
      const barriers = Object.values(
        context.chatMetadata?.mvu_auto_doctor?.phase6Runtime?.records || {},
      ).map((entry) => entry?.value).filter((entry) => entry?.targetIndex === 2);
      calls.actorBarrierStates.push(
        barriers.sort((left, right) => (right?.updatedAt || 0) - (left?.updatedAt || 0))[0]?.state || '',
      );
      try {
        const objects = messages[1].content
          .split('\n')
          .filter((line) => line.startsWith('{'))
          .map((line) => JSON.parse(line));
        const actor = objects[1];
        await new Promise((resolve) => setTimeout(
          resolve,
          Math.abs(String(actor.actorName).charCodeAt(0)) % 7,
        ));
        return JSON.stringify({
          actorId: actor.actorId,
          actorName: actor.actorName,
          time: '第三日午夜',
          location: actor.possibleLocations[0] || 'unknown',
          knowledgeBasis: [actor.limitedKnowledgeBasis[0]],
          currentGoal: actor.currentGoalHints[0] || '继续既定目标',
          candidateAction: '沿已知传播链继续调查',
          interactionTargets: [],
          sourceThreads: [actor.sourceThreads[0]],
          evidence: [actor.evidence[0]],
          causalChain: [actor.causalChain[0]],
        });
      } finally {
        calls.actorActive -= 1;
      }
    }
    if (!isContinuity && !isForum) {
      if (isSocial || isSocialRepair) {
        calls.socialRuns += 1;
        calls.socialSystem = messages[0].content;
        calls.socialUser = messages[1].content;
        const paths = [...messages[1].content.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
        if (mode === 'social-invalid-then-valid' && isSocial) {
          return '{"verdict":"warning","decisions":[';
        }
        const allow = mode === 'social-allow-dark';
        return JSON.stringify({
          verdict: allow ? 'pass' : 'violation',
          summary: allow ? '明确黑暗行为有本轮授权。' : '普通照顾被误写成控制，关系变化缺少自愿证据。',
          findings: [{
            type: allow ? 'valid_dark_content' : 'unauthorized_motive',
            severity: allow ? 'info' : 'error',
            reason: allow ? '用户明确威胁且正文按机制处理。' : '用户只表达普通照顾。',
            evidence: allow ? '我明确威胁他' : '我给她带一份晚饭',
          }],
          decisions: paths.map((path) => ({
            path,
            action: allow ? 'allow' : 'revert',
            reason: allow ? '有明确授权' : '无自愿关系证据',
            evidence: allow ? '明确威胁' : '普通照顾',
          })),
        });
      }
      calls.repairSystem = messages[0].content;
      calls.repairUser = messages[1].content;
      calls.repairOptions.push(structuredClone(options));
      modeRuns[mode] = (modeRuns[mode] || 0) + 1;
    }
    if (isForum) {
      calls.forumRuns += 1;
      calls.forumSystem = messages[0].content;
      calls.forumUser = messages[1].content;
      const id = 'FP-' + calls.forumRuns;
      const firstPage = messages[1].content.includes('"posts":[]');
      const pageMark = firstPage ? '' : '（续页' + calls.forumRuns + '）';
      const newPosts = [
        { id: id + '-A', board: '闲聊广场', title: '北门面摊今天是不是淡了点' + pageMark, author: '盐汽水', body: '路过吃了一碗，老板说盐车晚到了。排队时又听见后厨的人讨论北门进货，说昨夜那场雨把盐车堵在旧桥外，今天午后才可能送到。有人觉得只是清淡一点，也有人说汤底和前几日完全不同。摊主没有涨价，还给等得久的人添了半勺肉末。旁边卖饼的倒是趁机忙了起来，不少人端着面去配咸饼。要是傍晚补货真的到了，我再来回一帖，省得大家白跑。顺便提醒第一次去的人，北门这家没有挂大招牌，看到修鞋摊之后往里走十几步就是。午时人最多，想坐靠窗的位置最好提前一点。今天还有两个外地客误以为摊子关门，绕去南街后才听说只是盐车晚到。老板说晚饭照常开火，汤底补齐以后不会另外加价，已经买过午饭的人拿木牌回来还能添一小碗。' + pageMark, kind: 'chat', tags: ['吃喝', '北门'], source: '港城普通生活', heat: 57 },
        { id: id + '-B', board: '求助攻略', title: '夜里去北岸要注意什么' + pageMark, author: '赶夜路的人', body: '第一次走北岸，求问渡船和照明情况。听说最近退潮时间不稳定，石阶又湿又滑；如果要带货过去，哪一班船更稳，码头附近有没有能暂时避雨的棚子？也想避开巡夜队盘查。' + pageMark, kind: 'guide', tags: ['求助'], source: '世界书中的港城交通', heat: 4 },
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
      if (mode === 'invalid-continuity') {
        return '<ContinuityState>{"turn":';
      }
      if (mode === 'future-continuity-turn') {
        return '<ContinuityState>' + JSON.stringify({
          turn: 99,
          threads: [{
            id: 'FUTURE-TURN-01',
            title: 'Future turn must be clamped locally',
            kind: 'parallel',
            eventType: 'progress',
            level: 2,
            origin: 'main_derivative',
            relation: 'linked',
            stage: 'seeded',
            stageProgress: 1,
            summary: 'A current-reply consequence starts now.',
            offscreenBeat: 'The consequence begins during this local tick.',
            nextBeat: 'It will continue on the next actual chat turn.',
            trigger: 'The current reply established the cause.',
            intersection: 'It can meet the main line through the same actors.',
            seedBasis: 'Current reply created a persistent consequence.',
            causedBy: ['CURRENT-REPLY'],
            actors: ['tester'],
            locations: ['test-room'],
            knowledge: 'hidden',
            urgency: 2,
            lastAdvancedTurn: 99,
          }],
        }) + '</ContinuityState>';
      }
      if (mode === 'replacement-reroll') {
        const branch = calls.continuityRuns === 1 ? 'OLD' : 'NEW';
        const summary = branch === 'OLD'
          ? '旧回复留下的港口巡查事件。'
          : '重抽后的正文建立了全新的码头事件。';
        return '<ContinuityState>' + JSON.stringify({
          turn: 1,
          threads: [{
            id: branch + '-BRANCH-01',
            title: branch === 'OLD' ? '旧回复分支' : '重抽新分支',
            kind: 'parallel',
            eventType: 'progress',
            level: 2,
            origin: 'ambient',
            relation: 'independent',
            stage: 'seeded',
            stageProgress: 2,
            summary,
            offscreenBeat: summary,
            nextBeat: '按新回复提供的事实继续发展。',
            trigger: '当前世界日程自行推进。',
            intersection: '只有主线主动接触码头事务时才可能汇流。',
            seedBasis: branch === 'OLD' ? '旧回复正文' : '重抽后的新正文',
            actors: ['码头巡查员'],
            locations: ['港口'],
            knowledge: 'hidden',
            urgency: 1,
            lastAdvancedTurn: 1,
          }],
        }) + '</ContinuityState>';
      }
      if (calls.continuityRuns === 1) return '<ContinuityState>{"turn":1,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","eventType":"progress","level":2,"origin":"ambient","relation":"independent","stage":"seeded","stageProgress":2,"summary":"新巡检员在交接册里发现缺失的一页。","offscreenBeat":"他先私下核对了三个月的报时记录。","nextBeat":"巡检员会询问上一班的抄录员。","trigger":"巡检制度自行推进，无需玩家触发。","intersection":"只有主线涉及钟楼、报时记录或城防调查时才可能汇流。","seedBasis":"世界书：港城 / 钟楼巡检制度","actors":["新巡检员","上一班抄录员"],"locations":["港城钟楼"],"knowledge":"hidden","urgency":1,"lastAdvancedTurn":1}],"world":{"digest":"港区日常运行稳定，公开的旧桥积水消息开始影响短途运输安排。","factions":[{"id":null,"name":"港区运输联合体","relation":"neutral","condition":"stable","goal":"维持旧桥附近的短途运输","summary":"开始临时调整车次","pillars":["车辆","调度"],"scope":"港区","knowledge":"observed","basis":"世界书中的港区运输网络与公开积水消息","lastChange":"部分车辆改走南侧道路"}],"winds":[{"id":null,"topic":"旧桥积水","type":"notice","strength":1,"content":"昨夜降雨使旧桥通行变慢","source":"过桥司机→港区运输人员","scope":"港区运输圈","knowledge":"rumor","basis":"公开路况被多人转述"}],"reputation":{"public":{"level":1,"summary":"公众对玩家协助巡逻的评价略有提升","basis":"公开感谢已经在港区小范围传播"}},"environment":{"economy":"strained","summary":"短途运输因旧桥积水略微趋紧","basis":"司机已经开始改道","incidents":[]},"shadows":{"enemies":[],"secrets":[{"id":null,"title":"密谈代号黑雨","status":"hidden","summary":"密室中的代号尚未外泄","exposure":0,"holders":["密谈参与者"],"knowledge":"hidden","basis":"本轮正文明确为私下密谈","lastChange":"维持未公开"}]},"influences":[{"id":null,"trigger":"旧桥积水风声","impact":"运输联合体调整部分车次","fallout":"旧桥附近送货时间可能延长","knowledge":"observed","basis":"路况信息已覆盖运输圈"}]}}</ContinuityState>';
      if (calls.continuityRuns === 2) return '<ContinuityState>{"turn":2,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","origin":"ambient","relation":"independent","stage":"advancing","summary":"巡检员找到上一班抄录员并确认缺页被人为撕走。","offscreenBeat":"两人比对墨迹，锁定缺页发生在昨夜换班。","nextBeat":"他们会查问昨夜进入钟楼的人。","trigger":"巡检制度自行推进，无需玩家触发。","intersection":"只有主线涉及钟楼、报时记录或城防调查时才可能汇流。","seedBasis":"世界书：港城 / 钟楼巡检制度","knowledge":"hidden","urgency":1},{"id":"PE-货单-追查-01","title":"烧毁货单后的泄密追查","kind":"enemy","origin":"main_derivative","relation":"linked","stage":"seeded","summary":"玩家烧毁异常货单后，仓主开始追查接触过货单的人。","nextBeat":"仓主会先核对仓库值班表。","trigger":"本轮正文已经造成持续追查。","intersection":"追查接触玩家或其同伴时进入主线。","seedBasis":"本轮正文：玩家烧毁异常货单并惊动仓主","causedBy":["ACTION-烧毁货单"],"knowledge":"hidden","urgency":2}]}</ContinuityState>';
      if (calls.continuityRuns === 3) return '<ContinuityState>{"turn":3,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","kind":"parallel","origin":"ambient","relation":"independent","stage":"resolved","summary":"巡检员确认缺页被城防书记带走归档。","resolution":"书记承认临时取走记录并补办了归档手续。","effects":["钟楼开始执行双人签字的交接制度"],"rumors":["巡检员之间流传城防正在秘密复核夜间报时"],"seedBasis":"世界书：港城 / 钟楼巡检制度","knowledge":"hidden","urgency":1},{"id":"PE-货单-追查-01","title":"烧毁货单后的泄密追查","kind":"enemy","origin":"main_derivative","relation":"linked","stage":"seeded","summary":"玩家烧毁异常货单后，仓主开始追查接触过货单的人。","nextBeat":"仓主会先核对仓库值班表。","trigger":"本轮正文已经造成持续追查。","intersection":"追查接触玩家或其同伴时进入主线。","seedBasis":"本轮正文：玩家烧毁异常货单并惊动仓主","causedBy":["ACTION-烧毁货单"],"knowledge":"hidden","urgency":2},{"id":"WE-钟楼-双签-01","title":"钟楼双签制度的磨合","kind":"personal","origin":"setting_linked","relation":"latent","stage":"seeded","summary":"新双签制度令夜班交接变慢。","nextBeat":"夜班人员会要求调整排班。","trigger":"双签制度持续执行。","intersection":"主线需要夜间报时或城防通行时才可能汇流。","seedBasis":"钟楼缺页事件结束后建立双人签字制度","causedBy":["WE-港城-钟楼-01"],"effects":["夜班交接延长"],"knowledge":"hidden","urgency":1}]}</ContinuityState>';
      return '<ContinuityState>{"turn":4,"threads":[{"id":"WE-港城-钟楼-01","title":"钟楼巡检的缺页交接册","origin":"ambient","relation":"independent","stage":"resolved","summary":"巡检员确认缺页被城防书记带走归档。","resolution":"书记承认临时取走记录并补办了归档手续。","effects":["钟楼开始执行双人签字的交接制度"],"rumors":["巡检员之间流传城防正在秘密复核夜间报时"],"seedBasis":"世界书：港城 / 钟楼巡检制度","knowledge":"hidden"},{"id":"PE-货单-追查-01","title":"烧毁货单后的泄密追查","kind":"enemy","origin":"main_derivative","relation":"linked","stage":"advancing","summary":"仓主从值班表锁定了两名可能接触货单的人。","offscreenBeat":"仓主派人分别试探两名值班人。","nextBeat":"其中一人会试图向外求助。","trigger":"追查持续进行。","intersection":"追查接触玩家或其同伴时进入主线。","seedBasis":"本轮正文：玩家烧毁异常货单并惊动仓主","causedBy":["ACTION-烧毁货单"],"knowledge":"hidden","urgency":2},{"id":"WE-钟楼-双签-01","title":"钟楼双签制度的磨合","kind":"personal","origin":"setting_linked","relation":"latent","stage":"seeded","summary":"新双签制度令夜班交接变慢。","nextBeat":"夜班人员会要求调整排班。","trigger":"双签制度持续执行。","intersection":"主线需要夜间报时或城防通行时才可能汇流。","seedBasis":"钟楼缺页事件结束后建立双人签字制度","causedBy":["WE-港城-钟楼-01"],"effects":["夜班交接延长"],"knowledge":"hidden","urgency":1}]}</ContinuityState>';
    }
    if (mode === 'hard-correction') {
      return '<HardContractCorrection><Reason>正文低于100字硬下限，仅补足既有观察结果与NPC反应。</Reason><CorrectedContent>'
        + '甲'.repeat(120)
        + '</CorrectedContent></HardContractCorrection>'
        + '<UpdateVariable><Analysis>变量无需修改</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
    }
    if (mode === 'partial-hard-correction') {
      return '<UpdateVariable><Analysis>变量无需修改</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>'
        + '<HardContractCorrection>'
        + '<Reason>补足四个候选，但正文仍未达到最低字数。</Reason>'
        + '<Evidence>正文100~200汉字；结尾四项候选。</Evidence>'
        + '<CorrectedContent>' + '甲'.repeat(50) + '</CorrectedContent>'
        + '<CorrectedOptions>'
        + '>选项一：[继续观察]\n'
        + '>选项二：[等待变化]\n'
        + '>选项三：[保持警戒]\n'
        + '>选项四：[结束回合]'
        + '</CorrectedOptions>'
        + '</HardContractCorrection>';
    }
    if (mode === 'rule-backed-correction') {
      return '<HardContractCorrection><Reason>奖励数量与世界书硬规则不符。</Reason>'
        + '<Evidence>完成测试奖励时固定获得三枚代币</Evidence>'
        + '<CorrectedContent>你完成测试，按规则获得三枚代币。</CorrectedContent>'
        + '</HardContractCorrection>'
        + '<UpdateVariable><Analysis>补足奖励数量</Analysis>'
        + '<JSONPatch>[{"op":"delta","path":"/账户/代币","value":3}]</JSONPatch>'
        + '</UpdateVariable>';
    }
    if (mode === 'derived-card') {
      return '<UpdateVariable><Analysis>修正可写基础值；派生值交由前端自动计算。</Analysis>'
        + '<JSONPatch>'
        + '[{"op":"replace","path":"/角色/属性/基础/STR","value":10},'
        + '{"op":"replace","path":"/角色/属性/实际/STR","value":10},'
        + '{"op":"replace","path":"/角色/衍生/MP_最大","value":100},'
        + '{"op":"replace","path":"/角色/衍生/闪避值","value":15}]'
        + '</JSONPatch></UpdateVariable>';
    }
    if (mode === 'incomplete-then-valid' && modeRuns[mode] === 1) {
      return '<UpdateVariable><Analysis>第一次输出被截断</Analysis><JSONPatch>'
        + '[{"op":"delta","path":"/账户/代币","value":';
    }
    if (mode === 'missing-always') {
      return '<Analysis>只有分析，没有机器区块</Analysis>';
    }
    if (mode === 'recoverable-tail') {
      return '<UpdateVariable><Analysis>补丁数组完整但闭合标签丢失</Analysis><JSONPatch>'
        + '[{"op":"delta","path":"/账户/代币","value":1}]';
    }
    if (mode === 'missing-inner-close') {
      return '<UpdateVariable><Analysis>外层闭合但 JSONPatch 闭合标签丢失</Analysis><JSONPatch>'
        + '[{"op":"delta","path":"/账户/代币","value":1}]'
        + '</UpdateVariable>';
    }
    if (mode === 'single-object-patch') {
      return '<UpdateVariable><Analysis>模型漏掉数组外壳</Analysis><JSONPatch>'
        + '{"op":"delta","path":"/账户/代币","value":1}'
        + '</JSONPatch></UpdateVariable>';
    }
    if (mode === 'single-object-missing-close') {
      return '<UpdateVariable><Analysis>single object and missing close tags</Analysis><JSONPatch>'
        + '{"op":"delta","path":"/账户/代币","value":1}';
    }
    if (mode === 'redundant-container') {
      return '<UpdateVariable><Analysis>模型重复初始化已有父对象</Analysis><JSONPatch>'
        + '[{"op":"insert","path":"/账户","value":{}},'
        + '{"op":"delta","path":"/账户/代币","value":1}]'
        + '</JSONPatch></UpdateVariable>';
    }
    if (mode === 'object-op-mismatch') {
      return '<UpdateVariable><Analysis>新对象字段误用了 replace</Analysis><JSONPatch>'
        + '[{"op":"replace","path":"/账户/奖励","value":"已领取"}]'
        + '</JSONPatch></UpdateVariable>';
    }
    if (mode === 'unlisted-host-side-effect') {
      return '<UpdateVariable><Analysis>只修改可写的体力基础值。</Analysis>'
        + '<JSONPatch>[{"op":"replace","path":"/角色/属性/基础/CON","value":8}]'
        + '</JSONPatch></UpdateVariable>';
    }
    if (mode === 'malformed-correction-valid-variable') {
      return '<UpdateVariable><Analysis>变量区块正确</Analysis><JSONPatch>'
        + '[{"op":"delta","path":"/账户/代币","value":1}]'
        + '</JSONPatch></UpdateVariable>'
        + '<HardContractCorrection><Reason>缺少其余字段与闭合标签';
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
  setMessageMvuData(value) { messageMvuData = structuredClone(value); },
  getLatestData() { return structuredClone(latestData); },
  resolveRepair(value) { deferredResolve?.(value); },
  hasDeferred: () => !!deferredResolve,
  armReplaceDelay() { replaceDelayArmed = true; },
  releaseReplace() { replaceDeferredResolve?.(); },
  hasDeferredReplace: () => !!replaceDeferredResolve,
  armSwipeChangeOnMetadataSave(skip = 0) { metadataSavesBeforeSwipeChange = Math.max(0, Number(skip) || 0); },
  setSwipeId(value) { context.chat.at(-1).swipe_id = value; },
  setMvuBusy(value) { mvuAlwaysBusy = !!value; },
  setMessageScopedMvuUnavailable(value) { messageScopedMvuUnavailable = !!value; },
  setNormalizeReplacements(value) { normalizeReplacements = !!value; },
  setRecomputeDerivedFields(value) { recomputeDerivedFields = !!value; },
  setRecomputeUnlistedLifeState(value) { recomputeUnlistedLifeState = !!value; },
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
    const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
    if (requestPath === '/') {
        response.writeHead(200, { 'content-type': typeOf('.html') });
        response.end(harness);
        return;
    }
    if (requestPath === '/scripts/world-info.js') {
        response.writeHead(200, { 'content-type': typeOf('.js') });
        response.end(worldInfoModule);
        return;
    }
    if (requestPath === '/scripts/openai.js') {
        response.writeHead(200, { 'content-type': typeOf('.js') });
        response.end(openaiModule);
        return;
    }
    const file = path.join(pluginRoot, requestPath.slice(1));
    if (file.startsWith(pluginRoot) && fs.existsSync(file)) {
        response.writeHead(200, { 'content-type': typeOf(file) });
        response.end(fs.readFileSync(file));
        return;
    }
    response.writeHead(404); response.end('not found');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const launchOptions = { headless: true };
if (systemBrowser) {
    launchOptions.executablePath = systemBrowser;
}
const browser = await chromium.launch(launchOptions);

try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI);

    await page.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, true);
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
        window.__DATABASE_FINAL_REPLY_BARRIER__ = window.MvuAutoDoctorAPI.waitForTargetSettled(
            2,
            { timeoutMs: 20000 },
        );
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
        window.__TEST__.calls.repairOptions.length === 1
    ), null, { timeout: 20000 });
    const finalReplyBarrier = await page.evaluate(
        () => window.__DATABASE_FINAL_REPLY_BARRIER__,
    );
    assert.equal(finalReplyBarrier.status, 'settled');
    assert.equal(finalReplyBarrier.targetIndex, 2);
    assert.equal(typeof finalReplyBarrier.fingerprint, 'string');
    assert.equal(typeof finalReplyBarrier.generationId, 'string');
    assert.equal(typeof finalReplyBarrier.branchId, 'string');
    assert.equal(finalReplyBarrier.receipt.barrierState, 'settled');
    assert.equal(finalReplyBarrier.receipt.writeAllowed, true);
    const persistedBarrier = await page.evaluate(() => (
        Object.values(
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor
                ?.phase6Runtime?.records || {},
        )
            .map((entry) => entry?.value)
            .find((entry) => entry?.protocolVersion === '2.0' && entry?.targetIndex === 2)
    ));
    assert.equal(persistedBarrier.state, 'settled');
    assert.equal(persistedBarrier.generationId, finalReplyBarrier.generationId);
    assert.equal(persistedBarrier.branchId, finalReplyBarrier.branchId);
    assert.equal(
        persistedBarrier.finalFingerprint,
        finalReplyBarrier.fingerprint,
        '持久屏障必须回读并绑定最终正文指纹',
    );
    const downstreamRead = await page.evaluate(() => (
        window.MvuAutoDoctorAPI.runAfterTargetSettled(
            2,
            ({ fingerprint, narrative }) => ({
                fingerprint,
                narrativeChars: narrative.length,
            }),
        )
    ));
    assert.equal(downstreamRead.status, 'completed');
    assert.equal(downstreamRead.value.fingerprint, finalReplyBarrier.fingerprint);
    assert.ok(downstreamRead.value.narrativeChars > 0);
    const defaultForumMode = await page.evaluate(() => ({
        turn: window.MvuAutoDoctorAPI.getForumState().turn,
        runs: window.__TEST__.calls.forumRuns,
        mode: document.querySelector('.mvuad-forum-refresh-mode-settings')?.value,
        intervalDisabled: !!document.querySelector('.mvuad-forum-interval')?.disabled,
    }));
    assert.deepEqual(defaultForumMode, {
        turn: 0,
        runs: 0,
        mode: 'manual',
        intervalDisabled: true,
    }, '默认手动模式不得在AI回复后暗中调用论坛模型');
    await page.evaluate(() => {
        const select = document.querySelector('.mvuad-forum-refresh-mode-settings');
        select.value = 'auto';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal(
        await page.locator('.mvuad-forum-interval').isDisabled(),
        false,
        '切换自动模式后才允许设置自动刷新间隔',
    );
    await page.evaluate(() => {
        const select = document.querySelector('.mvuad-forum-refresh-mode-settings');
        select.value = 'manual';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal(
        await page.locator('.mvuad-forum-interval').isDisabled(),
        true,
        '切回手动模式必须立即停用自动刷新间隔',
    );
    await page.evaluate(() => window.MvuAutoDoctorAPI.runForum());
    await page.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.turn === 1
    ), null, { timeout: 20000 });
    const continuity = await page.evaluate(() => ({
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        forumState: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
        version: window.MvuAutoDoctorAPI.version,
        hardAudit: window.MvuAutoDoctorAPI.getHardContractAudit(),
        hardStatus: document.querySelector('#mvu-auto-doctor-settings .mvuad-protocol-status')?.textContent || '',
        hardDetails: document.querySelector('#mvu-auto-doctor-settings .mvuad-protocol-details')?.textContent || '',
        hasSettingsLedger: !!document.querySelector('#mvu-auto-doctor-settings .mvuad-ledger'),
        hasWorldPanelButton: !!document.querySelector('#mvu-auto-doctor-settings .mvuad-continuity-open'),
        featureFoldsClosed: [...document.querySelectorAll('#mvu-auto-doctor-settings .mvuad-settings-section')]
            .every((details) => !details.open),
    }));
    assert.equal(continuity.version, '2.0.0-rc.1');
    assert.equal(
        continuity.calls.repairOptions[0]?.maxTokens,
        8192,
        '变量诊断默认必须给推理模型足够输出空间，不能沿用旧 4096 上限',
    );
    assert.match(
        continuity.calls.repairSystem,
        /第一部分必须最先完整输出[\s\S]*<UpdateVariable>[\s\S]*完成并闭合上面的变量区块后[\s\S]*<HardContractCorrection>/u,
        '机器提示必须要求变量补丁先于可选正文修正版输出',
    );
    assert.match(continuity.calls.repairUser, /这是开局\/人物创建审计/u);
    assert.ok(continuity.hardAudit, '每条新回复必须完成零模型调用的硬合同检查');
    assert.match(continuity.hardStatus, /硬合同/u);
    assert.match(continuity.hardDetails, /未发现可由程序确定/u);
    assert.equal(continuity.state.threads[0].id, 'WE-港城-钟楼-01');
    assert.equal(continuity.calls.actorRuns, 0, 'Actor Shard默认关闭时不得增加模型调用');
    assert.equal(continuity.state.threads[0].origin, 'ambient');
    assert.equal(continuity.state.threads[0].relation, 'independent');
    assert.equal(continuity.state.threads[0].eventType, 'progress');
    assert.equal(continuity.state.world.factions[0].id, 'FAC-01');
    assert.equal(continuity.state.world.winds[0].id, 'WIND-01');
    assert.equal(continuity.state.world.shadows.secrets[0].knowledge, 'hidden');
    assert.match(continuity.calls.continuitySystem, /按需要建立0或1条自主事件/u);
    assert.match(
        continuity.calls.continuitySystem,
        /intersection不是创建时写完就永久不变的备注/u,
    );
    assert.match(continuity.calls.continuitySystem, /事件→世界表面→汇流候选/u);
    assert.match(continuity.calls.continuitySystem, /副本\/封闭场景规划/u);
    assert.match(continuity.calls.continuitySystem, /所有字段都可合理变化/u);
    assert.match(continuity.calls.continuitySystem, /completed\/failed就永久终止/u);
    assert.match(continuity.calls.continuityUser, /"convergence": \{"score": 0/u);
    assert.match(continuity.calls.continuityUser, /"sourceThreads": \["来源事件ID"\]/u);
    assert.match(continuity.calls.continuityUser, /"baselineEvidence"/u);
    assert.equal(continuity.forumState.posts.length, 4);
    assert.equal(
        continuity.forumState.posts.reduce((sum, post) => sum + post.comments.length, 0),
        6,
    );
    assert.ok(continuity.forumState.posts.every((post) => post.comments.length > 0));
    assert.equal(continuity.calls.forumRuns, 1);
    assert.match(continuity.calls.repairSystem, /动态集合的成员资格与生命周期/u);
    assert.match(continuity.calls.repairSystem, /给予方与接收方必须对称复核/u);
    assert.match(continuity.calls.repairSystem, /同时恢复错误目标/u);
    assert.match(continuity.calls.repairSystem, /保留 GM 的合理创作自主权/u);
    assert.match(continuity.calls.repairSystem, /不评价文风/u);
    assert.match(continuity.calls.repairUser, /动态集合生命周期历史线索/u);
    assert.match(continuity.calls.forumSystem, /至少一半帖子应为日常闲聊/u);
    assert.match(continuity.calls.forumSystem, /每个新帖都至少获得1条回复/u);
    assert.match(continuity.calls.forumSystem, /不可信引用数据/u);
    const diagnosticsUi = await page.evaluate(async () => {
        const t = window.__TEST__;
        const registrationBeforeInspection = window.MvuAutoDoctorAPI.getInjectionInspection();
        const injection = Object.values(t.calls.extensionPrompts)
            .find((entry) => entry.name === 'mvu-auto-doctor-continuity');
        const assembledChat = Object.values(t.calls.extensionPrompts)
            .filter((entry) => entry?.role === 0 && entry.content)
            .map((entry) => ({ role: 'system', content: entry.content }));
        await t.context.eventSource.emit('chat_completion_prompt_ready', {
            dryRun: false,
            chat: assembledChat,
        });
        await new Promise((resolve) => setTimeout(resolve, 850));
        const helperOnly = await window.MvuAutoDoctorAPI.inspectEnvironment();
        const hiddenDatabaseScript = document.createElement('iframe');
        hiddenDatabaseScript.id = 'TH-script--TavernDB--qc-client';
        hiddenDatabaseScript.name = hiddenDatabaseScript.id;
        hiddenDatabaseScript.hidden = true;
        document.body.append(hiddenDatabaseScript);
        const databaseScriptBefore = await window.MvuAutoDoctorAPI.inspectEnvironment();
        hiddenDatabaseScript.remove();
        let externalApiCalls = 0;
        window.AutoCardUpdaterAPI = {
            exportTableAsJson() {
                externalApiCalls += 1;
                return {
                    'sheet-with-random-name': {
                        content: [
                            ['unfamiliar-column-a', 'unfamiliar-column-b'],
                        ],
                    },
                };
            },
            refreshDataAndWorldbook() {
                externalApiCalls += 1;
                return true;
            },
        };
        window.UnfamiliarDiceFrontend = {
            resolve() {
                externalApiCalls += 1;
            },
        };
        const autoCardUpdaterBefore = await window.MvuAutoDoctorAPI.inspectEnvironment();
        const externalApiCallsAfterInspection = externalApiCalls;
        delete window.AutoCardUpdaterAPI;
        delete window.UnfamiliarDiceFrontend;
        window.TavernDB = {};
        const databaseBefore = await window.MvuAutoDoctorAPI.inspectEnvironment();
        const diagnosticBefore = window.MvuAutoDoctorAPI.getDiagnosticProjection();
        const databaseRegistration = await window.MvuAutoDoctorAPI
            .registerBarrierProtocolClient({
                id: 'taverndb',
                protocolVersion: 1,
                settledOnly: true,
                terminalReceipts: true,
            });
        const databaseAfter = await window.MvuAutoDoctorAPI.inspectEnvironment();
        const diagnostic = window.MvuAutoDoctorAPI.getDiagnosticProjection();
        return {
            apiCompatible: window.MvuAutoDoctorAPI.isCompatible(2),
            apiAcceptsBarrierV4: window.MvuAutoDoctorAPI.isCompatible(4),
            healthItems: document.querySelectorAll('.mvuad-health-item').length,
            promptInfo: window.MvuAutoDoctorAPI.getLastPromptInfo(),
            modelCalls: window.MvuAutoDoctorAPI.getModelCallStats(),
            savedModelCalls: structuredClone(
                t.context.chatMetadata.mvu_auto_doctor?.modelCallStats || {},
            ),
            hostPrompt: structuredClone(injection || null),
            registrationBeforeInspection,
            injection: window.MvuAutoDoctorAPI.getInjectionInspection(),
            operationLog: structuredClone(
                t.context.chatMetadata.mvu_auto_doctor?.operationLog || [],
            ),
            helperOnly,
            databaseScriptBefore,
            autoCardUpdaterBefore,
            externalApiCallsAfterInspection,
            databaseBefore,
            diagnosticBefore,
            databaseRegistration,
            databaseAfter,
            diagnostic,
        };
    });
    assert.equal(diagnosticsUi.apiCompatible, true);
    assert.equal(diagnosticsUi.apiAcceptsBarrierV4, true);
    assert.equal(
        diagnosticsUi.externalApiCallsAfterInspection,
        0,
        'generic coexistence detection must not read tables or invoke an unknown front end',
    );
    assert.ok(diagnosticsUi.healthItems >= 6, '设置页必须给出可读环境自检清单');
    assert.ok(diagnosticsUi.promptInfo.totalChars > 0, '必须保存上次真实提示词的分段规模');
    assert.equal(diagnosticsUi.modelCalls.total, 3, '变量、活世界、手动论坛应分别计为一次模型调用');
    assert.deepEqual(diagnosticsUi.modelCalls.byTask, {
        variable: 1,
        social: 0,
        continuity: 1,
        forum: 1,
        other: 0,
    });
    assert.equal(diagnosticsUi.savedModelCalls.total, 3, '模型调用统计必须按聊天持久化');
    assert.equal(
        diagnosticsUi.hostPrompt.role,
        0,
        'SillyTavern setExtensionPrompt 必须使用数值 SYSTEM=0；字符串system会变成NaN并被最终提示词过滤',
    );
    assert.equal(
        diagnosticsUi.registrationBeforeInspection.registered,
        true,
        '诊断必须区分已注册但尚未观察最终提示词的注入',
    );
    assert.equal(
        diagnosticsUi.registrationBeforeInspection.socialRegistered,
        true,
        '人物动机合同注册状态不能在提示词事件前误报为 false',
    );
    assert.equal(diagnosticsUi.modelCalls.currentRun.total, 3, '本次生成统计应与聊天累计分开保存');
    assert.deepEqual(diagnosticsUi.modelCalls.currentRun.byTask, {
        variable: 1,
        social: 0,
        continuity: 1,
        forum: 1,
        other: 0,
    });
    assert.equal(diagnosticsUi.injection.status, 'success', '注入哨兵必须能验证最终提示词落地');
    assert.equal(diagnosticsUi.injection.socialLanded, true, '人物动机合同也必须进入真实最终提示词');
    assert.ok(diagnosticsUi.operationLog.length > 0, '操作时间线必须按聊天持久化');
    assert.equal(
        diagnosticsUi.helperOnly.checks.find(
            (check) => check.label.startsWith('TavernDB '),
        ).kind,
        'info',
        'benign TavernHelper scripts must not be mistaken for TavernDB',
    );
    assert.equal(
        diagnosticsUi.autoCardUpdaterBefore.checks.find(
            (check) => check.label === 'TavernDB 可选协作',
        ).kind,
        'info',
        'the real public AutoCardUpdaterAPI must be detected without requiring a doctor protocol',
    );
    assert.equal(
        diagnosticsUi.autoCardUpdaterBefore.barrierProtocol.mode,
        'unmanaged',
    );
    assert.equal(
        diagnosticsUi.autoCardUpdaterBefore.barrierProtocol.externalWriteConsistency,
        'unknown',
    );
    assert.equal(
        diagnosticsUi.databaseScriptBefore.checks.find(
            (check) => check.label === 'TavernDB 可选协作',
        ).kind,
        'info',
        'a hidden TavernDB userscript without cooperation must remain compatible',
    );
    assert.equal(diagnosticsUi.databaseRegistration.ok, true);
    assert.equal(
        diagnosticsUi.databaseBefore.checks.find(
            (check) => check.label === 'TavernDB 可选协作',
        ).kind,
        'info',
    );
    assert.equal(
        diagnosticsUi.databaseAfter.checks.find(
            (check) => check.label === 'TavernDB 可选协作',
        ).kind,
        'ok',
    );
    assert.equal(diagnosticsUi.diagnosticBefore.environment.barrierProtocol.required, false);
    assert.equal(
        diagnosticsUi.diagnosticBefore.environment.barrierProtocol.externalDatabaseDetected,
        true,
    );
    assert.equal(diagnosticsUi.diagnosticBefore.environment.barrierProtocol.mode, 'unmanaged');
    assert.equal(
        diagnosticsUi.diagnosticBefore.environment.barrierProtocol.externalWriteConsistency,
        'unknown',
    );
    assert.equal(diagnosticsUi.diagnosticBefore.environment.barrierProtocol.errorCode, '');
    assert.equal(typeof diagnosticsUi.diagnostic.environment.userAgent, 'object');

    const reloadBarrierPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await reloadBarrierPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await reloadBarrierPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const recoveredAfterReload = await reloadBarrierPage.evaluate(async () => {
        const t = window.__TEST__;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
        const initial = await window.MvuAutoDoctorAPI.waitForTargetSettled(
            2,
            { timeoutMs: 20000 },
        );
        const beforeCalls = t.calls.model.length;
        await t.context.eventSource.emit('chat_loaded');
        const recovered = await window.MvuAutoDoctorAPI.waitForTargetSettled(
            2,
            { timeoutMs: 2000, registrationGraceMs: 0 },
        );
        await t.context.eventSource.emit('message_received', 2);
        await new Promise((resolve) => setTimeout(resolve, 250));
        return {
            initial,
            recovered,
            modelCallDelta: t.calls.model.length - beforeCalls,
        };
    });
    assert.equal(recoveredAfterReload.initial.status, 'settled');
    assert.equal(recoveredAfterReload.recovered.status, 'settled');
    assert.equal(recoveredAfterReload.recovered.workflowStatus, 'recovered-terminal');
    assert.equal(recoveredAfterReload.modelCallDelta, 0);
    await reloadBarrierPage.close();

    const eventStormPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await eventStormPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await eventStormPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const eventStorm = await eventStormPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('social-rollback');
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            enabled: true,
            socialNarrativeGuardEnabled: true,
            socialAuditMode: 'balanced',
            socialMonthlySoftCny: 5,
            socialMonthlyHardCny: 10,
        });
        t.context.chat.splice(0, t.context.chat.length,
            { is_user: false, is_system: false, mes: 'Opening', swipe_id: 0, extra: {} },
            { is_user: true, is_system: false, mes: '我给她带一份晚饭。', swipe_id: 0, extra: {} },
            {
                is_user: false,
                is_system: false,
                mes: '她把普通照顾理解成控制并立刻宣誓忠诚。\\n<UpdateVariable><Analysis>关系变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
                swipe_id: 0,
                extra: {},
            },
        );
        const before = {
            stat_data: {
                账户: { 代币: 2 },
                角色: { 她: { 好感度: 5, 关系: '同行者' } },
            },
            display_data: {},
        };
        const after = {
            stat_data: {
                账户: { 代币: 2 },
                角色: { 她: { 好感度: 40, 关系: '狂热追随者' } },
            },
            display_data: {},
        };
        t.setLatestData(after);
        t.setMessageMvuData({ 0: before, 2: after, latest: after });
        const modelBefore = window.MvuAutoDoctorAPI.getModelCallStats();
        const replaceBefore = t.calls.replace.length;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await Promise.all(Array.from(
            { length: 5 },
            () => t.context.eventSource.emit('message_received', 2),
        ));
        const settled = await window.MvuAutoDoctorAPI.waitForTargetSettled(
            2,
            { timeoutMs: 20000 },
        );
        const modelAfter = window.MvuAutoDoctorAPI.getModelCallStats();
        const modelTypes = t.calls.model.slice(modelBefore.total);
        const typeCounts = Object.fromEntries(
            [...new Set(modelTypes)].map((type) => [
                type,
                modelTypes.filter((candidate) => candidate === type).length,
            ]),
        );
        const records = Object.values(
            t.context.chatMetadata?.mvu_auto_doctor?.phase6Runtime?.records || {},
        ).map((entry) => entry?.value).filter((entry) => (
            entry?.state && entry?.targetIndex === 2
        ));
        return {
            settled,
            modelCallDelta: modelAfter.total - modelBefore.total,
            typeCounts,
            socialRuns: t.calls.socialRuns,
            socialAuditCount: window.MvuAutoDoctorAPI.getSocialAudits().length,
            replacementDelta: t.calls.replace.length - replaceBefore,
            barrierRecordCount: records.length,
            barrierStates: [...new Set(records.map((record) => record.state))],
        };
    });
    assert.equal(
        eventStorm.settled.status,
        'settled',
        `事件风暴目标必须 settled：${JSON.stringify(eventStorm)}`,
    );
    assert.equal(eventStorm.socialRuns, 1, '重复宿主事件不得重复触发人物关系模型二审');
    assert.equal(eventStorm.socialAuditCount, 1, '同一完整目标身份只能持久化一条人物关系二审');
    assert.ok(
        Object.values(eventStorm.typeCounts).every((count) => count <= 1),
        `同一完整目标身份的每类自动模型任务最多一次：${JSON.stringify(eventStorm.typeCounts)}`,
    );
    assert.equal(
        eventStorm.replacementDelta,
        2,
        '关系回滚与变量修复各提交一次；事件风暴不得产生第三次写入',
    );
    assert.equal(eventStorm.barrierRecordCount, 1, '事件风暴必须合并到同一持久屏障');
    assert.deepEqual(eventStorm.barrierStates, ['settled']);
    await eventStormPage.close();

    const socialPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await socialPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await socialPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const proposalIsolation = await socialPage.evaluate(async () => {
        const t = window.__TEST__;
        const eventData = {
            dryRun: false,
            chat: [
                { role: 'system', content: '<options>系统格式说明必须保留</options>' },
                {
                    role: 'assistant',
                    content: '上一轮正文事实。<options>一、控制她\n二、继续任务</options>',
                },
                { role: 'user', content: '我选择继续任务' },
            ],
        };
        await t.context.eventSource.emit('chat_completion_prompt_ready', eventData);
        return {
            system: eventData.chat[0].content,
            assistant: eventData.chat[1].content,
            user: eventData.chat[2].content,
            registeredContract: t.calls.extensionPrompts['mvu-auto-doctor-social-contract']?.content || '',
            sanitization: window.MvuAutoDoctorAPI.getSocialPromptSanitization(),
        };
    });
    assert.match(proposalIsolation.system, /系统格式说明必须保留/u);
    assert.equal(proposalIsolation.assistant, '上一轮正文事实。');
    assert.match(proposalIsolation.user, /继续任务/u);
    assert.match(proposalIsolation.registeredContract, /当前动机的最高权威/u);
    assert.match(proposalIsolation.registeredContract, /不是洗白/u);
    assert.equal(proposalIsolation.sanitization.assistantMessagesSanitized, 1);

    const socialRollback = await socialPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('social-revert');
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            socialNarrativeGuardEnabled: true,
            socialAuditMode: 'balanced',
            fastModelProvider: 'story-oracle',
            modelRoutingSettingsVersion: 2,
        });
        t.context.chat.splice(0, t.context.chat.length,
            { is_user: false, is_system: false, mes: '开场', swipe_id: 0, extra: {} },
            { is_user: true, is_system: false, mes: '我给她带一份晚饭，问她要不要一起吃。', swipe_id: 0, extra: {} },
            {
                is_user: false,
                is_system: false,
                mes: '她意识到你真正的目的在于饲养和控制她，陷入绝望，并成为狂热信徒。\\n<UpdateVariable><Analysis>关系暴涨</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
                swipe_id: 0,
                extra: {},
            },
        );
        const before = {
            stat_data: { 角色: { 她: { 好感度: 5, 关系: '同行者' } } },
            display_data: {},
        };
        const after = {
            stat_data: { 角色: { 她: { 好感度: 40, 关系: '狂热信徒' } } },
            display_data: {},
        };
        t.setLatestData(after);
        t.setMessageMvuData({ 0: before, 2: after, latest: after });
        const result = await window.MvuAutoDoctorAPI.auditSocialRelations();
        return {
            result,
            state: t.getLatestData(),
            audits: window.MvuAutoDoctorAPI.getSocialAudits(),
            socialRuns: t.calls.socialRuns,
            socialSystem: t.calls.socialSystem,
            socialUser: t.calls.socialUser,
            message: t.context.chat[2].mes,
        };
    });
    assert.equal(socialRollback.result.status, 'audited');
    assert.equal(socialRollback.result.correction.status, 'applied');
    assert.equal(socialRollback.state.stat_data.角色.她.好感度, 5);
    assert.equal(socialRollback.state.stat_data.角色.她.关系, '同行者');
    assert.equal(socialRollback.audits[0].verdict, 'violation');
    assert.deepEqual(
        socialRollback.audits[0].correction.revertedPaths.sort(),
        ['/角色/她/关系', '/角色/她/好感度'].sort(),
    );
    assert.equal(socialRollback.socialRuns, 1);
    assert.match(socialRollback.socialSystem, /不负责把故事改成温暖/u);
    assert.match(socialRollback.socialSystem, /明确威胁、欺骗、洗脑/u);
    assert.match(socialRollback.socialUser, /我给她带一份晚饭/u);
    assert.doesNotMatch(socialRollback.socialUser, /系统格式说明必须保留/u);
    assert.match(socialRollback.message, /普通照顾被误写成控制/u, '撤回补丁必须持久写入当前swipe');

    const explicitDarkAllowed = await socialPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('social-allow-dark');
        t.context.chat.splice(0, t.context.chat.length,
            { is_user: false, is_system: false, mes: '开场', swipe_id: 0, extra: {} },
            { is_user: true, is_system: false, mes: '我明确威胁他，要求他交代藏匿点。', swipe_id: 0, extra: {} },
            {
                is_user: false,
                is_system: false,
                mes: '威胁检定成功，他的恐惧明显上升，但仍在权衡是否说谎。\\n<UpdateVariable><Analysis>恐惧变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
                swipe_id: 0,
                extra: {},
            },
        );
        const before = {
            stat_data: { 角色: { 他: { 恐惧: 10 } } },
            display_data: {},
        };
        const after = {
            stat_data: { 角色: { 他: { 恐惧: 25 } } },
            display_data: {},
        };
        t.setLatestData(after);
        t.setMessageMvuData({ 0: before, 2: after, latest: after });
        const replacementsBefore = t.calls.replace.length;
        const result = await window.MvuAutoDoctorAPI.auditSocialRelations();
        return {
            result,
            state: t.getLatestData(),
            audits: window.MvuAutoDoctorAPI.getSocialAudits(),
            replacementDelta: t.calls.replace.length - replacementsBefore,
        };
    });
    assert.equal(explicitDarkAllowed.result.status, 'audited');
    assert.equal(explicitDarkAllowed.state.stat_data.角色.他.恐惧, 25);
    assert.equal(explicitDarkAllowed.replacementDelta, 0, '有证据的黑暗后果不得被温暖基调回滚');
    assert.equal(explicitDarkAllowed.audits[0].verdict, 'pass');
    assert.equal(explicitDarkAllowed.audits[0].decisions[0].action, 'allow');
    await socialPage.close();

    const socialFailurePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await socialFailurePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await socialFailurePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const socialFailure = await socialFailurePage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('transport-error');
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const namespace = t.context.chatMetadata.mvu_auto_doctor ||= {};
        namespace.socialAudits = [{
            id: 'legacy_failed_audit',
            month,
            summary: '二审调用失败：独立 API HTTP 502；持久关系保持本轮前状态并待确认',
            findings: [],
            usage: {
                inputTokens: 3100,
                outputTokens: 20,
                cacheHitTokens: 0,
                cacheMissTokens: 3100,
                cny: 0.003443,
                estimated: true,
            },
        }];
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            socialNarrativeGuardEnabled: true,
            socialAuditMode: 'balanced',
            fastModelProvider: 'story-oracle',
            modelRoutingSettingsVersion: 2,
            socialAuditSettingsVersion: 1,
            socialMonthlySoftCny: 0.001,
            socialMonthlyHardCny: 0.002,
        });
        t.context.chat.splice(0, t.context.chat.length,
            { is_user: false, is_system: false, mes: 'Opening', swipe_id: 0, extra: {} },
            {
                is_user: true,
                is_system: false,
                mes: 'I bring Mia dinner and ask whether she wants to eat together.',
                swipe_id: 0,
                extra: {},
            },
            {
                is_user: false,
                is_system: false,
                mes: 'Mia realizes the care is ownership and becomes fanatically loyal.\\n<UpdateVariable><Analysis>relationship jump</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
                swipe_id: 0,
                extra: {},
            },
        );
        const before = {
            stat_data: { characters: { Mia: { trust: 5, relationship: 'ally' } } },
            display_data: {},
        };
        const after = {
            stat_data: { characters: { Mia: { trust: 40, relationship: 'fanatic' } } },
            display_data: {},
        };
        t.setLatestData(after);
        t.setMessageMvuData({ 0: before, 2: after, latest: after });
        const result = await window.MvuAutoDoctorAPI.auditSocialRelations();
        return {
            result,
            state: t.getLatestData(),
            audits: window.MvuAutoDoctorAPI.getSocialAudits(),
        };
    });
    assert.equal(socialFailure.result.status, 'failed');
    assert.equal(socialFailure.result.correction.status, 'applied');
    assert.equal(socialFailure.state.stat_data.characters.Mia.trust, 5);
    assert.equal(socialFailure.state.stat_data.characters.Mia.relationship, 'ally');
    assert.equal(socialFailure.audits[0].usage.cny, 0);
    assert.equal(socialFailure.audits[0].usage.estimated, false);
    assert.deepEqual(socialFailure.audits[0].modelCall, {
        attempted: true,
        completed: false,
        attempts: 0,
        structureRepairAttempted: false,
        fallback: true,
        failureReason: '二审调用失败：connection refused',
        failureCode: 'social.transport_failure',
    });
    assert.deepEqual(
        socialFailure.audits[0].correction.revertedPaths.sort(),
        ['/characters/Mia/relationship', '/characters/Mia/trust'].sort(),
    );
    await socialFailurePage.close();

    const socialRepairPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await socialRepairPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await socialRepairPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const socialRepair = await socialRepairPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('social-invalid-then-valid');
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            socialNarrativeGuardEnabled: true,
            socialAuditMode: 'balanced',
            fastModelProvider: 'story-oracle',
            modelRoutingSettingsVersion: 2,
            socialAuditSettingsVersion: 2,
            socialMonthlySoftCny: 5,
            socialMonthlyHardCny: 10,
            socialMonthlyCostLedger: { version: 1, months: {} },
        });
        t.context.chat.splice(0, t.context.chat.length,
            { is_user: false, is_system: false, mes: 'Opening', swipe_id: 0, extra: {} },
            { is_user: true, is_system: false, mes: 'I bring dinner.', swipe_id: 0, extra: {} },
            {
                is_user: false,
                is_system: false,
                mes: 'Mia becomes loyal.\\n<UpdateVariable><Analysis>jump</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
                swipe_id: 0,
                extra: {},
            },
        );
        const before = {
            stat_data: { characters: { Mia: { trust: 5 } } },
            display_data: {},
        };
        const after = {
            stat_data: { characters: { Mia: { trust: 40 } } },
            display_data: {},
        };
        t.setLatestData(after);
        t.setMessageMvuData({ 0: before, 2: after, latest: after });
        const result = await window.MvuAutoDoctorAPI.auditSocialRelations();
        return {
            result,
            audits: window.MvuAutoDoctorAPI.getSocialAudits(),
            calls: structuredClone(t.calls),
        };
    });
    assert.equal(socialRepair.result.status, 'audited');
    assert.equal(socialRepair.calls.socialRuns, 2);
    assert.equal(socialRepair.audits[0].modelCall.attempts, 2);
    assert.equal(socialRepair.audits[0].modelCall.structureRepairAttempted, true);
    assert.equal(socialRepair.audits[0].modelCall.failureCode, '');
    assert.ok(socialRepair.audits[0].usage.cny > 0);
    await socialRepairPage.close();
    await page.bringToFront();

    assert.equal(continuity.hasSettingsLedger, false, '设置页不应再复制完整事件账本');
    assert.equal(continuity.hasWorldPanelButton, true);
    assert.equal(continuity.featureFoldsClosed, true, '设置页功能分区应默认收起');
    const socialActionLayout = await page.evaluate(() => {
        const section = document.querySelector('.mvuad-social-section');
        const actions = section?.querySelector('.mvuad-actions');
        const button = section?.querySelector('.mvuad-social-run');
        section.open = true;
        const actionsRect = actions.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const result = {
            actionsWidth: actionsRect.width,
            buttonWidth: buttonRect.width,
            buttonHeight: buttonRect.height,
        };
        section.open = false;
        return result;
    });
    assert.ok(
        socialActionLayout.buttonWidth >= socialActionLayout.actionsWidth - 1,
        '移动端二审按钮必须撑满操作区，不能压成竖排窄条',
    );
    assert.ok(socialActionLayout.buttonHeight >= 42, '移动端二审按钮必须保留触控高度');
    if (process.env.MVUAD_SETTINGS_SCREENSHOT) {
        await page.evaluate(() => {
            document.querySelector('.mvuad-connection-manager').open = true;
        });
        await page.locator('#mvu-auto-doctor-settings').screenshot({ path: process.env.MVUAD_SETTINGS_SCREENSHOT });
    }
    await page.evaluate(() => {
        localStorage.setItem('mvu-auto-doctor-orb-position-v1', JSON.stringify({
            side: 'right',
            top: 260,
            tucked: true,
        }));
        window.dispatchEvent(new Event('resize'));
    });
    const orbBeforeOpen = await page.evaluate(() => {
        const orb = document.querySelector('#mvuad-floating-orb');
        const rect = orb?.getBoundingClientRect();
        return {
            exists: !!orb,
            hidden: !!orb?.hidden,
            top: rect?.top ?? -1,
            bottom: rect?.bottom ?? Number.MAX_SAFE_INTEGER,
            right: rect?.right ?? Number.MAX_SAFE_INTEGER,
            count: orb?.querySelector('.mvuad-orb-count')?.textContent,
            tucked: !!orb?.classList.contains('mvuad-orb-tucked'),
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
        };
    });
    assert.equal(orbBeforeOpen.exists, true, '必须建立游玩时悬浮入口');
    assert.equal(orbBeforeOpen.hidden, false);
    assert.ok(
        orbBeforeOpen.top >= 0 && orbBeforeOpen.bottom <= 844,
        JSON.stringify(orbBeforeOpen),
    );
    assert.equal(orbBeforeOpen.count, '1');
    assert.equal(orbBeforeOpen.tucked, true);
    assert.ok(orbBeforeOpen.right <= orbBeforeOpen.documentClientWidth);
    assert.equal(
        orbBeforeOpen.documentScrollWidth,
        orbBeforeOpen.documentClientWidth,
        `收起的悬浮球不得扩大移动端横向滚动范围：${JSON.stringify(orbBeforeOpen)}`,
    );
    const tuckedOrbHitTargets = await page.evaluate(() => {
        const storageKey = 'mvu-auto-doctor-orb-position-v1';
        const orb = document.querySelector('#mvuad-floating-orb');
        const probe = (side) => {
            localStorage.setItem(storageKey, JSON.stringify({
                side,
                top: 260,
                tucked: true,
            }));
            window.dispatchEvent(new Event('resize'));
            const rect = orb.getBoundingClientRect();
            const x = side === 'right' ? rect.right - 43 : rect.left + 43;
            const y = rect.top + (rect.height / 2);
            return {
                side,
                x,
                y,
                hit: orb.contains(document.elementFromPoint(x, y)),
            };
        };
        const result = {
            right: probe('right'),
            left: probe('left'),
        };
        localStorage.setItem(storageKey, JSON.stringify({
            side: 'right',
            top: 260,
            tucked: true,
        }));
        window.dispatchEvent(new Event('resize'));
        return result;
    });
    assert.equal(
        tuckedOrbHitTargets.right.hit,
        true,
        `右侧缩边悬浮球必须保留至少44px触控宽度：${JSON.stringify(tuckedOrbHitTargets)}`,
    );
    assert.equal(
        tuckedOrbHitTargets.left.hit,
        true,
        `左侧缩边悬浮球必须保留至少44px触控宽度：${JSON.stringify(tuckedOrbHitTargets)}`,
    );
    await page.evaluate(() => {
        /*
         * Reproduce SillyTavern's real root geometry. A transformed zero-height
         * root creates a containing block for fixed descendants, while the
         * application body remains fixed to the visual viewport.
         */
        Object.assign(document.documentElement.style, {
            height: '0px',
            perspective: '1000px',
            transform: 'translateZ(0)',
        });
        Object.assign(document.body.style, {
            position: 'fixed',
            inset: '0',
            width: '390px',
            height: '844px',
            overflow: 'hidden',
        });
        /*
         * Some real browser sidebars append a 350px-wide custom element just
         * beyond the app and leave visualViewport.pageLeft/scrollX non-zero.
         * Body-anchored overlays must compensate instead of losing their left
         * edge outside the visible mobile viewport.
         */
        const sidebar = document.createElement('div');
        sidebar.id = 'qc-browser-sidebar-offset';
        Object.assign(sidebar.style, {
            position: 'absolute',
            left: '390px',
            top: '0',
            width: '350px',
            height: '1px',
        });
        document.documentElement.appendChild(sidebar);
        document.documentElement.style.overflowX = 'auto';
        window.scrollTo(35, 0);
        if ((window.visualViewport?.pageLeft ?? window.scrollX) < 35) {
            document.scrollingElement.scrollLeft = 35;
            document.documentElement.scrollLeft = 35;
        }
    });
    await page.waitForFunction(
        () => (window.visualViewport?.pageLeft ?? window.scrollX) >= 35,
        null,
        { timeout: 5000 },
    );
    await page.evaluate(() => document.querySelector('#mvuad-floating-orb')?.click());
    const floatingPanel = await page.evaluate(() => {
        const panel = document.querySelector('#mvuad-floating-panel');
        const rect = panel?.getBoundingClientRect();
        const firstCard = panel?.querySelector('.mvuad-thread-card');
        const groups = [...(firstCard?.querySelectorAll('.mvuad-thread-group') || [])];
        const progress = firstCard?.querySelector('[role="progressbar"]');
        return {
            hidden: !!panel?.hidden,
            top: rect?.top ?? -1,
            bottom: rect?.bottom ?? Number.MAX_SAFE_INTEGER,
            left: rect?.left ?? -1,
            right: rect?.right ?? Number.MAX_SAFE_INTEGER,
            cards: panel?.querySelectorAll('.mvuad-thread-card').length || 0,
            badgeCount: firstCard?.querySelectorAll(':scope > summary .mvuad-thread-badge').length || 0,
            groupCount: groups.length,
            firstGroupOpen: !!groups[0]?.open,
            laterGroupsClosed: groups.slice(1).every((group) => !group.open),
            progressNow: progress?.getAttribute('aria-valuenow') || '',
            pageLeft: window.visualViewport?.pageLeft ?? window.scrollX,
            text: panel?.textContent || '',
        };
    });
    assert.equal(floatingPanel.hidden, false);
    assert.ok(
        floatingPanel.top >= 0 && floatingPanel.bottom <= 844,
        `浮层必须留在真实 SillyTavern 视口内：${JSON.stringify(floatingPanel)}`,
    );
    assert.ok(
        floatingPanel.left >= 0 && floatingPanel.right <= 391,
        `浮层必须完整落在横向可视区：${JSON.stringify(floatingPanel)}`,
    );
    assert.ok(floatingPanel.pageLeft >= 35, '回归必须真实覆盖非零水平视口偏移');
    assert.equal(floatingPanel.cards, 1);
    assert.equal(floatingPanel.badgeCount, 2, '事件摘要只保留阶段与紧迫度两枚徽章');
    assert.equal(floatingPanel.groupCount, 3, '事件字段必须分成当前、因果、传播与收束');
    assert.equal(floatingPanel.firstGroupOpen, true, '事件卡默认只展开当前进展');
    assert.equal(floatingPanel.laterGroupsClosed, true);
    assert.equal(floatingPanel.progressNow, '2', '事件进度必须暴露给辅助技术');
    assert.equal(
        await page.locator('#mvuad-floating-orb').isHidden(),
        true,
        '面板打开后悬浮球必须隐藏，不能压住世界摘要和分类',
    );
    assert.match(floatingPanel.text, /分类世界态势/u);
    assert.match(floatingPanel.text, /长期趋势/u);
    assert.match(floatingPanel.text, /因果联动/u);
    assert.match(floatingPanel.text, /打开完整论坛/u);
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="world"]')?.hidden),
        false,
    );
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="threads"]')?.hidden),
        true,
        '世界摘要不得与事件详情纵向堆叠',
    );
    const worldCategories = await page.evaluate(() => ({
        total: document.querySelectorAll('#mvuad-floating-panel .mvuad-world-category').length,
        open: document.querySelectorAll('#mvuad-floating-panel .mvuad-world-category[open]').length,
        visibleLists: [...document.querySelectorAll('#mvuad-floating-panel .mvuad-world-category-list')]
            .filter((element) => element.getClientRects().length > 0).length,
        digest: document.querySelector('#mvuad-floating-panel .mvuad-world-digest')?.textContent || '',
    }));
    assert.equal(worldCategories.total, 7);
    assert.equal(worldCategories.open, 0, '世界分类默认全部收起，避免再次挤成一整页');
    assert.equal(worldCategories.visibleLists, 0);
    assert.match(worldCategories.digest, /旧桥积水/u);
    if (process.env.MVUAD_FLOATING_WORLD_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_WORLD_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-world-category[data-world-category="factions"] > summary');
    assert.match(
        await page.locator('#mvuad-floating-panel .mvuad-world-category[data-world-category="factions"]').textContent(),
        /港区运输联合体/u,
    );
    assert.match(
        await page.locator('#mvuad-floating-panel .mvuad-world-category[data-world-category="factions"]').textContent(),
        /来源事件未绑定事件账本/u,
        '分类世界条目必须显示与事件账本的因果绑定状态',
    );
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="threads"]');
    assert.equal(
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-floating-page[data-page="threads"]')?.hidden),
        false,
    );
    assert.match(
        await page.locator('#mvuad-floating-panel .mvuad-thread-progress').textContent(),
        /\/9/u,
    );
    const threadPanelText = await page.locator(
        '#mvuad-floating-panel .mvuad-floating-page[data-page="threads"]',
    ).textContent();
    assert.match(threadPanelText, /交联成熟度0\/4/u);
    assert.match(threadPanelText, /交联通道尚无可核验交联/u);
    assert.match(threadPanelText, /当前可观察入口当前不应进入正文/u);
    assert.match(threadPanelText, /传播节点尚未形成世界表面/u);
    if (process.env.MVUAD_FLOATING_THREADS_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_THREADS_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="forum"]');
    assert.equal(
        await page.evaluate(() => document.querySelectorAll('#mvuad-floating-panel .mvuad-floating-forum-preview-item').length),
        3,
    );
    const floatingForumButton = await page.evaluate(() => {
        const page = document.querySelector(
            '#mvuad-floating-panel .mvuad-floating-page[data-page="forum"]',
        );
        const preview = page?.querySelector('.mvuad-floating-forum-preview');
        const button = page?.querySelector('.mvuad-floating-forum');
        const pageRect = page?.getBoundingClientRect();
        const previewRect = preview?.getBoundingClientRect();
        const buttonRect = button?.getBoundingClientRect();
        return {
            pageLeft: pageRect?.left ?? -1,
            pageRight: pageRect?.right ?? Number.MAX_SAFE_INTEGER,
            previewBottom: previewRect?.bottom ?? Number.MAX_SAFE_INTEGER,
            left: buttonRect?.left ?? -1,
            right: buttonRect?.right ?? Number.MAX_SAFE_INTEGER,
            top: buttonRect?.top ?? -1,
            width: buttonRect?.width ?? 0,
            height: buttonRect?.height ?? 0,
        };
    });
    assert.ok(
        floatingForumButton.width >= 280 && floatingForumButton.height >= 42,
        `完整论坛入口必须保持横向可读与可触控：${JSON.stringify(floatingForumButton)}`,
    );
    assert.ok(
        floatingForumButton.left >= floatingForumButton.pageLeft
        && floatingForumButton.right <= floatingForumButton.pageRight
        && floatingForumButton.top >= floatingForumButton.previewBottom,
        `完整论坛入口不得覆盖预览卡或超出论坛页：${JSON.stringify(floatingForumButton)}`,
    );
    if (process.env.MVUAD_FLOATING_FORUM_SCREENSHOT) {
        await page.locator('#mvuad-floating-panel').screenshot({ path: process.env.MVUAD_FLOATING_FORUM_SCREENSHOT });
    }
    if (process.env.MVUAD_FLOATING_SCREENSHOT) {
        await page.screenshot({ path: process.env.MVUAD_FLOATING_SCREENSHOT });
    }
    await page.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="tools"]');
    const floatingToolControls = await page.evaluate(() => {
        const panel = document.querySelector('#mvuad-floating-panel');
        const actions = [...panel.querySelectorAll('.mvuad-floating-actions > button')];
        const visible = actions.filter((button) => !button.hidden);
        return {
            close: (() => {
                const box = panel.querySelector('.mvuad-floating-close')
                    ?.getBoundingClientRect();
                return {
                    width: box?.width || 0,
                    height: box?.height || 0,
                };
            })(),
            visibleCount: visible.length,
            hiddenCancel: panel.querySelector('.mvuad-floating-cancel-task')?.hidden,
            controls: visible.map((button) => {
                const box = button.getBoundingClientRect();
                return {
                    width: box.width,
                    height: box.height,
                    lines: Math.round(box.height / 20),
                };
            }),
        };
    });
    assert.equal(floatingToolControls.hiddenCancel, true);
    assert.equal(floatingToolControls.visibleCount, 4);
    assert.ok(
        floatingToolControls.close.width >= 42
        && floatingToolControls.close.height >= 42,
        `悬浮面板关闭按钮必须达到 42×42：${JSON.stringify(floatingToolControls.close)}`,
    );
    assert.ok(
        floatingToolControls.controls.every(
            (control) => control.width >= 42 && control.height >= 42,
        ),
        `真实宿主 min-content 规则下工具按钮仍须横向可读：${JSON.stringify(floatingToolControls.controls)}`,
    );
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
            panelTop: panel?.getBoundingClientRect().top ?? -1,
            panelBottom: panel?.getBoundingClientRect().bottom ?? Number.MAX_SAFE_INTEGER,
            left: rect?.left ?? -1,
            right: rect?.right ?? Number.MAX_SAFE_INTEGER,
            posts: panel?.querySelectorAll('.mvuad-forum-post').length || 0,
            comments: panel?.querySelectorAll('.mvuad-forum-comment').length || 0,
            expandedPosts: panel?.querySelectorAll('.mvuad-forum-post.is-expanded').length || 0,
            visibleComments: [...(panel?.querySelectorAll('.mvuad-forum-comment') || [])]
                .filter((comment) => comment.getClientRects().length > 0).length,
            chips: panel?.querySelectorAll('.mvuad-forum-chip').length || 0,
            floors: panel?.querySelectorAll('.mvuad-forum-comment-floor').length || 0,
            heatBadges: panel?.querySelectorAll('.mvuad-forum-heat').length || 0,
            hotPosts: panel?.querySelectorAll('.mvuad-forum-post[data-heat-tier="hot"]').length || 0,
            hotComments: panel?.querySelectorAll('.mvuad-forum-hot-comment').length || 0,
            threadToggles: panel?.querySelectorAll('.mvuad-forum-thread-toggle').length || 0,
            threadToggleHeight: panel?.querySelector('.mvuad-forum-thread-toggle')?.getBoundingClientRect().height || 0,
            threadToggleWidth: panel?.querySelector('.mvuad-forum-thread-toggle')?.getBoundingClientRect().width || 0,
            shellClientWidth: shell?.clientWidth || 0,
            shellScrollWidth: shell?.scrollWidth || 0,
            feedEnds: panel?.querySelectorAll('.mvuad-forum-feed-end').length || 0,
            headerHeight: panel?.querySelector('.mvuad-forum-header')?.getBoundingClientRect().height || 0,
            firstPostHeight: panel?.querySelector('.mvuad-forum-post')?.getBoundingClientRect().height || 0,
            visiblePosts: [...(panel?.querySelectorAll('.mvuad-forum-post') || [])].filter((post) => {
                const postRect = post.getBoundingClientRect();
                const feedRect = panel?.querySelector('.mvuad-forum-feed')?.getBoundingClientRect();
                return feedRect && postRect.top < feedRect.bottom && postRect.bottom > feedRect.top;
            }).length,
            clearInsideToolbar: panel?.querySelectorAll('.mvuad-forum-toolbar .mvuad-forum-clear').length || 0,
            controlsOpen: !!panel?.querySelector('.mvuad-forum-controls')?.open,
            toolbarVisible: (panel?.querySelector('.mvuad-forum-toolbar')?.getClientRects().length || 0) > 0,
            primaryRefreshVisible: (panel?.querySelector('.mvuad-forum-refresh-main')?.getClientRects().length || 0) > 0,
            refreshMode: panel?.querySelector('.mvuad-forum-refresh-mode')?.value || '',
            statusHidden: !!panel?.querySelector('.mvuad-forum-status')?.hidden,
            statusKind: panel?.querySelector('.mvuad-forum-status')?.dataset.kind || '',
            text: panel?.textContent || '',
            externalHidden: !!panel?.querySelector('.mvuad-forum-external')?.hidden,
        };
    });
    assert.equal(forumPanel.hidden, false);
    assert.ok(
        forumPanel.panelTop >= 0 && forumPanel.panelBottom <= 844,
        `完整论坛必须留在真实 SillyTavern 视口内：${JSON.stringify(forumPanel)}`,
    );
    assert.ok(forumPanel.left >= 0 && forumPanel.right <= 391);
    assert.equal(forumPanel.posts, 4);
    assert.equal(forumPanel.comments, 6);
    assert.equal(forumPanel.expandedPosts, 0, '信息流首页不得默认展开整帖');
    assert.equal(forumPanel.visibleComments, 0, '收起状态不得因 CSS 覆盖而泄漏回复楼层');
    assert.equal(forumPanel.chips, 3);
    assert.equal(forumPanel.floors, 6);
    assert.equal(forumPanel.heatBadges, 4);
    assert.equal(forumPanel.hotPosts, 1);
    assert.equal(forumPanel.hotComments, 4, '每个有回复的主题只显示一条紧凑热评预览');
    assert.equal(forumPanel.threadToggles, 4, '每个主题必须只有一个整帖展开入口');
    assert.ok(
        forumPanel.threadToggleHeight >= 42 && forumPanel.threadToggleWidth >= 42,
        `mobile whole-thread control must expose a 42px touch target (measured ${forumPanel.threadToggleWidth}x${forumPanel.threadToggleHeight}px)`,
    );
    assert.ok(
        forumPanel.shellScrollWidth <= forumPanel.shellClientWidth,
        `forum shell must not overflow horizontally (scroll ${forumPanel.shellScrollWidth}px, client ${forumPanel.shellClientWidth}px)`,
    );
    assert.equal(forumPanel.feedEnds, 1);
    assert.ok(forumPanel.headerHeight <= 64, '论坛顶栏不得再次膨胀成大面积空头图');
    assert.ok(
        forumPanel.firstPostHeight <= 210,
        `默认帖子必须保持手机信息流密度（实测 ${forumPanel.firstPostHeight}px）`,
    );
    assert.ok(
        forumPanel.visiblePosts >= 2,
        `手机首屏至少应同时看见两个主题（实测 ${forumPanel.visiblePosts} 个）`,
    );
    assert.equal(forumPanel.clearInsideToolbar, 0, '清空操作不得继续与刷新按钮同级拥挤');
    assert.equal(forumPanel.controlsOpen, false, '完整论坛打开时低频来源与管理选项必须默认收起');
    assert.equal(forumPanel.toolbarVisible, false, '收起状态不得继续占据手机首屏');
    assert.equal(forumPanel.primaryRefreshVisible, true, '手动刷新按钮必须始终留在论坛标题栏');
    assert.equal(forumPanel.refreshMode, 'manual');
    assert.equal(forumPanel.statusHidden, false);
    assert.equal(forumPanel.statusKind, 'ok', '刚完成刷新时只保留明确的成功状态行');
    assert.match(forumPanel.text, /北门面摊/u);
    assert.match(forumPanel.text, /展开 2 条评论/u);
    assert.match(forumPanel.text, /医生内置论坛/u);
    assert.match(forumPanel.text, /刷新：手动/u);
    assert.equal(forumPanel.externalHidden, true, '未安装Zsd时仍必须显示内置论坛，而不是空跳转');
    await page.click('.mvuad-forum-controls > summary');
    assert.deepEqual(
        await page.evaluate(() => {
            const controls = document.querySelector('.mvuad-forum-controls');
            const toolbar = document.querySelector('.mvuad-forum-toolbar');
            return {
                open: !!controls?.open,
                toolbarVisible: (toolbar?.getClientRects().length || 0) > 0,
            };
        }),
        { open: true, toolbarVisible: true },
        '用户主动展开后才显示来源与管理选项',
    );
    await page.click('.mvuad-forum-controls > summary');
    await page.click('.mvuad-forum-post[data-post-id="FP-1-A"] .mvuad-forum-thread-toggle');
    const wholeThreadExpansion = await page.evaluate(() => {
        const post = document.querySelector('.mvuad-forum-post[data-post-id="FP-1-A"]');
        const body = post?.querySelector('.mvuad-forum-post-body');
        const toggle = post?.querySelector('.mvuad-forum-thread-toggle');
        const comments = post?.querySelector('.mvuad-forum-comments');
        const sourceBody = window.MvuAutoDoctorAPI.getForumState()
            .posts.find((item) => item.id === 'FP-1-A')?.body || '';
        const finalText = sourceBody.slice(-18);
        const textNode = body?.firstChild;
        const range = document.createRange();
        if (textNode) {
            range.setStart(textNode, Math.max(0, textNode.length - finalText.length));
            range.setEnd(textNode, textNode.length);
        }
        const finalRect = textNode ? range.getBoundingClientRect() : new DOMRect();
        const style = body ? getComputedStyle(body) : null;
        return {
            expanded: !!post?.classList.contains('is-expanded'),
            ariaExpanded: toggle?.getAttribute('aria-expanded'),
            label: toggle?.textContent,
            bodyMatchesSource: body?.textContent === sourceBody,
            bodyEndsWithSource: body?.textContent?.endsWith(finalText),
            clientHeight: body?.clientHeight || 0,
            scrollHeight: body?.scrollHeight || 0,
            overflow: style?.overflow,
            lineClamp: style?.webkitLineClamp,
            finalRectHeight: finalRect.height,
            commentsHidden: !!comments?.hidden,
            visibleComments: [...(post?.querySelectorAll('.mvuad-forum-comment') || [])]
                .filter((comment) => comment.getClientRects().length > 0).length,
            hotPreviewVisible: (post?.querySelector('.mvuad-forum-hot-comment')?.getClientRects().length || 0) > 0,
        };
    });
    assert.equal(wholeThreadExpansion.expanded, true, '单一入口必须展开整张帖子');
    assert.equal(wholeThreadExpansion.ariaExpanded, 'true');
    assert.equal(wholeThreadExpansion.label, '收起全文与评论');
    assert.equal(wholeThreadExpansion.bodyMatchesSource, true, '展开后的楼主正文必须与数据源逐字一致');
    assert.equal(wholeThreadExpansion.bodyEndsWithSource, true, '楼主正文最后一段必须真实渲染');
    assert.equal(wholeThreadExpansion.commentsHidden, false, '同一次点击必须显示完整回复');
    assert.equal(wholeThreadExpansion.visibleComments, 2);
    assert.equal(wholeThreadExpansion.hotPreviewVisible, false, '展开整帖后不得重复显示热评摘要');
    assert.equal(wholeThreadExpansion.overflow, 'visible');
    assert.notEqual(wholeThreadExpansion.lineClamp, '2');
    assert.equal(
        wholeThreadExpansion.scrollHeight,
        wholeThreadExpansion.clientHeight,
        '完整楼主正文不得继续被内部滚动或裁切',
    );
    assert.ok(wholeThreadExpansion.finalRectHeight > 0, '楼主正文末尾文字必须拥有真实布局区域');

    await page.click('.mvuad-forum-post[data-post-id="FP-1-B"] .mvuad-forum-thread-toggle');
    assert.deepEqual(
        await page.evaluate(() => {
            const post = document.querySelector('.mvuad-forum-post[data-post-id="FP-1-B"]');
            return {
                expanded: !!post?.classList.contains('is-expanded'),
                label: post?.querySelector('.mvuad-forum-thread-toggle')?.textContent,
                visibleComments: [...(post?.querySelectorAll('.mvuad-forum-comment') || [])]
                    .filter((comment) => comment.getClientRects().length > 0).length,
            };
        }),
        { expanded: true, label: '收起全文与评论', visibleComments: 2 },
        '中等长度帖子也必须由同一入口同时展开正文和回复',
    );
    await page.click('.mvuad-forum-post[data-post-id="FP-1-A"] .mvuad-forum-thread-toggle');
    assert.deepEqual(
        await page.evaluate(() => {
            const post = document.querySelector('.mvuad-forum-post[data-post-id="FP-1-A"]');
            const body = post?.querySelector('.mvuad-forum-post-body');
            const toggle = post?.querySelector('.mvuad-forum-thread-toggle');
            const comments = post?.querySelector('.mvuad-forum-comments');
            return {
                expanded: !!post?.classList.contains('is-expanded'),
                ariaExpanded: toggle?.getAttribute('aria-expanded'),
                label: toggle?.textContent,
                lineClamp: body ? getComputedStyle(body).webkitLineClamp : '',
                commentsHidden: !!comments?.hidden,
                visibleComments: [...(post?.querySelectorAll('.mvuad-forum-comment') || [])]
                    .filter((comment) => comment.getClientRects().length > 0).length,
            };
        }),
        {
            expanded: false,
            ariaExpanded: 'false',
            label: '展开 2 条评论',
            lineClamp: '2',
            commentsHidden: true,
            visibleComments: 0,
        },
        '再次点击必须同时收起楼主正文和回复',
    );
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
    await page.evaluate(() => window.MvuAutoDoctorAPI.openForum());
    await page.waitForFunction(() => !document.querySelector('#mvuad-forum-panel')?.hidden);
    assert.equal(
        await page.evaluate(() => document.querySelector('.mvuad-forum-controls')?.open),
        false,
        '重新打开论坛时来源与管理选项必须恢复收起',
    );
    await page.click('#mvuad-forum-panel .mvuad-forum-close');
    assert.deepEqual(
        await page.evaluate(() => ({
            panelHidden: !!document.querySelector('#mvuad-floating-panel')?.hidden,
            orbHidden: !!document.querySelector('#mvuad-floating-orb')?.hidden,
        })),
        { panelHidden: true, orbHidden: false },
        '从世界面板打开论坛时应关闭世界面板，并在退出论坛后保留悬浮入口',
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
    await page.evaluate(() => {
        document.querySelector('#mvuad-floating-panel .mvuad-ledger-refresh')?.click();
    });
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
    assert.match(rerollPrompt, /当前没有登记中的未结事件/u);
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
        await page.evaluate(() => document.querySelector('#mvuad-floating-panel .mvuad-ledger-empty')?.textContent || ''),
        /当前没有未结事件/u,
    );
    assert.equal(
        await page.evaluate(() => document.querySelectorAll('#mvuad-forum-panel .mvuad-forum-post').length),
        0,
        '切换到空聊天后不得显示上一个聊天的论坛帖子',
    );

    const lifecyclePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await lifecyclePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await lifecyclePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await lifecyclePage.evaluate(() => {
        Object.assign(window.__TEST__.context.extensionSettings.mvu_auto_doctor, {
            forumSettingsVersion: 3,
            forumRefreshMode: 'auto',
            forumAutoRefresh: true,
            forumRefreshEvery: 1,
        });
    });
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
        ledgerText: document.querySelector('#mvuad-floating-panel .mvuad-ledger')?.textContent || '',
    }));
    assert.equal(lifecycle.version, '2.0.0-rc.1');
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
    assert.match(lifecycle.ledgerText, /已收束事件（1）/u);
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
        Object.values(
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor
                ?.phase6Runtime?.records || {},
        ).some((entry) => entry?.value?.state === 'failed')
    ), null, { timeout: 30000 });
    const doubleWriter = await doubleWriterPage.evaluate(() => ({
        replacements: window.__TEST__.calls.replace.length,
        status: window.MvuAutoDoctorAPI.getStatus(),
        continuityTurn: window.MvuAutoDoctorAPI.getContinuityState().turn,
        forumTurn: window.MvuAutoDoctorAPI.getForumState().turn,
    }));
    assert.equal(doubleWriter.replacements, 0, '无法关闭故事神谕 AUTO 时不得写 MVU');
    assert.match(doubleWriter.status, /避免双写/u);
    assert.equal(
        doubleWriter.continuityTurn,
        0,
        '阶段6 failed屏障必须让连续性放弃目标，不能回退读取旧正文',
    );
    assert.equal(doubleWriter.forumTurn, 0, '手动论坛不得被其他医生任务暗中触发');
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
        Object.values(
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor
                ?.phase6Runtime?.records || {},
        ).some((entry) => entry?.value?.state === 'failed')
    ), null, { timeout: 30000 });
    assert.equal(
        await copiedSettingsPage.evaluate(() => window.__TEST__.calls.replace.length),
        0,
        '故事神谕每次返回新设置副本且 AUTO 仍开启时不得写 MVU',
    );
    assert.equal(
        await copiedSettingsPage.evaluate(
            () => window.MvuAutoDoctorAPI.getContinuityState().turn,
        ),
        0,
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
    const continueInterrupted = await continueInterruptPage.evaluate(() => ({
        replacements: window.__TEST__.calls.replace.length,
        continuityRuns: window.__TEST__.calls.continuityRuns,
        continuityCalls: window.__TEST__.calls.model.filter((kind) => kind === 'continuity').length,
    }));
    assert.equal(continueInterrupted.replacements, 0, 'continue 开始后，挂起的旧 repair 结果不得写入同一楼层');
    assert.equal(
        continueInterrupted.continuityCalls,
        0,
        '阶段6要求活世界等待修复提交；continue使旧屏障stale后不得启动下游模型',
    );
    await continueInterruptPage.close();

    const sameTurnSettlePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await sameTurnSettlePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await sameTurnSettlePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await sameTurnSettlePage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 300;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
        setTimeout(() => {
            t.context.chat[2].mes += '\n宿主后处理补齐了本回合最终正文。';
            t.setLatestData({
                stat_data: { 账户: { 代币: 5 } },
                display_data: {},
            });
        }, 100);
    });
    await sameTurnSettlePage.waitForFunction(() => (
        window.__TEST__.calls.model.includes('repair')
        && window.MvuAutoDoctorAPI.getContinuityState().turn === 1
    ), null, { timeout: 30000 });
    const sameTurnSettle = await sameTurnSettlePage.evaluate(() => ({
        repairCalls: window.__TEST__.calls.model.filter((kind) => kind === 'repair').length,
        continuityCalls: window.__TEST__.calls.model.filter((kind) => kind === 'continuity').length,
        repairUser: window.__TEST__.calls.repairUser,
        status: window.MvuAutoDoctorAPI.getStatus(),
    }));
    assert.equal(
        sameTurnSettle.repairCalls,
        1,
        '同一楼正文与 MVU 在完成事件后继续落地时，稳定后仍必须调用变量模型',
    );
    assert.equal(sameTurnSettle.continuityCalls, 1);
    assert.match(
        sameTurnSettle.repairUser,
        /宿主后处理补齐了本回合最终正文/u,
        '变量模型必须读取稳定后的最终正文，而不是完成事件瞬间的半成品',
    );
    assert.doesNotMatch(sameTurnSettle.status, /目标回复正文已经变化/u);
    await sameTurnSettlePage.close();

    const queuedManualPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await queuedManualPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await queuedManualPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await queuedManualPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.extensionSettings.mvu_auto_doctor.delayMs = 300;
        t.setMode('defer');
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await queuedManualPage.waitForFunction(() => window.__TEST__.hasDeferred(), null, { timeout: 20000 });
    await queuedManualPage.evaluate(() => {
        const t = window.__TEST__;
        window.__QUEUED_MANUAL__ = window.MvuAutoDoctorAPI.runLatest();
        t.context.chat[2].mes += '\n点击按钮后，同一回合又完成了一次宿主正文同步。';
        t.setMode('normal');
        t.resolveRepair(
            '<UpdateVariable><Analysis>旧自动请求不得落地</Analysis>'
            + '<JSONPatch>[{"op":"delta","path":"/账户/代币","value":9}]</JSONPatch>'
            + '</UpdateVariable>',
        );
    });
    await queuedManualPage.waitForFunction(() => (
        window.__TEST__.calls.model.filter((kind) => kind === 'repair').length === 2
    ), null, { timeout: 30000 });
    const queuedManual = await queuedManualPage.evaluate(async () => {
        const result = await window.__QUEUED_MANUAL__;
        return {
            result,
            replacements: window.__TEST__.calls.replace.length,
            repairUser: window.__TEST__.calls.repairUser,
        };
    });
    assert.equal(
        queuedManual.result.status,
        'applied',
        '排队中的手动检查必须在真正执行时读取当前回复',
    );
    assert.equal(queuedManual.replacements, 1, '失效的旧自动请求不得写入，手动新请求应写入一次');
    assert.match(
        queuedManual.repairUser,
        /点击按钮后，同一回合又完成了一次宿主正文同步/u,
    );
    await queuedManualPage.close();

    const identityPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await identityPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await identityPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const continuedIdentity = await identityPage.evaluate(async () => {
        const t = window.__TEST__;
        const message = t.context.chat[2];
        message.swipe_info = [{ extra: {} }];
        await window.MvuAutoDoctorAPI.auditHardContracts();
        const originalId = message.extra.mvu_auto_doctor_source_id;
        const mirroredId = message.swipe_info[0].extra.mvu_auto_doctor_source_id;
        await t.context.eventSource.emit('generation_started', 'continue', {}, false);
        t.context.chat[2] = {
            ...message,
            send_date: 'replacement-date',
            mes: `${message.mes}\n继续生成的新片段。`,
            extra: {},
            swipe_info: [{ extra: {} }],
        };
        await window.MvuAutoDoctorAPI.auditHardContracts();
        return {
            originalId,
            mirroredId,
            continuedId: t.context.chat[2].extra.mvu_auto_doctor_source_id,
            continuedSwipeId: t.context.chat[2].swipe_info[0].extra.mvu_auto_doctor_source_id,
        };
    });
    assert.equal(continuedIdentity.mirroredId, continuedIdentity.originalId);
    assert.equal(
        continuedIdentity.continuedId,
        continuedIdentity.originalId,
        'continue 替换消息对象后必须沿用原楼层稳定身份',
    );
    assert.equal(continuedIdentity.continuedSwipeId, continuedIdentity.originalId);
    await identityPage.close();

    const hardContractGatePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await hardContractGatePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await hardContractGatePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await hardContractGatePage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].mes = [
            '【预算】正文3000~4000汉字',
            '<content>第一回合正文过短。</content>',
            '<UpdateVariable><Analysis>无变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
        ].join('\n');
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await hardContractGatePage.waitForFunction(() => (
        window.__TEST__.calls.model.filter((kind) => kind === 'continuity').length === 1
    ), null, { timeout: 30000 });
    await hardContractGatePage.waitForFunction(() => (
        window.__TEST__.calls.repairOptions.length === 1
    ), null, { timeout: 30000 });
    const hardContractGate = await hardContractGatePage.evaluate(() => ({
        calls: structuredClone(window.__TEST__.calls),
        status: document.querySelector('.mvuad-continuity-status')?.textContent || '',
    }));
    assert.equal(
        hardContractGate.calls.model.filter((kind) => kind === 'continuity').length,
        1,
        '仅正文长度不足时仍应调用独立的活世界模型，不能让第一回合整条链路停摆',
    );
    assert.doesNotMatch(hardContractGate.status, /已跳过本回合/u);
    assert.match(
        hardContractGate.calls.repairSystem,
        /content-under-budget 只作质量报告[\s\S]*不得仅为了补字/u,
        '正文低于写作目标时只报告，不得拖慢变量关键路径去重写全文',
    );
    await hardContractGatePage.close();

    const connectionManagerPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await connectionManagerPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await connectionManagerPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const connectionManagerResult = await connectionManagerPage.evaluate(async () => {
        const t = window.__TEST__;
        const root = document.querySelector('.mvuad-connection-manager');
        const endpoint = root.querySelector('.mvuad-connection-endpoint');
        const apiKey = root.querySelector('.mvuad-connection-key');
        const model = root.querySelector('.mvuad-connection-model');
        const presetName = root.querySelector('.mvuad-connection-preset-name');
        const modelList = root.querySelector('.mvuad-model-list');
        const strictRoute = root.querySelector('.mvuad-strict-preset');
        const fastRoute = root.querySelector('.mvuad-fast-preset');
        const network = [];
        window.fetch = async (url, options = {}) => {
            network.push({
                url: String(url),
                method: String(options.method || 'GET'),
                authorization: String(options.headers?.Authorization || ''),
            });
            return new Response(JSON.stringify({
                data: [
                    { id: 'gemini-3.5-flash' },
                    { id: 'gemini-3.5-pro' },
                ],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };
        endpoint.value = 'https://models.example';
        apiKey.value = 'manager-test-secret';
        endpoint.dispatchEvent(new Event('change'));
        apiKey.dispatchEvent(new Event('change'));
        root.querySelector('.mvuad-model-fetch').click();
        await new Promise((resolve) => {
            const poll = () => {
                if (!modelList.hidden && modelList.options.length === 3) resolve();
                else setTimeout(poll, 10);
            };
            poll();
        });
        modelList.value = 'gemini-3.5-pro';
        modelList.dispatchEvent(new Event('change'));
        presetName.value = '格式修复 3.5P';
        root.querySelector('.mvuad-connection-preset-save').click();
        strictRoute.value = '格式修复 3.5P';
        strictRoute.dispatchEvent(new Event('change'));
        fastRoute.value = '格式修复 3.5P';
        fastRoute.dispatchEvent(new Event('change'));
        const backendNetwork = [];
        const backendModelCalls = [];
        t.context.getRequestHeaders = () => ({
            'Content-Type': 'application/json',
            'X-CSRF-Test': 'present',
        });
        t.context.ChatCompletionService = {
            async processRequest(payload, preset, custom, signal) {
                backendModelCalls.push({
                    payload: structuredClone(payload),
                    preset,
                    custom,
                    hasSignal: !!signal,
                });
                return { content: 'OK' };
            },
        };
        window.fetch = async (url, options = {}) => {
            backendNetwork.push({
                url: String(url),
                method: String(options.method || 'GET'),
                headers: structuredClone(options.headers || {}),
                body: JSON.parse(options.body || '{}'),
            });
            return new Response(JSON.stringify({
                data: [{ id: 'backend-3.5-flash' }],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };
        endpoint.value = 'https://backend.example';
        apiKey.value = 'backend-test-secret';
        model.value = 'backend-3.5-flash';
        root.querySelector('.mvuad-connection-backend').checked = true;
        presetName.value = '后端转发';
        endpoint.dispatchEvent(new Event('change'));
        apiKey.dispatchEvent(new Event('change'));
        model.dispatchEvent(new Event('change'));
        root.querySelector('.mvuad-connection-backend').dispatchEvent(new Event('change'));
        root.querySelector('.mvuad-model-fetch').click();
        await new Promise((resolve) => {
            const poll = () => {
                if (backendNetwork.length === 1) resolve();
                else setTimeout(poll, 10);
            };
            poll();
        });
        root.querySelector('.mvuad-connection-preset-save').click();
        strictRoute.value = '后端转发';
        strictRoute.dispatchEvent(new Event('change'));
        root.querySelector('.mvuad-test-strict').click();
        await new Promise((resolve) => {
            const poll = () => {
                if (/连接成功/u.test(root.querySelector('.mvuad-strict-provider-status').textContent)) {
                    resolve();
                } else {
                    setTimeout(poll, 10);
                }
            };
            poll();
        });
        const settings = window.__TEST__.context.extensionSettings.mvu_auto_doctor;
        return {
            network,
            modelValue: model.value,
            saved: structuredClone(settings.connectionPresets),
            strictRoute: settings.strictConnectionPreset,
            fastRoute: settings.fastConnectionPreset,
            legacyHidden: document.querySelector('.mvuad-model-routing')?.hidden === true,
            backendNetwork,
            backendModelCalls,
        };
    });
    assert.deepEqual(
        connectionManagerResult.network,
        [{
            url: 'https://models.example/v1/models',
            method: 'GET',
            authorization: 'Bearer manager-test-secret',
        }],
    );
    assert.equal(connectionManagerResult.modelValue, 'backend-3.5-flash');
    assert.equal(connectionManagerResult.saved.length, 2);
    assert.deepEqual(connectionManagerResult.saved[0], {
        name: '格式修复 3.5P',
        endpoint: 'https://models.example',
        apiKey: 'manager-test-secret',
        model: 'gemini-3.5-pro',
        viaBackend: false,
        rawUrl: false,
    });
    assert.equal(connectionManagerResult.saved[1].name, '后端转发');
    assert.equal(connectionManagerResult.saved[1].viaBackend, true);
    assert.equal(connectionManagerResult.strictRoute, '后端转发');
    assert.equal(connectionManagerResult.fastRoute, '格式修复 3.5P');
    assert.equal(connectionManagerResult.legacyHidden, true);
    assert.equal(connectionManagerResult.backendNetwork.length, 1);
    assert.equal(
        connectionManagerResult.backendNetwork[0].url,
        '/api/backends/chat-completions/status',
    );
    assert.equal(
        connectionManagerResult.backendNetwork[0].body.custom_url,
        'https://backend.example/v1',
    );
    assert.match(
        connectionManagerResult.backendNetwork[0].body.custom_include_headers,
        /Bearer backend-test-secret/u,
    );
    assert.equal(connectionManagerResult.backendModelCalls.length, 1);
    assert.equal(
        connectionManagerResult.backendModelCalls[0].payload.custom_url,
        'https://backend.example/v1',
    );
    assert.equal(
        connectionManagerResult.backendModelCalls[0].payload.model,
        'backend-3.5-flash',
    );
    assert.equal(connectionManagerResult.backendModelCalls[0].custom, true);
    await connectionManagerPage.close();

    const directParallelPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await directParallelPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await directParallelPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await directParallelPage.evaluate(async () => {
        const t = window.__TEST__;
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            strictModelProvider: 'direct',
            fastModelProvider: 'direct',
            connectionPresets: [
                {
                    name: 'strict-test',
                    endpoint: 'https://strict.example/v1',
                    model: 'strict-3.5f',
                    apiKey: 'strict-test-secret',
                    viaBackend: false,
                    rawUrl: false,
                },
                {
                    name: 'fast-test',
                    endpoint: 'https://api.deepseek.example',
                    model: 'deepseek-fast',
                    apiKey: 'fast-test-secret',
                    viaBackend: false,
                    rawUrl: false,
                },
            ],
            strictConnectionPreset: 'strict-test',
            fastConnectionPreset: 'fast-test',
            fastApiJsonMode: true,
            modelRoutingSettingsVersion: 2,
            delayMs: 0,
        });
        const pending = {};
        const network = {
            requests: [],
            active: 0,
            maxActive: 0,
        };
        window.__DIRECT_PARALLEL__ = {
            network,
            resolve(model) {
                pending[model]?.();
            },
        };
        window.fetch = async (url, options = {}) => {
            const body = JSON.parse(options.body);
            network.active += 1;
            network.maxActive = Math.max(network.maxActive, network.active);
            network.requests.push({
                url: String(url),
                model: body.model,
                jsonMode: body.response_format?.type || '',
                authorized: /^Bearer\s+\S+/u.test(options.headers?.Authorization || ''),
            });
            const output = body.model === 'strict-3.5f'
                ? '<UpdateVariable><Analysis>变量无需修改</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>'
                : JSON.stringify({
                    turn: 1,
                    threads: [{
                        id: 'WE-PAR-01',
                        title: '并发巡检',
                        kind: 'parallel',
                        eventType: 'progress',
                        level: 1,
                        origin: 'ambient',
                        relation: 'independent',
                        stage: 'seeded',
                        stageProgress: 1,
                        summary: '钟楼巡检按固定日程开始。',
                        nextBeat: '巡检员继续核对交接册。',
                        trigger: '钟楼固定巡检日程。',
                        seedBasis: '世界书：钟楼巡检制度',
                        knowledge: 'hidden',
                        urgency: 1,
                    }],
                });
            return await new Promise((resolve) => {
                pending[body.model] = () => {
                    network.active -= 1;
                    resolve(new Response(JSON.stringify({
                        choices: [{ message: { content: output } }],
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }));
                };
            });
        };
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await directParallelPage.waitForFunction(() => (
        window.__DIRECT_PARALLEL__?.network?.requests?.length === 1
    ), null, { timeout: 30000 });
    const strictStarted = await directParallelPage.evaluate(() => (
        structuredClone(window.__DIRECT_PARALLEL__.network)
    ));
    assert.equal(
        strictStarted.maxActive,
        1,
        '阶段6 settled屏障前只能启动变量修复，不得让活世界抢读正文',
    );
    assert.deepEqual(
        strictStarted.requests.map((request) => request.model),
        ['strict-3.5f'],
    );
    await directParallelPage.evaluate(() => {
        window.__DIRECT_PARALLEL__.resolve('strict-3.5f');
    });
    await directParallelPage.waitForFunction(() => (
        window.__DIRECT_PARALLEL__?.network?.requests?.length === 2
    ), null, { timeout: 30000 });
    const directParallelStarted = await directParallelPage.evaluate(() => (
        structuredClone(window.__DIRECT_PARALLEL__.network)
    ));
    assert.equal(
        directParallelStarted.maxActive,
        1,
        '活世界必须在修复提交、回读和settled发布后串行启动',
    );
    assert.deepEqual(
        directParallelStarted.requests.map((request) => request.model),
        ['strict-3.5f', 'deepseek-fast'],
    );
    assert.ok(directParallelStarted.requests.every((request) => request.authorized));
    assert.match(
        directParallelStarted.requests.find((request) => request.model === 'strict-3.5f').url,
        /strict\.example\/v1\/chat\/completions$/u,
    );
    assert.equal(
        directParallelStarted.requests.find((request) => request.model === 'strict-3.5f').jsonMode,
        '',
        '变量通道不得强套 JSON mode，必须保留 UpdateVariable 机器区块协议',
    );
    assert.equal(
        directParallelStarted.requests.find((request) => request.model === 'deepseek-fast').jsonMode,
        'json_object',
        'DS 轻量通道必须启用服务端 JSON 输出约束',
    );
    await directParallelPage.evaluate(() => {
        window.__DIRECT_PARALLEL__.resolve('deepseek-fast');
    });
    await directParallelPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState()?.turn === 1
        && /无需修正/u.test(document.querySelector('.mvuad-status')?.textContent || '')
    ), null, { timeout: 30000 });
    const directParallelFinished = await directParallelPage.evaluate(() => ({
        oracleCalls: window.__TEST__.calls.model.length,
        tavernCalls: window.__TEST__.calls.raw,
        state: window.MvuAutoDoctorAPI.getContinuityState(),
    }));
    assert.equal(directParallelFinished.oracleCalls, 0, '独立通道不得调用故事神谕');
    assert.equal(directParallelFinished.tavernCalls, 0, '独立通道不得回退酒馆当前3.1P');
    assert.equal(directParallelFinished.state.threads[0].id, 'WE-PAR-01');
    await directParallelPage.close();

    const partialCorrectionGatePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await partialCorrectionGatePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await partialCorrectionGatePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await partialCorrectionGatePage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.characters[0].data.system_prompt = '正文100~200汉字；结尾四项候选。';
        t.context.chat[2].mes = [
            `<content>${'甲'.repeat(20)}</content>`,
            '<options>',
            '>选项一：[继续观察]',
            '>选项二：[等待变化]',
            '</options>',
            '<UpdateVariable><Analysis>无变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
        ].join('\n');
        t.setMode('partial-hard-correction');
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await partialCorrectionGatePage.waitForFunction(() => (
        window.__TEST__.calls.model.filter((kind) => kind === 'continuity').length === 1
    ), null, { timeout: 30000 }).catch(async (error) => {
        console.error('partial correction gate diagnostics', await partialCorrectionGatePage.evaluate(() => ({
            calls: window.__TEST__.calls,
            message: window.__TEST__.context.chat[2],
            audit: window.MvuAutoDoctorAPI.getHardContractAudit(),
            repairStatus: document.querySelector('.mvuad-status')?.textContent || '',
            hardStatus: document.querySelector('.mvuad-protocol-status')?.textContent || '',
            continuityStatus: document.querySelector('.mvuad-continuity-status')?.textContent || '',
        })));
        throw error;
    });
    const partialCorrectionGate = await partialCorrectionGatePage.evaluate(() => ({
        continuityCalls: window.__TEST__.calls.model.filter(
            (kind) => kind === 'continuity',
        ).length,
        continuityTurn: Number(
            window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.continuity?.turn,
        ) || 0,
        swipeId: window.__TEST__.context.chat[2].swipe_id,
        hardAudit: window.MvuAutoDoctorAPI.getHardContractAudit(),
        continuityStatus:
            document.querySelector('.mvuad-continuity-status')?.textContent || '',
    }));
    assert.equal(
        partialCorrectionGate.swipeId,
        1,
        '测试前提：只修好选项的部分修正版应先落成一个可回退 swipe',
    );
    assert.ok(
        partialCorrectionGate.hardAudit.issues.some(
            (issue) => issue.code === 'content-under-budget',
        ),
        '修正版写入后必须重新检查当前 swipe，而不是沿用“已生成修正版”结论',
    );
    assert.equal(
        partialCorrectionGate.continuityCalls,
        1,
        '部分修正版只剩长度问题时仍应推进活世界账本',
    );
    assert.equal(partialCorrectionGate.continuityTurn, 1);
    assert.doesNotMatch(partialCorrectionGate.continuityStatus, /已跳过本回合/u);
    await partialCorrectionGatePage.close();

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
    const sameConnectionSerialized = await metadataRacePage.evaluate(() => (
        !window.__METADATA_RACE__?.pending?.continuity
    ));
    assert.equal(
        sameConnectionSerialized,
        true,
        'forum and continuity sharing one provider connection must never overlap',
    );
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
    await metadataRacePage.waitForFunction(() => (
        !!window.__METADATA_RACE__?.pending?.continuity
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
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            delayMs: 300,
            forumSettingsVersion: 3,
            forumRefreshMode: 'auto',
            forumAutoRefresh: true,
        });
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
        window.__CONTINUE_CALLS_BEFORE__ = {
            continuity: t.calls.model.filter((kind) => kind === 'continuity').length,
            forum: t.calls.model.filter((kind) => kind === 'forum').length,
        };
        t.context.chat[2].mes += '\n同一楼层的继续生成内容。';
        await t.context.eventSource.emit('generation_started', 'continue', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await continueCheckpointPage.waitForTimeout(2500);
    const checkpointAfterContinue = await continueCheckpointPage.evaluate(() => ({
        continuityTurn: window.__TEST__.context.chatMetadata.mvu_auto_doctor.continuityCheckpoint?.state?.turn,
        forumTurn: window.__TEST__.context.chatMetadata.mvu_auto_doctor.forumCheckpoint?.state?.turn,
        stateContinuityTurn: window.MvuAutoDoctorAPI.getContinuityState().turn,
        stateForumTurn: window.MvuAutoDoctorAPI.getForumState().turn,
        continuityCalls: window.__TEST__.calls.model.filter((kind) => kind === 'continuity').length,
        forumCalls: window.__TEST__.calls.model.filter((kind) => kind === 'forum').length,
        callsBefore: window.__CONTINUE_CALLS_BEFORE__,
    }));
    assert.equal(
        checkpointAfterContinue.stateContinuityTurn,
        1,
        '同一楼 continue 仍属一个回合，不得重复推进活世界时钟',
    );
    assert.equal(
        checkpointAfterContinue.stateForumTurn,
        1,
        '同一楼 continue 不得重复自动刷新论坛',
    );
    assert.equal(
        checkpointAfterContinue.continuityCalls,
        checkpointAfterContinue.callsBefore.continuity,
        '同一楼 continue 不得增加活世界模型费用',
    );
    assert.equal(
        checkpointAfterContinue.forumCalls,
        checkpointAfterContinue.callsBefore.forum,
        '同一楼 continue 不得增加论坛模型费用',
    );
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
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            forumSettingsVersion: 3,
            forumRefreshMode: 'auto',
            forumAutoRefresh: true,
        });
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

    const replacementRerollPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await replacementRerollPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await replacementRerollPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await replacementRerollPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('replacement-reroll');
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            delayMs: 300,
            forumSettingsVersion: 3,
            forumRefreshMode: 'manual',
            forumAutoRefresh: false,
        });
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await replacementRerollPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().threads?.[0]?.id === 'OLD-BRANCH-01'
    ), null, { timeout: 30000 });
    await replacementRerollPage.waitForFunction(() => {
        const current = window.MvuAutoDoctorAPI.getModelCallStats().currentRun;
        return current.total === 2 && current.succeeded === 2;
    }, null, { timeout: 30000 });
    const replacementBefore = await replacementRerollPage.evaluate(() => {
        const namespace = window.__TEST__.context.chatMetadata.mvu_auto_doctor;
        return {
            checkpointMessageId: namespace.continuityCheckpoint?.messageId,
            checkpointTurn: namespace.continuityCheckpoint?.state?.turn,
            sourceMessageId: namespace.continuity?.lastSource?.messageId,
            cumulativeCalls: window.MvuAutoDoctorAPI.getModelCallStats().total,
        };
    });
    assert.equal(replacementBefore.checkpointTurn, 0);
    assert.equal(replacementBefore.cumulativeCalls, 2);
    await replacementRerollPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2] = {
            is_user: false,
            is_system: false,
            send_date: '2026-07-25T00:00:00.000Z',
            swipe_id: 0,
            extra: {},
            mes: '这是酒馆替换整个消息对象后得到的重抽正文。\n'
              + '<UpdateVariable><Analysis>正确</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
        };
        await t.context.eventSource.emit('generation_started', 'regenerate', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await replacementRerollPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().threads?.[0]?.id === 'NEW-BRANCH-01'
    ), null, { timeout: 30000 });
    await replacementRerollPage.waitForFunction(() => {
        const current = window.MvuAutoDoctorAPI.getModelCallStats().currentRun;
        return current.total === 2 && current.succeeded === 2;
    }, null, { timeout: 30000 });
    await replacementRerollPage.waitForTimeout(900);
    const replacementAfter = await replacementRerollPage.evaluate(() => {
        const namespace = window.__TEST__.context.chatMetadata.mvu_auto_doctor;
        return {
            continuity: window.MvuAutoDoctorAPI.getContinuityState(),
            checkpointMessageId: namespace.continuityCheckpoint?.messageId,
            checkpointTurn: namespace.continuityCheckpoint?.state?.turn,
            sourceMessageId: namespace.continuity?.lastSource?.messageId,
            stats: window.MvuAutoDoctorAPI.getModelCallStats(),
            statsText: document.querySelector('.mvuad-settings-model-call-stats')?.textContent || '',
        };
    });
    assert.equal(replacementAfter.continuity.turn, 1, '替换消息对象的重抽必须从整楼生成前重新结算');
    assert.deepEqual(
        replacementAfter.continuity.threads.map((thread) => thread.id),
        ['NEW-BRANCH-01'],
        '新消息 ID 不得让旧回复事件残留到重抽账本',
    );
    assert.equal(replacementAfter.checkpointTurn, 0, '重抽不得推进或覆盖整楼生成前存档点');
    assert.equal(
        replacementAfter.checkpointMessageId,
        replacementBefore.checkpointMessageId,
        '宿主替换消息对象后仍必须保留最初的整楼存档点身份',
    );
    assert.notEqual(
        replacementAfter.sourceMessageId,
        replacementAfter.checkpointMessageId,
        '新账本来源必须绑定重抽后的新消息对象',
    );
    assert.equal(replacementAfter.stats.total, 4, '两次生成累计应各使用变量与活世界一次');
    assert.equal(replacementAfter.stats.currentRun.total, 2, '重抽界面只应显示本次两次调用');
    assert.deepEqual(replacementAfter.stats.currentRun.byTask, {
        variable: 1,
        social: 0,
        continuity: 1,
        forum: 0,
        other: 0,
    });
    assert.match(replacementAfter.statsText, /本次生成 2 次/u);
    assert.match(replacementAfter.statsText, /聊天累计 4 次/u);
    await replacementRerollPage.close();

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
        await window.MvuAutoDoctorAPI.runForum();
    });
    await externalForumPage.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.forum?.turn === 1
    ), null, { timeout: 30000 });
    const externalForumBuiltin = await externalForumPage.evaluate(() => ({
        forum: window.MvuAutoDoctorAPI.getForumState(),
        calls: structuredClone(window.__TEST__.calls),
        externalButtonHidden: document.querySelector('.mvuad-forum-external')?.hidden,
        summary: document.querySelector('.mvuad-forum-summary')?.textContent || '',
        controlsMeta: document.querySelector('.mvuad-forum-controls-meta')?.textContent || '',
        note: document.querySelector('.mvuad-forum-source-note')?.textContent || '',
    }));
    assert.equal(externalForumBuiltin.forum.turn, 1, '安装Zsd后手动刷新仍应使用默认内置来源');
    assert.equal(externalForumBuiltin.calls.forumRuns, 1);
    assert.equal(externalForumBuiltin.externalButtonHidden, false);
    assert.match(externalForumBuiltin.controlsMeta, /医生内置论坛/u);
    assert.match(externalForumBuiltin.note, /额外产生模型请求/u);
    await externalForumPage.evaluate(() => {
        const select = document.querySelector('.mvuad-forum-provider-settings');
        select.closest('.mvuad-settings-section').open = true;
        select.value = 'zsd';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await externalForumPage.click('.mvuad-forum-open');
    await externalForumPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat.push({ is_user: true, is_system: false, mes: '继续看看街上', swipe_id: 0, extra: {} });
        t.context.chat.push({ is_user: false, is_system: false, mes: '街面依旧热闹。', swipe_id: 0, extra: {} });
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 4);
    });
    await externalForumPage.waitForFunction(() => (
        window.MvuAutoDoctorAPI.getContinuityState().turn === 1
        && (
            window.__TEST__.context.chatMetadata
                ?.mvu_auto_doctor
                ?.continuitySourceReceipts
            || []
        ).some((receipt) => (
            receipt.sourceIndex === 2
            && receipt.decision === 'permanently-skipped'
        ))
    ), null, { timeout: 30000 }).catch(async (error) => {
        console.error('external forum continuity timeout diagnostics', await externalForumPage.evaluate(() => ({
            metadata: window.__TEST__.context.chatMetadata,
            calls: window.__TEST__.calls,
            continuity: window.MvuAutoDoctorAPI.getContinuityState(),
            repairStatus: document.querySelector('.mvuad-status')?.textContent || '',
            continuityStatus: document.querySelector('.mvuad-continuity-status')?.textContent || '',
            hardStatus: document.querySelector('.mvuad-protocol-status')?.textContent || '',
        })));
        throw error;
    });
    const continuityReceipts = await externalForumPage.evaluate(() => (
        structuredClone(
            window.__TEST__.context.chatMetadata
                ?.mvu_auto_doctor
                ?.continuitySourceReceipts
            || [],
        )
    ));
    assert.ok(
        continuityReceipts.some((receipt) => (
            receipt.sourceIndex === 2
            && receipt.decision === 'permanently-skipped'
        )),
        '先前被新生成作废的来源不得在后续 settled 回合补记',
    );
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
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            forumSettingsVersion: 3,
            forumRefreshMode: 'auto',
            forumAutoRefresh: true,
        });
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
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            forumSettingsVersion: 3,
            forumRefreshMode: 'auto',
            forumAutoRefresh: true,
        });
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

    const correctionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await correctionPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await correctionPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const correctionResult = await correctionPage.evaluate(async () => {
        const t = window.__TEST__;
        const original = `<thinking>行动A与骰面已锁定。</thinking>
<content>你观察门边的守卫。</content>
<options>
>选项一：[继续观察]
>选项二：[等待变化]
>选项三：[保持警戒]
>选项四：[结束回合]
</options>
<UpdateVariable><Analysis>无变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>`;
        t.context.characters[0].data.system_prompt = '正文100~200汉字；结尾四项候选。';
        t.context.chat[2].mes = original;
        t.context.chat[2].swipe_id = 0;
        delete t.context.chat[2].swipes;
        delete t.context.chat[2].swipe_info;
        t.setMode('hard-correction');
        const modelCallsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        await window.MvuAutoDoctorAPI.auditHardContracts();
        const message = t.context.chat[2];
        return {
            result,
            message: structuredClone(message),
            modelCalls: t.calls.model.length - modelCallsBefore,
            replaceCalls: t.calls.replace.length,
            audit: window.MvuAutoDoctorAPI.getHardContractAudit(),
        };
    });
    assert.equal(correctionResult.result.status, 'nochange');
    assert.equal(correctionResult.result.correction.status, 'ignored');
    assert.equal(correctionResult.modelCalls, 1, '变量诊断仍只允许一次模型调用');
    assert.equal(correctionResult.message.swipe_id, 0);
    assert.doesNotMatch(correctionResult.message.mes, new RegExp('甲{120}', 'u'));
    assert.match(correctionResult.message.mes, /你观察门边的守卫/u);
    assert.equal(correctionResult.replaceCalls, 0, '仅字数不足不得创建修正版 swipe 或复制 MVU');
    assert.ok(correctionResult.audit.issues.some(
        (issue) => issue.code === 'content-under-budget',
    ));
    await correctionPage.close();

    const deterministicStructurePage = await browser.newPage({
        viewport: { width: 390, height: 844 },
    });
    await deterministicStructurePage.goto(
        `http://127.0.0.1:${port}/`,
        { waitUntil: 'networkidle' },
    );
    await deterministicStructurePage.waitForFunction(
        () => !!window.MvuAutoDoctorAPI,
    );
    const deterministicStructure = await deterministicStructurePage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].mes = [
            '<content>你观察门边的守卫。',
            '<options>',
            '>选项一：[继续观察]',
            '>选项二：[等待变化]',
            '>选项三：[保持警戒]',
            '>选项四：[结束回合]',
            '</options>',
            '<UpdateVariable><Analysis>无变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
        ].join('\n');
        delete t.context.chat[2].swipes;
        delete t.context.chat[2].swipe_info;
        const modelCallsBefore = t.calls.model.length;
        const replaceCallsBefore = t.calls.replace.length;
        const result = await window.MvuAutoDoctorAPI.auditHardContracts();
        return {
            result,
            message: structuredClone(t.context.chat[2]),
            modelCallDelta: t.calls.model.length - modelCallsBefore,
            replaceCallDelta: t.calls.replace.length - replaceCallsBefore,
        };
    });
    assert.equal(deterministicStructure.result.status, 'audited');
    assert.equal(deterministicStructure.result.deterministicCorrection.status, 'applied');
    assert.equal(deterministicStructure.modelCallDelta, 0);
    assert.equal(deterministicStructure.replaceCallDelta, 1, '修正版 swipe 必须复制原 MVU 快照');
    assert.equal(deterministicStructure.message.swipe_id, 1);
    assert.match(
        deterministicStructure.message.mes,
        /你观察门边的守卫。\n<\/content>\n<options>/u,
    );
    assert.equal(
        (deterministicStructure.message.mes.match(/<UpdateVariable\b/giu) || []).length,
        1,
    );
    assert.ok(!deterministicStructure.result.issues.some(
        (issue) => issue.code === 'content-tag-count',
    ));
    await deterministicStructurePage.close();

    const internalSwipeLifecyclePage = await browser.newPage({
        viewport: { width: 390, height: 844 },
    });
    await internalSwipeLifecyclePage.goto(`http://127.0.0.1:${port}/`, {
        waitUntil: 'networkidle',
    });
    await internalSwipeLifecyclePage.waitForFunction(
        () => !!window.MvuAutoDoctorAPI,
    );
    const internalSwipeLifecycle = await internalSwipeLifecyclePage.evaluate(async () => {
        const t = window.__TEST__;
        Object.assign(t.context.extensionSettings.mvu_auto_doctor, {
            builtInContinuityEnabled: false,
            builtInForumEnabled: false,
            delayMs: 300,
        });
        t.context.chat[2].mes = [
            '<content>你观察门边的守卫。',
            '<options>',
            '>选项一：[继续观察]',
            '>选项二：[等待变化]',
            '>选项三：[保持警戒]',
            '>选项四：[结束回合]',
            '</options>',
            '<UpdateVariable><Analysis>无变化</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
        ].join('\n');
        delete t.context.chat[2].swipes;
        delete t.context.chat[2].swipe_info;
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        const namespace = (
            t.context.chatMetadata.mvu_auto_doctor ||= {}
        );
        namespace.continuity = {
            ...(namespace.continuity || {}),
            internalSwipeMarker: 'current-state',
        };
        namespace.continuityCheckpoint = {
            targetIndex: 2,
            state: {
                ...(namespace.continuity || {}),
                internalSwipeMarker: 'checkpoint-state',
            },
        };
        await t.context.eventSource.emit('message_received', 2);
        const barrier = await window.MvuAutoDoctorAPI.waitForTargetSettled(
            2,
            { timeoutMs: 20000 },
        );
        return {
            barrier,
            current: structuredClone(t.context.chat[2]),
            marker: t.context.chatMetadata.mvu_auto_doctor
                ?.continuity?.internalSwipeMarker,
        };
    });
    assert.equal(
        internalSwipeLifecycle.barrier.status,
        'settled',
        '医生自己的修正版 swipe 必须作为同一工作流的继任目标结算',
    );
    assert.equal(internalSwipeLifecycle.current.swipe_id, 1);
    assert.equal(
        internalSwipeLifecycle.barrier.swipeId,
        1,
        '终态 barrier 必须绑定修正版 swipe，而不是原始坏结构',
    );
    assert.equal(
        internalSwipeLifecycle.marker,
        'current-state',
        '内部修正版事件不得被当作用户切换并回滚连续性存档点',
    );
    assert.match(
        internalSwipeLifecycle.current.mes,
        /你观察门边的守卫。\n<\/content>\n<options>/u,
    );
    await internalSwipeLifecyclePage.close();

    const duplicateUpdatePage = await browser.newPage({
        viewport: { width: 390, height: 844 },
    });
    await duplicateUpdatePage.goto(`http://127.0.0.1:${port}/`, {
        waitUntil: 'networkidle',
    });
    await duplicateUpdatePage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const duplicateUpdate = await duplicateUpdatePage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.chat[2].mes = [
            '<content>正文</content>',
            '<UpdateVariable><Analysis>旧块一</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
            '<UpdateVariable><Analysis>旧块二</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
        ].join('\n');
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            message: structuredClone(t.context.chat[2]),
        };
    });
    assert.equal(duplicateUpdate.result.status, 'applied');
    assert.equal(
        (duplicateUpdate.message.mes.match(/<UpdateVariable\b/giu) || []).length,
        1,
        '修复提交后同一 swipe 只能保留一个可重放 MVU 区块',
    );
    assert.doesNotMatch(duplicateUpdate.message.mes, /旧块一|旧块二/u);
    await duplicateUpdatePage.close();

    const ruleBackedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await ruleBackedPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await ruleBackedPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const ruleBackedResult = await ruleBackedPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.characters[0].data.character_book.entries[0].content =
            '完成测试奖励时固定获得三枚代币。';
        t.context.chat[2].mes =
            '<content>你完成测试，获得了一枚代币。</content>'
            + '<UpdateVariable><Analysis>奖励</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
        t.setMode('rule-backed-correction');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            message: structuredClone(t.context.chat[2]),
            modelCalls: t.calls.model.length - callsBefore,
            audit: window.MvuAutoDoctorAPI.getHardContractAudit(),
        };
    });
    assert.equal(ruleBackedResult.result.status, 'applied');
    assert.equal(ruleBackedResult.result.correction.status, 'applied');
    assert.equal(ruleBackedResult.modelCalls, 1);
    assert.equal(ruleBackedResult.data.stat_data.账户.代币, 5);
    assert.match(ruleBackedResult.message.mes, /三枚代币/u);
    assert.equal(
        ruleBackedResult.message.swipe_info[1].extra.verification,
        'rule-evidence-and-state',
    );
    assert.equal(ruleBackedResult.audit.correction.evidence.ok, true);
    await ruleBackedPage.close();

    const derivedCardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await derivedCardPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await derivedCardPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const derivedCardResult = await derivedCardPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.characters[0].data.extensions.tavern_helper.scripts = [{
            name: '变量结构',
            enabled: true,
            content: [
                'registerMvuSchema(z.object({角色:z.object({',
                '属性:z.object({基础:z.object({STR:z.number()}),',
                '实际:z.object({STR:z.number()})}).transform(data => ({',
                '...data, 实际: { STR: data.基础.STR }',
                '})),',
                '衍生:z.object({MP_最大:z.number(),闪避值:z.number()})',
                '})}))',
            ].join(''),
        }];
        t.context.characters[0].data.character_book.entries[0].content = [
            '属性实际值由前端自动合成，AI无需写入。',
            'MP_最大、闪避值均由前端自动计算；AI禁止直接修改。',
        ].join('\n');
        t.setLatestData({
            stat_data: {
                角色: {
                    属性: { 基础: { STR: 5 }, 实际: { STR: 5 } },
                    衍生: { MP_最大: 50, 闪避值: 10 },
                },
            },
            display_data: {},
        });
        t.setRecomputeDerivedFields(true);
        t.setMode('derived-card');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
            prompt: t.calls.repairUser,
        };
    });
    assert.equal(derivedCardResult.result.status, 'applied');
    assert.equal(derivedCardResult.calls, 1);
    assert.equal(derivedCardResult.data.stat_data.角色.属性.基础.STR, 10);
    assert.equal(derivedCardResult.data.stat_data.角色.属性.实际.STR, 10);
    assert.equal(derivedCardResult.data.stat_data.角色.衍生.MP_最大, 100);
    assert.equal(derivedCardResult.data.stat_data.角色.衍生.闪避值, 15);
    assert.match(derivedCardResult.prompt, /\/角色\/属性\/实际\/STR/u);
    assert.match(derivedCardResult.prompt, /\/角色\/衍生\/MP_最大/u);
    assert.doesNotMatch(
        derivedCardResult.result.block,
        /\/角色\/属性\/实际\/STR|\/角色\/衍生\/MP_最大|\/角色\/衍生\/闪避值/u,
        '模型直写的自动派生字段必须剥离，只保留可写输入补丁',
    );
    await derivedCardPage.close();

    const unlistedSideEffectPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await unlistedSideEffectPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await unlistedSideEffectPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const unlistedSideEffectResult = await unlistedSideEffectPage.evaluate(async () => {
        const t = window.__TEST__;
        t.context.characters[0].data.extensions.tavern_helper.scripts = [{
            name: '变量结构',
            enabled: true,
            content: 'registerMvuSchema(z.object({角色:z.object({属性:z.any(),衍生:z.any(),状态:z.any()})}))',
        }];
        t.context.characters[0].data.character_book.entries[0].content = 'CON 按正文明确变化更新。';
        t.setLatestData({
            stat_data: {
                角色: {
                    属性: { 基础: { CON: 5 }, 实际: { CON: 5 } },
                    衍生: { HP_当前: 75, HP_最大: 75 },
                    状态: { 生命状态: '健康' },
                },
            },
            display_data: {},
        });
        t.setRecomputeUnlistedLifeState(true);
        t.setMode('unlisted-host-side-effect');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        const data = t.getLatestData();
        const undone = await window.MvuAutoDoctorAPI.undoLast();
        return {
            result,
            data,
            undone,
            afterUndo: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(unlistedSideEffectResult.result.status, 'applied');
    assert.equal(unlistedSideEffectResult.calls, 1, '确定性的 MVU 本地联动不得触发模型重试');
    assert.equal(unlistedSideEffectResult.data.stat_data.角色.属性.基础.CON, 8);
    assert.equal(unlistedSideEffectResult.data.stat_data.角色.属性.实际.CON, 8);
    assert.equal(unlistedSideEffectResult.data.stat_data.角色.衍生.HP_最大, 120);
    assert.equal(unlistedSideEffectResult.data.stat_data.角色.状态.生命状态, '受伤');
    assert.equal(unlistedSideEffectResult.undone, true);
    assert.equal(unlistedSideEffectResult.afterUndo.stat_data.角色.属性.基础.CON, 5);
    assert.equal(unlistedSideEffectResult.afterUndo.stat_data.角色.属性.实际.CON, 5);
    assert.equal(unlistedSideEffectResult.afterUndo.stat_data.角色.衍生.HP_最大, 75);
    assert.equal(unlistedSideEffectResult.afterUndo.stat_data.角色.状态.生命状态, '健康');
    assert.deepEqual(
        new Set(unlistedSideEffectResult.result.parserSideEffectPaths),
        new Set([
            '/角色/属性/实际/CON',
            '/角色/衍生/HP_最大',
            '/角色/状态/生命状态',
        ]),
    );
    await unlistedSideEffectPage.close();

    const analysisRetryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await analysisRetryPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await analysisRetryPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const analysisRetryResult = await analysisRetryPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('incomplete-then-valid');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
            retryPrompt: t.calls.repairUser,
        };
    });
    assert.equal(analysisRetryResult.result.status, 'applied');
    assert.equal(analysisRetryResult.result.attempts, 2);
    assert.equal(analysisRetryResult.calls, 2, '只有第一次分析结果损坏时才应触发第二次调用');
    assert.equal(analysisRetryResult.data.stat_data.账户.代币, 3);
    assert.match(analysisRetryResult.retryPrompt, /第 1 次分析失败/u);
    assert.match(analysisRetryResult.retryPrompt, /数组完成前被截断/u);
    await analysisRetryPage.close();

    const maxRetryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await maxRetryPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await maxRetryPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const maxRetryResult = await maxRetryPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('missing-always');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            calls: t.calls.model.length - callsBefore,
            replacements: t.calls.replace.length,
        };
    });
    assert.equal(maxRetryResult.result.status, 'failed');
    assert.equal(maxRetryResult.result.attempts, 2);
    assert.equal(maxRetryResult.calls, 2, '手动连续分析失败时整轮最多尝试两次');
    assert.equal(maxRetryResult.replacements, 0);
    await maxRetryPage.close();

    const recoveryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await recoveryPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await recoveryPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const recoveryResult = await recoveryPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('recoverable-tail');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(recoveryResult.result.status, 'applied');
    assert.equal(recoveryResult.result.recoveredOutput, true);
    assert.equal(recoveryResult.result.attempts, 1);
    assert.equal(recoveryResult.calls, 1, '完整 JSONPatch 只缺尾标签时应本地恢复，不浪费重试');
    assert.equal(recoveryResult.data.stat_data.账户.代币, 3);
    await recoveryPage.close();

    const innerCloseRecoveryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await innerCloseRecoveryPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await innerCloseRecoveryPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const innerCloseRecoveryResult = await innerCloseRecoveryPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('missing-inner-close');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(innerCloseRecoveryResult.result.status, 'applied');
    assert.equal(innerCloseRecoveryResult.result.recoveredOutput, true);
    assert.equal(innerCloseRecoveryResult.result.attempts, 1);
    assert.equal(
        innerCloseRecoveryResult.calls,
        1,
        '外层已闭合但 JSONPatch 闭合标签缺失时也必须本地恢复',
    );
    assert.equal(innerCloseRecoveryResult.data.stat_data.账户.代币, 3);
    await innerCloseRecoveryPage.close();

    const singleObjectPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await singleObjectPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await singleObjectPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const singleObjectResult = await singleObjectPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('single-object-patch');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(singleObjectResult.result.status, 'applied');
    assert.equal(singleObjectResult.result.recoveredOutput, true);
    assert.match(singleObjectResult.result.recoveryReason, /单个补丁对象/u);
    assert.equal(singleObjectResult.result.attempts, 1);
    assert.equal(singleObjectResult.calls, 1, '单对象补丁必须本地归一化，不得增加模型调用');
    assert.equal(singleObjectResult.data.stat_data.账户.代币, 3);
    await singleObjectPage.close();

    const missingCloseDiagnosticPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await missingCloseDiagnosticPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await missingCloseDiagnosticPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const missingCloseDiagnosticResult = await missingCloseDiagnosticPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('single-object-missing-close');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            calls: t.calls.model.length - callsBefore,
            diagnostics: window.MvuAutoDoctorAPI.getModelDiagnostics(),
        };
    });
    assert.equal(missingCloseDiagnosticResult.result.status, 'applied');
    assert.equal(missingCloseDiagnosticResult.result.recoveredOutput, true);
    assert.equal(missingCloseDiagnosticResult.calls, 1);
    const recoveredDiagnostic = missingCloseDiagnosticResult.diagnostics.find(
        (entry) => entry.status === 'recovered' && entry.rootType === 'object',
    );
    const transportDiagnostic = missingCloseDiagnosticResult.diagnostics.find(
        (entry) => entry.phase === 'transport' && entry.task === '变量诊断',
    );
    assert.equal(
        transportDiagnostic?.targetIndex,
        2,
        '目标型模型调用的脱敏诊断必须保留楼层索引',
    );
    assert.ok(recoveredDiagnostic, 'local structured-output recovery must create a diagnostic entry');
    assert.deepEqual(
        {
            updateOpen: recoveredDiagnostic.tags.updateOpen,
            updateClose: recoveredDiagnostic.tags.updateClose,
            jsonOpen: recoveredDiagnostic.tags.jsonOpen,
            jsonClose: recoveredDiagnostic.tags.jsonClose,
        },
        { updateOpen: true, updateClose: false, jsonOpen: true, jsonClose: false },
        'diagnostics must preserve redacted tag completeness without storing model output',
    );
    await missingCloseDiagnosticPage.waitForFunction(() => (
        window.__TEST__.context.chatMetadata?.mvu_auto_doctor?.modelDiagnostics?.some(
            (entry) => entry.status === 'recovered' && entry.rootType === 'object',
        )
    ));
    const persistedDiagnostic = await missingCloseDiagnosticPage.evaluate(() => (
        window.__TEST__.context.chatMetadata.mvu_auto_doctor.modelDiagnostics.find(
            (entry) => entry.status === 'recovered' && entry.rootType === 'object',
        )
    ));
    assert.equal(persistedDiagnostic.output, undefined, 'raw model output must never enter diagnostics');
    assert.equal(persistedDiagnostic.prompt, undefined, 'raw prompt must never enter diagnostics');
    assert.equal(persistedDiagnostic.apiKey, undefined, 'API credentials must never enter diagnostics');
    await missingCloseDiagnosticPage.close();

    const redundantContainerPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await redundantContainerPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await redundantContainerPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const redundantContainerResult = await redundantContainerPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('redundant-container');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(redundantContainerResult.result.status, 'applied');
    assert.equal(redundantContainerResult.result.recoveredOutput, true);
    assert.match(redundantContainerResult.result.recoveryReason, /冗余空容器/u);
    assert.equal(redundantContainerResult.result.attempts, 1);
    assert.equal(redundantContainerResult.calls, 1, '冗余父对象 insert 必须本地移除，不得触发模型重试');
    assert.equal(redundantContainerResult.data.stat_data.账户.代币, 3);
    await redundantContainerPage.close();

    const objectOpMismatchPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await objectOpMismatchPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await objectOpMismatchPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const objectOpMismatchResult = await objectOpMismatchPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('object-op-mismatch');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(objectOpMismatchResult.result.status, 'applied');
    assert.equal(objectOpMismatchResult.result.recoveredOutput, true);
    assert.match(objectOpMismatchResult.result.recoveryReason, /replace\/insert/u);
    assert.equal(objectOpMismatchResult.result.attempts, 1);
    assert.equal(objectOpMismatchResult.calls, 1, '普通对象字段的 replace/insert 混淆必须本地修正');
    assert.equal(objectOpMismatchResult.data.stat_data.账户.奖励, '已领取');
    await objectOpMismatchPage.close();

    const delayedMvuPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const delayedMvuErrors = [];
    delayedMvuPage.on('pageerror', (error) => delayedMvuErrors.push(String(error?.stack || error)));
    delayedMvuPage.on('console', (message) => {
        if (message.type() === 'error') delayedMvuErrors.push(message.text());
    });
    await delayedMvuPage.goto(`http://127.0.0.1:${port}/?delayedMvu=2500`, { waitUntil: 'networkidle' });
    try {
        await delayedMvuPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    } catch (error) {
        throw new Error(`delayed MVU bootstrap failed: ${delayedMvuErrors.join('\n') || error.message}`);
    }
    const delayedMvuResult = await delayedMvuPage.evaluate(async () => {
        let stale = window.MvuAutoDoctorAPI.getEnvironmentReport();
        for (let index = 0; index < 80; index += 1) {
            stale = window.MvuAutoDoctorAPI.getEnvironmentReport();
            if (stale?.checks?.some((check) => check.label === 'MVU API' && check.kind === 'error')) break;
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        for (let index = 0; index < 160 && !window.Mvu; index += 1) {
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        for (let index = 0; index < 80; index += 1) {
            const report = window.MvuAutoDoctorAPI.getEnvironmentReport();
            if (report?.checks?.some((check) => check.label === 'MVU API' && check.kind === 'ok')) {
                return { stale, refreshed: report };
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return { stale, refreshed: window.MvuAutoDoctorAPI.getEnvironmentReport() };
    });
    assert.ok(
        delayedMvuResult.stale.checks.some((check) => check.label === 'MVU API' && check.kind === 'error'),
        '探针必须先建立一个过期的 MVU 红灯',
    );
    assert.ok(
        delayedMvuResult.refreshed.checks.some((check) => check.label === 'MVU API' && check.kind === 'ok'),
        'TavernHelper 通知 MVU 初始化后必须自动刷新过期环境报告',
    );
    await delayedMvuPage.close();

    const optionalCorrectionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await optionalCorrectionPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await optionalCorrectionPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const optionalCorrectionResult = await optionalCorrectionPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('malformed-correction-valid-variable');
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            data: t.getLatestData(),
            calls: t.calls.model.length - callsBefore,
        };
    });
    assert.equal(optionalCorrectionResult.result.status, 'applied');
    assert.equal(optionalCorrectionResult.result.attempts, 1);
    assert.equal(optionalCorrectionResult.calls, 1);
    assert.equal(optionalCorrectionResult.data.stat_data.账户.代币, 3);
    assert.match(optionalCorrectionResult.result.correctionWarning, /HardContractCorrection/u);
    await optionalCorrectionPage.close();

    const promptAddonPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await promptAddonPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await promptAddonPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await promptAddonPage.evaluate(() => {
        const area = document.querySelector('.mvuad-variable-prompt-addon');
        area.value = 'CUSTOM_MODEL_UNLOCK_LINE';
        document.querySelector('.mvuad-variable-prompt-save').click();
    });
    const promptAddonResult = await promptAddonPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('normal');
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            saved: t.context.extensionSettings.mvu_auto_doctor.variablePromptAddon,
            system: t.calls.repairSystem,
            maxTokensInput: document.querySelector('.mvuad-variable-max-tokens')?.value,
        };
    });
    assert.equal(promptAddonResult.saved, 'CUSTOM_MODEL_UNLOCK_LINE');
    assert.equal(promptAddonResult.maxTokensInput, '8192');
    assert.match(promptAddonResult.system, /CUSTOM_MODEL_UNLOCK_LINE/u);
    assert.match(promptAddonResult.system, /当前角色卡的 MVU\/Zod Schema/u);
    assert.match(promptAddonResult.system, /唯一允许的输出结构/u);
    await promptAddonPage.close();

    const openingLatestFallbackPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openingLatestFallbackPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await openingLatestFallbackPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const openingLatestFallback = await openingLatestFallbackPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMessageScopedMvuUnavailable(true);
        const callsBefore = t.calls.model.length;
        const result = await window.MvuAutoDoctorAPI.runLatest();
        return {
            result,
            calls: t.calls.model.length - callsBefore,
            data: t.getLatestData(),
        };
    });
    assert.equal(openingLatestFallback.result.status, 'applied');
    assert.equal(openingLatestFallback.calls, 1);
    assert.equal(openingLatestFallback.data.stat_data.账户.代币, 3);
    await openingLatestFallbackPage.close();

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

    const rateLimitPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await rateLimitPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await rateLimitPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const rateLimitResult = await rateLimitPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('rate-limit');
        const repair = await window.MvuAutoDoctorAPI.runLatest();
        t.context.chatMetadata.mvu_auto_doctor = {
            version: 5,
            rev: 1,
            chatId: 'chat-a',
            continuity: {
                version: 3,
                chatId: 'chat-a',
                turn: 5,
                lastSource: {
                    chatId: 'chat-a',
                    messageId: 'opening',
                    index: 0,
                    swipeId: 0,
                    hash: 'opening',
                },
                threads: [{
                    id: 'WE-RATE-01',
                    title: '限流期间仍在推进的事件',
                    kind: 'parallel',
                    eventType: 'progress',
                    level: 2,
                    origin: 'setting_independent',
                    relation: 'independent',
                    stage: 'advancing',
                    stageProgress: 2,
                    evolveResult: '',
                    summary: 'NPC正在独立完成一项事务。',
                    nextBeat: '事务按自身条件继续。',
                    trigger: 'NPC自身日程。',
                    seedBasis: '世界书测试设定',
                    knowledge: 'hidden',
                    createdTurn: 2,
                    lastAdvancedTurn: 4,
                }],
            },
        };
        const world = await window.MvuAutoDoctorAPI.runContinuity();
        const forum = await window.MvuAutoDoctorAPI.runForum();
        return {
            repair,
            world,
            forum,
            calls: structuredClone(t.calls),
            state: window.MvuAutoDoctorAPI.getContinuityState(),
            status: document.querySelector('.mvuad-continuity-status')?.textContent || '',
        };
    });
    assert.equal(rateLimitResult.repair.status, 'failed');
    assert.equal(
        rateLimitResult.calls.model.filter((kind) => kind === 'repair').length,
        1,
        '429 不得立即重试变量模型',
    );
    assert.equal(rateLimitResult.calls.raw, 0, '故事神谕429后不得立刻用同一公益站配置回退再撞一次');
    assert.equal(
        rateLimitResult.calls.model.filter((kind) => kind === 'forum').length,
        1,
        '论坛遇到429不得立刻重试',
    );
    assert.equal(rateLimitResult.forum.status, 'stalled');
    assert.equal(rateLimitResult.world.status, 'applied');
    assert.equal(rateLimitResult.world.degraded, true);
    assert.ok(rateLimitResult.state.turn > 5, '模型限流时本地世界时钟仍须落账');
    assert.match(rateLimitResult.status, /本地时钟已推进/u);
    await rateLimitPage.close();

    const transportPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await transportPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await transportPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const transportResult = await transportPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('transport-error');
        const before = t.calls.model.filter((kind) => kind === 'continuity').length;
        const result = await window.MvuAutoDoctorAPI.runContinuity();
        const after = t.calls.model.filter((kind) => kind === 'continuity').length;
        return { result, calls: after - before };
    });
    assert.equal(transportResult.calls, 1, '连接/鉴权/服务错误不得立即重试活世界模型');
    assert.equal(transportResult.result.status, 'stalled');
    await transportPage.close();

    const futureTurnPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await futureTurnPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await futureTurnPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const futureTurnResult = await futureTurnPage.evaluate(async () => {
        const t = window.__TEST__;
        await window.MvuAutoDoctorAPI.clearContinuityState();
        t.setMode('future-continuity-turn');
        const result = await window.MvuAutoDoctorAPI.runContinuity();
        return {
            result,
            state: window.MvuAutoDoctorAPI.getContinuityState(),
        };
    });
    assert.equal(futureTurnResult.result.status, 'applied');
    assert.equal(futureTurnResult.state.turn, 1, 'model-provided future turn must be clamped to local chat time');
    assert.equal(futureTurnResult.state.lastTick.turn, 1);
    assert.equal(futureTurnResult.state.threads[0].createdTurn, 1);
    assert.equal(futureTurnResult.state.threads[0].lastAdvancedTurn, 1);
    await futureTurnPage.close();

    const scenarioPlanPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await scenarioPlanPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await scenarioPlanPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const scenarioPlanResult = await scenarioPlanPage.evaluate(async () => {
        const t = window.__TEST__;
        const originalRun = window.StoryOracleAPI.run;
        let scenarioRuns = 0;
        window.StoryOracleAPI.run = async (messages, options) => {
            const system = messages[0].content;
            if (!system.includes('活世界事件')) return originalRun(messages, options);
            scenarioRuns += 1;
            t.calls.model.push('continuity');
            t.calls.continuityRuns += 1;
            t.calls.continuitySystem = system;
            t.calls.continuityUser = messages[1].content;
            if (scenarioRuns === 1) {
                return '<ContinuityState>' + JSON.stringify({
                    turn: 1,
                    threads: [{
                        id: 'WE-界外猎手-01',
                        title: '界外猎手追踪核心信号',
                        kind: 'enemy',
                        eventType: 'progress',
                        level: 3,
                        origin: 'setting_linked',
                        relation: 'latent',
                        stage: 'advancing',
                        stageProgress: 4,
                        summary: '界外猎手已经定位迷宫所在区域。',
                        offscreenBeat: '追踪信号逐步收敛。',
                        nextBeat: '信号足够强时猎手可能抵达。',
                        trigger: '迷宫核心释放可追踪能量。',
                        intersection: '只有信号覆盖当前出口时才可能汇流。',
                        seedBasis: '世界书：界外猎手持续追踪异常核心能量',
                        knowledge: 'hidden',
                    }],
                    scenarioPlan: {
                        status: 'active',
                        instanceId: 'SCN-MINOS-01',
                        title: '米诺斯回廊',
                        baselineEvidence: [
                            'MVU主任务要求摧毁迷宫核心并撤离',
                            '正文确认米诺斯是原生终局守卫',
                        ],
                        baseline: {
                            goal: '摧毁迷宫核心并从出口撤离',
                            completion: '迷宫核心失效且队伍抵达出口',
                            failure: '队伍全灭',
                            activeApex: '米诺斯',
                            route: '中庭或排污管道',
                            timeLimit: '',
                            stakes: '队伍生存与迷宫核心',
                            phase: 'exploration',
                            closure: 'open',
                            closureReason: '',
                        },
                        amendments: [],
                    },
                }) + '</ContinuityState>';
            }
            return '<ContinuityState>' + JSON.stringify({
                turn: 2,
                threads: [],
                scenarioPlan: {
                    amendments: [{
                        id: 'AMEND-界外猎手-01',
                        causeType: 'world_chain',
                        impact: 'structural',
                        sourceThreadIds: ['WE-界外猎手-01'],
                        trigger: '核心爆炸放大了已被持续追踪的信号',
                        mechanism: '推进多轮的界外猎手沿已锁定信号抵达出口，接管撤离阶段终局冲突',
                        evidence: ['WE-界外猎手-01已有进展', '核心爆炸是正文事实'],
                        changes: [{
                            field: 'activeApex',
                            before: '米诺斯',
                            after: '界外猎手（外部因果介入）',
                        }, {
                            field: 'phase',
                            before: 'exploration',
                            after: 'climax',
                        }],
                        preserves: ['米诺斯已被击败且胜利有效', '迷宫核心无需重复摧毁'],
                        visibility: 'observed',
                        reversible: false,
                    }],
                },
            }) + '</ContinuityState>';
        };
        await window.MvuAutoDoctorAPI.clearContinuityState();
        const initialized = await window.MvuAutoDoctorAPI.runContinuity();
        const amended = await window.MvuAutoDoctorAPI.runContinuity();
        const state = window.MvuAutoDoctorAPI.getContinuityState();
        const injection = Object.values(t.calls.extensionPrompts)
            .map((item) => item.content)
            .find((content) => content.includes('Parallel_Continuity_Bridge')) || '';
        return {
            initialized,
            amended,
            state,
            injection,
            continuitySystem: t.calls.continuitySystem,
            continuityUser: t.calls.continuityUser,
        };
    });
    assert.equal(scenarioPlanResult.initialized.status, 'applied');
    assert.equal(scenarioPlanResult.amended.status, 'applied');
    assert.equal(scenarioPlanResult.state.version, 5);
    assert.equal(scenarioPlanResult.state.scenarioPlan.revision, 1);
    assert.equal(
        scenarioPlanResult.state.scenarioPlan.current.activeApex,
        '界外猎手（外部因果介入）',
    );
    assert.equal(
        scenarioPlanResult.state.scenarioPlan.baseline.activeApex,
        '米诺斯',
        '修订不得覆盖初始副本基线',
    );
    assert.equal(
        scenarioPlanResult.state.scenarioPlan.amendments[0].sourceRef.index,
        2,
        '规划修订必须记录可返回正文楼层的来源指针',
    );
    assert.equal(
        scenarioPlanResult.state.scenarioPlan.baselineSourceRef.index,
        2,
        '规划基线必须记录建立时对应的正文楼层',
    );
    assert.match(scenarioPlanResult.continuitySystem, /软结构，不是固定剧本/u);
    assert.match(scenarioPlanResult.continuitySystem, /临时编出的气氛、拦路怪/u);
    assert.match(scenarioPlanResult.continuityUser, /"scenarioPlan"/u);
    assert.match(scenarioPlanResult.injection, /当前副本\/场景规划/u);
    assert.match(scenarioPlanResult.injection, /米诺斯已被击败且胜利有效/u);
    assert.match(scenarioPlanResult.injection, /禁止为了延长副本临时追加更强怪物/u);
    await scenarioPlanPage.click('#mvuad-floating-orb');
    await scenarioPlanPage.click('#mvuad-floating-panel .mvuad-floating-tabs button[data-page="threads"]');
    const scenarioPlanUi = await scenarioPlanPage.evaluate(() => {
        const card = document.querySelector('#mvuad-floating-panel .mvuad-scenario-card');
        const summary = card?.querySelector(':scope > summary');
        return {
            exists: !!card,
            summaryHeight: summary?.getBoundingClientRect().height || 0,
            text: card?.textContent || '',
            amendments: card?.querySelectorAll('.mvuad-scenario-amendment').length || 0,
        };
    });
    assert.equal(scenarioPlanUi.exists, true);
    assert.ok(
        scenarioPlanUi.summaryHeight >= 42,
        `scenario plan summary must expose a 42px mobile touch target (${scenarioPlanUi.summaryHeight}px)`,
    );
    assert.equal(scenarioPlanUi.amendments, 1);
    assert.match(scenarioPlanUi.text, /初始基线（不可覆盖）/u);
    assert.match(scenarioPlanUi.text, /米诺斯已被击败且胜利有效/u);
    await scenarioPlanPage.close();

    const invalidContinuityPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await invalidContinuityPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await invalidContinuityPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    const invalidContinuity = await invalidContinuityPage.evaluate(async () => {
        const t = window.__TEST__;
        t.setMode('invalid-continuity');
        t.context.chatMetadata.mvu_auto_doctor = {
            version: 5,
            rev: 1,
            chatId: 'chat-a',
            continuity: {
                version: 3,
                chatId: 'chat-a',
                turn: 1,
                lastSource: {
                    chatId: 'chat-a',
                    messageId: 'opening',
                    index: 0,
                    swipeId: 0,
                    hash: 'opening',
                },
                threads: [{
                    id: 'WE-INVALID-01',
                    title: '本地时钟测试',
                    kind: 'parallel',
                    eventType: 'progress',
                    level: 2,
                    origin: 'setting_independent',
                    relation: 'independent',
                    stage: 'advancing',
                    stageProgress: 2,
                    evolveResult: '',
                    summary: '一项幕后事务正在推进。',
                    nextBeat: '事务按日程继续。',
                    trigger: '自身日程。',
                    seedBasis: '世界书测试设定',
                    knowledge: 'hidden',
                    createdTurn: 1,
                    lastAdvancedTurn: 1,
                }],
            },
        };
        const result = await window.MvuAutoDoctorAPI.runContinuity();
        return {
            result,
            status: document.querySelector('.mvuad-continuity-status')?.textContent || '',
            stats: window.MvuAutoDoctorAPI.getModelCallStats(),
            diagnostics: window.MvuAutoDoctorAPI.getModelDiagnostics(),
        };
    });
    assert.equal(invalidContinuity.result.status, 'applied');
    assert.equal(invalidContinuity.result.degraded, true);
    assert.match(invalidContinuity.status, /模型返回未通过账本校验/u);
    assert.doesNotMatch(invalidContinuity.status, /模型暂不可用/u);
    assert.equal(invalidContinuity.stats.failed, 0, '格式失败不得误报成连接失败');
    const invalidContinuityDiagnostic = invalidContinuity.diagnostics.find(
        (entry) => entry.failureKind === 'invalid-continuity',
    );
    assert.ok(invalidContinuityDiagnostic, 'parse failures must remain visible outside connection counters');
    assert.equal(invalidContinuityDiagnostic.rootType, 'object');
    assert.equal(invalidContinuityDiagnostic.tags.continuityOpen, true);
    assert.equal(invalidContinuityDiagnostic.tags.continuityClose, false);
    await invalidContinuityPage.close();

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
            if (localContinuityRuns <= 2) {
                return '<ContinuityState>{"turn":1,"threads":[]}</ContinuityState>';
            }
            return '<ContinuityState>{"turn":1,"threads":[{"id":"WE-重试-街巷-01","title":"街巷水管检修","origin":"ambient","relation":"independent","stage":"seeded","summary":"维修队封闭了一段旧街。","nextBeat":"商户会协商临时进货路线。","trigger":"市政检修按日程推进。","intersection":"玩家进入旧街时才可能观察到。","seedBasis":"世界书：港城街区与市政维护","knowledge":"hidden"}]}</ContinuityState>';
        };
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await retryPage.waitForFunction(() => (
        window.__TEST__.calls.continuityRuns === 1
    ), null, { timeout: 30000 });
    await retryPage.waitForTimeout(500);
    const retryResult = await retryPage.evaluate(() => ({
        calls: structuredClone(window.__TEST__.calls),
        state: window.MvuAutoDoctorAPI.getContinuityState(),
        status: document.querySelector('.mvuad-continuity-status')?.textContent || '',
    }));
    assert.equal(retryResult.calls.continuityRuns, 1, '自动活世界遇到坏账本不得重复调用模型');
    assert.equal(retryResult.state.threads.length, 0);
    assert.match(retryResult.status, /未通过账本校验|未产生可用账本|未产生有效世界节拍/u);
    await retryPage.evaluate(() => window.MvuAutoDoctorAPI.runContinuity());
    const manualRetryResult = await retryPage.evaluate(() => ({
        calls: structuredClone(window.__TEST__.calls),
        state: window.MvuAutoDoctorAPI.getContinuityState(),
    }));
    assert.equal(manualRetryResult.calls.continuityRuns, 3, '手动整理可在首次坏账本后定向重试一次');
    assert.equal(manualRetryResult.state.threads[0].id, 'WE-重试-街巷-01');
    await retryPage.close();

    const actorIntegrationPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await actorIntegrationPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await actorIntegrationPage.waitForFunction(() => !!window.MvuAutoDoctorAPI);
    await actorIntegrationPage.evaluate(async () => {
        const t = window.__TEST__;
        const mode = document.querySelector('.mvuad-actor-shard-mode');
        mode.value = 'on';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
        const workers = document.querySelector('.mvuad-actor-shard-workers');
        workers.value = '2';
        workers.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.mvuad-continuity-prompt-addon').value =
            'PHASE9-CONTINUITY-CANARY：保留倒叙节奏。';
        document.querySelector('.mvuad-actor-shard-prompt-addon').value =
            'PHASE9-ACTOR-CANARY：候选行动使用短句。';
        document.querySelector('.mvuad-actor-prompt-save').click();
        t.context.chatMetadata.mvu_auto_doctor ||= {};
        t.context.chatMetadata.mvu_auto_doctor.continuity = {
            turn: 4,
            chatId: t.context.chatId,
            threads: [
                {
                    id: 'AS-ADA',
                    title: '艾达的北港调查',
                    kind: 'parallel',
                    eventType: 'progress',
                    level: 2,
                    origin: 'setting_independent',
                    relation: 'independent',
                    stage: 'advancing',
                    stageProgress: 3,
                    summary: '艾达正在北港核对公开货单。',
                    nextBeat: '艾达会询问夜班记录员。',
                    trigger: '午夜换班。',
                    seedBasis: '世界书：北港货运制度',
                    causedBy: ['CHAIN-HARBOR'],
                    actors: ['艾达'],
                    locations: ['北港'],
                    sourceRefs: [{ messageId: 'seed-ada', hash: 'hash-ada' }],
                    knowledge: 'observed',
                    urgency: 3,
                },
                {
                    id: 'AS-BELLA',
                    title: '贝拉的北港调查',
                    kind: 'parallel',
                    eventType: 'progress',
                    level: 2,
                    origin: 'setting_independent',
                    relation: 'independent',
                    stage: 'advancing',
                    stageProgress: 2,
                    summary: '贝拉只知道北港公开的车次变更。',
                    nextBeat: '贝拉会对照到港名单。',
                    trigger: '午夜换班。',
                    seedBasis: '世界书：北港货运制度',
                    causedBy: ['CHAIN-HARBOR'],
                    actors: ['贝拉'],
                    locations: ['北港'],
                    sourceRefs: [{ messageId: 'seed-bella', hash: 'hash-bella' }],
                    knowledge: 'observed',
                    urgency: 2,
                },
            ],
            world: {},
        };
        await t.context.eventSource.emit('generation_started', 'normal', {}, false);
        await t.context.eventSource.emit('message_received', 2);
    });
    await actorIntegrationPage.waitForFunction(() => (
        window.__TEST__.calls.actorRuns === 2
        && window.__TEST__.calls.continuityRuns === 1
    ), null, { timeout: 30000 });
    const actorIntegration = await actorIntegrationPage.evaluate(() => ({
        calls: structuredClone(window.__TEST__.calls),
        settings: structuredClone(
            window.__TEST__.context.extensionSettings.mvu_auto_doctor,
        ),
        diagnostic: window.MvuAutoDoctorAPI.getDiagnosticProjection(),
        controls: {
            mode: document.querySelector('.mvuad-actor-shard-mode').value,
            workers: document.querySelector('.mvuad-actor-shard-workers').value,
            continuityPrompt: document.querySelector('.mvuad-continuity-prompt-addon').value,
            actorPrompt: document.querySelector('.mvuad-actor-shard-prompt-addon').value,
            hint: document.querySelector('.mvuad-actor-prompt-save-hint').textContent,
        },
    }));
    assert.equal(actorIntegration.calls.actorRuns, 2);
    assert.equal(actorIntegration.calls.actorPeak, 2, '隔离并行lane应允许两个worker并发');
    assert.deepEqual(actorIntegration.calls.actorBarrierStates, ['settled', 'settled']);
    assert.match(actorIntegration.calls.actorSystem, /PHASE9-ACTOR-CANARY/u);
    assert.doesNotMatch(actorIntegration.calls.actorUser, /PHASE9-ACTOR-CANARY/u);
    assert.match(actorIntegration.calls.continuitySystem, /PHASE9-CONTINUITY-CANARY/u);
    assert.match(actorIntegration.calls.continuityUser, /NPC分片候选（只产提案/u);
    assert.match(actorIntegration.calls.continuityUser, /沿已知传播链继续调查/u);
    assert.equal(actorIntegration.settings.actorShardMode, 'on');
    assert.equal(actorIntegration.settings.actorShardMaxWorkers, 2);
    assert.deepEqual(actorIntegration.controls, {
        mode: 'on',
        workers: '2',
        continuityPrompt: 'PHASE9-CONTINUITY-CANARY：保留倒叙节奏。',
        actorPrompt: 'PHASE9-ACTOR-CANARY：候选行动使用短句。',
        hint: '已保存；诊断仅记录长度、哈希与启用状态',
    });
    assert.equal(actorIntegration.diagnostic.actorShards.status, 'completed');
    assert.equal(actorIntegration.diagnostic.actorShards.selected, 2);
    assert.equal(actorIntegration.diagnostic.actorShards.succeeded, 2);
    assert.deepEqual(
        Object.keys(actorIntegration.diagnostic.userPrompts.actorShard),
        ['enabled', 'length', 'hash'],
    );
    assert.equal(
        JSON.stringify(actorIntegration.diagnostic).includes('PHASE9-ACTOR-CANARY'),
        false,
    );
    const actorReset = await actorIntegrationPage.evaluate(() => {
        document.querySelector('.mvuad-actor-prompt-reset').click();
        const diagnostic = window.MvuAutoDoctorAPI.getDiagnosticProjection();
        return {
            continuity: window.__TEST__.context.extensionSettings
                .mvu_auto_doctor.continuityPromptAddon,
            actor: window.__TEST__.context.extensionSettings
                .mvu_auto_doctor.actorShardPromptAddon,
            diagnostic: diagnostic.userPrompts,
        };
    });
    assert.equal(actorReset.continuity, '');
    assert.equal(actorReset.actor, '');
    assert.equal(actorReset.diagnostic.continuity.enabled, false);
    assert.equal(actorReset.diagnostic.actorShard.enabled, false);
    await actorIntegrationPage.close();
} finally {
    await browser.close();
    server.close();
}

console.log('browser runtime race and continuity tests passed');
