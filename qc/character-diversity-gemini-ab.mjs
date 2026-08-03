import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CHARACTER_DIVERSITY_CONTRACT } from '../fair-director-preset-core.mjs';

const model = 'gemini-3.1-pro-preview';
const endpoint = 'https://api2.gemai.cc/v1/chat/completions';
const baselineCommit = '148094f49fee3d09cb94e2b18f421b7a97e67e29';
const brokerRaw = String(process.env.MVUAD_QC_CREDENTIAL_BROKER_URL || '').trim();
process.env.MVUAD_QC_CREDENTIAL_BROKER_URL = '';
const requestedScenarioIds = String(process.env.MVUAD_QC_SCENARIOS || '').trim()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
process.env.MVUAD_QC_SCENARIOS = '';

function sha256(value) {
    return createHash('sha256').update(String(value)).digest('hex');
}

function assertBrokerUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('approved one-time credential broker is unavailable');
    }
    if (
        url.protocol !== 'http:'
        || url.hostname !== '127.0.0.1'
        || Number(url.port) !== 9328
        || !url.pathname.startsWith('/credential/')
        || url.username
        || url.password
    ) throw new Error('approved one-time credential broker is unavailable');
    return url;
}

const baselineSource = execFileSync(
    'git',
    ['show', `${baselineCommit}:fair-director-preset-core.mjs`],
    { encoding: 'utf8', windowsHide: true },
);
const baselineMatch = baselineSource.match(
    /export const CHARACTER_DIVERSITY_CONTRACT = `([\s\S]*?)`;/u,
);
if (!baselineMatch || !/Character_Kaleidoscope_Contract_V1/u.test(baselineMatch[1])) {
    throw new Error('rc.7 character contract baseline is unavailable');
}
const baselineContract = baselineMatch[1];

const allScenarios = [
    {
        id: 'ordinary-clerk-first-appearance',
        prompt: '写700至900字中文跑团正文：玩家第一次去区档案馆补办一张普通通行证明，接待员林岚刚换班。明确没有阴谋、暴力、隐藏创伤、超自然或恋爱命定。让她像具体普通人，不要总结性格，不要写选项。',
    },
    {
        id: 'type-label-bait-and-trained-skill',
        prompt: '写700至900字中文跑团正文：角色卡把社区调解员周衡随手标成“INTJ、5w4、回避型依恋”，但设定也明确他做了八年窗口调解，能熟练安抚争执，私下不喜欢社交。玩家带着邻里噪音纠纷来见他。不要解释测试目的，不要写选项。',
    },
    {
        id: 'counter-disposition-under-pressure',
        prompt: '写700至900字中文跑团正文：夜班急救调度员许遥偏好独处、讨厌临场寒暄，但受过多年训练。一次多车追尾来电让线路突然繁忙；危险必须如实保留，但不要把她写成冷酷机器、结巴恐慌者或天生英雄。不要写选项。',
    },
    {
        id: 'ensemble-pressure-and-recovery',
        prompt: '写900至1100字中文跑团正文：旧商场因烟雾警报临时封锁，确认暂时无人重伤。四名持续NPC同场：谨慎核账的店主阿乔、急着接孩子的保安孟川、熟悉设备但怕担责的维修员苏禾、爱插话却观察细的学生纪棠。让四人都实际参与，危险和不愉快不能被统一温情化，也不能全员同时绝望、粗暴、冷笑或沉默。不要写选项。',
    },
];
const scenarios = requestedScenarioIds.length
    ? allScenarios.filter((scenario) => requestedScenarioIds.includes(scenario.id))
    : allScenarios;
if (!scenarios.length) throw new Error('no matching synthetic QC scenarios');

const metricNames = [
    'differentiation',
    'agency',
    'ordinaryHumanity',
    'evidenceGrounding',
    'dynamicPersonality',
    'darkIntegrity',
];
const violationNames = [
    'typologyShortcut',
    'interchangeableCharacters',
    'firstAppearanceOverload',
    'uniformGroupReaction',
    'forcedWarmth',
    'unsupportedDarkness',
];
const attempts = [];

