import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CHARACTER_DIVERSITY_CONTRACT,
    GLOBAL_FAIR_DIRECTOR_GATE,
    NARRATIVE_SURFACE_CONTRACT,
    SERENDIPITY_DOUBLE_GATE,
    transformCharacterDiversityPreset,
    transformFairDirectorPreset,
    transformSerendipityFairDirectorPreset,
} from '../fair-director-preset-core.mjs';

const ids = [
    ['520e0405-8a69-4e68-af98-2174d075f516', '<NPC_Soft_Hard_Action_Amendment_V1>old</NPC_Soft_Hard_Action_Amendment_V1>'],
    ['869bf19b-7764-4c01-8370-155f62ea5be4', 'old advance'],
    ['3ad6a624-d98f-4f18-a821-a2bd7258899b', '<External_Dice_Arbitration>old</External_Dice_Arbitration><Stitches_Compatibility>old</Stitches_Compatibility><Director_Draft_And_Information_Firewall_Amendment_V2>old</Director_Draft_And_Information_Firewall_Amendment_V2>'],
    ['c27a5e1b-5acc-43a7-8e71-9c4441490df9', 'old gate'],
    ['dad86601-1688-471b-96d9-e252d1624bbb', '<Parallel_Event_Lifecycle>连续2—4个有实际时间推进的回合不能毫无变化</Parallel_Event_Lifecycle>'],
    ['d6d69788-6791-4813-98db-6286e43858a3', '<Dice_Source_Stage>old</Dice_Source_Stage><Dice_First_Causal_Order_V3>old</Dice_First_Causal_Order_V3><Stitches_Transaction_Stage>old</Stitches_Transaction_Stage><External_Director_Time_Reconciliation_V2>old</External_Director_Time_Reconciliation_V2><Causal_Persistence_And_Clock_Stage_V1>old</Causal_Persistence_And_Clock_Stage_V1>'],
    ['d8e4b241-be25-4009-9b37-f5a90a4c7427', '<Final_Fair_Director_Gate_V1>old</Final_Fair_Director_Gate_V1><Final_Dice_Gate>old</Final_Dice_Gate>'],
    ['9c077696-71c7-4469-9fad-1f3e241497a7', '<Final_Causal_Persistence_Check_V1>old</Final_Causal_Persistence_Check_V1>'],
    ['55c128dd-54d4-4028-ac30-96fd40452f93', 'old dice'],
    ['c925621e-88b9-4a8a-b320-b3f422e3b18f', '【S1·出门】时间/地点/资源/任务/奖励/敌人/关系Δ与真实路径=；持续成功账=；情报钟/威胁钟及证据=；导演事实化× NPC越知× 风味惩罚× 免费反制× 越权× 双掷× 补判× 漏奖× 数据库未来污染× 短正文×；结尾四项候选✓。'],
];

function fixture() {
    return {
        name: '公平导演改良副本',
        prompts: ids.map(([identifier, content], index) => ({
            identifier,
            name: `prompt-${index}`,
            content,
            enabled: true,
        })),
        prompt_order: [{
            character_id: 100001,
            order: ids.map(([identifier]) => ({ identifier, enabled: true })),
        }],
    };
}

test('global gate preserves long-form agency while adding aggregate pressure and dice semantics', () => {
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /3000～4000字/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /一名NPC每轮只能行动一次/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /阶段总上限/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /恢复债务/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /最低可玩性/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /D4\/D40改成D2\/D5/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /成就、图鉴、未来目标/u);
    assert.match(GLOBAL_FAIR_DIRECTOR_GATE, /组队、接受、回答、移动、消费/u);
});

test('serendipity copy adds no-premonition classification and two independent safeguards', () => {
    const source = fixture();
    const before = structuredClone(source);
    const { preset, audit } = transformSerendipityFairDirectorPreset(source);
    assert.deepEqual(source, before, 'source preset must not be overwritten');
    assert.match(preset.name, /偶发性双保险版$/u);
    assert.equal(audit.serendipityDoubleGate, true);
    const gate = preset.prompts.find((item) => (
        item.identifier === 'c27a5e1b-5acc-43a7-8e71-9c4441490df9'
    ));
    assert.match(gate.content, /“没有前兆”不等于禁止发生/u);
    assert.match(gate.content, /第一保险：许可证与预算/u);
    assert.match(gate.content, /第二保险：最终正文复核/u);
    assert.match(gate.content, /3000～4000字/u);
    assert.match(gate.content, /NPC自主性/u);
    assert.match(gate.content, /风味调侃无机械惩罚/u);
    assert.match(SERENDIPITY_DOUBLE_GATE, /高权限身份卡/u);
});

