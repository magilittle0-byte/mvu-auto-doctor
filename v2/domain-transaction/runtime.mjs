export async function preparePlannedDomainTransaction(kernel, planResult) {
    if (
        planResult?.ok !== true
        || planResult?.status !== 'valid'
        || !planResult?.value?.transaction
    ) {
        return {
            ok: false,
            status: planResult?.status ?? 'rejected',
            transaction: planResult?.value?.transaction ?? null,
            issues: planResult?.issues ?? [{
                code: 'domain.plan_invalid',
                path: '$',
                severity: 'error',
                message: '只有 valid 的阶段4领域计划可以进入 TransactionKernel。',
            }],
        };
    }
    if (typeof kernel?.prepare !== 'function') {
        throw new TypeError('领域事务执行器需要阶段2 TransactionKernel。');
    }
    return kernel.prepare(planResult.value.transaction, {
        writePlan: planResult.value.writePlan,
        domainResults: planResult.value.domainResults,
    });
}

export async function executePlannedDomainTransaction(kernel, planResult) {
    const prepared = await preparePlannedDomainTransaction(kernel, planResult);
    if (prepared?.status !== 'prepared') return prepared;
    return kernel.commit(prepared);
}