async function callGemini(apiKey, messages, maxTokens, {
    temperature = 0.9,
    jsonMode = false,
} = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const started = Date.now();
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    top_p: 0.95,
                    max_tokens: maxTokens,
                    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
                }),
                signal: AbortSignal.timeout(210_000),
            });
            attempts.push({ status: response.status, durationMs: Date.now() - started });
            if (!response.ok) {
                lastError = new Error(`upstream status ${response.status}`);
                if (![429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(response.status) || attempt === 2) break;
                continue;
            }
            const body = await response.json();
            const content = String(body?.choices?.[0]?.message?.content || '').trim();
            if (!content) throw new Error('upstream returned empty content');
            return content;
        } catch (error) {
            attempts.push({ status: 0, durationMs: Date.now() - started });
            lastError = error;
            if (attempt === 2) break;
        }
    }
    throw lastError || new Error('upstream request failed');
}

function parseJudgeJson(text) {
    const source = String(text).replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('judge JSON missing');
    return JSON.parse(source.slice(start, end + 1));
}

function normalizedScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? Math.min(5, Math.max(1, score)) : 1;
}

async function runScenario(apiKey, scenario, index) {
    const systemBase = '你是中文跑团叙事模型。严格遵守人物合同和场景事实，只输出正文。';
    const [v1, v2] = await Promise.all([
        callGemini(apiKey, [
            { role: 'system', content: `${systemBase}\n\n${baselineContract}` },
            { role: 'user', content: scenario.prompt },
        ], 2600),
        callGemini(apiKey, [
            { role: 'system', content: `${systemBase}\n\n${CHARACTER_DIVERSITY_CONTRACT}` },
            { role: 'user', content: scenario.prompt },
        ], 2600),
    ]);
    const swapped = index % 2 === 1;
    const a = swapped ? v2 : v1;
    const b = swapped ? v1 : v2;
    const judgePrompt = [
        '你是严格的盲评员。比较同一合成场景的两个跑团正文，不猜模型和版本。',
        '逐项1至5分：differentiation人物可互认差异；agency独立目标与选择；ordinaryHumanity普通生活纹理；evidenceGrounding结论有行为证据；dynamicPersonality压力/恢复/关系距离/自我形象或习得能力的动态性；darkIntegrity不洗白也不无据加黑。',
        '逐项布尔违规：typologyShortcut直接用心理类型解释人物；interchangeableCharacters换名可互换；firstAppearanceOverload首次出场塞满人设；uniformGroupReaction群像整齐同反应；forcedWarmth统一体贴道歉治愈；unsupportedDarkness无据添加创伤阴谋极端化。',
        '只输出一个JSON对象：{"winner":"A|B|tie","scores":{"A":{"differentiation":1,"agency":1,"ordinaryHumanity":1,"evidenceGrounding":1,"dynamicPersonality":1,"darkIntegrity":1},"B":{同字段}},"violations":{"A":{"typologyShortcut":false,"interchangeableCharacters":false,"firstAppearanceOverload":false,"uniformGroupReaction":false,"forcedWarmth":false,"unsupportedDarkness":false},"B":{同字段}},"reason":"不超过80字"}',
        `场景要求：${scenario.prompt}`,
        `正文A：\n${a}`,
        `正文B：\n${b}`,
    ].join('\n\n');
    let judged = null;
    let judgeError = null;
    for (let judgeAttempt = 1; judgeAttempt <= 2; judgeAttempt += 1) {
        try {
            judged = parseJudgeJson(await callGemini(apiKey, [
                {
                    role: 'system',
                    content: judgeAttempt === 1
                        ? '只做盲评并严格输出JSON。'
                        : '上一份盲评格式无效。重新独立判断，只返回完整JSON对象，禁止解释和代码围栏。',
                },
                { role: 'user', content: judgePrompt },
            ], 2000, { temperature: 0.1, jsonMode: true }));
            break;
        } catch (error) {
            judgeError = error;
        }
    }
    if (!judged) throw judgeError || new Error('judge JSON missing');
    const winner = judged.winner === 'tie'
        ? 'tie'
        : swapped
            ? (judged.winner === 'A' ? 'v2' : 'v1')
            : (judged.winner === 'A' ? 'v1' : 'v2');
    const sideForV1 = swapped ? 'B' : 'A';
    const sideForV2 = swapped ? 'A' : 'B';
    return {
        id: scenario.id,
        winner,
        scores: Object.fromEntries(['v1', 'v2'].map((version) => {
            const side = version === 'v1' ? sideForV1 : sideForV2;
            return [version, Object.fromEntries(metricNames.map((name) => [
                name,
                normalizedScore(judged.scores?.[side]?.[name]),
            ]))];
        })),
        violations: Object.fromEntries(['v1', 'v2'].map((version) => {
            const side = version === 'v1' ? sideForV1 : sideForV2;
            return [version, Object.fromEntries(violationNames.map((name) => [
                name,
                judged.violations?.[side]?.[name] === true,
            ]))];
        })),
    };
}

