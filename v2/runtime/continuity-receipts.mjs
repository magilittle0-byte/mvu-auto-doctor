function messageIdentity(message) {
    const swipeId = Number(message?.swipe_id) || 0;
    const swipeInfo = Array.isArray(message?.swipe_info)
        && message.swipe_info[swipeId]
        && typeof message.swipe_info[swipeId] === 'object'
        ? message.swipe_info[swipeId]
        : null;
    return {
        messageId: String(
            swipeInfo?.extra?.mvu_auto_doctor_source_id
            || message?.extra?.mvu_auto_doctor_source_id
            || message?.mesId
            || message?.message_id
            || '',
        ),
        swipeId,
        generationId: String(
            swipeInfo?.extra?.mvu_auto_doctor_generation_id
            || message?.extra?.mvu_auto_doctor_generation_id
            || '',
        ),
        branchId: String(
            swipeInfo?.extra?.mvu_auto_doctor_branch_id
            || message?.extra?.mvu_auto_doctor_branch_id
            || '',
        ),
    };
}

function terminalStatesByIndex(history) {
    const result = new Map();
    for (const entry of Array.isArray(history) ? history : []) {
        const index = Number(entry?.targetIndex ?? entry?.target?.logicalIndex);
        if (!Number.isInteger(index) || index < 0) continue;
        const updatedAt = Number(entry?.terminalAt ?? entry?.updatedAt ?? 0);
        const values = result.get(index) || [];
        values.push({
            state: String(entry?.state || 'unmanaged'),
            updatedAt,
            barrierId: String(entry?.id || ''),
            targetDigest: String(entry?.targetDigest || ''),
            messageId: String(entry?.messageId || entry?.target?.messageId || ''),
            swipeId: Number(
                entry?.finalSwipeId
                ?? entry?.initialSwipeId
                ?? entry?.target?.swipeId
                ?? 0
            ),
            generationId: String(
                entry?.generationId
                || entry?.target?.generationId
                || entry?.target?.generation
                || '',
            ),
            branchId: String(entry?.branchId || entry?.target?.branchId || ''),
        });
        result.set(index, values);
    }
    return result;
}

function terminalStateForMessage(entries, identity) {
    const values = Array.isArray(entries) ? entries : [];
    const hasIdentity = !!(
        identity.messageId
        || identity.generationId
        || identity.branchId
        || identity.swipeId
    );
    const exact = hasIdentity
        ? values.filter((entry) => (
            (!identity.messageId || entry.messageId === identity.messageId)
            && entry.swipeId === identity.swipeId
            && (!identity.generationId || entry.generationId === identity.generationId)
            && (!identity.branchId || entry.branchId === identity.branchId)
        ))
        : values;
    return exact.sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
}

export function buildContinuitySourcePlan({
    messages,
    fromIndex = 0,
    toIndex,
    barrierHistory = [],
} = {}) {
    const list = Array.isArray(messages) ? messages : [];
    const end = Number.isInteger(Number(toIndex))
        ? Math.min(list.length - 1, Number(toIndex))
        : list.length - 1;
    const start = Math.max(0, Number(fromIndex) || 0);
    const byIndex = terminalStatesByIndex(barrierHistory);
    const receipts = [];
    const eligibleIndexes = [];
    const skippedIndexes = [];
    for (let index = start; index <= end; index += 1) {
        const message = list[index];
        if (
            !message
            || message.is_user
            || message.is_system
            || typeof message.mes !== 'string'
            || !message.mes.trim()
        ) continue;
        const identity = messageIdentity(message);
        const barrier = terminalStateForMessage(byIndex.get(index), identity);
        const state = barrier?.state || 'unmanaged';
        const eligible = !['failed', 'stale'].includes(state);
        (eligible ? eligibleIndexes : skippedIndexes).push(index);
        receipts.push({
            sourceIndex: index,
            barrierState: state,
            barrierId: barrier?.barrierId || '',
            targetDigest: barrier?.targetDigest || '',
            decision: eligible ? 'eligible' : 'permanently-skipped',
        });
    }
    return {
        eligibleIndexes,
        skippedIndexes,
        eligibleCount: eligibleIndexes.length,
        skippedCount: skippedIndexes.length,
        receipts,
    };
}
