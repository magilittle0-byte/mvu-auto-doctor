function abortError(reason = '模型任务已取消') {
    const error = new Error(String(reason || '模型任务已取消'));
    error.name = 'AbortError';
    return error;
}

function normalizedPriority(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export class ConnectionTaskScheduler {
    constructor() {
        this.connections = new Map();
        this.sequence = 0;
    }

    enqueue(connectionKey, run, {
        priority = 0,
        signal = null,
        label = '',
    } = {}) {
        if (typeof run !== 'function') {
            return Promise.reject(new TypeError('模型连接队列缺少可执行任务'));
        }
        if (signal?.aborted) {
            return Promise.reject(abortError(signal.reason));
        }

        const key = String(connectionKey || 'default');
        const state = this.connections.get(key) || {
            active: false,
            activeLabel: '',
            pending: [],
        };
        this.connections.set(key, state);

        return new Promise((resolve, reject) => {
            const entry = {
                run,
                resolve,
                reject,
                priority: normalizedPriority(priority),
                sequence: this.sequence += 1,
                signal,
                label: String(label || ''),
                abortListener: null,
            };
            if (signal?.addEventListener) {
                entry.abortListener = () => {
                    const index = state.pending.indexOf(entry);
                    if (index < 0) return;
                    state.pending.splice(index, 1);
                    reject(abortError(signal.reason));
                    this.cleanup(key, state);
                };
                signal.addEventListener('abort', entry.abortListener, { once: true });
            }
            state.pending.push(entry);
            state.pending.sort((left, right) => (
                right.priority - left.priority
                || left.sequence - right.sequence
            ));
            this.drain(key, state);
        });
    }

    snapshot() {
        return [...this.connections.entries()].map(([key, state]) => ({
            key,
            active: state.active,
            activeLabel: state.activeLabel,
            pending: state.pending.map((entry) => ({
                label: entry.label,
                priority: entry.priority,
            })),
        }));
    }

    cleanup(key, state) {
        if (!state.active && !state.pending.length) this.connections.delete(key);
    }

    drain(key, state) {
        if (state.active) return;
        const entry = state.pending.shift();
        if (!entry) {
            this.cleanup(key, state);
            return;
        }
        if (entry.abortListener && entry.signal?.removeEventListener) {
            entry.signal.removeEventListener('abort', entry.abortListener);
        }
        if (entry.signal?.aborted) {
            entry.reject(abortError(entry.signal.reason));
            this.drain(key, state);
            return;
        }

        state.active = true;
        state.activeLabel = entry.label;
        Promise.resolve()
            .then(entry.run)
            .then((value) => {
                state.active = false;
                state.activeLabel = '';
                this.drain(key, state);
                entry.resolve(value);
            }, (error) => {
                state.active = false;
                state.activeLabel = '';
                this.drain(key, state);
                entry.reject(error);
            });
    }
}
