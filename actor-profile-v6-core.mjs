import { fingerprint } from './core.mjs';

export const ACTOR_PROFILE_V6_VERSION = 6;
export const ACTOR_SOVEREIGNTY_DIVERSITY_CONTRACT = `
【人物主权与多样性】
- 人物不是职业、阵营、物种、性别、外貌或心理类型标签的函数；不得默认粗暴、冷漠、疯癫、绝望、敌对或同质化善良。
- 让不同人物在价值取向、说话节奏、行动习惯、关系距离、信息取样、典型误读、受压反应与恢复路径上形成可观察差异。
- 普通、善意、幽默、克制、胆怯、现实、功利、温和、尴尬和低风险生活都可持续存在；冲突必须来自已有利益、误会、责任或资源条件。
- 一次恐惧、愤怒、失败、服从或受伤不能反推永久人格、隐藏创伤、秘密关系、能力资源或玩家经历。
- 修正无证据黑暗化时保留已有合理敌意、利益冲突和个人边界，不把所有人物洗成同一种好人。
- 人物只决定自身行动尝试；不得替玩家决定行动、同意、参与、支付、感受或关系态度，结果由世界裁决器另行结算。
`.trim();
export const ACTOR_PROFILE_COMPLETION_MODES = Object.freeze([
    'off',
    'basic',
    'full',
    'full_adult',
]);
export const ACTOR_PROFILE_SOURCES = Object.freeze([
    'confirmed',
    'designed_seed',
    'hypothesis',
    'deprecated',
]);
export const ACTOR_PROFILE_MODULES = Object.freeze([
    'identity',
    'personality',
    'relationships',
    'goals',
    'knowledge',
    'resourcesCapabilities',
    'dynamicState',
    'actionHistory',
    'physiology',
]);

const SOURCE_SET = new Set(ACTOR_PROFILE_SOURCES);
const MODULE_SET = new Set(ACTOR_PROFILE_MODULES);

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function cleanText(value, limit = 500) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function cleanList(value, limit = 16, itemLimit = 300) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const entry of value) {
        const item = cleanText(entry, itemLimit);
        const key = item.toLocaleLowerCase();
        if (!item || seen.has(key)) continue;
        seen.add(key);
        output.push(item);
        if (output.length >= limit) break;
    }
    return output;
}

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, fallback = 0) {
    const parsed = Math.floor(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

function modeOf(value) {
    return ACTOR_PROFILE_COMPLETION_MODES.includes(value) ? value : 'full';
}

function sourceOf(value, fallback = 'confirmed') {
    return SOURCE_SET.has(value) ? value : fallback;
}

function normalizeModule(value, fallbackData = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        status: ['missing', 'queued', 'ready', 'deferred'].includes(source.status)
            ? source.status
            : 'missing',
        source: sourceOf(source.source, 'confirmed'),
        data: source.data && typeof source.data === 'object' && !Array.isArray(source.data)
            ? clone(source.data)
            : clone(fallbackData),
        unknownFields: cleanList(source.unknownFields, 64, 160),
        version: integer(source.version, 1, Number.MAX_SAFE_INTEGER, 1),
        updatedTurn: integer(source.updatedTurn),
        evidence: cleanList(source.evidence, 16, 300),
    };
}

function emptyPhysiology() {
    return {
        enabled: false,
        adultEnabled: false,
        source: 'designed_seed',
        appearance: {
            visibleFeatures: [],
            proportions: '',
            measurements: {},
        },
        reproductiveAnatomy: {
            external: '',
            internal: '',
        },
        morphology: {
            species: '',
            form: '',
            dimorphism: '',
        },
        sensitivity: {},
        physiologicalResponses: {},
        secretionCycle: {},
        fertility: {},
        specialSpecies: {},
        forms: [],
        currentBodyState: {},
        freeform: '',
        personalityInferenceAllowed: false,
    };
}

function normalizePhysiology(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const base = emptyPhysiology();
    return {
        ...base,
        ...clone(source),
        enabled: source.enabled === true,
        adultEnabled: source.adultEnabled === true,
        source: sourceOf(source.source, 'designed_seed'),
        appearance: {
            ...base.appearance,
            ...(source.appearance && typeof source.appearance === 'object'
                ? clone(source.appearance)
                : {}),
        },
        reproductiveAnatomy: {
            ...base.reproductiveAnatomy,
            ...(source.reproductiveAnatomy && typeof source.reproductiveAnatomy === 'object'
                ? clone(source.reproductiveAnatomy)
                : {}),
        },
        morphology: {
            ...base.morphology,
            ...(source.morphology && typeof source.morphology === 'object'
                ? clone(source.morphology)
                : {}),
        },
        sensitivity: source.sensitivity && typeof source.sensitivity === 'object'
            ? clone(source.sensitivity)
            : {},
        physiologicalResponses: source.physiologicalResponses
            && typeof source.physiologicalResponses === 'object'
            ? clone(source.physiologicalResponses)
            : {},
        secretionCycle: source.secretionCycle && typeof source.secretionCycle === 'object'
            ? clone(source.secretionCycle)
            : {},
        fertility: source.fertility && typeof source.fertility === 'object'
            ? clone(source.fertility)
            : {},
        specialSpecies: source.specialSpecies && typeof source.specialSpecies === 'object'
            ? clone(source.specialSpecies)
            : {},
        forms: Array.isArray(source.forms) ? clone(source.forms).slice(0, 16) : [],
        currentBodyState: source.currentBodyState && typeof source.currentBodyState === 'object'
            ? clone(source.currentBodyState)
            : {},
        freeform: cleanText(source.freeform, 4000),
        personalityInferenceAllowed: false,
    };
}

export function emptyActorProfileV6(actorId = '', name = '', { mode = 'full' } = {}) {
    return {
        version: ACTOR_PROFILE_V6_VERSION,
        actorId: cleanText(actorId, 120),
        name: cleanText(name, 160),
        completionMode: modeOf(mode),
        preparedForAction: false,
        backgroundPending: false,
        coverage: 0,
        modules: Object.fromEntries(ACTOR_PROFILE_MODULES.map((module) => [
            module,
            normalizeModule(null, module === 'physiology' ? emptyPhysiology() : {}),
        ])),
        fieldSources: {},
        locks: {},
        manualOverrides: {},
        moduleVersions: Object.fromEntries(ACTOR_PROFILE_MODULES.map((module) => [module, 0])),
        history: [],
        updatedTurn: 0,
    };
}

export function normalizeActorProfileV6(value, {
    actorId = '',
    name = '',
    mode = 'full',
} = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = emptyActorProfileV6(
        actorId || source.actorId,
        name || source.name,
        { mode: source.completionMode || mode },
    );
    output.preparedForAction = source.preparedForAction === true;
    output.backgroundPending = source.backgroundPending === true;
    output.coverage = integer(source.coverage, 0, 100, 0);
    for (const module of ACTOR_PROFILE_MODULES) {
        output.modules[module] = normalizeModule(
            source.modules?.[module],
            module === 'physiology' ? emptyPhysiology() : {},
        );
        if (module === 'physiology') {
            output.modules[module].data = normalizePhysiology(output.modules[module].data);
        }
    }
    output.fieldSources = Object.fromEntries(
        Object.entries(source.fieldSources || {})
            .map(([path, fieldSource]) => [cleanText(path, 240), sourceOf(fieldSource)])
            .filter(([path]) => path),
    );
    output.locks = Object.fromEntries(
        Object.entries(source.locks || {})
            .map(([path, locked]) => [cleanText(path, 240), locked === true])
            .filter(([path]) => path),
    );
    output.manualOverrides = source.manualOverrides
        && typeof source.manualOverrides === 'object'
        && !Array.isArray(source.manualOverrides)
        ? clone(source.manualOverrides)
        : {};
    for (const module of ACTOR_PROFILE_MODULES) {
        output.moduleVersions[module] = integer(source.moduleVersions?.[module]);
    }
    output.history = (Array.isArray(source.history) ? source.history : [])
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
            id: cleanText(entry.id, 120),
            action: cleanText(entry.action, 120),
            module: MODULE_SET.has(entry.module) ? entry.module : 'identity',
            turn: integer(entry.turn),
            at: integer(entry.at),
            beforeDigest: cleanText(entry.beforeDigest, 120),
            afterDigest: cleanText(entry.afterDigest, 120),
        }))
        .filter((entry) => entry.id)
        .slice(-40);
    output.updatedTurn = integer(source.updatedTurn);
    return output;
}

