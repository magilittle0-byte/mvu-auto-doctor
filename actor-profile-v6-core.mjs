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

function seedIndex(actor, salt, length) {
    const identity = `${actor?.id || ''}|${actor?.name || 'actor'}`;
    const characterSum = [...identity].reduce(
        (sum, character, index) => sum + character.codePointAt(0) * (index + 1),
        0,
    );
    const value = Number.parseInt(fingerprint(`${identity}|${salt}`).slice(0, 8), 16);
    return (characterSum + value) % length;
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

function moduleSource(data, designed) {
    return Object.values(data || {}).some(hasText) && !designed
        ? 'confirmed'
        : designed
            ? 'designed_seed'
            : 'confirmed';
}

function physiologySeed(actor, { adult = false } = {}) {
    const species = cleanText(actor?.profileV6?.modules?.identity?.data?.species, 120)
        || '沿用已确认物种；未确认部分保持开放';
    return normalizePhysiology({
        enabled: true,
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

function assignModule(profile, module, data, {
    source = 'confirmed',
    unknownFields = [],
    evidence = [],
    turn = 0,
    now = Date.now(),
    action = 'prepare',
} = {}) {
    if (moduleLocked(profile, module)) return false;
    const before = clone(profile.modules[module]);
    profile.modules[module] = {
        status: 'ready',
        source: sourceOf(source),
        data: clone(data),
        unknownFields: cleanList(unknownFields, 64, 160),
        version: profile.modules[module].version + 1,
        updatedTurn: integer(turn),
        evidence: cleanList(evidence, 16, 300),
    };
    profile.moduleVersions[module] += 1;
    recordHistory(profile, module, action, before, profile.modules[module], turn, now);
    return true;
}

function calculateCoverage(profile) {
    const required = ACTOR_PROFILE_MODULES.filter((module) => (
        module !== 'physiology' || profile.modules.physiology.data.enabled
    ));
    const ready = required.filter((module) => profile.modules[module].status === 'ready').length;
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
    if (full && !hasConfirmedPersonality) {
        personality.traits = ['能维持普通日常', '会根据关系和处境调整表达'];
        personality.desires = ['保留可支配时间与现实安全', '让重要关系保持可持续'];
        personality.boundaries = ['不替他人作不可撤回的决定', '不把一次冲突升级为永久敌意'];
        personality.socialStyle = SOCIAL_SEEDS[seedIndex(actor, 'social', SOCIAL_SEEDS.length)];
        personality.decisionStyle = DECISION_SEEDS[seedIndex(actor, 'decision', DECISION_SEEDS.length)];
        personality.speechStyle = SPEECH_SEEDS[seedIndex(actor, 'speech', SPEECH_SEEDS.length)];
        personality.copingStyle = '压力上升时先缩小任务范围，再通过可验证的小步骤恢复掌控';
        personality.pressureResponse = '可能变得简短或谨慎，但不会因此自动残酷、疯癫或绝望';
        personality.recoveryPath = '通过休息、可信反馈、完成小承诺和恢复日常节奏逐步回稳';
        personality.everydayHabits = ['保留一项不服务于主线的日常习惯', '定期检查承诺与资源'];
        personality.blindSpots = ['可能高估自己对熟悉局面的判断'];
    }
    assignModule(profile, 'personality', personality, {
        source: moduleSource(personality, full && !hasConfirmedPersonality),
        evidence,
        turn,
        now,
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
    assignModule(profile, 'goals', {
        longTerm: cleanList(actor?.longTermGoals, 12, 400),
        current: cleanList(actor?.currentGoals, 8, 400),
        priority: cleanText(actor?.plan?.priority, 40) || (full ? 'normal' : ''),
        plan: clone(actor?.plan || {}),
        nextWindow: cleanText(actor?.plan?.nextWindow, 180),
        deadlineTurn: integer(actor?.deadlineTurn),
        commitments: clone(actor?.commitments || []),
        obstacles: cleanList(actor?.plan?.obstacles, 12, 300),
        costs: cleanList(actor?.plan?.costs, 12, 300),
        alternatives: cleanList(actor?.plan?.alternatives, 12, 300),
    }, {
        source: actor?.longTermGoals?.length || actor?.currentGoals?.length || actor?.plan?.summary
            ? 'confirmed'
            : full ? 'designed_seed' : 'hypothesis',
        unknownFields: actor?.longTermGoals?.length || actor?.currentGoals?.length
            ? []
            : ['personal_goal_details'],
        evidence,
        turn,
        now,
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
    profile.updatedTurn = integer(turn);
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
        physiologyEnabled: profile.modules.physiology.data.enabled === true,
        adultPhysiologyEnabled: profile.modules.physiology.data.adultEnabled === true,
        physiologyInfersPersonality: false,
    };
}
