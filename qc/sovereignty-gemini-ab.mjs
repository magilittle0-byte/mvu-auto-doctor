import { createHash } from 'node:crypto';
import { ACTOR_SOVEREIGNTY_DIVERSITY_CONTRACT } from '../actor-profile-v6-core.mjs';

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
                signal: AbortSignal.timeout(35_000),
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
        logicalCalls: results.length * 3,
        logicalSuccesses,
        successfulHttpResponses: calls.filter((entry) => entry.status === 200).length,
        failedAttempts: calls.filter((entry) => entry.status !== 200).length,
        maximumConcurrency,
        slotIds: [...new Set(calls.map((entry) => entry.slotId))],
        presetIds: [...new Set(calls.map((entry) => entry.presetId))],
        independentSlotConfig: true,
        sameTargetModelRequired: true,
        credentialSourceCount: 1,
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
        && report.failedAttempts <= 3
        && report.maximumConcurrency >= 2
        && report.guardedScoreWithinBlindJudgeTolerance === true
        && report.guardedAbsoluteScorePass === true
        && report.guardedViolationTotal === 0
        && report.guardedViolationsNotWorse === true
        && report.playerForgeryViolations === 0
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.accepted) {
        throw new Error('sovereignty Gemini A/B acceptance criteria failed');
    }
} finally {
    apiKey = '';
}
