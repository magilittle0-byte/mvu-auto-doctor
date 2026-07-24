const EQUIPMENT_SLOTS = Object.freeze([
    '头部',
    '躯干',
    '腿部',
    '手部',
    '脚部',
    '主手',
    '副手',
    '饰品1',
    '饰品2',
]);

const EQUIPMENT_FIELDS = Object.freeze([
    '品质',
    '类型',
    '阶位',
    '强化等级',
    '伤害骰',
    '倍率',
    '主属性',
    '副属性',
    '主属性加成',
    '副属性加成',
    '装备防御',
    '装备闪避',
    '负重',
    '效果',
    '描述',
]);

const EQUIPMENT_SIGNAL_FIELDS = Object.freeze([
    '品质',
    '类型',
    '伤害骰',
    '主属性加成',
    '副属性加成',
    '装备防御',
    '装备闪避',
    '强化等级',
]);

const STRICT_EQUIPMENT_NAME = /(?:手枪|步枪|冲锋枪|霰弹枪|猎枪|机枪|砍刀|战刀|斩骨刀|长剑|短剑|匕首|链锯|护甲|装甲|胸甲|头盔|护目镜|护手|手套|战靴|军靴|盾牌|戒指|项链|弓|弩|法杖)/u;
const EQUIPMENT_NAME_EXCLUSION = /(?:弹药|子弹|弹匣|枪套|箭矢|配件|零件|模型|玩具|图纸)/u;
const SLOT_FIELD_NAMES = Object.freeze([
    '装备位置',
    '装备部位',
    '可装备槽位',
    '适用槽位',
]);

function asText(value) {
    return String(value ?? '');
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pushUniqueIssue(issues, issue) {
    const key = `${issue.code}\u0000${issue.path || ''}\u0000${issue.message}`;
    if (issues.some((item) => (
        `${item.code}\u0000${item.path || ''}\u0000${item.message}` === key
    ))) return;
    issues.push(issue);
}

function countTag(text, tag, closing = false) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `<${closing ? '\\/' : ''}${escaped}(?=[\\s>/])[^>]*>`,
        'giu',
    );
    return [...asText(text).matchAll(pattern)].length;
}

function extractBlocks(text, tag) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `<${escaped}(?=[\\s>/])[^>]*>([\\s\\S]*?)<\\/${escaped}\\s*>`,
        'giu',
    );
    return [...asText(text).matchAll(pattern)].map((match) => match[1]);
}

function extractSingleTaggedValue(text, tag) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...asText(text).matchAll(
        new RegExp(
            `<${escaped}(?=[\\s>/])[^>]*>([\\s\\S]*?)<\\/${escaped}\\s*>`,
            'giu',
        ),
    )];
    return matches.length === 1 ? matches[0][1].trim() : null;
}

export function extractHardContractCorrection(output) {
    const block = extractSingleTaggedValue(output, 'HardContractCorrection');
    if (block == null) return null;
    const reason = extractSingleTaggedValue(block, 'Reason') || '';
    const evidence = extractSingleTaggedValue(block, 'Evidence') || '';
    const content = extractSingleTaggedValue(block, 'CorrectedContent');
    const options = extractSingleTaggedValue(block, 'CorrectedOptions');
    if (content == null && options == null) {
        return { error: 'HardContractCorrection 没有 CorrectedContent 或 CorrectedOptions' };
    }
    const mechanismPattern = /<\/?(?:UpdateVariable|JSONPatch|StatusPlaceHolderImpl|HardContractCorrection|Reason|Evidence|CorrectedContent|CorrectedOptions)\b/iu;
    if (
        (content != null && mechanismPattern.test(content))
        || (options != null && mechanismPattern.test(options))
    ) {
        return { error: '正文校正稿混入了变量、状态栏或校正控制标签' };
    }
    return {
        reason: reason.slice(0, 500),
        evidence: evidence.slice(0, 500),
        content,
        options,
    };
}

function normalizedEvidence(value) {
    return asText(value)
        .replace(/\s+/gu, ' ')
        .trim()
        .toLowerCase();
}

export function verifyHardContractEvidence(evidence, sources = []) {
    const needle = normalizedEvidence(evidence);
    if (needle.length < 6) {
        return { ok: false, reason: '规则证据少于6个字符，无法核验' };
    }
    const sourceIndex = sources.findIndex((source) => (
        normalizedEvidence(source).includes(needle)
    ));
    if (sourceIndex < 0) {
        return { ok: false, reason: '规则证据无法在当前 Schema、世界书或预设合同中逐字找到' };
    }
    return { ok: true, sourceIndex, evidence: asText(evidence).trim() };
}

