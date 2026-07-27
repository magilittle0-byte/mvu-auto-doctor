const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function problem(code, message, details = undefined) {
    return {
        code,
        severity: 'error',
        message,
        ...(details ? { details } : {}),
    };
}

export function evaluateReleaseCandidate(evidence = {}) {
    const issues = [];
    const candidate = String(evidence.candidate ?? '');
    const simulation = evidence.simulation ?? {};
    const real = evidence.realEnvironment ?? {};
    const migration = evidence.migration ?? {};
    const ablation = evidence.ablation ?? {};
    const packageEvidence = evidence.package ?? {};
    const hardening = evidence.hardening ?? {};

    if (!/^2\.0\.0-rc\.[1-9][0-9]*$/u.test(candidate)) {
        issues.push(problem(
            'release.candidate_version',
            '候选版本必须使用2.0.0-rc.N。',
        ));
    }
    if (simulation.status !== 'pass' || simulation.fixturePasses !== 17) {
        issues.push(problem(
            'release.simulation_failure',
            '全部17项自动行为回放必须通过。',
        ));
    }
    if (real.status !== 'pass') {
        issues.push(problem(
            'release.real_qc_failure',
            '真实SillyTavern验收失败或缺失；模拟通过不能覆盖真实失败。',
            { status: real.status ?? 'missing' },
        ));
    }
    if (
        typeof simulation.sourceFingerprint !== 'string'
        || simulation.sourceFingerprint !== real.sourceFingerprint
    ) {
        issues.push(problem(
            'release.candidate_mismatch',
            '模拟与真实QC必须验证同一源码候选。',
        ));
    }
    if (
        migration.legacyReadable !== true
        || migration.rollbackVerified !== true
        || !['ready', 'fallback'].includes(migration.status)
    ) {
        issues.push(problem(
            'release.migration_failure',
            '1.x聊天必须升级后可读且失败可回退。',
        ));
    }
    if (
        ablation.sameMainModel !== true
        || ablation.disabledArmPassed !== true
        || ablation.enabledArmPassed !== true
        || ablation.privateMaterialRecorded !== false
    ) {
        issues.push(problem(
            'release.ablation_failure',
            '同主模型开/关消融证据不完整。',
        ));
    }
    if (hardening.status !== 'pass' || hardening.issueCount !== 0) {
        issues.push(problem(
            'release.hardening_failure',
            '性能、容量、隐私、安全或恢复硬化门未通过。',
        ));
    }
    if (
        !SHA256_PATTERN.test(String(packageEvidence.sha256 ?? ''))
        || packageEvidence.sha256 !== real.packageSha256
        || packageEvidence.allowlistVerified !== true
    ) {
        issues.push(problem(
            'release.package_failure',
            '候选包SHA256或内容白名单未通过。',
        ));
    }

    if (issues.length) {
        return {
            ok: false,
            decision: 'reject',
            release: {
                status: 'blocked',
                real_qc_failure: issues.some(
                    (entry) => entry.code === 'release.real_qc_failure',
                ),
                candidate,
                issues,
            },
        };
    }
    return {
        ok: true,
        decision: 'accept',
        release: {
            status: 'ready-for-maintainer-review',
            candidate,
            issues: [],
            publish: {
                allowed: true,
                automaticMainMerge: false,
                packageSha256: packageEvidence.sha256,
            },
        },
    };
}

export function runPhase7ReleaseReplay(fixture, evidence = {}) {
    if (fixture?.id !== 'RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION') {
        return {
            id: fixture?.id ?? '',
            decision: 'not-owned',
            pass: false,
        };
    }
    const evaluated = evaluateReleaseCandidate({
        candidate: fixture.input.operation.payload.candidate.replace(/-rc$/u, '-rc.1'),
        simulation: {
            status: fixture.input.context.simulationResult,
            fixturePasses: 17,
            sourceFingerprint: evidence.sourceFingerprint ?? 'fixture-source',
        },
        realEnvironment: {
            status: fixture.input.context.realSillyTavernResult,
            sourceFingerprint: evidence.sourceFingerprint ?? 'fixture-source',
            packageSha256: evidence.packageSha256 ?? 'a'.repeat(64),
        },
        migration: {
            status: 'ready',
            legacyReadable: true,
            rollbackVerified: true,
        },
        ablation: {
            sameMainModel: true,
            disabledArmPassed: true,
            enabledArmPassed: true,
            privateMaterialRecorded: false,
        },
        hardening: {
            status: 'pass',
            issueCount: 0,
        },
        package: {
            sha256: evidence.packageSha256 ?? 'a'.repeat(64),
            allowlistVerified: true,
        },
    });
    return {
        id: fixture.id,
        decision: evaluated.decision,
        release: evaluated.release,
        pass: (
            evaluated.decision === fixture.expected.decision
            && evaluated.release.status === 'blocked'
            && evaluated.release.real_qc_failure === true
            && !Object.hasOwn(evaluated.release, 'publish')
        ),
    };
}
