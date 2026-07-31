import assert from 'node:assert/strict';
import {
    appendRepairJournal,
    advanceContinuityClocks,
    applyWorldUpdate,
    attachChangedSourceRefs,
    buildContinuityInjection,
    continuityLifecycleStats,
    continuityLedgerView,
    continuityScenarioDigest,
    continuityWorldDigest,
    emptyScenarioPlan,
    enforceContinuityPolicy,
    enforceScenarioPlanPolicy,
    extractContinuityMarkers,
    latestUndoRecord,
    markRepairUndone,
    mergeMarkerRecords,
    normalizeContinuityState,
    parseContinuityOutput,
    scheduleWorldLanes,
} from '../continuity-core.mjs';

const marker = `
<parallel_event_record>
[事件ID|PE-港口-哨兵-01]
[状态|推进中]
[时间地点|第三日夜间，港口]
[触发条件|下一次进入港区]
[新增变化|离场哨兵把异常货单交给了巡逻队]
</parallel_event_record>
<dm_story>
[支线]
- 异常货单 → 活跃(2轮) | 谁在意=哨兵(职责)
</dm_story>`;

const markers = extractContinuityMarkers(marker);
assert.equal(markers.hasPresetParallel, true);
assert.equal(markers.hasStitches, true);
assert.equal(markers.records.length, 1);
assert.equal(markers.records[0].id, 'PE-港口-哨兵-01');
assert.equal(markers.records[0].stage, 'advancing');
assert.equal(markers.records[0].origin, 'main_derivative');
assert.equal(markers.records[0].relation, 'linked');

let state = mergeMarkerRecords(null, markers.records, {
    chatId: 'chat-a',
    maxThreads: 4,
});
assert.equal(state.threads.length, 1);
assert.equal(state.threads[0].knowledge, 'hidden');
assert.equal(state.threads[0].origin, 'main_derivative');
assert.equal(state.threads[0].relation, 'linked');

const preservedMarkerState = mergeMarkerRecords({
    chatId: 'chat-a',
    turn: 8,
    threads: [{
        id: 'PE-港口-哨兵-01',
        title: '异常货单的后续追查',
        stage: 'resolved',
        summary: '巡逻队已经完成核对。',
        resolution: '异常货单被归档为证物。',
        causedBy: ['ACTION-烧毁货单'],
        effects: ['港区门禁改为双人核验'],
        rumors: ['商队传言巡逻队正在倒查旧账'],
        actors: ['哨兵', '巡逻队'],
        locations: ['港口'],
        knowledge: 'observed',
        urgency: 3,
        createdTurn: 2,
        lastAdvancedTurn: 7,
        resolvedTurn: 7,
    }],
}, extractContinuityMarkers(`
<parallel_event_record>
[事件ID|PE-港口-哨兵-01]
[状态|推进中]
[新增变化|巡逻队继续整理已经归档的货单]
</parallel_event_record>`).records, { chatId: 'chat-a', maxThreads: 4 });
const preservedMarker = preservedMarkerState.threads[0];
assert.equal(preservedMarker.stage, 'resolved', '重复标记不得把已结束事件降级');
assert.equal(preservedMarker.title, '异常货单的后续追查');
assert.deepEqual(preservedMarker.causedBy, ['ACTION-烧毁货单']);
assert.deepEqual(preservedMarker.effects, ['港区门禁改为双人核验']);
assert.deepEqual(preservedMarker.rumors, ['商队传言巡逻队正在倒查旧账']);
assert.equal(preservedMarker.resolution, '异常货单被归档为证物。');
assert.equal(preservedMarker.knowledge, 'observed');
assert.equal(preservedMarker.urgency, 3);
assert.equal(preservedMarker.createdTurn, 2);
assert.equal(preservedMarker.resolvedTurn, 7);

const parsed = parseContinuityOutput(`
<ContinuityState>
{
  "turn": 3,
  "threads": [{
    "id": "PE-港口-哨兵-01",
    "title": "异常货单",
    "kind": "parallel",
    "stage": "manifested",
    "summary": "巡逻队开始核对港区货单",
    "nextBeat": "门禁盘问出现可观察变化",
    "trigger": "玩家再次进入港区",
    "actors": ["哨兵", "巡逻队"],
    "locations": ["港口"],
    "knowledge": "rumor",
    "urgency": 2,
    "lastAdvancedTurn": 3
  }]
}
</ContinuityState>`, { chatId: 'chat-a', maxThreads: 4 });
assert.equal(parsed.error, undefined);
state = attachChangedSourceRefs(state, parsed.state, {
    chatId: 'chat-a',
    messageId: 'message-9',
    index: 9,
    swipeId: 1,
    hash: 'abc123',
});
assert.equal(state.threads[0].sourceRefs.length, 1);
assert.equal(state.threads[0].sourceRefs[0].swipeId, 1);

const ledger = continuityLedgerView({
    turn: 4,
    updatedAt: 123456,
    threads: [
        {
            id: 'PE-已完成-01',
            title: '旧约兑现',
            kind: 'promise',
            stage: 'resolved',
            summary: '约定已经完成',
            knowledge: 'observed',
            urgency: 0,
            lastAdvancedTurn: 2,
        },
        state.threads[0],
    ],
}, { chatId: 'chat-a' });
assert.equal(ledger.activeCount, 1);
assert.equal(ledger.resolvedCount, 1);
assert.equal(ledger.active[0].stageLabel, '逼近');
assert.equal(ledger.active[0].kindLabel, '平行事件');
assert.equal(ledger.active[0].knowledgeLabel, '传闻阶段（部分可知）');
assert.equal(ledger.active[0].latestSource.index, 9);
assert.equal(ledger.active[0].originLabel, '主线衍生');
assert.equal(ledger.active[0].relationLabel, '已接入主线');
assert.equal(ledger.active[0].isSpoiler, false);
assert.equal(ledger.resolved[0].kindLabel, '约定/承诺');

const injection = buildContinuityInjection(state, {
    director: 'mixed',
    maxVisible: 2,
});
assert.match(injection, /预设、缝合怪或世界引擎负责剧情与世界提案/u);
assert.match(injection, /可自然采用0—2条接口/u);
assert.match(injection, /多个触发条件在同一时点分别成熟/u);
assert.match(injection, /禁止替玩家角色决定/u);
assert.match(injection, /PE-港口-哨兵-01/u);
assert.match(injection, /禁止为了展示伏笔而强行写入正文/u);

