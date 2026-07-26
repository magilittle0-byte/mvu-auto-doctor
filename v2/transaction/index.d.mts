import type {
    EffectV2,
    EvidenceRef,
    MigrationState,
    ValidationIssue,
    ValidationResult,
} from '../domain/index.mjs';

export type BranchId = string;
export type TransactionId = string;
export type TransactionKind =
    | 'narrative-repair'
    | 'resource'
    | 'inventory'
    | 'equipment'
    | 'skill'
    | 'social'
    | 'quest'
    | 'compound';
export type TransactionStatus =
    | 'proposed'
    | 'prepared'
    | 'committed'
    | 'aborted'
    | 'rolled_back'
    | 'stale';

export interface MessageFingerprint {
    chatId: string;
    logicalIndex: number;
    messageId: string;
    swipeId: number;
    generation: number;
    branchId: BranchId;
    parentHash: string;
    contentHash: string;
    stateHash?: string;
}

export interface Branch {
    id: BranchId;
    schemaVersion: '2.0';
    revision: number;
    parentBranchId?: BranchId;
    divergenceFingerprint: MessageFingerprint;
    headFingerprint: MessageFingerprint;
    status: 'active' | 'abandoned' | 'archived' | 'merged';
    checkpointRef: string;
    transactionIds: TransactionId[];
    factIds: string[];
    questIds: string[];
    extensions?: Record<string, unknown>;
}

export interface BranchCheckpoint {
    id: string;
    schemaVersion: '2.0';
    revision: number;
    branchId: BranchId;
    fingerprint: MessageFingerprint;
    checkpointRef: string;
    stateHash: string;
    payload: unknown;
    migration?: MigrationState;
    extensions?: Record<string, unknown>;
}

export interface Transaction {
    id: TransactionId;
    protocolVersion: '2.0';
    branchId: BranchId;
    target: MessageFingerprint;
    idempotencyKey: string;
    kind: TransactionKind;
    status: TransactionStatus;
    preconditions: TransactionPrecondition[];
    effects: EffectV2[];
    touchedRefs: string[];
    beforeHash?: string;
    afterHash?: string;
    createdAt: number;
    committedAt?: number;
    audit: EvidenceRef[];
    terminalReason?: string;
    rollback?: {
        revertedPaths?: string[];
        preservedConcurrentPaths?: string[];
    };
}

export type TransactionPrecondition =
    | { type: 'path-equals'; path: string; value: unknown }
    | { type: 'path-present'; path: string }
    | { type: 'path-absent'; path: string };

export interface PathMutation {
    operation: 'set' | 'delete';
    path: string;
    value?: unknown;
}

export interface PathValue {
    path: string;
    found: boolean;
    value?: unknown;
}

export interface PreparedTransaction {
    writePlan: PathMutation[];
    beforeTouched: PathValue[];
    afterTouched: PathValue[];
    preparedState?: unknown;
}

export interface TransactionResult {
    ok: boolean;
    status: TransactionStatus | 'duplicate' | 'duplicate-inflight' | 'manual-recovery';
    transaction: Transaction | null;
    issues: ValidationIssue[];
    prepared?: PreparedTransaction;
    duplicate?: boolean;
    originalStatus?: TransactionStatus;
    recovery?: Record<string, unknown>;
}

export interface TransactionHostBridge {
    captureCurrent(): Promise<{
        fingerprint: MessageFingerprint;
        branch: Branch;
    }>;
    readExact(target: MessageFingerprint): Promise<unknown>;
    writeExact(target: MessageFingerprint, state: unknown): Promise<void>;
    persistRecovery(record: Record<string, unknown>): Promise<void>;
    persistTransaction(transaction: Transaction): Promise<void>;
}

export interface IdempotencyStore {
    get(scope: string): Promise<Record<string, unknown> | null>;
    claim(scope: string, transactionId: string): Promise<Record<string, unknown>>;
    release(scope: string, transactionId: string): Promise<boolean>;
    settle(scope: string, transaction: Transaction): Promise<boolean>;
}

export const MESSAGE_FINGERPRINT_FIELDS: readonly (keyof MessageFingerprint)[];
export const BRANCH_STATUSES: readonly Branch['status'][];
export const BRANCH_TRANSITION_KINDS: readonly (
    'normal' | 'continue' | 'regenerate' | 'swipe' | 'explicit-fork'
)[];
export const TRANSACTION_KINDS: readonly TransactionKind[];
export const TRANSACTION_STATUSES: readonly TransactionStatus[];
export const TRANSACTION_TRANSITIONS: Readonly<
    Record<TransactionStatus, readonly TransactionStatus[]>
>;
export const TRANSACTION_HOST_BRIDGE_METHODS: readonly (
    keyof TransactionHostBridge
)[];

export function sha256Text(text: string): string;
export function hashText(value: unknown): string;
export function hashCanonical(value: unknown): string;
export function canonicalSerialize(value: unknown): string;

export function normalizeMessageFingerprint(input: unknown): MessageFingerprint;
export function validateMessageFingerprint(
    input: unknown,
    path?: string,
): ValidationResult<MessageFingerprint>;
export function createMessageFingerprint(
    input: unknown,
): ValidationResult<MessageFingerprint>;
export function compareMessageFingerprints(
    expected: unknown,
    actual: unknown,
    options?: { compareStateHash?: boolean },
): {
    ok: boolean;
    status: 'match' | 'stale' | 'unresolved';
    expected: MessageFingerprint;
    actual: MessageFingerprint;
    mismatches: Array<{ field: string; expected: unknown; actual: unknown }>;
    issues: ValidationIssue[];
};
export function adaptHostMessageFingerprint(
    snapshot: unknown,
    options?: Record<string, unknown>,
): ValidationResult<MessageFingerprint> & { identitySource: string };

