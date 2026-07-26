import { deepClone, isPlainObject } from '../domain/common.mjs';
import { hashCanonical } from './canonical.mjs';

export function pointerSegments(path) {
    if (typeof path !== 'string' || !path.startsWith('/')) return null;
    const raw = path.slice(1).split('/');
    if (raw.some((segment) => /~(?![01])/u.test(segment))) return null;
    return raw.map((segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));
}

export function pointerGet(root, path) {
    const segments = pointerSegments(path);
    if (!segments || !segments.length) return { found: false, value: undefined };
    let current = root;
    for (const segment of segments) {
        if (
            current === null
            || typeof current !== 'object'
            || !Object.hasOwn(current, segment)
        ) {
            return { found: false, value: undefined };
        }
        current = current[segment];
    }
    return { found: true, value: current };
}

function pointerParent(root, path) {
    const segments = pointerSegments(path);
    if (!segments || !segments.length) return null;
    const key = segments.pop();
    let parent = root;
    for (const segment of segments) {
        if (
            parent === null
            || typeof parent !== 'object'
            || !Object.hasOwn(parent, segment)
        ) {
            return null;
        }
        parent = parent[segment];
    }
    if (parent === null || typeof parent !== 'object') return null;
    return { parent, key };
}

export function pathValuesEqual(left, right) {
    if (!!left?.found !== !!right?.found) return false;
    if (!left?.found) return true;
    try {
        return hashCanonical(left.value) === hashCanonical(right.value);
    } catch {
        return false;
    }
}

export function capturePathValues(state, paths) {
    return [...new Set(paths || [])].map((path) => {
        const hit = pointerGet(state, path);
        return hit.found
            ? { path, found: true, value: deepClone(hit.value) }
            : { path, found: false };
    });
}

export function pathValueMap(entries = []) {
    return new Map(entries.map((entry) => [entry.path, entry]));
}

export function validatePathMutations(mutations) {
    const issues = [];
    if (!Array.isArray(mutations) || !mutations.length) {
        issues.push({
            code: 'transaction.write_plan_empty',
            path: '$.writePlan',
            severity: 'error',
            message: '事务写入计划必须包含至少一个显式路径。',
        });
        return { ok: false, issues, paths: [] };
    }
    const paths = [];
    mutations.forEach((mutation, index) => {
        const path = `$.writePlan[${index}]`;
        if (!isPlainObject(mutation)) {
            issues.push({
                code: 'transaction.write_plan_entry',
                path,
                severity: 'error',
                message: '路径写入必须是普通对象。',
            });
            return;
        }
        if (!['set', 'delete'].includes(mutation.operation)) {
            issues.push({
                code: 'transaction.write_plan_operation',
                path: `${path}.operation`,
                severity: 'error',
                message: '路径写入 operation 必须是 set 或 delete。',
            });
        }
        if (!pointerSegments(mutation.path)?.length) {
            issues.push({
                code: 'transaction.write_plan_path',
                path: `${path}.path`,
                severity: 'error',
                message: '路径写入必须使用非根 JSON Pointer。',
            });
        } else {
            paths.push(mutation.path);
        }
        if (mutation.operation === 'set' && !Object.hasOwn(mutation, 'value')) {
            issues.push({
                code: 'transaction.write_plan_value',
                path: `${path}.value`,
                severity: 'error',
                message: 'set 写入必须显式提供 value。',
            });
        }
    });
    if (new Set(paths).size !== paths.length) {
        issues.push({
            code: 'transaction.write_plan_duplicate_path',
            path: '$.writePlan',
            severity: 'error',
            message: '同一事务不能重复写同一路径。',
        });
    }
    for (const path of paths) {
        if (paths.some((other) => (
            other !== path && path.startsWith(`${other}/`)
        ))) {
            issues.push({
                code: 'transaction.write_plan_overlapping_paths',
                path,
                severity: 'error',
                message: '同一事务不能同时写父路径与其子路径。',
            });
        }
    }
    return { ok: issues.length === 0, issues, paths: [...new Set(paths)] };
}