function replaceSingleTagInner(text, tag, replacement) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `(<${escaped}(?=[\\s>/])[^>]*>)[\\s\\S]*?(<\\/${escaped}\\s*>)`,
        'giu',
    );
    const matches = [...asText(text).matchAll(pattern)];
    if (matches.length !== 1) return null;
    return asText(text).replace(
        pattern,
        (_whole, open, close) => `${open}${replacement}${close}`,
    );
}

const CONTENT_TAG_CANDIDATES = Object.freeze([
    'content',
    'gametxt',
    'game_text',
    'storytext',
    'story_text',
    'maintext',
    'main_text',
    'narrative',
    '正文',
    '故事正文',
]);

const NON_CONTENT_TAGS = new Set([
    'updatevariable',
    'jsonpatch',
    'statusplaceholderimpl',
    'hardcontractcorrection',
    'reason',
    'evidence',
    'correctedcontent',
    'correctedoptions',
    'options',
    'scene',
    'style',
    'script',
    'html',
    'head',
    'body',
    'details',
    'summary',
    'think',
    'thinking',
    'cot',
]);

export function detectContentTag(replyText) {
    const text = asText(replyText);
    for (const tag of CONTENT_TAG_CANDIDATES) {
        const open = countTag(text, tag);
        const close = countTag(text, tag, true);
        const blocks = extractBlocks(text, tag);
        if (open || close || blocks.length) {
            return {
                tag,
                source: 'known',
                open,
                close,
                blocks,
            };
        }
    }

    const semantic = /(?:game|story|narr|main|prose|text|正文|故事|叙事)/iu;
    const candidates = [];
    const pattern = /<([A-Za-z][A-Za-z0-9_:-]{0,40}|[\p{Script=Han}]{1,8})(?=[\s>])[^>]*>([\s\S]*?)<\/\1\s*>/giu;
    for (const match of text.matchAll(pattern)) {
        const tag = match[1];
        if (NON_CONTENT_TAGS.has(tag.toLowerCase()) || !semantic.test(tag)) continue;
        const hanCharacters = countHanCharacters(match[2]);
        if (hanCharacters < 20) continue;
        candidates.push({ tag, hanCharacters });
    }
    candidates.sort((left, right) => right.hanCharacters - left.hanCharacters);
    const winner = candidates[0];
    if (!winner) return null;
    return {
        tag: winner.tag,
        source: 'semantic',
        open: countTag(text, winner.tag),
        close: countTag(text, winner.tag, true),
        blocks: extractBlocks(text, winner.tag),
    };
}

export function applyHardContractCorrection(replyText, correction) {
    if (!correction || correction.error) {
        return { error: correction?.error || '没有可应用的正文校正' };
    }
    let text = asText(replyText);
    const contentDetection = detectContentTag(text);
    const contentTag = contentDetection?.tag || 'content';
    if (correction.content != null) {
        const replaced = replaceSingleTagInner(text, contentTag, correction.content);
        if (replaced == null) {
            return { error: `原回复没有恰好一组可安全替换的 <${contentTag}>` };
        }
        text = replaced;
    }
    if (correction.options != null) {
        const optionsOpen = countTag(text, 'options');
        const optionsClose = countTag(text, 'options', true);
        if (optionsOpen === 1 && optionsClose === 1) {
            const replaced = replaceSingleTagInner(text, 'options', correction.options);
            if (replaced == null) {
                return { error: '原回复的 <options> 结构无法安全替换' };
            }
            text = replaced;
        } else if (optionsOpen === 0 && optionsClose === 0) {
            const escapedContentTag = contentTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const contentClose = new RegExp(`<\\/${escapedContentTag}\\s*>`, 'iu');
            if (contentClose.test(text)) {
                text = text.replace(
                    contentClose,
                    (tag) => `${tag}\n\n<options>\n${correction.options}\n</options>`,
                );
            } else {
                const mechanismStart = text.search(/<UpdateVariable\b/iu);
                const block = `<options>\n${correction.options}\n</options>\n\n`;
                text = mechanismStart >= 0
                    ? `${text.slice(0, mechanismStart)}${block}${text.slice(mechanismStart)}`
                    : `${text.trimEnd()}\n\n${block.trimEnd()}`;
            }
        } else {
            return { error: '原回复的 <options> 标签不平衡，无法自动插入校正稿' };
        }
    }
    return { text };
}

