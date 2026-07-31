export type SerendipityFrequency = 'off' | 'sparse' | 'standard' | 'frequent' | 'extreme';
export type SerendipityAmplitude = 'small' | 'useful' | 'rare' | 'extreme';
export type SerendipityDirection = 'favorable' | 'adverse' | 'neutral' | 'absurd';
export type SerendipitySourceState = 'unknown' | 'possible' | 'revealed' | 'irrelevant';

export interface SerendipitySettings {
    frequency: SerendipityFrequency;
    maxAmplitude: SerendipityAmplitude;
    bias: 'harsh' | 'balanced' | 'balanced-lucky' | 'lucky';
    explanationSpeed: 'never' | 'slow' | 'natural' | 'fast';
}

export interface SerendipityTarget {
    chatId: string;
    messageId: string;
    swipeId: number;
    generation: number;
    generationId: string;
    branchId: string;
    contentFingerprint: string;
}

export interface SerendipityLicense {
    version: 1;
    licenseId: string;
    opportunityKey: string;
    objectKey: string;
    worldStateDigest: string;
    triggered: boolean;
    decision: string;
    direction: SerendipityDirection;
    magnitude: SerendipityAmplitude;
    channel: 'actor' | 'faction' | 'environment';
    landing: string;
    sourceState: SerendipitySourceState;
    explanationSpeed: SerendipitySettings['explanationSpeed'];
    pressureCost: number;
    responseWindowRequired: boolean;
    actualBenefitRequired: boolean;
    antiBalancePunishment: false;
    constraints: string[];
    target: SerendipityTarget;
    drawHash: string;
    createdAt: number;
    settledAt: number;
}

export interface SerendipityLedger {
    version: 1;
    chatId: string;
    receipts: SerendipityLicense[];
}

export const SERENDIPITY_VERSION: 1;
export const SERENDIPITY_MAX_RECEIPTS: 240;
export const DEFAULT_SERENDIPITY_SETTINGS: Readonly<SerendipitySettings>;
export function normalizeSerendipitySettings(value: unknown): SerendipitySettings;
export function emptySerendipityLedger(chatId?: string): SerendipityLedger;
export function normalizeSerendipityLedger(value: unknown, options?: { chatId?: string }): SerendipityLedger;
export function serendipityOpportunityKey(input?: Record<string, unknown>): string;
export function drawSerendipityLicense(input?: Record<string, unknown>): Record<string, unknown> & {
    ledger: SerendipityLedger;
    license: SerendipityLicense;
};
export function bindAndSettleSerendipityLicense(
    ledger: unknown,
    draft: unknown,
    target: unknown,
    options?: { now?: number },
): Record<string, unknown> & { ledger: SerendipityLedger; license: SerendipityLicense | null };
export function serendipityLicensePrompt(value: unknown): string;
