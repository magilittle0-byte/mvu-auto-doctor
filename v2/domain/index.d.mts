export type EntityId = string;
export type BranchId = string;
export type ValidationStatus = 'valid' | 'unresolved' | 'rejected';

export interface ValidationIssue {
    code: string;
    path: string;
    severity: 'warning' | 'unresolved' | 'error';
    message: string;
    details?: unknown;
}

export interface ValidationResult<T> {
    ok: boolean;
    status: ValidationStatus;
    value: T;
    issues: ValidationIssue[];
}

export interface MigrationState {
    sourceVersion: '1.x' | 'legacy';
    status: 'native' | 'mapped' | 'unresolved' | 'quarantined';
    sourceRefs: string[];
    warnings: string[];
}

export interface EvidenceRef {
    kind: 'message' | 'rule' | 'schema' | 'state' | 'roll' | 'user-confirmation';
    ref: string;
    branchId: BranchId;
    fingerprint?: Record<string, unknown>;
    excerptHash?: string;
    note?: string;
}

export interface NarrativeExtension {
    summary?: string;
    tags?: string[];
    lore?: Record<string, unknown>;
    presentation?: Record<string, unknown>;
}

export interface V2Record {
    id: EntityId;
    schemaVersion: '2.0';
    revision: number;
    extensions?: Record<string, unknown> & {
        legacy?: Record<string, unknown>;
    };
    narrative?: NarrativeExtension;
}

export interface ResourceRef {
    ownerId: EntityId;
    resourceId: string;
}

export type EffectV2 =
    | {
        type: 'resource-delta';
        delta: {
            resource: ResourceRef;
            amount: number;
            reason: string;
        };
    }
    | {
        type: 'status';
        statusId: string;
        operation: 'add' | 'remove';
        magnitude?: number;
        duration?: number;
    }
    | {
        type: 'fact';
        factId: EntityId;
        operation: 'propose' | 'confirm' | 'retract';
    }
    | {
        type: 'custom';
        adapterId: string;
        payload: Record<string, unknown>;
    };

export interface ItemV2 extends V2Record {
    name: string;
    kind: 'material' | 'consumable' | 'quest' | 'equipment' | 'container' | 'misc';
    quantity: number;
    stackable: boolean;
    description: string;
    unit?: string;
    mechanics?: {
        use?: {
            consumes: number;
            effects: EffectV2[];
            [key: string]: unknown;
        };
        passiveEffects?: EffectV2[];
        [key: string]: unknown;
    };
    provenance: EvidenceRef[];
    migration?: MigrationState;
}

export interface SlotRef {
    system: string;
    slot: string;
    layer?: string;
}

export interface EquipmentV2 extends V2Record {
    itemId: EntityId;
    allowedSlots: SlotRef[];
    occupies: SlotRef[];
    equippedAt?: SlotRef[];
    handedness?: 'none' | 'one-hand' | 'two-hand' | 'either';
    bonuses: EffectV2[];
    requirements?: Record<string, unknown>;
    provenance: EvidenceRef[];
    migration?: MigrationState;
}

export interface SkillCost {
    resource: ResourceRef;
    amount: number;
    timing: 'on-start' | 'on-success' | 'per-tick' | 'on-complete';
    refundable: boolean;
}

export interface SkillV2 extends V2Record {
    name: string;
    mode: 'active' | 'passive' | 'reaction' | 'toggle';
    costs: SkillCost[];
    effects: EffectV2[];
    resolution?: {
        checkId?: string;
        target?: string;
        cooldown?: number;
        [key: string]: unknown;
    };
    displayCost?: string;
    provenance: EvidenceRef[];
    migration?: MigrationState;
}

export interface Fact extends V2Record {
    proposition: string;
    status: 'candidate' | 'confirmed' | 'disputed' | 'retracted';
    scope: 'turn' | 'branch' | 'chat' | 'world';
    branchId: BranchId;
    subjectIds: EntityId[];
    evidence: EvidenceRef[];
    contradictedBy?: EvidenceRef[];
    supersedes?: EntityId[];
    impact: 'cosmetic' | 'local' | 'material' | 'structural';
    migration?: MigrationState;
}

export interface Knowledge extends V2Record {
    knowerId: EntityId;
    factId: EntityId;
    state: 'unknown' | 'suspected' | 'known' | 'verified';
    acquiredBy: EvidenceRef[];
    branchId: BranchId;
    visibility: 'private' | 'group' | 'public';
    migration?: MigrationState;
}

export interface SocialDimensions {
    affection?: number;
    trust?: number;
    intimacy?: number;
    loyalty?: number;
    respect?: number;
    fear?: number;
}

export interface SocialState extends V2Record {
    fromActorId: EntityId;
    toActorId: EntityId;
    voluntary: SocialDimensions;
    coercive: {
        obedience?: number;
        control?: number;
        compulsion?: number;
        sourceIds: EntityId[];
    };
    labels: string[];
    evidence: EvidenceRef[];
    branchId: BranchId;
    migration?: MigrationState;
}