const SOCIAL_SEEDS = [
    '先确认彼此边界，再用小而可撤回的承诺建立信任',
    '对熟人直接，对陌生人保留礼貌距离，冲突后倾向给出可执行方案',
    '用观察与提问校准关系，不把一次情绪当成永久立场',
    '愿意合作但重视对价，通常先处理现实问题再讨论感受',
    '通过日常互助维持关系，遇到压力会缩短表达而不是自动敌对',
    '习惯用轻微幽默缓冲尴尬，同时保留明确拒绝的能力',
    '面对权威会核对规则与后果，对弱势者更关注实际可行的支持',
    '关系靠持续行动而非口号推进，亲近与警惕可以同时存在',
];
const DECISION_SEEDS = [
    '在时间、成本、关系后果与可逆性之间做现实权衡',
    '先寻找最低风险的试探步骤，再根据反馈扩大或撤回投入',
    '信息不足时保留多个解释，不把最坏可能直接当作事实',
    '优先履行明确承诺，同时为意外保留替代路线',
    '会区分紧急与重要，不因场面压力放弃长期目标',
    '倾向把大目标拆成能留下回执的小步骤',
    '先检查自身资源和权限，再决定请求协助或独立处理',
    '允许暂时观望，但需要具体条件与下一检查窗口',
];
const SPEECH_SEEDS = [
    '表达具体，少用绝对化判断，会说明自己能做与不能做的部分',
    '句式自然克制，熟悉后会增加玩笑和省略，不用同一种腔调对所有人',
    '先回应事实再表达态度，意见冲突时偏好给出理由而非威吓',
    '说话节奏受关系和场合影响，公开场合更谨慎，私下更直接',
    '不把情绪当命令，必要时会暂停并约定稍后继续',
    '愿意承认不知道，并把需要核实的部分说清楚',
    '礼貌不等于顺从，拒绝时会尽量给出替代办法',
    '重视对方是否真正理解，复杂事情会换一种说法确认',
];
const PERSONAL_GOAL_SEEDS = [
    {
        longTerm: '保持生活秩序与可支配时间，不让外部事件吞掉全部日常',
        current: '梳理眼前事务的轻重缓急，先完成一个不依赖他人同意的步骤',
        steps: ['列出紧急、重要和可延后的事务', '完成成本最低且可留下回执的准备', '根据实际反馈安排下一窗口'],
        obstacle: '外部变化可能打乱自己的时间安排',
        cost: '需要投入时间与注意力',
        alternative: '条件不足时先缩小范围，保留之后恢复的接口',
    },
    {
        longTerm: '建立可持续的互惠关系，同时保留明确边界和退出余地',
        current: '用一次小而可撤回的合作核对彼此的可靠程度',
        steps: ['确认双方能够承担的最小事项', '约定一个可核验回执', '依据履约情况调整关系距离'],
        obstacle: '对方的意图与能力仍可能不完整',
        cost: '需要承担一次有限的信任风险',
        alternative: '若合作条件不成立，改为交换公开信息而不作承诺',
    },
    {
        longTerm: '逐步弄清影响自身选择的关键信息，不把猜测当成事实',
        current: '核对一条与自己处境直接相关的不确定信息',
        steps: ['区分已知、传闻与未知', '选择可独立验证的一条线索', '记录结果并保留至少一种解释'],
        obstacle: '可用信息存在缺口或来源偏差',
        cost: '需要花费一次行动窗口进行核对',
        alternative: '无法验证时保持观望，只做可逆准备',
    },
    {
        longTerm: '维持现实安全和行动余地，不为场面压力做不可撤回决定',
        current: '检查当前风险、出口与可以提前准备的低成本措施',
        steps: ['确认最直接的风险来源', '准备一个不扩大冲突的应对办法', '约定下一次复核条件'],
        obstacle: '风险可能变化，现有判断并不完备',
        cost: '需要暂时放慢其他事务',
        alternative: '优先撤离或请求明确协助，不独自扩大风险',
    },
    {
        longTerm: '找到能稳定交换价值的位置，使自己的投入获得现实回报',
        current: '盘点自己已确认能做的事与当前缺口，选择一个可交付的小目标',
        steps: ['只盘点已有能力与资源', '定义一个不超出权限的交付', '用结果决定是否继续投入'],
        obstacle: '需求、权限或回报可能尚未说清',
        cost: '需要占用一次可支配行动窗口',
        alternative: '无法交付时先澄清条件，不承诺未知能力',
    },
    {
        longTerm: '保留稳定的恢复节奏，使压力不会永久取代原有生活',
        current: '完成一项能恢复秩序的小事务，再重新评估更大的问题',
        steps: ['确认当前最影响状态的因素', '完成一项短而具体的恢复步骤', '状态回稳后再扩大行动'],
        obstacle: '紧急事务可能持续挤压恢复空间',
        cost: '需要主动留出休息或整理时间',
        alternative: '无法完整恢复时先降低任务强度并延后非紧急承诺',
    },
    {
        longTerm: '让承诺、成本和实际能力保持一致，避免被旧决定拖入失控',
        current: '复核一项现有承诺的期限、代价与可替代路线',
        steps: ['确认承诺仍然有效的依据', '检查当前可承担的成本', '必要时提前提出可执行的调整'],
        obstacle: '承诺对象或环境可能已经变化',
        cost: '可能需要放弃较低优先级的安排',
        alternative: '无法按原方案履行时，尽早缩小范围或重新约定',
    },
    {
        longTerm: '保持自己的判断独立，不把外部刺激自动变成个人目标',
        current: '评估一个新机会或风险是否真的值得纳入自己的计划',
        steps: ['说明它与长期目标的真实关系', '估算最低投入与最坏代价', '选择采纳、忽略、利用或反对并留下理由'],
        obstacle: '外部刺激可能带有不完整或偏向性信息',
        cost: '需要暂停一次惯性反应进行判断',
        alternative: '证据不足时保持原计划，只设置下一检查条件',
    },
];