function normalizeAgencyText(text) {
    return stripTags(text)
        .replace(/[\s\p{P}\p{S}]+/gu, '')
        .toLowerCase();
}

function agencyClauses(text) {
    const prose = contentProse(text);
    const clauses = prose
        .split(/[。！？!?；;\n]/u)
        .map((item) => item.trim())
        .filter(Boolean);
    const decisiveAction = /你[^。！？\n]{0,18}(?:决定|选择|改为|转而|前往|进入|离开|撤退|追击|接受|拒绝|答应|购买|拾取|搜索|调查|休息|治疗|打开|关闭|拿出|换上|装备|使用|发动|施展|激活|启动)/u;
    const dialogue = /你[^。！？\n]{0,12}(?:说|问|回答|答道|喊|叫|命令|承诺|解释|撒谎|表示)[：:，“"]/u;
    const check = /你[^。！？\n]{0,24}(?:检定|掷骰|投骰|重掷|补投|DC\s*\d+|\bd20\b)/iu;
    return clauses.filter((clause) => (
        decisiveAction.test(clause)
        || dialogue.test(clause)
        || check.test(clause)
    ));
}

export function auditCorrectionAgencyGuard(originalReply, correctedReply, {
    skillNames = [],
} = {}) {
    const original = normalizeAgencyText(originalReply);
    const violations = [];
    for (const clause of agencyClauses(correctedReply)) {
        const normalized = normalizeAgencyText(clause);
        if (normalized && !original.includes(normalized)) {
            violations.push({
                code: 'new-player-agency-clause',
                message: `修正版新增了可能需要玩家授权的行动、对白或检定：${clause.slice(0, 120)}`,
            });
        }
    }
    const originalContent = contentProse(originalReply);
    const correctedContent = contentProse(correctedReply);
    for (const rawName of skillNames) {
        const name = asText(rawName).trim();
        if (!name || originalContent.includes(name) || !correctedContent.includes(name)) continue;
        violations.push({
            code: 'new-player-skill',
            message: `修正版新增了原回复未使用的玩家技能“${name}”。`,
        });
    }
    const unique = violations.filter((violation, index, all) => (
        all.findIndex((item) => (
            item.code === violation.code && item.message === violation.message
        )) === index
    ));
    return { ok: unique.length === 0, violations: unique };
}

function stripTags(text) {
    return asText(text)
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
        .replace(/<[^>]+>/gu, '');
}

export function countHanCharacters(text) {
    return [...stripTags(text).matchAll(/\p{Script=Han}/gu)].length;
}

function findWordBudgets(sources) {
    const budgets = [];
    const seen = new Set();
    const pattern = /(?:【预算】\s*)?(?:正文(?:预算)?|预算[^\n]{0,16}正文)\s*[:：=]?\s*(\d{2,5})\s*(?:~|～|—|–|-|至)\s*(\d{2,5})\s*(?:个?汉字|字)/giu;
    for (const source of sources) {
        for (const match of asText(source).matchAll(pattern)) {
            const min = Number(match[1]);
            const max = Number(match[2]);
            if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) continue;
            const key = `${min}:${max}`;
            if (seen.has(key)) continue;
            seen.add(key);
            budgets.push({ min, max, evidence: match[0] });
        }
    }
    return budgets;
}

function expectedOptionCount(sources) {
    for (const source of sources) {
        const text = asText(source);
        if (/(?:结尾|输出|提供|生成|候选)[^\n]{0,28}(?:四|4)(?:个|项)?[^\n]{0,12}选项|结尾四项候选/iu.test(text)) {
            return 4;
        }
    }
    return 0;
}

function optionCount(block) {
    return [...asText(block).matchAll(
        /^\s*>\s*选项(?:[一二三四五六七八九十]|\d+)\s*[:：]/gmu,
    )].length;
}

