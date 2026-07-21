import assert from 'node:assert/strict';
import {
    findOpeningResourceMismatches,
    parseInitializationText,
} from '../core.mjs';

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
