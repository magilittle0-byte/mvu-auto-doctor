import {
    addIssue,
    deepClone,
    isPlainObject,
    normalizeEvidenceList,
    requireEnum,
    requireFiniteNumber,
    requirePlainObject,
    requireString,
    validateEvidenceList,
    validationResult,
} from '../domain/common.mjs';
import {
    compareMessageFingerprints,
    hashCanonical,
    normalizeMessageFingerprint,
    pointerSegments,
    validateBranch,
    validateMessageFingerprint,
} from '../transaction/index.mjs';

export const DOMAIN_COMMAND_VERSION = '2.0-phase4';

export const DOMAIN_COMMAND_TYPES = Object.freeze([
    'item-use',
    'equipment-equip',
    'equipment-unequip',
    'equipment-transfer',
    'skill-use',
    'social-transition',
    'quest-transition',
    'quest-supersede',
    'fact-candidate',
    'fact-confirm',
    'cost',
    'check',
    'new-branch',
]);

const PHASE3_COMMAND_TYPES = new Set([
    'fact-candidate',
    'fact-confirm',
    'cost',
    'check',
    'new-branch',
]);

const AUTHORIZATION_KINDS = Object.freeze({
    'item-use': ['resource-consumption'],
    'equipment-equip': ['action', 'state-change'],
    'equipment-unequip': ['action', 'state-change'],
    'equipment-transfer': ['action', 'state-change'],
    'skill-use': ['skill-use'],
    'social-transition': ['state-change'],
    'quest-transition': ['decision', 'state-change'],
    'quest-supersede': ['decision', 'state-change'],
});

function trimString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizePointer(value) {
    return trimString(value);
}

function validPointer(value) {
    return Boolean(pointerSegments(value)?.length);
}

export function resourceKey(resource) {
    return `${String(resource?.ownerId ?? '')}\u0000${String(resource?.resourceId ?? '')}`;
}

export function slotKey(slot) {
    return hashCanonical({
        system: slot?.system,
        slot: slot?.slot,
        ...(slot?.layer === undefined ? {} : { layer: slot.layer }),
    });
}

function normalizeResourceBinding(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        resource: {
            ownerId: trimString(source.resource?.ownerId),
            resourceId: trimString(source.resource?.resourceId),
        },
        path: normalizePointer(source.path),
        minimum: source.minimum ?? 0,
        ...(Object.hasOwn(source, 'maximum') ? { maximum: source.maximum } : {}),
    };
}

function normalizeSlot(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        system: trimString(source.system),
        slot: trimString(source.slot),
        ...(Object.hasOwn(source, 'layer') ? { layer: trimString(source.layer) } : {}),
    };
}

function normalizeSlotBinding(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        slot: normalizeSlot(source.slot),
        path: normalizePointer(source.path),
    };
}

function normalizeCheck(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        checkId: trimString(source.checkId),
        ...(Object.hasOwn(source, 'difficultySchema')
            ? { difficultySchema: deepClone(source.difficultySchema) }
            : {}),
    };
}

function normalizeRecordBindings(value) {
    if (!isPlainObject(value)) return {};
    return Object.fromEntries(
        Object.entries(value).map(([kind, entries]) => [
            kind,
            isPlainObject(entries)
                ? Object.fromEntries(
                    Object.entries(entries).map(([id, path]) => [
                        String(id),
                        normalizePointer(path),
                    ]),
                )
                : entries,
        ]),
    );
}

function normalizeEffectBindings(value) {
    if (!isPlainObject(value)) return {};
    return Object.fromEntries(
        Object.entries(value).map(([key, path]) => [
            String(key),
            normalizePointer(path),
        ]),
    );
}