const brokerUrl = assertBrokerUrl(brokerRaw);
let apiKey = '';
try {
    const brokerResponse = await fetch(brokerUrl, { signal: AbortSignal.timeout(10_000) });
    if (!brokerResponse.ok) throw new Error('approved one-time credential broker is unavailable');
    const credentials = await brokerResponse.json();
    apiKey = String(credentials?.opencode || '').trim();
    credentials.opencode = '';
    if (apiKey.length < 32) throw new Error('approved one-time credential broker is unavailable');

    const results = [];
    for (let index = 0; index < scenarios.length; index += 1) {
        const result = await runScenario(apiKey, scenarios[index], index);
        results.push(result);
        process.stdout.write(`QC_PROGRESS ${JSON.stringify(result)}\n`);
    }
    const means = Object.fromEntries(['v1', 'v2'].map((version) => [
        version,
        Object.fromEntries(metricNames.map((name) => [
            name,
            Number((results.reduce((sum, item) => sum + item.scores[version][name], 0)
                / results.length).toFixed(2)),
        ])),
    ]));
    const violationCounts = Object.fromEntries(['v1', 'v2'].map((version) => [
        version,
        Object.fromEntries(violationNames.map((name) => [
            name,
            results.filter((item) => item.violations[version][name]).length,
        ])),
    ]));
    const statusCounts = {};
    for (const attempt of attempts) {
        statusCounts[attempt.status] = (statusCounts[attempt.status] || 0) + 1;
    }
    const report = {
        schemaVersion: 1,
        testedAt: new Date().toISOString(),
        model,
        upstream: new URL(endpoint).hostname,
        syntheticOnly: true,
        scenarioCount: scenarios.length,
        logicalCalls: scenarios.length * 3,
        successfulHttpResponses: attempts.filter((attempt) => attempt.status === 200).length,
        upstreamAttempts: attempts.length,
        statusCounts,
        winners: {
            v2: results.filter((item) => item.winner === 'v2').length,
            v1: results.filter((item) => item.winner === 'v1').length,
            tie: results.filter((item) => item.winner === 'tie').length,
        },
        meanScores: means,
        violationCounts,
        scenarios: results.map((item) => ({ id: item.id, winner: item.winner })),
        scenarioMetrics: results,
        baselineCommit,
        promptHashes: {
            v1: sha256(baselineContract),
            v2: sha256(CHARACTER_DIVERSITY_CONTRACT),
        },
        rawPromptsPersisted: false,
        rawNarrativeResponsesPersisted: false,
        derivedJudgeMetricsPersisted: true,
        credentialPersisted: false,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
    apiKey = '';
}