function seedIndex(actor, salt, length) {
    const identity = `${actor?.id || ''}|${actor?.name || 'actor'}`;
    const numericSuffix = String(actor?.id || '').match(/(\d+)$/u);
    const identityOffset = numericSuffix
        ? Math.max(0, Number(numericSuffix[1]) - 1)
        : [...identity].reduce(
            (sum, character, index) => sum + character.codePointAt(0) * (index + 1),
            0,
        );
    const saltOffset = [...String(salt || '')].reduce(
        (sum, character, index) => sum + character.codePointAt(0) * (index + 3),
        0,
    );
    return (identityOffset + saltOffset) % length;
}

function evidenceForActor(actor) {
    return cleanList([
        ...(actor?.evidence || []),
        ...(actor?.knowledge || []).map((entry) => entry?.id),
        ...(actor?.stateFacts || []).map((entry) => entry?.id),
    ], 16, 300);
}

function hasText(value) {
    if (typeof value === 'string') return Boolean(cleanText(value));
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value !== null && value !== undefined;
}

function physiologySeed(actor, { adult = false } = {}) {
    const species = cleanText(actor?.profileV6?.modules?.identity?.data?.species, 120)
        || '沿用已确认物种；未确认部分保持开放';
    return normalizePhysiology({
        enabled: adult,
        adultEnabled: adult,
        source: 'designed_seed',
        appearance: {
            visibleFeatures: [],
            proportions: '按已确认物种、年龄阶段与外观约束协调设计',
            measurements: {},
        },
        reproductiveAnatomy: {
            external: adult ? '可由用户或选定模型在本模块内补全，当前不伪装成已确认事实' : '',
            internal: adult ? '可由用户或选定模型在本模块内补全，当前不伪装成已确认事实' : '',
        },
        morphology: {
            species,
            form: '当前形态与谱系保持一致',
            dimorphism: '仅依据已确认设定；未知时保持开放',
        },
        sensitivity: adult ? { status: 'designed_seed_pending_detail' } : {},
        physiologicalResponses: adult ? { status: 'designed_seed_pending_detail' } : {},
        secretionCycle: adult ? { status: 'designed_seed_pending_detail' } : {},
        fertility: adult ? { status: 'unknown_until_designed_or_confirmed' } : {},
        specialSpecies: { status: 'follow_confirmed_species_constraints' },
        forms: clone(actor?.lineage?.forms || []),
        currentBodyState: { status: 'no_unconfirmed_condition_invented' },
        freeform: '',
        personalityInferenceAllowed: false,
    });
}

