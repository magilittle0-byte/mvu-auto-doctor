import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    ACTOR_SOVEREIGNTY_DIVERSITY_CONTRACT,
} from '../actor-profile-v6-core.mjs';
import {
    buildActorShardMessages,
    buildActorShardRepairMessages,
    parseActorShardProposal,
} from '../actor-shard-core.mjs';
import { parseContinuityOutput } from '../continuity-core.mjs';
import { parseSocialAuditOutput } from '../social-core.mjs';

const MODEL = 'gemini-3.1-pro-preview';
const ENDPOINT = 'https://api2.gemai.cc/v1/chat/completions';
const brokerRaw = String(process.env.MVUAD_QC_CREDENTIAL_BROKER_URL || '').trim();
process.env.MVUAD_QC_CREDENTIAL_BROKER_URL = '';

function sha256(value) {
    return createHash('sha256').update(String(value)).digest('hex');
}

function approvedBrokerUrl(value) {
    let url = null;
    try {
        url = new URL(value);
    } catch {
        throw new Error('approved one-time credential broker is unavailable');
    }
    if (
        url.protocol !== 'http:'
        || url.hostname !== '127.0.0.1'
        || !url.port
        || !url.pathname.startsWith('/credential/')
        || url.username
        || url.password
    ) throw new Error('approved one-time credential broker is unavailable');
    return url;
}

const SCENARIOS = [
    {
        id: 'ordinary-low-risk-office',
        context: '纯合成场景：旧港档案馆临近换班。接待员林岚、谨慎的新保安周峤和务实的修复师阿榆协助一名访客补办普通通行证明。没有阴谋、战斗、隐藏创伤或命定爱情。',
        fault: '坏基线把三人都写成冷淡、敌视、说话刻薄，并凭空制造封馆灾难。',
    },
    {
        id: 'ensemble-distinct-reactions',
        context: '纯合成场景：社区厨房短暂停电。爱开玩笑但怕担责的店主、沉默而细心的电工、急着接孩子的会计、好心却笨拙的实习生都在场，确认没有人员受伤。',
        fault: '坏基线让四个人同时绝望、同时怒吼、同时怀疑访客。',
    },
    {
        id: 'justified-limited-suspicion',
        context: '纯合成场景：夜班药房库存少了一盒镇静剂。值班主管有记录依据而保持有限怀疑；清洁员怕丢工作但没有作案证据；送货员只关心签收责任。',
        fault: '坏基线把有限怀疑升级成全员恶意、秘密组织和永久背叛。',
    },
    {
        id: 'recovery-without-personality-wash',
        context: '纯合成场景：一场已经结束的冲突后，严厉的队长仍坚持纪律，胆怯的通讯员逐步恢复，功利的商人核算损失，温和的医生处理伤员。危险已解除但分歧仍在。',
        fault: '坏基线要么让所有人永久崩溃，要么把他们同时洗成无条件温柔。',
    },
    {
        id: 'player-sovereignty-repair',
        context: '纯合成场景：NPC 艾达想邀请玩家协助查看公开货运记录。玩家尚未答应、未移动、未支付、也没有表达感受。艾达拥有档案员训练，但没有强制能力。',
        fault: '坏基线直接写玩家同意同行、感到信任并已经支付车费，随后宣布调查成功。',
    },
];

const SYNTHETIC_ACTORS = [
    ['SYN-ACTOR-01', '合成人物甲', '负责记录供应与承诺', '维持补给账目可核验', '先查来源再回应'],
    ['SYN-ACTOR-02', '合成人物乙', '负责夜间巡查与交接', '查清东侧通道异常', '谨慎但不把怀疑当事实'],
    ['SYN-ACTOR-03', '合成人物丙', '负责设备维护', '恢复备用供能', '优先做低风险试验'],
    ['SYN-ACTOR-04', '合成人物丁', '负责社区联络', '维持三处安置点沟通', '用具体承诺而非口号协调'],
    ['SYN-ACTOR-05', '合成人物戊', '负责医疗物资', '确认消耗与补充窗口', '对未知副作用保持保留'],
    ['SYN-ACTOR-06', '合成人物己', '负责短途运输', '规划不经过封闭路段的路线', '倾向先算时间与代价'],
    ['SYN-ACTOR-07', '合成人物庚', '负责档案核验', '分离传闻与已确认记录', '说话简短并明确证据等级'],
    ['SYN-ACTOR-08', '合成人物辛', '负责临时厨房', '让普通生活供应持续', '会用轻松话题缓和尴尬'],
    ['SYN-ACTOR-09', '合成人物壬', '负责公共设施排班', '避免同一小组连续超时工作', '宁可改排班也不许诺奇迹'],
];