export function applyPathMutations(state, mutations) {
    const validation = validatePathMutations(mutations);
    if (!validation.ok) return { ok: false, issues: validation.issues, value: null };
    const value = deepClone(state);
    const issues = [];
    mutations.forEach((mutation, index) => {
        const destination = pointerParent(value, mutation.path);
        if (!destination) {
            issues.push({
                code: 'transaction.write_parent_missing',
                path: `$.writePlan[${index}].path`,
                severity: 'error',
                message: '写入目标的父路径不存在。',
            });
            return;
        }
        const { parent, key } = destination;
        if (Array.isArray(parent)) {
            const arrayIndex = Number(key);
            if (
                mutation.operation !== 'set'
                || !Number.isInteger(arrayIndex)
                || arrayIndex < 0
                || arrayIndex >= parent.length
            ) {
                issues.push({
                    code: 'transaction.array_structure_ambiguous',
                    path: `$.writePlan[${index}].path`,
                    severity: 'error',
                    message: '阶段2只允许替换现有数组元素；数组插入/删除必须写整个集合路径。',
                });
                return;
            }
            parent[arrayIndex] = deepClone(mutation.value);
            return;
        }
        if (mutation.operation === 'set') {
            parent[key] = deepClone(mutation.value);
        } else if (!Object.hasOwn(parent, key)) {
            issues.push({
                code: 'transaction.delete_target_missing',
                path: `$.writePlan[${index}].path`,
                severity: 'error',
                message: 'delete 写入目标不存在。',
            });
        } else {
            delete parent[key];
        }
    });
    return {
        ok: issues.length === 0,
        issues,
        value: issues.length ? null : value,
        touchedRefs: validation.paths,
    };
}

function restorePath(target, before) {
    const destination = pointerParent(target, before.path);
    if (!destination) return false;
    if (Array.isArray(destination.parent)) {
        const index = Number(destination.key);
        if (
            !Number.isInteger(index)
            || index < 0
            || index >= destination.parent.length
            || !before.found
        ) return false;
        destination.parent[index] = deepClone(before.value);
        return true;
    }
    if (before.found) {
        destination.parent[destination.key] = deepClone(before.value);
    } else {
        delete destination.parent[destination.key];
    }
    return true;
}

/**
 * Restore a path only when its current value still equals this transaction's
 * recorded write-after value. Concurrent changes on the same path win.
 */
export function buildCompareAndRestoreRollback(
    currentState,
    beforeEntries,
    afterEntries,
) {
    const value = deepClone(currentState);
    const beforeByPath = pathValueMap(beforeEntries);
    const afterByPath = pathValueMap(afterEntries);
    const revertedPaths = [];
    const preservedPaths = [];
    const failedPaths = [];
    for (const [path, after] of afterByPath) {
        const current = pointerGet(value, path);
        if (!pathValuesEqual(current, after)) {
            preservedPaths.push(path);
            continue;
        }
        const before = beforeByPath.get(path);
        if (!before || !restorePath(value, before)) {
            failedPaths.push(path);
            continue;
        }
        revertedPaths.push(path);
    }
    return {
        ok: failedPaths.length === 0,
        value,
        revertedPaths,
        preservedPaths,
        failedPaths,
    };
}

export function pathEntriesMatch(state, expectedEntries) {
    return Array.isArray(expectedEntries) && expectedEntries.every((expected) => (
        pathValuesEqual(pointerGet(state, expected.path), expected)
    ));
}

export function evaluatePathPreconditions(state, preconditions = []) {
    const issues = [];
    if (!Array.isArray(preconditions)) {
        return {
            ok: false,
            issues: [{
                code: 'transaction.preconditions_type',
                path: '$.preconditions',
                severity: 'error',
                message: 'preconditions 必须是数组。',
            }],
        };
    }
    preconditions.forEach((precondition, index) => {
        const basePath = `$.preconditions[${index}]`;
        if (!isPlainObject(precondition)) {
            issues.push({
                code: 'transaction.precondition_type',
                path: basePath,
                severity: 'error',
                message: '路径前置条件必须是普通对象。',
            });
            return;
        }
        if (!['path-equals', 'path-present', 'path-absent'].includes(precondition.type)) {
            issues.push({
                code: 'transaction.precondition_kind_unresolved',
                path: `${basePath}.type`,
                severity: 'unresolved',
                message: '未知前置条件不能被静默忽略，必须由后续领域适配器显式处理。',
            });
            return;
        }
        if (!pointerSegments(precondition.path)?.length) {
            issues.push({
                code: 'transaction.precondition_path',
                path: `${basePath}.path`,
                severity: 'error',
                message: '路径前置条件必须使用非根 JSON Pointer。',
            });
            return;
        }
        const actual = pointerGet(state, precondition.path);
        let matched = false;
        if (precondition.type === 'path-present') {
            matched = actual.found;
        } else if (precondition.type === 'path-absent') {
            matched = !actual.found;
        } else if (!Object.hasOwn(precondition, 'value')) {
            issues.push({
                code: 'transaction.precondition_value_missing',
                path: `${basePath}.value`,
                severity: 'error',
                message: 'path-equals 必须显式提供 value。',
            });
            return;
        } else {
            matched = pathValuesEqual(actual, {
                found: true,
                value: precondition.value,
            });
        }
        if (!matched) {
            issues.push({
                code: 'transaction.precondition_failed',
                path: basePath,
                severity: 'error',
                message: '事务路径前置条件不成立。',
                details: {
                    type: precondition.type,
                    path: precondition.path,
                },
            });
        }
    });
    return { ok: issues.length === 0, issues };
}
