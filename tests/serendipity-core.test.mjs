import assert from 'node:assert/strict';
import test from 'node:test';
import {
    bindAndSettleSerendipityLicense,
    drawSerendipityLicense,
    emptySerendipityLedger,
    serendipityLicensePrompt,
} from '../serendipity-core.mjs';

const baseTarget = Object.freeze({
    chatId: 'chat-serendipity',
    messageId: 'message-9',
    swipeId: 0,
    generation: 9,
    generationId: 'generation-9',
    branchId: 'branch-main',
    contentFingerprint: 'content-9',
});

function draw(overrides = {}) {
    return drawSerendipityLicense({
        ledger: emptySerendipityLedger(baseTarget.chatId),
        settings: {
            frequency: 'extreme',
            maxAmplitude: 'extreme',
            bias: 'balanced-lucky',
            explanationSpeed: 'natural',
        },
        chatId: baseTarget.chatId,
        objectKey: '旧垃圾堆',
        worldStateDigest: 'world-1',
        sourceState: 'unknown',
        constraints: { minimumPlayability: true },
        pressure: { cap: 3, used: 0, recoveryDebt: 0 },
        target: baseTarget,
        entropy: 'default-entropy',
        now: 100,
        ...overrides,
    });
}

function findLicense(predicate, overrides = {}) {
    for (let index = 0; index < 100000; index += 1) {
        const result = draw({ entropy: `entropy-${index}`, ...overrides });
        if (predicate(result.license)) return result;
    }
    throw new Error('deterministic license sample not found');
}

test('blank unexplained junk pile can receive an extremely rare real jackpot license', () => {
    const result = findLicense((license) => (
        license.triggered
        && license.direction === 'favorable'
        && license.magnitude === 'extreme'
    ));
    assert.equal(result.status, 'drawn');
    assert.equal(result.license.sourceState, 'unknown');
    assert.equal(result.license.actualBenefitRequired, true);
    assert.match(serendipityLicensePrompt(result.license), /顶级武器、高权限身份卡/u);
});

test('explicitly empty or contradictory object rejects the draw without treating unknown as contradiction', () => {
    const unknown = draw({ constraints: { minimumPlayability: true } });
    assert.notEqual(unknown.status, 'rejected');
    const empty = draw({ constraints: { explicitEmpty: true, minimumPlayability: true } });
    assert.equal(empty.status, 'rejected');
    assert.equal(empty.license.triggered, false);
    assert.equal(empty.license.decision, 'rejected-explicit-contradiction');
});

test('same object and world state draw only once despite rephrased searching', () => {
    const first = draw({ objectKey: '搜索这个旧垃圾堆' });
    const settled = bindAndSettleSerendipityLicense(
        first.ledger,
        first.license,
        baseTarget,
        { now: 200 },
    );
    assert.equal(settled.status, 'settled');
    const repeated = draw({
        ledger: settled.ledger,
        objectKey: '再仔细翻翻垃圾堆里面',
        entropy: 'different-entropy',
    });
    assert.equal(repeated.status, 'duplicate');
    assert.equal(repeated.license.licenseId, settled.license.licenseId);
});

test('favorable license forbids automatic punishment and never consumes threat pressure', () => {
    const result = findLicense((license) => license.triggered && license.direction === 'favorable');
    assert.equal(result.license.pressureCost, 0);
    assert.equal(result.license.antiBalancePunishment, false);
    const prompt = serendipityLicensePrompt(result.license);
    assert.match(prompt, /不得自动追加假货、诱饵、诅咒、立即追兵、突然损坏或更强首领/u);
    assert.match(prompt, /不得替玩家拾取、装备、接受或使用/u);
});

test('major adverse license reserves a response window', () => {
    const result = findLicense((license) => (
        license.triggered
        && license.direction === 'adverse'
        && ['rare', 'extreme'].includes(license.magnitude)
    ), { settings: {
        frequency: 'extreme',
        maxAmplitude: 'extreme',
        bias: 'harsh',
        explanationSpeed: 'natural',
    } });
    assert.equal(result.license.responseWindowRequired, true);
    assert.match(serendipityLicensePrompt(result.license), /响应窗口/u);
});

