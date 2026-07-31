import { createHash } from 'node:crypto';

const IDS = Object.freeze({
    lengthAgency: '520e0405-8a69-4e68-af98-2174d075f516',
    advance: '869bf19b-7764-4c01-8370-155f62ea5be4',
    authority: '3ad6a624-d98f-4f18-a821-a2bd7258899b',
    fairGate: 'c27a5e1b-5acc-43a7-8e71-9c4441490df9',
    parallel: 'dad86601-1688-471b-96d9-e252d1624bbb',
    transaction: 'd6d69788-6791-4813-98db-6286e43858a3',
    finalOutput: 'd8e4b241-be25-4009-9b37-f5a90a4c7427',
    finalGate: '9c077696-71c7-4469-9fad-1f3e241497a7',
    dice: '55c128dd-54d4-4028-ac30-96fd40452f93',
    planning: 'c925621e-88b9-4a8a-b320-b3f422e3b18f',
});

export const FAIR_DIRECTOR_PRESET_VERSION = '2.0-global-pressure';
export const SERENDIPITY_FAIR_DIRECTOR_PRESET_VERSION = '2.0-serendipity-double-gate';

function sha256(value) {
    return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function replaceTagged(content, tag, replacement) {
    const pattern = new RegExp(
        `<${tag}>[\\s\\S]*?<\\/${tag}>`,
        'u',
    );
    if (!pattern.test(content)) {
        throw new Error(`missing tagged section: ${tag}`);
    }
    return content.replace(pattern, replacement);
}

function requirePrompt(byId, id) {
    const prompt = byId.get(id);
    if (!prompt) throw new Error(`missing required prompt: ${id}`);
    return prompt;
}

const AUTHORITY_REFERENCE = `<Fair_Director_Authority_Reference_V2>
公平导演、外置草稿、NPC有限认知、软/硬行动、持续成功、全局压力、原作敌人许可和骰池语义，统一服从紧随本条之后的 <Fair_Director_Global_Pressure_Gate_V2>。本条只负责权威顺序、MVU/数据库边界与玩家授权，不另立同义规则。
</Fair_Director_Authority_Reference_V2>`;

const TURN_REFERENCE = `<Fair_Director_Turn_Reference_V2>
阶段C采用导演候选、骰子、压力与持续成功时，不在此重复规则；逐项调用 <Fair_Director_Global_Pressure_Gate_V2>。只有通过总闸的已发生事实才能进入Δ与S1，候选、延迟、远端留存和未传播信息均不得事实化。
</Fair_Director_Turn_Reference_V2>`;

const FINAL_REFERENCE = `<Final_Fair_Director_Gate_V2>
按 <Fair_Director_Global_Pressure_Gate_V2> 做最后短校验：候选未越权；总压力未超预算；恢复债务已偿还或继续延迟；最低可玩性成立；敌人有原作锚点且等级唯一；骰池按本回合声明重置、未越界并有短收据。任一失败则内部重建，不改写角色卡、数据库、医生或已接受正文。
</Final_Fair_Director_Gate_V2>`;

export const GLOBAL_FAIR_DIRECTOR_GATE = `<Fair_Director_Global_Pressure_Gate_V2>
【0. 唯一权威与适用边界】
本段是公平导演的唯一完整总闸；其他提示只引用，不另造同义规则。它补充而不替换当前角色卡正式规则、MVU schema、玩家行动权与3000～4000字正文合同。角色卡、数据库、缝合怪和自动医生都是外部系统：只读其实际注入结果，不修改它们，也不要求它们实现本段私有协议。

【1. 事实、草稿与玩家主权】
1. 本回合事实源只有上一终态S0、Master原始输入、当前角色卡明确规则、已锁骰结果和最终接受的<content>/S1。数据库召回只作不冲突的历史投影。
2. 外部<act>/<scene>/<then>/<file>/<dm_story>/<dm_track>/<npc_track>/<npc_jump>/activeApex/选项/规划全部是候选草稿。最终闸必须拒绝它们覆盖角色卡明确约束，拒绝提前添加队友、敌人、奖励或关键物件，拒绝把未知身份写成已确认，拒绝替玩家作出组队、接受、回答、移动、消费、路线或态度决定。
3. scene只能是执行已授权A后的候选终态，不能倒灌为S0；时间、日期、Day、星期、地点与耗时只结算一次。then与未来方向只有在后续正文实际发生后才成为事实。
4. 玩家只执行Master明确授权的A。结果词不是成功事实；没有授权的B/C/D全部删除。NPC可以把问题推到玩家面前，但必须停在下一次需要玩家决定的位置。

【2. NPC活人感、有限认知与行动校验】
1. NPC只读取自己的认知包：实际感知、已建立旧知、真实通信和规则明确赋予的感知结果。Master隐藏计划、其他角色内心、未传播事实、导演推理与第三方候选不得泄露。
2. 软行动包括自然对白、观察显眼事物、姿态、争执、拒绝、犹豫、短距自然移动、关系回应和无机械收益的自主选择；可按场景自然多次往返，禁止用“一名NPC每轮只能行动一次”冻结活人感。
3. 硬行动包括攻击、控制、夺取、隐藏搜索、精确定位、跨越防守、呼援/增援、备用系统、封锁、持续状态、关键情报、资源/任务/长期关系改变。硬行动必须先作为候选，依次通过身份、有限知识、时间、地点/旅行、资源、能力、权限、因果、前兆、行动经济、正式规则/检定与玩家主权校验，之后才结算。
4. 软行动不得拆成免费硬行动；风味调侃、挑逗、差评、嘲讽和嘴硬默认只有人物、对白与关系反应，不自动提高DC、扣资源、加敌人、加速机关或推进威胁。

【3. 单项合法之后仍要做全局公平审计】
每个反制单独合法，不代表它们合计仍公平。先列出当前同场全部已成立威胁，再计算导演本轮准备新增/注入的压力；不得把连续新增更强敌人当推进或填字。
- 压力点：普通主动威胁=1；精英=2；首领=3；独立致命机关或强制倒计时=1。仅有远端传闻、可调查前兆、资源、关系、恢复和已被牵制的威胁=0。
- 阶段总上限：建立/开局=1，探索=2，发展=3，终局=4，战后/恢复=1。当前角色卡若给出更严格边界，从严；已经写入正文的超额事实不被抹除，但导演新增压力预算立即降为0。
- 同场首领碰撞上限默认1。只有当前原作明确的同场多首领结构和已建立因果能例外；成就、图鉴、未来目标、隐藏结局或“之后会打”都不是当前生成许可。
- 精英实际解决、撤退或脱离后产生至少1个恢复债务；首领后至少2个。恢复债务可由休整、治疗、补给、调查、关系处理、战后清点、路线选择、成功后果落实或威胁互相牵制偿还；债务未清时不得再添主动威胁。
- 最低可玩性：结算后仍须存在至少一种可理解的信息来源，以及至少两种不要求玩家接受同一预设答案的可行应对（例如撤离/规避、调查/交涉、资源/环境利用、正面对抗）。若只剩必死门、唯一答案或无信息猜谜，本轮不准加压。
- 超预算候选依次处理为：延迟；改成已有威胁的前兆/信息；用原作势力、环境、设施或机制替换；让威胁互相牵制；转为远端留存。禁止换名复制、合体升级或再加倒计时绕过预算。

【4. 三种推进同等合法】
行动推进、后果推进、恢复推进都属于剧情推进；安静回合也可以推进。开局与探索期必须给发育、补给、调查、关系和选择空间。已有成功的后果继续生效、NPC误判被修正、势力在幕后改变、环境冷却、资源取舍和战后处理，均可构成完整一拍。

【5. 3000～4000字的合法来源】
正文保持{{getvar::字数要求}}，不靠新怪、新机关、新倒计时、额外玩家行动或无关支线填字。长度来自：A的动作过程与锁定结果；NPC对白、误判、有限认知和彼此互动；关系与立场变化；伤后/战后处理；资源、路线与补给选择；势力与环境幕后变化；已有威胁的可观察前兆；玩家重大成功持续造成的优势与敌方真实损失。到玩家需要作新决定时停下交权。

【6. 重大成功与反制成本】
为重大成功登记对象、能力变化、持续范围、恢复条件和S1/事件证据。敌方已有备用方案只能发挥既定范围；新反制必须重新取得情报、时间、人员、权限、设备或资源，并留下可见前兆。反制只能制造有成本的新问题，不能免费复活被摧毁功能或抹去玩家赢得的盲区、时间差、路线、资源损失和长期优势。

【7. 骰池语义与短审计收据】
1. 严格服从当前角色卡本回合声明的骰种、池长、重置方式与编号。当前角色卡未声明的骰种不可临时创造；不得把D4/D40改成D2/D5，不得“取前N”、截位、取模、重排、跳号或跨回合擅自维持游标。
2. 每回合按角色卡要求重置并从该回合编号开始；序号不得超过池长。已有<meta:检定结果>只复用一次；没有回执才按角色卡取下一枚。缺骰种、缺值、超池或规则不明时停在判定前，不编数。
3. 先锁行动、属性/技能、修正、DC与依据，再锁唯一骰源、骰种、回合编号与池内序号，再读取原始骰面、列完整算式并写唯一结果。剧情只能表现锁定结果。
4. 留下短收据：〔骰审计：回合=；骰池=D；池长=；序号=；原始骰面=；算式=；结果=〕。不把收据写进MVU或数据库专用字段。

【8. 原作锚点与敌人等级许可】
生成或升级敌人前逐项写明当前实际注入的原作锚点、生成许可和唯一等级。普通/精英/首领只能三选一，禁止同一敌人同时多级。成就、图鉴、未来目标、奖励预告和隐藏BOSS条目不构成当前生成许可。无合适原作敌人时，优先使用原作势力、环境、设施、生态与机制；不得为了“场面活起来”造更强新敌。

【9. 数据库、医生与正文边界】
数据库只独立读取最终接受的<content>填表，不读取MVU、不等待医生、不因变量写入重触发。自动医生只校验自己的变量补丁、人物/势力/环境后台候选与注入，不改写、截断或重生成<content>。若正文已经过压，医生只能承认并停止聚合/复制/升级，优先恢复、错开、牵制、信息、资源和退路。论坛、连续性与后台功能不得阻塞正文、数据库或关键变量结算。

【10. 最终审计顺序】
先审事实/授权与scene候选；再审NPC认知和硬行动；再审所有合法威胁合计、阶段预算、首领碰撞、恢复债务和最低可玩性；再审成功持续、原作锚点/唯一等级与骰池短收据；最后审正文长度来源、S1一致性和数据库/医生边界。任一失败，回到S0与骰前锁内部重建；不得靠删短正文、关闭NPC自主性、关闭缝合怪或替玩家行动来过闸。
</Fair_Director_Global_Pressure_Gate_V2>`;

export const SERENDIPITY_DOUBLE_GATE = `<Fair_Director_Serendipity_Double_Gate_V1>
【偶发性合法分类】
先把候选分成三类：A. 与明确事实、角色卡硬约束、原作锚点或玩家主权矛盾，必须拒绝；B. 尚未说明、来源未知或没有前兆，但没有矛盾，可以进入偶发审核；C. 低概率但世界内可能，可以进入偶发审核。“没有前兆”不等于禁止发生，“原因未知”不等于没有原因。偶发性只能突破可预测性，不能突破事实与授权。

【第一保险：许可证与预算】
只有当前完整chat/message/swipe/generation/branch绑定的医生偶发许可证可以提高B/C类候选的采用概率；旧swipe、重生成旧目标、错误分支和迟到许可证一律无效。许可证不读取角色卡骰池，不改变骰子语义。人物、势力、环境三通道同权；有利/中性不计威胁压力，不利必须消耗医生压力预算并服从最低可玩性，重大坏事先给响应窗口，超额则延迟、降级或改为非伤害异常。

【第二保险：最终正文复核】
最终<content>必须再次确认：未知/possible来源没有被提前写成revealed；外部scene/act/then仍只是候选；没有替玩家拾取、装备、接受、使用、移动、回答或选择；好运先真实且持续生效，没有自动变成假货、诱饵、诅咒、立即追兵、突然损坏或更强首领来找平衡。极端幅度允许极低概率出现顶级武器、高权限身份卡等结果，但仍须通过A类矛盾审查。任一保险失败则放弃该偶发候选，不得靠改写医生、数据库、角色卡、骰池或已接受正文补救。

本条只增加“无前兆但不矛盾”的合法入口与双保险，不削弱3000～4000字、NPC自主性、软行动开放、硬行动审核、有限认知、重大成功持续生效、风味调侃无机械惩罚、玩家行动权和全局压力层。
</Fair_Director_Serendipity_Double_Gate_V1>`;

const DICE_REFERENCE = `{{setvar::骰子审计::
严格调用 <Fair_Director_Global_Pressure_Gate_V2> 第7节。每回合先读取当前角色卡声明的骰种、池长、重置和编号；不得跨回合保留游标，不得超过池长，不得把D4/D40改成D2/D5，不得取前N、截位、取模、跳号或挑结果。顺序固定为：骰前行动/属性/技能/修正/DC依据 → 唯一骰源、回合与池内序号 → 原始骰面 → 完整算式 → 本轮锁定结果。缺任一项就停在判定前。
}}
<Dice_Execution_Receipt_V4>
若有检定，在规划中留下且只留一条短收据：〔骰审计：回合=；骰池=D；池长=；序号=；原始骰面=；算式=；结果=〕。已有外部回执只复用一次；无需检定则写可验证的确定性依据。剧情不得先于结果锁规划成败。
</Dice_Execution_Receipt_V4>`;

function replaceIfPresent(content, tag, replacement) {
    return content.includes(`<${tag}>`)
        ? replaceTagged(content, tag, replacement)
        : content;
}

export function transformFairDirectorPreset(input) {
    const preset = structuredClone(input);
    if (!Array.isArray(preset.prompts) || !Array.isArray(preset.prompt_order)) {
        throw new Error('unsupported preset structure');
    }
    const byId = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
    for (const id of Object.values(IDS)) requirePrompt(byId, id);
    const before = new Map(
        preset.prompts.map((prompt) => [
            prompt.identifier,
            {
                name: prompt.name,
                content: String(prompt.content || ''),
            },
        ]),
    );

    const fair = requirePrompt(byId, IDS.fairGate);
    fair.name = '🎬公平导演权威总闸V2（全局压力·恢复债务·原作与骰池）';
    fair.content = GLOBAL_FAIR_DIRECTOR_GATE;

    const authority = requirePrompt(byId, IDS.authority);
    authority.content = replaceIfPresent(
        authority.content,
        'External_Dice_Arbitration',
        AUTHORITY_REFERENCE,
    );
    authority.content = replaceIfPresent(
        authority.content,
        'Stitches_Compatibility',
        '',
    );
    authority.content = replaceIfPresent(
        authority.content,
        'Director_Draft_And_Information_Firewall_Amendment_V2',
        '',
    );

    const lengthAgency = requirePrompt(byId, IDS.lengthAgency);
    lengthAgency.content = replaceIfPresent(
        lengthAgency.content,
        'NPC_Soft_Hard_Action_Amendment_V1',
        `<Fair_Director_Length_Reference_V2>
软/硬行动、NPC有限认知、全局压力与3000～4000字合法来源统一服从 <Fair_Director_Global_Pressure_Gate_V2>；此条只保留正文长度、NPC自主性与玩家A锁，不另立反制规则。
</Fair_Director_Length_Reference_V2>`,
    );

    const advance = requirePrompt(byId, IDS.advance);
    advance.name = '⚡️推进剧情（行动·后果·恢复均合法）';
    advance.content = `{{setvar::tjq::
- 推进统一服从 <Fair_Director_Global_Pressure_Gate_V2>：行动推进、后果推进、恢复推进都合法，安静回合也能推进；不得用连续新增更强敌人代替进展。
- 当前场景内A的过程、锁定结果、NPC回应、关系/资源选择、战后处理、已有成功持续后果、势力与环境变化都可展开；Master只声明A时，A完成或失败后玩家授权立即耗尽。
- NPC、敌人、同伴、势力、环境和既定事件可以依规则自主行动，但只能改变玩家面对的局面，不能替玩家回答、移动、消费、组队或选择路线。
- 只可跳过确实无互动、风险、信息、关系、资源或环境变化的空白时间；不得跳过A的关键过程、恢复债务与直接后果。}}`;

    const parallel = requirePrompt(byId, IDS.parallel);
    parallel.content = parallel.content.replace(
        '<Parallel_Event_Lifecycle>',
        `<Parallel_Event_Lifecycle>
本条的创建、推进、汇流与显现先服从 <Fair_Director_Global_Pressure_Gate_V2>。PE是候选连续性记录，不是新增威胁配额；超预算时应延迟、远端留存、改为前兆/信息或让既有威胁互相牵制。`,
    );
    parallel.content = parallel.content.replace(
        '连续2—4个有实际时间推进的回合不能毫无变化',
        '连续2—4个有实际时间推进的回合应产生行动、后果或恢复中的一种真实变化；安静保留也可登记具体未成熟条件',
    );

    const transaction = requirePrompt(byId, IDS.transaction);
    for (const [index, tag] of [
        'Dice_Source_Stage',
        'Dice_First_Causal_Order_V3',
        'Stitches_Transaction_Stage',
        'External_Director_Time_Reconciliation_V2',
        'Causal_Persistence_And_Clock_Stage_V1',
    ].entries()) {
        transaction.content = replaceIfPresent(
            transaction.content,
            tag,
            index === 0 ? TURN_REFERENCE : '',
        );
    }

    const dice = requirePrompt(byId, IDS.dice);
    dice.name = '🎲骰池语义与短收据V4（每回合重置·不越池）';
    dice.content = DICE_REFERENCE;

    const finalOutput = requirePrompt(byId, IDS.finalOutput);
    finalOutput.content = replaceIfPresent(
        finalOutput.content,
        'Final_Fair_Director_Gate_V1',
        FINAL_REFERENCE,
    );
    finalOutput.content = replaceIfPresent(
        finalOutput.content,
        'Final_Dice_Gate',
        `<Final_Dice_Gate>
骰子最终校验只引用 <Fair_Director_Global_Pressure_Gate_V2> 第7节与唯一〔骰审计〕短收据；不得双掷、跨回合续游标、越池、改骰种或取前N。
</Final_Dice_Gate>`,
    );

    const finalGate = requirePrompt(byId, IDS.finalGate);
    finalGate.content = replaceIfPresent(
        finalGate.content,
        'Final_Causal_Persistence_Check_V1',
        FINAL_REFERENCE,
    );

    const planning = requirePrompt(byId, IDS.planning);
    planning.content = planning.content.replace(
        '【S1·出门】时间/地点/资源/任务/奖励/敌人/关系Δ与真实路径=；持续成功账=；情报钟/威胁钟及证据=；导演事实化× NPC越知× 风味惩罚× 免费反制× 越权× 双掷× 补判× 漏奖× 数据库未来污染× 短正文×；结尾四项候选✓。',
        '【S1·出门】时间/地点/资源/任务/奖励/敌人/关系Δ与真实路径=；持续成功账=；阶段/总压力=；同场首领=；恢复债务=；最低可玩性=；原作锚点/敌人唯一等级=；〔骰审计：回合=；骰池=；池长=；序号=；原始骰面=；算式=；结果=〕；候选事实化× NPC越知× 风味惩罚× 免费反制× 越权× 双掷/越池× 数据库未来污染× 短正文×；结尾四项候选✓。',
    );

    preset.name = `${String(preset.name || '主预设').replace(
        /_全局节奏闭环版$/u,
        '',
    )}_全局节奏闭环版`;

    const orderGroups = preset.prompt_order;
    const orderEntries = orderGroups.flatMap((group) => group?.order || []);
    const enabledByPrompt = new Map(
        preset.prompts.map((prompt) => [prompt.identifier, prompt.enabled !== false]),
    );
    for (const entry of orderEntries) {
        if (!enabledByPrompt.has(entry.identifier)) continue;
        entry.enabled = enabledByPrompt.get(entry.identifier);
    }
    const effective = orderEntries.filter((entry) => entry.enabled).length;
    const modifications = preset.prompts
        .map((prompt) => {
            const previous = before.get(prompt.identifier);
            const content = String(prompt.content || '');
            if (
                previous.name === prompt.name
                && previous.content === content
            ) return null;
            return {
                identifier: prompt.identifier,
                beforeName: previous.name,
                afterName: prompt.name,
                beforeLength: previous.content.length,
                afterLength: content.length,
                beforeSha256: sha256(previous.content),
                afterSha256: sha256(content),
            };
        })
        .filter(Boolean);
    return {
        preset,
        audit: {
            transformVersion: FAIR_DIRECTOR_PRESET_VERSION,
            sourceName: input.name || '',
            outputName: preset.name,
            promptCount: preset.prompts.length,
            orderCount: orderEntries.length,
            enabledCount: effective,
            globalGateIdentifier: IDS.fairGate,
            globalGateOrderIndex: orderEntries.findIndex(
                (entry) => entry.identifier === IDS.fairGate,
            ),
            modifications,
        },
    };
}

export function transformSerendipityFairDirectorPreset(input) {
    const base = transformFairDirectorPreset(input);
    const preset = structuredClone(base.preset);
    const byId = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
    const fair = requirePrompt(byId, IDS.fairGate);
    const before = String(fair.content || '');
    fair.name = '🎬公平导演权威总闸V2（全局压力·偶发性双保险）';
    fair.content = before.includes('<Fair_Director_Serendipity_Double_Gate_V1>')
        ? before.replace(
            /<Fair_Director_Serendipity_Double_Gate_V1>[\s\S]*?<\/Fair_Director_Serendipity_Double_Gate_V1>/u,
            SERENDIPITY_DOUBLE_GATE,
        )
        : `${before}\n\n${SERENDIPITY_DOUBLE_GATE}`;
    preset.name = `${String(preset.name || '主预设')
        .replace(/_全局节奏闭环版$/u, '')
        .replace(/_偶发性双保险版$/u, '')}_偶发性双保险版`;
    return {
        preset,
        audit: {
            ...base.audit,
            transformVersion: SERENDIPITY_FAIR_DIRECTOR_PRESET_VERSION,
            outputName: preset.name,
            serendipityGateIdentifier: IDS.fairGate,
            serendipityDoubleGate: true,
            modifications: [
                ...base.audit.modifications.filter((entry) => entry.identifier !== IDS.fairGate),
                {
                    identifier: IDS.fairGate,
                    beforeName: input.prompts.find((prompt) => prompt.identifier === IDS.fairGate)?.name || '',
                    afterName: fair.name,
                    beforeLength: String(input.prompts.find(
                        (prompt) => prompt.identifier === IDS.fairGate,
                    )?.content || '').length,
                    afterLength: fair.content.length,
                    beforeSha256: sha256(String(input.prompts.find(
                        (prompt) => prompt.identifier === IDS.fairGate,
                    )?.content || '')),
                    afterSha256: sha256(fair.content),
                },
            ],
        },
    };
}

export function presetSha256(value) {
    return sha256(typeof value === 'string' ? value : JSON.stringify(value));
}
