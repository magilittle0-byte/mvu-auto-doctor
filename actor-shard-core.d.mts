export interface ActorShardCandidate {
    id: string;
    name: string;
    score: number;
    locations: string[];
    knowledgeBasis: string[];
    goals: string[];
    sourceThreads: string[];
    evidence: string[];
    causalChain: string[];
}

export interface ActorShardProposal {
    actorId: string;
    actorName: string;
    time: string;
    location: string;
    travelTurns: number;
    knowledgeBasis: string[];
    currentGoal: string;
    candidateAction: string;
    interactionTargets: Array<{ actorId: string; actorName: string }>;
    resourceCosts: Array<{ resourceId: string; amount: number }>;
    capabilityUsed: string;
    waitCondition: string;
    sourceThreads: string[];
    evidence: string[];
    causalChain: string[];
}

export interface ActorShardConvergence {
    jointEvents: Array<{
        id: string;
        actorIds: string[];
        time: string;
        location: string;
        sharedCausalChain: string[];
        proposals: ActorShardProposal[];
    }>;
    independent: Array<{
        proposal: ActorShardProposal;
        reasons: string[];
    }>;
}

export const ACTOR_SHARD_MAX_WORKERS: 5;
export const ACTOR_SHARD_PROMPT_MAX_CHARS: 6000;

export function normalizeUserPromptSlot(value: unknown, maxChars?: number): string;
export function userPromptSlotMetadata(value: unknown): {
    enabled: boolean;
    length: number;
    hash: string;
};
export function formatUserNarrativeInstruction(label: unknown, value: unknown): string;
export function selectActorShardCandidates(input?: {
    continuity?: { threads?: Array<Record<string, unknown>> };
    presentText?: string;
    maxWorkers?: number;
}): ActorShardCandidate[];
export function buildActorShardMessages(
    candidate: ActorShardCandidate,
    options?: {
        target?: Record<string, unknown>;
        customPrompt?: string;
    },
): Array<{ role: 'system' | 'user'; content: string }>;
export function parseActorShardProposal(
    output: unknown,
    options: { candidate: ActorShardCandidate },
): { proposal?: ActorShardProposal; error?: string };
export function actorShardCompatibility(
    left: ActorShardProposal,
    right: ActorShardProposal,
): { compatible: boolean; reasons: string[]; sharedCausalChain: string[] };
export function convergeActorShardProposals(
    proposals: ActorShardProposal[],
): ActorShardConvergence;
export function runActorShardBatch(options: {
    candidates?: ActorShardCandidate[];
    maxConcurrency?: number;
    timeoutMs?: number;
    callWorker: (
        candidate: ActorShardCandidate,
        context: { signal: AbortSignal },
    ) => Promise<unknown>;
    isCurrent?: () => boolean;
    onProgress?: (progress: {
        total: number;
        completed: number;
        succeeded: number;
        failed: number;
    }) => void;
    signal?: AbortSignal | null;
}): Promise<{
    status: 'completed' | 'stale';
    proposals: ActorShardProposal[];
    convergence: ActorShardConvergence;
    failures?: Array<{ actorId: string; code: string }>;
    diagnostics: {
        selected: number;
        completed: number;
        succeeded: number;
        failed: number;
    };
}>;
