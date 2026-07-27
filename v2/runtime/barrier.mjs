import {
    compareMessageFingerprints,
    hashText,
} from '../transaction/index.mjs';
import { TaskLeaseManager } from './lease.mjs';
import { PersistentRecordStore } from './storage.mjs';

const TERMINAL = new Set(['settled', 'stale', 'failed']);
const TRANSITIONS = Object.freeze({
    captured: new Set(['repairing', 'stale', 'failed']),
    repairing: new Set(['state-committing', 'stale', 'failed']),
    'state-committing': new Set(['settled', 'stale', 'failed']),
    settled: new Set(),
    stale: new Set(),
    failed: new Set(),
});

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

export function narrativeBarrierKey(target) {
    if (!target || typeof target !== 'object') {
        throw new TypeError('Narrative barrier requires a MessageFingerprint.');
    }
    return hashText(JSON.stringify([
        target.chatId,
        target.logicalIndex,
        target.messageId,
        target.swipeId,
        target.generation,
        target.branchId,
        target.parentHash,
        target.contentHash,
    ]));
}

function targetAndBranchMatch(expectedTarget, captured) {
    const compared = compareMessageFingerprints(expectedTarget, captured?.fingerprint);
    return (
        compared.ok
        && captured?.branch?.id === expectedTarget.branchId
        && captured.branch.status === 'active'
    );
}

function transactionOf(planResult) {
    return planResult?.value?.transaction
        ?? planResult?.transaction
        ?? null;
}

function commitSucceeded(result) {
    if (result?.status === 'committed') return true;
    return (
        result?.status === 'duplicate'
        && (
            result.originalStatus === 'committed'
            || result.transaction?.status === 'committed'
        )
    );
}

class LeaseTimeoutError extends Error {
    constructor() {
        super('Task lease reached its hard deadline.');
        this.name = 'LeaseTimeoutError';
    }
}

export class NarrativeBarrierCoordinator {
    #host;
    #records;
    #leases;
    #now;
    #softTimeoutMs;
    #hardTimeoutMs;