function recordHistory(profile, module, action, before, after, turn, now) {
    const beforeDigest = `sha256:${fingerprint(JSON.stringify(before ?? null))}`;
    const afterDigest = `sha256:${fingerprint(JSON.stringify(after ?? null))}`;
    profile.history.push({
        id: `PV6H-${fingerprint(`${profile.actorId}|${module}|${action}|${turn}|${now}|${afterDigest}`).slice(0, 20)}`,
        action,
        module,
        turn,
        at: now,
        beforeDigest,
        afterDigest,
    });
    profile.history = profile.history.slice(-40);
}

function setFieldSource(profile, path, source) {
    const next = sourceOf(source);
    if (profile.fieldSources[path] === 'confirmed' && next !== 'confirmed') return;
    profile.fieldSources[path] = next;
}

function recordModuleFieldSources(profile, module, data, source, overrides = {}) {
    const root = `modules.${module}.data`;
    const normalizedOverrides = Object.entries(overrides || {})
        .map(([path, fieldSource]) => [
            cleanText(path, 240).replace(/^\.+/u, ''),
            sourceOf(fieldSource),
        ])
        .filter(([path]) => path)
        .sort((left, right) => right[0].length - left[0].length);
    const sourceFor = (relativePath) => normalizedOverrides.find(([path]) => (
        relativePath === path || relativePath.startsWith(`${path}.`)
    ))?.[1] || source;
    const walk = (value, path, relativePath = '') => {
        setFieldSource(profile, path, sourceFor(relativePath));
        if (!value || typeof value !== 'object') return;
        for (const [key, entry] of Object.entries(value)) {
            walk(entry, `${path}.${key}`, relativePath ? `${relativePath}.${key}` : key);
        }
    };
    walk(data, root);
}

function moduleSnapshot(module) {
    return {
        status: module?.status,
        source: module?.source,
        data: module?.data,
        unknownFields: module?.unknownFields,
        evidence: module?.evidence,
    };
}

function assignModule(profile, module, data, {
    source = 'confirmed',
    unknownFields = [],
    evidence = [],
    turn = 0,
    now = Date.now(),
    action = 'prepare',
    fieldSourceOverrides = {},
} = {}) {
    if (moduleLocked(profile, module)) {
        const current = profile.modules[module];
        recordModuleFieldSources(profile, module, current.data, current.source);
        return false;
    }
    const before = clone(profile.modules[module]);
    const next = {
        status: 'ready',
        source: sourceOf(source),
        data: clone(data),
        unknownFields: cleanList(unknownFields, 64, 160),
        evidence: cleanList(evidence, 16, 300),
    };
    recordModuleFieldSources(profile, module, next.data, next.source, fieldSourceOverrides);
    if (JSON.stringify(moduleSnapshot(before)) === JSON.stringify(next)) return false;
    profile.modules[module] = {
        ...next,
        version: profile.modules[module].version + 1,
        updatedTurn: integer(turn),
    };
    profile.moduleVersions[module] += 1;
    recordHistory(profile, module, action, before, profile.modules[module], turn, now);
    return true;
}

function moduleReady(profile, module) {
    const record = profile.modules[module];
    if (record?.status !== 'ready') return false;
    const data = record.data || {};
    if (module === 'identity') return Boolean(cleanText(data.name) && cleanText(data.role));
    if (module === 'personality') {
        return Boolean(
            cleanList(data.traits).length
            && cleanList(data.desires).length
            && cleanList(data.boundaries).length
            && cleanText(data.socialStyle)
            && cleanText(data.decisionStyle)
            && cleanText(data.speechStyle)
            && cleanText(data.pressureResponse)
            && cleanText(data.recoveryPath)
        );
    }
    if (module === 'relationships') return Array.isArray(data.entries)
        && data.noConfirmedRelationshipMeans === 'unknown_not_empty';
    if (module === 'goals') {
        return Boolean(
            cleanList(data.longTerm).length
            && cleanList(data.current).length
            && cleanText(data.plan?.summary)
            && cleanList(data.plan?.steps).length
            && cleanText(data.nextWindow)
            && cleanList(data.obstacles).length
            && cleanList(data.costs).length
            && cleanList(data.alternatives).length
        );
    }
    if (module === 'knowledge') return Array.isArray(data.entries)
        && data.unknownRemainsUnknown === true;
    if (module === 'resourcesCapabilities') return Array.isArray(data.resources)
        && Array.isArray(data.capabilities)
        && data.noUnconfirmedAbilityGranted === true;
    if (module === 'dynamicState') return data.location && typeof data.location === 'object'
        && Array.isArray(data.stateFacts)
        && Array.isArray(data.stimuli);
    if (module === 'actionHistory') return Array.isArray(data.entries)
        && data.historicalActionsInvented === false;
    if (module === 'physiology') return data.enabled !== true
        || (data.personalityInferenceAllowed === false && data.morphology && data.appearance);
    return false;
}

