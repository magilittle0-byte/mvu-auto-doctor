export const ACTOR_ACTION_ROUTES: readonly string[];
export function routeActorActionAttempt(candidate: unknown, options?: object): string;
export function createActorActionAttempt(candidate: unknown, options?: object): object;
export function adjudicateActorActionAttempt(attempt: unknown, options?: object): object;
export function actorActionNarrativeInjection(attempt: unknown, result: unknown): object;
export function discloseActorActionResult(result: unknown, options?: object): object;
export function worldEventFromSettledActionReceipt(receipt: unknown, options?: object): object | null;
export function independentWorldProcessEvent(value: unknown): object | null;
export function containsForgedPlayerSettlement(value: unknown): boolean;
