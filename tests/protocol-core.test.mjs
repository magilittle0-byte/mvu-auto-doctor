import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyHardContractCorrection,
    auditCorrectionAgencyGuard,
    auditEquipmentContracts,
    auditHardContracts,
    auditInventoryContracts,
    auditReplyProtocol,
    auditSkillResourceCosts,
    countHanCharacters,
    extractHardContractCorrection,
    verifyHardContractEvidence,
} from '../protocol-core.mjs';

const fourOptions = `<options>
>选项一：[行动一]
>选项二：[行动二]
>选项三：[行动三]
>选项四：[行动四]
</options>`;

test('counts Han characters without counting markup', () => {
    assert.equal(countHanCharacters('<b>甲乙</b>abc丙'), 3);
});

test('accepts a reply that satisfies deterministic length and option contracts', () => {
    const body = '甲'.repeat(1800);
    const result = auditReplyProtocol(
        `【预算】正文1800~2800汉字；结尾四项候选✓。
<content>${body}</content>
${fourOptions}`,
    );
    assert.deepEqual(result.issues, []);
    assert.equal(result.metrics.hanCharacters, 1800);
    assert.equal(result.metrics.actualOptions, 4);
});

test('treats the right-side length value as a writing target rather than a hard ceiling', () => {
    const result = auditReplyProtocol(
        `<content>${'甲'.repeat(4600)}</content>`,
        { contractTexts: ['正文3000~4000汉字'] },
    );
    assert.ok(!result.issues.some((issue) => issue.code === 'content-over-budget'));
    assert.equal(result.metrics.budget.min, 3000);
    assert.equal(result.metrics.budget.max, 4000);
});

test('prefers the latest active-preset length contract over older card/world-book ranges', () => {
    const result = auditReplyProtocol(`<content>${'甲'.repeat(2500)}</content>`, {
        contractTexts: [
            '旧世界书：正文1800~2800汉字',
            '当前预设：正文3000~4000汉字',
        ],
    });
    assert.equal(result.metrics.budget.min, 3000);
    assert.ok(result.issues.some((issue) => issue.code === 'content-under-budget'));
});

test('reports only hard violations and does not judge extra GM rewards', () => {
    const body = `保险箱里除了任务款，还有一件帮派头目私藏的装备。${'甲'.repeat(120)}`;
    const result = auditReplyProtocol(
        `【预算】正文1800~2800汉字；结尾四项候选✓。
<content>${body}</content>
<options>
>选项一：[行动一]
>选项二：[行动二]
</options>`,
    );
    assert.ok(result.issues.some((issue) => issue.code === 'content-under-budget'));
    assert.ok(result.issues.some((issue) => issue.code === 'option-count'));
    assert.ok(!result.issues.some((issue) => /奖励|战利品|私藏/u.test(issue.message)));
});

test('reports fabricated dice outcomes, self-contradictory rerolls and scene time drift', () => {
    const result = auditReplyProtocol(
        `【骰后锁】
第一次洗脑成功。后续洗脑过程省略，结果设定为成功。
重来重来，重新投掷一次。
【S1·出门】双掷× 补判×
【A·S0】时间地点=第2天 11:28，办公室
<content>${'甲'.repeat(20)}</content>`,
        {
            previousUserText: '<scene>Day：2,11:32 星期二 | 地点：办公室</scene>',
        },
    );
    assert.ok(result.issues.some((issue) => issue.code === 'fabricated-dice-outcome'));
    assert.ok(result.issues.some((issue) => issue.code === 'dice-lock-self-contradiction'));
    assert.ok(result.issues.some((issue) => issue.code === 'scene-time-mismatch'));
});

test('detects scene-time drift from the compact V5 A-boundary line', () => {
    const result = auditReplyProtocol(
        `【A·边界】本轮玩家明确要做/说的A=观察；没有授权的下一步=无；S0时间/地点/资源/任务/敌人/关系=第2天 11:28/办公室/MP80/无/无/中立；本轮权威规则、奖励与路径=世界书。
<content>你继续观察。</content>`,
        {
            previousUserText: '<scene>Day：2,11:32 星期二 | 地点：办公室</scene>',
        },
    );
    assert.equal(result.metrics.s0Time, '11:28');
    assert.ok(result.issues.some((issue) => issue.code === 'scene-time-mismatch'));
});

test('reports the current schema-level equipment slot gap and ambiguous backpack weapons', () => {
    const stat = {
        契约者: {
            装备: {
                头部: {
                    名称: '战术护目镜',
                    类型: '防具',
                    品质: '白色',
                },
                主手: {
                    名称: '格洛克17',
                    类型: '手枪',
                    品质: '白色',
                },
            },
            背包: {
                制式砍刀: { 描述: '一把普通砍刀。', 数量: 1 },
                廉价自制手枪: { 描述: '容易走火的破烂武器。', 数量: 1 },
                医疗包: { 描述: '恢复生命。', 数量: 1 },
            },
        },
    };
    const result = auditEquipmentContracts(stat, {
        schemaTexts: ['装备槽Schema={名称, 类型, 品质, 伤害骰, 装备防御}'],
        ruleTexts: ['背包中的装备必须保留品质、类型、伤害骰等完整装备字段。'],
    });
    assert.ok(result.issues.some((issue) => issue.code === 'equipment-slot-contract-gap'));
    assert.equal(
        result.issues.filter((issue) => issue.code === 'bag-equipment-unclassified').length,
        2,
    );
    assert.ok(!result.issues.some((issue) => /医疗包/u.test(issue.message)));
});

