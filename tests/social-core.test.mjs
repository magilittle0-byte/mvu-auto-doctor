import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildSocialNarrativeContract,
    buildSocialRollbackOps,
    classifySocialAuditNeed,
    collectRelationshipChanges,
    parseSocialAuditOutput,
    sanitizeClosedProposalMessages,
    stripClosedProposals,
} from '../social-core.mjs';

test('social narrative contract preserves explicit dark content and blocks invented motives', () => {
    const contract = buildSocialNarrativeContract();
    assert.match(contract, /不得由旁白补写/u);
    assert.match(contract, /NPC的怀疑不是全知事实/u);
    assert.match(contract, /强制状态必须分开/u);
    assert.match(contract, /不是洗白/u);
    assert.match(contract, /不要先复述上一轮正文/u);
});

test('closed option proposals are removed only from assistant prompt messages', () => {
    const source = '正文事实。<options>一、控制她\n二、继续任务</options><branches>候选A</branches>';
    assert.equal(stripClosedProposals(source), '正文事实。');
    const messages = [
        { role: 'system', content: '<options>这是格式说明</options>' },
        { role: 'assistant', content: source },
        { role: 'user', content: '我选择继续任务' },
    ];
    assert.equal(sanitizeClosedProposalMessages(messages), 1);
    assert.match(messages[0].content, /格式说明/u);
    assert.equal(messages[1].content, '正文事实。');
    assert.match(messages[2].content, /继续任务/u);
});

test('relationship changes preserve raw before and after values', () => {
    const result = collectRelationshipChanges(
        { 角色: { 大卫: { 好感度: 5, 关系: '同行者', HP: 10 } } },
        { 角色: { 大卫: { 好感度: 40, 关系: '狂热信徒', HP: 3 } } },
    );
    assert.deepEqual(result.changes.map((item) => item.path), [
        '/角色/大卫/好感度',
        '/角色/大卫/关系',
    ]);
    assert.equal(result.changes[0].before, 5);
    assert.equal(result.changes[0].after, 40);
});

test('balanced routing reviews ordinary care interpreted as domination', () => {
    const routed = classifySocialAuditNeed({
        userText: '我给她带一份晚饭，问她要不要一起吃。',
        replyText: '她意识到你真正的目的在于饲养和控制她，陷入绝望。',
        changes: [],
        mode: 'balanced',
    });
    assert.equal(routed.needed, true);
    assert.ok(routed.reasons.includes('player-motive-attribution'));
    assert.ok(routed.reasons.includes('ordinary-care-extreme-interpretation'));
});

test('explicit dark action remains reviewable rather than locally erased', () => {
    const routed = classifySocialAuditNeed({
        userText: '我明确发动精神控制，命令他服从。',
        replyText: '精神控制生效，他被迫服从。',
        changes: [{ path: '/角色/大卫/被控制', before: false, after: true }],
        mode: 'balanced',
    });
    assert.equal(routed.needed, true);
    assert.ok(routed.reasons.includes('coercion-relation-conflict'));
});

test('semantic auditor can only decide known relation paths', () => {
    const changes = [
        {
            path: '/角色/大卫/好感度',
            beforeExists: true,
            afterExists: true,
            before: 5,
            after: 40,
        },
    ];
    const parsed = parseSocialAuditOutput(JSON.stringify({
        verdict: 'violation',
        summary: '被迫服从被误写成自愿好感。',
        findings: [{
            type: 'coercion_conflation',
            severity: 'error',
            reason: '正文只有强制命令。',
            evidence: '被迫服从',
        }],
        decisions: [
            { path: '/角色/大卫/好感度', action: 'revert', reason: '无自愿证据' },
            { path: '/角色/大卫/金币', action: 'revert', reason: '越权路径' },
        ],
    }), changes);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.decisions.length, 1);
    assert.equal(parsed.decisions[0].path, '/角色/大卫/好感度');
    assert.deepEqual(buildSocialRollbackOps(changes, parsed.decisions), [
        { op: 'replace', path: '/角色/大卫/好感度', value: 5 },
    ]);
});

test('auditor may allow traceable dark relationship changes', () => {
    const changes = [{
        path: '/角色/大卫/恐惧',
        beforeExists: true,
        afterExists: true,
        before: 10,
        after: 25,
    }];
    const parsed = parseSocialAuditOutput(JSON.stringify({
        verdict: 'pass',
        summary: '玩家明确威胁且检定成功。',
        findings: [{ type: 'valid_dark_content', severity: 'info' }],
        decisions: [{ path: '/角色/大卫/恐惧', action: 'allow', reason: '明确威胁证据' }],
    }), changes);
    assert.deepEqual(buildSocialRollbackOps(changes, parsed.decisions), []);
});
