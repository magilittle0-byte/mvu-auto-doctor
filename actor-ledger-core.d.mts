export interface ActorLedgerSourceRef {
    chatId: string;
    messageId: string;
    index: number;
    swipeId: number;
    generation: number;
    branchId: string;
    hash: string;
}

export interface ActorKnowledge {
    id: string;
    claim: string;
    kind: 'observed' | 'reported' | 'inferred';
    confidence: number;
    learnedTurn: number;
    sourceRef: ActorLedgerSourceRef | null;
    propagation: string[];
}

export interface ActorLedgerActor {
    id: string;
    name: string;
    tier: 'key' | 'secondary' | 'background';
    status: 'active' | 'dormant' | 'departed' | 'deceased' | 'resolved';
    inactiveReason: '' | 'sleep' | 'absence' | 'quiet';
    identity: {
        role: string;
        aliases: string[];
        traits: string[];
        desires: string[];
        boundaries: string[];
        socialStyle: string;
        decisionStyle: string;
        speechStyle: string;
        copingStyle: string;
        informationStyle: string;
        typicalMisread: string;
        relationshipDistancePattern: string;
        selfImageGap: string;
        learnedCounterDisposition: string;
        pressureResponse: string;
        recoveryPath: string;
        everydayHabits: string[];
        blindSpots: string[];
    };
    lineage: {
        rootActorId: string;
        currentForm: string;
        forms: Array<{ name: string; turn: number; evidence: string[] }>;
    };
    longTermGoals: string[];
    currentGoals: string[];
    constraints: string[];
    stimuli: Array<{
        id: string;
        kind: 'observation' | 'opportunity' | 'risk';
        summary: string;
        sourceThreadId: string;
        status: 'new' | 'adopted' | 'ignored' | 'misread' | 'used' | 'opposed';
        createdTurn: number;
        evidence: string[];
    }>;
    stateFacts: Array<{
        id: string;
        kind: string;
        summary: string;
        turn: number;
        evidence: string[];
    }>;
    knowledge: ActorKnowledge[];
    location: { name: string; sinceTurn: number; evidence: string[] };
    resources: Array<{ id: string; name: string; amount: number; unit: string; evidence: string[] }>;
    capabilities: string[];
    relationships: Array<{ actorId: string; summary: string; evidence: string[] }>;
    commitments: Array<{
        id: string;
        summary: string;
        dueTurn: number;
        status: 'open' | 'fulfilled' | 'broken' | 'cancelled';
        targetActorId: string;
        evidence: string[];
    }>;
    hidden: {
        emotionalInertia: string[];
        innerConflicts: string[];
        privateIntentions: string[];
    };
    plan: {
        summary: string;
        steps: string[];
        status: 'active' | 'blocked' | 'completed' | 'abandoned';
        priority: 'low' | 'normal' | 'high' | 'critical';
        nextWindow: string;
        obstacles: string[];
        costs: string[];
        alternatives: string[];
    };
    lastAction: null | { id: string; turn: number; summary: string; outcome: string };
    actionHistory: Array<Record<string, unknown>>;
    profileV6: Record<string, unknown>;
    nextActionTurn: number;
    deadlineTurn: number;
    lastSemanticTurn: number;
    semanticProgressCount: number;
    lastAttemptTurn: number;
    consecutiveActionFailures: number;
    initiative: number;
    opportunity: number;
    silenceTurns: number;
    attentionScore: number;
    evidence: string[];
    version: number;
    createdTurn: number;
    updatedTurn: number;
    settledActionCount: number;
}

export interface ActorLedger {
    version: number;
    chatId: string;
    turn: number;
    actors: ActorLedgerActor[];
    actionReceipts: Array<Record<string, unknown>>;
    observationReceipts: Array<Record<string, unknown>>;
    migrations: {
        continuityV5: boolean;
        actorLedgerV2: boolean;
        actorLedgerV3: boolean;
        actorLedgerV4: boolean;
        actorLedgerV5: boolean;
        actorLedgerV6: boolean;
        actorProfileV6: boolean;
    };
    updatedAt: number;
}

