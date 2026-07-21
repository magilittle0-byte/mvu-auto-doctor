export function deepClone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function statDataOf(data) {
    if (!data || typeof data !== 'object') return null;
    return isPlainObject(data.stat_data) ? data.stat_data : data;
}

export function pointerSegments(path) {
    if (typeof path !== 'string' || !path.startsWith('/')) return null;
    const raw = path.slice(1).split('/');
    if (raw.some((part) => /~(?![01])/u.test(part))) return null;
    return raw.map((part) => part.replace(/~1/gu, '/').replace(/~0/gu, '~'));
}

export function pointerPath(parts) {
    if (!parts.length) return '';
    return '/' + parts
        .map((part) => String(part).replace(/~/gu, '~0').replace(/\//gu, '~1'))
        .join('/');
}

export function pointerGet(root, path) {
    if (path === '') return { found: true, value: root };
    const parts = pointerSegments(path);
    if (!parts) return { found: false, value: undefined };
    let current = root;
    for (const part of parts) {
        if (
            current == null
            || typeof current !== 'object'
            || !Object.prototype.hasOwnProperty.call(current, part)
        ) {
            return { found: false, value: undefined };
        }
        current = current[part];
    }
    return { found: true, value: current };
}

function parentInfo(root, path) {
    const parts = pointerSegments(path);
    if (!parts || !parts.length) return null;
    const key = parts.pop();
    const parentPath = pointerPath(parts);
    const hit = pointerGet(root, parentPath);
    if (!hit.found || !hit.value || typeof hit.value !== 'object') return null;
    return { parent: hit.value, key, parentPath };
}

export function deepSubset(expected, actual) {
    if (expected === actual) return true;
    if (Array.isArray(expected)) {
        return Array.isArray(actual)
            && expected.length === actual.length
            && expected.every((item, index) => deepSubset(item, actual[index]));
    }
    if (isPlainObject(expected)) {
        return isPlainObject(actual)
            && Object.entries(expected)
                .every(([key, value]) => deepSubset(value, actual[key]));
    }
    return false;
}

function pathHasReadonlySegment(path) {
    const parts = pointerSegments(path);
    return !!(parts && parts.some((part) => part.startsWith('_')));
}

export function extractLastUpdateBlock(text) {
    const source = String(text || '');
    const lower = source.toLowerCase();
    const close = lower.lastIndexOf('</updatevariable>');
    if (close < 0) return '';
    const open = lower.lastIndexOf('<updatevariable', close);
    if (open < 0) return '';
    const openEnd = source.indexOf('>', open);
    if (openEnd < 0 || openEnd > close) return '';
    return source.slice(open, close + '</UpdateVariable>'.length);
}

export function parsePatchBlock(patchBlock) {
    const original = String(patchBlock || '');
    const lower = original.toLowerCase();
    const closeStart = lower.lastIndexOf('</jsonpatch>');
    const openStart = closeStart >= 0
        ? lower.lastIndexOf('<jsonpatch>', closeStart)
        : -1;
    if (openStart < 0 || closeStart < openStart) {
        return { error: '没有找到完整的 <JSONPatch>...</JSONPatch>' };
    }

    const openEnd = openStart + '<JSONPatch>'.length;
    let body = original
        .slice(openEnd, closeStart)
        .replace(/```(?:json)?/giu, '')
        .trim();
    const arrayStart = body.indexOf('[');
    const arrayEnd = body.lastIndexOf(']');
    if (arrayStart < 0 || arrayEnd < arrayStart) {
        return { error: 'JSONPatch 不是完整的 JSON 数组' };
    }
    body = body.slice(arrayStart, arrayEnd + 1);

    let ops;
    try {
        ops = JSON.parse(body);
    } catch (error) {
        return { error: `JSONPatch JSON 解析失败：${error.message || error}` };
    }
    if (!Array.isArray(ops)) return { error: 'JSONPatch 根节点必须是数组' };

    const supported = new Set(['replace', 'delta', 'insert', 'remove', 'move']);
    const errors = [];
    ops.forEach((op, index) => {
        const number = index + 1;
        if (!isPlainObject(op) || !supported.has(op.op)) {
            errors.push(`第 ${number} 项 op 无效`);
            return;
        }
        if (op.op === 'move') {
            if (typeof op.from !== 'string' || typeof op.to !== 'string') {
                errors.push(`第 ${number} 项 move 必须包含 from/to`);
                return;
            }
            if (pointerSegments(op.from) == null || pointerSegments(op.to) == null) {
                errors.push(`第 ${number} 项 move 路径不是合法 JSON Pointer`);
            }
            if (pathHasReadonlySegment(op.from) || pathHasReadonlySegment(op.to)) {
                errors.push(`第 ${number} 项试图修改只读“_”字段`);
            }
            return;
        }
        if (typeof op.path !== 'string' || pointerSegments(op.path) == null) {
            errors.push(`第 ${number} 项 path 不是合法 JSON Pointer`);
        }
        if (typeof op.path === 'string' && pathHasReadonlySegment(op.path)) {
            errors.push(`第 ${number} 项试图修改只读“_”字段`);
        }
        if (
            ['replace', 'delta', 'insert'].includes(op.op)
            && !Object.prototype.hasOwnProperty.call(op, 'value')
        ) {
            errors.push(`第 ${number} 项缺少 value`);
        }
        if (
            op.op === 'delta'
            && (typeof op.value !== 'number' || !Number.isFinite(op.value))
        ) {
            errors.push(`第 ${number} 项 delta.value 必须是有限数字`);
        }
    });
    if (errors.length) return { error: [...new Set(errors)].join('；') };

    const analysisMatch = original.match(/<Analysis>([\s\S]*?)<\/Analysis>/iu);
    const safeAnalysis = (analysisMatch ? analysisMatch[1] : '')
        .replace(
            /<\/?(?:UpdateVariable|JSONPatch)>/giu,
            (tag) => tag.replace(/[<>]/gu, ''),
        )
        .trim();
    const block = [
        '<UpdateVariable>',
        '<Analysis>',
        safeAnalysis,
        '</Analysis>',
        '<JSONPatch>',
        JSON.stringify(ops, null, 2),
        '</JSONPatch>',
        '</UpdateVariable>',
    ].join('\n');
    return { block, ops };
}

function insertAt(parent, key, value) {
    if (Array.isArray(parent)) {
        if (key === '-') {
            parent.push(deepClone(value));
            return true;
        }
        const index = Number(key);
        if (!Number.isInteger(index) || index < 0 || index > parent.length) {
            return false;
        }
        parent.splice(index, 0, deepClone(value));
        return true;
    }
    if (Object.prototype.hasOwnProperty.call(parent, key)) return false;
    parent[key] = deepClone(value);
    return true;
}

function removeAt(parent, key) {
    if (Array.isArray(parent)) {
        const index = Number(key);
        if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
            return { ok: false };
        }
        return { ok: true, value: parent.splice(index, 1)[0] };
    }
    if (!Object.prototype.hasOwnProperty.call(parent, key)) {
        return { ok: false };
    }
    const value = parent[key];
    delete parent[key];
    return { ok: true, value };
}

function touch(touched, path) {
    touched.add(path);
}

export function simulateOps(oldStat, ops) {
    const expected = deepClone(oldStat);
    const touched = new Set();

    for (let index = 0; index < ops.length; index += 1) {
        const op = ops[index];
        const number = index + 1;

        if (op.op === 'move') {
            const source = parentInfo(expected, op.from);
            if (!source) {
                return { error: `第 ${number} 项 move.from 的父路径不存在：${op.from}` };
            }
            const removed = removeAt(source.parent, source.key);
            if (!removed.ok) {
                return { error: `第 ${number} 项 move.from 不存在：${op.from}` };
            }
            const destination = parentInfo(expected, op.to);
            if (!destination) {
                return { error: `第 ${number} 项 move.to 的父路径不存在：${op.to}` };
            }
            if (Array.isArray(destination.parent)) {
                if (!insertAt(destination.parent, destination.key, removed.value)) {
                    return { error: `第 ${number} 项 move.to 数组位置无效：${op.to}` };
                }
                touch(touched, destination.parentPath);
            } else {
                destination.parent[destination.key] = deepClone(removed.value);
                touch(touched, op.to);
            }
            touch(touched, Array.isArray(source.parent) ? source.parentPath : op.from);
            continue;
        }

        const info = parentInfo(expected, op.path);
        if (!info) return { error: `第 ${number} 项父路径不存在：${op.path}` };
        const hit = pointerGet(expected, op.path);

        if (op.op === 'replace') {
            if (!hit.found) {
                return { error: `第 ${number} 项 replace 目标不存在：${op.path}` };
            }
            info.parent[info.key] = deepClone(op.value);
            touch(touched, op.path);
        } else if (op.op === 'delta') {
            if (!hit.found || typeof hit.value !== 'number') {
                return { error: `第 ${number} 项 delta 目标不是现有数字：${op.path}` };
            }
            info.parent[info.key] = hit.value + op.value;
            touch(touched, op.path);
        } else if (op.op === 'insert') {
            if (!insertAt(info.parent, info.key, op.value)) {
                return {
                    error: `第 ${number} 项 insert 目标已存在或数组位置无效：${op.path}`,
                };
            }
            touch(touched, Array.isArray(info.parent) ? info.parentPath : op.path);
        } else if (op.op === 'remove') {
            if (!hit.found) {
                return { error: `第 ${number} 项 remove 目标不存在：${op.path}` };
            }
            const removed = removeAt(info.parent, info.key);
            if (!removed.ok) {
                return { error: `第 ${number} 项 remove 失败：${op.path}` };
            }
            touch(touched, Array.isArray(info.parent) ? info.parentPath : op.path);
        }
    }

    const paths = [...touched].filter(
        (path, index, all) => !all.some(
            (other, otherIndex) => otherIndex !== index
                && (other === '' || path.startsWith(other + '/')),
        ),
    );
    return { expected, touched: paths };
}

export function preparePatch(patchBlock, oldData) {
    const parsed = parsePatchBlock(patchBlock);
    if (parsed.error) return parsed;
    const oldStat = statDataOf(oldData);
    if (!oldStat) return { error: '当前 MVU 数据中没有可验证的 stat_data' };
    const simulated = simulateOps(oldStat, parsed.ops);
    if (simulated.error) return { ...parsed, error: simulated.error };
    return {
        ...parsed,
        expectedStat: simulated.expected,
        touched: simulated.touched,
    };
}

export function validatePatchResult(oldData, newData, prepared) {
    const oldStat = statDataOf(oldData);
    if (
        !prepared
        || !oldStat
        || JSON.stringify(prepared.expectedStat) === JSON.stringify(oldStat)
    ) {
        return {
            ok: false,
            nochange: true,
            rejected: [],
            reason: '补丁没有要求任何实际状态变化',
        };
    }
    if (!newData) {
        return {
            ok: false,
            nochange: false,
            rejected: [],
            reason: 'MVU 没有返回新状态',
        };
    }
    const actual = statDataOf(newData);
    if (!actual) {
        return {
            ok: false,
            nochange: false,
            rejected: [],
            reason: 'MVU 返回结果中没有 stat_data',
        };
    }

    const rejected = [];
    const details = [];
    for (const path of prepared.touched || []) {
        const expectedHit = pointerGet(prepared.expectedStat, path);
        const actualHit = pointerGet(actual, path);
        if (
            expectedHit.found !== actualHit.found
            || (
                expectedHit.found
                && !deepSubset(expectedHit.value, actualHit.value)
            )
        ) {
            rejected.push(path || '/');
            details.push({
                path: path || '/',
                expected: expectedHit.found
                    ? deepClone(expectedHit.value)
                    : '(路径应不存在)',
                actual: actualHit.found
                    ? deepClone(actualHit.value)
                    : '(路径不存在)',
            });
        }
    }
    return rejected.length
        ? {
            ok: false,
            nochange: false,
            rejected,
            details,
            reason: `有 ${rejected.length} 个目标未按补丁落地：${rejected.slice(0, 5).join('、')}`,
        }
        : { ok: true, nochange: false, rejected: [], details: [] };
}

function extensionRoots(character) {
    return [
        character?.data?.extensions,
        character?.extensions,
        character?.json_data?.data?.extensions,
        character?.json_data?.extensions,
    ].filter(isPlainObject);
}

export function extractSchemaScripts(character) {
    const found = [];
    const seen = new Set();
    for (const extensions of extensionRoots(character)) {
        const scripts = extensions?.tavern_helper?.scripts;
        if (!Array.isArray(scripts)) continue;
        for (const script of scripts) {
            if (!script || script.enabled === false || typeof script.content !== 'string') {
                continue;
            }
            const name = String(script.name || '');
            const content = script.content.trim();
            if (
                !content
                || !(
                    /变量结构|schema/iu.test(name)
                    || /registerMvuSchema|export\s+const\s+Schema/iu.test(content)
                )
                || seen.has(content)
            ) {
                continue;
            }
            seen.add(content);
            found.push({ name: name || 'MVU Schema', content });
        }
    }
    return found;
}

function entriesOfBook(book) {
    const entries = book?.entries;
    if (Array.isArray(entries)) return entries;
    if (isPlainObject(entries)) return Object.values(entries);
    return [];
}

export function findMvuRuleEntries(book) {
    const candidates = [];
    for (const entry of entriesOfBook(book)) {
        if (
            !entry
            || entry.disable === true
            || entry.enabled === false
            || typeof entry.content !== 'string'
            || !entry.content.trim()
        ) {
            continue;
        }
        const comment = String(entry.comment || entry.name || '');
        const primary = /\[mvu_update\]/iu.test(comment);
        const fallback = /变量(?:更新|输出)(?:规则|格式)|variable\s*update/iu.test(comment);
        if (!primary && !fallback) continue;
        candidates.push({
            primary,
            constant: entry.constant === true,
            order: Number(entry.order ?? entry.insertion_order ?? 0) || 0,
            comment,
            content: entry.content.trim(),
        });
    }
    return candidates;
}

function describeDiffValue(value) {
    if (value === undefined) return '(不存在)';
    const text = JSON.stringify(value);
    if (text && text.length <= 1600) return value;
    if (Array.isArray(value)) return `(数组，${value.length} 项)`;
    if (isPlainObject(value)) {
        return `(对象，字段：${Object.keys(value).slice(0, 30).join('、')}${Object.keys(value).length > 30 ? '…' : ''})`;
    }
    return String(value);
}

export function diffStates(before, after, limit = 240) {
    const changes = [];
    let omitted = 0;

    function record(path, oldValue, newValue) {
        if (changes.length >= limit) {
            omitted += 1;
            return;
        }
        changes.push({
            path: path || '/',
            before: describeDiffValue(oldValue),
            after: describeDiffValue(newValue),
        });
    }

    function walk(oldValue, newValue, parts) {
        if (oldValue === newValue) return;
        if (Array.isArray(oldValue) || Array.isArray(newValue)) {
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                record(pointerPath(parts), oldValue, newValue);
            }
            return;
        }
        if (isPlainObject(oldValue) && isPlainObject(newValue)) {
            const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
            for (const key of keys) walk(oldValue[key], newValue[key], [...parts, key]);
            return;
        }
        record(pointerPath(parts), oldValue, newValue);
    }

    walk(before, after, []);
    return { changes, omitted };
}

export function fingerprint(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function unquoteYamlScalar(value) {
    const text = String(value || '').trim();
    if (
        text.length >= 2
        && (
            (text.startsWith('"') && text.endsWith('"'))
            || (text.startsWith("'") && text.endsWith("'"))
        )
    ) {
        if (text.startsWith('"')) {
            try {
                return JSON.parse(text);
            } catch {
                return text.slice(1, -1);
            }
        }
        return text.slice(1, -1).replace(/''/gu, "'");
    }
    if (/^(?:null|~)$/iu.test(text)) return null;
    if (/^(?:true|false)$/iu.test(text)) return text.toLowerCase() === 'true';
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(text)) {
        const number = Number(text);
        if (Number.isFinite(number)) return number;
    }
    if (text === '{}') return {};
    if (text === '[]') return [];
    return text.replace(/\s+#.*$/u, '').trim();
}

/**
 * Parse the conservative YAML subset commonly used by [initvar] lorebook
 * entries. Unsupported list/block constructs are ignored instead of guessed.
 */
export function parseInitializationText(source) {
    const original = String(source || '')
        .replace(/^```(?:ya?ml|json)?\s*$/gimu, '')
        .replace(/^```\s*$/gimu, '')
        .trim();
    if (!original) return null;

    if (/^[{[]/u.test(original)) {
        try {
            const parsed = JSON.parse(original);
            return isPlainObject(parsed) ? parsed : null;
        } catch {
            // Most MVU init entries are YAML; continue with the safe subset.
        }
    }

    const root = {};
    const stack = [{ indent: -1, value: root }];
    let parsedFields = 0;
    for (const rawLine of original.split(/\r?\n/u)) {
        if (!rawLine.trim() || /^\s*(?:#|---\s*$|\.\.\.\s*$)/u.test(rawLine)) continue;
        if (/^\s*-\s+/u.test(rawLine)) continue;
        const match = rawLine.match(/^(\s*)([^:#][^:]*?):(?:\s*(.*))?$/u);
        if (!match) continue;
        const indent = match[1].replace(/\t/gu, '    ').length;
        let key = match[2].trim();
        if (
            (key.startsWith('"') && key.endsWith('"'))
            || (key.startsWith("'") && key.endsWith("'"))
        ) {
            key = String(unquoteYamlScalar(key));
        }
        if (!key || key === '<<') continue;
        while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();
        const parent = stack.at(-1).value;
        if (!isPlainObject(parent)) continue;
        const scalar = String(match[3] ?? '').trim();
        if (!scalar || /^[|>][+-]?$/u.test(scalar)) {
            if (/^[|>]/u.test(scalar)) continue;
            const child = {};
            parent[key] = child;
            stack.push({ indent, value: child });
        } else {
            parent[key] = unquoteYamlScalar(scalar);
            parsedFields += 1;
        }
    }
    return parsedFields ? root : null;
}

function resourceKeyPart(key, kind) {
    const source = String(key || '').trim();
    const suffix = kind === 'current'
        ? /^(.*?)(?:[_\s.·-]*)(当前|现值|current|cur)$/iu
        : /^(.*?)(?:[_\s.·-]*)(最大|上限|maximum|max)$/iu;
    const prefix = kind === 'current'
        ? /^(当前|现值|current|cur)(?:[_\s.·-]*)(.+)$/iu
        : /^(最大|上限|maximum|max)(?:[_\s.·-]*)(.+)$/iu;
    const suffixMatch = source.match(suffix);
    const rawBase = suffixMatch?.[1] || source.match(prefix)?.[2] || '';
    const base = rawBase.replace(/[_\s.·-]+/gu, '').toLowerCase();
    return base || '';
}

function numericPairAt(stat, pair) {
    if (!stat) return null;
    const current = pointerGet(stat, pair.currentPath);
    const maximum = pointerGet(stat, pair.maximumPath);
    if (
        !current.found
        || !maximum.found
        || typeof current.value !== 'number'
        || typeof maximum.value !== 'number'
        || !Number.isFinite(current.value)
        || !Number.isFinite(maximum.value)
    ) return null;
    return { current: current.value, maximum: maximum.value };
}

function collectResourcePairs(root) {
    const pairs = [];
    function walk(value, parts) {
        if (!isPlainObject(value)) return;
        const currentByBase = new Map();
        const maximumByBase = new Map();
        for (const [key, item] of Object.entries(value)) {
            if (typeof item !== 'number' || !Number.isFinite(item)) continue;
            const currentBase = resourceKeyPart(key, 'current');
            const maximumBase = resourceKeyPart(key, 'maximum');
            if (currentBase) currentByBase.set(currentBase, key);
            if (maximumBase) maximumByBase.set(maximumBase, key);
        }
        for (const [base, currentKey] of currentByBase) {
            const maximumKey = maximumByBase.get(base);
            if (!maximumKey || maximumKey === currentKey) continue;
            pairs.push({
                base,
                currentKey,
                maximumKey,
                currentPath: pointerPath([...parts, currentKey]),
                maximumPath: pointerPath([...parts, maximumKey]),
            });
        }
        for (const [key, item] of Object.entries(value)) {
            if (isPlainObject(item)) walk(item, [...parts, key]);
        }
    }
    walk(root, []);
    return pairs;
}

function pathWasTouched(path, touchedPaths) {
    return (touchedPaths || []).some((candidate) => (
        candidate === path
        || candidate === ''
        || path.startsWith(`${candidate}/`)
        || candidate.startsWith(`${path}/`)
    ));
}

/**
 * Find resource fields which were full in the declared/previous initial state,
 * whose derived maximum then increased while the current value stayed frozen.
 * This deliberately does not use resource names such as HP/MP, so it works for
 * arbitrary MVU cards while refusing capacity pairs (for example load 0/25).
 */
export function findOpeningResourceMismatches(currentData, {
    initialStates = [],
    previousData = null,
    lastSynced = {},
    touchedPaths = [],
    limit = 24,
} = {}) {
    const currentStat = statDataOf(currentData);
    if (!currentStat) return [];
    const previousStat = statDataOf(previousData);
    const initialStats = (Array.isArray(initialStates) ? initialStates : [initialStates])
        .map(statDataOf)
        .filter(Boolean);
    const result = [];
    for (const pair of collectResourcePairs(currentStat)) {
        const now = numericPairAt(currentStat, pair);
        if (!now || now.maximum <= now.current) continue;
        if (pathWasTouched(pair.currentPath, touchedPaths)) continue;

        const declaredFull = initialStats.some((initialStat) => {
            const initial = numericPairAt(initialStat, pair);
            return !!(
                initial
                && initial.current === initial.maximum
                && now.current === initial.current
            );
        });
        const previous = numericPairAt(previousStat, pair);
        const derivedIncreaseFromFull = !!(
            previous
            && previous.current === previous.maximum
            && now.current === previous.current
            && now.maximum > previous.maximum
        );
        const syncedMaximum = Number(lastSynced?.[pair.currentPath]?.maximum);
        const continuedSetupIncrease = !!(
            Number.isFinite(syncedMaximum)
            && now.current === syncedMaximum
            && now.maximum > syncedMaximum
        );
        if (!declaredFull && !derivedIncreaseFromFull && !continuedSetupIncrease) continue;
        result.push({
            ...pair,
            from: now.current,
            to: now.maximum,
            proof: declaredFull
                ? 'declared-full-initial-value'
                : derivedIncreaseFromFull
                    ? 'derived-maximum-increased-from-full'
                    : 'continued-opening-setup',
        });
        if (result.length >= Math.max(1, Number(limit) || 24)) break;
    }
    return result;
}
