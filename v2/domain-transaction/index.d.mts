import type {
    Branch,
    MessageFingerprint,
    PathMutation,
    Transaction,
    TransactionKernel,
    TransactionResult,
} from '../transaction/index.mjs';
import type {
    EvidenceRef,
    ValidationIssue,
    ValidationResult,
} from '../domain/index.mjs';

export const DOMAIN_COMMAND_VERSION: '2.0-phase4';
export const DOMAIN_COMMAND_TYPES: readonly DomainCommandType[];
export const LEGACY_DOMAIN_KINDS: readonly LegacyDomainKind[];

export type DomainCommandType =
    | 'item-use'
    | 'equipment-equip'
    | 'equipment-unequip'
    | 'equipment-transfer'
    | 'skill-use'
    | 'social-transition'
    | 'quest-transition'
    | 'quest-supersede'
    | 'fact-candidate'
    | 'fact-confirm'
    | 'cost'
    | 'check'
    | 'new-branch';

export interface DomainCommand {
    type: DomainCommandType;
    payload: Record<string, unknown>;
}

export interface SlotRef {
    system: string;
    slot: string;
    layer?: string;
}

export interface ResourceRef {
    ownerId: string;
    resourceId: string;
}

export interface CampaignDomainConfig {
    id: string;
    version: string;
    branchId: string;
    slotTaxonomy: SlotRef[];
    slotBindings: Array<{ slot: SlotRef; path: string }>;
    resources: Array<{
        resource: ResourceRef;
        path: string;
        minimum?: number;
        maximum?: number;
    }>;
    checks: Array<{
        checkId: string;
        difficultySchema?: unknown;
    }>;
    records: Record<string, Record<string, string>>;
    effectBindings: Record<string, string>;
    extensions?: Record<string, unknown>;
}

export interface ValidatedDirectorDomainCommand {
    command: DomainCommand;
    target: MessageFingerprint;
    activeBranch: Branch;
    evidence: EvidenceRef[];
    sourceResult: Record<string, unknown>;
    validationKind: 'director-domain-command';
}

export interface DomainTransactionPlan {
    command: DomainCommand;
    transaction: Transaction | null;
    writePlan: PathMutation[];
    domainResults: Array<ValidationResult<unknown>>;
    diagnostics: Array<{
        label: string;
        status: string;
        issues: ValidationIssue[];
    }>;
    decision: 'propose' | 'reject' | 'revert' | 'hold'
        | 'no-op' | 'branch-required';
    reason?: string;
    idempotencyKey?: string;
}

export interface DomainPlanningState {
    records?: Record<string, {
        path: string;
        found?: boolean;
        before?: unknown;
        candidate?: unknown;
        after?: unknown;
    }>;
    resources?: Array<{
        resource: ResourceRef;
        path: string;
        before: number;
    }>;
    slots?: Array<{
        slot: SlotRef;
        path: string;
        before: string | null;
    }>;
    effectValues?: Array<{
        key: string;
        path: string;
        found?: boolean;
        before: unknown;
        after: unknown;
    }>;
    resolutionEvidence?: EvidenceRef[];
    checkResult?: {
        checkId: string;
        outcome: 'success' | 'failure';
        evidence: EvidenceRef[];
    };
}

export function resourceKey(resource: ResourceRef): string;
export function slotKey(slot: SlotRef): string;
export function normalizeCampaignDomainConfig(
    input: unknown,
): CampaignDomainConfig;
export function validateCampaignDomainConfig(
    input: unknown,
    options?: { branchId?: string },
): ValidationResult<CampaignDomainConfig>;
export function validateDirectorDomainCommand(input: {
    command: DomainCommand;
    target: MessageFingerprint;
    currentFingerprint?: MessageFingerprint;
    activeBranch: Branch;
    sourceResult: Record<string, unknown>;
    evidence: EvidenceRef[];
}): ValidationResult<ValidatedDirectorDomainCommand>;
export function planDirectorDomainTransaction(input: {
    validatedCommand: ValidationResult<ValidatedDirectorDomainCommand>;
    campaign: CampaignDomainConfig;
    state: DomainPlanningState;
    createdAt?: number;
}): ValidationResult<DomainTransactionPlan>;

export function preparePlannedDomainTransaction(
    kernel: TransactionKernel,
    plan: ValidationResult<DomainTransactionPlan>,
): Promise<TransactionResult>;
export function executePlannedDomainTransaction(
    kernel: TransactionKernel,
    plan: ValidationResult<DomainTransactionPlan>,
): Promise<TransactionResult>;

export type LegacyDomainKind =
    | 'item'
    | 'equipment'
    | 'skill'
    | 'fact'
    | 'knowledge'
    | 'social'
    | 'quest';

export interface LegacyDomainDiagnostic {
    id: string;
    kind: LegacyDomainKind;
    status: 'pending' | 'mapped' | 'unresolved' | 'quarantined';
    visibility: 'lazy-not-read' | 'mapped-read-only'
        | 'unresolved-read-only' | 'quarantined-read-only';
    canTransact: boolean;
    sourceRefs: string[];
    issues: ValidationIssue[];
    warnings: string[];
}

export interface LegacyDomainEntry {
    id: string;
    kind: LegacyDomainKind;
    source: unknown;
    options?: Record<string, unknown>;
}

export function inspectLegacyDomainRecord(
    entry: LegacyDomainEntry,
): ValidationResult<unknown> & {
    diagnostic: LegacyDomainDiagnostic;
    migration?: Record<string, unknown>;
    legacyProjection?: Record<string, unknown>;
};
export function diagnoseLegacyDomainProjection(input: {
    entries: LegacyDomainEntry[];
    maxEntries?: number;
}): ValidationResult<unknown[]> & {
    diagnostics: LegacyDomainDiagnostic[];
    summary: {
        total: number;
        mapped: number;
        unresolved: number;
        quarantined: number;
    };
};
export function createLazyLegacyDomainProjection(input: {
    entries: LegacyDomainEntry[];
    maxEntries?: number;
}): {
    readonly size: number;
    has(id: string): boolean;
    get(id: string): ReturnType<typeof inspectLegacyDomainRecord> | null;
    diagnostics(): LegacyDomainDiagnostic[];
    diagnoseAll(): ReturnType<typeof diagnoseLegacyDomainProjection>;
};
