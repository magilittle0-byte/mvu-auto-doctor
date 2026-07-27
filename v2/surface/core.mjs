import {
    addIssue,
    deepClone,
    isPlainObject,
    validationResult,
} from '../domain/index.mjs';
import {
    adjudicateTurnBoundary,
    validateTurnBoundary,
} from '../director/index.mjs';
import {
    hashCanonical,
} from '../transaction/index.mjs';
import {
    DOMAIN_COMMAND_VERSION,
    planDirectorDomainTransaction,
    validateDirectorDomainCommand,
} from '../domain-transaction/index.mjs';

export const DUAL_SURFACE_VERSION = '2.0-phase5';

export const DUAL_SURFACE_SOURCES = Object.freeze([
    'natural-language',
    'ui',
]);

export const DUAL_SURFACE_VISIBILITY = Object.freeze([
    'immersive',
    'audit',
    'debug',
]);

const DOMAIN_COMMAND_TYPE_SET = new Set([
    'item-use',
    'equipment-equip',
    'equipment-unequip',
    'equipment-transfer',
    'skill-use',
    'social-transition',
    'quest-transition',
    'quest-supersede',
]);

const RESERVED_PAYLOAD_KEYS = new Set([
    'authorizationId',
    'branchId',
    'commandVersion',
    'source',
    'sourceText',
    'target',
]);

const AUTHORIZATION_KIND_BY_COMMAND = Object.freeze({
    'item-use': 'resource-consumption',
    'equipment-equip': 'state-change',
    'equipment-unequip': 'state-change',
    'equipment-transfer': 'state-change',
    'skill-use': 'skill-use',
    'social-transition': 'state-change',
    'quest-transition': 'decision',
    'quest-supersede': 'decision',
});

const CONFIRMATION_REQUIRED_TYPES = new Set([
    'item-use',
    'equipment-equip',
    'equipment-unequip',
    'equipment-transfer',
    'skill-use',
    'social-transition',
    'quest-transition',
    'quest-supersede',
]);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

export function normalizeNaturalLanguageText(value) {
    return typeof value === 'string'
        ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
        : '';
}

function compactList(value) {
    return Array.isArray(value)
        ? [...new Set(value.map((entry) => trimString(entry)).filter(Boolean))]
        : [];
}

function normalizeCatalogEntry(value) {
    const source = isPlainObject(value) ? value : {};
    const command = isPlainObject(source.command) ? source.command : {};
    const payload = isPlainObject(command.payload) ? command.payload : {};
    return {
        id: trimString(source.id),
        label: trimString(source.label),
        utterances: compactList(source.utterances).map(normalizeNaturalLanguageText),
        authorizationId: trimString(source.authorizationId),
        actorId: trimString(source.actorId) || 'player',
        command: {
            type: trimString(command.type),
            payload: deepClone(payload),
        },
        ...(Object.hasOwn(source, 'description')
            ? { description: trimString(source.description) }
            : {}),
        ...(Object.hasOwn(source, 'extensions')
            ? { extensions: deepClone(source.extensions) }
            : {}),
    };
}

export function normalizeSurfaceActionCatalog(value) {
    return Array.isArray(value) ? value.map(normalizeCatalogEntry) : [];
}

