import type {
    EvidenceRef,
    Fact,
    Knowledge,
    ValidationIssue,
    ValidationResult,
} from '../domain/index.mjs';
import type {
    Branch,
    MessageFingerprint,
} from '../transaction/index.mjs';

export type PlayerContributionKind =
    | 'movement'
    | 'action'
    | 'dialogue'
    | 'decision'
    | 'skill-use'
    | 'resource-consumption'
    | 'check'
    | 'tone'
    | 'attitude'
    | 'psychology'
    | 'state-change';

export type NegativeConstraintKind =
    | 'no_movement'
    | 'no_extra_action'
    | 'no_dialogue'
    | 'no_decision'
    | 'no_skill_use'
    | 'no_resource_consumption'
    | 'no_check'
    | 'no_tone'
    | 'no_attitude'
    | 'no_psychology'
    | 'no_state_change';

export interface TurnAuthorization {
    id: string;
    kind: PlayerContributionKind;
    actorId: string;
    exactText?: string;
    resourceRef?: Record<string, unknown>;
    skillId?: string;
    evidence: EvidenceRef[];
}

export interface TurnNegativeConstraint {
    id: string;
    kind: NegativeConstraintKind;
    actorId: string;
    evidence: EvidenceRef[];
}

export interface TurnClaim {
    id: string;
    proposition: string;
    selected: boolean;
    evidence: EvidenceRef[];
}

export interface TurnBoundary {
    id: string;
    schemaVersion: '2.0';
    revision: number;
    branchId: string;
    target: MessageFingerprint;
    authorizations: TurnAuthorization[];
    negativeConstraints: TurnNegativeConstraint[];
    claims: TurnClaim[];
    unselectedCandidateIds: string[];
    allowedNarrativeKinds: string[];
    protectedPlayerStateRefs: string[];
    darkChoices: Array<{
        id: string;
        selected: boolean;
        summary: string;
        evidence: EvidenceRef[];
    }>;
    extensions?: Record<string, unknown>;
}

export interface NarrativeContribution {
    id: string;
    actor: 'player' | 'npc' | 'environment' | 'world';
    actorId: string;
    kind: PlayerContributionKind | string;
    source: 'player-input' | 'model-proposal' | 'rule' | string;
    authorizationId?: string;
    candidateId?: string;
    darkChoiceId?: string;
    content?: string;
    stateRef?: string;
}

export type DirectorRiskKind =
    | 'player-movement'
    | 'player-extra-action'
    | 'player-dialogue'
    | 'player-tone'
    | 'player-attitude'
    | 'player-psychology'
    | 'player-skill-use'
    | 'player-resource-consumption'
    | 'player-check'
    | 'unselected-candidate'
    | 'fact-confirmation'
    | 'knowledge-verification'
    | 'insider-status';

export interface RiskRecall {
    stage: 'risk-recall';
    finalDecision: null;
    semanticReviewRequired: boolean;
    candidates: Array<{
        id: string;
        ruleId: string;
        riskKind: DirectorRiskKind;
        range?: { start: number; end: number };
        requiresSemanticReview: true;
    }>;
    sourceLength: number;
    truncated: boolean;
}

export interface TurnBoundaryDecision {
    ok: boolean;
    validationStatus: 'valid' | 'unresolved' | 'rejected';
    decision: 'accept' | 'reject' | 'unresolved' | 'stale';
    boundary: TurnBoundary;
    allowedContributions: NarrativeContribution[];
    blockedContributions: NarrativeContribution[];
    violations: Array<{
        code: string;
        contributionId: string;
        message: string;
        details?: unknown;
    }>;
    issues: ValidationIssue[];
    riskRecall?: RiskRecall;
    preservesSelectedDarkChoices?: boolean;
    explanation: string[];
}

export interface ClaimAssessment {
    impact: 'cosmetic' | 'local' | 'material' | 'structural';
    createsPersistentFact?: boolean;
    mechanicalAdvantage?: boolean;
    contradictsConfirmedFact?: boolean;
    contradictsSettledTransaction?: boolean;
    contradictsTerminalQuest?: boolean;
    rewritesBranchHistory?: boolean;
    semanticBasis: string[];
}

export type H2Resolution =
    | {
        type: 'check';
        checkId: string;
        difficulty?: unknown;
        extensions?: Record<string, unknown>;
    }
    | {
        type: 'cost';
        resource: { ownerId: string; resourceId: string };
        amount: number;
        reason: string;
        extensions?: Record<string, unknown>;
    };

export interface DirectorClaimInput {
    claim: {
        id: string;
        factId?: string;
        proposition: string;
        branchId: string;
        subjectIds?: string[];
        evidence: EvidenceRef[];
    };
    assessment: ClaimAssessment;
    context: {
        target: MessageFingerprint;
        currentFingerprint?: MessageFingerprint;
        activeBranch: Branch;
        h2Resolution?: H2Resolution;
        explicitRetcon?: boolean;
        checkpointRef?: string;
    };
}

export interface DirectorClaimResult {
    ok: boolean;
    status: 'valid' | 'unresolved' | 'rejected';
    adjudication: {
        level: 'H0' | 'H1' | 'H2' | 'H3';
        decision: 'accept' | 'accept_with_cost' | 'roll_required' | 'reject'
            | 'branch_required' | 'pending';
        claimIds: string[];
        reason: string;
        evidence: EvidenceRef[];
        commands: Array<{
            type: 'fact-candidate' | 'fact-confirm' | 'check' | 'cost' | 'new-branch';
            payload: Record<string, unknown>;
        }>;
    };
    fact: Fact | null;
    issues: ValidationIssue[];
    explanation?: {
        levelBasis: string[];
        stateEffect: string;
    };
}

