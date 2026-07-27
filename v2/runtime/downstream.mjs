import { hashText } from '../transaction/index.mjs';
import { PersistentRecordStore } from './storage.mjs';

const TERMINAL_STATES = new Set(['settled', 'failed', 'stale']);
const WRITE_ACTIONS = new Set(['write', 'read-final-and-write']);

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function issue(code, path, message) {
    return { code, path, severity: 'error', message };
}

export function validateBarrierClientRegistration(input) {
    const issues = [];
    const id = String(input?.id || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/u.test(id)) {
        issues.push(issue(
            'barrier.client_id',
            '$.id',
            '下游客户端必须提供稳定、非空的协议ID。',
        ));
    }
    if (Number(input?.protocolVersion) !== 1) {
        issues.push(issue(
            'barrier.protocol_version',
            '$.protocolVersion',
            '下游客户端必须注册 barrier 协议 v1。',
        ));
    }
    if (input?.settledOnly !== true) {
        issues.push(issue(
            'barrier.settled_only',
            '$.settledOnly',
            '下游客户端必须承诺只消费 settled 收据。',
        ));
    }
    if (input?.terminalReceipts !== true) {
        issues.push(issue(
            'barrier.terminal_receipts',
            '$.terminalReceipts',
            '下游客户端必须确认 failed/stale 终态收据。',
        ));
    }
    return {
        ok: issues.length === 0,
        status: issues.length ? 'rejected' : 'valid',
        issues,
        value: issues.length ? null : {
            id,
            protocolVersion: 1,
            settledOnly: true,
            terminalReceipts: true,
        },
    };
}

export function downstreamReceiptId(barrier) {
    if (!barrier?.id || !TERMINAL_STATES.has(barrier?.state)) {
        throw new TypeError('Terminal barrier receipt requires id and terminal state.');
    }
    return `receipt:${hashText(JSON.stringify([
        barrier.id,
        barrier.state,
        barrier.branchId || '',
        barrier.target?.chatId || barrier.chatId || '',
        barrier.target?.logicalIndex ?? barrier.targetIndex ?? -1,
        barrier.target?.messageId || barrier.messageId || '',
        barrier.target?.swipeId ?? barrier.finalSwipeId ?? barrier.initialSwipeId ?? -1,
        barrier.target?.generationId
            ?? barrier.target?.generation
            ?? barrier.generationId
            ?? barrier.generation
            ?? -1,
        barrier.target?.contentHash || barrier.finalFingerprint || '',
    ]))}`;
}

export class DownstreamBarrierProtocol {
    #clients;
    #receipts;
    #now;

    constructor(adapter, {
        namespace = 'downstream-barrier-v1',
        now = () => Date.now(),
    } = {}) {
        this.#clients = new PersistentRecordStore(adapter, {
            namespace: `${namespace}:clients`,
        });
        this.#receipts = new PersistentRecordStore(adapter, {
            namespace: `${namespace}:receipts`,
        });
        this.#now = now;
    }

    async register(input) {
        const checked = validateBarrierClientRegistration(input);
        if (!checked.ok) return checked;
        const now = this.#now();
        const client = await this.#clients.update(checked.value.id, (current) => ({
            ...checked.value,
            registeredAt: current?.registeredAt ?? now,
            refreshedAt: now,
            status: 'registered',
        }));
        return { ok: true, status: 'registered', issues: [], client };
    }

    async clientStatus(id) {
        const client = await this.#clients.read(String(id || '').trim().toLowerCase());
        return {
            ok: client?.status === 'registered'
                && client?.settledOnly === true
                && client?.terminalReceipts === true,
            status: client?.status ?? 'missing',
            client,
        };
    }

    async issue(barrier) {
        const receiptId = downstreamReceiptId(barrier);
        const now = this.#now();
        return this.#receipts.update(receiptId, (current) => current ?? {
            id: receiptId,
            barrierId: String(barrier.id),
            barrierState: barrier.state,
            branchId: String(barrier.branchId || ''),
            targetDigest: hashText(JSON.stringify(
                barrier.finalTarget
                || barrier.target
                || {
                    chatId: barrier.chatId,
                    targetIndex: barrier.targetIndex,
                    messageId: barrier.messageId,
                    swipeId: barrier.finalSwipeId ?? barrier.initialSwipeId,
                    generationId: barrier.generationId || '',
                    fingerprint: barrier.finalFingerprint,
                },
            )),
            permittedAction: barrier.state === 'settled'
                ? 'read-final-and-write'
                : 'abandon',
            writeAllowed: barrier.state === 'settled',
            issuedAt: now,
            acknowledgements: {},
        });
    }

    async acknowledge({
        clientId,
        receiptId,
        action,
        targetDigest = '',
    }) {
        const normalizedClientId = String(clientId || '').trim().toLowerCase();
        const client = await this.clientStatus(normalizedClientId);
        if (!client.ok) {
            return {
                ok: false,
                status: 'rejected',
                issues: [issue(
                    'barrier.client_not_registered',
                    '$.clientId',
                    '数据库未注册 barrier 协议。',
                )],
            };
        }
        const normalizedAction = String(action || '');
        const now = this.#now();
        let conflict = null;
        const receipt = await this.#receipts.update(String(receiptId || ''), (current) => {
            if (!current) {
                conflict = issue(
                    'barrier.receipt_missing',
                    '$.receiptId',
                    '终态收据不存在。',
                );
                return undefined;
            }
            if (WRITE_ACTIONS.has(normalizedAction) && current.writeAllowed !== true) {
                conflict = issue(
                    'barrier.write_forbidden',
                    '$.action',
                    `${current.barrierState} 来源永久禁止数据库写入。`,
                );
                return undefined;
            }
            if (
                normalizedAction === 'abandon'
                && current.permittedAction !== 'abandon'
            ) {
                conflict = issue(
                    'barrier.settled_abandoned',
                    '$.action',
                    'settled 收据应读取最终目标或显式记录跳过原因。',
                );
                return undefined;
            }
            if (
                targetDigest
                && String(targetDigest) !== String(current.targetDigest)
            ) {
                conflict = issue(
                    'barrier.target_mismatch',
                    '$.targetDigest',
                    '下游确认的目标摘要与终态收据不一致。',
                );
                return undefined;
            }
            if (normalizedAction !== current.permittedAction) {
                conflict = issue(
                    'barrier.action_not_permitted',
                    '$.action',
                    `${current.barrierState} 收据只允许 ${current.permittedAction}。`,
                );
                return undefined;
            }
            const previous = current.acknowledgements?.[normalizedClientId];
            if (previous && previous.action !== normalizedAction) {
                conflict = issue(
                    'barrier.ack_conflict',
                    '$.action',
                    '同一客户端对同一终态收据给出了冲突确认。',
                );
                return undefined;
            }
            return {
                ...current,
                acknowledgements: {
                    ...(current.acknowledgements || {}),
                    [normalizedClientId]: previous ?? {
                        action: normalizedAction,
                        acknowledgedAt: now,
                    },
                },
            };
        });
        if (conflict) {
            return { ok: false, status: 'rejected', issues: [conflict], receipt };
        }
        return {
            ok: true,
            status: receipt?.acknowledgements?.[normalizedClientId]
                ? 'acknowledged'
                : 'missing',
            issues: [],
            receipt: clone(receipt),
        };
    }

    async readReceipt(receiptId) {
        return this.#receipts.read(String(receiptId || ''));
    }
}
