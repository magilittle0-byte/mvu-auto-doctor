function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

export function monthlyCostKey(now = Date.now()) {
    const date = new Date(now);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function normalizeMonthlyCostLedger(value) {
    const months = value?.months && typeof value.months === 'object'
        && !Array.isArray(value.months)
        ? clone(value.months)
        : {};
    for (const [key, month] of Object.entries(months)) {
        const receipts = month?.receipts && typeof month.receipts === 'object'
            && !Array.isArray(month.receipts)
            ? clone(month.receipts)
            : {};
        months[key] = {
            cny: Number(Math.max(0, Number(month?.cny) || 0).toFixed(6)),
            receiptCount: Object.keys(receipts).length,
            receipts,
            updatedAt: Math.max(0, Number(month?.updatedAt) || 0),
            baselineIncomplete: month?.baselineIncomplete === true,
        };
    }
    return { version: 1, months };
}

export function monthlyCostSpend(ledger, month = monthlyCostKey()) {
    const normalized = normalizeMonthlyCostLedger(ledger);
    const record = normalized.months[String(month)] ?? {
        cny: 0,
        receiptCount: 0,
        receipts: {},
        updatedAt: 0,
        baselineIncomplete: false,
    };
    return clone(record);
}

export function recordMonthlyCostReceipt(ledger, {
    receiptId,
    cny,
    month = monthlyCostKey(),
    at = Date.now(),
} = {}) {
    const normalized = normalizeMonthlyCostLedger(ledger);
    const id = String(receiptId || '').trim();
    const amount = Number(Math.max(0, Number(cny) || 0).toFixed(6));
    if (!id) {
        return {
            ok: false,
            status: 'rejected',
            ledger: normalized,
            issue: {
                code: 'social.cost_receipt_id',
                path: '$.receiptId',
                severity: 'error',
                message: '费用收据必须有稳定ID。',
            },
        };
    }
    const key = String(month || monthlyCostKey());
    const current = monthlyCostSpend(normalized, key);
    const existing = current.receipts[id];
    if (existing) {
        return {
            ok: Number(existing.cny) === amount,
            status: Number(existing.cny) === amount ? 'duplicate' : 'conflict',
            ledger: normalized,
            month: key,
            spend: current,
        };
    }
    const receipts = {
        ...current.receipts,
        [id]: {
            cny: amount,
            recordedAt: Math.max(0, Number(at) || 0),
        },
    };
    const next = {
        ...current,
        cny: Number((current.cny + amount).toFixed(6)),
        receiptCount: Object.keys(receipts).length,
        receipts,
        updatedAt: Math.max(0, Number(at) || 0),
    };
    normalized.months[key] = next;
    return {
        ok: true,
        status: 'recorded',
        ledger: normalized,
        month: key,
        spend: clone(next),
    };
}

export function seedMonthlyCostLedgerFromAudits(ledger, audits, now = Date.now()) {
    let normalized = normalizeMonthlyCostLedger(ledger);
    const month = monthlyCostKey(now);
    let seeded = false;
    for (const audit of Array.isArray(audits) ? audits : []) {
        if (String(audit?.month || '') !== month || !audit?.id) continue;
        const legacyFailureText = [
            audit.summary,
            ...(Array.isArray(audit.findings)
                ? audit.findings.map((finding) => finding?.reason)
                : []),
        ].filter(Boolean).join(' ');
        const failedBeforeCompletion = audit.modelCall?.completed === false
            || (
                audit.modelCall?.completed === undefined
                && audit.usage?.estimated === true
                && /二审调用失败|HTTP\s*[45]\d\d|connection refused|network error|timeout/iu.test(
                    legacyFailureText,
                )
            );
        if (failedBeforeCompletion) continue;
        const recorded = recordMonthlyCostReceipt(normalized, {
            receiptId: audit.id,
            cny: Math.max(0, Number(audit?.usage?.cny) || 0),
            month,
            at: audit.createdAt,
        });
        normalized = recorded.ledger;
        seeded ||= recorded.status === 'recorded';
    }
    if (seeded) {
        normalized.months[month].baselineIncomplete = true;
    }
    return normalized;
}