export function normalizeCampaignDomainConfig(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        id: trimString(source.id),
        version: trimString(source.version),
        branchId: trimString(source.branchId),
        slotTaxonomy: Array.isArray(source.slotTaxonomy)
            ? source.slotTaxonomy.map(normalizeSlot)
            : [],
        slotBindings: Array.isArray(source.slotBindings)
            ? source.slotBindings.map(normalizeSlotBinding)
            : [],
        resources: Array.isArray(source.resources)
            ? source.resources.map(normalizeResourceBinding)
            : [],
        checks: Array.isArray(source.checks)
            ? source.checks.map(normalizeCheck)
            : [],
        records: normalizeRecordBindings(source.records),
        effectBindings: normalizeEffectBindings(source.effectBindings),
        ...(Object.hasOwn(source, 'extensions')
            ? { extensions: deepClone(source.extensions) }
            : {}),
    };
}

function validateUnique(values, issues, path, code, message) {
    if (new Set(values).size !== values.length) {
        addIssue(issues, code, path, message);
    }
}

export function validateCampaignDomainConfig(input, {
    branchId,
} = {}) {
    const value = normalizeCampaignDomainConfig(input);
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(value, issues);
    requireString(value.id, issues, '$.campaign.id');
    requireString(value.version, issues, '$.campaign.version');
    requireString(value.branchId, issues, '$.campaign.branchId');
    if (branchId !== undefined && value.branchId !== branchId) {
        addIssue(
            issues,
            'domain.config_branch_mismatch',
            '$.campaign.branchId',
            '战役配置必须与当前 active 分支显式一致。',
        );
    }

    const slotIds = [];
    value.slotTaxonomy.forEach((slot, index) => {
        const path = `$.campaign.slotTaxonomy[${index}]`;
        requireString(slot.system, issues, `${path}.system`);
        requireString(slot.slot, issues, `${path}.slot`);
        if (slot.layer !== undefined) requireString(slot.layer, issues, `${path}.layer`);
        slotIds.push(slotKey(slot));
    });
    validateUnique(
        slotIds,
        issues,
        '$.campaign.slotTaxonomy',
        'domain.config_slot_duplicate',
        '战役槽位合同不能包含重复 SlotRef。',
    );

    const boundSlots = [];
    value.slotBindings.forEach((binding, index) => {
        const path = `$.campaign.slotBindings[${index}]`;
        requireString(binding.slot.system, issues, `${path}.slot.system`);
        requireString(binding.slot.slot, issues, `${path}.slot.slot`);
        if (binding.slot.layer !== undefined) {
            requireString(binding.slot.layer, issues, `${path}.slot.layer`);
        }
        if (!validPointer(binding.path)) {
            addIssue(
                issues,
                'domain.config_pointer',
                `${path}.path`,
                '领域绑定必须是非根 JSON Pointer。',
            );
        }
        const key = slotKey(binding.slot);
        boundSlots.push(key);
        if (!slotIds.includes(key)) {
            addIssue(
                issues,
                'domain.config_slot_unregistered',
                `${path}.slot`,
                '槽位写入绑定必须引用战役显式注册的 SlotRef。',
                'unresolved',
            );
        }
    });
    validateUnique(
        boundSlots,
        issues,
        '$.campaign.slotBindings',
        'domain.config_slot_binding_duplicate',
        '同一槽位只能有一个精确写入路径。',
    );

    const resourceIds = [];
    value.resources.forEach((binding, index) => {
        const path = `$.campaign.resources[${index}]`;
        requireString(binding.resource.ownerId, issues, `${path}.resource.ownerId`);
        requireString(binding.resource.resourceId, issues, `${path}.resource.resourceId`);
        if (!validPointer(binding.path)) {
            addIssue(
                issues,
                'domain.config_pointer',
                `${path}.path`,
                '资源绑定必须是非根 JSON Pointer。',
            );
        }
        requireFiniteNumber(binding.minimum, issues, `${path}.minimum`, {
            code: 'domain.config_resource_minimum',
        });
        if (binding.maximum !== undefined) {
            requireFiniteNumber(binding.maximum, issues, `${path}.maximum`, {
                code: 'domain.config_resource_maximum',
            });
            if (
                typeof binding.minimum === 'number'
                && typeof binding.maximum === 'number'
                && binding.maximum < binding.minimum
            ) {
                addIssue(
                    issues,
                    'domain.config_resource_range',
                    path,
                    '资源最大值不能小于最小值。',
                );
            }
        }
        resourceIds.push(resourceKey(binding.resource));
    });
    validateUnique(
        resourceIds,
        issues,
        '$.campaign.resources',
        'domain.config_resource_duplicate',
        '同一 ownerId/resourceId 只能有一个资源绑定。',
    );

    const checkIds = [];
    value.checks.forEach((check, index) => {
        requireString(check.checkId, issues, `$.campaign.checks[${index}].checkId`);
        checkIds.push(check.checkId);
    });
    validateUnique(
        checkIds,
        issues,
        '$.campaign.checks',
        'domain.config_check_duplicate',
        '检定注册表不能包含重复 checkId。',
    );

    if (!requirePlainObject(value.records, issues, '$.campaign.records')) {
        return validationResult(value, issues);
    }
    for (const [kind, entries] of Object.entries(value.records)) {
        const path = `$.campaign.records.${kind}`;
        if (!requirePlainObject(entries, issues, path)) continue;
        for (const [id, pointer] of Object.entries(entries)) {
            requireString(id, issues, `${path}.${id}`);
            if (!validPointer(pointer)) {
                addIssue(
                    issues,
                    'domain.config_pointer',
                    `${path}.${id}`,
                    '记录绑定必须是非根 JSON Pointer。',
                );
            }
        }
    }
    for (const [key, pointer] of Object.entries(value.effectBindings)) {
        requireString(key, issues, `$.campaign.effectBindings.${key}`);
        if (!validPointer(pointer)) {
            addIssue(
                issues,
                'domain.config_pointer',
                `$.campaign.effectBindings.${key}`,
                '扩展效果绑定必须是非根 JSON Pointer。',
            );
        }
    }

    const allPaths = [
        ...value.resources.map((entry) => entry.path),
        ...value.slotBindings.map((entry) => entry.path),
        ...Object.values(value.records).flatMap((entries) => (
            isPlainObject(entries) ? Object.values(entries) : []
        )),
        ...Object.values(value.effectBindings),
    ].filter(Boolean);
    validateUnique(
        allPaths,
        issues,
        '$.campaign',
        'domain.config_path_duplicate',
        '战役配置不能把两个硬字段绑定到同一写入路径。',
    );
    return validationResult(value, issues);
}