test('validates declared equipment slots without inventing a correction', () => {
    const stat = {
        角色: {
            装备: {
                头部: {
                    名称: '制式手枪',
                    装备位置: '主手',
                    品质: '白色',
                    类型: '手枪',
                },
            },
        },
    };
    const result = auditEquipmentContracts(stat, {
        schemaTexts: ['装备位置: 头部|主手|副手'],
    });
    assert.ok(result.issues.some((issue) => issue.code === 'equipment-slot-mismatch'));
    assert.ok(!result.issues.some((issue) => issue.code === 'equipment-slot-contract-gap'));
});

test('checks explicit active-skill costs against the actual per-turn resource delta', () => {
    const previous = {
        契约者: {
            衍生属性: { MP_当前: 80, MP_最大: 100 },
            通用技能: {
                基础骇入协议: {
                    类型: '主动',
                    消耗: '20MP',
                },
            },
        },
    };
    const current = structuredClone(previous);
    current.契约者.衍生属性.MP_当前 = 70;
    const result = auditSkillResourceCosts(
        '<content>你使用基础骇入协议，强行接管了门锁。</content>',
        previous,
        current,
    );
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].code, 'skill-resource-cost-missing');
    assert.match(result.issues[0].message, /合计消耗 20 MP/u);

    current.契约者.衍生属性.MP_当前 = 60;
    assert.deepEqual(
        auditSkillResourceCosts(
            '<content>你使用基础骇入协议，强行接管了门锁。</content>',
            previous,
            current,
        ).issues,
        [],
    );
    assert.deepEqual(
        auditSkillResourceCosts(
            '<content>界面提示：你可以使用基础骇入协议。</content>',
            previous,
            previous,
        ).issues,
        [],
        'Merely mentioning an available skill must not spend its resource',
    );
});

test('checks generic backpack object fields without assuming a card-specific item list', () => {
    const result = auditInventoryContracts({
        玩家: {
            背包: {
                完整物品: { 描述: '测试', 数量: 1 },
                缺字段: { 数量: 2 },
                坏数量: { 描述: '测试', 数量: '很多' },
            },
        },
    }, {
        schemaTexts: ['背包物品对象必须包含 描述 与 数量'],
    });
    assert.ok(result.issues.some((issue) => (
        issue.code === 'inventory-item-fields-incomplete'
        && /缺字段/u.test(issue.path)
    )));
    assert.ok(result.issues.some((issue) => (
        issue.code === 'inventory-quantity-invalid'
        && /坏数量/u.test(issue.path)
    )));
});

test('splices a hard-contract correction without touching planning or MVU blocks', () => {
    const original = `<thinking>锁定行动A与骰面7。</thinking>
<content>你扣下扳机，子弹击中墙边的敌人。</content>
<UpdateVariable><Analysis>原更新</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>`;
    const parsed = extractHardContractCorrection(`<HardContractCorrection>
<Reason>正文低于硬下限，仅补足既有行动过程。</Reason>
<Evidence>正文100~200汉字</Evidence>
<CorrectedContent>你扣下扳机，子弹击中墙边的敌人。敌人被冲击压低身体，碎屑沿墙面落下。</CorrectedContent>
<CorrectedOptions>>选项一：[保持警戒]
>选项二：[观察敌人]
>选项三：[等待回应]
>选项四：[结束回合]</CorrectedOptions>
</HardContractCorrection>`);
    const applied = applyHardContractCorrection(original, parsed);
    assert.equal(applied.error, undefined);
    assert.match(applied.text, /<thinking>锁定行动A与骰面7。<\/thinking>/u);
    assert.match(applied.text, /敌人被冲击压低身体/u);
    assert.match(applied.text, /<options>[\s\S]*选项四/u);
    assert.match(applied.text, /<UpdateVariable><Analysis>原更新/u);
    assert.equal(parsed.evidence, '正文100~200汉字');
    assert.equal(
        verifyHardContractEvidence(parsed.evidence, ['【预算】正文100~200汉字；结尾四项候选。']).ok,
        true,
    );
    assert.equal(
        verifyHardContractEvidence('掉落数量固定为三件', ['掉落数量按敌人等级计算']).ok,
        false,
    );
});

test('agency guard allows NPC/environment expansion but rejects new player B/C actions', () => {
    const original = '<content>你扣下扳机，子弹击中门边的敌人。</content>';
    const allowed = '<content>你扣下扳机，子弹击中门边的敌人。敌人踉跄着呼叫同伴，警报灯映红走廊，远处脚步声开始逼近。</content>';
    assert.equal(auditCorrectionAgencyGuard(original, allowed).ok, true);

    const addedRoute = '<content>你扣下扳机，子弹击中门边的敌人。随后你决定进入东侧走廊，并使用基础骇入协议打开门锁。</content>';
    const blocked = auditCorrectionAgencyGuard(original, addedRoute, {
        skillNames: ['基础骇入协议'],
    });
    assert.equal(blocked.ok, false);
    assert.ok(blocked.violations.some((item) => item.code === 'new-player-agency-clause'));
    assert.ok(blocked.violations.some((item) => item.code === 'new-player-skill'));

    const addedDialogue = '<content>你扣下扳机，子弹击中门边的敌人。你喊：“所有人跟我走！”</content>';
    assert.equal(auditCorrectionAgencyGuard(original, addedDialogue).ok, false);
});

test('combines reply and equipment findings into one read-only audit', () => {
    const result = auditHardContracts({
        replyText: '<content>短正文</content>',
        contractTexts: ['正文100~200汉字'],
        statData: {
            玩家: {
                装备: {
                    主手: { 名称: '短剑', 类型: '武器', 品质: '白色' },
                },
            },
        },
        schemaTexts: ['装备={主手:装备对象}'],
    });
    assert.ok(result.issues.some((issue) => issue.code === 'content-under-budget'));
    assert.ok(result.issues.some((issue) => issue.code === 'equipment-slot-contract-gap'));
});