const burstState = normalizeContinuityState({
    ...state,
    threads: [
        {
            ...state.threads[0],
            id: 'BURST-01',
            title: '城门同时封锁',
            urgency: 4,
        },
        {
            ...state.threads[0],
            id: 'BURST-02',
            title: '码头同时起火',
            urgency: 3,
        },
        {
            ...state.threads[0],
            id: 'BURST-03',
            title: '远郊同时降雨',
            urgency: 1,
        },
    ],
}, { chatId: 'chat-a', maxThreads: 4 });
const boundedBurstInjection = buildContinuityInjection(burstState, {
    maxVisible: 2,
});
assert.match(boundedBurstInjection, /城门同时封锁/u);
assert.match(boundedBurstInjection, /码头同时起火/u);
assert.doesNotMatch(
    boundedBurstInjection,
    /远郊同时降雨/u,
    '注入上限为2时不得暗中列出第3个剧情接口',
);

const livingBase = normalizeContinuityState({
    chatId: 'living-chat',
    turn: 6,
    threads: [{
        id: 'WE-旧城-药房-01',
        title: '旧城药房的断供',
        origin: 'setting_independent',
        relation: 'independent',
        stage: 'advancing',
        summary: '药房正在寻找替代供货人。',
        nextBeat: '店主会向邻城商队发出询价。',
        offscreenBeat: '账房发现库存只能支撑三天。',
        intersection: '只有玩家前往旧城、接触医疗物资或商队时才可能汇流。',
        seedBasis: '世界书：旧城商贸与药房网络',
        knowledge: 'hidden',
        createdTurn: 3,
        lastAdvancedTurn: 5,
    }],
}, { maxThreads: 8 });
const hiddenBackstageInjection = buildContinuityInjection(livingBase);
assert.equal(
    hiddenBackstageInjection,
    '',
    '没有公共影响或成熟汇流证据的后台支线不得进入主回复提示词',
);
const hiddenTickState = structuredClone(livingBase);
hiddenTickState.lastTick = {
    turn: 6,
    action: 'advanced',
    threadId: 'WE-旧城-药房-01',
    reason: '秘密依据：药房地下室只剩一箱禁药，店主准备深夜灭口',
};
const hiddenTickInjection = buildContinuityInjection(hiddenTickState);
assert.equal(
    hiddenTickInjection,
    '',
    '后台调度理由也不得让独立隐藏支线绕过主线接口',
);
const rumoredLivingBase = structuredClone(livingBase);
rumoredLivingBase.threads[0].knowledge = 'rumor';
assert.equal(
    buildContinuityInjection(rumoredLivingBase),
    '',
    '线程自称rumor但没有可追溯世界传播节点时仍不得注入',
);

const livingProposal = normalizeContinuityState({
    chatId: 'living-chat',
    turn: 7,
    threads: [
        livingBase.threads[0],
        {
            id: 'WE-钟楼-巡检-01',
            title: '钟楼巡检换班',
            origin: 'ambient',
            relation: 'independent',
            stage: 'seeded',
            summary: '新巡检员接手了夜间钟楼。',
            nextBeat: '他会先核对三个月的报时记录。',
            offscreenBeat: '交接册缺少一页。',
            intersection: '仅在时间记录、钟楼附近或城防调查相关时可能汇流。',
            seedBasis: '世界书：港城钟楼巡检制度',
            knowledge: 'hidden',
        },
        {
            id: 'WE-渔市-纠纷-01',
            title: '渔市摊位纠纷',
            origin: 'setting_independent',
            relation: 'independent',
            stage: 'seeded',
            summary: '两个摊主在争夺新空出的摊位。',
            seedBasis: '世界书：渔市行会',
            knowledge: 'hidden',
        },
    ],
}, { maxThreads: 8 });

