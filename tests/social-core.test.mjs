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
    assert.match(contract, /职业、阵营与本轮情绪不是完整人格/u);
    assert.match(contract, /删掉姓名后/u);
    assert.match(contract, /不使用MBTI、九型、Tritype、依恋型/u);
    assert.match(contract, /信息取样与典型误读/u);
    assert.match(contract, /首次出场正文最多显露三项人物差异/u);
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

test('balanced routing flags identity totalization and piles of generic extreme labels', () => {
    const routed = classifySocialAuditNeed({
        userText: '我问她接下来打算怎么做。',
        replyText: '她不再是那个调查员，而是一件致命武器。冰冷、冷酷、暴戾、疯狂的杀意覆盖了全部人格。',
        changes: [],
        mode: 'balanced',
    });
    assert.equal(routed.needed, true);
    assert.ok(routed.reasons.includes('identity-totalization'));
    assert.ok(routed.reasons.includes('stereotype-label-pileup'));
});

test('balanced routing reviews psychology labels used as characterization shortcuts', () => {
    const routed = classifySocialAuditNeed({
        userText: '我问她如何判断这条消息。',
        replyText: '她是典型INTJ和5w4回避型依恋，所以天然不信任何人。',
        changes: [],
        mode: 'balanced',
    });
    assert.equal(routed.needed, true);
    assert.ok(routed.reasons.includes('typology-shortcut'));
});

test('balanced routing reviews uniform group reactions without banning valid dark scenes', () => {
    const routed = classifySocialAuditNeed({
        userText: '我推开会议室的门。',
        replyText: '所有人都同时沉默，齐齐露出冷酷的神情。',
        changes: [],
        mode: 'balanced',
    });
    assert.equal(routed.needed, true);
    assert.ok(routed.reasons.includes('group-reaction-homogenization'));
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

test('social audit repairs punctuation locally without changing semantic fields', () => {
    const changes = [{
        path: '/characters/Mia/trust',
        beforeExists: true,
        afterExists: true,
        before: 5,
        after: 40,
    }];
    const parsed = parseSocialAuditOutput(
        '{"verdict":"violation" "summary":"unsupported","findings":[],"decisions":[{"path":"/characters/Mia/trust","action":"revert","reason":"no evidence",},],}',
        changes,
    );
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.repaired, true);
    assert.deepEqual(
        [...parsed.repairKinds].sort(),
        ['insert-missing-comma', 'remove-trailing-comma'].sort(),
    );
    assert.deepEqual(parsed.decisions, [{
        path: '/characters/Mia/trust',
        action: 'revert',
        reason: 'no evidence',
        evidence: '',
    }]);
});

test('social audit never invents missing semantics for truncated JSON', () => {
    const parsed = parseSocialAuditOutput(
        '{"verdict":"pass","decisions":[{"path":"/characters/Mia/trust"',
        [{ path: '/characters/Mia/trust' }],
    );
    assert.equal(parsed.error, '社会语义二审没有返回合法 JSON 对象');
    assert.equal(parsed.localRepairAttempted, true);
});
