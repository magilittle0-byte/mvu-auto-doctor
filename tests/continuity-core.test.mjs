import assert from 'node:assert/strict';
import {
    appendRepairJournal,
    attachChangedSourceRefs,
    buildContinuityInjection,
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

let state = mergeMarkerRecords(null, markers.records, {
    chatId: 'chat-a',
    maxThreads: 4,
});
assert.equal(state.threads.length, 1);
assert.equal(state.threads[0].knowledge, 'hidden');

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

const injection = buildContinuityInjection(state, {
    director: 'mixed',
    maxVisible: 1,
});
assert.match(injection, /预设与缝合怪负责剧情提案/u);
assert.match(injection, /最多让1条支线/u);
assert.match(injection, /禁止替玩家角色决定/u);
assert.match(injection, /PE-港口-哨兵-01/u);

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
