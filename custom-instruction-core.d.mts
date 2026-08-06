export const GLOBAL_INSTRUCTION_SCOPES: readonly string[];
export function normalizeGlobalInstructionConfig(value: unknown, options?: object): object;
export function globalInstructionApplies(value: unknown, options?: object): boolean;
export function composeScopedModelInstruction(value: unknown, options?: object): object;
export function globalInstructionMetadata(value: unknown, options?: object): object;
export function customInstructionDiagnosticProjection(value: unknown, records?: object[]): object;
