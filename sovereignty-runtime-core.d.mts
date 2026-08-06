export type SovereigntyTaskStatus =
    | 'pending'
    | 'running'
    | 'retryable_failed'
    | 'deferred'
    | 'committed'
    | 'cancelled_stale';

export type SovereigntyHealthColor = 'green' | 'yellow' | 'orange' | 'red' | 'blue';

export const SOVEREIGNTY_RUNTIME_VERSION: number;
export const SOVEREIGNTY_CHECKPOINT_VERSION: number;
export const SOVEREIGNTY_TASK_STATUSES: readonly SovereigntyTaskStatus[];
export const SOVEREIGNTY_MODULES: readonly string[];
export function emptySovereigntyRuntime(chatId?: string, options?: object): object;
export function normalizeSovereigntyRuntime(value: unknown, options?: object): object;
export function normalizeSovereigntySourceRef(value: unknown): object | null;
export function sovereigntySourceKey(value: unknown): string;
export function observeSovereigntyTurn(value: unknown, options?: object): object;
export function recoverOrphanedSovereigntyTasks(value: unknown, options?: object): object;
export function claimNextSovereigntyTask(value: unknown, options?: object): object;
export function failSovereigntyTask(value: unknown, options?: object): object;
export function commitSovereigntyTask(value: unknown, options?: object): object;
export function cancelSovereigntyTaskAsStale(value: unknown, options?: object): object;
export function retrySovereigntyTaskNow(value: unknown, options?: object): object;
export function restoreSovereigntyCheckpoint(value: unknown, options?: object): object;
export function sovereigntyHealthView(value: unknown): object;
export function extractFirstBalancedJsonObject(output: unknown): object;
export function parseJsonObjectWithSingleRepair(output: unknown, options?: object): Promise<object>;
export function conservativeSovereigntyFallback(options?: object): object;