const livingAccepted = enforceContinuityPolicy(livingBase, livingProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.equal(livingAccepted.threads.length, 2, '每回合最多新建一个幕后事件');
const independentThread = livingAccepted.threads.find((thread) => thread.id === 'WE-钟楼-巡检-01');
assert.ok(independentThread);
assert.equal(independentThread.origin, 'ambient');
assert.equal(independentThread.relation, 'independent');
assert.equal(independentThread.createdTurn, 7);
assert.equal(continuityLedgerView(livingAccepted).active.find(
    (thread) => thread.id === independentThread.id,
).isSpoiler, true);

const conservativeRejected = enforceContinuityPolicy(livingBase, livingProposal, {
    autonomy: 'conservative',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.equal(conservativeRejected.threads.length, 1, '保守模式不得凭空新建幕后事件');

const prematureLink = structuredClone(livingBase);
prematureLink.threads[0].relation = 'linked';
prematureLink.threads[0].knowledge = 'observed';
prematureLink.threads[0].summary = '事件突然撞入主线。';
const convergenceGuard = enforceContinuityPolicy(livingBase, prematureLink, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.equal(
    convergenceGuard.threads[0].relation,
    'independent',
    '独立事件没有评分、证据和可观察入口时不得仅凭模型声明接入主线',
);
assert.equal(convergenceGuard.threads[0].knowledge, 'hidden');

const forgedPropagationProposal = structuredClone(livingBase);
forgedPropagationProposal.threads[0].relation = 'converging';
forgedPropagationProposal.threads[0].convergence = {
    score: 3,
    channels: ['public_signal'],
    evidence: ['模型声称有一条公共消息'],
    entryBeat: '市场出现涨价。',
    lastCheckedTurn: 7,
};
forgedPropagationProposal.world.winds = [{
    id: 'WIND-FORGED',
    topic: '无法追溯的消息',
    type: 'rumor',
    content: '来源事件并不存在',
    source: '未知来源',
    sourceThreads: ['NOT-A-REAL-THREAD'],
    knowledge: 'rumor',
    basis: '模型声称存在',
}];
const forgedPropagation = enforceContinuityPolicy(
    livingBase,
    forgedPropagationProposal,
    {
        autonomy: 'living',
        allowAutonomous: true,
        maxThreads: 8,
    },
);
assert.equal(forgedPropagation.threads[0].relation, 'independent');
assert.deepEqual(forgedPropagation.world.winds[0].sourceThreads, []);
assert.deepEqual(
    forgedPropagation.threads[0].convergence.channels,
    [],
    '没有真实世界表面的公共信号通道必须被本地剔除',
);
assert.equal(forgedPropagation.threads[0].convergence.score, 1);

const mainDerivativeBase = normalizeContinuityState({
    chatId: 'main-derivative-chat',
    turn: 4,
    threads: [],
}, { maxThreads: 8 });
const mainDerivativeProposal = normalizeContinuityState({
    chatId: 'main-derivative-chat',
    turn: 5,
    threads: [{
        id: 'EVT-STREET-01',
        title: '街角的异常观察',
        origin: 'main_derivative',
        relation: 'converging',
        stage: 'advancing',
        summary: '可疑人物正在观察当前街角。',
        seedBasis: '正文已观察到该人物的戒备姿态。',
        convergence: {
            score: 3,
            channels: ['actor', 'public_signal'],
            evidence: ['当前正文直接观察到同一人物'],
            entryBeat: '该人物继续用余光留意玩家。',
            lastCheckedTurn: 5,
        },
        knowledge: 'observed',
    }],
}, { maxThreads: 8 });
const sanitizedMainDerivative = enforceContinuityPolicy(
    mainDerivativeBase,
    mainDerivativeProposal,
    {
        autonomy: 'living',
        allowAutonomous: true,
        maxThreads: 8,
    },
);
assert.equal(sanitizedMainDerivative.threads[0].relation, 'converging');
assert.deepEqual(
    sanitizedMainDerivative.threads[0].convergence.channels,
    ['actor'],
    '主线衍生事件可凭真实人物交联汇流，但不得虚报尚未形成的公共信号',
);
assert.deepEqual(sanitizedMainDerivative.threads[0].propagation, []);

const matureConvergenceProposal = structuredClone(livingBase);
matureConvergenceProposal.threads[0].relation = 'converging';
matureConvergenceProposal.threads[0].convergence = {
    score: 3,
    channels: ['resource', 'public_signal'],
    evidence: [
        '当前MVU任务需要医疗物资',
        'WIND-01已经覆盖玩家所在商队圈',
    ],
    entryBeat: '玩家询价时发现常用药材报价上涨，商人提到旧城供货延迟。',
    lastCheckedTurn: 7,
};
matureConvergenceProposal.world.winds = [{
    id: 'WIND-01',
    topic: '旧城药材延迟',
    type: 'report',
    strength: 2,
    content: '旧城常用药材到货普遍延迟',
    source: '药材商→行商圈',
    scope: '当前商队圈',
    sourceThreads: ['WE-旧城-药房-01'],
    knowledge: 'rumor',
    basis: '三家药材商已经调整交货时间',
}];
const matureConvergence = enforceContinuityPolicy(
    livingBase,
    matureConvergenceProposal,
    {
        autonomy: 'living',
        allowAutonomous: true,
        maxThreads: 8,
    },
);
assert.equal(matureConvergence.threads[0].relation, 'converging');
assert.deepEqual(matureConvergence.threads[0].propagation, ['WIND-01']);
const matureInjection = buildContinuityInjection(matureConvergence);
assert.match(matureInjection, /可自然采用0—2条接口/u);
assert.match(matureInjection, /常用药材报价上涨/u);
assert.match(matureInjection, /旧城药材延迟/u);
assert.doesNotMatch(
    matureInjection,
    /旧城药房的断供|库存只能支撑三天|向邻城商队发出询价/u,
    '隐藏支线汇流时只能注入可观察入口与公开表面，不得泄露幕后真相',
);

const hallucinatedRumor = structuredClone(livingBase);
hallucinatedRumor.threads[0].summary = '药房仍在私下寻找货源。';
hallucinatedRumor.threads[0].offscreenBeat = '账房只向店主报告了库存。';
hallucinatedRumor.threads[0].knowledge = 'rumor';
hallucinatedRumor.threads[0].rumors = ['全城都知道了药房的私密库存'];
const rumorGate = enforceContinuityPolicy(livingBase, hallucinatedRumor, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.equal(rumorGate.threads[0].knowledge, 'hidden');
assert.deepEqual(
    rumorGate.threads[0].rumors,
    [],
    '未显现且未汇流的独立事件不得仅凭模型声称升级成公开传闻',
);

const causalBase = normalizeContinuityState({
    chatId: 'causal-chat',
    turn: 4,
    threads: [{
        id: 'WE-行会-议价-01',
        title: '行会内部议价',
        origin: 'setting_linked',
        relation: 'latent',
        stage: 'advancing',
        summary: '两派仍在争论运费。',
        nextBeat: '表决新的临时费率。',
        seedBasis: '世界书：行会制度',
        createdTurn: 1,
        lastAdvancedTurn: 3,
    }],
}, { maxThreads: 8 });
const causalProposal = structuredClone(causalBase);
causalProposal.threads[0].summary = '行会通过了临时费率。';
causalProposal.threads[0].offscreenBeat = '中立派倒向低费率方案。';
causalProposal.threads.push({
    id: 'PE-玩家-截获货单-01',
    title: '被截获货单引发的追查',
    origin: 'main_derivative',
    relation: 'linked',
    stage: 'seeded',
    summary: '玩家本轮截获货单后，仓主派人核查泄密者。',
    seedBasis: '本轮正文：玩家截获并公开了货单',
    causedBy: ['ACTION-本轮截获货单'],
});
const causalAccepted = enforceContinuityPolicy(causalBase, causalProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.equal(causalAccepted.threads.length, 2, '推进旧事件时仍须允许登记本轮主线直接衍生事件');
assert.equal(causalAccepted.threads[0].lastAdvancedTurn, 5);
assert.equal(causalAccepted.threads[1].origin, 'main_derivative');
assert.deepEqual(continuityLifecycleStats(causalBase, causalAccepted), {
    activeBefore: 1,
    changedExisting: 1,
    added: 1,
    newlyResolved: 0,
    removed: 0,
    schedulerAdvanced: true,
    tickAction: 'advanced',
});

const clusteredBase = normalizeContinuityState({
    chatId: 'clustered-world',
    turn: 9,
    threads: Array.from({ length: 5 }, (_, index) => ({
        id: `CLUSTER-${index + 1}`,
        title: `港区关联事件${index + 1}`,
        origin: 'setting_independent',
        relation: 'independent',
        stage: 'advancing',
        summary: `港区状态${index + 1}`,
        actors: ['港务行会'],
        locations: ['港区'],
        seedBasis: '世界书：港区制度',
        urgency: 2,
        createdTurn: index + 1,
        lastAdvancedTurn: index + 1,
    })),
}, { maxThreads: 12 });
const clusteredProposal = structuredClone(clusteredBase);
clusteredProposal.turn = 10;
clusteredProposal.lastTick = {
    turn: 10,
    action: 'advanced',
    threadId: 'CLUSTER-5',
    reason: '港务行会的同一份封港令同时影响多项事务',
};
clusteredProposal.threads.forEach((thread, index) => {
    thread.summary = `封港后的关联变化${index + 1}`;
    thread.offscreenBeat = `关联事件${index + 1}已响应封港令`;
});
const clusteredLiving = enforceContinuityPolicy(clusteredBase, clusteredProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 12,
});
assert.equal(
    continuityLifecycleStats(clusteredBase, clusteredLiving).changedExisting,
    3,
    '活世界模式应允许同一因果簇每轮批量推进最多3条旧事件',
);
assert.equal(
    clusteredLiving.threads.find((thread) => thread.id === 'CLUSTER-5').lastAdvancedTurn,
    10,
    '模型指定的主调度事件必须优先进入批量推进簇',
);
const clusteredExpansive = enforceContinuityPolicy(clusteredBase, clusteredProposal, {
    autonomy: 'expansive',
    allowAutonomous: true,
    maxThreads: 12,
});
assert.equal(
    continuityLifecycleStats(clusteredBase, clusteredExpansive).changedExisting,
    5,
    '扩张模式可在一次调用中接受最多6条相关旧事件变化',
);

const heldBase = structuredClone(causalAccepted);
heldBase.turn = 5;
const heldProposal = structuredClone(heldBase);
heldProposal.lastTick = {
    turn: heldBase.turn + 1,
    action: 'held',
    threadId: 'WE-行会-议价-01',
    reason: '正文只过去数秒，行会下一次表决尚未到约定时刻',
};
const heldAccepted = enforceContinuityPolicy(heldBase, heldProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.equal(heldAccepted.lastTick.action, 'held');
assert.equal(heldAccepted.lastTick.threadId, 'WE-行会-议价-01');
assert.deepEqual(continuityLifecycleStats(heldBase, heldAccepted), {
    activeBefore: 2,
    changedExisting: 0,
    added: 0,
    newlyResolved: 0,
    removed: 0,
    schedulerAdvanced: true,
    tickAction: 'held',
});

const vagueHeldProposal = structuredClone(heldBase);
vagueHeldProposal.lastTick = {
    turn: heldBase.turn + 1,
    action: 'held',
    threadId: 'WE-行会-议价-01',
    reason: '无变化',
};
const vagueHeldAccepted = enforceContinuityPolicy(heldBase, vagueHeldProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
assert.notEqual(vagueHeldAccepted.lastTick.action, 'held', '空泛held不得冒充有效世界调度');

const resolvedProposal = structuredClone(causalAccepted);
resolvedProposal.turn = 5;
resolvedProposal.threads[0].stage = 'resolved';
resolvedProposal.threads[0].summary = '临时费率正式生效。';
resolvedProposal.threads[0].resolution = '行会完成表决并公告新费率。';
resolvedProposal.threads[0].effects = ['旧城药材运输成本下降'];
resolvedProposal.threads[0].rumors = ['商队流传行会高层发生了权力交换'];
resolvedProposal.threads.push({
    id: 'WE-旧城-药价回落-01',
    title: '旧城药价开始回落',
    origin: 'setting_linked',
    relation: 'latent',
    stage: 'seeded',
    summary: '低运费开始传导到旧城药材批发价。',
    seedBasis: '行会临时费率已生效，世界书规定旧城依赖该运输线',
    causedBy: ['WE-行会-议价-01'],
    effects: ['药材批发商准备重列报价'],
});
const resolvedAccepted = enforceContinuityPolicy(causalAccepted, resolvedProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 8,
});
const resolvedParent = resolvedAccepted.threads.find((thread) => thread.id === 'WE-行会-议价-01');
assert.equal(resolvedParent.stage, 'resolved');
assert.equal(resolvedParent.resolvedTurn, 5);
assert.match(resolvedParent.resolution, /完成表决/u);
assert.ok(resolvedAccepted.threads.some((thread) => (
    thread.id === 'WE-旧城-药价回落-01'
    && thread.causedBy.includes('WE-行会-议价-01')
)), '事件结束时必须允许其持续后果派生新事件');
const aftermathInjection = buildContinuityInjection(resolvedAccepted);
assert.doesNotMatch(
    aftermathInjection,
    /行会内部议价|完成表决|旧城药材运输成本下降|权力交换/u,
    '未显现的 latent 已收束事件及其后果不得注入正文',
);
const publicResolved = structuredClone(resolvedAccepted);
const publicResolvedParent = publicResolved.threads.find(
    (thread) => thread.id === 'WE-行会-议价-01',
);
publicResolvedParent.knowledge = 'observed';
publicResolvedParent.relation = 'converging';
publicResolvedParent.convergence = {
    score: 4,
    channels: ['causal', 'public_signal'],
    evidence: ['新费率公告已经进入当前商队的报价单'],
    entryBeat: '当前药材报价单已经采用行会的新费率。',
    lastCheckedTurn: 5,
};
const publicAftermathInjection = buildContinuityInjection(publicResolved);
assert.match(publicAftermathInjection, /持续影响=旧城药材运输成本下降/u);
assert.match(publicAftermathInjection, /仍在传播=商队流传行会高层发生了权力交换/u);
assert.match(
    buildContinuityInjection(resolvedAccepted, { director: 'world' }),
    /世界引擎负责世界推演提案/u,
);
const resolvedLedger = continuityLedgerView(resolvedAccepted);
assert.equal(resolvedLedger.echoCount, 1);
assert.match(resolvedLedger.echoes[0].content, /权力交换/u);

const resolvedArchive = normalizeContinuityState({
    turn: 20,
    threads: [
        ...Array.from({ length: 8 }, (_, index) => ({
            id: `DONE-${index}`,
            title: `已结束事件${index}`,
            stage: 'resolved',
            resolution: '已经结束',
            resolvedTurn: index + 1,
        })),
        { id: 'ACTIVE-NEW', title: '新生世界事件', stage: 'seeded' },
    ],
}, { maxThreads: 1, maxResolved: 8 });
assert.equal(resolvedArchive.threads.filter((thread) => thread.stage !== 'resolved').length, 1);
assert.ok(resolvedArchive.threads.some((thread) => thread.id === 'ACTIVE-NEW'), '已结束事件不得占满活动事件槽位');

const capped = normalizeContinuityState({
    threads: Array.from({ length: 10 }, (_, index) => ({
        id: `PE-${index}`,
        title: `事件${index}`,
    })),
}, { maxThreads: 4 });
assert.equal(capped.threads.length, 10, '超上限未结事件不得从账本消失');
assert.equal(
    capped.threads.filter((thread) => !['resolved', 'dormant'].includes(thread.stage)).length,
    4,
);
assert.equal(capped.threads.filter((thread) => thread.stage === 'dormant').length, 6);
assert.equal(capped.droppedCount, 6);

const markerOverflow = mergeMarkerRecords(null, Array.from({ length: 10 }, (_, index) => ({
    id: `MARKER-${index}`,
    title: `批量预设事件${index}`,
    stage: 'advancing',
    seedBasis: `预设标记${index}`,
})), { chatId: 'marker-overflow', maxThreads: 4 });
assert.equal(markerOverflow.threads.length, 10);
assert.equal(markerOverflow.threads.filter((thread) => thread.stage === 'dormant').length, 6);
assert.equal(markerOverflow.droppedCount, 6);

const wakeProposal = structuredClone(capped);
wakeProposal.turn = 1;
wakeProposal.threads[4].stage = 'advancing';
wakeProposal.threads[4].summary = '容量提高后，休眠事件重新进入调度。';
const awakened = enforceContinuityPolicy(capped, wakeProposal, {
    autonomy: 'living',
    allowAutonomous: true,
    maxThreads: 5,
});
assert.equal(
    awakened.threads.filter((thread) => !['resolved', 'dormant'].includes(thread.stage)).length,
    5,
    '容量恢复后调度器应能唤醒保留的 dormant 事件',
);
assert.equal(awakened.threads.find((thread) => thread.id === 'PE-4').stage, 'advancing');

const clockBase = normalizeContinuityState({
    chatId: 'clock-chat',
    turn: 3,
    threads: [
        {
            id: 'CLOCK-CONFLICT',
            title: '高烈度冲突',
            eventType: 'conflict',
            level: 4,
            stage: 'seeded',
            stageProgress: 1,
        },
        {
            id: 'CLOCK-PROGRESS',
            title: '大型建设',
            eventType: 'progress',
            level: 4,
            stage: 'advancing',
            stageProgress: 4,
        },
    ],
}, { maxThreads: 8 });
const clockRolls = [0.99, 0];
const clockAdvanced = advanceContinuityClocks(clockBase, {
    random: () => clockRolls.shift() ?? 0.5,
    maxThreads: 8,
});
assert.equal(clockAdvanced.state.threads[0].stageProgress, 2);
assert.equal(clockAdvanced.state.threads[0].evolveResult, 'success');
assert.equal(clockAdvanced.state.threads[1].stageProgress, 3);
assert.equal(clockAdvanced.state.threads[1].evolveResult, 'setback');
assert.deepEqual(clockAdvanced.changedThreadIds, ['CLOCK-CONFLICT', 'CLOCK-PROGRESS']);

const worldBase = normalizeContinuityState({
    chatId: 'world-chat',
    turn: 4,
    world: {
        winds: [{
            id: 'WIND-01',
            topic: '旧港口封路',
            type: 'report',
            strength: 2,
            content: '旧港口临时封闭',
            source: '现场公告',
            scope: '旧港口',
            basis: '已公开公告',
            knowledge: 'observed',
            quietTurns: 3,
        }],
    },
}, { maxThreads: 8 });
const worldUpdated = applyWorldUpdate(worldBase.world, {
    digest: '旧港口封路开始影响运输组织的判断。',
    factions: [{
        id: null,
        name: '港区运输联合体',
        relation: 'neutral',
        condition: 'strained',
        goal: '寻找替代路线',
        summary: '封路增加了调度压力',
        scope: '港区',
        knowledge: 'observed',
        basis: '世界书中的运输组织与已公开封路',
        lastChange: '开始分流车辆',
    }],
    winds: [{
        id: 'WIND-01',
        content: '旧港口封闭至少持续一天',
        source: '现场公告→运输司机群体',
        scope: '港区运输圈',
        strength: 2,
        basis: '公告被运输人员转述',
    }],
    reputation: {
        authority: {
            level: 2,
            summary: '管理机构开始正面评价玩家的救援协助',
            basis: '公开表彰已经进入机构圈层',
        },
    },
    environment: {
        economy: 'crisis',
        summary: '港区运输短期趋紧',
        basis: '封路已导致可观察的路线分流',
        incidents: [{
            id: null,
            title: '旧港口封路',
            status: 'active',
            summary: '港口入口暂停通行',
            scope: '旧港口',
            remainingTurns: 2,
            knowledge: 'observed',
            basis: '现场公告',
        }],
    },
    influences: [{
        id: null,
        trigger: 'WIND-01',
        impact: '运输联合体开始寻找替代路线',
        fallout: '临时运价可能上升',
        knowledge: 'observed',
        basis: '风声已覆盖港区运输圈',
    }],
}, { turn: 5 });
assert.equal(worldUpdated.factions[0].id, 'FAC-01');
assert.equal(worldUpdated.winds.length, 1, '同一稳定ID的风声必须增量合并');
assert.equal(worldUpdated.winds[0].quietTurns, 0, '有实质更新的风声重置沉寂计数');
assert.match(worldUpdated.winds[0].content, /至少持续一天/u);
assert.equal(worldUpdated.reputation.authority.level, 1, '声誉单轮最多移动一级');
assert.equal(worldUpdated.environment.economy, 'strained', '经济气候单轮最多移动一级');
assert.equal(worldUpdated.environment.incidents[0].id, 'INC-01');
assert.equal(worldUpdated.influences[0].id, 'CAUSE-01');
assert.notEqual(
    continuityWorldDigest(worldBase),
    continuityWorldDigest({ ...worldBase, world: worldUpdated }),
);

const partialWorld = applyWorldUpdate(worldUpdated, {
    winds: [{ id: 'UNKNOWN-WIND', content: '模型编造的未知ID' }],
}, { turn: 6 });
assert.equal(partialWorld.factions.length, 1, '增量输出不得删除未返回的旧类别');
assert.equal(partialWorld.winds.length, 1, '未知稳定ID不得污染状态');

const parsedWorldDelta = parseContinuityOutput(`
<ContinuityState>
{
  "turn": 6,
  "threads": [],
  "world": {
    "winds": [{"id":"WIND-01","content":"封路消息继续传播"}]
  }
}
</ContinuityState>`, { chatId: 'world-chat' });
assert.equal(parsedWorldDelta.raw.world.winds[0].id, 'WIND-01');

const legacyWithoutScenario = normalizeContinuityState({
    version: 4,
    chatId: 'legacy-scenario',
    turn: 3,
    threads: [],
});
assert.equal(legacyWithoutScenario.version, 5);
assert.deepEqual(legacyWithoutScenario.scenarioPlan, {
    ...emptyScenarioPlan(),
    createdTurn: 3,
    updatedTurn: 3,
});

const initialScenarioCandidate = {
    status: 'active',
    instanceId: 'SCN-MINOS-01',
    title: '米诺斯回廊',
    baselineEvidence: [
        'MVU主任务：摧毁迷宫核心并从出口撤离',
        '正文已确认米诺斯是迷宫守卫与原生终局敌人',
    ],
    baseline: {
        goal: '摧毁迷宫核心并从出口撤离',
        completion: '迷宫核心失效且队伍抵达出口',
        failure: '队伍全灭或撤离时限耗尽',
        activeApex: '米诺斯',
        route: '中庭或排污管道均可抵达核心区',
        timeLimit: '日落前',
        stakes: '队伍生存与迷宫核心',
        phase: 'exploration',
        closure: 'open',
        closureReason: '',
    },
    amendments: [],
};
const initializedScenario = enforceScenarioPlanPolicy(
    emptyScenarioPlan(),
    initialScenarioCandidate,
    { turn: 5 },
);
assert.equal(initializedScenario.status, 'active');
assert.equal(initializedScenario.revision, 0);
assert.equal(initializedScenario.current.activeApex, '米诺斯');
assert.deepEqual(initializedScenario.current, initializedScenario.baseline);
const initializedThroughContinuity = enforceContinuityPolicy(
    normalizeContinuityState({ chatId: 'scenario-init-chat', turn: 4 }),
    normalizeContinuityState({
        chatId: 'scenario-init-chat',
        turn: 5,
        scenarioPlan: initialScenarioCandidate,
    }),
    { maxThreads: 8 },
);
assert.equal(initializedThroughContinuity.scenarioPlan.instanceId, 'SCN-MINOS-01');
assert.equal(initializedThroughContinuity.lastTick.threadId, 'SCENARIO_PLAN');
assert.match(initializedThroughContinuity.lastTick.reason, /基线已建立/u);

const rejectedUnfoundedInitialization = enforceScenarioPlanPolicy(
    emptyScenarioPlan(),
    {
        ...initialScenarioCandidate,
        baselineEvidence: [],
    },
    { turn: 5 },
);
assert.equal(rejectedUnfoundedInitialization.status, 'inactive');

const matureScenarioThread = normalizeContinuityState({
    chatId: 'scenario-chat',
    turn: 8,
    scenarioPlan: initializedScenario,
    threads: [{
        id: 'WE-OUTER-HUNTER-01',
        title: '界外猎手追踪核心信号',
        origin: 'setting_linked',
        relation: 'latent',
        stage: 'advancing',
        stageProgress: 4,
        summary: '猎手已定位迷宫所在区域',
        offscreenBeat: '信标被核心爆炸进一步放大',
        seedBasis: '世界书：界外猎手追踪异常能量',
        createdTurn: 4,
        lastAdvancedTurn: 7,
    }],
}, { maxThreads: 8 });
const strongerApexAmendment = {
    amendments: [{
        id: 'AMEND-OUTER-HUNTER-01',
        causeType: 'world_chain',
        impact: 'structural',
        sourceThreadIds: ['WE-OUTER-HUNTER-01'],
        trigger: '迷宫核心爆炸将追踪信号放大并暴露了出口',
        mechanism: '已持续追踪多轮的界外猎手沿信号抵达，接管撤离阶段的终局冲突',
        evidence: [
            'WE-OUTER-HUNTER-01已推进至4/9',
            '迷宫核心爆炸是已发生正文事实',
        ],
        changes: [{
            field: 'activeApex',
            before: '米诺斯',
            after: '界外猎手（外部因果介入）',
        }, {
            field: 'phase',
            before: 'exploration',
            after: 'climax',
        }],
        preserves: [
            '米诺斯已经被击败，胜利与战利品保持有效',
            '迷宫核心已经失效，不要求重复完成',
        ],
        visibility: 'observed',
        reversible: false,
    }],
};
const amendedScenario = enforceScenarioPlanPolicy(
    matureScenarioThread.scenarioPlan,
    strongerApexAmendment,
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: matureScenarioThread.threads,
        turn: 9,
    },
);
assert.equal(amendedScenario.revision, 1);
assert.equal(amendedScenario.current.activeApex, '界外猎手（外部因果介入）');
assert.equal(amendedScenario.baseline.activeApex, '米诺斯');
assert.match(amendedScenario.amendments[0].mechanism, /持续追踪多轮/u);
const amendedThroughContinuity = enforceContinuityPolicy(
    matureScenarioThread,
    normalizeContinuityState({
        chatId: 'scenario-chat',
        turn: 9,
        scenarioPlan: strongerApexAmendment,
    }),
    { maxThreads: 8 },
);
assert.equal(amendedThroughContinuity.scenarioPlan.revision, 1);
assert.equal(
    amendedThroughContinuity.scenarioPlan.current.activeApex,
    '界外猎手（外部因果介入）',
);
const amendedWithSource = attachChangedSourceRefs(
    matureScenarioThread,
    amendedThroughContinuity,
    {
        chatId: 'scenario-chat',
        messageId: 'message-9',
        index: 9,
        swipeId: 0,
        hash: 'scenario-hash',
    },
);
assert.equal(
    amendedWithSource.scenarioPlan.amendments.at(-1).sourceRef.messageId,
    'message-9',
);

const sameTurnWorldThread = normalizeContinuityState({
    turn: 9,
    threads: [{
        id: 'WE-SUDDEN-GRINDER-01',
        title: '临时出现的粉碎机',
        origin: 'main_derivative',
        stage: 'seeded',
        summary: '回复刚刚临时生成了一台拦路粉碎机',
        seedBasis: '本回合AI回复',
        createdTurn: 9,
        lastAdvancedTurn: 9,
    }],
}).threads;
const rejectedSameTurnEscalation = enforceScenarioPlanPolicy(
    matureScenarioThread.scenarioPlan,
    {
        amendments: [{
            ...strongerApexAmendment.amendments[0],
            id: 'AMEND-SUDDEN-GRINDER-01',
            sourceThreadIds: ['WE-SUDDEN-GRINDER-01'],
            trigger: '排污管道里突然出现粉碎机',
            mechanism: '临时障碍被口头宣布成更高层最终Boss',
            evidence: ['本回合回复刚刚写出粉碎机'],
            changes: [{
                field: 'activeApex',
                before: '米诺斯',
                after: '真正的最终粉碎机',
            }],
        }],
    },
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: [...matureScenarioThread.threads, ...sameTurnWorldThread],
        turn: 9,
    },
);
assert.equal(rejectedSameTurnEscalation.revision, 0);
assert.equal(rejectedSameTurnEscalation.current.activeApex, '米诺斯');

const rejectedWithoutPreservation = enforceScenarioPlanPolicy(
    matureScenarioThread.scenarioPlan,
    {
        amendments: [{
            ...strongerApexAmendment.amendments[0],
            id: 'AMEND-NO-PRESERVE-01',
            preserves: [],
        }],
    },
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: matureScenarioThread.threads,
        turn: 9,
    },
);
assert.equal(rejectedWithoutPreservation.revision, 0);

const removedApexScenario = enforceScenarioPlanPolicy(
    matureScenarioThread.scenarioPlan,
    {
        amendments: [{
            id: 'AMEND-REMOVE-APEX-01',
            causeType: 'world_chain',
            impact: 'structural',
            sourceThreadIds: ['WE-OUTER-HUNTER-01'],
            trigger: '已推进的外部干预切断了米诺斯的能源供给',
            mechanism: '终局守卫失去维持形体的条件，本副本不再存在固定战斗型Boss',
            evidence: ['WE-OUTER-HUNTER-01已实际干预核心信号'],
            changes: [{
                field: 'activeApex',
                before: '米诺斯',
                after: '',
            }],
            preserves: ['此前取得的路线与核心情报仍然有效'],
            visibility: 'observed',
            reversible: false,
        }],
    },
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: matureScenarioThread.threads,
        turn: 9,
    },
);
assert.equal(
    removedApexScenario.current.activeApex,
    '',
    '可追溯修订必须允许取消Boss，而不是只能不断升级威胁',
);

const invalidEnumScenario = enforceScenarioPlanPolicy(
    matureScenarioThread.scenarioPlan,
    {
        amendments: [{
            ...strongerApexAmendment.amendments[0],
            id: 'AMEND-INVALID-PHASE-01',
            changes: [{
                field: 'phase',
                before: 'exploration',
                after: 'endless-grind',
            }],
        }],
    },
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: matureScenarioThread.threads,
        turn: 9,
    },
);
assert.equal(invalidEnumScenario.revision, 0);

const completedScenario = enforceScenarioPlanPolicy(
    amendedScenario,
    {
        amendments: [{
            id: 'AMEND-CLOSE-01',
            causeType: 'world_chain',
            impact: 'structural',
            sourceThreadIds: ['WE-OUTER-HUNTER-01'],
            trigger: '界外猎手已被解决且队伍抵达出口',
            mechanism: '当前完成条件全部满足，副本进入不可复开的结算终态',
            evidence: ['正文确认终局冲突结束', '正文确认队伍抵达出口'],
            changes: [{
                field: 'closure',
                before: 'open',
                after: 'completed',
            }, {
                field: 'phase',
                before: 'climax',
                after: 'completed',
            }, {
                field: 'closureReason',
                before: '',
                after: '核心失效、终局冲突结束且队伍已撤离',
            }],
            preserves: ['米诺斯与界外猎手的胜利均保留', '所有已取得战利品有效'],
            visibility: 'observed',
            reversible: false,
        }],
    },
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: matureScenarioThread.threads,
        turn: 10,
    },
);
assert.equal(completedScenario.status, 'completed');
assert.equal(completedScenario.revision, 2);
const cannotReopenCompleted = enforceScenarioPlanPolicy(
    completedScenario,
    {
        amendments: [{
            ...strongerApexAmendment.amendments[0],
            id: 'AMEND-REOPEN-01',
            changes: [{
                field: 'closure',
                before: 'completed',
                after: 'open',
            }],
        }],
    },
    {
        beforeThreads: matureScenarioThread.threads,
        afterThreads: matureScenarioThread.threads,
        turn: 11,
    },
);
assert.deepEqual(cannotReopenCompleted, completedScenario);

