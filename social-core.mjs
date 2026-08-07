const RELATION_KEY_RE = /(?:关系|好感|信任|信赖|亲密|羁绊|忠诚|服从|依赖|依恋|恐惧|敬畏|崇拜|态度|感情|relationship|affection|trust|intimacy|bond|loyalty|obedience|dependen|attachment|fear|reverence)/iu;
const EXTREME_SOCIAL_RE = /(?:绝望|崩溃|疯狂|狂热|病态|信徒|奴隶|所有物|饲养|豢养|支配|控制欲|占有欲|剥夺.{0,12}自主|人格.{0,8}(?:消失|覆写|抹除)|永久.{0,8}(?:服从|忠诚)|absolute\s+(?:obedience|devotion)|despair|fanatic|enslav|ownership)/iu;
const MOTIVE_ATTRIBUTION_RE = /(?:其实|真正|显然|无疑|本质上|不过是|只是为了|目的(?:就是|在于)|意图(?:就是|在于)|想要借此|以此来).{0,28}(?:试探|操纵|控制|支配|占有|饲养|豢养|剥夺|利用|下手|驯服)|(?:试探|操纵|控制|支配|占有|饲养|豢养|剥夺|利用|驯服).{0,20}(?:目的|意图|打算)/iu;
const COERCION_RE = /(?:洗脑|精神控制|心智控制|契约命令|强制服从|人格覆写|催眠|奴役|被迫|coerc|mind\s*control|brainwash|compulsion)/iu;
const ORDINARY_CARE_RE = /(?:买|带|送|递|给).{0,12}(?:茶|水|饭|食物|药|绷带|礼物)|(?:问|询问|打听).{0,16}(?:夜班|兼职|工作|伤势|需不需要|要不要)|(?:照顾|帮忙|道歉|感谢|请客|聊天|谈心|陪同)/iu;
const TOTALIZING_IDENTITY_RE = /(?:不再是.{0,18}而是(?:一件|一个|纯粹的)|眼(?:里|中).{0,8}只剩|彻底(?:失去|抹去|变成|沦为).{0,18}(?:人格|人性|理智|工具|武器)|(?:整个人|全部人格).{0,12}(?:只剩|化作|变成))/iu;
const GENERIC_EXTREME_LABEL_RE = /(?:冷酷|冰冷|暴戾|粗暴|凶狠|残忍|疯狂|狂热|病态|绝望|空洞|麻木|结结巴巴|瑟瑟发抖|杀意|致命武器)/giu;
const TYPOLOGY_SHORTCUT_RE = /(?:\b(?:INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b|\b[1-9]w[1-9]\b|\btritype\b|MBTI|九型人格|三型组合|依恋类型|安全型依恋|焦虑型依恋|回避型依恋|恐惧型依恋|病娇|地雷系|白切黑|抖[SM]|S\s*\/\s*M)/iu;
const UNIFORM_GROUP_RE = /(?:(?:所有人|众人|全员|三人|几人|他们|她们).{0,48}(?:同时|齐齐|一齐|异口同声|都).{0,28}|(?:同时|齐齐|一齐|异口同声).{0,36})(?:沉默|发抖|冷笑|愤怒|绝望|崇拜|恐惧|麻木|冷酷|服从)/iu;

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function escapePointerPart(value) {
    return String(value).replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function pointerPath(parts) {
    return parts.length ? `/${parts.map(escapePointerPart).join('/')}` : '';
}

function stripBlock(text, tag) {
    const complete = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'giu');
    const dangling = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, 'iu');
    return String(text || '').replace(complete, '').replace(dangling, '');
}

export function stripClosedProposals(text) {
    return stripBlock(stripBlock(text, 'options'), 'branches')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();
}

function sanitizeContent(content) {
    if (typeof content === 'string') return stripClosedProposals(content);
    if (!Array.isArray(content)) return content;
    return content.map((part) => (
        isPlainObject(part) && typeof part.text === 'string'
            ? { ...part, text: stripClosedProposals(part.text) }
            : part
    ));
}

export function sanitizeClosedProposalMessages(messages) {
    let removed = 0;
    for (const message of Array.isArray(messages) ? messages : []) {
        if (String(message?.role || '').toLowerCase() !== 'assistant') continue;
        const before = JSON.stringify(message.content);
        const after = sanitizeContent(message.content);
        if (JSON.stringify(after) === before) continue;
        message.content = after;
        removed += 1;
    }
    return removed;
}