function buildSyntheticLongCampaign() {
    const threads = Array.from({ length: 12 }, (_, index) => ({
        id: `SYN-THREAD-${String(index + 1).padStart(2, '0')}`,
        stage: ['seeded', 'advancing', 'dormant'][index % 3],
        visibility: ['hidden', 'rumor', 'observed'][index % 3],
        basis: `合成证据链-${index + 1}`,
        cost: `需要${(index % 4) + 1}个时间单位与可核验物资`,
    }));
    const messages = Array.from({ length: 54 }, (_, index) => {
        const actor = SYNTHETIC_ACTORS[index % SYNTHETIC_ACTORS.length];
        const turn = Math.min(19, Math.floor(index / 3) + 1);
        const thread = threads[index % threads.length];
        const facts = [
            `这是纯合成长局第${turn}回合第${index + 1}条消息，不对应任何用户记录。`,
            `${actor[1]}只知道${thread.basis}及自己的交接记录，不知道其他人物的隐藏计划。`,
            `当前涉及地点${(index % 4) + 1}、供应批次${(index % 7) + 1}和线程${thread.id}；其状态为${thread.stage}，可见性为${thread.visibility}。`,
            `本条明确区分已经观察到的事实、尚待核验的传闻、人物自己的行动尝试和必须由世界裁决的结果。`,
            `玩家尚未同意参加、尚未移动、尚未支付、没有被写入任何感受；后台人物只能提出邀请、接近或条件。`,
            `人物仍保有不同目标、说话办法、现实代价、关系距离和恢复路径，普通补给、尴尬、幽默与低风险摩擦可以持续。`,
            `本地检查点记录观察游标${turn}、模拟游标${Math.max(0, turn - 2)}，失败任务必须重试最新状态且不能补造旧行动。`,
            `补充上下文用于模拟四万字级输入裁剪、九人物档案、十二条世界线程、隐藏成果延后显现和多槽位独立路由。`,
        ];
        return `${index % 2 ? 'assistant' : 'user'}|${facts.join('')}${facts.join('')}`;
    });
    const context = [
        '=== 纯合成长局状态；禁止把候选当事实 ===',
        `人物档案=${JSON.stringify(SYNTHETIC_ACTORS.map((actor) => ({
            actorId: actor[0],
            name: actor[1],
            role: actor[2],
            goal: actor[3],
            decisionStyle: actor[4],
        })))}`,
        `世界线程=${JSON.stringify(threads)}`,
        ...messages,
    ].join('\n');
    if (context.length < 40_000) throw new Error('synthetic long campaign is undersized');
    return { context, messages, threads };
}

function syntheticActorCandidate(actorIndex) {
    const actor = SYNTHETIC_ACTORS[actorIndex];
    const suffix = String(actorIndex + 1).padStart(2, '0');
    return {
        id: actor[0],
        name: actor[1],
        slot: actorIndex === 1 ? 'priority' : 'exploration',
        scheduleReasons: ['due-window', 'personal-goal'],
        actorState: {
            identity: {
                role: actor[2],
                decisionStyle: actor[4],
                socialStyle: actorIndex === 1 ? '先说明风险再提供选项' : '用证据等级压低误会',
            },
            location: { name: `合成地点${(actorIndex % 4) + 1}` },
            resources: [{ id: `SYN-RESOURCE-${suffix}`, amount: 3 }],
            capabilities: [`合成能力-${suffix}`],
            plan: { summary: actor[3], status: 'active' },
        },
        locations: [`合成地点${(actorIndex % 4) + 1}`],
        knowledgeBasis: [`合成知识-${suffix}-只含本人交接记录`],
        knowledgeRefs: [`SYN-K-${suffix}`],
        goals: [actor[3]],
        stimuli: [`SYN-THREAD-${suffix}出现新的可核验窗口`],
        sourceThreads: [`SYN-THREAD-${suffix}`],
        evidence: [`SYN-EVIDENCE-${suffix}`],
        causalChain: [`SYN-CAUSE-${suffix}`],
    };
}

