import assert from 'node:assert/strict';
import {
    extractUpdateBlockCandidate,
    findOpeningResourceMismatches,
    inferAutomaticallyComputedPaths,
    normalizeObjectPropertyOps,
    parseInitializationText,
    parsePatchBlock,
    preparePatch,
    restoreTouchedPaths,
    simulateOps,
    stripAutomaticallyComputedOps,
    stripRedundantExistingContainerOps,
    validatePatchResult,
} from '../core.mjs';

const singleObjectPatch = parsePatchBlock(
    '<UpdateVariable><Analysis>模型漏了数组外壳</Analysis><JSONPatch>'
    + '{"op":"replace","path":"/账户/代币","value":3}'
    + '</JSONPatch></UpdateVariable>',
);
assert.equal(singleObjectPatch.error, undefined);
assert.equal(singleObjectPatch.repaired, true);
assert.equal(singleObjectPatch.ops.length, 1);
assert.match(singleObjectPatch.repairReason, /单个补丁对象/u);
assert.deepEqual(
    JSON.parse(singleObjectPatch.block.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/iu)[1]),
    [{ op: 'replace', path: '/账户/代币', value: 3 }],
);

const wrappedPatchArray = parsePatchBlock(
    '<UpdateVariable><Analysis>模型多包了一层</Analysis><JSONPatch>'
    + '{"operations":[{"op":"delta","path":"/账户/代币","value":1}]}'
    + '</JSONPatch></UpdateVariable>',
);
assert.equal(wrappedPatchArray.error, undefined);
assert.equal(wrappedPatchArray.repaired, true);
assert.deepEqual(wrappedPatchArray.ops, [{ op: 'delta', path: '/账户/代币', value: 1 }]);

assert.match(
    parsePatchBlock(
        '<UpdateVariable><Analysis>存在歧义</Analysis><JSONPatch>'
        + '{"operations":[],"patches":[]}'
        + '</JSONPatch></UpdateVariable>',
    ).error,
    /多个候选/u,
);
assert.match(
    parsePatchBlock(
        '<UpdateVariable><Analysis>任意对象</Analysis><JSONPatch>'
        + '{"answer":"没有补丁"}'
        + '</JSONPatch></UpdateVariable>',
    ).error,
    /必须是数组或单个合法补丁对象/u,
);
assert.match(
    parsePatchBlock(
        '<UpdateVariable><Analysis>数组被截断</Analysis><JSONPatch>'
        + '[{"op":"replace","path":"/账户/代币","value":3}'
        + '</JSONPatch></UpdateVariable>',
    ).error,
    /不是完整的 JSON 数组/u,
);

const redundantContainer = stripRedundantExistingContainerOps(
    '<UpdateVariable><Analysis>重复初始化已有背包</Analysis><JSONPatch>'
    + '[{"op":"insert","path":"/角色/背包","value":{}},'
    + '{"op":"insert","path":"/角色/背包/子弹","value":{"数量":50}}]'
    + '</JSONPatch></UpdateVariable>',
    { stat_data: { 角色: { 背包: {} } } },
);
assert.equal(redundantContainer.error, undefined);
assert.equal(redundantContainer.repaired, true);
assert.deepEqual(redundantContainer.ignoredPaths, ['/角色/背包']);
assert.deepEqual(redundantContainer.ops, [
    { op: 'insert', path: '/角色/背包/子弹', value: { 数量: 50 } },
]);