export const ACTOR_LEDGER_VERSION: number;
export const ACTOR_LEDGER_MAX_ACTORS: number;
export const ACTOR_LEDGER_MAX_RECEIPTS: number;

export function emptyActorLedger(chatId?: string): ActorLedger;
export function normalizeActorLedger(
    value: unknown,
    options?: { chatId?: string; maxActors?: number; excludedActorNames?: string[] },
): ActorLedger;
export function migrateActorLedgerFromContinuity(
    value: unknown,
    continuity: unknown,
    options?: { excludedActorNames?: string[] },
): ActorLedger;
export function mergeActorProfilePatches(
    value: unknown,
    patches: unknown[],
    options?: {
        turn?: number | null;
        sourceRef?: ActorLedgerSourceRef | null;
        maxPatches?: number;
        evidenceCorpus?: string;
    },
): {
    ledger: ActorLedger;
    accepted: Array<{ actorId: string; name: string; evidence: string[] }>;
    rejected: Array<{ actorId: string; name?: string; reason: string }>;
};
export function mergeActorIdentityReveal(
    value: unknown,
    options: {
        actorId: string;
        revealedName: string;
        aliases?: string[];
        evidence?: string[];
        turn?: number | null;
    },
): ActorLedger;
export function reconcileActorIdentityRevealsFromAcceptedContent(
    value: unknown,
    options?: { content?: string; sourceRef?: ActorLedgerSourceRef | null },
): ActorLedger;
export function reconcileActorMutationLineageFromAcceptedContent(
    value: unknown,
    options?: { content?: string; sourceRef?: ActorLedgerSourceRef | null },
): ActorLedger;
export function reconcileActorLifecycleFromAcceptedContent(
    value: unknown,
    options?: { content?: string; sourceRef?: ActorLedgerSourceRef | null },
): ActorLedger;
export function applyAcceptedContentObservations(
    value: unknown,
    options?: {
        content?: string;
        sourceRef?: ActorLedgerSourceRef | null;
        observerActorIds?: string[];
    },
): ActorLedger;
export function inferObserverActorIds(value: unknown, content: string): string[];
export function scheduleActorTurns(
    value: unknown,
    options?: {
        turn?: number | null;
        maxActors?: number;
        explorationSlots?: number;
        excludedActorNames?: string[];
        requireProfileReady?: boolean;
    },
): {
    turn: number;
    selected: Array<{
        actorId: string;
        actorName: string;
        slot: 'priority' | 'exploration';
        score: number;
        reasons: string[];
    }>;
    deferredActorIds: string[];
};
export function actorActionCandidatesFromShard(
    value: unknown,
    proposals: unknown[],
    options?: { turn?: number | null; collisionIntensity?: number },
): unknown[];
export function settleActorActionCandidates(
    value: unknown,
    candidates: unknown[],
    options?: {
        turn?: number | null;
        attemptedActorIds?: string[];
        playerNames?: string[];
    },
): {
    ledger: ActorLedger;
    accepted: unknown[];
    rejected: Array<{ actorId: string; reasons: string[] }>;
    worldEvents: unknown[];
    receipts: unknown[];
    attempts: unknown[];
    results: unknown[];
};
export function mergeActorWorldEventsIntoContinuity(
    continuity: unknown,
    worldEvents: unknown[],
): unknown;
export function settleActorInjectionReceipts(
    value: unknown,
    options?: { content?: string; sourceRef?: ActorLedgerSourceRef | null },
): ActorLedger;
export function actorLedgerView(value: unknown): {
    version: number;
    turn: number;
    actorCount: number;
    activeCount: number;
    dormantCount: number;
    semanticProgressCount: number;
    maxSemanticSilence: number;
    stalledDueCount: number;
    consecutiveFailureCount: number;
    actors: Array<Omit<ActorLedgerActor, 'hidden'>>;
    receipts: unknown[];
    observationReceipts: unknown[];
    privateThoughtsExposed: false;
};