export function validateSurfaceActionCatalog(value) {
    const catalog = normalizeSurfaceActionCatalog(value);
    const issues = [];
    if (!Array.isArray(value)) {
        addIssue(
            issues,
            'surface.catalog_type',
            '$.catalog',
            '阶段5动作目录必须是数组。',
        );
        return validationResult(catalog, issues);
    }
    const ids = new Set();
    const utteranceOwners = new Map();
    catalog.forEach((entry, index) => {
        const path = `$.catalog[${index}]`;
        if (!entry.id) {
            addIssue(issues, 'surface.action_id', `${path}.id`, '动作必须有稳定ID。');
        } else if (ids.has(entry.id)) {
            addIssue(
                issues,
                'surface.action_id_duplicate',
                `${path}.id`,
                '动作目录不能包含重复ID。',
            );
        } else {
            ids.add(entry.id);
        }
        if (!entry.label) {
            addIssue(
                issues,
                'surface.action_label',
                `${path}.label`,
                '动作必须有可见标签。',
            );
        }
        if (!DOMAIN_COMMAND_TYPE_SET.has(entry.command.type)) {
            addIssue(
                issues,
                'surface.command_type',
                `${path}.command.type`,
                '动作目录引用了未知领域命令。',
            );
        }
        if (!isPlainObject(entry.command.payload)) {
            addIssue(
                issues,
                'surface.command_payload',
                `${path}.command.payload`,
                '动作 payload 必须是普通对象。',
            );
        }
        for (const key of Object.keys(entry.command.payload)) {
            if (RESERVED_PAYLOAD_KEYS.has(key)) {
                addIssue(
                    issues,
                    'surface.reserved_payload_key',
                    `${path}.command.payload.${key}`,
                    `动作目录不得预填保留字段 ${key}。`,
                );
            }
        }
        if (!entry.authorizationId) {
            addIssue(
                issues,
                'surface.authorization_missing',
                `${path}.authorizationId`,
                '动作必须引用阶段3 Turn Boundary 的明确授权。',
                'unresolved',
            );
        }
        entry.utterances.forEach((utterance, utteranceIndex) => {
            if (!utterance) {
                addIssue(
                    issues,
                    'surface.utterance_empty',
                    `${path}.utterances[${utteranceIndex}]`,
                    '自然语言表达不能为空。',
                );
                return;
            }
            const owners = utteranceOwners.get(utterance) ?? [];
            owners.push(entry.id);
            utteranceOwners.set(utterance, owners);
        });
    });
    for (const [utterance, owners] of utteranceOwners.entries()) {
        if (new Set(owners).size > 1) {
            addIssue(
                issues,
                'surface.utterance_ambiguous',
                '$.catalog',
                '同一自然语言表达映射到多个动作；必须由调用方消除歧义。',
                'unresolved',
                {
                    utteranceDigest: hashCanonical(utterance),
                    actionIds: owners,
                },
            );
        }
    }
    return validationResult(catalog, issues);
}

function candidateFromEntry(entry, target, source) {
    const command = {
        type: entry.command.type,
        payload: {
            commandVersion: DOMAIN_COMMAND_VERSION,
            branchId: target?.branchId,
            authorizationId: entry.authorizationId,
            ...deepClone(entry.command.payload),
        },
    };
    const confirmationDigest = hashCanonical({
        version: DUAL_SURFACE_VERSION,
        actionId: entry.id,
        command,
        target: {
            branchId: target?.branchId,
            logicalIndex: target?.logicalIndex,
            swipeId: target?.swipeId,
            generation: target?.generation,
            parentHash: target?.parentHash,
            contentHash: target?.contentHash,
        },
    });
    return {
        version: DUAL_SURFACE_VERSION,
        actionId: entry.id,
        label: entry.label,
        command,
        authorizationKind: AUTHORIZATION_KIND_BY_COMMAND[entry.command.type],
        actorId: entry.actorId,
        commandDigest: hashCanonical(command),
        confirmation: {
            required: CONFIRMATION_REQUIRED_TYPES.has(entry.command.type),
            digest: confirmationDigest,
            confirmed: false,
        },
        source: {
            kind: source.kind,
            resolution: source.resolution,
            inputDigest: source.inputDigest,
            inputLength: source.inputLength,
        },
    };
}

