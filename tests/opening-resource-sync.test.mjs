import assert from 'node:assert/strict';
import {
    findOpeningResourceMismatches,
    parseInitializationText,
    preparePatch,
    restoreTouchedPaths,
    simulateOps,
    validatePatchResult,
} from '../core.mjs';

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