function auditUpdateBlocks(text, issues) {
    const openCount = countTag(text, 'UpdateVariable');
    const closeCount = countTag(text, 'UpdateVariable', true);
    if (openCount !== closeCount) {
        pushUniqueIssue(issues, {
            code: 'update-tag-unbalanced',
            severity: 'error',
            scope: 'structure',
            message: `<UpdateVariable> 未闭合：开标签 ${openCount} 个，闭标签 ${closeCount} 个。`,
        });
    }
    const blocks = extractBlocks(text, 'UpdateVariable');
    blocks.forEach((block, index) => {
        const patches = extractBlocks(block, 'JSONPatch');
        if (patches.length !== 1) {
            pushUniqueIssue(issues, {
                code: 'jsonpatch-block-count',
                severity: 'error',
                scope: 'structure',
                path: `UpdateVariable[${index}]`,
                message: `第 ${index + 1} 个变量区块应有且仅有一个 <JSONPatch>，实际为 ${patches.length} 个。`,
            });
            return;
        }
        try {
            const parsed = JSON.parse(patches[0].trim());
            if (!Array.isArray(parsed)) throw new Error('JSONPatch 不是数组');
        } catch (error) {
            pushUniqueIssue(issues, {
                code: 'jsonpatch-invalid-json',
                severity: 'error',
                scope: 'structure',
                path: `UpdateVariable[${index}].JSONPatch`,
                message: `第 ${index + 1} 个 JSONPatch 不是合法 JSON 数组：${error.message}`,
            });
        }
    });
}

function sceneClock(previousUserText) {
    const scene = extractBlocks(previousUserText, 'scene').at(-1) || '';
    const match = scene.match(
        /Day\s*[:：]\s*\d+\s*[,，]\s*(\d{1,2}:\d{2})|(?:时间|当前时间|客观时间)\s*[:：=]\s*[^\n]{0,20}?(\d{1,2}:\d{2})/iu,
    );
    return match?.[1] || match?.[2] || '';
}

function planningStartClock(replyText) {
    const line = asText(replyText).match(/【A[·・](?:S0|边界)】([^\n]*)/iu)?.[1] || '';
    const anchored = line.match(
        /(?:S0\s*)?时间(?:地点|\s*[/／]\s*地点)?[\s\S]{0,160}?(\d{1,2}:\d{2})/iu,
    );
    return anchored?.[1] || '';
}

