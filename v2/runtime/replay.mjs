import { validateDatabaseWrite } from './database.mjs';

export async function runPhase6Replay(fixture, runtime = {}) {
    if (!fixture?.id) throw new TypeError('Replay fixture requires an id.');
    if (fixture.id === 'RR-REPAIR-DB-BARRIER') {
        const result = await runtime.barrier.runDownstream(
            runtime.target,
            runtime.databaseReader ?? (() => 'unexpected-write'),
        );
        return {
            id: fixture.id,
            decision: result.status === 'blocked' ? 'hold' : result.status,
            databaseStatus: result.status,
            databaseWrite: result.status === 'completed',
            pass: result.status === 'blocked',
        };
    }
    if (fixture.id === 'RR-TASK-WATCHDOG') {
        const result = await runtime.leases.watchdog(
            runtime.leaseId,
            runtime.now,
        );
        return {
            id: fixture.id,
            decision: result?.status === 'timed-out'
                ? 'watchdog_escalate'
                : result?.status,
            taskStatus: result?.status,
            diagnostic: result?.diagnostic ?? null,
            unverifiedWrite: false,
            pass: result?.status === 'timed-out' && Boolean(result.diagnostic),
        };
    }
    if (fixture.id === 'RR-DATABASE-LENGTH-SQL-CONCURRENCY') {
        const context = fixture.input.context;
        const payload = fixture.input.operation.payload;
        const checked = validateDatabaseWrite({
            payloadLength: context.payloadLength,
            fieldLimit: context.fieldLimit,
            statement: runtime.statement ?? 'UPDATE memory SET summary = concatenated_value',
            parameters: runtime.parameters ?? [],
            parameterized: payload.parameterized,
            expectedRevision: payload.expectedRevision,
            observedRevision: payload.observedRevision,
        });
        return {
            id: fixture.id,
            decision: checked.ok ? 'accept' : 'reject',
            committed: false,
            issues: checked.issues,
            pass: (
                checked.issues.some((entry) => entry.code === 'database.field_length')
                && checked.issues.some(
                    (entry) => entry.code === 'database.statement_not_parameterized',
                )
                && checked.issues.some(
                    (entry) => entry.code === 'database.revision_conflict',
                )
            ),
        };
    }
    return {
        id: fixture.id,
        decision: 'not-owned',
        pass: false,
    };
}

export function buildReplayAutomationReport(corpus, results, {
    generatedAt = new Date().toISOString(),
    environment = 'deterministic',
} = {}) {
    const byId = new Map(results.map((entry) => [entry.id, entry]));
    const cases = corpus.cases.map((fixture) => {
        const result = byId.get(fixture.id);
        return {
            id: fixture.id,
            category: fixture.category,
            automation: fixture.automation.status,
            acceptanceLayers: [...fixture.expected.acceptanceLayers],
            status: result ? (result.pass ? 'pass' : 'fail') : 'covered-by-phase-suite',
        };
    });
    return {
        schemaVersion: '2.0',
        phase: 6,
        generatedAt,
        environment,
        totals: {
            cases: cases.length,
            pass: cases.filter((entry) => entry.status === 'pass').length,
            fail: cases.filter((entry) => entry.status === 'fail').length,
            coveredByPhaseSuite: cases.filter(
                (entry) => entry.status === 'covered-by-phase-suite',
            ).length,
        },
        cases,
    };
}
