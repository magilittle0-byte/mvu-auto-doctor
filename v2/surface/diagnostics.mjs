import {
    hashCanonical,
} from '../transaction/index.mjs';
import {
    DUAL_SURFACE_VISIBILITY,
} from './core.mjs';

function shortHash(value) {
    try {
        return hashCanonical(value).slice(0, 16);
    } catch {
        return 'unavailable';
    }
}

function redactDiagnosticText(value) {
    return String(value ?? '')
        .replace(/Bearer\s+\S+/giu, '[凭据已隐藏]')
        .replace(/\b(?:sk|ghp|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/gu, '[凭据已隐藏]')
        .replace(/(?:api[_ -]?key|token|password|secret)\s*[:=]\s*\S+/giu, '[敏感配置已隐藏]')
        .replace(/[A-Za-z]:\\Users\\[^\\\s]+/giu, '[本机路径已隐藏]')
        .replace(/https?:\/\/[^\s)]+/giu, '[地址已隐藏]')
        .slice(0, 240);
}

function safeIssue(issue) {
    return {
        code: String(issue?.code ?? 'unknown'),
        path: String(issue?.path ?? '$').slice(0, 180),
        severity: ['warning', 'unresolved', 'error'].includes(issue?.severity)
            ? issue.severity
            : 'error',
        message: redactDiagnosticText(issue?.message),
    };
}

function safeEvidence(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const kinds = [...new Set(
        list.map((entry) => redactDiagnosticText(entry?.kind)).filter(Boolean),
    )];
    return {
        count: list.length,
        kinds,
        references: list.map((entry) => ({
            kind: redactDiagnosticText(entry?.kind ?? 'unknown'),
            refDigest: shortHash(entry?.ref),
            branchDigest: shortHash(entry?.branchId),
        })),
    };
}

function safeMigration(entry) {
    return {
        idDigest: shortHash(entry?.id),
        kind: redactDiagnosticText(entry?.kind ?? 'unknown'),
        status: redactDiagnosticText(entry?.status ?? 'pending'),
        visibility: redactDiagnosticText(entry?.visibility ?? 'lazy-not-read'),
        canTransact: entry?.canTransact === true,
        issues: (entry?.issues ?? []).map(safeIssue),
        warningCount: Array.isArray(entry?.warnings) ? entry.warnings.length : 0,
    };
}

function safeTransaction(resolution, visibility) {
    const plan = resolution?.value?.plan?.value;
    const transaction = plan?.transaction;
    if (!transaction) {
        return {
            available: false,
            decision: plan?.decision ?? resolution?.value?.decision ?? 'pending',
            issueCount: resolution?.issues?.length ?? 0,
        };
    }
    return {
        available: true,
        decision: plan.decision,
        kind: transaction.kind,
        status: transaction.status,
        writeCount: Array.isArray(plan.writePlan) ? plan.writePlan.length : 0,
        paths: (plan.writePlan ?? []).map((entry) => String(entry.path)),
        preconditionCount: transaction.preconditions?.length ?? 0,
        ...(visibility === 'debug' ? {
            transactionDigest: shortHash(transaction.id),
            idempotencyKey: transaction.idempotencyKey,
        } : {}),
    };
}

export function createDualSurfaceViewModel(resolution, {
    visibility = 'audit',
    migrations = [],
    rollback = {},
} = {}) {
    const mode = DUAL_SURFACE_VISIBILITY.includes(visibility)
        ? visibility
        : 'audit';
    const value = resolution?.value ?? {};
    const director = value.director;
    const target = value.validatedCommand?.value?.target;
    const evidence = value.validatedCommand?.value?.evidence ?? [];
    const issues = (resolution?.issues ?? []).map(safeIssue);
    const base = {
        mode,
        status: resolution?.status ?? 'unresolved',
        decision: value.decision ?? 'pending',
        action: {
            idDigest: shortHash(value.candidate?.actionId),
            label: redactDiagnosticText(value.candidate?.label),
            commandType: value.candidate?.command?.type ?? '',
            source: value.candidate?.source?.kind ?? '',
        },
        confirmation: {
            required: value.candidate?.confirmation?.required === true,
            confirmed: value.candidate?.confirmation?.confirmed === true,
            digest: value.candidate?.confirmation?.digest ?? '',
        },
        adjudication: {
            decision: director?.decision ?? 'pending',
            validationStatus: director?.validationStatus ?? 'unresolved',
            blockedCount: director?.blockedContributions?.length ?? 0,
            violationCount: director?.violations?.length ?? 0,
            explanationCount: director?.explanation?.length ?? 0,
            ...(mode === 'debug' ? {
                explanationDigests: (director?.explanation ?? []).map(shortHash),
            } : {}),
        },
        transaction: safeTransaction(resolution, mode),
        branch: {
            status: value.validatedCommand?.value?.activeBranch?.status ?? 'unknown',
            branchDigest: shortHash(target?.branchId),
            logicalIndex: Number.isInteger(target?.logicalIndex)
                ? target.logicalIndex
                : null,
            swipeId: Number.isInteger(target?.swipeId) ? target.swipeId : null,
            generation: Number.isInteger(target?.generation) ? target.generation : null,
            ...(mode === 'debug' ? {
                contentHash: target?.contentHash ?? '',
                parentHash: target?.parentHash ?? '',
            } : {}),
        },
        evidence: safeEvidence(evidence),
        migrations: (Array.isArray(migrations) ? migrations : []).map(safeMigration),
        rollback: {
            available: rollback?.available === true,
            status: redactDiagnosticText(rollback?.status ?? 'unknown'),
            pathCount: Number.isInteger(rollback?.pathCount) ? rollback.pathCount : 0,
            recordDigest: shortHash(rollback?.recordId),
        },
        issues: mode === 'immersive'
            ? issues.filter((issue) => issue.severity !== 'warning').slice(0, 3)
            : issues,
    };
    if (mode !== 'debug') {
        base.evidence = {
            count: base.evidence.count,
            kinds: base.evidence.kinds,
        };
    }
    return base;
}

export function diagnosticContainsSensitiveMaterial(view) {
    const text = JSON.stringify(view ?? {});
    return [
        /Bearer\s+\S+/iu,
        /\b(?:sk|ghp|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/u,
        /(?:api[_ -]?key|token|password|secret)\s*[:=]\s*\S+/iu,
        /[A-Za-z]:\\Users\\/u,
        /完整提示词/u,
        /private prompt/iu,
    ].some((pattern) => pattern.test(text));
}