export function buildSocialNarrativeContract() {
    return [
        '<Social_Motive_And_Autonomy_Contract>',
        '这是人物因果与活人感合同，不要求故事变得温暖，也不削弱明确的黑暗题材。',
        '1. 本轮用户明确表达的行动、对白与目的，是玩家角色当前动机的最高权威。除非用户明说、能力/契约明确生效，或当前可观察证据唯一支持，否则不得由旁白补写“其实是在试探、控制、饲养、占有或准备下手”等隐藏动机。',
        '2. NPC可以怀疑，但必须写成NPC基于具体经历产生的有限判断；NPC的怀疑不是全知事实，也不能自动覆盖用户本轮的明确善意。',
        '3. 普通行为允许保持普通：买茶、带饭、送药、询问工作、聊天、道歉、照顾或并肩行动，不必强行升级为关系转折、阴谋、救赎或支配。',
        '4. 人物可以恐惧、愤怒、痛苦、绝望或狂热，但强烈情绪必须有当前刺激、个体阈值与后续恢复空间。单次事件不能无依据永久改写人格。',
        '5. 自愿态度与强制状态必须分开。洗脑、契约、威胁或心智控制造成的服从，不等于好感、信任、亲密、忠诚或崇拜上升。',
        '6. 持久关系只在明确双向选择、标志性事件或可追溯的重复模式后改变；没有足够证据时允许维持原关系。',
        '7. 历史黑暗行为可以让NPC保持警惕，却不能让全知旁白把玩家以后每次普通行为都裁定为虚伪。黑暗角色也可以在某一回合真诚关心别人。',
        '8. NPC必须保留自己的现实目标、边界、习惯、信息局限和下一步行动；不得只围绕玩家的善恶、支配或爱欲运转。',
        '9. 上一轮assistant中的<options>或<branches>属于未执行候选。只有用户实际发送的选择才成为事实、动机、记忆、关系证据或未来方向。',
        '10. 回应当前用户输入时直接承接它造成的新动作与反应。除非理解本轮因果不可缺少，不要先复述上一轮正文再开始本轮。',
        '11. 若用户明确选择威胁、操纵、洗脑、人格覆写、主奴关系或其他黑暗行为，按设定、能力、检定、代价和连续证据如实处理；本合同禁止的是无依据加码，不是洗白。',
        '12. 职业、阵营与本轮情绪不是完整人格。打手不默认咆哮虐待，专业人士不默认冷酷面具，聪明人不默认全知操纵，胆小不默认结巴失能，战士不默认成为“杀意武器”。',
        '13. 新的持续NPC至少保留一种自己的社交办法、决策办法、现实欲望、边界、习惯或盲点；同场多人不得只靠更换姓名复用同一组极端形容词与反应。',
        '14. 强烈情绪是状态层，不是身份层。恐惧、愤怒、绝望或服从发生时，人物仍保留长期目标、能力、习惯、关系分寸与恢复路径；除非有明确永久机制和连续证据，不用一句总判词封死人格。',
        '15. 黑暗内容可以维持原强度，但先用可观察行为、有代价的选择和个体阈值呈现；若删掉姓名后两人的台词、动作和目标仍可互换，必须把其中一人的决定方式写出差异。',
        '16. 不使用MBTI、九型、Tritype、依恋型、星座、病娇/地雷/白切黑/S-M等标签代替塑造。角色卡若明确给出标签，也只视作弱偏好；训练、职责与经验可以产生和偏好相反的熟练能力。',
        '17. 持续人物按证据逐步显出信息取样与典型误读、受压反应与恢复路径、对不同对象的关系距离、自我形象与行为缝隙、习得的逆倾向能力。没有证据的维度保持未知，不为填表发明创伤或反差。',
        '18. 首次出场正文最多显露三项人物差异，优先是当下目标、决定办法和一个普通细节；不要首段塞满身世、创伤、怪癖、口癖、类型与阴谋。同场群像先覆盖所有具名持续NPC，再按不同依据、顺序和代价行动。',
        '</Social_Motive_And_Autonomy_Contract>',
    ].join('\n');
}

export function collectRelationshipChanges(before, after, limit = 80) {
    const changes = [];
    let omitted = 0;

    function record(parts, oldValue, newValue) {
        if (changes.length >= limit) {
            omitted += 1;
            return;
        }
        changes.push({
            path: pointerPath(parts),
            beforeExists: oldValue !== undefined,
            afterExists: newValue !== undefined,
            before: clone(oldValue),
            after: clone(newValue),
        });
    }

    function walk(oldValue, newValue, parts, relationScope = false) {
        if (oldValue === newValue) return;
        const key = parts.at(-1) || '';
        const scoped = relationScope || RELATION_KEY_RE.test(key);
        if (Array.isArray(oldValue) || Array.isArray(newValue)) {
            if (scoped && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                record(parts, oldValue, newValue);
            }
            return;
        }
        if (isPlainObject(oldValue) && isPlainObject(newValue)) {
            const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
            for (const child of keys) {
                walk(oldValue[child], newValue[child], [...parts, child], scoped);
            }
            return;
        }
        if (scoped) record(parts, oldValue, newValue);
    }

    walk(before, after, []);
    return { changes, omitted };
}

