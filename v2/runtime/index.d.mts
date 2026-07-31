import type {
    Branch,
    MessageFingerprint,
    Transaction,
} from '../transaction/index.mjs';

export interface VersionedRecord<T = unknown> {
    revision: number;
    value: T;
}

export interface VersionedAdapter {
    read(key: string): Promise<VersionedRecord | null>;
    compareAndSwap(
        key: string,
        expectedRevision: number | null,
        value: unknown,
    ): Promise<boolean>;
}

export class MemoryVersionedAdapter implements VersionedAdapter {
    read(key: string): Promise<VersionedRecord | null>;
    compareAndSwap(
        key: string,
        expectedRevision: number | null,
        value: unknown,
    ): Promise<boolean>;
    entries(prefix?: string): Promise<Array<VersionedRecord & { key: string }>>;
}

export class PersistentRecordStore<T = unknown> {
    constructor(
        adapter: VersionedAdapter,
        options?: { namespace?: string; maxAttempts?: number },
    );
    read(key: string): Promise<T | null>;
    update(
        key: string,
        updater: (current: T | null) => T | undefined | Promise<T | undefined>,
    ): Promise<T | null>;
}

export class PersistentIdempotencyStore {
    constructor(
        adapter: VersionedAdapter,
        options?: { namespace?: string; maxAttempts?: number },
    );
    get(scope: string): Promise<Record<string, unknown> | null>;
    claim(scope: string, transactionId: string): Promise<Record<string, unknown>>;
    release(scope: string, transactionId: string): Promise<Record<string, unknown>>;
    settle(scope: string, transaction: Transaction): Promise<Record<string, unknown>>;
}