export function auditReplyProtocol(replyText, {
    contractTexts = [],
    previousUserText = '',
} = {}) {
    const text = asText(replyText);
    const sources = [...contractTexts.map(asText), text];
    const issues = [];
    const contentDetection = detectContentTag(text);
    const contentTag = contentDetection?.tag || '';
    const contentOpen = contentTag ? countTag(text, contentTag) : 0;
    const contentClose = contentTag ? countTag(text, contentTag, true) : 0;
    const contentBlocks = contentTag ? extractBlocks(text, contentTag) : [];

    if (contentOpen || contentClose) {
        if (contentOpen !== 1 || contentClose !== 1 || contentBlocks.length !== 1) {
            pushUniqueIssue(issues, {
                code: 'content-tag-count',
                severity: 'error',
                scope: 'structure',
                message: `<${contentTag}> 必须恰好一组且正确闭合；当前开标签 ${contentOpen} 个、闭标签 ${contentClose} 个、完整区块 ${contentBlocks.length} 个。`,
            });
        }
    }

    const contractBudgets = findWordBudgets(contractTexts);
    const replyBudgets = findWordBudgets([text]);
    const budgets = findWordBudgets(sources);
    if (budgets.length > 1) {
        pushUniqueIssue(issues, {
            code: 'word-budget-conflict',
            severity: 'warning',
            scope: 'contract',
            message: `检测到互相冲突的正文预算：${budgets.map((item) => `${item.min}~${item.max}`).join('、')} 汉字。`,
        });
    }
    // Active preset prompts are collected after card/world-book contracts.
    // Prefer their latest explicit range; only fall back to a range echoed in
    // the reply when no authoritative contract exposed one.
    const budget = contractBudgets.at(-1) || replyBudgets.at(-1) || null;
    const hanCharacters = contentBlocks.length === 1
        ? countHanCharacters(contentBlocks[0])
        : 0;
    if (budget && contentBlocks.length === 1 && hanCharacters < budget.min) {
        pushUniqueIssue(issues, {
            code: 'content-under-budget',
            severity: 'error',
            scope: 'length',
            message: `正文约 ${hanCharacters} 个汉字，低于硬下限 ${budget.min}。`,
        });
    }
    if (budget && !contentTag) {
        pushUniqueIssue(issues, {
            code: 'content-tag-unrecognized',
            severity: 'warning',
            scope: 'structure',
            message: '检测到正文长度合同，但没有识别到可靠的正文包裹标签；已明确跳过字数统计，避免把状态栏或变量区块误算为正文。',
        });
    }
    // The right side is the normal writing target, not a hard ceiling. Natural
    // paragraph endings and completed causal waves may exceed it; only the left
    // side is an acceptance gate and may trigger automatic correction.

    const optionsOpen = countTag(text, 'options');
    const optionsClose = countTag(text, 'options', true);
    const optionBlocks = extractBlocks(text, 'options');
    const expectedOptions = expectedOptionCount(sources);
    const actualOptions = optionBlocks.length === 1 ? optionCount(optionBlocks[0]) : 0;
    if (optionsOpen || optionsClose || expectedOptions) {
        if (optionsOpen !== 1 || optionsClose !== 1 || optionBlocks.length !== 1) {
            pushUniqueIssue(issues, {
                code: 'options-tag-count',
                severity: 'error',
                scope: 'structure',
                message: `<options> 必须恰好一组且正确闭合；当前开标签 ${optionsOpen} 个、闭标签 ${optionsClose} 个、完整区块 ${optionBlocks.length} 个。`,
            });
        } else if (expectedOptions && actualOptions !== expectedOptions) {
            pushUniqueIssue(issues, {
                code: 'option-count',
                severity: 'error',
                scope: 'structure',
                message: `硬合同要求 ${expectedOptions} 个结尾选项，实际识别到 ${actualOptions} 个。`,
            });
        }
    }

    auditUpdateBlocks(text, issues);

    const diceAfterLock = text.match(/【骰后锁】([\s\S]*?)(?=【小此判后】|【S1[·・]出门】|<content>|$)/u)?.[1] || '';
    if (/(?:后续|其余|剩余)[^\n]{0,32}(?:结果)?(?:设定|视为|默认为)成功|结果设定为成功/iu.test(diceAfterLock)) {
        pushUniqueIssue(issues, {
            code: 'fabricated-dice-outcome',
            severity: 'error',
            scope: 'dice',
            message: '骰后锁把未实际消费骰源的后续结果直接设定为成功，违反硬骰子合同。',
        });
    }
    if (
        /(?:重来重来|重新投(?:掷)?|重掷|补投)/u.test(diceAfterLock)
        && (
            /(?:双掷|补判)\s*[×x✕]/iu.test(text)
            || /唯一骰源|不得[^\n]{0,16}(?:重掷|补投|重投|双掷)/iu.test(sources.join('\n'))
        )
    ) {
        pushUniqueIssue(issues, {
            code: 'dice-lock-self-contradiction',
            severity: 'error',
            scope: 'dice',
            message: '骰后锁内出现重新投掷/补投，但同一回复又声明“无双掷/无补判”。',
        });
    }

    const sceneTime = sceneClock(previousUserText);
    const s0Time = planningStartClock(text);
    if (sceneTime && s0Time && sceneTime !== s0Time) {
        pushUniqueIssue(issues, {
            code: 'scene-time-mismatch',
            severity: 'error',
            scope: 'time',
            message: `用户 <scene> 的当前时间为 ${sceneTime}，A·S0 却从 ${s0Time} 起算。`,
        });
    }

    return {
        issues,
        metrics: {
            contentTag,
            contentTagSource: contentDetection?.source || '',
            contentBlocks: contentBlocks.length,
            hanCharacters,
            budget,
            optionBlocks: optionBlocks.length,
            actualOptions,
            expectedOptions,
            updateBlocks: extractBlocks(text, 'UpdateVariable').length,
            sceneTime,
            s0Time,
        },
    };
}

function walkObjects(root, visitor, path = '', depth = 0, seen = new Set()) {
    if (!isPlainObject(root) || depth > 10 || seen.has(root)) return;
    seen.add(root);
    visitor(root, path);
    for (const [key, value] of Object.entries(root)) {
        if (!isPlainObject(value)) continue;
        walkObjects(value, visitor, path ? `${path}.${key}` : key, depth + 1, seen);
    }
}

function contentProse(replyText) {
    const detection = detectContentTag(replyText);
    const blocks = detection?.blocks || [];
    return blocks.length === 1 ? stripTags(blocks[0]) : stripTags(replyText);
}

function collectNumericLeaves(root, path = '', result = [], depth = 0) {
    if (depth > 12 || root == null) return result;
    if (typeof root === 'number' && Number.isFinite(root)) {
        result.push({ path, value: root });
        return result;
    }
    if (!isPlainObject(root) && !Array.isArray(root)) return result;
    for (const [key, value] of Object.entries(root)) {
        collectNumericLeaves(value, path ? `${path}.${key}` : key, result, depth + 1);
    }
    return result;
}