function calculateCoverage(profile) {
    const required = ACTOR_PROFILE_MODULES.filter((module) => (
        module !== 'physiology' || profile.modules.physiology.data.enabled
    ));
    const ready = required.filter((module) => moduleReady(profile, module)).length;
    return required.length ? Math.round((ready / required.length) * 100) : 100;
}

export function prepareActorProfileV6(actor, {
    mode = 'full',
    turn = 0,
    now = Date.now(),
} = {}) {
    const completionMode = modeOf(mode);
    const profile = normalizeActorProfileV6(actor?.profileV6, {
        actorId: actor?.id,
        name: actor?.name,
        mode: completionMode,
    });
    const previousProfile = clone(profile);
    profile.completionMode = completionMode;
    const evidence = evidenceForActor(actor);
    if (completionMode === 'off') {
        profile.coverage = calculateCoverage(profile);
        profile.preparedForAction = profile.coverage === 100;
        profile.backgroundPending = !profile.preparedForAction;
        profile.updatedTurn = integer(turn);
        return profile;
    }

    const full = ['full', 'full_adult'].includes(completionMode);
    const personalGoalSeed = PERSONAL_GOAL_SEEDS[
        seedIndex(actor, 'personal-goal', PERSONAL_GOAL_SEEDS.length)
    ];
    const identity = {
        name: cleanText(actor?.name, 160),
        role: cleanText(actor?.identity?.role, 180)
            || (full ? '拥有独立日常、关系边界与现实事务的行动者' : '待确认'),
        aliases: cleanList(actor?.identity?.aliases, 8, 120),
        lineage: clone(actor?.lineage || {}),
        species: '',
    };
    assignModule(profile, 'identity', identity, {
        source: actor?.identity?.role ? 'confirmed' : full ? 'designed_seed' : 'hypothesis',
        unknownFields: ['species'],
        evidence,
        turn,
        now,
        fieldSourceOverrides: {
            name: 'confirmed',
            role: actor?.identity?.role ? 'confirmed' : full ? 'designed_seed' : 'hypothesis',
            aliases: actor?.identity?.aliases?.length ? 'confirmed' : 'hypothesis',
            lineage: actor?.lineage ? 'confirmed' : 'hypothesis',
            species: 'hypothesis',
        },
    });

    const hasConfirmedPersonality = [
        ...(actor?.identity?.traits || []),
        actor?.identity?.socialStyle,
        actor?.identity?.decisionStyle,
        actor?.identity?.speechStyle,
    ].some(hasText);
    const personality = {
        traits: cleanList(actor?.identity?.traits, 12, 180),
        desires: cleanList(actor?.identity?.desires, 12, 240),
        boundaries: cleanList(actor?.identity?.boundaries, 12, 240),
        socialStyle: cleanText(actor?.identity?.socialStyle, 240),
        decisionStyle: cleanText(actor?.identity?.decisionStyle, 240),
        speechStyle: cleanText(actor?.identity?.speechStyle, 240),
        copingStyle: cleanText(actor?.identity?.copingStyle, 240),
        pressureResponse: cleanText(actor?.identity?.pressureResponse, 240),
        recoveryPath: cleanText(actor?.identity?.recoveryPath, 240),
        everydayHabits: cleanList(actor?.identity?.everydayHabits, 8, 180),
        blindSpots: cleanList(actor?.identity?.blindSpots, 8, 220),
    };
    const designedPersonalityFields = [];
    if (full) {
        const fill = (key, value) => {
            if (hasText(personality[key])) return;
            personality[key] = clone(value);
            designedPersonalityFields.push(key);
        };
        fill('traits', ['能维持普通日常', '会根据关系和处境调整表达']);
        fill('desires', ['保留可支配时间与现实安全', '让重要关系保持可持续']);
        fill('boundaries', ['不替他人作不可撤回的决定', '不把一次冲突升级为永久敌意']);
        fill('socialStyle', SOCIAL_SEEDS[seedIndex(actor, 'social', SOCIAL_SEEDS.length)]);
        fill('decisionStyle', DECISION_SEEDS[seedIndex(actor, 'decision', DECISION_SEEDS.length)]);
        fill('speechStyle', SPEECH_SEEDS[seedIndex(actor, 'speech', SPEECH_SEEDS.length)]);
        fill('copingStyle', '压力上升时先缩小任务范围，再通过可验证的小步骤恢复掌控');
        fill('pressureResponse', '可能变得简短或谨慎，但不会因此自动残酷、疯癫或绝望');
        fill('recoveryPath', '通过休息、可信反馈、完成小承诺和恢复日常节奏逐步回稳');
        fill('everydayHabits', ['保留一项不服务于主线的日常习惯', '定期检查承诺与资源']);
        fill('blindSpots', ['可能高估自己对熟悉局面的判断']);
    }
    assignModule(profile, 'personality', personality, {
        source: hasConfirmedPersonality ? 'confirmed' : full ? 'designed_seed' : 'hypothesis',
        evidence,
        turn,
        now,
        fieldSourceOverrides: Object.fromEntries([
            ...Object.keys(personality).map((key) => [key, 'confirmed']),
            ...designedPersonalityFields.map((key) => [key, 'designed_seed']),
        ]),
    });

    assignModule(profile, 'relationships', {
        entries: clone(actor?.relationships || []),
        noConfirmedRelationshipMeans: 'unknown_not_empty',
    }, {
        source: actor?.relationships?.length ? 'confirmed' : 'hypothesis',
        unknownFields: actor?.relationships?.length ? [] : ['relationship_entries'],
        evidence,
        turn,
        now,
    });
    const previousGoals = previousProfile.modules.goals;
    const previousGoalFieldWasSeeded = (path, currentValue, previousValue) => (
        previousProfile.fieldSources[`modules.goals.data.${path}`] === 'designed_seed'
        || previousGoals.source === 'designed_seed'
    ) && JSON.stringify(currentValue ?? null) === JSON.stringify(previousValue ?? null);
    const confirmedLongTerm = cleanList(actor?.longTermGoals, 12, 400);
    const confirmedCurrent = cleanList(actor?.currentGoals, 8, 400);
    const plan = clone(actor?.plan || {});
    const goalFieldSources = {};
    const longTerm = confirmedLongTerm.length
        ? confirmedLongTerm
        : full ? [personalGoalSeed.longTerm] : [];
    const current = confirmedCurrent.length
        ? confirmedCurrent
        : full ? [personalGoalSeed.current] : [];
    if (!cleanText(plan.summary) && full) plan.summary = personalGoalSeed.current;
    if (!cleanList(plan.steps, 12, 300).length && full) plan.steps = clone(personalGoalSeed.steps);
    if (!cleanText(plan.nextWindow) && full) plan.nextWindow = '下一个不与既有承诺冲突的行动窗口';
    if (!cleanList(plan.obstacles, 12, 300).length && full) plan.obstacles = [personalGoalSeed.obstacle];
    if (!cleanList(plan.costs, 12, 300).length && full) plan.costs = [personalGoalSeed.cost];
    if (!cleanList(plan.alternatives, 12, 300).length && full) plan.alternatives = [personalGoalSeed.alternative];
    plan.priority = cleanText(plan.priority, 40) || (full ? 'normal' : '');
    for (const [path, present] of [
        ['longTerm', confirmedLongTerm.length > 0 && !previousGoalFieldWasSeeded(
            'longTerm', confirmedLongTerm, previousGoals.data?.longTerm,
        )],
        ['current', confirmedCurrent.length > 0 && !previousGoalFieldWasSeeded(
            'current', confirmedCurrent, previousGoals.data?.current,
        )],
        ['plan.summary', cleanText(actor?.plan?.summary) && !previousGoalFieldWasSeeded(
            'plan.summary', cleanText(actor?.plan?.summary), cleanText(previousGoals.data?.plan?.summary),
        )],
        ['plan.steps', cleanList(actor?.plan?.steps, 12, 300).length > 0 && !previousGoalFieldWasSeeded(
            'plan.steps', cleanList(actor?.plan?.steps, 12, 300), cleanList(previousGoals.data?.plan?.steps, 12, 300),
        )],
        ['nextWindow', cleanText(actor?.plan?.nextWindow) && !previousGoalFieldWasSeeded(
            'nextWindow', cleanText(actor?.plan?.nextWindow), cleanText(previousGoals.data?.nextWindow),
        )],
        ['obstacles', cleanList(actor?.plan?.obstacles, 12, 300).length > 0 && !previousGoalFieldWasSeeded(
            'obstacles', cleanList(actor?.plan?.obstacles, 12, 300), cleanList(previousGoals.data?.obstacles, 12, 300),
        )],
        ['costs', cleanList(actor?.plan?.costs, 12, 300).length > 0 && !previousGoalFieldWasSeeded(
            'costs', cleanList(actor?.plan?.costs, 12, 300), cleanList(previousGoals.data?.costs, 12, 300),
        )],
        ['alternatives', cleanList(actor?.plan?.alternatives, 12, 300).length > 0 && !previousGoalFieldWasSeeded(
            'alternatives', cleanList(actor?.plan?.alternatives, 12, 300), cleanList(previousGoals.data?.alternatives, 12, 300),
        )],
    ]) goalFieldSources[path] = present ? 'confirmed' : full ? 'designed_seed' : 'hypothesis';
    const hasConfirmedGoal = Object.values(goalFieldSources).some((source) => source === 'confirmed');
    assignModule(profile, 'goals', {
        longTerm,
        current,
        priority: plan.priority,
        plan,
        nextWindow: cleanText(plan.nextWindow, 180),
        deadlineTurn: integer(actor?.deadlineTurn),
        commitments: clone(actor?.commitments || []),
        obstacles: cleanList(plan.obstacles, 12, 300),
        costs: cleanList(plan.costs, 12, 300),
        alternatives: cleanList(plan.alternatives, 12, 300),
    }, {
        source: hasConfirmedGoal ? 'confirmed' : full ? 'designed_seed' : 'hypothesis',
        unknownFields: full ? [] : ['personal_goal_details'],
        evidence,
        turn,
        now,
        fieldSourceOverrides: goalFieldSources,
    });
    assignModule(profile, 'knowledge', {
        entries: clone(actor?.knowledge || []),
        unknownRemainsUnknown: true,
    }, { source: 'confirmed', evidence, turn, now });
    assignModule(profile, 'resourcesCapabilities', {
        resources: clone(actor?.resources || []),
        capabilities: cleanList(actor?.capabilities, 24, 160),
        noUnconfirmedAbilityGranted: true,
    }, {
        source: 'confirmed',
        unknownFields: actor?.resources?.length || actor?.capabilities?.length
            ? []
            : ['resources', 'capabilities'],
        evidence,
        turn,
        now,
    });
    assignModule(profile, 'dynamicState', {
        location: clone(actor?.location || {}),
        stateFacts: clone(actor?.stateFacts || []),
        stimuli: clone(actor?.stimuli || []),
        constraints: cleanList(actor?.constraints, 12, 500),
        status: cleanText(actor?.status, 40),
    }, { source: 'confirmed', evidence, turn, now });
    assignModule(profile, 'actionHistory', {
        entries: clone(actor?.actionHistory || []),
        lastAction: clone(actor?.lastAction || null),
        historicalActionsInvented: false,
    }, { source: 'confirmed', evidence, turn, now });

    const physiologyEnabled = completionMode === 'full_adult';
    assignModule(profile, 'physiology', physiologySeed(actor, {
        adult: physiologyEnabled,
    }), {
        source: physiologyEnabled ? 'designed_seed' : 'confirmed',
        unknownFields: physiologyEnabled
            ? ['exact_anatomy', 'measurements', 'cycles', 'fertility']
            : [],
        evidence,
        turn,
        now,
    });
    if (!moduleLocked(profile, 'physiology')) {
        profile.modules.physiology.data.enabled = physiologyEnabled;
        profile.modules.physiology.data.adultEnabled = physiologyEnabled;
        profile.modules.physiology.data.personalityInferenceAllowed = false;
    }
    for (const [path, overrideValue] of Object.entries(previousProfile.manualOverrides || {})) {
        const parts = pathParts(path);
        if (parts[0] !== 'modules' || !MODULE_SET.has(parts[1])) continue;
        setPath(profile, parts, overrideValue);
        profile.fieldSources[path] = 'confirmed';
    }
    for (const [path, locked] of Object.entries(previousProfile.locks || {})) {
        const parts = pathParts(path);
        if (!locked || parts[0] !== 'modules' || !MODULE_SET.has(parts[1]) || parts.length < 3) {
            continue;
        }
        const preservedValue = getPath(previousProfile, parts);
        if (preservedValue !== undefined) setPath(profile, parts, preservedValue);
    }
    profile.coverage = calculateCoverage(profile);
    profile.preparedForAction = profile.coverage === 100;
    profile.backgroundPending = false;
    const previousComparable = { ...clone(previousProfile), updatedTurn: 0 };
    const currentComparable = { ...clone(profile), updatedTurn: 0 };
    profile.updatedTurn = JSON.stringify(previousComparable) === JSON.stringify(currentComparable)
        ? previousProfile.updatedTurn
        : integer(turn);
    return profile;
}

