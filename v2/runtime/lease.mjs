import { compareMessageFingerprints } from '../transaction/index.mjs';
import { PersistentRecordStore } from './storage.mjs';

const TERMINAL = new Set(['completed', 'failed', 'timed-out', 'stale']);

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function diagnostic(code, message, now, details = {}) {
    return {
        code,
        message,
        observedAt: now,
        ...clone(details),
    };
}

export class TaskLeaseManager {
    #records;
    #now;
    #heartbeatTimeoutMs;

    constructor(adapter, {
        namespace = 'task-leases',
        now = () => Date.now(),
        heartbeatTimeoutMs = 10 * 60 * 1000,
    } = {}) {
        this.#records = new PersistentRecordStore(adapter, { namespace });
        this.#now = now;
        this.#heartbeatTimeoutMs = Math.max(1000, Number(heartbeatTimeoutMs) || 1);
    }

    async create({
        id,
        branchId,
        target,
        phase = 'queued',
        softDeadlineAt,
        hardDeadlineAt,
    }) {
        const now = this.#now();
        if (!id || !branchId || !target) {
            throw new TypeError('TaskLease requires id, branchId and target.');
        }
        return this.#records.update(id, (current) => current ?? {
            id: String(id),
            branchId: String(branchId),
            target: clone(target),
            phase: String(phase),
            status: 'queued',
            progress: null,
            startedAt: now,
            heartbeatAt: now,
            softDeadlineAt: Number(softDeadlineAt),
            hardDeadlineAt: Number(hardDeadlineAt),
            diagnostic: null,
        });
    }

    async read(id) {
        return this.#records.read(id);
    }

    async start(id, phase = 'running') {
        const now = this.#now();
        return this.#records.update(id, (lease) => {
            if (!lease || TERMINAL.has(lease.status)) return undefined;
            return {
                ...lease,
                phase: String(phase),
                status: 'running',
                heartbeatAt: now,
            };
        });
    }

    async heartbeat(id, { phase, progress } = {}) {
        const now = this.#now();
        return this.#records.update(id, (lease) => {
            if (!lease || lease.status !== 'running') return undefined;
            return {
                ...lease,
                ...(phase ? { phase: String(phase) } : {}),
                ...(progress ? { progress: clone(progress) } : {}),
                heartbeatAt: now,
            };
        });
    }

    async requestCancel(id, reason = 'soft-cancel') {
        const now = this.#now();
        return this.#records.update(id, (lease) => {
            if (!lease || TERMINAL.has(lease.status)) return undefined;
            return {
                ...lease,
                status: 'cancel-requested',
                diagnostic: diagnostic(
                    'task.cancel_requested',
                    '任务已请求取消；迟到结果不会写入。',
                    now,
                    { reason: String(reason) },
                ),
            };
        });
    }

    async complete(id) {
        const now = this.#now();
        return this.#records.update(id, (lease) => {
            if (!lease || lease.status !== 'running') return undefined;
            return {
                ...lease,
                status: 'completed',
                completedAt: now,
                heartbeatAt: now,
            };
        });
    }

    async fail(id, reason) {
        const now = this.#now();
        return this.#records.update(id, (lease) => {
            if (!lease || TERMINAL.has(lease.status)) return undefined;
            return {
                ...lease,
                status: 'failed',
                diagnostic: diagnostic(
                    'task.failed',
                    '任务失败，未验证结果不会写入。',
                    now,
                    { reason: String(reason || '') },
                ),
            };
        });
    }

    async markStale(id, reason = 'target-changed') {
        const now = this.#now();
        return this.#records.update(id, (lease) => {
            if (!lease || TERMINAL.has(lease.status)) return undefined;
            return {
                ...lease,
                status: 'stale',
                diagnostic: diagnostic(
                    'task.stale',
                    '目标或分支已变化；任务结果被丢弃。',
                    now,
                    { reason: String(reason) },
                ),
            };
        });
    }

    async watchdog(id, now = this.#now()) {
        return this.#records.update(id, (lease) => {
            if (!lease || TERMINAL.has(lease.status)) return undefined;
            const heartbeatGapMs = now - Number(lease.heartbeatAt);
            if (now >= Number(lease.hardDeadlineAt)) {
                return {
                    ...lease,
                    status: 'timed-out',
                    diagnostic: diagnostic(
                        'task.hard_timeout',
                        '任务超过硬期限，已终止并禁止未验证写入。',
                        now,
                        { heartbeatGapMs },
                    ),
                };
            }
            if (
                lease.status === 'running'
                && heartbeatGapMs >= this.#heartbeatTimeoutMs
            ) {
                return {
                    ...lease,
                    status: now >= Number(lease.softDeadlineAt)
                        ? 'cancel-requested'
                        : lease.status,
                    diagnostic: diagnostic(
                        'task.heartbeat_missing',
                        '任务心跳中断，已进入看门狗复核。',
                        now,
                        { heartbeatGapMs },
                    ),
                };
            }
            if (now >= Number(lease.softDeadlineAt)) {
                return {
                    ...lease,
                    diagnostic: diagnostic(
                        'task.soft_deadline',
                        '任务已超过软期限，可安全取消。',
                        now,
                    ),
                };
            }
            return undefined;
        });
    }

    async acceptsResult(id, current) {
        const lease = await this.read(id);
        if (!lease || lease.status !== 'running') return false;
        if (
            current?.branch?.id !== lease.branchId
            || current.branch.status !== 'active'
        ) {
            await this.markStale(id, 'active branch changed');
            return false;
        }
        const compared = compareMessageFingerprints(lease.target, current.fingerprint);
        if (!compared.ok) {
            await this.markStale(id, 'message fingerprint changed');
            return false;
        }
        if (this.#now() >= Number(lease.hardDeadlineAt)) {
            await this.watchdog(id);
            return false;
        }
        return true;
    }
}
