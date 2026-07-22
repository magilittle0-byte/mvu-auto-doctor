import assert from 'node:assert/strict';
import {
    appendRepairJournal,
    attachChangedSourceRefs,
    buildContinuityInjection,
    continuityLifecycleStats,
    continuityLedgerView,
    enforceContinuityPolicy,
    extractContinuityMarkers,
    latestUndoRecord,
    markRepairUndone,
    mergeMarkerRecords,
    normalizeContinuityState,
    parseContinuityOutput,
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
assert.equal(ledger.active[0].stageLabel, '已显现');
assert.equal(ledger.active[0].kindLabel, '平行事件');
assert.equal(ledger.active[0].knowledgeLabel, '传闻阶段（部分可知）');
assert.equal(ledger.active[0].latestSource.index, 9);
assert.equal(ledger.active[0].originLabel, '主线衍生');
assert.equal(ledger.active[0].relationLabel, '已接入主线');
assert.equal(ledger.active[0].isSpoiler, false);
assert.equal(ledger.resolved[0].kindLabel, '约定/承诺');

const injection = buildContinuityInjection(state, {
    director: 'mixed',
    maxVisible: 1,
});
assert.match(injection, /预设与缝合怪负责剧情提案/u);
assert.match(injection, /最多让1条支线/u);
assert.match(injection, /禁止替玩家角色决定/u);
assert.match(injection, /PE-港口-哨兵-01/u);
assert.match(injection, /禁止为了展示伏笔而强行写入正文/u);

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
assert.equal(convergenceGuard.threads[0].relation, 'converging', '独立事件必须先进入汇流阶段');

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
});

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
assert.match(aftermathInjection, /持续影响=旧城药材运输成本下降/u);
assert.match(aftermathInjection, /仍在传播=商队流传行会高层发生了权力交换/u);

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
assert.equal(capped.threads.length, 4);

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

console.log('continuity core tests passed');
