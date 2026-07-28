import assert from 'node:assert/strict';
import test from 'node:test';

import {
    extractSchemaScripts,
    extractLastUpdateBlock,
    replaceUpdateBlocks,
} from '../core.mjs';

test('replaces every complete UpdateVariable block with one canonical block', () => {
    const first = '<UpdateVariable><Analysis>旧一</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
    const second = '<UpdateVariable><Analysis>旧二</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
    const replacement = '<UpdateVariable><Analysis>新</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
    const result = replaceUpdateBlocks(
        `<content>正文</content>\n${first}\n<options>选项</options>\n${second}`,
        replacement,
    );
    assert.equal((result.match(/<UpdateVariable\b/giu) || []).length, 1);
    assert.equal(extractLastUpdateBlock(result), replacement);
    assert.match(result, /<content>正文<\/content>/u);
    assert.match(result, /<options>选项<\/options>/u);
    assert.doesNotMatch(result, /旧一|旧二/u);
});

test('reads MVU schema scripts from standard and legacy TavernHelper containers', () => {
    const schema = 'export const Schema = { value: "number" };';
    const standard = extractSchemaScripts({
        data: {
            extensions: {
                tavern_helper: {
                    scripts: [{ name: '变量结构', content: schema }],
                },
            },
        },
    });
    assert.deepEqual(standard, [{ name: '变量结构', content: schema }]);

    const legacy = extractSchemaScripts({
        extensions: {
            TavernHelper: {
                script: {
                    scripts: [{
                        scripts: [{
                            displayName: 'MVU schema',
                            code: schema,
                        }],
                    }],
                },
            },
        },
    });
    assert.deepEqual(legacy, [{ name: 'MVU schema', content: schema }]);
});

test('appends one UpdateVariable block when the reply has none', () => {
    const replacement = '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>';
    const result = replaceUpdateBlocks('<content>正文</content>', replacement);
    assert.equal((result.match(/<UpdateVariable\b/giu) || []).length, 1);
    assert.equal(extractLastUpdateBlock(result), replacement);
});