export function classifySocialAuditNeed({
    userText = '',
    replyText = '',
    changes = [],
    mode = 'balanced',
} = {}) {
    if (mode === 'off') return { needed: false, reasons: [] };
    const combined = `${userText}\n${replyText}`;
    const reasons = [];
    if (changes.length) reasons.push('relationship-change');
    if (EXTREME_SOCIAL_RE.test(replyText)) reasons.push('extreme-social-language');
    if (MOTIVE_ATTRIBUTION_RE.test(replyText)) reasons.push('player-motive-attribution');
    if (COERCION_RE.test(combined) && changes.length) reasons.push('coercion-relation-conflict');
    if (ORDINARY_CARE_RE.test(userText) && EXTREME_SOCIAL_RE.test(replyText)) {
        reasons.push('ordinary-care-extreme-interpretation');
    }
    const genericExtremeLabels = String(replyText || '').match(GENERIC_EXTREME_LABEL_RE) || [];
    if (TOTALIZING_IDENTITY_RE.test(replyText)) reasons.push('identity-totalization');
    if (genericExtremeLabels.length >= 4) reasons.push('stereotype-label-pileup');
    if (TYPOLOGY_SHORTCUT_RE.test(replyText)) reasons.push('typology-shortcut');
    if (UNIFORM_GROUP_RE.test(replyText)) reasons.push('group-reaction-homogenization');
    if (mode === 'strict') {
        return {
            needed: changes.length > 0
                || EXTREME_SOCIAL_RE.test(replyText)
                || MOTIVE_ATTRIBUTION_RE.test(replyText)
                || TOTALIZING_IDENTITY_RE.test(replyText)
                || genericExtremeLabels.length >= 4
                || TYPOLOGY_SHORTCUT_RE.test(replyText)
                || UNIFORM_GROUP_RE.test(replyText),
            reasons: [...new Set(reasons.length ? reasons : ['strict-semantic-review'])],
        };
    }
    return { needed: reasons.length > 0, reasons: [...new Set(reasons)] };
}

function parseErrorPosition(error) {
    const match = String(error?.message || error).match(/position\s+(\d+)/iu);
    return match ? Number(match[1]) : -1;
}

function previousNonWhitespace(text, from) {
    for (let index = from; index >= 0; index -= 1) {
        if (!/\s/u.test(text[index])) return { char: text[index], index };
    }
    return { char: '', index: -1 };
}

function nextNonWhitespace(text, from) {
    for (let index = from; index < text.length; index += 1) {
        if (!/\s/u.test(text[index])) return { char: text[index], index };
    }
    return { char: '', index: -1 };
}

function removeTrailingCommasOutsideStrings(source) {
    let output = '';
    let inString = false;
    let escaped = false;
    const repairs = [];
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (inString) {
            output += character;
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') inString = false;
            continue;
        }
        if (character === '"') {
            inString = true;
            output += character;
            continue;
        }
        if (character === ',') {
            const next = nextNonWhitespace(source, index + 1);
            if (/[\]}]/u.test(next.char)) {
                repairs.push('remove-trailing-comma');
                continue;
            }
        }
        output += character;
    }
    return { source: output, repairs };
}