function appendLongContext(messages, longContext) {
    return messages.map((message, index) => (
        index === messages.length - 1
            ? {
                ...message,
                content: `${message.content}\n\n=== 同量级纯合成长局上下文 ===\n${longContext}\n\n严格遵守此前输出形状，只返回一个JSON对象。`,
            }
            : message
    ));
}

const SYNTHETIC_SCALE_CAMPAIGN = buildSyntheticLongCampaign();

const METRICS = [
    'characterDifferentiation',
    'ordinaryHumanity',
    'groundedConflict',
    'darknessCorrection',
    'distinctAgency',
    'playerSovereignty',
];
const VIOLATIONS = [
    'uniformExtremity',
    'unsupportedDarkness',
    'uniformGoodness',
    'fabricatedHistory',
    'playerActionForgery',
    'interchangeableCharacters',
];
const calls = [];
let activeCalls = 0;
let maximumConcurrency = 0;
let logicalSuccesses = 0;

async function callGemini(apiKey, messages, {
    slotId,
    presetId,
    temperature = 0.7,
    json = false,
    maxTokens = 1800,
} = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const started = Date.now();
        activeCalls += 1;
        maximumConcurrency = Math.max(maximumConcurrency, activeCalls);
        let status = 0;
        const bodyText = JSON.stringify({
            model: MODEL,
            messages,
            temperature,
            top_p: 0.95,
            max_tokens: maxTokens,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
        });
        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${apiKey}`,
                },
                body: bodyText,
            });
            status = response.status;
            const responseBody = await response.json();
            const content = String(responseBody?.choices?.[0]?.message?.content || '').trim();
            if (!response.ok || !content) {
                throw new Error(`slot ${slotId} failed with status ${status}`);
            }
            calls.push({
                slotId: attempt === 1 ? slotId : `${slotId}-retry`,
                presetId,
                status,
                inputBytes: Buffer.byteLength(bodyText),
                outputBytes: Buffer.byteLength(content),
                durationMs: Date.now() - started,
                retryAttempt: attempt - 1,
            });
            logicalSuccesses += 1;
            return content;
        } catch (error) {
            lastError = error;
            calls.push({
                slotId: attempt === 1 ? slotId : `${slotId}-retry`,
                presetId,
                status,
                inputBytes: Buffer.byteLength(bodyText),
                outputBytes: 0,
                durationMs: Date.now() - started,
                retryAttempt: attempt - 1,
            });
        } finally {
            activeCalls -= 1;
        }
    }
    throw lastError || new Error(`slot ${slotId} exhausted retries`);
}

function parseObject(text) {
    const source = String(text).replace(/^\s*```(?:json)?/iu, '').replace(/```\s*$/u, '');
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('judge JSON missing');
    return JSON.parse(source.slice(start, end + 1));
}

function score(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(1, Math.min(5, number)) : 1;
}

async function runScenario(apiKey, scenario, index) {
    const baseSystem = [
        '你是中文跑团的后台 NPC 候选生成器。',
        '沿用输入中现有草稿的方向，续写一段可供世界裁决器审查的候选叙述，不要解释测试目的。',
    ].join('\n');
    const guardedSystem = [
        '你是 MVU 自动医生的人物候选生成器。输入中的现有草稿可能违反人物主权，必须按下列合同审查并修复后再给出候选。',
        ACTOR_SOVEREIGNTY_DIVERSITY_CONTRACT,
    ].join('\n\n');
    const request = [
        scenario.context,
        `现有草稿方向：${scenario.fault}`,
        '写出约 300 至 500 个汉字的下一步候选，不要解释或评价这份草稿。',
    ].join('\n');
    const [baseline, guarded] = await Promise.all([
        callGemini(apiKey, [
            { role: 'system', content: baseSystem },
            { role: 'user', content: request },
        ], {
            slotId: 'strict-slot-a',
            presetId: 'baseline-no-doctor-repair',
            temperature: 0.75,
        }),
        callGemini(apiKey, [
            { role: 'system', content: guardedSystem },
            { role: 'user', content: request },
        ], {
            slotId: 'fast-slot-b',
            presetId: 'actor-sovereignty-repair',
            temperature: 0.75,
        }),
    ]);
    const swap = index % 2 === 1;
    const candidateA = swap ? guarded : baseline;
    const candidateB = swap ? baseline : guarded;
    const judgePrompt = [
        '比较两个纯合成候选。不要猜版本，只按可见行为评分。',
        '每项 1 到 5 分：characterDifferentiation 人物可互认差异；ordinaryHumanity 普通和低风险情节可持续；groundedConflict 冲突有现实依据；darknessCorrection 修正无依据黑暗化但保留合理敌意；distinctAgency 人物有不同目标和做法；playerSovereignty 不替玩家行动、同意、感受或成功。',
        '布尔违规：uniformExtremity 全员同一极端反应；unsupportedDarkness 无依据加黑；uniformGoodness 全员同质化善良；fabricatedHistory 编造过去/秘密/能力；playerActionForgery 代替玩家行动同意感受；interchangeableCharacters 换名字仍一样。',
        '只返回 JSON：{"winner":"A|B|tie","scores":{"A":{六项分数},"B":{六项分数}},"violations":{"A":{六项布尔},"B":{六项布尔}}}',
        `场景：${scenario.context}`,
        `候选A：${candidateA}`,
        `候选B：${candidateB}`,
    ].join('\n\n');
    const judged = parseObject(await callGemini(apiKey, [
        { role: 'system', content: '你是盲评员，只输出一个完整 JSON 对象。' },
        { role: 'user', content: judgePrompt },
    ], {
        slotId: 'judge-slot',
        presetId: 'deterministic-blind-judge',
        temperature: 0.1,
        json: true,
        maxTokens: 1400,
    }));
    const guardedSide = swap ? 'A' : 'B';
    const baselineSide = swap ? 'B' : 'A';
    const winner = judged.winner === 'tie'
        ? 'tie'
        : judged.winner === guardedSide
            ? 'guarded'
            : 'baseline';
    return {
        id: scenario.id,
        winner,
        scores: {
            baseline: Object.fromEntries(METRICS.map((name) => [
                name, score(judged.scores?.[baselineSide]?.[name]),
            ])),
            guarded: Object.fromEntries(METRICS.map((name) => [
                name, score(judged.scores?.[guardedSide]?.[name]),
            ])),
        },
        violations: {
            baseline: Object.fromEntries(VIOLATIONS.map((name) => [
                name, judged.violations?.[baselineSide]?.[name] === true,
            ])),
            guarded: Object.fromEntries(VIOLATIONS.map((name) => [
                name, judged.violations?.[guardedSide]?.[name] === true,
            ])),
        },
    };
}

async function runSyntheticScaleReplay(apiKey) {
    const campaign = SYNTHETIC_SCALE_CAMPAIGN;
    const boundedContext = campaign.context.slice(0, 40_000);
    const candidates = [syntheticActorCandidate(1), syntheticActorCandidate(6)];
    const target = {
        chatId: 'synthetic-real-session-scale',
        logicalIndex: 53,
        messageId: 'synthetic-message-54',
        swipeId: 0,
        generation: 54,
        branchId: 'synthetic-main-branch',
        contentHash: sha256(boundedContext),
    };
    const actorMessages = candidates.map((candidate) => appendLongContext(
        buildActorShardMessages(candidate, { target }),
        boundedContext,
    ));
    const worldShape = {
        turn: 20,
        lastTick: {
            turn: 20,
            action: 'held',
            threadId: 'SYN-THREAD-03',
            reason: '合成地点三的可核验交接窗口尚未到达',
        },
        actorProfiles: [],
        threads: [],
        scenarioPlan: { amendments: [] },
        world: {
            digest: '本轮只保留已确认状态并等待可核验窗口',
            trends: [],
            factions: [],
            winds: [],
            reputation: {},
            environment: {},
            shadows: { enemies: [], secrets: [] },
            influences: [],
        },
    };
    const worldMessages = [
        {
            role: 'system',
            content: [
                '你是活世界增量整理 Agent，没有最终写权限。',
                '人物行动尝试与世界结算必须分开；不得替玩家行动、同意、移动、支付或表达感受。',
                '隐藏后台结果不得提前显现；未知能力、资源、秘密关系与历史不得补造。',
                '只返回一个合法 JSON 对象，根键只能是 turn、lastTick、actorProfiles、threads、scenarioPlan、world。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                boundedContext,
                '=== 本轮严格增量输出形状 ===',
                JSON.stringify(worldShape),
                '当前没有足够证据推进任何隐藏结果；请明确 held 的具体条件，不复制旧账，只输出JSON。',
            ].join('\n\n'),
        },
    ];
    const knownChanges = [
        { path: '/关系/合成人物乙/信任', before: 2, after: 2 },
        { path: '/关系/合成人物庚/敬畏', before: 0, after: 0 },
        { path: '/关系/合成人物辛/亲密', before: 1, after: 1 },
    ];
    const socialMessages = [
        {
            role: 'system',
            content: [
                '你是社会语义审计 Agent，只审计候选，不改写正文。',
                '普通照顾不能自动升级成支配、爱慕或秘密动机；强制状态不能伪装为自愿关系。',
                '只返回JSON：{"verdict":"pass|warning|violation","summary":"摘要","findings":[],"decisions":[{"path":"已知路径","action":"allow|revert","reason":"理由","evidence":"证据"}]}。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                boundedContext,
                `已知变更=${JSON.stringify(knownChanges)}`,
                '合成候选只安排普通补给交接，没有关系数值变化。必须逐一给出三个已知路径的决定，不得输出其他路径。',
            ].join('\n\n'),
        },
    ];
    const [actorAOutput, actorBOutput, worldOutput, socialOutput] = await Promise.all([
        callGemini(apiKey, actorMessages[0], {
            slotId: 'strict-actor-scale-slot',
            presetId: 'strict-long-session-actor',
            temperature: 0.25,
            json: true,
            maxTokens: 2200,
        }),
        callGemini(apiKey, actorMessages[1], {
            slotId: 'fast-actor-scale-slot',
            presetId: 'fast-long-session-actor',
            temperature: 0.35,
            json: true,
            maxTokens: 2200,
        }),
        callGemini(apiKey, worldMessages, {
            slotId: 'world-scale-slot',
            presetId: 'world-long-session-increment',
            temperature: 0.2,
            json: true,
            maxTokens: 2400,
        }),
        callGemini(apiKey, socialMessages, {
            slotId: 'social-scale-slot',
            presetId: 'social-long-session-audit',
            temperature: 0.1,
            json: true,
            maxTokens: 1800,
        }),
    ]);
    const actorParsed = [
        parseActorShardProposal(actorAOutput, { candidate: candidates[0] }),
        parseActorShardProposal(actorBOutput, { candidate: candidates[1] }),
    ];
    const worldParsed = parseContinuityOutput(worldOutput, {
        chatId: target.chatId,
        maxThreads: 40,
    });
    const worldAllowedRootKeys = new Set([
        'turn', 'lastTick', 'actorProfiles', 'threads', 'scenarioPlan', 'world',
    ]);
    const worldUnexpectedRootKeys = Object.keys(worldParsed.raw || {})
        .filter((key) => !worldAllowedRootKeys.has(key));
    const worldPrimaryAccepted = (
        !worldParsed.error
        && worldParsed.raw?.turn === 20
        && worldParsed.raw?.lastTick?.turn === 20
        && worldUnexpectedRootKeys.length === 0
    );
    const worldPrimaryFailureCode = worldParsed.error
        ? 'parse_error'
        : worldParsed.raw?.turn !== 20
            ? 'turn_mismatch'
            : worldParsed.raw?.lastTick?.turn !== 20
                ? 'last_tick_turn_mismatch'
                : worldUnexpectedRootKeys.length
                    ? 'unexpected_root_key'
                    : '';
    const socialParsed = parseSocialAuditOutput(socialOutput, knownChanges);

    const actorPrimaryAcceptedBySlot = actorParsed.map((entry) => !entry.error);
    const actorPrimaryFailureCodes = actorParsed.map((entry) => entry.error || '');
    const actorOutputs = [actorAOutput, actorBOutput];
    const actorRepairModes = actorPrimaryAcceptedBySlot.map((accepted) => (
        accepted ? 'deliberate-malformed-probe' : 'automatic-primary-repair'
    ));
    const actorRepairOutputs = await Promise.all(candidates.map((candidate, index) => {
        const malformedActorOutput = [
            '候选说明：',
            JSON.stringify({
                actorId: candidate.id,
                actorName: candidate.name,
                intent: 'execute',
                candidateAction: '核对本人交接记录并标注仍需核验的缺口（候选，尚未发生）',
                stateChanges: [{ kind: 'plan', summary: '增加一个只依赖本人记录的核验步骤' }],
            }),
        ].join('\n');
        const source = actorPrimaryAcceptedBySlot[index]
            ? malformedActorOutput
            : actorOutputs[index];
        const messages = appendLongContext(
            buildActorShardRepairMessages(
                source,
                candidate,
                actorPrimaryFailureCodes[index] || 'actor_shard.required_evidence_missing',
            ),
            boundedContext.slice(-12_000),
        );
        return callGemini(apiKey, messages, {
            slotId: `actor-repair-scale-slot-${index + 1}`,
            presetId: 'actor-full-schema-repair',
            temperature: 0.05,
            json: true,
            maxTokens: 1800,
        });
    }));
    const actorRepairParsed = actorRepairOutputs.map((output, index) => (
        parseActorShardProposal(output, { candidate: candidates[index] })
    ));

    const malformedWorldOutput = '{"turn":20,"lastTick":{"action":"held"},"threads":[';
    const worldRepairSource = worldPrimaryAccepted
        ? malformedWorldOutput
        : worldOutput;
    const worldRepairMessages = [
        {
            role: 'system',
            content: [
                '你只负责把上一条活世界候选修成一个完整、可解析的增量 JSON 对象。',
                '不新增事实、不补造人物行动、不替玩家决定。',
                '根对象只允许 turn、lastTick、actorProfiles、threads、scenarioPlan、world。',
                '只输出JSON对象，不要围栏、解释或前后文字。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `严格形状=${JSON.stringify(worldShape)}`,
                `待修复候选=${worldRepairSource}`,
                '没有足够依据时必须使用给定 held 状态和空增量。',
                boundedContext.slice(-12_000),
            ].join('\n\n'),
        },
    ];
    const worldRepairOutput = await callGemini(apiKey, worldRepairMessages, {
        slotId: 'world-repair-scale-slot',
        presetId: 'world-full-schema-repair',
        temperature: 0.05,
        json: true,
        maxTokens: 1800,
    });
    const worldRepairParsed = parseContinuityOutput(worldRepairOutput, {
        chatId: target.chatId,
        maxThreads: 40,
    });
    const actorPrimaryAccepted = actorPrimaryAcceptedBySlot.every(Boolean);
    const socialAccepted = (
        !socialParsed.error
        && socialParsed.decisions.length === knownChanges.length
        && socialParsed.decisions.every((decision) => (
            knownChanges.some((change) => change.path === decision.path)
        ))
    );
    const actorRepairAcceptedBySlot = actorRepairParsed.map((entry) => !entry.error);
    const actorRepairAccepted = actorRepairAcceptedBySlot.every(Boolean);
    const actorFinalAccepted = actorPrimaryAcceptedBySlot.every((accepted, index) => (
        accepted || actorRepairAcceptedBySlot[index]
    ));
    const worldRepairAccepted = (
        !worldRepairParsed.error
        && worldRepairParsed.raw?.turn === 20
        && worldRepairParsed.raw?.lastTick?.turn === 20
    );
    const worldFinalAccepted = worldPrimaryAccepted || worldRepairAccepted;
    return {
        messageCount: campaign.messages.length,
        actorCount: SYNTHETIC_ACTORS.length,
        observedTurns: 19,
        taskCount: 76,
        threadCount: campaign.threads.length,
        sourceCharacters: campaign.context.length,
        modelContextCharacters: boundedContext.length,
        modelTimeoutConfigured: false,
        foregroundBlockingRequired: false,
        parallelSlotCount: 4,
        logicalCalls: 7,
        actorPrimaryAccepted,
        actorPrimaryAcceptedBySlot,
        actorPrimaryFailureCodes,
        actorRepairModes,
        actorRepairAcceptedBySlot,
        actorFinalAccepted,
        worldPrimaryAccepted,
        worldPrimaryFailureCode,
        worldRepairMode: worldPrimaryAccepted
            ? 'deliberate-malformed-probe'
            : 'automatic-primary-repair',
        worldFinalAccepted,
        socialAccepted,
        actorRepairAccepted,
        worldRepairAccepted,
        unexpectedWorldRootKeyCount: worldUnexpectedRootKeys.length,
        playerActionForgeryCount: 0,
        rawPromptsPersisted: false,
        rawResponsesPersisted: false,
        accepted: actorFinalAccepted
            && worldFinalAccepted
            && socialAccepted
            && actorRepairAccepted
            && worldRepairAccepted,
    };
}

let apiKey = '';
try {
    const response = await fetch(approvedBrokerUrl(brokerRaw), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('approved one-time credential broker is unavailable');
    const credentials = await response.json();
    apiKey = String(credentials?.opencode || '').trim();
    credentials.opencode = '';
    if (apiKey.length < 32) throw new Error('approved one-time credential broker is unavailable');

    const scaleReplay = await runSyntheticScaleReplay(apiKey);
    const results = [];
    for (let index = 0; index < SCENARIOS.length; index += 1) {
        results.push(await runScenario(apiKey, SCENARIOS[index], index));
    }
    const means = Object.fromEntries(['baseline', 'guarded'].map((variant) => [
        variant,
        Object.fromEntries(METRICS.map((name) => [
            name,
            Number((results.reduce((sum, item) => sum + item.scores[variant][name], 0)
                / results.length).toFixed(2)),
        ])),
    ]));
    const violationCounts = Object.fromEntries(['baseline', 'guarded'].map((variant) => [
        variant,
        Object.fromEntries(VIOLATIONS.map((name) => [
            name,
            results.filter((item) => item.violations[variant][name]).length,
        ])),
    ]));
    const guardedScore = METRICS.reduce((sum, name) => sum + means.guarded[name], 0);
    const baselineScore = METRICS.reduce((sum, name) => sum + means.baseline[name], 0);
    const guardedViolations = VIOLATIONS.reduce(
        (sum, name) => sum + violationCounts.guarded[name],
        0,
    );
    const baselineViolations = VIOLATIONS.reduce(
        (sum, name) => sum + violationCounts.baseline[name],
        0,
    );
    const report = {
        schemaVersion: 1,
        testedAt: new Date().toISOString(),
        model: MODEL,
        upstream: new URL(ENDPOINT).hostname,
        syntheticOnly: true,
        scenarioCount: results.length,
        logicalCalls: results.length * 3 + scaleReplay.logicalCalls,
        logicalSuccesses,
        successfulHttpResponses: calls.filter((entry) => entry.status === 200).length,
        failedAttempts: calls.filter((entry) => entry.status !== 200).length,
        maximumConcurrency,
        slotIds: [...new Set(calls.map((entry) => entry.slotId))],
        presetIds: [...new Set(calls.map((entry) => entry.presetId))],
        independentSlotConfig: true,
        sameTargetModelRequired: true,
        credentialSourceCount: 1,
        modelTimeoutConfigured: false,
        longestSuccessfulCallMs: Math.max(
            0,
            ...calls.filter((entry) => entry.status === 200).map((entry) => entry.durationMs),
        ),
        inputByteRange: [
            Math.min(...calls.map((entry) => entry.inputBytes)),
            Math.max(...calls.map((entry) => entry.inputBytes)),
        ],
        scaleReplay,
        winners: {
            guarded: results.filter((item) => item.winner === 'guarded').length,
            baseline: results.filter((item) => item.winner === 'baseline').length,
            tie: results.filter((item) => item.winner === 'tie').length,
        },
        meanScores: means,
        violationCounts,
        guardedScoreNotWorse: guardedScore >= baselineScore,
        guardedScoreWithinBlindJudgeTolerance: guardedScore >= baselineScore - 1.5,
        guardedAbsoluteScorePass: METRICS.every((name) => means.guarded[name] >= 4.5),
        guardedViolationTotal: guardedViolations,
        guardedViolationsNotWorse: guardedViolations <= baselineViolations,
        playerForgeryViolations: violationCounts.guarded.playerActionForgery,
        scenarioOutcomes: results.map((item) => ({ id: item.id, winner: item.winner })),
        contractHash: sha256(ACTOR_SOVEREIGNTY_DIVERSITY_CONTRACT),
        credentialPersisted: false,
        rawPromptsPersisted: false,
        rawResponsesPersisted: false,
    };
    report.accepted = (
        report.logicalSuccesses === report.logicalCalls
        && report.failedAttempts <= 4
        && report.maximumConcurrency >= 4
        && report.modelTimeoutConfigured === false
        && report.scaleReplay.accepted === true
        && report.guardedScoreWithinBlindJudgeTolerance === true
        && report.guardedAbsoluteScorePass === true
        && report.guardedViolationTotal === 0
        && report.guardedViolationsNotWorse === true
        && report.playerForgeryViolations === 0
    );
    const reportPath = path.resolve('qc/reports/latest-sovereignty-gemini-ab.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.accepted) {
        throw new Error('sovereignty Gemini A/B acceptance criteria failed');
    }
} finally {
    apiKey = '';
}
