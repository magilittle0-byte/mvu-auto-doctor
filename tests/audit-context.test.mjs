import assert from 'node:assert/strict';

import {
    buildLifecycleHistoryHints,
    findLifecycleCollections,
    hasUsableStatData,
} from '../core.mjs';

assert.equal(hasUsableStatData({}), false);
assert.equal(hasUsableStatData({ display_data: {} }), false);
assert.equal(hasUsableStatData({ stat_data: {}, display_data: {} }), false);
assert.equal(hasUsableStatData({ stat_data: { 账户: {} }, display_data: {} }), true);
assert.equal(hasUsableStatData({ 账户: {} }), true, '仍兼容直接返回裸 stat_data 的宿主');

const rules = [
    '契约者.当前敌人：',
    '- 新敌人必须写入完整对象。',
    '- 敌人死亡、逃跑或战斗结束时，直接删除对应条目。',
    '契约者.系统背包：物品按正文明确获得或消耗更新。',
].join('\n');

const stat = {
    契约者: {
        当前敌人: {
            '维克多·维克特': { 状态: '友好义体医生', 装备: {} },
            独眼: { 状态: '绝对顺从', 装备: { 躯干: '无' } },
            '“铁锯”斯凯尔': { 状态: '绝对顺从', 装备: { 躯干: '重型工业装甲' } },
            清道夫屠夫B: { 状态: '死亡', 装备: { 主手: '切肉斧' } },
        },
        系统背包: {
            PDA: { 数量: 1, 描述: '已破解' },
            歧路司义眼: { 数量: 2, 描述: '任务物品' },
        },
    },
};

const transcript = [
    {
        index: 44,
        role: 'AI',
        text: '维克多·维克特面板全开进入当前敌人/NPC列表；他是提供帮助的友好义体医生。',
    },
    ...Array.from({ length: 12 }, (_, index) => ({
        index: 45 + index,
        role: index % 2 ? 'AI' : '用户',
        text: `中间剧情 ${index + 1}，处理别处的探索与休整。`,
    })),
    {
        index: 78,
        role: 'AI',
        text: '独眼把重型工业装甲脱下来，还给“铁锯”斯凯尔；铁锯重新穿戴重型装甲。',
    },
    {
        index: 86,
        role: 'AI',
        text: '清道夫屠夫B已经彻底变成一具冰冷的尸体。',
    },
];

const collections = findLifecycleCollections(stat, rules);
assert.deepEqual(
    collections.map((collection) => collection.path),
    ['/契约者/当前敌人'],
    '只应识别规则明确带有终止清理条件的记录集合',
);

const hints = buildLifecycleHistoryHints(stat, rules, transcript);
assert.match(hints, /集合 \/契约者\/当前敌人/u);
assert.match(hints, /历史楼层 44/u, '必须能越过最近八条上下文回查早期错误归属证据');
assert.match(hints, /维克多·维克特面板全开进入当前敌人\/NPC列表/u);
assert.match(hints, /独眼把重型工业装甲脱下来/u);
assert.match(hints, /清道夫屠夫B已经彻底变成一具冰冷的尸体/u);
assert.doesNotMatch(hints, /集合 \/契约者\/系统背包/u, '普通背包不得被误判成生命周期集合');

console.log('audit context tests passed');
