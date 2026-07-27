# MVU Auto Doctor 2.0 数据与事务协议

状态：`2.0-phase5`

协议版本：`2.0.0-draft.5`

本文中的“必须 / 不得”是规范要求，“应该”表示除非适配器提供可审计理由，否则必须遵守。

## 1. 协议目标

V2协议把“可自由叙述的内容”和“必须一致结算的内容”分开：

- 叙事扩展允许不同世界观、卡片和作者自由增加字段；
- 数量、资源、槽位、消耗、状态、证据、分支和事务身份使用稳定硬字段；
- 任一未知字段必须被保留；适配器不得因 V2 schema 未认识它就删除；
- 任一无法无歧义迁移的机械字段必须标为 `unresolved`，不能猜造。

协议不规定“无限回廊”或其他卡片的唯一变量路径。路径与命名由 `SchemaAdapter` 映射到通用引用。

## 2. 公共类型

以下 TypeScript 形态用于说明协议；生产实现可以使用 JavaScript、Zod 或 JSON Schema，但语义必须一致。

```ts
type EntityId = string;
type BranchId = string;
type TransactionId = string;

interface EvidenceRef {
  kind: 'message' | 'rule' | 'schema' | 'state' | 'roll' | 'user-confirmation';
  ref: string;
  branchId: BranchId;
  fingerprint?: MessageFingerprint;
  excerptHash?: string;
  note?: string;
}

interface NarrativeExtension {
  summary?: string;
  tags?: string[];
  lore?: Record<string, unknown>;
  presentation?: Record<string, unknown>;
}

interface V2Record {
  id: EntityId;
  schemaVersion: '2.0';
  revision: number;
  extensions?: Record<string, unknown>;
  narrative?: NarrativeExtension;
}

interface ResourceRef {
  ownerId: EntityId;
  resourceId: string;
}

interface ResourceDelta {
  resource: ResourceRef;
  amount: number;
  reason: string;
}

interface ValidationIssue {
  code: string;
  path: string;
  severity: 'warning' | 'unresolved' | 'error';
  message: string;
  details?: unknown;
}

interface DomainValidationResult<T> {
  ok: boolean;
  status: 'valid' | 'unresolved' | 'rejected';
  value: T;
  issues: ValidationIssue[];
}
```

公共不变量：

1. `id` 在其分支和领域内稳定；显示名称不是 ID。
2. `revision` 只在提交成功后递增。
3. `extensions` 接受未知字段，但不得覆盖同级硬字段。
4. `EvidenceRef` 优先保存引用和摘要哈希，不复制完整私人正文。
5. 机械变化使用有限数字；`NaN`、Infinity、数字字符串和“很多”不是合法数值。
6. `warning` 不阻断只读投影；`unresolved` 阻断自动结算但保留可诊断值；`error` 产生 `rejected`，不得进入事务准备。
7. 归一化与验证器必须是无宿主依赖的纯函数，不得修改输入对象。

## 3. ItemV2

```ts
interface ItemV2 extends V2Record {
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
    };
    passiveEffects?: EffectV2[];
  };
  provenance: EvidenceRef[];
  migration?: MigrationState;
}

type EffectV2 =
  | { type: 'resource-delta'; delta: ResourceDelta }
  | { type: 'status'; statusId: string; operation: 'add' | 'remove'; magnitude?: number; duration?: number }
  | { type: 'fact'; factId: string; operation: 'propose' | 'confirm' | 'retract' }
  | { type: 'custom'; adapterId: string; payload: Record<string, unknown> };
```

不变量：

- `quantity` 必须是非负有限数；离散物默认是整数。
- `kind=consumable` 且叙事声称恢复、伤害、增益或消耗资源时，`mechanics.use.effects` 必须存在。
- 缺失数值时保持 `unresolved` 并禁止自动结算；医生不得从“强效”“大量”等形容词猜数字。
- 同一次使用由一个 `Transaction` 同时减少数量并应用效果，不能先扣物品后补效果。

