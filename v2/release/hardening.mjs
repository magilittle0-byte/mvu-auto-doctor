const DEFAULT_LIMITS = Object.freeze({
    migrationDurationMs: 2_000,
    serializedBytes: 8 * 1024 * 1024,
    recordCount: 256,
    longSessionTurns: 24,
});

function failure(code, message, details = undefined) {
    return {
        code,
        severity: 'error',
        message,
        ...(details ? { details } : {}),
    };
}

export function evaluateReleaseHardening(evidence = {}, limits = {}) {
    const expected = { ...DEFAULT_LIMITS, ...limits };
    const issues = [];
    const performance = evidence.performance ?? {};
    const privacy = evidence.privacy ?? {};
    const recovery = evidence.recovery ?? {};
    const security = evidence.security ?? {};
    const compatibility = evidence.compatibility ?? {};

    for (const [field, limit] of [
        ['migrationDurationMs', expected.migrationDurationMs],
        ['serializedBytes', expected.serializedBytes],
        ['recordCount', expected.recordCount],
    ]) {
        const actual = performance[field];
        if (!Number.isFinite(actual) || actual < 0 || actual > limit) {
            issues.push(failure(
                `hardening.${field}`,
                `${field} 未达到发布容量预算。`,
                { actual, limit },
            ));
        }
    }
    if (
        !Number.isInteger(performance.longSessionTurns)
        || performance.longSessionTurns < expected.longSessionTurns
    ) {
        issues.push(failure(
            'hardening.long_session',
            '真实长局轮数不足。',
            {
                actual: performance.longSessionTurns,
                minimum: expected.longSessionTurns,
            },
        ));
    }
    for (const field of [
        'credentialFindings',
        'privateContentFindings',
        'rawPayloadFindings',
        'absoluteUserPathFindings',
        'derivedNarrativeFindings',
        'fullPromptFindings',
        'privateCanaryFindings',
    ]) {
        if (privacy[field] !== 0) {
            issues.push(failure(
                `hardening.privacy.${field}`,
                `${field} 必须为0。`,
                { actual: privacy[field] },
            ));
        }
    }
    for (const field of [
        'parameterizedDatabase',
        'dependencyAuditPassed',
        'packageAllowlistVerified',
    ]) {
        if (security[field] !== true) {
            issues.push(failure(
                `hardening.security.${field}`,
                `${field} 必须通过。`,
            ));
        }
    }
    for (const field of [
        'legacyRollbackVerified',
        'restartRecoveryVerified',
        'lateWritesZero',
        'staleDownstreamWritesZero',
        'watchdogTerminalVerified',
    ]) {
        if (recovery[field] !== true) {
            issues.push(failure(
                `hardening.recovery.${field}`,
                `${field} 必须通过。`,
            ));
        }
    }
    for (const field of [
        'databaseCoexistence',
        'externalDatabaseProtocolOptional',
        'externalDatabaseUnmanagedAccurate',
        'doctorManagedWritesSettledOnly',
        'databaseFailedStaleWritesZero',
        'rerollLifecycleCompatible',
        'companionControlsIsolated',
        'otherScriptsPreserved',
        'doctorRuntimeConsoleErrorsZero',
        'databaseRuntimeConsoleErrorsZero',
        'companionRuntimeConsoleErrorsZero',
        'thirdPartyErrorAttributionReliable',
    ]) {
        if (compatibility[field] !== true) {
            issues.push(failure(
                `hardening.compatibility.${field}`,
                `${field} 必须通过。`,
            ));
        }
    }
    if (compatibility.hostConsoleCleanClaimed !== false) {
        issues.push(failure(
            'hardening.compatibility.hostConsoleCleanClaimed',
            '宿主存在已归属的第三方错误时不得宣称整个控制台干净。',
        ));
    }

    return {
        ok: issues.length === 0,
        status: issues.length === 0 ? 'pass' : 'fail',
        issues,
        limits: expected,
    };
}