    constructor({
        adapter,
        host,
        now = () => Date.now(),
        softTimeoutMs = 2 * 60 * 1000,
        hardTimeoutMs = 60 * 60 * 1000,
        heartbeatTimeoutMs,
    }) {
        if (
            typeof host?.captureCurrent !== 'function'
            || typeof host?.executePlannedDomainTransaction !== 'function'
        ) {
            throw new TypeError(
                'NarrativeBarrierCoordinator requires captureCurrent and executePlannedDomainTransaction.',
            );
        }
        this.#host = host;
        this.#records = new PersistentRecordStore(adapter, {
            namespace: 'narrative-barriers',
        });
        this.#leases = new TaskLeaseManager(adapter, {
            namespace: 'narrative-barrier-leases',
            now,
            heartbeatTimeoutMs,
        });
        this.#now = now;
        this.#softTimeoutMs = Math.max(1000, Number(softTimeoutMs) || 1);
        this.#hardTimeoutMs = Math.max(
            this.#softTimeoutMs,
            Number(hardTimeoutMs) || 1,
        );
    }

    async read(target) {
        return this.#records.read(narrativeBarrierKey(target));
    }

    async #awaitWithinLease(leaseId, promise, controller) {
        const lease = await this.#leases.read(leaseId);
        const remaining = Math.max(
            0,
            Number(lease?.hardDeadlineAt) - this.#now(),
        );
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(async () => {
                await this.#leases.watchdog(leaseId, Number(lease?.hardDeadlineAt));
                controller?.abort('task lease hard deadline');
                reject(new LeaseTimeoutError());
            }, remaining);
        });
        try {
            return await Promise.race([promise, timeout]);
        } finally {
            clearTimeout(timer);
        }
    }

    async #create(transaction) {
        const key = narrativeBarrierKey(transaction.target);
        const now = this.#now();
        return this.#records.update(key, (current) => current ?? {
            id: `barrier:${key}`,
            protocolVersion: '2.0',
            branchId: transaction.branchId,
            target: clone(transaction.target),
            transactionId: transaction.id,
            state: 'captured',
            createdAt: now,
            updatedAt: now,
            finalTarget: null,
            terminalReason: '',
        });
    }

    async #transition(target, nextState, details = {}) {
        const key = narrativeBarrierKey(target);
        const now = this.#now();
        const record = await this.#records.update(key, (current) => {
            if (!current) throw new Error(`Narrative barrier ${key} is missing.`);
            if (current.state === nextState) return current;
            if (!TRANSITIONS[current.state]?.has(nextState)) {
                throw new Error(
                    `Invalid narrative barrier transition ${current.state} -> ${nextState}.`,
                );
            }
            return {
                ...current,
                ...clone(details),
                state: nextState,
                updatedAt: now,
                ...(TERMINAL.has(nextState) ? { terminalAt: now } : {}),
            };
        });
        if (TERMINAL.has(nextState)) {
            try {
                this.#host.publishBarrier?.(clone(record));
            } catch {
                // Publishing is diagnostic. Durable state remains authoritative.
            }
        }
        return record;
    }

    async execute(planResult, { repair } = {}) {
        const transaction = transactionOf(planResult);
        if (!transaction?.target || !transaction?.branchId || !transaction?.id) {
            return {
                ok: false,
                status: 'unresolved',
                barrier: null,
                transaction: transaction ?? null,
                reason: 'Confirmed DomainTransactionPlan is missing an exact transaction target.',
            };
        }
        const captured = await this.#host.captureCurrent();
        if (!targetAndBranchMatch(transaction.target, captured)) {
            return {
                ok: false,
                status: 'stale',
                barrier: null,
                transaction,
                reason: 'Barrier capture does not match the confirmed transaction target.',
            };
        }

        let barrier = await this.#create(transaction);
        if (barrier.state === 'settled') {
            return {
                ok: true,
                status: 'duplicate',
                barrier,
                transaction,
            };
        }
        if (TERMINAL.has(barrier.state)) {
            return {
                ok: false,
                status: barrier.state,
                barrier,
                transaction,
                reason: barrier.terminalReason,
            };
        }

        const now = this.#now();
        const lease = await this.#leases.create({
            id: `lease:${barrier.id}`,
            branchId: transaction.branchId,
            target: transaction.target,
            softDeadlineAt: now + this.#softTimeoutMs,
            hardDeadlineAt: now + this.#hardTimeoutMs,
        });
        await this.#leases.start(lease.id, 'repairing');
        const controller = new AbortController();

        try {
            barrier = await this.#transition(transaction.target, 'repairing');
            if (typeof repair === 'function') {
                const repaired = await this.#awaitWithinLease(
                    lease.id,
                    repair({
                        barrier: clone(barrier),
                        signal: controller.signal,
                        heartbeat: (progress) => this.#leases.heartbeat(
                            lease.id,
                            { phase: 'repairing', progress },
                        ),
                    }),
                    controller,
                );
                if (repaired?.status === 'stale' || repaired?.status === 'failed') {
                    await this.#leases[
                        repaired.status === 'stale' ? 'markStale' : 'fail'
                    ](lease.id, repaired.reason);
                    barrier = await this.#transition(
                        transaction.target,
                        repaired.status,
                        { terminalReason: String(repaired.reason || '') },
                    );
                    return {
                        ok: false,
                        status: repaired.status,
                        barrier,
                        transaction,
                    };
                }
            }

            const preCommit = await this.#host.captureCurrent();
            if (
                !await this.#leases.acceptsResult(lease.id, preCommit)
                || !targetAndBranchMatch(transaction.target, preCommit)
            ) {
                barrier = await this.#transition(transaction.target, 'stale', {
                    terminalReason: 'Target or branch changed before state commit.',
                });
                return {
                    ok: false,
                    status: 'stale',
                    barrier,
                    transaction,
                };
            }

            barrier = await this.#transition(transaction.target, 'state-committing');
            await this.#leases.heartbeat(lease.id, { phase: 'state-committing' });
            const committed = await this.#awaitWithinLease(
                lease.id,
                this.#host.executePlannedDomainTransaction(planResult, {
                    signal: controller.signal,
                }),
                controller,
            );
            if (!commitSucceeded(committed)) {
                const status = committed?.status === 'stale' ? 'stale' : 'failed';
                await this.#leases[
                    status === 'stale' ? 'markStale' : 'fail'
                ](lease.id, committed?.reason || committed?.status);
                barrier = await this.#transition(transaction.target, status, {
                    terminalReason: String(
                        committed?.reason
                        || `Transaction ended as ${committed?.status || 'unknown'}.`,
                    ),
                });
                return {
                    ok: false,
                    status,
                    barrier,
                    transaction: committed?.transaction ?? transaction,
                    commit: committed,
                };
            }

            const finalCapture = await this.#host.captureCurrent();
            if (
                !await this.#leases.acceptsResult(lease.id, finalCapture)
                || !targetAndBranchMatch(transaction.target, finalCapture)
            ) {
                barrier = await this.#transition(transaction.target, 'stale', {
                    terminalReason: 'Final fingerprint or active branch changed after commit.',
                });
                return {
                    ok: false,
                    status: 'stale',
                    barrier,
                    transaction: committed.transaction ?? transaction,
                    commit: committed,
                };
            }

            await this.#leases.complete(lease.id);
            barrier = await this.#transition(transaction.target, 'settled', {
                finalTarget: clone(finalCapture.fingerprint),
                transactionStatus: committed.status,
            });
            return {
                ok: true,
                status: 'settled',
                barrier,
                transaction: committed.transaction ?? transaction,
                commit: committed,
            };
        } catch (error) {
            if (!(error instanceof LeaseTimeoutError)) {
                await this.#leases.fail(lease.id, error?.message || error);
            }
            barrier = await this.#transition(transaction.target, 'failed', {
                terminalReason: String(error?.message || error || 'Barrier execution failed.'),
            });
            return {
                ok: false,
                status: 'failed',
                barrier,
                transaction,
                reason: barrier.terminalReason,
            };
        }
    }

    async runDownstream(target, reader) {
        const barrier = await this.read(target);
        if (!barrier) {
            return { status: 'blocked', reason: 'Narrative barrier is not registered.' };
        }
        if (barrier.state !== 'settled') {
            return {
                status: ['stale', 'failed'].includes(barrier.state)
                    ? 'abandoned'
                    : 'blocked',
                barrier: clone(barrier),
                reason: `Narrative barrier is ${barrier.state}.`,
            };
        }
        const current = await this.#host.captureCurrent();
        if (!targetAndBranchMatch(barrier.finalTarget, current)) {
            return {
                status: 'abandoned',
                barrier: clone(barrier),
                reason: 'Settled target is no longer the active exact target.',
            };
        }
        const narrative = await this.#host.readFinalNarrative?.(barrier.finalTarget);
        return {
            status: 'completed',
            barrier: clone(barrier),
            value: await reader({
                target: clone(barrier.finalTarget),
                narrative,
                barrier: clone(barrier),
            }),
        };
    }
}