const scenarioState = normalizeContinuityState({
    ...matureScenarioThread,
    scenarioPlan: amendedScenario,
});
const scenarioInjection = buildContinuityInjection(scenarioState);
assert.match(scenarioInjection, /当前副本\/场景规划/u);
assert.match(scenarioInjection, /禁止为了延长副本临时追加更强怪物/u);
assert.match(scenarioInjection, /米诺斯已经被击败/u);
assert.notEqual(
    continuityScenarioDigest(matureScenarioThread),
    continuityScenarioDigest(scenarioState),
);
const scenarioLedger = continuityLedgerView(scenarioState);
assert.equal(scenarioLedger.scenarioPlan.statusLabel, '进行中');
assert.equal(scenarioLedger.scenarioPlan.latestAmendment.causeLabel, '世界因果链');

const structuralWorldOnly = normalizeContinuityState({
    chatId: 'world-lanes-no-actors',
    turn: 12,
    threads: [],
    world: {
        factions: [{
            id: 'FAC-TIDE-GUILD',
            name: '潮汐运输公会',
            condition: 'strained',
            goal: '在涨潮前恢复旧桥货运',
            summary: '改道成本正持续上升',
            scope: '港区',
            knowledge: 'observed',
            basis: '公开调度公告',
            updatedTurn: 7,
        }],
        environment: {
            economy: 'strained',
            summary: '连续降雨正在压缩港区短途运力',
            basis: '路况与运价记录',
            updatedTurn: 8,
            incidents: [{
                id: 'INC-HIGH-TIDE',
                title: '旧桥涨潮',
                status: 'active',
                summary: '桥面将在一轮内达到封闭水位',
                scope: '港区旧桥',
                remainingTurns: 1,
                knowledge: 'observed',
                basis: '潮位站公开读数',
                updatedTurn: 11,
            }],
        },
        trends: [{
            id: 'TREND-RAIN',
            name: '雨季延长',
            status: 'active',
            summary: '降雨周期比往年更长',
            scope: '港区',
            source: '气象记录',
            knowledge: 'observed',
            basis: '连续观测',
            updatedTurn: 4,
        }],
    },
});
const structuralSchedule = scheduleWorldLanes(structuralWorldOnly, {
    turn: 13,
    maxLanes: 2,
    factionSlots: 1,
    environmentSlots: 1,
    receiptScope: 'chat:message-13:swipe-0:generation-2:branch-main',
});
assert.equal(structuralSchedule.selected.length, 2);
assert.equal(structuralSchedule.selected[0].independentOfActors, true);
assert.ok(
    structuralSchedule.selected.some((item) => item.laneType === 'environment'),
    '到期环境过程必须拥有独立于人物的调度位置',
);
assert.ok(
    structuralSchedule.selected.some((item) => item.laneType === 'faction'),
    '势力过程不得因没有人物候选而消失',
);
assert.equal(structuralSchedule.receipts.length, structuralSchedule.selected.length);
assert.ok(
    structuralSchedule.receipts.every((item) => (
        item.due ? item.status === 'scheduled' : item.status === 'retained'
    )),
);
assert.equal(
    new Set(structuralSchedule.receipts.map((item) => item.receiptId)).size,
    structuralSchedule.receipts.length,
);
assert.ok(
    structuralSchedule.receipts.every((item) => (
        item.receiptId.includes('branch-main')
    )),
);

