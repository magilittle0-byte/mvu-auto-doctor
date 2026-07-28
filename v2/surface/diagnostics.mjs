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

export function coarseUserAgent(value) {
    const source = String(value || '');
    const platform = /Android/iu.test(source)
        ? 'Android'
        : /iPhone|iPad|iPod/iu.test(source)
            ? 'iOS'
            : /Windows/iu.test(source)
                ? 'Windows'
                : /Macintosh|Mac OS X/iu.test(source)
                    ? 'macOS'
                    : /Linux/iu.test(source)
                        ? 'Linux'
                        : 'Other';
    const candidates = [
        ['Chromium', /(?:Chrome|Chromium|CriOS)\/(\d+)/iu],
        ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/iu],
        ['WebKit', /AppleWebKit\/(\d+)/iu],
    ];
    for (const [kernel, pattern] of candidates) {
        const match = source.match(pattern);
        if (match) {
            return {
                platform,
                kernel,
                kernelMajor: Number(match[1]) || 0,
            };
        }
    }
    return { platform, kernel: 'Other', kernelMajor: 0 };
}

export function createPrivacySafeDiagnosticProjection({
    userAgent = '',
    plugin = {},
    environment = {},
    chat = {},
    statuses = {},
    hardContract = null,
    socialAudit = null,
    prompt = null,
    modelDiagnostics = [],
    barrierProtocol = {},
    actorShards = {},
    userPrompts = {},
} = {}) {
    const statusKinds = Object.fromEntries(
        Object.entries(statuses).map(([key, value]) => [
            key,
            { kind: String(value?.kind || '') },
        ]),
    );
    return {
        schemaVersion: 2,
        plugin: {
            id: String(plugin?.id || ''),
            version: String(plugin?.version || ''),
        },
        environment: {
            userAgent: coarseUserAgent(userAgent),
            status: String(environment?.status || 'unknown'),
            checkCounts: {
                ok: (environment?.checks || []).filter((item) => item?.kind === 'ok').length,
                warn: (environment?.checks || []).filter((item) => item?.kind === 'warn').length,
                error: (environment?.checks || []).filter((item) => item?.kind === 'error').length,
                info: (environment?.checks || []).filter((item) => item?.kind === 'info').length,
            },
            barrierProtocol: {
                required: barrierProtocol?.required === true,
                registered: barrierProtocol?.registered === true,
                clientCount: Math.max(0, Number(barrierProtocol?.clientCount) || 0),
                errorCode: String(barrierProtocol?.errorCode || ''),
            },
        },
        currentChat: {
            present: chat?.present === true,
            messageCount: Math.max(0, Number(chat?.messageCount) || 0),
            repairJournalCount: Math.max(0, Number(chat?.repairJournalCount) || 0),
            socialAuditCount: Math.max(0, Number(chat?.socialAuditCount) || 0),
            continuity: {
                activeCount: Math.max(0, Number(chat?.continuity?.activeCount) || 0),
                resolvedCount: Math.max(0, Number(chat?.continuity?.resolvedCount) || 0),
            },
            forum: {
                postCount: Math.max(0, Number(chat?.forum?.postCount) || 0),
                totalComments: Math.max(0, Number(chat?.forum?.totalComments) || 0),
            },
            modelCalls: cloneModelCallStats(chat?.modelCalls),
        },
        actorShards: {
            status: String(actorShards?.status || 'disabled'),
            selected: Math.max(0, Number(actorShards?.selected) || 0),
            completed: Math.max(0, Number(actorShards?.completed) || 0),
            succeeded: Math.max(0, Number(actorShards?.succeeded) || 0),
            failed: Math.max(0, Number(actorShards?.failed) || 0),
        },
        userPrompts: Object.fromEntries(
            Object.entries(userPrompts || {}).map(([key, value]) => [
                key,
                {
                    enabled: value?.enabled === true,
                    length: Math.max(0, Number(value?.length) || 0),
                    hash: String(value?.hash || ''),
                },
            ]),
        ),
        latestStatuses: statusKinds,
        latestHardContract: hardContract
            ? {
                checkedAt: Math.max(0, Number(hardContract.checkedAt) || 0),
                targetIndex: Number.isInteger(Number(hardContract.targetIndex))
                    ? Number(hardContract.targetIndex)
                    : -1,
                issueCount: (hardContract.issues || []).length,
                issues: (hardContract.issues || []).map((item) => ({
                    code: String(item?.code || 'unknown'),
                    severity: String(item?.severity || 'error'),
                    pathDigest: shortHash(item?.path || '$'),
                })),
            }
            : null,
        latestSocialAudit: socialAudit
            ? {
                createdAt: Math.max(0, Number(socialAudit.createdAt) || 0),
                sourceIndex: Number.isInteger(Number(socialAudit.sourceRef?.index))
                    ? Number(socialAudit.sourceRef.index)
                    : -1,
                mode: String(socialAudit.mode || ''),
                verdict: String(socialAudit.verdict || ''),
                reasonCount: (socialAudit.reasons || []).length,
                findingCount: (socialAudit.findings || []).length,
                decisionCount: (socialAudit.decisions || []).length,
                failureCode: String(socialAudit.modelCall?.failureCode || ''),
                receiptDigest: shortHash(socialAudit.id || ''),
                usage: {
                    inputTokens: Math.max(0, Number(socialAudit.usage?.inputTokens) || 0),
                    outputTokens: Math.max(0, Number(socialAudit.usage?.outputTokens) || 0),
                    cny: Math.max(0, Number(socialAudit.usage?.cny) || 0),
                },
                correction: {
                    status: String(socialAudit.correction?.status || ''),
                    revertedPathCount: (socialAudit.correction?.revertedPaths || []).length,
                },
            }
            : null,
        lastPrompt: prompt
            ? {
                taskDigest: shortHash(prompt.task || ''),
                capturedAt: Math.max(0, Number(prompt.capturedAt) || 0),
                maxTokens: Math.max(0, Number(prompt.maxTokens) || 0),
                totalChars: Math.max(0, Number(prompt.totalChars) || 0),
                segments: (prompt.messages || []).map((message) => ({
                    role: String(message?.role || ''),
                    chars: String(message?.content || '').length,
                })),
            }
            : null,
        modelDiagnostics: (Array.isArray(modelDiagnostics) ? modelDiagnostics : []).map(
            (entry) => ({
                at: Math.max(0, Number(entry?.at) || 0),
                phase: String(entry?.phase || ''),
                taskDigest: shortHash(entry?.task || ''),
                channel: String(entry?.channel || ''),
                status: String(entry?.status || ''),
                durationMs: Math.max(0, Number(entry?.durationMs) || 0),
                queueWaitMs: Math.max(0, Number(entry?.queueWaitMs) || 0),
                outputChars: Math.max(0, Number(entry?.outputChars) || 0),
                attempt: Math.max(0, Number(entry?.attempt) || 0),
                targetIndex: Number.isInteger(Number(entry?.targetIndex))
                    ? Number(entry.targetIndex)
                    : -1,
                failureKind: String(entry?.failureKind || ''),
                rootType: String(entry?.rootType || ''),
                tags: structuredClone(entry?.tags || {}),
                recovered: entry?.recovered === true,
            }),
        ),
    };
}

