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

export function hasUsableStatData(data) {
    if (!isPlainObject(data)) return false;
    if (Object.prototype.hasOwnProperty.call(data, 'stat_data')) {
        return isPlainObject(data.stat_data) && Object.keys(data.stat_data).length > 0;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'display_data')) return false;
    return Object.keys(data).length > 0;
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

function leafPaths(value, parts = [], result = []) {
    if (Array.isArray(value)) {
        if (!value.length) result.push(pointerPath(parts));
        else value.forEach((item, index) => leafPaths(item, [...parts, String(index)], result));
        return result;
    }
    if (isPlainObject(value)) {
        const entries = Object.entries(value);
        if (!entries.length) result.push(pointerPath(parts));
        else entries.forEach(([key, item]) => leafPaths(item, [...parts, key], result));
        return result;
    }
    result.push(pointerPath(parts));
    return result;
}

function pathCoveredByTouched(path, touched) {
    return (touched || []).some((candidate) => (
        candidate === ''
        || path === candidate
        || path.startsWith(`${candidate}/`)
    ));
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
    for (const path of leafPaths(oldStat)) {
        if (pathCoveredByTouched(path, prepared.touched)) continue;
        const oldHit = pointerGet(oldStat, path);
        const actualHit = pointerGet(actual, path);
        if (
            !actualHit.found
            // MVU may legitimately recompute present derived/read-only fields
            // while applying an unrelated patch. Their removal is still unsafe.
            || (!pathHasReadonlySegment(path) && !deepSubset(oldHit.value, actualHit.value))
        ) {
            rejected.push(path || '/');
            details.push({
                path: path || '/',
                expected: oldHit.found ? deepClone(oldHit.value) : '(路径应存在)',
                actual: actualHit.found ? deepClone(actualHit.value) : '(路径不存在)',
                reason: '补丁未触碰的旧字段必须保留',
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

/**
 * Restore only the paths touched by a rejected repair.  Values written by
 * other MVU actors outside those paths are deliberately preserved.
 */
export function restoreTouchedPaths(currentData, snapshotData, touchedPaths = []) {
    const restored = deepClone(currentData);
    const snapshotStat = statDataOf(snapshotData);
    let restoredStat = statDataOf(restored);
    if (!restoredStat || !snapshotStat) return null;

    for (const path of touchedPaths || []) {
        if (path === '') {
            if (isPlainObject(restored) && isPlainObject(restored.stat_data)) {
                restored.stat_data = deepClone(snapshotStat);
                restoredStat = restored.stat_data;
                continue;
            }
            return deepClone(snapshotData);
        }
        const destination = parentInfo(restoredStat, path);
        if (!destination) return null;
        const original = pointerGet(snapshotStat, path);
        if (original.found) {
            destination.parent[destination.key] = deepClone(original.value);
        } else {
            const removed = removeAt(destination.parent, destination.key);
            if (!removed.ok) return null;
        }
    }
    return restored;
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

const LIFECYCLE_EVENT_PATTERN = [
    '死亡',
    '阵亡',
    '逃跑',
    '逃离',
    '战斗结束',
    '战斗终止',
    '离队',
    '退出',
    '失效',
    '过期',
    '解散',
    '销毁',
    'dead',
    'death',
    'escape',
    'leave',
    'expired?',
    'destroyed?',
].join('|');
const LIFECYCLE_MUTATION_PATTERN = [
    '删除',
    '移除',
    '清理',
    '清除',
    'remove',
    'delete',
    'clear',
].join('|');
const LIFECYCLE_RELATION_RE = new RegExp(
    `(?:${LIFECYCLE_EVENT_PATTERN})[\\s\\S]{0,160}(?:${LIFECYCLE_MUTATION_PATTERN})`
    + `|(?:${LIFECYCLE_MUTATION_PATTERN})[\\s\\S]{0,160}(?:${LIFECYCLE_EVENT_PATTERN})`,
    'iu',
);

function similarlyShapedRecords(entries) {
    if (entries.length <= 1) return true;
    const signatures = entries
        .slice(0, 12)
        .map(([, value]) => new Set(
            Object.keys(value).filter((key) => !String(key).startsWith('_')),
        ));
    for (let left = 0; left < signatures.length; left += 1) {
        for (let right = left + 1; right < signatures.length; right += 1) {
            const a = signatures[left];
            const b = signatures[right];
            const union = new Set([...a, ...b]);
            if (!union.size) continue;
            const intersection = [...a].filter((key) => b.has(key)).length;
            if (intersection / union.size >= 0.35) return true;
        }
    }
    return false;
}

function recordEntriesOf(value, maxEntries) {
    if (!isPlainObject(value)) return [];
    const entries = Object.entries(value);
    if (!entries.length || entries.length > maxEntries) return [];
    if (entries.some(([key, item]) => (
        !isPlainObject(item)
        || !String(key).trim()
        || String(key).length > 96
        || String(key).startsWith('_')
    ))) return [];
    return similarlyShapedRecords(entries) ? entries : [];
}

function ruleSectionAt(source, found) {
    const lineStart = Math.max(0, source.lastIndexOf('\n', found - 1) + 1);
    const lineEndHit = source.indexOf('\n', found);
    const lineEnd = lineEndHit < 0 ? source.length : lineEndHit;
    const headingLine = source.slice(lineStart, lineEnd);
    const baseIndent = headingLine.match(/^[ \t]*/u)?.[0].length || 0;
    const looksLikeHeading = /[:：]\s*(?:[|>-]\s*)?$/u.test(headingLine.trim());
    if (!looksLikeHeading) return headingLine.trim();

    let cursor = lineEnd < source.length ? lineEnd + 1 : source.length;
    let sectionEnd = source.length;
    while (cursor < source.length) {
        const nextEndHit = source.indexOf('\n', cursor);
        const nextEnd = nextEndHit < 0 ? source.length : nextEndHit;
        const line = source.slice(cursor, nextEnd);
        const trimmed = line.trim();
        if (trimmed) {
            const indent = line.match(/^[ \t]*/u)?.[0].length || 0;
            const nextSection = indent <= baseIndent && (
                /^#\s*=+/u.test(trimmed)
                || /^[^-\s][^:：]{0,160}[:：]\s*(?:[|>-]\s*)?$/u.test(trimmed)
            );
            if (nextSection) {
                sectionEnd = cursor;
                break;
            }
        }
        cursor = nextEnd < source.length ? nextEnd + 1 : source.length;
    }
    return source.slice(lineStart, sectionEnd).trim();
}

function lifecycleRuleWindows(rules, parts) {
    const source = String(rules || '');
    const cleanParts = (Array.isArray(parts) ? parts : [])
        .map((part) => String(part || '').trim())
        .filter(Boolean);
    if (!source || !cleanParts.length) return [];
    const fullPath = cleanParts.join('.');
    const candidates = [fullPath];
    if (cleanParts.length <= 2) candidates.push(cleanParts.at(-1));
    const haystack = source.toLocaleLowerCase();
    const windows = [];
    for (const candidate of [...new Set(candidates)]) {
        if (candidate.length < 2) continue;
        const loweredNeedle = candidate.toLocaleLowerCase();
        let cursor = 0;
        while (windows.length < 3) {
            const found = haystack.indexOf(loweredNeedle, cursor);
            if (found < 0) break;
            const section = ruleSectionAt(source, found);
            if (LIFECYCLE_RELATION_RE.test(section)) windows.push(section);
            cursor = found + loweredNeedle.length;
        }
        if (windows.length) break;
    }
    return windows;
}

export function findLifecycleCollections(stat, rules, {
    maxDepth = 5,
    maxCollections = 12,
    maxEntriesPerCollection = 80,
} = {}) {
    const collections = [];

    function walk(value, parts, depth) {
        if (
            collections.length >= maxCollections
            || depth > maxDepth
            || !isPlainObject(value)
        ) return;

        if (parts.length) {
            const entries = recordEntriesOf(value, maxEntriesPerCollection);
            const ruleWindows = entries.length
                ? lifecycleRuleWindows(rules, parts)
                : [];
            if (entries.length && ruleWindows.length) {
                collections.push({
                    path: pointerPath(parts),
                    label: parts.at(-1),
                    entryNames: entries.map(([key]) => key),
                    ruleExcerpt: ruleWindows[0],
                });
            }
        }

        for (const [key, item] of Object.entries(value)) {
            if (isPlainObject(item)) walk(item, [...parts, key], depth + 1);
            if (collections.length >= maxCollections) break;
        }
    }

    walk(stat, [], 0);
    return collections;
}

function compactMentionExcerpt(text, name, radius = 150) {
    const source = String(text || '').replace(/\s+/gu, ' ').trim();
    const found = source.toLocaleLowerCase().indexOf(String(name).toLocaleLowerCase());
    if (found < 0) return '';
    const start = Math.max(0, found - radius);
    const end = Math.min(source.length, found + String(name).length + radius);
    return `${start ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`;
}

export function buildLifecycleHistoryHints(stat, rules, transcriptEntries, {
    maxEntries = 36,
    maxMentionsPerEntry = 2,
    maxCharacters = 22000,
} = {}) {
    const collections = findLifecycleCollections(stat, rules);
    if (!collections.length) return '';
    const transcript = (Array.isArray(transcriptEntries) ? transcriptEntries : [])
        .map((entry, index) => ({
            index: Number.isInteger(entry?.index) ? entry.index : index,
            role: String(entry?.role || ''),
            text: String(entry?.text ?? entry?.mes ?? entry?.content ?? entry ?? ''),
        }))
        .filter((entry) => entry.text.trim());
    const sections = [];
    let usedEntries = 0;

    for (const collection of collections) {
        const evidence = [];
        for (const name of collection.entryNames) {
            if (usedEntries >= maxEntries) break;
            const mentions = [];
            for (let index = transcript.length - 1; index >= 0; index -= 1) {
                const entry = transcript[index];
                const excerpt = compactMentionExcerpt(entry.text, name);
                if (!excerpt) continue;
                mentions.push(
                    `- ${name}｜历史楼层 ${entry.index} ${entry.role || '消息'}：${excerpt}`,
                );
                if (mentions.length >= maxMentionsPerEntry) break;
            }
            if (!mentions.length) continue;
            evidence.push(...mentions.reverse());
            usedEntries += 1;
        }
        if (!evidence.length) continue;
        sections.push([
            `集合 ${collection.path}`,
            `与生命周期直接相关的规则片段：${collection.ruleExcerpt}`,
            ...evidence,
        ].join('\n'));
        if (sections.join('\n\n').length >= maxCharacters) break;
    }

    const result = sections.join('\n\n');
    if (result.length <= maxCharacters) return result;
    return `${result.slice(0, maxCharacters)}\n……【生命周期历史线索已按上限截断】`;
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
    const uncommented = text.replace(/\s+#.*$/u, '').trim();
    if (/^(?:null|~)$/iu.test(uncommented)) return null;
    if (/^(?:true|false)$/iu.test(uncommented)) {
        return uncommented.toLowerCase() === 'true';
    }
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(uncommented)) {
        const number = Number(uncommented);
        if (Number.isFinite(number)) return number;
    }
    if (uncommented === '{}') return {};
    if (uncommented === '[]') return [];
    return uncommented;
}

/**
 * Parse the conservative YAML subset commonly used by [initvar] lorebook
 * entries. Mapping and block-sequence containers are selected from indentation;
 * unsupported block scalar/anchor constructs are still ignored instead of guessed.
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

    const lines = original.split(/\r?\n/u);
    const lineIndent = (line) => String(line.match(/^(\s*)/u)?.[1] || '')
        .replace(/\t/gu, '    ').length;
    const ignorable = (line) => (
        !line.trim()
        || /^\s*(?:#|---\s*$|\.\.\.\s*$)/u.test(line)
    );
    const childContainer = (index, indent) => {
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const next = lines[cursor];
            if (ignorable(next)) continue;
            if (lineIndent(next) <= indent) return {};
            return /^\s*-\s+/u.test(next) ? [] : {};
        }
        return {};
    };
    const normalizeKey = (rawKey) => {
        let key = String(rawKey || '').trim();
        if (
            (key.startsWith('"') && key.endsWith('"'))
            || (key.startsWith("'") && key.endsWith("'"))
        ) {
            key = String(unquoteYamlScalar(key));
        }
        return key;
    };

    const root = {};
    const stack = [{ indent: -1, value: root }];
    let parsedFields = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const rawLine = lines[lineIndex];
        if (ignorable(rawLine)) continue;
        const sequence = rawLine.match(/^(\s*)-\s+(.*)$/u);
        if (sequence) {
            const indent = sequence[1].replace(/\t/gu, '    ').length;
            while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();
            const parent = stack.at(-1).value;
            if (!Array.isArray(parent)) continue;
            const itemSource = sequence[2].trim();
            const mapping = itemSource.match(/^([^:#][^:]*?):(?:\s*(.*))?$/u);
            if (!mapping) {
                parent.push(unquoteYamlScalar(itemSource));
                parsedFields += 1;
                continue;
            }
            const item = {};
            parent.push(item);
            stack.push({ indent, value: item });
            const key = normalizeKey(mapping[1]);
            if (!key || key === '<<') continue;
            const scalar = String(mapping[2] ?? '').trim();
            if (!scalar || /^[|>][+-]?$/u.test(scalar)) {
                if (/^[|>]/u.test(scalar)) continue;
                const child = childContainer(lineIndex, indent);
                item[key] = child;
                // The key starts after "- ", so siblings at indent + 2 must
                // pop this child while deeper lines remain nested inside it.
                stack.push({ indent: indent + 2, value: child });
            } else {
                item[key] = unquoteYamlScalar(scalar);
                parsedFields += 1;
            }
            continue;
        }
        const match = rawLine.match(/^(\s*)([^:#][^:]*?):(?:\s*(.*))?$/u);
        if (!match) continue;
        const indent = match[1].replace(/\t/gu, '    ').length;
        const key = normalizeKey(match[2]);
        if (!key || key === '<<') continue;
        while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();
        const parent = stack.at(-1).value;
        if (!isPlainObject(parent)) continue;
        const scalar = String(match[3] ?? '').trim();
        if (!scalar || /^[|>][+-]?$/u.test(scalar)) {
            if (/^[|>]/u.test(scalar)) continue;
            const child = childContainer(lineIndex, indent);
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
        ? /^(.*?)(?:[_\s.·-]*)(当前值?|现值|current(?:[_\s.·-]*value)?|cur(?:[_\s.·-]*value)?)$/iu
        : /^(.*?)(?:[_\s.·-]*)(最大值?|上限值?|maximum(?:[_\s.·-]*value)?|max(?:[_\s.·-]*value)?)$/iu;
    const prefix = kind === 'current'
        ? /^(当前值?|现值|current(?:[_\s.·-]*value)?|cur(?:[_\s.·-]*value)?)(?:[_\s.·-]*)(.+)$/iu
        : /^(最大值?|上限值?|maximum(?:[_\s.·-]*value)?|max(?:[_\s.·-]*value)?)(?:[_\s.·-]*)(.+)$/iu;
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
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (item && typeof item === 'object') walk(item, [...parts, String(index)]);
            });
            return;
        }
        if (!isPlainObject(value)) return;
        const currentByBase = new Map();
        const maximumByBase = new Map();
        const nestedBase = String(parts.at(-1) || '')
            .replace(/[_\s.·-]+/gu, '')
            .toLowerCase();
        for (const [key, item] of Object.entries(value)) {
            if (typeof item !== 'number' || !Number.isFinite(item)) continue;
            const currentBase = resourceKeyPart(key, 'current')
                || (/^(?:当前值?|现值|current(?:[_\s.·-]*value)?|cur(?:[_\s.·-]*value)?)$/iu.test(key)
                    ? nestedBase : '');
            const maximumBase = resourceKeyPart(key, 'maximum')
                || (/^(?:最大值?|上限值?|maximum(?:[_\s.·-]*value)?|max(?:[_\s.·-]*value)?)$/iu.test(key)
                    ? nestedBase : '');
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
            if (item && typeof item === 'object') walk(item, [...parts, key]);
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
 * A declared initvar full value is authoritative for arbitrary field names.
 * Previous-floor inference is intentionally restricted to resource semantics,
 * so counters such as floor/chapter 10/20 are not silently filled to 20.
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
                && initial.maximum > 0
                && initial.current === initial.maximum
                && now.current === initial.current
            );
        });
        const previous = numericPairAt(previousStat, pair);
        const progressLikePair = /进度|阶段|任务|完成度|次数|层数|周目|章节|等级|级别|回合|轮数|天数|progress|stage|quest|count|charge|floor|chapter|level|round|turn|day/iu.test(pair.base);
        const resourceLikePair = (
            /生命|血量|气血|体力|耐力|精力|法力|魔力|灵力|气力|理智|心智|能量|health|mana|stamina|vitality|sanity|energy|resource/iu.test(pair.base)
            || /^(?:hp|mp|sp|san)$/iu.test(pair.base)
        );
        const derivedIncreaseFromFull = !!(
            !progressLikePair
            && resourceLikePair
            && previous
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