export function normalizeBranch(input: unknown): Branch;
export function validateBranch(input: unknown): ValidationResult<Branch>;
export function createBranch(input: unknown): ValidationResult<Branch>;
export function createBranchId(input: {
    parentBranchId?: string;
    divergenceFingerprint: MessageFingerprint;
    kind?: string;
}): string;
export function transitionBranch(
    current: unknown,
    nextFingerprint: unknown,
    options: {
        kind: 'normal' | 'continue' | 'regenerate' | 'swipe' | 'explicit-fork';
        checkpointRef?: string;
    },
): {
    ok: boolean;
    status: 'advanced' | 'forked' | 'rejected';
    activeBranch: Branch | null;
    abandonedBranch: Branch | null;
    issues: ValidationIssue[];
};
export function appendBranchTransaction(
    branch: unknown,
    transactionId: string,
): ValidationResult<Branch>;

export function normalizeBranchCheckpoint(input: unknown): BranchCheckpoint;
export function validateBranchCheckpoint(
    input: unknown,
): ValidationResult<BranchCheckpoint>;
export function migrateLegacyBranchCheckpoint(
    legacy: unknown,
    options?: Record<string, unknown>,
): ValidationResult<BranchCheckpoint> & { migration: MigrationState };

export function normalizeTransaction(input: unknown): Transaction;
export function validateTransaction(input: unknown): ValidationResult<Transaction>;
export function createTransaction(input: unknown): ValidationResult<Transaction>;
export function createTransactionId(input: unknown): string;
export function createIdempotencyKey(input: unknown): string;
export function idempotencyScopeKey(branchId: string, key: string): string;
export function transitionTransaction(
    transaction: unknown,
    nextStatus: TransactionStatus,
    patch?: Partial<Transaction>,
): ValidationResult<Transaction>;
export function abortTransaction(
    transaction: unknown,
    reason?: string,
): ValidationResult<Transaction>;
export function markTransactionStale(
    transaction: unknown,
    reason?: string,
): ValidationResult<Transaction>;
export function markTransactionCommitted(
    transaction: unknown,
    committedAt?: number,
): ValidationResult<Transaction>;
export function markTransactionRolledBack(
    transaction: unknown,
    reason?: string,
    rollback?: Transaction['rollback'],
): ValidationResult<Transaction>;
export function prepareTransaction(
    transaction: unknown,
    options: {
        activeBranch: Branch;
        currentFingerprint: MessageFingerprint;
        beforeState: unknown;
        writePlan: PathMutation[];
        domainResults?: Array<ValidationResult<unknown>>;
    },
): TransactionResult;

export function pointerSegments(path: string): string[] | null;
export function pointerGet(
    state: unknown,
    path: string,
): { found: boolean; value?: unknown };
export function pathValuesEqual(
    left: { found: boolean; value?: unknown },
    right: { found: boolean; value?: unknown },
): boolean;
export function capturePathValues(state: unknown, paths: string[]): PathValue[];
export function pathValueMap(entries?: PathValue[]): Map<string, PathValue>;
export function validatePathMutations(mutations: unknown): {
    ok: boolean;
    issues: ValidationIssue[];
    paths: string[];
};
export function applyPathMutations(
    state: unknown,
    mutations: PathMutation[],
): {
    ok: boolean;
    issues: ValidationIssue[];
    value: unknown;
    touchedRefs?: string[];
};
export function buildCompareAndRestoreRollback(
    currentState: unknown,
    beforeEntries: PathValue[],
    afterEntries: PathValue[],
): {
    ok: boolean;
    value: unknown;
    revertedPaths: string[];
    preservedPaths: string[];
    failedPaths: string[];
};
export function pathEntriesMatch(
    state: unknown,
    expectedEntries: PathValue[],
): boolean;
export function evaluatePathPreconditions(
    state: unknown,
    preconditions?: TransactionPrecondition[],
): {
    ok: boolean;
    issues: ValidationIssue[];
};

export class SingleWriteQueue {
    readonly pending: number;
    readonly active: boolean;
    enqueue<T>(
        run: (metadata?: Record<string, unknown>) => Promise<T> | T,
        metadata?: Record<string, unknown>,
    ): Promise<T>;
    whenIdle(): Promise<void>;
}
export function createSingleWriteQueue(): SingleWriteQueue;

export class InMemoryIdempotencyStore implements IdempotencyStore {
    get(scope: string): Promise<Record<string, unknown> | null>;
    claim(scope: string, transactionId: string): Promise<Record<string, unknown>>;
    release(scope: string, transactionId: string): Promise<boolean>;
    settle(scope: string, transaction: Transaction): Promise<boolean>;
}
export function createInMemoryIdempotencyStore(): InMemoryIdempotencyStore;
export function validateTransactionHostBridge(host: unknown): {
    ok: boolean;
    missing: string[];
    message: string;
};

export class TransactionKernel {
    constructor(
        host: TransactionHostBridge,
        options?: {
            queue?: SingleWriteQueue;
            idempotencyStore?: IdempotencyStore;
            now?: () => number;
        },
    );
    readonly queue: SingleWriteQueue;
    prepare(
        transaction: Transaction,
        options: {
            writePlan: PathMutation[];
            domainResults?: Array<ValidationResult<unknown>>;
        },
    ): Promise<TransactionResult>;
    commit(handleOrId: unknown): Promise<TransactionResult>;
    rollback(handleOrId: unknown, reason?: string): Promise<TransactionResult>;
    abort(handleOrId: unknown, reason?: string): Promise<TransactionResult | null>;
}

export function createTransactionKernel(
    host: TransactionHostBridge,
    options?: ConstructorParameters<typeof TransactionKernel>[1],
): TransactionKernel;
