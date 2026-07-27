import type {
    EvidenceRef,
    ValidationIssue,
    ValidationResult,
} from '../domain/index.mjs';
import type {
    TurnBoundary,
    TurnBoundaryDecision,
} from '../director/index.mjs';
import type {
    Branch,
    MessageFingerprint,
    TransactionResult,
} from '../transaction/index.mjs';
import type {
    CampaignDomainConfig,
    DomainPlanningState,
    DomainTransactionPlan,
    ValidatedDirectorDomainCommand,
} from '../domain-transaction/index.mjs';

export const DUAL_SURFACE_VERSION: '2.0-phase5';
export const DUAL_SURFACE_SOURCES: readonly ['natural-language', 'ui'];
export const DUAL_SURFACE_VISIBILITY: readonly ['immersive', 'audit', 'debug'];

export interface SurfaceActionCatalogEntry {
    id: string;
    label: string;
    description?: string;
    utterances: string[];
    authorizationId: string;
    actorId?: string;
    command: {
        type: string;
        payload: Record<string, unknown>;
    };
    extensions?: Record<string, unknown>;
}

export interface SurfaceCommandCandidate {
    version: '2.0-phase5';
    actionId: string;
    label: string;
    command: {
        type: string;
        payload: Record<string, unknown>;
    };
    authorizationKind: string;
    actorId: string;
    commandDigest: string;
    confirmation: {
        required: boolean;
        digest: string;
        confirmed: boolean;
    };
    source: {
        kind: 'natural-language' | 'ui';
        resolution: string;
        inputDigest: string;
        inputLength: number;
    };
}

export interface DualSurfaceSession {
    catalog: SurfaceActionCatalogEntry[];
    target: MessageFingerprint;
    currentFingerprint?: MessageFingerprint;
    activeBranch: Branch;
    turnBoundary: TurnBoundary;
    evidence: EvidenceRef[];
    campaign: CampaignDomainConfig;
    state: DomainPlanningState;
    createdAt?: number;
    migrations?: Array<Record<string, unknown>>;
    rollback?: {
        available?: boolean;
        status?: string;
        pathCount?: number;
        recordId?: string;
    };
}

export interface DualSurfaceResolution {
    version: '2.0-phase5';
    decision: string;
    candidate: SurfaceCommandCandidate;
    director: TurnBoundaryDecision | null;
    validatedCommand: ValidationResult<ValidatedDirectorDomainCommand> | null;
    plan: ValidationResult<DomainTransactionPlan> | null;
}

export function normalizeNaturalLanguageText(value: unknown): string;
export function normalizeSurfaceActionCatalog(
    value: unknown,
): SurfaceActionCatalogEntry[];
export function validateSurfaceActionCatalog(
    value: unknown,
): ValidationResult<SurfaceActionCatalogEntry[]>;
export function adaptNaturalLanguageIntent(input: {
    intent: {
        text: string;
        actionId?: string;
        semanticBasis?: string[];
    };
    catalog: SurfaceActionCatalogEntry[];
    target: MessageFingerprint;
}): ValidationResult<SurfaceCommandCandidate>;
export function adaptUiAction(input: {
    action: { actionId: string };
    catalog: SurfaceActionCatalogEntry[];
    target: MessageFingerprint;
}): ValidationResult<SurfaceCommandCandidate>;
export function planDualSurfaceDomainAction(
    input: DualSurfaceSession & {
        source:
            | {
                kind: 'natural-language';
                text: string;
                actionId?: string;
                semanticBasis?: string[];
            }
            | { kind: 'ui'; actionId: string };
        confirmation?: { confirmed: true; digest: string };
    },
): ValidationResult<DualSurfaceResolution>;
export function compareDualSurfaceParity(
    naturalResult: ValidationResult<DualSurfaceResolution>,
    uiResult: ValidationResult<DualSurfaceResolution>,
): ValidationResult<{
    equivalent: boolean;
    canonicalDigest: string;
    natural: Record<string, unknown>;
    ui: Record<string, unknown>;
}>;

export interface DualSurfaceViewModel {
    mode: 'immersive' | 'audit' | 'debug';
    status: string;
    decision: string;
    action: Record<string, unknown>;
    confirmation: Record<string, unknown>;
    adjudication: Record<string, unknown>;
    transaction: Record<string, unknown>;
    branch: Record<string, unknown>;
    evidence: Record<string, unknown>;
    migrations: Array<Record<string, unknown>>;
    rollback: Record<string, unknown>;
    issues: ValidationIssue[];
}

export function createDualSurfaceViewModel(
    resolution: ValidationResult<DualSurfaceResolution>,
    options?: {
        visibility?: 'immersive' | 'audit' | 'debug';
        migrations?: Array<Record<string, unknown>>;
        rollback?: Record<string, unknown>;
    },
): DualSurfaceViewModel;
export function diagnosticContainsSensitiveMaterial(value: unknown): boolean;
export function coarseUserAgent(value: unknown): {
    platform: string;
    kernel: string;
    kernelMajor: number;
};
export function createPrivacySafeDiagnosticProjection(
    input?: Record<string, unknown>,
): Record<string, unknown>;
export function diagnosticPrivacyCanaryFindings(
    value: unknown,
    canaries?: string[],
): {
    credentialFindings: number;
    absoluteUserPathFindings: number;
    rawPayloadFindings: number;
    privateContentFindings: number;
};
export function setControlledDisclosure(
    button: HTMLButtonElement,
    content: HTMLElement,
    expanded: boolean,
): boolean;
export function installDualSurfaceUI(input: {
    host: {
        captureSession(): Promise<DualSurfaceSession | null> | DualSurfaceSession | null;
        executePlan?(
            plan: ValidationResult<DomainTransactionPlan>,
        ): Promise<TransactionResult> | TransactionResult;
        undo?(): Promise<unknown> | unknown;
    };
    mount?: HTMLElement;
    defaultVisibility?: 'immersive' | 'audit' | 'debug';
}): Readonly<{
    open(trigger?: HTMLElement): Promise<DualSurfaceViewModel>;
    close(): void;
    previewNaturalLanguage(
        text: string,
        options?: { actionId?: string; semanticBasis?: string[] },
    ): Promise<ValidationResult<DualSurfaceResolution>>;
    previewUiAction(
        actionId: string,
    ): Promise<ValidationResult<DualSurfaceResolution>>;
    confirm(): Promise<ValidationResult<DualSurfaceResolution>>;
    execute(): Promise<unknown>;
    undo(): Promise<unknown>;
    refresh(): Promise<DualSurfaceSession | null>;
    getResult(): ValidationResult<DualSurfaceResolution>;
    getView(): DualSurfaceViewModel;
    getPanel(): HTMLElement;
    destroy(): void;
}>;
