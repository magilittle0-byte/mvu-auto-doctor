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
    const pattern = new RegExp(`<${closing ? '\\/' : ''}${escaped}\\b[^>]*>`, 'giu');
    return [...asText(text).matchAll(pattern)].length;
}

function extractBlocks(text, tag) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`,
        'giu',
    );
    return [...asText(text).matchAll(pattern)].map((match) => match[1]);
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
    const match = asText(replyText).match(
        /【A[·・]S0】[^\n]*(?:时间地点|时间)\s*[:：=]\s*[^\n;；]{0,40}?(\d{1,2}:\d{2})/iu,
    );
    return match?.[1] || '';
}

export function auditReplyProtocol(replyText, {
    contractTexts = [],
    previousUserText = '',
} = {}) {
    const text = asText(replyText);
    const sources = [...contractTexts.map(asText), text];
    const issues = [];
    const contentOpen = countTag(text, 'content');
    const contentClose = countTag(text, 'content', true);
    const contentBlocks = extractBlocks(text, 'content');

    if (contentOpen || contentClose) {
        if (contentOpen !== 1 || contentClose !== 1 || contentBlocks.length !== 1) {
            pushUniqueIssue(issues, {
                code: 'content-tag-count',
                severity: 'error',
                scope: 'structure',
                message: `<content> 必须恰好一组且正确闭合；当前开标签 ${contentOpen} 个、闭标签 ${contentClose} 个、完整区块 ${contentBlocks.length} 个。`,
            });
        }
    }

    const budgets = findWordBudgets(sources);
    if (budgets.length > 1) {
        pushUniqueIssue(issues, {
            code: 'word-budget-conflict',
            severity: 'warning',
            scope: 'contract',
            message: `检测到互相冲突的正文预算：${budgets.map((item) => `${item.min}~${item.max}`).join('、')} 汉字。`,
        });
    }
    const budget = budgets[0] || null;
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
    if (budget && contentBlocks.length === 1 && hanCharacters > budget.max) {
        pushUniqueIssue(issues, {
            code: 'content-over-budget',
            severity: 'error',
            scope: 'length',
            message: `正文约 ${hanCharacters} 个汉字，超过硬上限 ${budget.max}。`,
        });
    }

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
    return {
        issues: [...reply.issues, ...equipment.issues],
        reply: reply.metrics,
        equipment: equipment.metrics,
    };
}