export interface QuestObjective {
    id: string;
    description: string;
    status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
    evidence: EvidenceRef[];
}

export interface Quest extends V2Record {
    title: string;
    status: 'proposed' | 'active' | 'suspended' | 'completed' | 'failed'
        | 'cancelled' | 'superseded';
    branchId: BranchId;
    objectives: QuestObjective[];
    settlementTransactionIds: string[];
    supersededBy?: EntityId;
    terminalEvidence?: EvidenceRef[];
    migration?: MigrationState;
}

export interface ClaimCommand {
    type: 'fact-candidate' | 'fact-confirm' | 'check' | 'cost' | 'new-branch';
    payload: Record<string, unknown>;
}

export interface ClaimAdjudication {
    level: 'H0' | 'H1' | 'H2' | 'H3';
    decision: 'accept' | 'accept_with_cost' | 'roll_required' | 'reject'
        | 'branch_required' | 'pending';
    claimIds: string[];
    reason: string;
    evidence: EvidenceRef[];
    commands: ClaimCommand[];
}

export interface MigrationResult<T> extends ValidationResult<T> {
    migration: MigrationState;
    legacyProjection?: Record<string, unknown>;
}

export interface LegacyMigrationLimits {
    maxDepth: number;
    maxObjects: number;
    maxKeys: number;
    maxStringLength: number;
}

export interface LegacyAdapterOptions {
    limits?: Partial<LegacyMigrationLimits>;
    sourceVersion?: '1.x' | 'legacy';
    sourceRefs?: string[];
    aliases?: Record<string, string | string[]>;
    extensions?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface LegacySkillCostOptions {
    resourceAliases?:
        | Map<string, ResourceRef | ResourceRef[]>
        | Record<string, ResourceRef | ResourceRef[]>;
    timing?: SkillCost['timing'];
    refundable?: boolean;
}

export function normalizeItemV2(input: unknown): ItemV2;
export function validateItemV2(
    input: unknown,
    options?: { mechanicalEffectClaimed?: boolean; discrete?: boolean },
): ValidationResult<ItemV2>;
export function normalizeEquipmentV2(input: unknown): EquipmentV2;
export function validateEquipmentV2(input: unknown): ValidationResult<EquipmentV2>;
export function normalizeSkillV2(input: unknown): SkillV2;
export function validateSkillV2(input: unknown): ValidationResult<SkillV2>;
export function normalizeFact(input: unknown): Fact;
export function validateFact(input: unknown): ValidationResult<Fact>;
export function normalizeKnowledge(input: unknown): Knowledge;
export function validateKnowledge(input: unknown): ValidationResult<Knowledge>;
export function normalizeSocialState(input: unknown): SocialState;
export function validateSocialState(input: unknown): ValidationResult<SocialState>;
export function normalizeQuest(input: unknown): Quest;
export function validateQuest(input: unknown): ValidationResult<Quest>;
export function validateClaimAdjudication(input: unknown): ValidationResult<ClaimAdjudication>;

export function adjudicateSocialTransition(
    before: unknown,
    candidate: unknown,
    evidence?: {
        voluntaryEvidence?: boolean | string[];
        coerciveEvidence?: boolean | string[];
    },
): ValidationResult<SocialState> & {
    decision: 'allow' | 'revert' | 'reject';
    revertedPaths: string[];
};

export function validateQuestTransition(
    before: unknown,
    candidate: unknown,
): ValidationResult<Quest>;

export function adaptLegacyItem(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<ItemV2>;
export function adaptLegacyEquipment(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<EquipmentV2>;
export function adaptLegacySkill(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<SkillV2>;
export function adaptLegacyFact(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<Fact>;
export function adaptLegacyKnowledge(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<Knowledge>;
export function adaptLegacySocialState(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<SocialState>;
export function adaptLegacyQuest(
    source: unknown,
    options?: LegacyAdapterOptions,
): MigrationResult<Quest>;

export function parseLegacySkillCost(
    displayCost: unknown,
    options?: LegacySkillCostOptions,
): { cost: SkillCost | null; issues: ValidationIssue[] };

export function restoreLegacyExtensions(
    record: V2Record,
    mappedProjection?: Record<string, unknown>,
): Record<string, unknown>;

export function projectItemToLegacy(record: ItemV2): Record<string, unknown>;
export function projectEquipmentToLegacy(record: EquipmentV2): Record<string, unknown>;
export function projectSkillToLegacy(record: SkillV2): Record<string, unknown>;
export function projectFactToLegacy(record: Fact): Record<string, unknown>;
export function projectKnowledgeToLegacy(record: Knowledge): Record<string, unknown>;
export function projectSocialStateToLegacy(record: SocialState): Record<string, unknown>;
export function projectQuestToLegacy(record: Quest): Record<string, unknown>;