const normalizedObjectOps = normalizeObjectPropertyOps(
    '<UpdateVariable><Analysis>对象字段操作类型混淆</Analysis><JSONPatch>'
    + '[{"op":"replace","path":"/角色/天赋/效果/新效果","value":"已触发"},'
    + '{"op":"insert","path":"/角色/姓名","value":"林默"}]'
    + '</JSONPatch></UpdateVariable>',
    { stat_data: { 角色: { 姓名: 'User', 天赋: { 效果: {} } } } },
);
assert.equal(normalizedObjectOps.error, undefined);
assert.equal(normalizedObjectOps.repaired, true);
assert.deepEqual(normalizedObjectOps.repairedPaths, [
    '/角色/天赋/效果/新效果',
    '/角色/姓名',
]);
assert.deepEqual(normalizedObjectOps.ops, [
    { op: 'insert', path: '/角色/天赋/效果/新效果', value: '已触发' },
    { op: 'replace', path: '/角色/姓名', value: '林默' },
]);
assert.equal(
    normalizeObjectPropertyOps(
        '<UpdateVariable><Analysis>数组不猜</Analysis><JSONPatch>'
        + '[{"op":"replace","path":"/列表/1","value":"b"}]'
        + '</JSONPatch></UpdateVariable>',
        { stat_data: { 列表: ['a'] } },
    ).ops[0].op,
    'replace',
);

const completeCandidate = extractUpdateBlockCandidate(
    '<UpdateVariable><Analysis>完整</Analysis><JSONPatch>'
    + '[{"op":"replace","path":"/账户/代币","value":3}]'
    + '</JSONPatch></UpdateVariable>',
);
assert.equal(completeCandidate.recovered, false);
assert.match(completeCandidate.block, /<Analysis>完整<\/Analysis>/u);

const safelyRecoveredCandidate = extractUpdateBlockCandidate(
    '<UpdateVariable><Analysis>闭合标签被中转截掉</Analysis><JSONPatch>'
    + '[{"op":"replace","path":"/日志/文本","value":"方括号 ] 与花括号 } 都在字符串里"},'
    + '{"op":"replace","path":"/账户/代币","value":3}]',
);
assert.equal(safelyRecoveredCandidate.recovered, true);
assert.equal(safelyRecoveredCandidate.incomplete, false);
assert.match(safelyRecoveredCandidate.block, /<\/JSONPatch>\s*<\/UpdateVariable>/u);
assert.equal(
    JSON.parse(
        safelyRecoveredCandidate.block.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/iu)[1],
    ).length,
    2,
);

const recoveredInnerCloseCandidate = extractUpdateBlockCandidate(
    '<UpdateVariable><Analysis>外层闭合但内层漏标签</Analysis><JSONPatch>'
    + '[{"op":"replace","path":"/账户/代币","value":3}]'
    + '</UpdateVariable>',
);
assert.equal(recoveredInnerCloseCandidate.recovered, true);
assert.equal(recoveredInnerCloseCandidate.incomplete, false);
assert.match(recoveredInnerCloseCandidate.block, /<\/JSONPatch>\s*<\/UpdateVariable>/u);

const recoveredSingleObjectTail = extractUpdateBlockCandidate(
    '<UpdateVariable><Analysis>单对象与闭合标签同时缺失</Analysis><JSONPatch>'
    + '{"op":"replace","path":"/账户/代币","value":3}',
);
assert.equal(recoveredSingleObjectTail.recovered, true);
assert.equal(recoveredSingleObjectTail.incomplete, false);
assert.match(recoveredSingleObjectTail.reason, /单个补丁对象/u);
assert.deepEqual(parsePatchBlock(recoveredSingleObjectTail.block).ops, [
    { op: 'replace', path: '/账户/代币', value: 3 },
]);

const truncatedCandidate = extractUpdateBlockCandidate(
    '<UpdateVariable><Analysis>被截断</Analysis><JSONPatch>'
    + '[{"op":"replace","path":"/账户/代币","value":',
);
assert.equal(truncatedCandidate.block, '');
assert.equal(truncatedCandidate.incomplete, true);
assert.match(truncatedCandidate.reason, /数组完成前被截断/u);

