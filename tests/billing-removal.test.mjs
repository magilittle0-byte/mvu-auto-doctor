import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const productionFiles = [
    'index.js',
    'v2/runtime/index.mjs',
    'v2/runtime/index.d.mts',
    'v2/surface/diagnostics.mjs',
    'qc/real-env-qc.mjs',
    'qc/july29-real-model.mjs',
];

test('production runtime contains no billing ledger, price estimate, reminder, or cost stop', async () => {
    const source = (await Promise.all(productionFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    const forbidden = [
        /socialMonthly/iu,
        /monthlyCost/iu,
        /costReceipt/iu,
        /baselineIncomplete/iu,
        /softCny|hardCny|usage\.cny/iu,
        /estimateSocialUsageCost/iu,
        /人民币|美元|费用账本|计费上限|费用停用/iu,
    ];
    for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern);
    }
});

test('diagnostics accept provider usage only and expose no monetary projection', async () => {
    const source = await readFile('index.js', 'utf8');
    assert.match(source, /normalizedProviderUsage\(providerUsage\)/u);
    assert.match(source, /inputTokens/u);
    assert.match(source, /outputTokens/u);
    assert.match(source, /cacheHitTokens/u);
    assert.match(source, /cacheMissTokens/u);
    assert.doesNotMatch(source, /estimated(?:Input|Output)?Tokens|estimateTokens|charactersPerToken|charsPerToken/iu);
});

test('release gate requires provider usage without legacy billing audit fields', async () => {
    const source = await readFile('qc/real-env-qc.mjs', 'utf8');
    assert.match(source, /providerUsageOnly/u);
    assert.doesNotMatch(
        source,
        /characterTokenEstimateCount|monetaryFieldsRecorded|legacyBillingSettingsPreservedUnused/u,
    );
});