test('transform keeps prompt order and enabled chain synchronized while deduplicating authority', () => {
    const source = fixture();
    const before = structuredClone(source);
    const { preset, audit } = transformFairDirectorPreset(source);
    assert.deepEqual(source, before, 'source object must stay untouched');
    assert.equal(preset.prompts.length, before.prompts.length);
    assert.equal(preset.prompt_order[0].order.length, before.prompt_order[0].order.length);
    assert.equal(audit.enabledCount, ids.length);
    assert.equal(audit.globalGateOrderIndex, 3);
    assert.match(preset.name, /全局节奏闭环版$/u);
    const gate = preset.prompts.find((item) => (
        item.identifier === 'c27a5e1b-5acc-43a7-8e71-9c4441490df9'
    ));
    assert.equal(gate.content, GLOBAL_FAIR_DIRECTOR_GATE);
    const authority = preset.prompts.find((item) => (
        item.identifier === '3ad6a624-d98f-4f18-a821-a2bd7258899b'
    ));
    assert.doesNotMatch(authority.content, /<Stitches_Compatibility>/u);
    assert.match(authority.content, /Fair_Director_Authority_Reference_V2/u);
    const dice = preset.prompts.find((item) => (
        item.identifier === '55c128dd-54d4-4028-ac30-96fd40452f93'
    ));
    assert.match(dice.content, /每回合先读取当前角色卡声明/u);
    assert.match(dice.content, /短收据/u);
});

test('character kaleidoscope adds an enabled diversity contract and lightweight story renderer', () => {
    const source = fixture();
    source.extensions = {
        baibaiToolkit: {
            regexGroups: {
                scripts: {},
            },
        },
        regex_scripts: [],
    };
    const before = structuredClone(source);
    const { preset, audit } = transformCharacterDiversityPreset(source);
    assert.deepEqual(source, before, 'source preset must stay untouched');
    assert.match(preset.name, /人物万花筒版$/u);
    assert.equal(audit.transformVersion, '2.2-dynamic-character-evidence');
    assert.equal(audit.storyRegexIds.length, 6);
    const diversity = preset.prompts.find((item) => (
        item.identifier === audit.characterDiversityIdentifier
    ));
    assert.equal(diversity.content, CHARACTER_DIVERSITY_CONTRACT);
    assert.match(diversity.content, /强烈情绪是当前状态层，不是身份层/u);
    assert.match(diversity.content, /删掉姓名后/u);
    assert.match(diversity.content, /不运行或输出MBTI、九型人格、Tritype、依恋类型/u);
    assert.match(diversity.content, /信息取样偏好与典型误读/u);
    assert.match(diversity.content, /受压反应→恢复路径/u);
    assert.match(diversity.content, /习得的逆倾向能力/u);
    assert.match(diversity.content, /首次有效出场只在正文显露最多三项差异/u);
    assert.match(diversity.content, /逐人核对，不遗漏安静角色/u);
    assert.match(diversity.content, /把职业和类型标签也删掉后/u);
    const surface = preset.prompts.find((item) => (
        item.identifier === audit.narrativeSurfaceIdentifier
    ));
    assert.equal(surface.content, NARRATIVE_SURFACE_CONTRACT);
    assert.match(surface.content, /<story_body>/u);
    assert.match(surface.content, /<chat_right>/u);
    const order = preset.prompt_order[0].order;
    assert.equal(order.find((item) => item.identifier === diversity.identifier)?.enabled, true);
    assert.equal(order.find((item) => item.identifier === surface.identifier)?.enabled, true);
    const scripts = preset.extensions.regex_scripts;
    assert.equal(scripts.length, 6);
    assert.equal(scripts.every((item) => item.disabled === false), true);
    assert.equal(scripts.some((item) => /历史只发纯文本/u.test(item.scriptName)), true);
    assert.equal(scripts.some((item) => /聊天右气泡/u.test(item.scriptName)), true);
});