assert.deepEqual(
    simulateOps({ source: 1, keep: 2 }, [{ op: 'move', from: '/source', to: '/moved' }]),
    { expected: { keep: 2, moved: 1 }, touched: ['/moved', '/source'] },
    'move must preserve the value while changing object keys',
);
assert.deepEqual(
    simulateOps({ items: ['a', 'b', 'c'] }, [{ op: 'move', from: '/items/0', to: '/items/2' }]).expected.items,
    ['b', 'c', 'a'],
    'array move must apply the destination after removing the source',
);
assert.deepEqual(
    simulateOps({ items: ['a'] }, [{ op: 'insert', path: '/items/-', value: 'b' }]).expected.items,
    ['a', 'b'],
    'insert with - must append',
);
assert.match(
    simulateOps({ items: ['a'] }, [{ op: 'insert', path: '/items/3', value: 'b' }]).error,
    /数组位置无效/u,
);
assert.match(
    simulateOps({ value: 1 }, [{ op: 'remove', path: '/missing' }]).error,
    /目标不存在/u,
);
const encodedRemove = preparePatch(
    '<UpdateVariable><Analysis>清理退场敌人</Analysis><JSONPatch>'
    + '[{"op":"remove","path":"/%E5%A5%91%E7%BA%A6%E8%80%85/%E5%BD%93%E5%89%8D%E6%95%8C%E4%BA%BA/%E7%BA%A2%E9%AC%BC%E5%8D%AB%E5%85%B5A"}]'
    + '</JSONPatch></UpdateVariable>',
    {
        stat_data: {
            契约者: {
                当前敌人: {
                    红鬼卫兵A: { HP: 0 },
                },
            },
        },
    },
);
assert.equal(encodedRemove.error, undefined);
assert.equal(encodedRemove.normalizedEncodedPaths, true);
assert.deepEqual(encodedRemove.touched, ['/契约者/当前敌人/红鬼卫兵A']);
assert.match(encodedRemove.block, /"path": "\/契约者\/当前敌人\/红鬼卫兵A"/u);
assert.deepEqual(encodedRemove.expectedStat, { 契约者: { 当前敌人: {} } });

const literalPercentKey = preparePatch(
    '<UpdateVariable><Analysis></Analysis><JSONPatch>'
    + '[{"op":"remove","path":"/%E5%A5%91"}]'
    + '</JSONPatch></UpdateVariable>',
    { stat_data: { '%E5%A5%91': 'literal', 契: 'decoded' } },
);
assert.equal(literalPercentKey.error, undefined);
assert.equal(literalPercentKey.normalizedEncodedPaths, undefined);
assert.deepEqual(literalPercentKey.expectedStat, { 契: 'decoded' });

assert.match(
    preparePatch(
        '<UpdateVariable><Analysis></Analysis><JSONPatch>'
        + '[{"op":"remove","path":"/%E5%A5%91%E7%BA%A6/%ZZ"}]'
        + '</JSONPatch></UpdateVariable>',
        { stat_data: { 契约: {} } },
    ).error,
    /目标不存在|父路径不存在/u,
    'Malformed URI sequences must not be guessed or partially decoded',
);
assert.match(
    preparePatch('<UpdateVariable><Analysis></Analysis><JSONPatch>[{"op":"replace","path":"/safe/_private","value":2}]</JSONPatch></UpdateVariable>', {
        stat_data: { safe: { _private: 1 } },
    }).error,
    /只读/u,
);
assert.match(
    simulateOps({ value: '1' }, [{ op: 'delta', path: '/value', value: 1 }]).error,
    /不是现有数字/u,
);
const validationPrepared = { expectedStat: { x: 1 }, touched: ['/x'] };
assert.equal(
    validatePatchResult(
        { stat_data: { x: 0 } },
        { stat_data: { x: 1, schemaDefault: true } },
        validationPrepared,
    ).ok,
    true,
    'write-back may contain additional schema defaults',
);
assert.deepEqual(
    validatePatchResult(
        { stat_data: { x: 0 } },
        { stat_data: { x: 2 } },
        validationPrepared,
    ).rejected,
    ['/x'],
    'partial or incorrect write-back must identify rejected paths',
);
const strippedUntouched = validatePatchResult(
    { stat_data: { x: 0, 其他: { 旧字段: 7 } } },
    { stat_data: { x: 1 } },
    validationPrepared,
);
assert.equal(strippedUntouched.ok, false);
assert.deepEqual(strippedUntouched.rejected, ['/其他/旧字段']);
assert.match(strippedUntouched.details[0].reason, /未触碰的旧字段必须保留/u);
assert.equal(
    validatePatchResult(
        { stat_data: { x: 0, 其他: { 旧字段: 7 } } },
        { stat_data: { x: 1, 其他: { 旧字段: 7 }, schemaDefault: true } },
        validationPrepared,
    ).ok,
    true,
    'untouched legacy fields must survive while new schema defaults remain allowed',
);
assert.equal(
    validatePatchResult(
        { stat_data: { x: 0, _derived: 1, 其他: { 旧字段: 7 } } },
        { stat_data: { x: 1, _derived: 2, 其他: { 旧字段: 7 } } },
        validationPrepared,
    ).ok,
    true,
    'present read-only derived fields may be recomputed by MVU normalization',
);
const strippedReadonly = validatePatchResult(
    { stat_data: { x: 0, _derived: 1 } },
    { stat_data: { x: 1 } },
    validationPrepared,
);
assert.equal(strippedReadonly.ok, false, 'normalization must not remove a read-only derived field');
assert.deepEqual(strippedReadonly.rejected, ['/_derived']);

