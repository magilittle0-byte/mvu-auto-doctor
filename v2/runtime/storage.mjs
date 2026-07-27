function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function keyFor(namespace, key) {
    return `${String(namespace)}:${String(key)}`;
}

export class MemoryVersionedAdapter {
    #records = new Map();

    async read(key) {
        const record = this.#records.get(String(key));
        return record ? clone(record) : null;
    }

    async compareAndSwap(key, expectedRevision, value) {
        const normalizedKey = String(key);
        const current = this.#records.get(normalizedKey) ?? null;
        const currentRevision = current?.revision ?? null;
        if (currentRevision !== expectedRevision) return false;
        this.#records.set(normalizedKey, {
            revision: currentRevision === null ? 1 : currentRevision + 1,
            value: clone(value),
        });
        return true;
    }

    async entries(prefix = '') {
        return [...this.#records.entries()]
            .filter(([key]) => key.startsWith(String(prefix)))
            .map(([key, record]) => ({ key, ...clone(record) }));
    }
}

export class PersistentRecordStore {
    #adapter;
    #namespace;
    #maxAttempts;

    constructor(adapter, { namespace = 'runtime', maxAttempts = 12 } = {}) {
        if (
            typeof adapter?.read !== 'function'
            || typeof adapter?.compareAndSwap !== 'function'
        ) {
            throw new TypeError('PersistentRecordStore requires read and compareAndSwap.');
        }
        this.#adapter = adapter;
        this.#namespace = String(namespace);
        this.#maxAttempts = Math.max(1, Number(maxAttempts) || 12);
    }

    async read(key) {
        const record = await this.#adapter.read(keyFor(this.#namespace, key));
        return record ? clone(record.value) : null;
    }

    async update(key, updater) {
        for (let attempt = 0; attempt < this.#maxAttempts; attempt += 1) {
            const storageKey = keyFor(this.#namespace, key);
            const current = await this.#adapter.read(storageKey);
            const next = await updater(clone(current?.value ?? null));
            if (next === undefined) return clone(current?.value ?? null);
            const saved = await this.#adapter.compareAndSwap(
                storageKey,
                current?.revision ?? null,
                clone(next),
            );
            if (saved) return clone(next);
        }
        throw new Error(`Persistent record CAS exhausted for ${this.#namespace}:${key}.`);
    }
}

export class PersistentIdempotencyStore {
    #records;

    constructor(adapter, options = {}) {
        this.#records = new PersistentRecordStore(adapter, {
            namespace: options.namespace ?? 'idempotency',
            maxAttempts: options.maxAttempts,
        });
    }

    async get(scope) {
        return this.#records.read(scope);
    }

    async claim(scope, transactionId) {
        return this.#records.update(scope, (current) => {
            if (current?.status === 'settled') return current;
            if (current?.status === 'claimed') return current;
            return {
                status: 'claimed',
                transactionId: String(transactionId),
                claimedAt: Date.now(),
            };
        });
    }

    async release(scope, transactionId) {
        return this.#records.update(scope, (current) => {
            if (
                current?.status !== 'claimed'
                || current.transactionId !== String(transactionId)
            ) {
                return undefined;
            }
            return {
                status: 'released',
                transactionId: String(transactionId),
                releasedAt: Date.now(),
            };
        });
    }

    async settle(scope, transaction) {
        return this.#records.update(scope, (current) => {
            if (
                current?.status === 'claimed'
                && current.transactionId !== String(transaction?.id)
            ) {
                return undefined;
            }
            if (current?.status === 'settled') return current;
            return {
                status: 'settled',
                transactionId: String(transaction?.id || ''),
                transaction: clone(transaction),
                settledAt: Date.now(),
            };
        });
    }
}

export class PersistentRecoveryStore {
    #records;

    constructor(adapter, options = {}) {
        this.#records = new PersistentRecordStore(adapter, {
            namespace: options.namespace ?? 'recovery',
            maxAttempts: options.maxAttempts,
        });
    }

    async persist(record) {
        if (!record?.id) throw new TypeError('Recovery record requires an id.');
        return this.#records.update(record.id, (current) => ({
            ...(current ?? {}),
            ...clone(record),
            persistedAt: Date.now(),
        }));
    }

    async settle(id, status, details = {}) {
        return this.#records.update(id, (current) => {
            if (!current) throw new Error(`Recovery record ${id} is missing.`);
            return {
                ...current,
                ...clone(details),
                status: String(status),
                settledAt: Date.now(),
            };
        });
    }

    async get(id) {
        return this.#records.read(id);
    }
}