function adapterResult({
    catalog: catalogInput,
    target,
    source,
    actionId,
    utterance,
    semanticBasis = [],
}) {
    const catalogResult = validateSurfaceActionCatalog(catalogInput);
    const issues = [...catalogResult.issues];
    const normalizedUtterance = normalizeNaturalLanguageText(utterance);
    let matches = [];
    let resolution = 'registered-action';
    if (source === 'ui') {
        matches = catalogResult.value.filter((entry) => entry.id === actionId);
        resolution = 'ui-action-id';
    } else if (actionId) {
        if (!Array.isArray(semanticBasis) || semanticBasis.length === 0) {
            addIssue(
                issues,
                'surface.semantic_basis_missing',
                '$.intent.semanticBasis',
                '自然语言语义适配必须给出有界结构依据；不能让解析器成为唯一硬边界。',
                'unresolved',
            );
        }
        matches = catalogResult.value.filter((entry) => entry.id === actionId);
        resolution = 'bounded-semantic-intent';
    } else {
        matches = catalogResult.value.filter((entry) => (
            entry.utterances.includes(normalizedUtterance)
        ));
        resolution = 'registered-exact-utterance';
    }
    if (!matches.length) {
        addIssue(
            issues,
            'surface.action_unresolved',
            source === 'ui' ? '$.ui.actionId' : '$.intent',
            '没有唯一动作映射；请使用可见控件或补充显式语义槽位。',
            'unresolved',
        );
    }
    if (matches.length > 1) {
        addIssue(
            issues,
            'surface.action_ambiguous',
            '$.intent',
            '自然语言同时匹配多个动作，不能猜测目标。',
            'unresolved',
        );
    }
    const entry = matches.length === 1 ? matches[0] : null;
    const sourceText = source === 'ui'
        ? String(actionId ?? '')
        : String(utterance ?? '');
    const sourceMeta = {
        kind: source,
        resolution,
        inputDigest: hashCanonical(sourceText),
        inputLength: sourceText.length,
    };
    const candidate = entry
        ? candidateFromEntry(entry, target, sourceMeta)
        : {
            version: DUAL_SURFACE_VERSION,
            actionId: '',
            label: '',
            command: null,
            commandDigest: '',
            confirmation: {
                required: false,
                digest: '',
                confirmed: false,
            },
            source: sourceMeta,
        };
    return validationResult(candidate, issues);
}

export function adaptNaturalLanguageIntent({
    intent,
    catalog,
    target,
} = {}) {
    const source = isPlainObject(intent) ? intent : {};
    return adapterResult({
        catalog,
        target,
        source: 'natural-language',
        actionId: trimString(source.actionId),
        utterance: source.text,
        semanticBasis: source.semanticBasis,
    });
}

export function adaptUiAction({
    action,
    catalog,
    target,
} = {}) {
    const source = isPlainObject(action) ? action : {};
    return adapterResult({
        catalog,
        target,
        source: 'ui',
        actionId: trimString(source.actionId),
        utterance: '',
    });
}

function confirmationIssues(candidate, confirmation) {
    const issues = [];
    if (!candidate?.confirmation?.required) return issues;
    if (
        confirmation?.confirmed !== true
        || confirmation?.digest !== candidate.confirmation.digest
    ) {
        addIssue(
            issues,
            'surface.confirmation_required',
            '$.confirmation',
            '该动作会改变领域状态；必须确认与当前目标绑定的精确预览。',
            'unresolved',
        );
    }
    return issues;
}

function surfaceContribution(candidate) {
    return {
        id: `surface:${candidate.commandDigest.slice(0, 24)}`,
        actor: 'player',
        actorId: candidate.actorId,
        kind: candidate.authorizationKind,
        source: 'player-input',
        authorizationId: candidate.command.payload.authorizationId,
    };
}

function baseResolutionValue(candidate, decision, extra = {}) {
    return {
        version: DUAL_SURFACE_VERSION,
        decision,
        candidate: deepClone(candidate),
        director: null,
        validatedCommand: null,
        plan: null,
        ...extra,
    };
}