export function prepareActorLedgerProfilesV6(value, {
    mode = 'full',
    turn = null,
    now = Date.now(),
} = {}) {
    const ledger = value && typeof value === 'object' ? clone(value) : { actors: [] };
    const currentTurn = turn === null || turn === undefined
        ? integer(ledger.turn)
        : integer(turn);
    const prepared = [];
    const deferred = [];
    ledger.actors = (Array.isArray(ledger.actors) ? ledger.actors : []).map((actor) => {
        const next = clone(actor);
        next.profileV6 = prepareActorProfileV6(next, { mode, turn: currentTurn, now });
        const goalData = next.profileV6.modules.goals.data || {};
        if (!cleanList(next.longTermGoals, 12, 400).length) {
            next.longTermGoals = cleanList(goalData.longTerm, 12, 400);
        }
        if (!cleanList(next.currentGoals, 8, 400).length) {
            next.currentGoals = cleanList(goalData.current, 8, 400);
        }
        const seededPlan = goalData.plan && typeof goalData.plan === 'object'
            ? goalData.plan
            : {};
        next.plan = next.plan && typeof next.plan === 'object' ? next.plan : {};
        if (!cleanText(next.plan.summary)) next.plan.summary = cleanText(seededPlan.summary, 500);
        if (!cleanList(next.plan.steps, 12, 300).length) {
            next.plan.steps = cleanList(seededPlan.steps, 12, 300);
        }
        if (!cleanText(next.plan.nextWindow)) {
            next.plan.nextWindow = cleanText(seededPlan.nextWindow, 180);
        }
        for (const key of ['obstacles', 'costs', 'alternatives']) {
            if (!cleanList(next.plan[key], 12, 300).length) {
                next.plan[key] = cleanList(seededPlan[key], 12, 300);
            }
        }
        if (!cleanText(next.plan.priority)) next.plan.priority = cleanText(seededPlan.priority, 40);
        if (!cleanText(next.plan.status)) next.plan.status = 'active';
        if (next.profileV6.preparedForAction) prepared.push(next.id);
        else deferred.push(next.id);
        return next;
    });
    ledger.migrations = { ...(ledger.migrations || {}), actorProfileV6: true };
    return { ledger, prepared, deferred, coverage: ledger.actors.length
        ? Math.round(ledger.actors.reduce((sum, actor) => sum + actor.profileV6.coverage, 0)
            / ledger.actors.length)
        : 100 };
}

