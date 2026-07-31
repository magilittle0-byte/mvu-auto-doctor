export interface WorldPressureExternalState {
    turn: number;
    sameSceneBossCount: number;
    threatMentions: number;
    pressureEstimate: number;
    overCap: boolean;
    evidenceHash: string;
}

export interface WorldPressureState {
    version: number;
    turn: number;
    phase: 'opening' | 'exploration' | 'escalation' | 'climax' | 'recovery';
    doctorPressure: number;
    sameSceneBossCount: number;
    recoveryDebt: number;
    lastReliefTurn: number;
    external: WorldPressureExternalState;
    receipts: Array<Record<string, unknown>>;
}

export interface DoctorWorldCandidate {
    id: string;
    channel: 'actor' | 'faction' | 'environment';
    actionKind: 'threat' | 'recovery' | 'information' | 'relationship' | 'choice' | 'remote';
    pressureCost: number;
    threatLevel?: 'ordinary' | 'elite' | 'boss';
    sameScene?: boolean;
    [key: string]: unknown;
}

export const WORLD_PRESSURE_VERSION: number;
export const WORLD_PRESSURE_MAX_RECEIPTS: number;
export function emptyWorldPressureState(): WorldPressureState;
export function normalizeWorldPressureState(value: unknown): WorldPressureState;
export function observeAcceptedContentPressure(
    value: unknown,
    options?: {
        turn?: number;
        content?: string;
        sameSceneBossCap?: number;
        pressureCap?: number;
        knownThreatPressure?: number;
    },
): WorldPressureState;
export function admitDoctorWorldCandidates(
    value: unknown,
    candidates: DoctorWorldCandidate[],
    options?: {
        turn?: number;
        phase?: WorldPressureState['phase'];
        pressureCap?: number;
        sameSceneBossCap?: number;
        recoveryCadence?: 'gentle' | 'balanced' | 'fast';
        injectionLimit?: number;
    },
): {
    state: WorldPressureState;
    admitted: DoctorWorldCandidate[];
    delayed: DoctorWorldCandidate[];
    retained: DoctorWorldCandidate[];
    receipts: Array<Record<string, unknown>>;
};