const derivedState = {
    stat_data: {
        角色: {
            属性: {
                基础: { STR: 5 },
                实际: { STR: 5 },
            },
            历史记录: {
                实际: { STR: 4 },
            },
            头部: {
                等级: 1,
            },
            属性点: {
                未分配: 5,
            },
            资源: {
                MP_当前: 50,
                MP_最大: 50,
                闪避值: 10,
            },
        },
    },
};
const automaticallyComputedPaths = inferAutomaticallyComputedPaths(derivedState, {
    schemaTexts: [
        '属性: z.object({基础, 实际}).transform(data => ({...data, 实际: {STR: data.基础.STR}}))',
    ],
    ruleTexts: [
        '角色.资源:',
        '- MP_最大 / 闪避值 均由前端根据实际属性自动计算，AI无需手动写入',
        '- 闪避值的联动由前端自动完成，AI无需手动写入',
        '- 闪避值均由前端自动计算，AI禁止直接修改',
        '- 角色.属性.结果 由前端自动计算，AI无需手动写入',
        '- 升级时未分配属性点+1由前端自动处理，AI只需写入经验；属性点也可由玩家自行分配',
        '- AI只负责实时写入：MP_当前',
    ],
});
assert.deepEqual(automaticallyComputedPaths, [
    '/角色/属性/实际/STR',
    '/角色/资源/MP_最大',
    '/角色/资源/闪避值',
]);
assert.ok(
    !automaticallyComputedPaths.includes('/角色/历史记录/实际/STR'),
    'Schema transform must be scoped to its parent object, not every same-named segment',
);
assert.ok(
    !automaticallyComputedPaths.includes('/角色/头部/等级'),
    'short field names must not match as substrings inside a different compound field',
);
assert.ok(
    !automaticallyComputedPaths.includes('/角色/属性点/未分配'),
    'conditionally automatic fields must remain writable unless rules declare them read-only',
);
const strippedAutomaticPatch = stripAutomaticallyComputedOps(
    '<UpdateVariable><Analysis>修复基础输入，派生值交给前端</Analysis><JSONPatch>'
    + '[{"op":"replace","path":"/角色/属性/基础/STR","value":10},'
    + '{"op":"replace","path":"/角色/属性/实际/STR","value":99},'
    + '{"op":"replace","path":"/角色/资源/MP_最大","value":999}]'
    + '</JSONPatch></UpdateVariable>',
    automaticallyComputedPaths,
);
assert.deepEqual(strippedAutomaticPatch.ignoredPaths, [
    '/角色/属性/实际/STR',
    '/角色/资源/MP_最大',
]);
const derivedPrepared = preparePatch(strippedAutomaticPatch.block, derivedState);
derivedPrepared.automaticallyComputedPaths = automaticallyComputedPaths;
assert.equal(
    validatePatchResult(
        derivedState,
        {
            stat_data: {
                角色: {
                    属性: {
                        基础: { STR: 10 },
                        实际: { STR: 10 },
                    },
                    历史记录: {
                        实际: { STR: 4 },
                    },
                    头部: {
                        等级: 1,
                    },
                    属性点: {
                        未分配: 5,
                    },
                    资源: {
                        MP_当前: 50,
                        MP_最大: 100,
                        闪避值: 15,
                    },
                },
            },
        },
        derivedPrepared,
    ).ok,
    true,
    'rule-declared automatic fields may change after their writable inputs are repaired',
);
const removedAutomaticField = validatePatchResult(
    derivedState,
    {
        stat_data: {
            角色: {
                属性: {
                    基础: { STR: 10 },
                    实际: { STR: 10 },
                },
                历史记录: {
                    实际: { STR: 4 },
                },
                头部: {
                    等级: 1,
                },
                属性点: {
                    未分配: 5,
                },
                资源: {
                    MP_当前: 50,
                    闪避值: 15,
                },
            },
        },
    },
    derivedPrepared,
);
assert.equal(removedAutomaticField.ok, false, 'automatic normalization must not delete fields');
assert.ok(removedAutomaticField.rejected.includes('/角色/资源/MP_最大'));
assert.ok(
    !automaticallyComputedPaths.includes('/角色/属性/基础/STR')
    && !automaticallyComputedPaths.includes('/角色/资源/MP_当前'),
    'writable base/current fields must not be inferred as automatic',
);