export class PersistentRecoveryStore {
    constructor(
        adapter: VersionedAdapter,
        options?: { namespace?: string; maxAttempts?: number },
    );
    persist(record: Record<string, unknown> & { id: string }): Promise<Record<string, unknown>>;
    settle(
        id: string,
        status: string,
        details?: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
    get(id: string): Promise<Record<string, unknown> | null>;
}

export type TaskLeaseStatus =
    | 'queued'
    | 'running'
    | 'cancel-requested'
    | 'completed'
    | 'failed'
    | 'timed-out'
    | 'stale';

export interface TaskLease {
    id: string;
    branchId: string;
    target: MessageFingerprint;
    phase: string;
    status: TaskLeaseStatus;
    progress?: {
        current: number;
        total?: number;
        label?: string;
    } | null;
    startedAt: number;
    heartbeatAt: number;
    softDeadlineAt: number;
    hardDeadlineAt: number;
    diagnostic?: Record<string, unknown> | null;
}

export class TaskLeaseManager {
    constructor(
        adapter: VersionedAdapter,
        options?: {
            namespace?: string;
            now?: () => number;
            heartbeatTimeoutMs?: number;
        },
    );
    create(input: Omit<TaskLease, 'status' | 'startedAt' | 'heartbeatAt' | 'progress' | 'diagnostic'>): Promise<TaskLease>;
    read(id: string): Promise<TaskLease | null>;
    start(id: string, phase?: string): Promise<TaskLease>;
    heartbeat(
        id: string,
        update?: Pick<TaskLease, 'phase' | 'progress'>,
    ): Promise<TaskLease>;
    requestCancel(id: string, reason?: string): Promise<TaskLease>;
    complete(id: string): Promise<TaskLease>;
    fail(id: string, reason?: string): Promise<TaskLease>;
    markStale(id: string, reason?: string): Promise<TaskLease>;
    watchdog(id: string, now?: number): Promise<TaskLease>;
    acceptsResult(
        id: string,
        current: { fingerprint: MessageFingerprint; branch: Branch },
    ): Promise<boolean>;
}

export type NarrativeBarrierState =
    | 'captured'
    | 'repairing'
    | 'state-committing'
    | 'settled'
    | 'stale'
    | 'failed';

export interface NarrativeBarrier {
    id: string;
    protocolVersion: '2.0';
    branchId: string;
    target: MessageFingerprint;
    transactionId: string;
    state: NarrativeBarrierState;
    createdAt: number;
    updatedAt: number;
    finalTarget: MessageFingerprint | null;
    terminalReason: string;
}

export function narrativeBarrierKey(target: MessageFingerprint): string;

export class NarrativeBarrierCoordinator {
    constructor(input: {
        adapter: VersionedAdapter;
        host: {
            captureCurrent(): Promise<{
                fingerprint: MessageFingerprint;
                branch: Branch;
            }>;
            executePlannedDomainTransaction(plan: unknown): Promise<Record<string, unknown>>;
            readFinalNarrative?(target: MessageFingerprint): Promise<string>;
            publishBarrier?(barrier: NarrativeBarrier): void;
        };
        now?: () => number;
        softTimeoutMs?: number;
        hardTimeoutMs?: number;
        heartbeatTimeoutMs?: number;
    });
    read(target: MessageFingerprint): Promise<NarrativeBarrier | null>;
    execute(
        plan: unknown,
        options?: {
            repair?: (context: {
                barrier: NarrativeBarrier;
                heartbeat(progress: TaskLease['progress']): Promise<TaskLease>;
            }) => Promise<Record<string, unknown>>;
        },
    ): Promise<Record<string, unknown>>;
    runDownstream<T>(
        target: MessageFingerprint,
        reader: (context: {
            target: MessageFingerprint;
            narrative?: string;
            barrier: NarrativeBarrier;
        }) => T | Promise<T>,
    ): Promise<Record<string, unknown> & { value?: T }>;
}

export interface DatabaseWriteInput {
    payload?: string;
    payloadLength?: number;
    fieldLimit?: number;
    statement: string;
    parameters: unknown[];
    parameterized?: boolean;
    expectedRevision: number;
    observedRevision: number;
}

export function validateDatabaseWrite(input: DatabaseWriteInput): {
    ok: boolean;
    status: 'valid' | 'rejected';
    length: number;
    limit: number;
    issues: Array<Record<string, unknown>>;
};

export function executeDatabaseWrite(
    input: DatabaseWriteInput,
    host: {
        executeParameterized(
            statement: string,
            parameters: unknown[],
            options: { expectedRevision: number },
        ): Promise<Record<string, unknown> & { committed?: boolean }>;
    },
): Promise<Record<string, unknown>>;

export function runPhase6Replay(
    fixture: Record<string, unknown>,
    runtime?: Record<string, unknown>,
): Promise<Record<string, unknown>>;

export function buildReplayAutomationReport(
    corpus: Record<string, unknown>,
    results: Array<Record<string, unknown>>,
    options?: { generatedAt?: string; environment?: string },
): Record<string, unknown>;

export interface BarrierClientRegistration {
    id: string;
    protocolVersion: 1;
    settledOnly: true;
    terminalReceipts: true;
}

export function validateBarrierClientRegistration(
    input: Partial<BarrierClientRegistration>,
): Record<string, unknown>;
export function downstreamReceiptId(barrier: NarrativeBarrier): string;
export class DownstreamBarrierProtocol {
    constructor(
        adapter: VersionedAdapter,
        options?: { namespace?: string; now?: () => number },
    );
    register(input: BarrierClientRegistration): Promise<Record<string, unknown>>;
    clientStatus(id: string): Promise<Record<string, unknown>>;
    issue(barrier: NarrativeBarrier): Promise<Record<string, unknown>>;
    acknowledge(input: {
        clientId: string;
        receiptId: string;
        action: 'write' | 'read-final-and-write' | 'abandon';
        targetDigest?: string;
    }): Promise<Record<string, unknown>>;
    readReceipt(receiptId: string): Promise<Record<string, unknown> | null>;
}

export function buildContinuitySourcePlan(input: {
    messages: Array<Record<string, unknown>>;
    fromIndex?: number;
    toIndex?: number;
    barrierHistory?: Array<Record<string, unknown>>;
}): {
    eligibleIndexes: number[];
    skippedIndexes: number[];
    eligibleCount: number;
    skippedCount: number;
    receipts: Array<Record<string, unknown>>;
};
