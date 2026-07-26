import { deepClone, isPlainObject } from '../domain/common.mjs';
import { validateBranch } from './branch.mjs';
import {
    compareMessageFingerprints,
    validateMessageFingerprint,
} from './fingerprint.mjs';
import {
    applyPathMutations,
    buildCompareAndRestoreRollback,
    capturePathValues,
    pathEntriesMatch,
} from './paths.mjs';
import { SingleWriteQueue } from './queue.mjs';
import {
    abortTransaction,
    idempotencyScopeKey,
    markTransactionCommitted,
    markTransactionRolledBack,
    markTransactionStale,
    prepareTransaction,
    validateTransaction,
} from './transaction.mjs';

export const TRANSACTION_HOST_BRIDGE_METHODS = Object.freeze([
    'captureCurrent',
    'readExact',
    'writeExact',
    'persistRecovery',
    'persistTransaction',
]);

export function validateTransactionHostBridge(host) {
    const missing = TRANSACTION_HOST_BRIDGE_METHODS
        .filter((method) => typeof host?.[method] !== 'function');
    return {
        ok: missing.length === 0,
        missing,
        message: missing.length
            ? `事务宿主桥缺少：${missing.join('、')}。`
            : '',
    };
}

export class InMemoryIdempotencyStore {
    #records = new Map();

    async get(scope) {
        const record = this.#records.get(scope);
        return record ? deepClone(record) : null;
    }

    async claim(scope, transactionId) {
        const current = this.#records.get(scope);
        if (!current) {
            const claimed = {
                status: 'claimed',
                transactionId,
            };
            this.#records.set(scope, claimed);
            return deepClone(claimed);
        }
        if (
            current.status === 'claimed'
            && current.transactionId === transactionId
        ) {
            return { ...deepClone(current), owner: true };
        }
        return deepClone(current);
    }

    async release(scope, transactionId) {
        const current = this.#records.get(scope);
        if (
            current?.status === 'claimed'
            && current.transactionId === transactionId
        ) {
            this.#records.delete(scope);
            return true;
        }
        return false;
    }

    async settle(scope, transaction) {
        const current = this.#records.get(scope);
        if (
            current
            && current.status === 'claimed'
            && current.transactionId !== transaction.id
        ) {
            throw new Error('幂等键已由另一个事务占用。');
        }
        this.#records.set(scope, {
            status: 'settled',
            transactionId: transaction.id,
            transaction: deepClone(transaction),
        });
        return true;
    }
}

export function createInMemoryIdempotencyStore() {
    return new InMemoryIdempotencyStore();
}

function terminalResult(transaction, issues = [], extra = {}) {
    return {
        ok: transaction?.status === 'committed',
        status: transaction?.status ?? 'failed',
        transaction,
        issues,
        ...extra,
    };
}

export class TransactionKernel {
    #host;

    #queue;

    #idempotency;

    #handles = new Map();

    constructor(host, {
        queue = new SingleWriteQueue(),
        idempotencyStore = new InMemoryIdempotencyStore(),
        now = () => Date.now(),
    } = {}) {
        const bridge = validateTransactionHostBridge(host);
        if (!bridge.ok) throw new TypeError(bridge.message);
        for (const method of ['get', 'claim', 'release', 'settle']) {
            if (typeof idempotencyStore?.[method] !== 'function') {
                throw new TypeError(`幂等存储缺少 ${method}。`);
            }
        }
        this.#host = host;
        this.#queue = queue;
        this.#idempotency = idempotencyStore;
        this.now = now;
    }

    get queue() {
        return this.#queue;
    }

