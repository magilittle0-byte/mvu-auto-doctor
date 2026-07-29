import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const doctorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const child = spawn(
    process.execPath,
    [path.join(doctorRoot, 'qc', 'deepseek-memory-proxy.mjs')],
    {
        cwd: doctorRoot,
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
        env: {
            ...process.env,
            DS_TEST_KEY: '',
            DS_TEST_PORT: String(process.env.DS_TEST_PORT || 9328),
        },
    },
);
child.unref();
process.stdout.write(`${JSON.stringify({ pid: child.pid })}\n`);