## 4. EquipmentV2

```ts
interface SlotRef {
  system: string;
  slot: string;
  layer?: string;
}

interface EquipmentV2 extends V2Record {
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
```

不变量：

- `allowedSlots` 属于物品合同，`equippedAt` 属于当前状态；二者不能只靠对象所在路径混为一谈。
- 所有 `equippedAt` 必须被 `allowedSlots` 接受，并满足 `occupies` 的复合占位。
- `system/slot/layer` 是开放命名，由当前卡片/规则适配器解释；协议不硬编码某一卡片的头、腿、脚路径。
- 阶段1不提供内置槽位词表。旧字符串槽位只有在调用方显式提供 `system` 时才能映射为 `SlotRef`；缺少 `system` 或 `allowedSlots` 时保持 `unresolved`。
- 1.x 只有“当前路径”而没有物品槽位元数据时，可迁移当前穿戴位置，但 `allowedSlots` 必须为 `unresolved`，禁止据此推断物品以后能穿在哪里。
- 穿戴、卸下和转移必须在同一事务中同时处理来源槽、目标槽和背包数量。

## 5. SkillV2

```ts
interface SkillCost {
  resource: ResourceRef;
  amount: number;
  timing: 'on-start' | 'on-success' | 'per-tick' | 'on-complete';
  refundable: boolean;
}

interface SkillV2 extends V2Record {
  name: string;
  mode: 'active' | 'passive' | 'reaction' | 'toggle';
  costs: SkillCost[];
  effects: EffectV2[];
  resolution?: {
    checkId?: string;
    target?: string;
    cooldown?: number;
  };
  displayCost?: string;
  provenance: EvidenceRef[];
  migration?: MigrationState;
}
```

不变量：

- `displayCost` 只用于展示；`20MP`、`15 耐力` 等文本不能作为唯一结算来源。
- 主动技能必须在规定 timing 发生资源事务；仅提到“可以使用”不构成发动。
- 多资源成本必须原子提交；任一前置条件失败则全部不扣。
- 1.x文本只有在单位和数值能唯一映射到当前资源时才可自动迁移，否则进入 `unresolved`。
- 阶段1资源别名表由调用方显式注入；别名未命中、多重命中，或缺少 `timing/refundable` 规则时都保持 `unresolved`。严格的“数值+单位”解析只做语法拆分，不承担语义裁决。

## 6. Fact

```ts
interface Fact extends V2Record {
  proposition: string;
  status: 'candidate' | 'confirmed' | 'disputed' | 'retracted';
  scope: 'turn' | 'branch' | 'chat' | 'world';
  branchId: BranchId;
  subjectIds: EntityId[];
  evidence: EvidenceRef[];
  contradictedBy?: EvidenceRef[];
  supersedes?: EntityId[];
  impact: 'cosmetic' | 'local' | 'material' | 'structural';
}
```

不变量：

- 用户输入、模型提案、NPC猜测、论坛内容和随机口令默认最多创建 `candidate`。
- `confirmed` 必须有裁定或可验证证据，并绑定分支。
- 事实状态不能仅靠词频、禁词或“像暗号”确认。
- H3改写不得覆盖 confirmed 事实；显式重写必须新建分支。
- 被撤回事实保留审计记录，不物理删除。

## 7. Knowledge

```ts
interface Knowledge extends V2Record {
  knowerId: EntityId;
  factId: EntityId;
  state: 'unknown' | 'suspected' | 'known' | 'verified';
  acquiredBy: EvidenceRef[];
  branchId: BranchId;
  visibility: 'private' | 'group' | 'public';
}
```

不变量：

- Fact confirmed 不等于所有角色 verified。
- NPC可以 suspected，但叙事不得把其怀疑升级为全知事实。
- hidden/私密事实只有在获取路径成立后才改变 Knowledge。
- 分支切换后，来自弃用分支的知识不得自动进入新分支。