const boundedStructuralSchedule = scheduleWorldLanes(structuralWorldOnly, {
    turn: 13,
    maxLanes: 1,
    factionSlots: 0,
    environmentSlots: 1,
});
assert.equal(boundedStructuralSchedule.selected.length, 1);
assert.equal(boundedStructuralSchedule.selected[0].laneType, 'environment');

const actorThreadDoesNotReplaceWorld = scheduleWorldLanes({
    ...structuralWorldOnly,
    threads: [{
        id: 'WE-ACTOR-CONTACT',
        title: '信使来访',
        actors: ['信使'],
        stage: 'advancing',
        urgency: 4,
    }],
}, {
    turn: 13,
    maxLanes: 2,
    factionSlots: 1,
    environmentSlots: 1,
});
assert.deepEqual(
    actorThreadDoesNotReplaceWorld.selected.map((item) => item.sourceId),
    structuralSchedule.selected.map((item) => item.sourceId),
    '人物事件不得挤掉势力与环境自己的世界轨预算',
);

const ambientEnvironmentSchedule = scheduleWorldLanes(normalizeContinuityState({
    chatId: 'ambient-environment',
    turn: 4,
    world: {
        environment: {
            economy: 'stable',
            summary: '持续降雨让旧码头地面湿滑',
            basis: '连续气象观测',
            updatedTurn: 3,
        },
    },
}), {
    turn: 5,
    maxLanes: 1,
    factionSlots: 0,
    environmentSlots: 1,
});
assert.equal(ambientEnvironmentSchedule.selected[0].sourceId, 'environment:ambient');
assert.equal(ambientEnvironmentSchedule.selected[0].label.includes('经济'), false);