    async #captureValidatedCurrent() {
        const captured = await this.#host.captureCurrent();
        const fingerprint = validateMessageFingerprint(captured?.fingerprint);
        const branch = validateBranch(captured?.branch);
        if (!fingerprint.ok || !branch.ok) {
            return {
                ok: false,
                fingerprint: fingerprint.value,
                branch: branch.value,
                issues: [...fingerprint.issues, ...branch.issues],
            };
        }
        if (
            branch.value.status !== 'active'
            || branch.value.id !== fingerprint.value.branchId
        ) {
            return {
                ok: false,
                fingerprint: fingerprint.value,
                branch: branch.value,
                issues: [{
                    code: 'transaction.host_current_branch_invalid',
                    path: '$.captureCurrent',
                    severity: 'error',
                    message: '宿主当前指纹必须绑定 active 分支。',
                }],
            };
        }
        return {
            ok: true,
            fingerprint: fingerprint.value,
            branch: branch.value,
            issues: [],
        };
    }

    async #persistTerminal(transaction) {
        await this.#host.persistTransaction(deepClone(transaction));
        return transaction;
    }

    async prepare(input, {
        writePlan,
        domainResults = [],
    } = {}) {
        const transaction = validateTransaction(input);
        if (!transaction.ok) {
            const aborted = {
                ...transaction.value,
                status: 'aborted',
                terminalReason: '事务结构未通过验证。',
            };
            await this.#persistTerminal(aborted);
            return terminalResult(aborted, transaction.issues);
        }
        const captured = await this.#captureValidatedCurrent();
        if (!captured.ok) {
            const stale = markTransactionStale(
                transaction.value,
                '无法无歧义确认宿主当前指纹与分支。',
            ).value;
            await this.#persistTerminal(stale);
            return terminalResult(stale, captured.issues);
        }
        const targetMatch = compareMessageFingerprints(
            transaction.value.target,
            captured.fingerprint,
        );
        if (!targetMatch.ok) {
            const stale = markTransactionStale(
                transaction.value,
                'prepare 时完整 MessageFingerprint 已失配。',
            ).value;
            await this.#persistTerminal(stale);
            return terminalResult(stale, targetMatch.issues, {
                mismatches: targetMatch.mismatches,
            });
        }
        const beforeState = await this.#host.readExact(transaction.value.target);
        if (beforeState === undefined || beforeState === null) {
            const aborted = abortTransaction(
                transaction.value,
                '无法读取事务的精确目标；禁止回退到 latest。',
            ).value;
            await this.#persistTerminal(aborted);
            return terminalResult(aborted, [{
                code: 'transaction.exact_read_missing',
                path: '$.target',
                severity: 'error',
                message: '宿主没有返回精确目标状态。',
            }]);
        }
        const prepared = prepareTransaction(transaction.value, {
            activeBranch: captured.branch,
            currentFingerprint: captured.fingerprint,
            beforeState,
            writePlan,
            domainResults,
        });
        if (prepared.status === 'prepared') {
            const handle = {
                transaction: prepared.transaction,
                writePlan: prepared.prepared.writePlan,
                beforeTouched: prepared.prepared.beforeTouched,
                afterTouched: prepared.prepared.afterTouched,
            };
            this.#handles.set(handle.transaction.id, handle);
        } else {
            await this.#persistTerminal(prepared.transaction);
        }
        return prepared;
    }

    #resolveHandle(handleOrId) {
        if (typeof handleOrId === 'string') return this.#handles.get(handleOrId) ?? null;
        if (isPlainObject(handleOrId?.prepared) && handleOrId?.transaction) {
            return {
                transaction: handleOrId.transaction,
                writePlan: handleOrId.prepared.writePlan,
                beforeTouched: handleOrId.prepared.beforeTouched,
                afterTouched: handleOrId.prepared.afterTouched,
            };
        }
        if (
            isPlainObject(handleOrId)
            && isPlainObject(handleOrId.transaction)
            && Array.isArray(handleOrId.writePlan)
        ) {
            return handleOrId;
        }
        return null;
    }

    async commit(handleOrId) {
        const handle = this.#resolveHandle(handleOrId);
        if (!handle) {
            return {
                ok: false,
                status: 'aborted',
                transaction: null,
                issues: [{
                    code: 'transaction.prepared_handle_missing',
                    path: '$',
                    severity: 'error',
                    message: 'commit 需要本内核产生的 prepared handle。',
                }],
            };
        }
        return this.#queue.enqueue(
            () => this.#commitUnlocked(handle),
            { transactionId: handle.transaction.id },
        );
    }

    async #markStale(handle, reason, issues = [], extra = {}) {
        const result = markTransactionStale(handle.transaction, reason);
        handle.transaction = result.value;
        this.#handles.set(handle.transaction.id, handle);
        await this.#persistTerminal(handle.transaction);
        return terminalResult(handle.transaction, [...issues, ...result.issues], extra);
    }

    async #commitUnlocked(handle) {
        let transaction = validateTransaction(handle.transaction);
        if (!transaction.ok || transaction.value.status !== 'prepared') {
            return terminalResult(transaction.value, transaction.issues);
        }
        handle.transaction = transaction.value;
        const scope = idempotencyScopeKey(
            transaction.value.branchId,
            transaction.value.idempotencyKey,
        );
        const prior = await this.#idempotency.get(scope);
        if (prior?.status === 'settled') {
            return terminalResult(prior.transaction, [], {
                status: 'duplicate',
                duplicate: true,
                originalStatus: prior.transaction?.status,
            });
        }

        const captured = await this.#captureValidatedCurrent();
        if (!captured.ok) {
            return this.#markStale(
                handle,
                'commit 前无法无歧义确认当前分支。',
                captured.issues,
            );
        }
        const targetMatch = compareMessageFingerprints(
            transaction.value.target,
            captured.fingerprint,
        );
        if (
            !targetMatch.ok
            || captured.branch.id !== transaction.value.branchId
            || captured.branch.status !== 'active'
        ) {
            return this.#markStale(
                handle,
                'commit 前完整 MessageFingerprint 或 active 分支已变化。',
                targetMatch.issues,
                { mismatches: targetMatch.mismatches },
            );
        }

        const currentState = await this.#host.readExact(transaction.value.target);
        if (currentState === undefined || currentState === null) {
            const aborted = abortTransaction(
                transaction.value,
                'commit 前无法回读精确目标。',
            ).value;
            handle.transaction = aborted;
            await this.#persistTerminal(aborted);
            return terminalResult(aborted);
        }
        if (!pathEntriesMatch(currentState, handle.beforeTouched)) {
            const aborted = abortTransaction(
                transaction.value,
                '本事务触及路径在排队期间已被其他写者修改。',
            ).value;
            handle.transaction = aborted;
            await this.#persistTerminal(aborted);
            return terminalResult(aborted, [{
                code: 'transaction.touched_path_conflict',
                path: '$.touchedRefs',
                severity: 'error',
                message: '触及路径前置值已经变化；未写入。',
            }]);
        }

        const claim = await this.#idempotency.claim(scope, transaction.value.id);
        if (
            claim.status === 'settled'
            || (
                claim.status === 'claimed'
                && claim.transactionId !== transaction.value.id
            )
        ) {
            return terminalResult(claim.transaction ?? transaction.value, [], {
                status: claim.status === 'settled' ? 'duplicate' : 'duplicate-inflight',
                duplicate: true,
                originalStatus: claim.transaction?.status,
            });
        }

        const secondCapture = await this.#captureValidatedCurrent();
        const secondMatch = secondCapture.ok
            ? compareMessageFingerprints(transaction.value.target, secondCapture.fingerprint)
            : { ok: false, issues: secondCapture.issues, mismatches: [] };
        if (
            !secondCapture.ok
            || !secondMatch.ok
            || secondCapture.branch.id !== transaction.value.branchId
        ) {
            await this.#idempotency.release(scope, transaction.value.id);
            return this.#markStale(
                handle,
                '幂等键占位后目标或分支已变化。',
                secondMatch.issues,
                { mismatches: secondMatch.mismatches },
            );
        }

        const applied = applyPathMutations(currentState, handle.writePlan);
        if (!applied.ok) {
            await this.#idempotency.release(scope, transaction.value.id);
            const aborted = abortTransaction(
                transaction.value,
                '写入计划无法应用到精确目标。',
            ).value;
            handle.transaction = aborted;
            await this.#persistTerminal(aborted);
            return terminalResult(aborted, applied.issues);
        }
        const afterTouched = capturePathValues(
            applied.value,
            transaction.value.touchedRefs,
        );
        const recovery = {
            id: `recovery_${transaction.value.id}`,
            protocolVersion: '2.0',
            transactionId: transaction.value.id,
            branchId: transaction.value.branchId,
            target: deepClone(transaction.value.target),
            status: 'prepared',
            writeAttempted: false,
            beforeTouched: deepClone(handle.beforeTouched),
            afterTouched: deepClone(afterTouched),
            createdAt: this.now(),
        };
        await this.#host.persistRecovery(deepClone(recovery));

        try {
            recovery.writeAttempted = true;
            await this.#host.writeExact(
                transaction.value.target,
                deepClone(applied.value),
            );
            const landed = await this.#host.readExact(transaction.value.target);
            if (!pathEntriesMatch(landed, afterTouched)) {
                return this.#rollbackAfterWriteFailure(
                    handle,
                    recovery,
                    scope,
                    '写后精确回读与事务 after 值不一致。',
                );
            }
            const committed = markTransactionCommitted(
                transaction.value,
                this.now(),
            ).value;
            handle.transaction = committed;
            handle.afterTouched = afterTouched;
            recovery.status = 'committed';
            recovery.committedAt = committed.committedAt;
            await this.#host.persistTransaction(deepClone(committed));
            await this.#host.persistRecovery(deepClone(recovery));
            await this.#idempotency.settle(scope, committed);
            this.#handles.set(committed.id, handle);
            return terminalResult(committed, [], {
                status: 'committed',
                duplicate: false,
            });
        } catch (error) {
            return this.#rollbackAfterWriteFailure(
                handle,
                recovery,
                scope,
                `精确目标写入异常：${error?.message || error}`,
            );
        }
    }

    async #rollbackAfterWriteFailure(handle, recovery, scope, reason) {
        const captured = await this.#captureValidatedCurrent();
        const targetMatch = captured.ok
            ? compareMessageFingerprints(handle.transaction.target, captured.fingerprint)
            : { ok: false, issues: captured.issues, mismatches: [] };
        if (
            !captured.ok
            || !targetMatch.ok
            || captured.branch.id !== handle.transaction.branchId
        ) {
            return this.#manualRecovery(
                handle,
                recovery,
                scope,
                `${reason}；当前分支已变化，禁止向新分支执行回滚。`,
                targetMatch.issues,
                { mismatches: targetMatch.mismatches },
            );
        }
        try {
            const current = await this.#host.readExact(handle.transaction.target);
            if (current === undefined || current === null) {
                return this.#manualRecovery(
                    handle,
                    recovery,
                    scope,
                    `${reason}；回滚前无法读取精确目标。`,
                );
            }
            const rollback = buildCompareAndRestoreRollback(
                current,
                handle.beforeTouched,
                recovery.afterTouched,
            );
            if (!rollback.ok) {
                recovery.rollback = deepClone(rollback);
                return this.#manualRecovery(
                    handle,
                    recovery,
                    scope,
                    `${reason}；无法构造全部安全路径回滚。`,
                );
            }
            const preservedBeforeRollback = capturePathValues(
                current,
                rollback.preservedPaths,
            );
            if (rollback.revertedPaths.length) {
                await this.#host.writeExact(
                    handle.transaction.target,
                    deepClone(rollback.value),
                );
            }
            const landed = await this.#host.readExact(handle.transaction.target);
            const beforeByPath = new Map(
                handle.beforeTouched.map((entry) => [entry.path, entry]),
            );
            const revertedExpected = rollback.revertedPaths
                .map((path) => beforeByPath.get(path))
                .filter(Boolean);
            const verified = pathEntriesMatch(landed, revertedExpected)
                && pathEntriesMatch(landed, preservedBeforeRollback);
            if (!verified) {
                recovery.rollback = deepClone(rollback);
                return this.#manualRecovery(
                    handle,
                    recovery,
                    scope,
                    `${reason}；路径级回滚后的精确回读未通过。`,
                );
            }
            const rolledBack = markTransactionRolledBack(
                handle.transaction,
                reason,
                {
                    revertedPaths: rollback.revertedPaths,
                    preservedConcurrentPaths: rollback.preservedPaths,
                },
            ).value;
            handle.transaction = rolledBack;
            recovery.status = 'rolled_back';
            recovery.reason = reason;
            recovery.rollback = deepClone(rolledBack.rollback);
            await this.#host.persistTransaction(deepClone(rolledBack));
            await this.#host.persistRecovery(deepClone(recovery));
            await this.#idempotency.settle(scope, rolledBack);
            this.#handles.set(rolledBack.id, handle);
            return terminalResult(rolledBack, [], {
                status: 'rolled_back',
                recovery: deepClone(recovery),
            });
        } catch (error) {
            return this.#manualRecovery(
                handle,
                recovery,
                scope,
                `${reason}；路径级回滚异常：${error?.message || error}`,
            );
        }
    }

    async #manualRecovery(
        handle,
        recovery,
        scope,
        reason,
        issues = [],
        extra = {},
    ) {
        recovery.status = 'manual-recovery';
        recovery.reason = reason;
        await this.#host.persistRecovery(deepClone(recovery));
        const guardedTransaction = {
            ...handle.transaction,
            terminalReason: reason,
        };
        await this.#idempotency.settle(scope, guardedTransaction);
        return terminalResult(handle.transaction, issues, {
            status: 'manual-recovery',
            recovery: deepClone(recovery),
            ...extra,
        });
    }

    async rollback(handleOrId, reason = '调用方请求路径级回滚。') {
        const handle = this.#resolveHandle(handleOrId);
        if (!handle) {
            return {
                ok: false,
                status: 'aborted',
                transaction: null,
                issues: [{
                    code: 'transaction.rollback_handle_missing',
                    path: '$',
                    severity: 'error',
                    message: 'rollback 需要本内核保留的事务恢复记录。',
                }],
            };
        }
        return this.#queue.enqueue(async () => {
            if (!['prepared', 'committed'].includes(handle.transaction.status)) {
                return terminalResult(handle.transaction, [{
                    code: 'transaction.rollback_status',
                    path: '$.status',
                    severity: 'error',
                    message: '只有 prepared/committed 事务可以回滚。',
                }]);
            }
            const scope = idempotencyScopeKey(
                handle.transaction.branchId,
                handle.transaction.idempotencyKey,
            );
            const recovery = {
                id: `recovery_${handle.transaction.id}`,
                protocolVersion: '2.0',
                transactionId: handle.transaction.id,
                branchId: handle.transaction.branchId,
                target: deepClone(handle.transaction.target),
                status: 'rollback-requested',
                writeAttempted: true,
                beforeTouched: deepClone(handle.beforeTouched),
                afterTouched: deepClone(handle.afterTouched),
                createdAt: this.now(),
            };
            return this.#rollbackAfterWriteFailure(
                handle,
                recovery,
                scope,
                reason,
            );
        }, { transactionId: handle.transaction.id });
    }

    async abort(handleOrId, reason = '调用方中止事务。') {
        const handle = this.#resolveHandle(handleOrId);
        if (!handle) return null;
        const aborted = abortTransaction(handle.transaction, reason);
        if (!aborted.ok) return terminalResult(aborted.value, aborted.issues);
        handle.transaction = aborted.value;
        this.#handles.set(aborted.value.id, handle);
        await this.#persistTerminal(aborted.value);
        return terminalResult(aborted.value, aborted.issues);
    }
}

export function createTransactionKernel(host, options) {
    return new TransactionKernel(host, options);
}