## 8. SocialState

```ts
interface SocialDimensions {
  affection?: number;
  trust?: number;
  intimacy?: number;
  loyalty?: number;
  respect?: number;
  fear?: number;
}

interface SocialState extends V2Record {
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
}
```

不变量：

- `coercive.obedience/control/compulsion` 与 voluntary 好感、信任、亲密、忠诚分离。
- 威胁、洗脑、契约或被迫服从不得自动增加 voluntary 维度。
- 普通送药、保护、请酒、道歉或照顾允许不改变关系。
- 关系变化需要当前明确双向选择、标志性事件或可追溯重复模式。
- 语义二审只能 allow/revert 本轮已变化路径，不能创建新关系值或改写正文风格。

## 9. Quest

```ts
interface Quest extends V2Record {
  title: string;
  status: 'proposed' | 'active' | 'suspended' | 'completed' | 'failed'
    | 'cancelled' | 'superseded';
  branchId: BranchId;
  objectives: Array<{
    id: string;
    description: string;
    status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
    evidence: EvidenceRef[];
  }>;
  settlementTransactionIds: TransactionId[];
  supersededBy?: EntityId;
  terminalEvidence?: EvidenceRef[];
}
```

不变量：

- `completed/failed/cancelled/superseded` 为终态；同一任务不得复开。
- 重Roll或分支弃用后，旧分支任务不能继续 active 地影响新分支。
- 奖励、消耗和任务终态必须由同一事务或有顺序约束的事务组提交。
- 余波应建立新 Quest/Fact，而不是复活旧任务。

## 10. MessageFingerprint

```ts
interface MessageFingerprint {
  chatId: string;
  logicalIndex: number;
  messageId: string;
  swipeId: number;
  generation: number;
  branchId: BranchId;
  parentHash: string;
  contentHash: string;
  stateHash?: string;
}
```

比较规则：

- 写入前必须逐项比较 chat、逻辑楼层、稳定消息 ID、swipe、generation、branch 和 contentHash。
- 宿主只提供候选身份时，阶段2适配器按显式完整指纹、持久医生ID、宿主原生ID、调用方显式启用的 `send_date` 四层依次选择；同层多值或字段冲突必须 unresolved/rejected，不得降级猜测。
- continue 可以保留逻辑楼层与分支，但内容变化后必须产生新的 contentHash 和 generation。
- regenerate/new swipe 必须创建新 branchId 或新的明确分支版本。
- 不得用 `latest` 替代捕获时目标，也不得因消息失配把结果“顺手写到当前最新楼”。

## 11. Branch

```ts
interface Branch extends V2Record {
  parentBranchId?: BranchId;
  divergenceFingerprint: MessageFingerprint;
  headFingerprint: MessageFingerprint;
  status: 'active' | 'abandoned' | 'archived' | 'merged';
  checkpointRef: string;
  transactionIds: TransactionId[];
  factIds: EntityId[];
  questIds: EntityId[];
}
```

不变量：

- 每个事务、事实、知识、任务和长任务必须绑定 branchId。
- abandoned 分支保留审计数据，但不能继续向当前状态提交。
- 重Roll从分歧点 checkpoint 重算；不得继承被放弃正文产生的资源、世界事件、论坛或数据库内容。
- normal 前进到下一逻辑楼层时，新指纹的 `parentHash` 指向旧分支头内容；continue 更新同一逻辑楼层和 generation，但保留共同父哈希；regenerate/new swipe 从共同父 checkpoint 建立新分支并退役旧分支。
- 2.0.0 不执行隐式 merge；`merged` 只为2.1显式协议预留。

## 12. Transaction

