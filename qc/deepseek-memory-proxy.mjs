import http from 'node:http';

let apiKey = String(process.env.DS_TEST_KEY || '').trim();
const port = Number(process.env.DS_TEST_PORT || 9328);
const metrics = [];

function sendJson(response, status, value) {
    response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'DELETE, GET, POST, OPTIONS',
    });
    response.end(JSON.stringify(value));
}

function requestCredential(request) {
    if (apiKey) return apiKey;
    const authorization = String(request.headers.authorization || '').trim();
    const matched = authorization.match(/^Bearer\s+(.+)$/iu);
    return String(matched?.[1] || '').trim();
}

async function readJson(request, limit = 16384) {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
        length += chunk.length;
        if (length > limit) throw new Error('request body too large');
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': 'authorization, content-type',
            'access-control-allow-methods': 'DELETE, GET, POST, OPTIONS',
        });
        response.end();
        return;
    }

    if (request.method === 'GET' && request.url === '/health') {
        sendJson(response, 200, {
            ok: true,
            credentialLoaded: Boolean(apiKey),
            requestCredentialAccepted: true,
        });
        return;
    }

    if (request.method === 'GET' && request.url === '/metrics') {
        sendJson(response, 200, metrics);
        return;
    }

    if (request.method === 'POST' && request.url === '/credential') {
        try {
            const body = await readJson(request);
            apiKey = String(body.apiKey || '').trim();
            sendJson(response, apiKey ? 200 : 400, { ok: Boolean(apiKey) });
        } catch {
            apiKey = '';
            sendJson(response, 400, { ok: false });
        }
        return;
    }

    if (request.method === 'DELETE' && request.url === '/credential') {
        apiKey = '';
        sendJson(response, 200, { ok: true });
        return;
    }

    if (request.method === 'GET' && ['/models', '/v1/models'].includes(request.url)) {
        sendJson(response, 200, {
            object: 'list',
            data: [
                { id: 'deepseek-v4-flash', object: 'model', owned_by: 'deepseek' },
                { id: 'deepseek-v4-pro', object: 'model', owned_by: 'deepseek' },
            ],
        });
        return;
    }

    if (
        request.method !== 'POST'
        || !['/chat/completions', '/v1/chat/completions'].includes(request.url)
    ) {
        sendJson(response, 404, { error: { message: 'not found' } });
        return;
    }

    const activeCredential = requestCredential(request);
    if (!activeCredential) {
        sendJson(response, 401, { error: { message: 'QC credential is not loaded' } });
        return;
    }

    const startedAt = Date.now();
    const metric = {
        startedAt,
        inputBytes: 0,
        model: '',
        stream: false,
        status: 0,
        durationMs: 0,
    };

    try {
        const parsed = await readJson(request, 2 * 1024 * 1024);
        metric.inputBytes = Buffer.byteLength(JSON.stringify(parsed));
        metric.model = String(parsed.model || '');
        metric.stream = parsed.stream === true;

        const upstream = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${activeCredential}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                ...parsed,
                thinking: parsed.thinking || { type: 'disabled' },
            }),
        });
        metric.status = upstream.status;

        const headers = Object.fromEntries(
            [...upstream.headers.entries()].filter(
                ([name]) => !['content-length', 'content-encoding', 'transfer-encoding']
                    .includes(name.toLowerCase()),
            ),
        );
        headers['access-control-allow-origin'] = '*';
        response.writeHead(upstream.status, headers);

        if (upstream.body) {
            const reader = upstream.body.getReader();
            while (true) {
                const part = await reader.read();
                if (part.done) break;
                response.write(Buffer.from(part.value));
            }
        }
        response.end();
    } catch (error) {
        metric.status = 599;
        sendJson(response, 502, {
            error: {
                message: String(error?.message || error),
                type: 'proxy_error',
            },
        });
    } finally {
        metric.durationMs = Date.now() - startedAt;
        metrics.push(metric);
        if (metrics.length > 50) metrics.shift();
    }
});

function shutdown() {
    apiKey = '';
    server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.listen(port, '127.0.0.1', () => {
    console.log(`DeepSeek QC proxy listening on http://127.0.0.1:${port}`);
});
