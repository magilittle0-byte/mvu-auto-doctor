function issue(code, path, message) {
    return { code, path, severity: 'error', message };
}

function placeholderCount(statement) {
    const positional = String(statement).match(/\?/g)?.length ?? 0;
    const numbered = String(statement).match(/\$\d+/g)?.length ?? 0;
    return positional + numbered;
}

export function validateDatabaseWrite({
    payload,
    payloadLength,
    fieldLimit = 600,
    statement = '',
    parameters,
    parameterized,
    expectedRevision,
    observedRevision,
}) {
    const issues = [];
    const length = Number.isFinite(Number(payloadLength))
        ? Number(payloadLength)
        : [...String(payload ?? '')].length;
    const limit = Math.max(0, Number(fieldLimit) || 0);
    if (length > limit) {
        issues.push(issue(
            'database.field_length',
            '$.payload',
            `字段长度 ${length} 超过上限 ${limit}。`,
        ));
    }

    const params = Array.isArray(parameters) ? parameters : [];
    const placeholders = placeholderCount(statement);
    if (
        parameterized === false
        || !String(statement).trim()
        || placeholders === 0
        || placeholders !== params.length
    ) {
        issues.push(issue(
            'database.statement_not_parameterized',
            '$.statement',
            '数据库写入必须使用占位符和独立参数数组。',
        ));
    }

    if (
        !Number.isInteger(Number(expectedRevision))
        || !Number.isInteger(Number(observedRevision))
        || Number(expectedRevision) !== Number(observedRevision)
    ) {
        issues.push(issue(
            'database.revision_conflict',
            '$.expectedRevision',
            `修订冲突：期望 ${expectedRevision}，实际 ${observedRevision}。`,
        ));
    }

    return {
        ok: issues.length === 0,
        status: issues.length ? 'rejected' : 'valid',
        length,
        limit,
        issues,
    };
}

export async function executeDatabaseWrite(input, host) {
    const checked = validateDatabaseWrite(input);
    if (!checked.ok) {
        return {
            ok: false,
            status: 'rejected',
            committed: false,
            issues: checked.issues,
        };
    }
    if (typeof host?.executeParameterized !== 'function') {
        return {
            ok: false,
            status: 'unresolved',
            committed: false,
            issues: [issue(
                'database.host_missing',
                '$.host',
                '宿主没有提供参数化数据库执行接口。',
            )],
        };
    }
    const result = await host.executeParameterized(
        input.statement,
        structuredClone(input.parameters),
        { expectedRevision: Number(input.expectedRevision) },
    );
    return {
        ok: result?.committed === true,
        status: result?.committed === true ? 'committed' : 'failed',
        committed: result?.committed === true,
        result,
        issues: [],
    };
}