```ts
interface Transaction {
  id: TransactionId;
  protocolVersion: '2.0';
  branchId: BranchId;
  target: MessageFingerprint;
  idempotencyKey: string;
  kind: 'narrative-repair' | 'resource' | 'inventory' | 'equipment'
    | 'skill' | 'social' | 'quest' | 'compound';
  status: 'proposed' | 'prepared' | 'committed' | 'aborted'
    | 'rolled_back' | 'stale';
  preconditions: Array<Record<string, unknown>>;
  effects: EffectV2[];
  touchedRefs: string[];
  beforeHash?: string;
  afterHash?: string;
  createdAt: number;
  committedAt?: number;
  audit: EvidenceRef[];
}
```

事务不变量：

1. `(branchId, idempotencyKey)` 最多有一个 committed 结果。
2. `prepared` 前验证结构、证据、资源余额、槽位、任务状态和玩家授权。
3. `commit` 前重新验证完整 MessageFingerprint 和 branch status。
4. 所有写入走同一领域写入队列；并发事务必须串行或显式检测冲突。
5. commit 后必须回读 touchedRefs 并核对 afterHash。
6. 回读失败只回滚本事务触碰路径，保留外部合法并发变化。
7. 迟到结果、目标变化或弃用分支只能进入 `stale`，不得提交。
8. 事务失败不得留下部分资源扣除、孤立装备或半个任务终态。
9. 幂等键描述逻辑操作、主体、效果和逻辑父输入，允许同一语义操作跨 reroll 保持稳定；唯一提交作用域始终是 `(branchId, idempotencyKey)`。
10. 写入计划使用显式 JSON Pointer 路径、前置条件和写后值；禁止重叠路径、根路径和需要猜测数组结构的变更。
11. 回滚前精确回读；仅当当前路径仍等于本事务写后值时恢复该路径的写前值，已被外部合法更新的路径必须保留。

## 13. 正文稳定与下游协议

每个目标楼层维护以下屏障：

```ts
type NarrativeBarrierState =
  | 'captured'
  | 'repairing'
  | 'state-committing'
  | 'settled'
  | 'stale'
  | 'failed';
```

顺序必须是：

1. 捕获主回复；
2. 完成玩家边界与硬合同检查；
3. 如有正文修复，创建/切换最终 swipe；
4. 提交并回读变量、关系、资源和开局同步；
5. 复核最终 MessageFingerprint；
6. 发布 `settled`；
7. 数据库、记忆、论坛索引等下游读取最终正文。

数据库不得在 `repairing` 或 `state-committing` 时读取。屏障变为 `stale/failed` 时，下游必须放弃本目标，不得退回旧正文。

## 14. Reroll、任务和看门狗

```ts
interface TaskLease {
  id: string;
  branchId: BranchId;
  target: MessageFingerprint;
  phase: string;
  status: 'queued' | 'running' | 'cancel-requested' | 'completed'
    | 'failed' | 'timed-out' | 'stale';
  progress?: { current: number; total?: number; label?: string };
  startedAt: number;
  heartbeatAt: number;
  softDeadlineAt: number;
  hardDeadlineAt: number;
}
```

规则：

- regenerate/new swipe 立即使旧 lease `stale` 并取消未开始任务。
- 软期限到达必须显示可见警告和取消入口。
- 心跳超期进入看门狗复核；硬期限到达必须 `timed-out`。
- timed-out/stale 任务的迟到结果一律丢弃。
- 进度必须来自显式阶段或完成量，不能用无限旋转图标冒充。

## 15. 提交算法

标准伪代码：

```text
capture target + branch + before state
build proposed transaction
validate player boundary, evidence, schema and domain invariants
prepare transaction and reserve idempotency key
recheck full MessageFingerprint and active branch
serialize through write queue
apply on in-memory copy
persist write-ahead recovery record
write exact target
read exact target back
verify touched refs and afterHash
mark committed
publish narrative settled barrier
allow downstream readers
```

任一步失败时：

- 未写入：`aborted`；
- 目标改变：`stale`；
- 已写入但回读失败：路径级 rollback，并记录 `rolled_back` 或保留人工恢复记录；
- 不得用重试绕过证据、玩家授权或分支门禁。