const restoredTouched = restoreTouchedPaths(
    {
        stat_data: {
            x: 9,
            untouched: { external: '并发写入必须保留' },
        },
        display_data: { current: true },
    },
    {
        stat_data: { x: 0, untouched: { old: true } },
        display_data: { old: true },
    },
    ['/x'],
);
assert.deepEqual(restoredTouched, {
    stat_data: {
        x: 0,
        untouched: { external: '并发写入必须保留' },
    },
    display_data: { current: true },
}, 'rollback must restore only repair-touched paths and preserve concurrent external state');

const initial = parseInitializationText(`
契约者:
  衍生属性:
    HP_当前: 75
    HP_最大: 75
    MP_当前: 50
    MP_最大: 50
    负重_当前: 0
    负重_上限: 25
`);

assert.deepEqual(initial.契约者.衍生属性, {
    HP_当前: 75,
    HP_最大: 75,
    MP_当前: 50,
    MP_最大: 50,
    负重_当前: 0,
    负重_上限: 25,
});

const inlineCommentInitial = parseInitializationText(`
资源:
  HP_当前: 75 # 开局满血
  HP_最大: 75 # 基础上限
  标签: "文字 # 不是注释"
`);
assert.equal(inlineCommentInitial.资源.HP_当前, 75);
assert.equal(typeof inlineCommentInitial.资源.HP_当前, 'number');
assert.equal(inlineCommentInitial.资源.HP_最大, 75);
assert.equal(inlineCommentInitial.资源.标签, '文字 # 不是注释');

const current = {
    stat_data: {
        契约者: {
            衍生属性: {
                HP_当前: 75,
                HP_最大: 150,
                MP_当前: 50,
                MP_最大: 110,
                负重_当前: 0,
                负重_上限: 55,
            },
        },
    },
};

const mismatches = findOpeningResourceMismatches(current, {
    initialStates: [initial],
});
assert.deepEqual(
    mismatches.map(({ currentPath, from, to }) => ({ currentPath, from, to })),
    [
        { currentPath: '/契约者/衍生属性/HP_当前', from: 75, to: 150 },
        { currentPath: '/契约者/衍生属性/MP_当前', from: 50, to: 110 },
    ],
    'Only resources declared full should be synchronized; load/capacity must stay 0/55',
);