export interface LedgerTransition<T> {
    ok: boolean;
    status: 'valid' | 'unresolved' | 'rejected';
    decision: 'apply' | 'hold' | 'branch-required';
    before: T | null;
    value: T;
    changed: boolean;
    issues: ValidationIssue[];
    explanation: string;
}

export const PLAYER_CONTRIBUTION_KINDS: readonly PlayerContributionKind[];
export const NEGATIVE_CONSTRAINT_KINDS: readonly NegativeConstraintKind[];
export const DIRECTOR_RISK_KINDS: readonly DirectorRiskKind[];
export const MAIN_MODEL_CONTEXT_VERSION: '2.0-phase3';

export function recallDirectorRisks(
    text: string,
    options?: {
        rules?: Array<{
            id: string;
            riskKind: DirectorRiskKind;
            pattern: RegExp;
        }>;
        maxCandidates?: number;
    },
): RiskRecall;
export function normalizeRiskRecall(input: unknown): RiskRecall;

export function normalizeTurnBoundary(input: unknown): TurnBoundary;
export function validateTurnBoundary(
    input: unknown,
): ValidationResult<TurnBoundary>;
export function createTurnBoundary(
    input: Partial<TurnBoundary> & Pick<TurnBoundary, 'branchId' | 'target'>,
): ValidationResult<TurnBoundary>;
export function adjudicateTurnBoundary(
    boundary: unknown,
    assessment: {
        contributions: NarrativeContribution[];
        riskRecall?: RiskRecall;
        reframesSelectedDarkChoice?: boolean;
    },
    context?: {
        currentFingerprint?: MessageFingerprint;
        activeBranch?: Branch;
    },
): TurnBoundaryDecision;

export function classifyClaimImpact(assessment: unknown): {
    ok: boolean;
    status: 'valid' | 'unresolved' | 'rejected';
    level: 'H0' | 'H1' | 'H2' | 'H3';
    assessment: ClaimAssessment;
    issues: ValidationIssue[];
};
export function adjudicateClaim(input: DirectorClaimInput): DirectorClaimResult;
export function validateDirectorClaimInput(
    input: unknown,
): ValidationResult<DirectorClaimInput['claim']>;

export function createFactCandidate(
    input: Partial<Fact> & Pick<Fact, 'id' | 'proposition' | 'branchId'>,
    options?: {
        source?: 'user-claim' | 'model-proposal' | 'npc-suspicion'
            | 'forum-rumor' | 'random-code' | 'rule' | 'state-observation';
        activeBranch?: Branch;
    },
): LedgerTransition<Fact>;
export function transitionFact(
    fact: Fact,
    command:
        | {
            type: 'confirm';
            basis: 'adjudicated-h1' | 'resolved-h2' | 'verified-state'
                | 'explicit-user-confirmation';
            evidence: EvidenceRef[];
            resolutionSucceeded?: boolean;
        }
        | { type: 'dispute' | 'retract'; evidence: EvidenceRef[] }
        | { type: 'rewrite' },
    context?: { activeBranch?: Branch },
): LedgerTransition<Fact>;
export function createKnowledgeState(
    input: Partial<Knowledge> & Pick<
        Knowledge,
        'id' | 'knowerId' | 'factId' | 'branchId'
    >,
    options?: {
        source?: 'suspicion' | 'direct-observation' | 'told-by-source'
            | 'public-disclosure' | 'verification';
        activeBranch?: Branch;
    },
): LedgerTransition<Knowledge>;
export function transitionKnowledge(
    knowledge: Knowledge,
    command: {
        type: 'suspect' | 'acquire' | 'verify' | 'forget';
        mode?: 'suspicion' | 'direct-observation' | 'told-by-source'
            | 'public-disclosure' | 'verification';
        evidence?: EvidenceRef[];
    },
    context?: { fact?: Fact; activeBranch?: Branch },
): LedgerTransition<Knowledge>;
export function adjudicateUnverifiedCode(input: {
    fact: Partial<Fact> & Pick<Fact, 'id' | 'proposition' | 'branchId'>;
    npcKnowledge?: Partial<Knowledge> & Pick<
        Knowledge,
        'id' | 'knowerId' | 'factId' | 'branchId'
    >;
    activeBranch?: Branch;
}): {
    ok: boolean;
    decision: 'reject-confirmation';
    fact: Fact;
    knowledge: Knowledge | null;
    grants: [];
    issues: ValidationIssue[];
    explanation: string[];
};

export interface MainModelContext {
    contractVersion: '2.0-phase3';
    branchId: string;
    target: MessageFingerprint;
    playerBoundary: Record<string, unknown>;
    narrativeSpace: Record<string, unknown>;
    facts: {
        confirmed: Array<Record<string, unknown>>;
        disputed: Array<Record<string, unknown>>;
        candidates: Array<Record<string, unknown>>;
    };
    perspectiveKnowledge: Array<Record<string, unknown>>;
    director: Record<string, unknown>;
    hardRules: string[];
}

export function buildMainModelContext(
    boundary: TurnBoundary,
    input?: {
        currentFingerprint?: MessageFingerprint;
        facts?: Fact[];
        knowledge?: Knowledge[];
        perspectiveIds?: string[];
        claimDecisions?: DirectorClaimResult[];
        boundaryDecision?: TurnBoundaryDecision;
        riskRecall?: RiskRecall;
    },
): ValidationResult<MainModelContext> & {
    commands: Array<{ type: string; payload: Record<string, unknown> }>;
};
export function validateMainModelContext(
    input: unknown,
): ValidationResult<MainModelContext>;
