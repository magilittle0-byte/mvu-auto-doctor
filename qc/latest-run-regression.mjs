import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
    return fs.readFileSync(file, 'utf8')
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(`invalid JSONL line ${index + 1}: ${error.message}`);
            }
        });
}

function pngCharacterCard(file) {
    const buffer = fs.readFileSync(file);
    if (buffer.subarray(1, 4).toString('ascii') !== 'PNG') {
        throw new Error('character card is not PNG');
    }
    let offset = 8;
    while (offset + 12 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === 'tEXt') {
            const separator = data.indexOf(0);
            const key = data.subarray(0, separator).toString('latin1');
            const value = data.subarray(separator + 1).toString('latin1');
            if (key === 'chara') {
                return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
            }
        }
        offset += 12 + length;
    }
    throw new Error('PNG card has no chara tEXt chunk');
}

function cardEntries(card) {
    return card?.data?.character_book?.entries
        || card?.character_book?.entries
        || [];
}

function dicePoolsFromCard(card) {
    const text = cardEntries(card)
        .map((entry) => String(entry?.content || ''))
        .join('\n');
    const result = {};
    for (const match of text.matchAll(
        /(?:^|\n)\s*(D(?:4|6|8|10|12|20|30|40))\s*[：:]\s*([^\n]+)/giu,
    )) {
        const die = match[1].toUpperCase();
        const rolls = match[2].match(
            new RegExp(`roll:1d${die.slice(1)}\\b`, 'giu'),
        ) || [];
        if (rolls.length) result[die] = Array.from({ length: rolls.length }, (_, index) => index + 1);
    }
    return result;
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

const [
    presetPath,
    logPath,
    diagnosticPath,
    cardPath,
    reportPath,
] = process.argv.slice(2);
if (!presetPath || !logPath || !diagnosticPath || !cardPath || !reportPath) {
    throw new Error(
        'usage: node qc/latest-run-regression.mjs <preset> <log.jsonl> <diagnostic> <card.png> <report>',
    );
}

const preset = readJson(presetPath);
const log = readJsonl(logPath);
const diagnostic = readJson(diagnosticPath);
const card = pngCharacterCard(cardPath);
const pools = dicePoolsFromCard(card);
const messages = log.filter((item) => (
    item && item.is_user === false && item.is_system !== true
));
const accepted = messages.map((item) => String(item.mes || '')).join('\n');
const dieUses = [...accepted.matchAll(/1d(4|5|6|8|10|12|20|30|40)\b/giu)]
    .map((match) => `D${match[1]}`);
const indexUses = {};
for (const match of accepted.matchAll(
    /(?:D|d)(4|6|8|10|12|20|30|40)[^。\n]{0,120}?(?:序号|编号|池序|index)\s*[：:#]?\s*(\d+)/giu,
)) {
    const die = `D${match[1]}`;
    indexUses[die] ||= [];
    indexUses[die].push(Number(match[2]));
}
for (const match of accepted.matchAll(
    /(?:D|d)(4|6|8|10|12|20|30|40)\s*池?(?:内)?第\s*(\d+)\s*个/giu,
)) {
    const die = `D${match[1]}`;
    indexUses[die] ||= [];
    indexUses[die].push(Number(match[2]));
}
for (const match of accepted.matchAll(
    /(?:第|#)\s*(\d+)\s*(?:枚|个)?\s*(?:D|d)(4|6|8|10|12|20|30|40)/giu,
)) {
    const die = `D${match[2]}`;
    indexUses[die] ||= [];
    indexUses[die].push(Number(match[1]));
}
const undeclaredDice = unique(dieUses.filter((die) => !pools[die]));
const overPool = Object.fromEntries(
    Object.entries(indexUses)
        .map(([die, values]) => [
            die,
            {
                poolLength: pools[die]?.length || 0,
                maxObservedIndex: Math.max(0, ...values),
            },
        ])
        .filter(([, item]) => item.poolLength && item.maxObservedIndex > item.poolLength),
);
const bossLabels = unique(
    [...accepted.matchAll(
        /(?:【|\[)\s*(?:BOSS|首领)\s*[：:]\s*([^】\]\n]{1,80})(?:】|\])/giu,
    )].map((match) => match[1].trim()),
);
const bosses = unique([
    ...bossLabels,
    ...[...accepted.matchAll(
        /(?:暴君(?:雏形|胚胎|实验体)?|暴食者·生化温床|实验体高阳|爬行者幼体)/gu,
    )].map((match) => match[0]),
]);
const gate = preset.prompts?.find((prompt) => (
    prompt.identifier === 'c27a5e1b-5acc-43a7-8e71-9c4441490df9'
));
const order = preset.prompt_order?.flatMap((group) => group?.order || []) || [];
const byId = new Map((preset.prompts || []).map((prompt) => [prompt.identifier, prompt]));
const mismatches = order.filter((entry) => (
    byId.has(entry.identifier)
    && entry.enabled !== (byId.get(entry.identifier).enabled !== false)
));
const enabled = order.filter((entry) => entry.enabled).length;
const actorShard = diagnostic?.actorShards
    || diagnostic?.currentChat?.continuity?.actorShards
    || {};
const selectedWorldLanes = diagnostic?.currentChat?.continuity?.worldLanes?.selected
    || diagnostic?.currentChat?.continuity?.worldLanes
    || [];
const dueFalseSelected = Array.isArray(selectedWorldLanes)
    ? selectedWorldLanes.filter((item) => item?.due === false)
    : [];
const gateText = String(gate?.content || '');
const coverage = {
    aggregatePressure: /阶段总上限/u.test(gateText) && /同场首领碰撞上限/u.test(gateText),
    recoveryDebt: /恢复债务/u.test(gateText),
    minimumPlayability: /最低可玩性/u.test(gateText),
    quietProgress: /安静回合也可以推进/u.test(gateText),
    longFormWithoutThreatFiller: /3000～4000字/u.test(gateText) && /不靠新怪、新机关、新倒计时/u.test(gateText),
    stitchesCandidateVeto: /提前添加队友、敌人、奖励/u.test(gateText)
        && /组队、接受、回答、移动、消费/u.test(gateText),
    dicePoolSemantics: /D4\/D40改成D2\/D5/u.test(gateText)
        && /跨回合擅自维持游标/u.test(gateText),
    originalAnchorAndSingleLevel: /原作锚点/u.test(gateText)
        && /普通\/精英\/首领只能三选一/u.test(gateText),
    contentDoctorBoundary: /不改写、截断或重生成<content>/u.test(gateText),
};
const reproduced = {
    undeclaredDice: undeclaredDice.length > 0,
    overPool: Object.keys(overPool).length > 0,
    aggregateBossPressure: bosses.length >= 3,
    actorShardFailure: Number(actorShard.failed) > 0,
    dueFalseWorldLaneSelection: dueFalseSelected.length > 0,
};
const report = {
    status: Object.values(coverage).every(Boolean)
        && Object.values(reproduced).every(Boolean)
        && mismatches.length === 0
        ? 'regression-reproduced-and-guarded'
        : 'failed',
    generatedAt: new Date().toISOString(),
    inputs: {
        preset: { path: path.resolve(presetPath), sha256: sha256(fs.readFileSync(presetPath)) },
        log: { path: path.resolve(logPath), sha256: sha256(fs.readFileSync(logPath)) },
        diagnostic: {
            path: path.resolve(diagnosticPath),
            sha256: sha256(fs.readFileSync(diagnosticPath)),
        },
        card: { path: path.resolve(cardPath), sha256: sha256(fs.readFileSync(cardPath)) },
    },
    sourceRunRegression: {
        assistantMessages: messages.length,
        declaredDicePools: Object.fromEntries(
            Object.entries(pools).map(([die, values]) => [die, values.length]),
        ),
        observedDiceTypes: unique(dieUses),
        undeclaredDice,
        overPool,
        bossLabels: bosses,
        actorShard: {
            selected: Number(actorShard.selected) || 0,
            succeeded: Number(actorShard.succeeded) || 0,
            failed: Number(actorShard.failed) || 0,
        },
        dueFalseWorldLaneSelections: dueFalseSelected.length,
        reproduced,
    },
    optimizedPreset: {
        name: preset.name,
        promptCount: preset.prompts?.length || 0,
        orderCount: order.length,
        enabledCount: enabled,
        enabledMismatchCount: mismatches.length,
        globalGateOrderIndex: order.findIndex((entry) => entry.identifier === gate?.identifier),
        coverage,
    },
    interpretation: [
        'The historical run is evidence of the regression, not a post-fix model pass.',
        'The optimized preset keeps the source run facts unchanged and adds deterministic submission gates.',
        'A separate real-model QC is still required before release.',
    ],
};
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    status: report.status,
    undeclaredDice,
    overPool,
    bossLabels: bosses.length,
    dueFalseWorldLaneSelections: dueFalseSelected.length,
    coverage,
}));
if (report.status !== 'regression-reproduced-and-guarded') process.exitCode = 1;