let namespace = appendRepairJournal({}, {
    id: 'repair-1',
    status: 'applied',
    snapshot: { stat_data: { value: 1 } },
}, { maxEntries: 3 });
assert.equal(latestUndoRecord(namespace).id, 'repair-1');
namespace = markRepairUndone(namespace, 'repair-1');
assert.equal(latestUndoRecord(namespace), null);

namespace = appendRepairJournal(namespace, {
    id: 'repair-big',
    status: 'applied',
    snapshot: { text: 'x'.repeat(200) },
}, { maxSnapshotChars: 20 });
assert.equal(namespace.repairJournal.at(-1).snapshot, undefined);
assert.equal(namespace.repairJournal.at(-1).snapshotOmitted, true);
assert.equal(
    latestUndoRecord(namespace).id,
    'repair-big',
    'the latest omitted snapshot must remain visible so UI can explain why undo is unavailable',
);

namespace = appendRepairJournal(namespace, {
    id: 'repair-upsert',
    status: 'applied',
    frontendSynced: false,
    snapshot: { stat_data: { value: 1 } },
});
namespace = appendRepairJournal(namespace, {
    id: 'repair-upsert',
    status: 'applied',
    frontendSynced: true,
    snapshot: { stat_data: { value: 1 } },
});
assert.equal(
    namespace.repairJournal.filter((record) => record.id === 'repair-upsert').length,
    1,
    'repair journal updates must upsert instead of duplicating one repair',
);
assert.equal(namespace.repairJournal.at(-1).frontendSynced, true);

namespace = appendRepairJournal(namespace, {
    id: 'repair-rolled-back',
    status: 'rolled_back',
    snapshot: { stat_data: { value: 2 } },
});
assert.equal(
    latestUndoRecord(namespace).id,
    'repair-upsert',
    '已回滚或失败的终态记录不得遮挡最近一次可撤销修复',
);

console.log('continuity core tests passed');
