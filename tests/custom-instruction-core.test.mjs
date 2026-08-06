import assert from 'node:assert/strict';
import test from 'node:test';

import {
    composeScopedModelInstruction,
    customInstructionDiagnosticProjection,
    GLOBAL_INSTRUCTION_SCOPES,
    normalizeGlobalInstructionConfig,
} from '../custom-instruction-core.mjs';

test('global instruction is injected verbatim into every selected module and channel scope', () => {
    const canary = '保留  两个空格\n以及原始换行，不替我审核或改写。';
    const config = normalizeGlobalInstructionConfig({
        enabled: true,
        text: canary,
        scopes: ['profile', 'actor', 'world', 'forum', 'social', 'strict'],
    });
    for (const module of ['profile', 'actor', 'world', 'forum', 'social']) {
        const built = composeScopedModelInstruction(config, { module, channel: 'fast' });
        assert.equal(built.globalInjected, true, module);
        assert.equal(built.text.includes(canary), true, module);
    }
    const strict = composeScopedModelInstruction(config, { module: 'variable', channel: 'strict' });
    assert.equal(strict.globalInjected, true);
    assert.equal(strict.text.includes(canary), true);
});

test('unselected scope receives no global instruction while module instruction remains independent', () => {
    const built = composeScopedModelInstruction({
        enabled: true,
        text: 'GLOBAL-CANARY',
        scopes: ['profile'],
    }, {
        module: 'world',
        channel: 'fast',
        moduleInstruction: 'WORLD-ONLY',
    });
    assert.equal(built.globalInjected, false);
    assert.equal(built.text.includes('GLOBAL-CANARY'), false);
    assert.equal(built.text.includes('WORLD-ONLY'), true);
});

test('diagnostics retain only enabled scope length hash and injection booleans', () => {
    const secretInstruction = 'PRIVATE-INSTRUCTION-CANARY';
    const projection = customInstructionDiagnosticProjection({
        enabled: true,
        text: secretInstruction,
        scopes: ['all'],
    }, [{ module: 'world', channel: 'fast', injected: true }]);
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes(secretInstruction), false);
    assert.equal(projection.enabled, true);
    assert.equal(projection.length, secretInstruction.length);
    assert.equal(projection.records[0].injected, true);
});

test('scope catalogue covers every supported model module and both channels', () => {
    assert.deepEqual(
        GLOBAL_INSTRUCTION_SCOPES,
        ['profile', 'physiology', 'actor', 'world', 'forum', 'social', 'variable', 'strict', 'fast', 'all'],
    );
});