assert.equal(
    findOpeningResourceMismatches(current, {
        initialStates: [initial],
        touchedPaths: ['/契约者/衍生属性/MP_当前'],
    }).some((item) => item.currentPath.endsWith('/MP_当前')),
    false,
    'A resource explicitly changed by the reply must never be refilled',
);

const spent = structuredClone(current);
spent.stat_data.契约者.衍生属性.MP_当前 = 40;
assert.equal(
    findOpeningResourceMismatches(spent, { initialStates: [initial] })
        .some((item) => item.currentPath.endsWith('/MP_当前')),
    false,
    'A resource below its declared initial value is treated as spent, not broken',
);

const nestedInitial = {
    stat_data: {
        属性: {
            MP: { 当前: 50, 上限: 50 },
            负重: { 当前: 0, 上限: 25 },
        },
    },
};
const nestedCurrent = {
    stat_data: {
        属性: {
            MP: { 当前: 50, 上限: 110 },
            负重: { 当前: 0, 上限: 55 },
        },
    },
};
assert.deepEqual(
    findOpeningResourceMismatches(nestedCurrent, { initialStates: [nestedInitial] })
        .map(({ currentPath, to }) => ({ currentPath, to })),
    [{ currentPath: '/属性/MP/当前', to: 110 }],
    'nested current/maximum resource objects must be supported without treating capacity as a refill',
);

const arrayInitial = {
    stat_data: {
        角色: [{ 名称: '术士', MP: { 当前: 50, 上限: 50 } }],
    },
};
const arrayCurrent = {
    stat_data: {
        角色: [{ 名称: '术士', MP: { 当前: 50, 上限: 110 } }],
    },
};
assert.deepEqual(
    findOpeningResourceMismatches(arrayCurrent, { initialStates: [arrayInitial] })
        .map(({ currentPath, to }) => ({ currentPath, to })),
    [{ currentPath: '/角色/0/MP/当前', to: 110 }],
    'resource pairs nested inside arrays must be discovered',
);

const arrayYamlInitial = parseInitializationText(`
角色:
  - 名称: 术士
    MP_当前: 50
    MP_最大: 50
  - 名称: 战士
    HP_当前: 80
    HP_最大: 80
`);
assert.deepEqual(arrayYamlInitial.角色, [
    { 名称: '术士', MP_当前: 50, MP_最大: 50 },
    { 名称: '战士', HP_当前: 80, HP_最大: 80 },
]);
assert.deepEqual(
    findOpeningResourceMismatches({
        stat_data: {
            角色: [
                { 名称: '术士', MP_当前: 50, MP_最大: 110 },
                { 名称: '战士', HP_当前: 80, HP_最大: 160 },
            ],
        },
    }, { initialStates: [arrayYamlInitial] })
        .map(({ currentPath, to }) => ({ currentPath, to })),
    [
        { currentPath: '/角色/0/MP_当前', to: 110 },
        { currentPath: '/角色/1/HP_当前', to: 160 },
    ],
    'YAML block sequences in initvar must parse into arrays and drive resource synchronization',
);

const nestedArrayYamlInitial = parseInitializationText(`
角色:
  - 属性:
      MP_当前: 50
      MP_最大: 50
    等级: 5
`);
assert.deepEqual(nestedArrayYamlInitial, {
    角色: [{ 属性: { MP_当前: 50, MP_最大: 50 }, 等级: 5 }],
});
assert.deepEqual(
    findOpeningResourceMismatches({
        stat_data: {
            角色: [{ 属性: { MP_当前: 50, MP_最大: 110 }, 等级: 5 }],
        },
    }, { initialStates: [nestedArrayYamlInitial] })
        .map(({ currentPath, to }) => ({ currentPath, to })),
    [{ currentPath: '/角色/0/属性/MP_当前', to: 110 }],
    'nested mapping below an inline sequence key must end before its sibling fields',
);