function parseJsonObjectWithSafePunctuationRepair(text) {
    const source = String(text || '').trim()
        .replace(/^```(?:json)?\s*/iu, '')
        .replace(/\s*```$/u, '');
    const balanced = extractFirstBalancedJsonObject(source);
    if (!balanced.error) {
        const exact = balanced.start === 0 && balanced.end === source.length;
        return {
            value: balanced.value,
            repaired: !exact,
            repairKinds: exact ? [] : ['extract-first-balanced-json-object'],
            repairAttempted: !exact,
        };
    }
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    const candidate = start >= 0 && end > start
        ? source.slice(start, end + 1)
        : source;
    try {
        return {
            value: JSON.parse(candidate),
            repaired: false,
            repairKinds: [],
            repairAttempted: false,
        };
    } catch (initialError) {
        const normalized = removeTrailingCommasOutsideStrings(candidate);
        let repairedSource = normalized.source;
        const repairs = [...normalized.repairs];
        for (let attempt = 0; attempt < 12; attempt += 1) {
            try {
                return {
                    value: JSON.parse(repairedSource),
                    repaired: repairs.length > 0,
                    repairKinds: [...new Set(repairs)],
                    repairAttempted: true,
                };
            } catch (error) {
                const position = parseErrorPosition(error);
                if (position < 0 || position > repairedSource.length) break;
                const message = String(error.message || error);
                const previous = previousNonWhitespace(repairedSource, position - 1);
                const next = nextNonWhitespace(repairedSource, position);
                const expectsComma = /Expected\s*['"]?,['"]?\s*or\s*['"]?[\]}]['"]?\s*after|expected\s+comma/iu.test(message);
                const startsValueOrKey = /[{"\[\d\-tfn]/u.test(next.char);
                const endsValue = /[\]}"\d]/u.test(previous.char)
                    || /(?:true|false|null)$/u.test(
                        repairedSource.slice(Math.max(0, previous.index - 4), previous.index + 1),
                    );
                if (expectsComma && startsValueOrKey && endsValue) {
                    repairedSource = `${repairedSource.slice(0, next.index)},${repairedSource.slice(next.index)}`;
                    repairs.push('insert-missing-comma');
                    continue;
                }
                break;
            }
        }
        return {
            value: null,
            repaired: false,
            repairKinds: [],
            repairAttempted: true,
            error: initialError,
        };
    }
}

function extractJsonObject(text) {
    const parsed = parseJsonObjectWithSafePunctuationRepair(text);
    if (!isPlainObject(parsed.value)) {
        return {
            value: null,
            repaired: false,
            repairKinds: [],
            repairAttempted: parsed.repairAttempted,
        };
    }
    return parsed;
}

export function parseSocialAuditOutput(output, knownChanges = []) {
    const extracted = extractJsonObject(output);
    const value = extracted.value;
    if (!isPlainObject(value)) {
        return {
            error: '社会语义二审没有返回合法 JSON 对象',
            localRepairAttempted: extracted.repairAttempted === true,
        };
    }
    const known = new Map((knownChanges || []).map((change) => [change.path, change]));
    const verdict = ['pass', 'warning', 'violation'].includes(value.verdict)
        ? value.verdict
        : 'warning';
    const findings = (Array.isArray(value.findings) ? value.findings : [])
        .filter(isPlainObject)
        .map((item) => ({
            type: String(item.type || 'other').slice(0, 80),
            severity: ['info', 'warning', 'error'].includes(item.severity)
                ? item.severity
                : 'warning',
            reason: String(item.reason || '').slice(0, 600),
            evidence: String(item.evidence || '').slice(0, 500),
        }))
        .slice(0, 12);
    const decisions = [];
    for (const item of Array.isArray(value.decisions) ? value.decisions : []) {
        if (!isPlainObject(item)) continue;
        const path = String(item.path || '');
        if (!known.has(path)) continue;
        const action = item.action === 'revert' ? 'revert' : 'allow';
        decisions.push({
            path,
            action,
            reason: String(item.reason || '').slice(0, 600),
            evidence: String(item.evidence || '').slice(0, 500),
        });
    }
    return {
        verdict,
        summary: String(value.summary || '').slice(0, 800),
        findings,
        decisions,
        repaired: extracted.repaired === true,
        repairKinds: extracted.repairKinds,
        localRepairAttempted: extracted.repairAttempted === true,
    };
}

export function buildSocialRollbackOps(changes, decisions) {
    const changeByPath = new Map((changes || []).map((change) => [change.path, change]));
    const ops = [];
    for (const decision of decisions || []) {
        if (decision?.action !== 'revert') continue;
        const change = changeByPath.get(decision.path);
        if (!change) continue;
        if (change.beforeExists && change.afterExists) {
            ops.push({ op: 'replace', path: change.path, value: clone(change.before) });
        } else if (change.beforeExists && !change.afterExists) {
            ops.push({ op: 'insert', path: change.path, value: clone(change.before) });
        } else if (!change.beforeExists && change.afterExists) {
            ops.push({ op: 'remove', path: change.path });
        }
    }
    return ops;
}

export function renderSocialPatchBlock(ops, summary = '') {
    return [
        '<UpdateVariable>',
        `<Analysis>${String(summary || '社会语义二审撤回无证据的关系变化').replace(/[<>]/gu, '').slice(0, 80)}</Analysis>`,
        '<JSONPatch>',
        JSON.stringify(Array.isArray(ops) ? ops : [], null, 2),
        '</JSONPatch>',
        '</UpdateVariable>',
    ].join('\n');
}
import { extractFirstBalancedJsonObject } from './sovereignty-runtime-core.mjs';