export function actorProfileReadyForAction(actor) {
    const profile = normalizeActorProfileV6(actor?.profileV6, {
        actorId: actor?.id,
        name: actor?.name,
    });
    return profile.preparedForAction === true && profile.coverage === 100;
}

function pathParts(path) {
    return String(path || '').split('.').map((part) => cleanText(part, 80)).filter(Boolean);
}

function setPath(object, parts, value) {
    let cursor = object;
    for (let index = 0; index < parts.length - 1; index += 1) {
        const key = parts[index];
        if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[parts.at(-1)] = clone(value);
}

function getPath(object, parts) {
    let cursor = object;
    for (const key of parts) {
        if (!cursor || typeof cursor !== 'object' || !(key in cursor)) return undefined;
        cursor = cursor[key];
    }
    return clone(cursor);
}

function moduleLocked(profile, module) {
    return profile?.locks?.actor === true
        || profile?.locks?.[module] === true
        || profile?.locks?.[`modules.${module}`] === true;
}

export function setActorProfileV6Lock(value, {
    path,
    locked = true,
} = {}) {
    const profile = normalizeActorProfileV6(value);
    const key = pathParts(path).join('.');
    if (!key) return profile;
    profile.locks[key] = locked === true;
    return profile;
}

export function applyActorProfileV6Override(value, {
    path,
    value: overrideValue,
    turn = 0,
    now = Date.now(),
} = {}) {
    const profile = normalizeActorProfileV6(value);
    const parts = pathParts(path);
    const module = parts[0] === 'modules' && MODULE_SET.has(parts[1]) ? parts[1] : '';
    if (
        !parts.length
        || profile.locks.actor
        || (module && moduleLocked(profile, module))
        || profile.locks[parts.join('.')]
    ) {
        return { profile, applied: false, reason: parts.length ? 'field_locked' : 'path_invalid' };
    }
    if (!module) return { profile, applied: false, reason: 'module_invalid' };
    const before = clone(profile.modules[module]);
    setPath(profile, parts, overrideValue);
    profile.manualOverrides[parts.join('.')] = clone(overrideValue);
    profile.fieldSources[parts.join('.')] = 'confirmed';
    profile.moduleVersions[module] += 1;
    profile.modules[module].version += 1;
    profile.modules[module].updatedTurn = integer(turn);
    profile.modules[module].status = 'ready';
    recordHistory(profile, module, 'manual_override', before, profile.modules[module], turn, now);
    profile.coverage = calculateCoverage(profile);
    profile.preparedForAction = profile.coverage === 100;
    profile.updatedTurn = integer(turn);
    return { profile, applied: true };
}

export function regenerateActorProfileV6Module(value, actor, {
    module,
    mode = null,
    turn = 0,
    now = Date.now(),
} = {}) {
    const profile = normalizeActorProfileV6(value, {
        actorId: actor?.id,
        name: actor?.name,
        mode: mode || value?.completionMode,
    });
    if (!MODULE_SET.has(module)) return { profile, regenerated: false, reason: 'module_invalid' };
    if (moduleLocked(profile, module)) {
        return { profile, regenerated: false, reason: 'module_locked' };
    }
    const regenerated = prepareActorProfileV6({ ...clone(actor), profileV6: profile }, {
        mode: mode || profile.completionMode,
        turn,
        now,
    });
    const before = clone(profile.modules[module]);
    profile.modules[module] = clone(regenerated.modules[module]);
    profile.moduleVersions[module] += 1;
    recordHistory(profile, module, 'regenerate', before, profile.modules[module], turn, now);
    profile.coverage = calculateCoverage(profile);
    profile.preparedForAction = profile.coverage === 100;
    profile.updatedTurn = integer(turn);
    return { profile, regenerated: true };
}

export function actorProfileV6View(actor) {
    const profile = normalizeActorProfileV6(actor?.profileV6, {
        actorId: actor?.id,
        name: actor?.name,
    });
    return {
        version: profile.version,
        actorId: profile.actorId,
        name: profile.name,
        completionMode: profile.completionMode,
        preparedForAction: profile.preparedForAction,
        backgroundPending: profile.backgroundPending,
        coverage: profile.coverage,
        moduleStatuses: Object.fromEntries(Object.entries(profile.modules).map(([key, module]) => [
            key,
            {
                status: module.status,
                source: module.source,
                version: module.version,
                unknownFieldCount: module.unknownFields.length,
                locked: profile.locks[key] === true || profile.locks[`modules.${key}`] === true,
            },
        ])),
        historyCount: profile.history.length,
        fieldSourceCount: Object.keys(profile.fieldSources).length,
        hasActionPlan: moduleReady(profile, 'goals'),
        physiologyEnabled: profile.modules.physiology.data.enabled === true,
        adultPhysiologyEnabled: profile.modules.physiology.data.adultEnabled === true,
        physiologyInfersPersonality: false,
    };
}