## 16. 1.x 迁移与兼容

```ts
interface MigrationState {
  sourceVersion: '1.x' | 'legacy';
  status: 'native' | 'mapped' | 'unresolved' | 'quarantined';
  sourceRefs: string[];
  warnings: string[];
}
```

迁移策略：

1. **惰性读取**：首次访问时通过适配器投影为 V2，不批量重写全部聊天。
2. **保留原始字段**：V2未知字段进入 `extensions.legacy`，写回时不得删除。
3. **双视图过渡**：2.0写 V2权威记录，同时为仍需1.x形态的 UI 提供只读投影；不得双写两个独立权威源。
4. **物品**：有描述/数量的1.x对象可映射 ItemV2；缺数量或机械效果时标为 unresolved。
5. **装备**：当前路径可映射 `equippedAt`；缺少允许槽位时 `allowedSlots` unresolved，不猜测。
6. **技能**：唯一可解析的“20MP”可生成候选 SkillCost，但必须由当前资源适配器确认；歧义单位保持 unresolved。
7. **事实/知识**：旧正文、论坛和世界账本条目先映射 candidate/known-by-source，不批量升级 confirmed/verified。
8. **关系**：保留旧分数和标签；无法区分强制/自愿时写入 legacy 扩展并等待后续证据，不把高分自动解释为自愿。
9. **任务**：旧“已结束”映射相应终态；状态冲突时 quarantined，禁止重复结算。
10. **事务**：已有1.x写前日志可导入审计链，但不能伪造缺失的 idempotencyKey；新写入从 V2事务开始。
11. **分支**：利用现有 chat/message/swipe/generation 指纹建立初始分支；历史无法区分的 swipe 不自动合并。
12. **回退**：迁移失败时继续以1.x只读模式展示，并明确缺口；不得为“完成迁移”破坏旧数据。

## 17. 安全与隐私

- 事务、诊断、fixture 和回放不得保存 API 密钥、Authorization、Cookie、完整私人聊天或外部凭据。
- EvidenceRef 默认保存引用、字段路径、短摘要和哈希。
- 导出前扫描常见密钥形态和绝对用户目录。
- 私有归档只作为只读证据，不进入公开仓库。
- 任何迁移和回放都必须有最大文本长度与最大对象数量。

## 18. 回放协议

阶段0机器语料由 [`replay-fixture.schema.json`](replay-fixture.schema.json) 约束，实例位于 [`../../fixtures/2.0/replay-cases.json`](../../fixtures/2.0/replay-cases.json)。

当前默认测试验证 schema、引用、覆盖与隐私；阶段1领域 API、阶段2事务 API、阶段3导演 API、阶段4领域事务 API 与阶段5双入口/移动浏览器 API 已激活十三个 `unit-active` fixture，其中药剂、技能、装备、普通善意和强制/自愿关系五例会直接调用真实阶段4规划入口，Android受控展开会调用真实阶段5浏览器入口。阶段3的正则/文本匹配仍只输出风险召回候选，最终边界与口胡裁决必须消费结构化语义依据；H2 cost/check 只有在阶段4复合事务成功时才确认 candidate Fact，H3仍显式交回阶段2建立新分支。未到激活阶段的数据库、下游稳定屏障、看门狗和发布行为不得在默认 CI 中制造“未来功能尚未实现”的红灯。

## 19. 阶段4领域事务适配合同

阶段4公开入口位于 `v2/domain-transaction/`：

