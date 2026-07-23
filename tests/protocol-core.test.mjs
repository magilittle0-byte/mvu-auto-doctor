import assert from 'node:assert/strict';
import test from 'node:test';

import {
    auditEquipmentContracts,
    auditHardContracts,
    auditReplyProtocol,
    countHanCharacters,
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