function resourceNamePattern(resource) {
    const escaped = resource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/^(?:MP|法力|魔力)$/iu.test(resource)) return /(?:MP|法力|魔力)/iu;
    if (/^(?:HP|生命)$/iu.test(resource)) return /(?:HP|生命)/iu;
    if (/^(?:耐力|体力)$/u.test(resource)) return /(?:耐力|体力)/u;
    return new RegExp(escaped, 'iu');
}

function currentResourceLeaf(leaves, resource) {
    const resourcePattern = resourceNamePattern(resource);
    return leaves.find((leaf) => (
        resourcePattern.test(leaf.path)
        && /(?:当前|现有|current|cur)(?:值)?$/iu.test(leaf.path.split('.').at(-1))
    )) || leaves.find((leaf) => (
        resourcePattern.test(leaf.path)
        && /(?:当前|现有|current|cur)/iu.test(leaf.path)
        && !/(?:最大|上限|max)/iu.test(leaf.path)
    ));
}

function parseSkillCosts(value) {
    const costs = [];
    for (const match of asText(value).matchAll(
        /(\d+(?:\.\d+)?)\s*(MP|HP|耐力|体力|法力|魔力|能量)/giu,
    )) {
        const amount = Number(match[1]);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        costs.push({ amount, resource: match[2] });
    }
    return costs;
}

function skillWasUsed(prose, skillName) {
    const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return asText(prose)
        .split(/[。！？\n]/u)
        .filter((sentence) => new RegExp(escaped, 'iu').test(sentence))
        .some((sentence) => {
            const modal = new RegExp(
                `(?:可以|可选择|建议|尝试|准备|打算|计划|若要|能够)[^，；]{0,12}`
                + `(?:使用|发动|施展|激活|启动|释放|施放|运用|催动)[^，；]{0,24}${escaped}`,
                'iu',
            );
            if (modal.test(sentence)) return false;
            return new RegExp(
                `(?:使用|发动|施展|激活|启动|释放|施放|运用|催动)[^，；]{0,32}${escaped}`
                + `|${escaped}[^，；]{0,32}(?:发动|生效|启动|释放|施放|命中|接管|侵入|完成)`,
                'iu',
            ).test(sentence);
        });
}

export function auditSkillResourceCosts(replyText, previousStatData, currentStatData) {
    const issues = [];
    if (!isPlainObject(previousStatData) || !isPlainObject(currentStatData)) {
        return { issues, metrics: { checkedSkills: 0, checkedResources: 0 } };
    }
    const prose = contentProse(replyText);
    const costs = [];
    walkObjects(currentStatData, (node, path) => {
        if (typeof node.消耗 !== 'string' || !node.消耗.trim()) return;
        const name = path.split('.').at(-1) || asText(node.名称).trim();
        if (!name || !prose.includes(name) || !skillWasUsed(prose, name)) return;
        for (const cost of parseSkillCosts(node.消耗)) {
            costs.push({ ...cost, skill: name, skillPath: path });
        }
    });
    const expectedByResource = new Map();
    for (const cost of costs) {
        const key = /^(?:MP|法力|魔力)$/iu.test(cost.resource)
            ? 'MP'
            : /^(?:HP|生命)$/iu.test(cost.resource)
                ? 'HP'
                : /^(?:耐力|体力)$/u.test(cost.resource)
                    ? '耐力'
                    : cost.resource;
        const entry = expectedByResource.get(key) || { amount: 0, skills: [] };
        entry.amount += cost.amount;
        entry.skills.push(cost.skill);
        expectedByResource.set(key, entry);
    }

    const previousLeaves = collectNumericLeaves(previousStatData);
    const currentLeaves = collectNumericLeaves(currentStatData);
    let checkedResources = 0;
    for (const [resource, expected] of expectedByResource) {
        const before = currentResourceLeaf(previousLeaves, resource);
        const after = currentResourceLeaf(currentLeaves, resource);
        if (!before || !after || before.path !== after.path) continue;
        checkedResources += 1;
        const spent = before.value - after.value;
        if (spent + 1e-9 >= expected.amount) continue;
        pushUniqueIssue(issues, {
            code: 'skill-resource-cost-missing',
            severity: 'error',
            scope: 'resource',
            path: after.path,
            message: `正文明确发动“${[...new Set(expected.skills)].join('、')}”，规则合计消耗 ${expected.amount} ${resource}，但该资源本回合只减少 ${Math.max(0, spent)}。`,
        });
    }
    return {
        issues,
        metrics: {
            checkedSkills: new Set(costs.map((cost) => cost.skill)).size,
            checkedResources,
        },
    };
}

