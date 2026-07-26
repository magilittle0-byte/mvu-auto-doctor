export class SingleWriteQueue {
    #tail = Promise.resolve();

    #pending = 0;

    #active = false;

    get pending() {
        return this.#pending;
    }

    get active() {
        return this.#active;
    }

    enqueue(run, metadata = {}) {
        if (typeof run !== 'function') {
            return Promise.reject(new TypeError('单写入队列任务必须是函数。'));
        }
        this.#pending += 1;
        const task = this.#tail
            .catch(() => undefined)
            .then(async () => {
                this.#pending -= 1;
                this.#active = true;
                try {
                    return await run({ ...metadata });
                } finally {
                    this.#active = false;
                }
            });
        this.#tail = task.then(() => undefined, () => undefined);
        return task;
    }

    async whenIdle() {
        await this.#tail;
    }
}

export function createSingleWriteQueue() {
    return new SingleWriteQueue();
}