export function planDualSurfaceDomainAction(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const sourceKind = source.source?.kind;
    let adapted;
    if (sourceKind === 'natural-language') {
        adapted = adaptNaturalLanguageIntent({
            intent: source.source,
            catalog: source.catalog,
            target: source.target,
        });
    } else if (sourceKind === 'ui') {
        adapted = adaptUiAction({
            action: source.source,
            catalog: source.catalog,
            target: source.target,
        });
    } else {
        const issues = [];
        addIssue(
            issues,
            'surface.source_kind',
            '$.source.kind',
            '入口必须显式为 natural-language 或 ui。',
        );
        adapted = validationResult(null, issues);
    }
    if (!adapted.ok || !adapted.value?.command) {
        return validationResult(
            baseResolutionValue(adapted.value, 'reject'),
            adapted.issues,
        );
    }

    const candidate = deepClone(adapted.value);
    const confirmation = confirmationIssues(candidate, source.confirmation);
    if (confirmation.length) {
        return validationResult(
            baseResolutionValue(candidate, 'confirmation-required'),
            confirmation,
        );
    }
    candidate.confirmation.confirmed = true;

    const boundary = validateTurnBoundary(source.turnBoundary);
    if (!boundary.ok) {
        return validationResult(
            baseResolutionValue(candidate, 'reject'),
            boundary.issues,
        );
    }
    const director = adjudicateTurnBoundary(
        boundary.value,
        {
            contributions: [surfaceContribution(candidate)],
            ...(source.riskRecall ? { riskRecall: source.riskRecall } : {}),
        },
        {
            currentFingerprint: source.currentFingerprint ?? source.target,
            activeBranch: source.activeBranch,
        },
    );
    const validatedCommand = validateDirectorDomainCommand({
        command: candidate.command,
        target: source.target,
        currentFingerprint: source.currentFingerprint ?? source.target,
        activeBranch: source.activeBranch,
        sourceResult: director,
        evidence: source.evidence,
    });
    const plan = planDirectorDomainTransaction({
        validatedCommand,
        campaign: source.campaign,
        state: source.state,
        createdAt: source.createdAt,
    });
    const issues = [
        ...adapted.issues,
        ...boundary.issues,
        ...(director.issues ?? []),
        ...validatedCommand.issues,
        ...plan.issues,
    ];
    return validationResult(
        {
            version: DUAL_SURFACE_VERSION,
            decision: plan.value?.decision ?? 'reject',
            candidate,
            director: deepClone(director),
            validatedCommand,
            plan,
        },
        issues,
    );
}

function comparableResolution(result) {
    const value = result?.value ?? {};
    const plan = value.plan?.value ?? {};
    return {
        command: value.candidate?.command,
        confirmationDigest: value.candidate?.confirmation?.digest,
        decision: value.decision,
        idempotencyKey: plan.idempotencyKey,
        writePlan: plan.writePlan,
        preconditions: plan.transaction?.preconditions,
        transaction: plan.transaction,
    };
}

export function compareDualSurfaceParity(naturalResult, uiResult) {
    const issues = [];
    if (naturalResult?.status !== 'valid' || uiResult?.status !== 'valid') {
        addIssue(
            issues,
            'surface.parity_inputs_invalid',
            '$',
            '双入口只有在两侧都通过全部导演、领域和事务门后才能比较。',
        );
    }
    const natural = comparableResolution(naturalResult);
    const ui = comparableResolution(uiResult);
    const fields = [
        'command',
        'confirmationDigest',
        'decision',
        'idempotencyKey',
        'writePlan',
        'preconditions',
        'transaction',
    ];
    for (const field of fields) {
        if (hashCanonical(natural[field]) !== hashCanonical(ui[field])) {
            addIssue(
                issues,
                'surface.parity_mismatch',
                `$.${field}`,
                `自然语言与UI的 ${field} 不等价。`,
            );
        }
    }
    return validationResult({
        equivalent: issues.length === 0,
        canonicalDigest: hashCanonical(natural),
        natural,
        ui,
    }, issues);
}