function inventoryContractRequiresFields(text) {
    return /背包[\s\S]{0,260}(?:描述[\s\S]{0,80}数量|数量[\s\S]{0,80}描述)/u.test(text);
}

export function auditInventoryContracts(statData, {
    schemaTexts = [],
    ruleTexts = [],
} = {}) {
    const issues = [];
    const contractText = [...schemaTexts, ...ruleTexts].map(asText).join('\n');
    const requiresFields = inventoryContractRequiresFields(contractText);
    let bagCount = 0;
    let itemCount = 0;
    walkObjects(statData, (node, path) => {
        if (!isPlainObject(node.背包)) return;
        bagCount += 1;
        for (const [name, item] of Object.entries(node.背包)) {
            itemCount += 1;
            const itemPath = `${path ? `${path}.` : ''}背包.${name}`;
            if (!isPlainObject(item)) {
                pushUniqueIssue(issues, {
                    code: 'inventory-item-not-object',
                    severity: 'error',
                    scope: 'inventory',
                    path: itemPath,
                    message: `${name} 不是物品对象，无法满足背包格式。`,
                });
                continue;
            }
            if (requiresFields) {
                const missing = ['描述', '数量'].filter((field) => !(field in item));
                if (missing.length) {
                    pushUniqueIssue(issues, {
                        code: 'inventory-item-fields-incomplete',
                        severity: 'error',
                        scope: 'inventory',
                        path: itemPath,
                        message: `${name} 缺少背包硬合同字段：${missing.join('、')}。`,
                    });
                }
            }
            if (
                Object.prototype.hasOwnProperty.call(item, '数量')
                && (
                    typeof item.数量 !== 'number'
                    || !Number.isFinite(item.数量)
                    || item.数量 < 0
                )
            ) {
                pushUniqueIssue(issues, {
                    code: 'inventory-quantity-invalid',
                    severity: 'error',
                    scope: 'inventory',
                    path: `${itemPath}.数量`,
                    message: `${name} 的数量必须是非负有限数字。`,
                });
            }
        }
    });
    return { issues, metrics: { bagCount, itemCount, requiresFields } };
}

function nonEmptyEquipment(item) {
    if (!isPlainObject(item)) return false;
    const name = asText(item.名称).trim();
    return !!name && name !== '无';
}

function equipmentSlotValues(item) {
    for (const key of SLOT_FIELD_NAMES) {
        const value = item?.[key];
        if (Array.isArray(value)) {
            return value.map(asText).map((itemValue) => itemValue.trim()).filter(Boolean);
        }
        if (typeof value === 'string' && value.trim()) {
            return value.split(/[、,，/|]/u).map((itemValue) => itemValue.trim()).filter(Boolean);
        }
    }
    return [];
}

function normalizedSlot(slot) {
    return /^饰品[12]?$/u.test(slot) ? '饰品' : slot;
}

function slotAccepted(actualSlot, allowedSlots) {
    const actual = normalizedSlot(actualSlot);
    return allowedSlots.some((slot) => {
        const normalized = normalizedSlot(slot);
        if (normalized === actual) return true;
        if (actual === '主手' || actual === '副手') {
            return /^(?:武器|手持|主副手)$/u.test(normalized);
        }
        return false;
    });
}

function equipmentContractDeclaresSlot(text) {
    return /(?:装备位置|装备部位|可装备槽位|适用槽位)/u.test(text);
}

function equipmentContractRequiresCompleteBagItem(text) {
    return /完整装备字段|背包[\s\S]{0,180}(?:装备|武器|防具)[\s\S]{0,180}(?:品质|类型|伤害骰|装备防御|主属性加成)/u.test(text);
}