test('unknown source stays unknown and does not receive an invented reveal', () => {
    const result = findLicense((license) => license.triggered, { sourceState: 'unknown' });
    assert.equal(result.license.sourceState, 'unknown');
    assert.match(serendipityLicensePrompt(result.license), /不得提前确认身份或成因/u);
});

test('doctor random channel is isolated from card dice semantics', () => {
    const cardDicePool = [40, 4, 18, 2];
    const before = structuredClone(cardDicePool);
    const result = findLicense((license) => license.triggered);
    assert.deepEqual(cardDicePool, before);
    assert.match(serendipityLicensePrompt(result.license), /不得读取、消耗、修改或模拟角色卡骰池/u);
    assert.equal(Object.hasOwn(result.license, 'dice'), false);
});

test('old generation or wrong branch settles as stale with zero ledger write', () => {
    const result = draw();
    const staleGeneration = bindAndSettleSerendipityLicense(result.ledger, result.license, {
        ...baseTarget,
        generation: 10,
        generationId: 'generation-10',
    });
    assert.equal(staleGeneration.status, 'stale');
    assert.equal(staleGeneration.ledger.receipts.length, 0);
    const missingBranch = bindAndSettleSerendipityLicense(result.ledger, result.license, {
        ...baseTarget,
        branchId: '',
    });
    assert.equal(missingBranch.status, 'stale');
    assert.equal(missingBranch.ledger.receipts.length, 0);
});

test('adverse draw obeys doctor pressure cap and becomes a non-harm anomaly', () => {
    const result = findLicense((license) => license.triggered && license.direction === 'neutral'
        && license.decision === 'converted-non-harm-anomaly', {
        settings: {
            frequency: 'extreme',
            maxAmplitude: 'extreme',
            bias: 'harsh',
            explanationSpeed: 'natural',
        },
        pressure: { cap: 1, used: 1, recoveryDebt: 0 },
    });
    assert.equal(result.license.pressureCost, 0);
    assert.equal(result.license.magnitude, 'small');
});

test('license settlement does not rewrite accepted content', () => {
    const content = '<content>玩家看见一只封好的箱子，仍未决定是否打开。</content>';
    const before = String(content);
    const result = draw();
    const settled = bindAndSettleSerendipityLicense(result.ledger, result.license, baseTarget);
    assert.equal(content, before);
    assert.equal(Object.hasOwn(settled.license, 'content'), false);
    assert.match(serendipityLicensePrompt({ ...result.license, triggered: true }), /不得改写、截断或重生成正文/u);
});

test('long sessions throttle clustered easter eggs', () => {
    const seed = findLicense((license) => license.triggered).license;
    const ledger = emptySerendipityLedger(baseTarget.chatId);
    ledger.receipts = Array.from({ length: 12 }, (_, index) => ({
        ...seed,
        licenseId: `history-${index}`,
        opportunityKey: `history-key-${index}`,
        objectKey: `object-${index}`,
        worldStateDigest: `world-${index}`,
        target: { ...baseTarget, generation: index + 1, generationId: `generation-${index + 1}` },
    }));
    const result = draw({
        ledger,
        objectKey: 'new-object',
        worldStateDigest: 'new-world',
    });
    assert.equal(result.license.triggered, false);
    assert.equal(result.license.decision, 'throttled-long-session');
});

test('turning the engine off preserves no-trigger behavior', () => {
    const result = draw({ settings: {
        frequency: 'off',
        maxAmplitude: 'extreme',
        bias: 'balanced-lucky',
        explanationSpeed: 'natural',
    } });
    assert.equal(result.status, 'disabled');
    assert.equal(result.license.triggered, false);
    assert.equal(serendipityLicensePrompt(result.license), '');
});