const valueSuffixInitial = {
    stat_data: { HP当前值: 75, HP最大值: 75 },
};
const valueSuffixCurrent = {
    stat_data: { HP当前值: 75, HP最大值: 150 },
};
assert.deepEqual(
    findOpeningResourceMismatches(valueSuffixCurrent, { initialStates: [valueSuffixInitial] })
        .map(({ currentPath, to }) => ({ currentPath, to })),
    [{ currentPath: '/HP当前值', to: 150 }],
    'resource names ending in 当前值/最大值 must be paired',
);

const previous = {
    stat_data: {
        resources: {
            mana_current: 80,
            mana_max: 80,
        },
    },
};
const derived = {
    stat_data: {
        resources: {
            mana_current: 80,
            mana_max: 120,
        },
    },
};
assert.deepEqual(
    findOpeningResourceMismatches(derived, { previousData: previous })
        .map(({ currentPath, to, proof }) => ({ currentPath, to, proof })),
    [{
        currentPath: '/resources/mana_current',
        to: 120,
        proof: 'derived-maximum-increased-from-full',
    }],
    'Cards without a readable initvar can use a full previous opening state as proof',
);

const progressPrevious = {
    stat_data: { 任务: { 进度_当前: 3, 进度_上限: 3 } },
};
const progressCurrent = {
    stat_data: { 任务: { 进度_当前: 3, 进度_上限: 5 } },
};
assert.deepEqual(
    findOpeningResourceMismatches(progressCurrent, { previousData: progressPrevious }),
    [],
    'A previously full progress counter is not a refillable resource merely because its cap increased',
);
assert.deepEqual(
    findOpeningResourceMismatches(progressCurrent, { initialStates: [progressPrevious] })
        .map(({ currentPath, to }) => ({ currentPath, to })),
    [{ currentPath: '/任务/进度_当前', to: 5 }],
    'An explicit initvar declaration remains authoritative even for progress-like names',
);
assert.deepEqual(
    findOpeningResourceMismatches(
        { stat_data: { 任务: { 进度_当前: 0, 进度_上限: 5 } } },
        { initialStates: [{ stat_data: { 任务: { 进度_当前: 0, 进度_上限: 0 } } }] },
    ),
    [],
    'A declared 0/0 counter is an unset cap, not evidence that it should be filled after unlocking',
);

for (const counterName of ['层数', '周目', '章节']) {
    const beforeCounter = {
        stat_data: { 记录: { [`${counterName}_当前`]: 10, [`${counterName}_上限`]: 10 } },
    };
    const afterCounter = {
        stat_data: { 记录: { [`${counterName}_当前`]: 10, [`${counterName}_上限`]: 20 } },
    };
    assert.deepEqual(
        findOpeningResourceMismatches(afterCounter, { previousData: beforeCounter }),
        [],
        `${counterName} counter must not be inferred as a refillable resource`,
    );
}

const arbitraryPrevious = {
    stat_data: { 系统: { 计量_当前: 5, 计量_上限: 5 } },
};
const arbitraryCurrent = {
    stat_data: { 系统: { 计量_当前: 5, 计量_上限: 9 } },
};
assert.deepEqual(
    findOpeningResourceMismatches(arbitraryCurrent, { previousData: arbitraryPrevious }),
    [],
    'unknown full/current pairs require explicit initvar evidence instead of name-free inference',
);

const continued = {
    stat_data: {
        resources: {
            mana_current: 120,
            mana_max: 140,
        },
    },
};
assert.equal(
    findOpeningResourceMismatches(continued, {
        lastSynced: {
            '/resources/mana_current': { maximum: 120 },
        },
    })[0].to,
    140,
    'A multi-step character creator may raise the cap again during the opening window',
);

console.log('opening-resource-sync tests passed');
