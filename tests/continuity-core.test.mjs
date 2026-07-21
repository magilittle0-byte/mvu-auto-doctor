import assert from 'node:assert/strict';
import {
    appendRepairJournal,
    attachChangedSourceRefs,
    buildContinuityInjection,
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