function cloneModelCallStats(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        total: Math.max(0, Number(source.total) || 0),
        succeeded: Math.max(0, Number(source.succeeded) || 0),
        failed: Math.max(0, Number(source.failed) || 0),
        rateLimited: Math.max(0, Number(source.rateLimited) || 0),
        byTask: Object.fromEntries(
            Object.entries(source.byTask || {}).map(([key, count]) => [
                key,
                Math.max(0, Number(count) || 0),
            ]),
        ),
    };
}

export function diagnosticPrivacyCanaryFindings(value, canaries = []) {
    const serialized = JSON.stringify(value ?? {});
    const patterns = [
        /\b(?:sk|ghp|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/u,
        /Bearer\s+\S+/iu,
        /(?:api[_ -]?key|token|password|secret)\s*[:=]\s*\S+/iu,
        /[A-Za-z]:\\Users\\/u,
        /(?:rawPayload|raw_payload|promptText|fullPrompt|privateNarrative)/iu,
    ];
    return {
        credentialFindings: patterns.slice(0, 3).filter((pattern) => pattern.test(serialized)).length,
        absoluteUserPathFindings: patterns[3].test(serialized) ? 1 : 0,
        rawPayloadFindings: patterns[4].test(serialized) ? 1 : 0,
        privateContentFindings: (Array.isArray(canaries) ? canaries : [])
            .filter((canary) => canary && serialized.includes(String(canary))).length,
    };
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