export function auditEquipmentContracts(statData, {
    schemaTexts = [],
    ruleTexts = [],
} = {}) {
    const issues = [];
    const contractText = [...schemaTexts, ...ruleTexts].map(asText).join('\n');
    const declaresSlot = equipmentContractDeclaresSlot(contractText);
    const requiresCompleteBagItem = equipmentContractRequiresCompleteBagItem(contractText);
    const equipped = [];
    const bags = [];

    walkObjects(statData, (node, path) => {
        if (isPlainObject(node.装备) && EQUIPMENT_SLOTS.some((slot) => slot in node.装备)) {
            for (const slot of EQUIPMENT_SLOTS) {
                const item = node.装备[slot];
                if (nonEmptyEquipment(item)) {
                    equipped.push({
                        path: `${path ? `${path}.` : ''}装备.${slot}`,
                        slot,
                        item,
                    });
                }
            }
        }
        if (isPlainObject(node.背包)) {
            bags.push({
                path: `${path ? `${path}.` : ''}背包`,
                items: node.背包,
            });
        }
    });

    const equippedWithMetadata = equipped.filter(({ item }) => (
        equipmentSlotValues(item).length > 0
    ));
    if (equipped.length && !declaresSlot && !equippedWithMetadata.length) {
        pushUniqueIssue(issues, {
            code: 'equipment-slot-contract-gap',
            severity: 'warning',
            scope: 'equipment-schema',
            message: `检测到 ${equipped.length} 件已装备物，但 Schema/规则没有“可装备槽位/装备位置”字段；槽位只存在于当前路径，物品回到背包后无法无歧义判断应穿到哪里。`,
        });
    }

    for (const entry of equipped) {
        const allowed = equipmentSlotValues(entry.item);
        if (declaresSlot && !allowed.length) {
            pushUniqueIssue(issues, {
                code: 'equipment-slot-metadata-missing',
                severity: 'error',
                scope: 'equipment',
                path: entry.path,
                message: `${entry.item.名称} 已装备在“${entry.slot}”，但缺少 Schema 已声明的装备槽位标签。`,
            });
        } else if (allowed.length && !slotAccepted(entry.slot, allowed)) {
            pushUniqueIssue(issues, {
                code: 'equipment-slot-mismatch',
                severity: 'error',
                scope: 'equipment',
                path: entry.path,
                message: `${entry.item.名称} 的可装备槽位为“${allowed.join('、')}”，当前却位于“${entry.slot}”。`,
            });
        }
    }

    for (const bag of bags) {
        for (const [name, rawItem] of Object.entries(bag.items)) {
            if (!isPlainObject(rawItem)) continue;
            const presentSignals = EQUIPMENT_SIGNAL_FIELDS.filter((field) => field in rawItem);
            const looksLikeEquipment = presentSignals.length > 0 || (
                STRICT_EQUIPMENT_NAME.test(name)
                && !EQUIPMENT_NAME_EXCLUSION.test(name)
            );
            if (!looksLikeEquipment) continue;
            const missing = EQUIPMENT_FIELDS.filter((field) => !(field in rawItem));
            const path = `${bag.path}.${name}`;

            if (!presentSignals.length) {
                pushUniqueIssue(issues, {
                    code: 'bag-equipment-unclassified',
                    severity: requiresCompleteBagItem ? 'warning' : 'info',
                    scope: 'equipment',
                    path,
                    message: `${name} 的名称明显像装备，但对象只有普通物品字段；程序无法确认它是装备、完整属性或可装备槽位。`,
                });
                continue;
            }
            if (requiresCompleteBagItem && missing.length) {
                pushUniqueIssue(issues, {
                    code: 'bag-equipment-fields-incomplete',
                    severity: 'error',
                    scope: 'equipment',
                    path,
                    message: `${name} 已带装备字段，但缺少完整装备合同中的字段：${missing.join('、')}。`,
                });
            }
        }
    }

    return {
        issues,
        metrics: {
            equippedCount: equipped.length,
            bagCount: bags.reduce((sum, bag) => sum + Object.keys(bag.items).length, 0),
            declaresSlot,
            requiresCompleteBagItem,
            slotMetadataCount: equippedWithMetadata.length,
        },
    };
}

export function auditHardContracts({
    replyText = '',
    previousUserText = '',
    contractTexts = [],
    statData = {},
    previousStatData = null,
    schemaTexts = [],
    ruleTexts = [],
} = {}) {
    const reply = auditReplyProtocol(replyText, {
        contractTexts,
        previousUserText,
    });
    const equipment = auditEquipmentContracts(statData, {
        schemaTexts,
        ruleTexts,
    });
    const resources = auditSkillResourceCosts(
        replyText,
        previousStatData,
        statData,
    );
    const inventory = auditInventoryContracts(statData, {
        schemaTexts,
        ruleTexts,
    });
    return {
        issues: [
            ...reply.issues,
            ...resources.issues,
            ...inventory.issues,
            ...equipment.issues,
        ],
        reply: reply.metrics,
        resources: resources.metrics,
        inventory: inventory.metrics,
        equipment: equipment.metrics,
    };
}
