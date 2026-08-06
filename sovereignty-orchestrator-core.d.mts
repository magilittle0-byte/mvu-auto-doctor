export const SOVEREIGNTY_AGENT_TYPES: readonly string[];
export function createSovereigntyBlackboard(options?: object): object;
export function publishSovereigntyCandidate(value: unknown, candidate?: object): object;
export function recordSovereigntyAgentFailure(value: unknown, failure?: object): object;
export function runSovereigntyAgentPool(options?: object): Promise<object>;
export function adjudicateSovereigntyBlackboard(value: unknown, options?: object): object;
export function rankSovereigntyRouteSlots(value: unknown): object[];
export function allocateSovereigntyRouteSlot(value: unknown, options?: object): object | null;