- `validateDirectorDomainCommand` 只接受阶段3真实 valid 命令或已接受 Turn Boundary 授权，复核完整 `MessageFingerprint`、active Branch、命令来源与证据；
- `validateCampaignDomainConfig` 要求战役显式注册槽位、资源、检定、记录和扩展效果路径，不提供通用猜测回退；
- `planDirectorDomainTransaction` 是无宿主纯函数，输出每个 effect 的精确 JSON Pointer、写前前置条件、领域 `ValidationResult`、稳定幂等键与 `Transaction` proposal；
- `preparePlannedDomainTransaction` 与 `executePlannedDomainTransaction` 只把 valid proposal 交给阶段2 `TransactionKernel`，任何 unresolved/rejected/no-op 计划都不能进入提交；
- `createLazyLegacyDomainProjection` 与 `diagnoseLegacyDomainProjection` 只读调用阶段1适配器，逐记录公开 `pending/mapped/unresolved/quarantined` 诊断，未知字段继续留在 `extensions.legacy`。

适配不变量：

1. 物品数量和全部类型化效果、装备/槽位/背包/加成、技能全部类型化成本、任务终态/替代/资源结算，以及 H2代价或检定成功与 Fact确认必须分别在单个复合事务中完成。
2. 任务 `completed/failed/cancelled/superseded` 永不复开；替代任务写入路径必须显式证明 absent；`settlementTransactionIds` 记录本次稳定事务ID。
3. 普通善意缺少证据时恢复自愿轴与极端标签；强制证据只允许对应强制轴，不得旁路提升好感或信任。
4. 同一逻辑操作的幂等键不含 branchId，但唯一提交作用域仍为 `(branchId, idempotencyKey)`；旧分支、迟到指纹和并发重复提交继续由阶段2内核零写入处理。
5. 任一记录、路径、数值、资源、槽位、检定结果、事实证据、消息身份或分支信息有歧义时返回 unresolved/rejected，不生成可提交事务。

## 20. 阶段5双入口与诊断可见性合同

阶段5公开入口位于 `v2/surface/`，并由生产 `index.js` 安装导演台：

- `adaptNaturalLanguageIntent` 只把注册的精确表达，或带非空 `semanticBasis` 的有界语义动作 ID，转换为候选；它不猜物品、数量、槽位、资源、事实、知识、分支、检定或授权；
- `adaptUiAction` 读取同一调用方动作目录中的 action ID；UI不拥有另一套领域命令，也不能提供保留字段、绕开导演或直接写状态；
- `planDualSurfaceDomainAction` 是唯一双源纯编排入口：先生成同一个结构化 DomainCommand candidate，再执行目标绑定确认、阶段3 Turn Boundary裁定、`validateDirectorDomainCommand` 和 `planDirectorDomainTransaction`；
- `compareDualSurfaceParity` 对规范命令、确认摘要、裁定、稳定幂等键、精确写计划、前置条件和整笔 Transaction proposal 逐项比较；
- `createDualSurfaceViewModel` 只公开白名单审计投影；默认不回显原始自然语言、EvidenceRef正文、完整提示词、密钥、外部URL、私人路径或宿主异常详情；
- `installDualSurfaceUI` 展示裁定、事务、分支、证据、迁移缺口与撤销，并提供沉浸/可审计/调试三个可见度。调试模式也只增加哈希和结构元数据，不增加私人原文。

宿主合同：

1. `window.MvuAutoDoctorV2Host.captureSession()` 必须一次捕获同一个动作目录、完整 `MessageFingerprint`、active Branch、Turn Boundary、证据、显式战役配置和领域前值；缺任一项时导演台保持只读 `unresolved`。
2. `window.MvuAutoDoctorV2Host.executePlannedDomainTransaction(plan)` 是唯一生产提交桥；它必须复用阶段2/4 TransactionKernel。阶段5自身没有任何直接状态写入回退。
3. 危险领域动作的确认摘要绑定 action、规范命令和完整目标身份；确认前不规划事务，目标变化后旧确认失效。
4. 自然语言与UI入口只允许阶段4原生物品、装备、技能、社会和任务命令；阶段3 Fact/Knowledge/H2/H3命令继续使用各自证据与分支入口，不能伪装成本目录动作。
5. 390×844触控视口的可见控件不得小于44px；对话框必须约束横向溢出、捕获Tab焦点、支持Escape关闭，并把焦点归还开启控件。
