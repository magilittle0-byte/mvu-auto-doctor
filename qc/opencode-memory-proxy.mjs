import http from 'node:http';

const port = Number(process.env.OPENCODE_QC_PORT || 9331);
const upstreamBase = 'https://opencode.ai/zen/go/v1';
const metrics = [];
let apiKey = '';

function sendJson(response, status, value) {
    response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'DELETE, GET, POST, OPTIONS',
    });
    response.end(JSON.stringify(value));
}

async function readJson(request, limit = 2 * 1024 * 1024) {
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
        });
        return;
    }
    if (request.method === 'GET' && request.url === '/metrics') {
        sendJson(response, 200, metrics);
        return;
    }
    if (request.method === 'POST' && request.url === '/credential') {
        const body = await readJson(request, 16 * 1024);
        apiKey = String(body?.apiKey || '');
        sendJson(response, apiKey ? 200 : 400, {
            credentialLoaded: Boolean(apiKey),
        });
        return;
    }
    if (request.method === 'DELETE' && request.url === '/credential') {
        apiKey = '';
        sendJson(response, 200, { credentialLoaded: false });
        return;
    }
    if (
        request.method !== 'POST'
        || !['/chat/completions', '/v1/chat/completions'].includes(request.url)
    ) {
        sendJson(response, 404, { error: { message: 'not found' } });
        return;
    }
    if (!apiKey) {
        sendJson(response, 401, { error: { message: 'QC credential is not loaded' } });
        return;
    }

    const startedAt = Date.now();
    const metric = {
        inputBytes: 0,
        model: '',
        status: 0,
        durationMs: 0,
    };
    try {
        const parsed = await readJson(request);
        metric.inputBytes = Buffer.byteLength(JSON.stringify(parsed));
        metric.model = String(parsed.model || '');
        const upstream = await fetch(`${upstreamBase}/chat/completions`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: parsed.model,
                messages: parsed.messages,
                max_tokens: parsed.max_tokens,
                stream: false,
            }),
        });
        metric.status = upstream.status;
        const body = Buffer.from(await upstream.arrayBuffer());
        const headers = Object.fromEntries(
            [...upstream.headers.entries()].filter(
                ([name]) => !['content-length', 'content-encoding', 'transfer-encoding']
                    .includes(name.toLowerCase()),
            ),
        );
        headers['access-control-allow-origin'] = '*';
        response.writeHead(upstream.status, headers);
        response.end(body);
    } catch {
        metric.status = 599;
        sendJson(response, 502, {
            error: {
                message: 'OpenCode QC proxy failed',
                type: 'proxy_error',
            },
        });
    } finally {
        metric.durationMs = Date.now() - startedAt;
        metrics.push(metric);
        if (metrics.length > 20) metrics.shift();
    }
});

function shutdown() {
    apiKey = '';
    server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.listen(port, '127.0.0.1', () => {
    console.log(`OpenCode QC memory proxy listening on http://127.0.0.1:${port}`);
});