function commandInAdjudication(sourceResult, command) {
    if (
        sourceResult?.ok !== true
        || sourceResult?.status !== 'valid'
        || !Array.isArray(sourceResult?.adjudication?.commands)
    ) {
        return false;
    }
    const digest = hashCanonical(command);
    return sourceResult.adjudication.commands.some((entry) => (
        hashCanonical(entry) === digest
    ));
}

function authorizationInBoundary(sourceResult, command, target, issues) {
    if (
        sourceResult?.ok !== true
        || sourceResult?.validationStatus !== 'valid'
        || sourceResult?.decision !== 'accept'
    ) {
        return false;
    }
    const boundaryTarget = sourceResult.boundary?.target;
    const compared = compareMessageFingerprints(target, boundaryTarget);
    issues.push(...compared.issues);
    if (
        sourceResult.boundary?.branchId !== target.branchId
        || !compared.ok
    ) {
        addIssue(
            issues,
            'domain.command_boundary_target_mismatch',
            '$.sourceResult.boundary',
            '阶段3 Turn Boundary、领域命令目标与 active Branch 必须逐字段一致。',
        );
        return false;
    }
    const authorizationId = command?.payload?.authorizationId;
    if (!authorizationId) {
        addIssue(
            issues,
            'domain.command_authorization_missing',
            '$.command.payload.authorizationId',
            '领域命令必须引用阶段3已接受的明确玩家授权。',
            'unresolved',
        );
        return false;
    }
    const authorization = sourceResult.boundary?.authorizations?.find(
        (entry) => entry.id === authorizationId,
    );
    const allowedKinds = AUTHORIZATION_KINDS[command.type] ?? [];
    if (!authorization || !allowedKinds.includes(authorization.kind)) {
        addIssue(
            issues,
            'domain.command_authorization_mismatch',
            '$.sourceResult.boundary.authorizations',
            '领域命令与阶段3授权类型不匹配。',
        );
        return false;
    }
    return true;
}

