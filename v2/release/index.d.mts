export interface ReleaseIssue {
    code: string;
    severity: 'error';
    message: string;
    details?: Record<string, unknown>;
}

export interface LegacyUpgradeDrill {
    ok: boolean;
    status: 'ready' | 'fallback' | 'blocked';
    issues: ReleaseIssue[];
    legacyReadable: boolean;
    rollbackAvailable: boolean;
    legacySnapshot?: Record<string, unknown>;
    legacyHash?: string;
    sourceEntryCount?: number;
    serializedBytes?: number;
    v2Sidecar?: Record<string, unknown>;
}

export function prepareLegacyUpgradeDrill(input?: {
    chat?: Record<string, unknown>;
    entries?: Array<Record<string, unknown>>;
    limits?: {
        maxEntries?: number;
        maxChatBytes?: number;
    };
}): LegacyUpgradeDrill;

export function rollbackLegacyUpgrade(drill: LegacyUpgradeDrill): {
    ok: boolean;
    status: 'rolled-back' | 'blocked';
    issues: ReleaseIssue[];
    chat?: Record<string, unknown>;
    legacyHash?: string;
    legacyReadable?: boolean;
    v2AuthorityRemoved?: boolean;
};

export function evaluateReleaseHardening(
    evidence?: Record<string, Record<string, unknown>>,
    limits?: Record<string, number>,
): {
    ok: boolean;
    status: 'pass' | 'fail';
    issues: ReleaseIssue[];
    limits: Record<string, number>;
};

export function evaluateReleaseCandidate(evidence?: Record<string, unknown>): {
    ok: boolean;
    decision: 'accept' | 'reject';
    release: Record<string, unknown>;
};

export function runPhase7ReleaseReplay(
    fixture: Record<string, unknown>,
    evidence?: Record<string, string>,
): {
    id: string;
    decision: string;
    release?: Record<string, unknown>;
    pass: boolean;
};