export function validateDirectorDomainCommand(input) {
    const source = isPlainObject(input) ? input : {};
    const command = isPlainObject(source.command)
        ? {
            type: trimString(source.command.type),
            payload: isPlainObject(source.command.payload)
                ? deepClone(source.command.payload)
                : source.command.payload,
        }
        : source.command;
    const target = normalizeMessageFingerprint(source.target);
    const evidence = normalizeEvidenceList(source.evidence);
    const issues = [];
    if (!requirePlainObject(input, issues)) {
        return validationResult({ command, target, evidence }, issues);
    }
    if (requirePlainObject(command, issues, '$.command')) {
        requireEnum(
            command.type,
            DOMAIN_COMMAND_TYPES,
            issues,
            '$.command.type',
            'domain.command_type',
        );
        requirePlainObject(command.payload, issues, '$.command.payload');
    }
    const targetResult = validateMessageFingerprint(target, '$.target');
    issues.push(...targetResult.issues);
    const branchResult = validateBranch(source.activeBranch);
    issues.push(...branchResult.issues);
    if (
        branchResult.ok
        && (
            branchResult.value.status !== 'active'
            || branchResult.value.id !== target.branchId
        )
    ) {
        addIssue(
            issues,
            'domain.command_branch_stale',
            '$.activeBranch',
            '领域命令必须绑定当前 active Branch。',
        );
    }
    if (source.currentFingerprint !== undefined) {
        const compared = compareMessageFingerprints(target, source.currentFingerprint);
        issues.push(...compared.issues);
        if (!compared.ok) {
            addIssue(
                issues,
                'domain.command_target_stale',
                '$.target',
                '领域命令的完整 MessageFingerprint 已过期。',
            );
        }
    }
    validateEvidenceList(evidence, issues, '$.evidence', { minItems: 1 });
    evidence.forEach((entry, index) => {
        if (entry.branchId !== target.branchId) {
            addIssue(
                issues,
                'domain.command_evidence_branch',
                `$.evidence[${index}].branchId`,
                '命令证据必须属于同一分支。',
            );
        }
    });

    if (PHASE3_COMMAND_TYPES.has(command?.type)) {
        if (!commandInAdjudication(source.sourceResult, command)) {
            addIssue(
                issues,
                'domain.command_not_validated_by_director',
                '$.sourceResult',
                '阶段3命令必须来自 status=valid 的真实 DirectorClaimResult。',
            );
        }
    } else if (!authorizationInBoundary(
        source.sourceResult,
        command,
        target,
        issues,
    )) {
        addIssue(
            issues,
            'domain.command_not_validated_by_boundary',
            '$.sourceResult',
            '领域动作必须来自阶段3已接受的 Turn Boundary。',
        );
    }

    const payloadBranchId = command?.payload?.branchId;
    if (payloadBranchId !== undefined && payloadBranchId !== target.branchId) {
        addIssue(
            issues,
            'domain.command_payload_branch',
            '$.command.payload.branchId',
            '命令 payload、目标消息与 active Branch 必须一致。',
        );
    }
    if (command?.payload?.target !== undefined) {
        const compared = compareMessageFingerprints(target, command.payload.target);
        issues.push(...compared.issues);
        if (!compared.ok) {
            addIssue(
                issues,
                'domain.command_payload_target',
                '$.command.payload.target',
                '命令 payload 中的目标指纹必须逐字段一致。',
            );
        }
    }
    if (
        !PHASE3_COMMAND_TYPES.has(command?.type)
        && command?.payload?.commandVersion !== DOMAIN_COMMAND_VERSION
    ) {
        addIssue(
            issues,
            'domain.command_version',
            '$.command.payload.commandVersion',
            `阶段4领域命令版本必须是 ${DOMAIN_COMMAND_VERSION}。`,
        );
    }

    return validationResult({
        command,
        target,
        activeBranch: branchResult.value,
        evidence,
        sourceResult: deepClone(source.sourceResult),
        validationKind: 'director-domain-command',
    }, issues);
}
