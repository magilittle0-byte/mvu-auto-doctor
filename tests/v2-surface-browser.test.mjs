import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.dirname(here);
const bundledNodeModules = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
    '.pnpm',
);
const bundledDirectPlaywright = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
    'playwright',
    'index.mjs',
);
const bundledPlaywright = fs.existsSync(bundledNodeModules)
    ? fs.readdirSync(bundledNodeModules)
        .filter((name) => /^playwright@/u.test(name))
        .map((name) => path.join(
            bundledNodeModules,
            name,
            'node_modules',
            'playwright',
            'index.mjs',
        ))
        .find((candidate) => fs.existsSync(candidate))
    : '';
const playwrightPath = [
    process.env.PLAYWRIGHT_PATH,
    path.join(pluginRoot, 'node_modules', 'playwright', 'index.mjs'),
    bundledPlaywright,
    bundledDirectPlaywright,
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

if (!playwrightPath) {
    if (process.env.CI) {
        throw new Error(
            'Playwright is unavailable in CI; phase-5 browser regression cannot be skipped',
        );
    }
    console.log('phase-5 browser regression skipped: Playwright is unavailable');
    process.exit(0);
}

const { chromium } = await import(pathToFileURL(playwrightPath).href);
const systemBrowser = [
    process.env.MVUAD_BROWSER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

const harness = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <link rel="stylesheet" href="/style.css">
  <style>
    :root {
      --SmartThemeBodyColor: #e8eef5;
      --SmartThemeBlurTintColor: #111925;
      --SmartThemeBorderColor: #536477;
      --mvuad-accent: #79a9ff;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; margin: 0; }
    body {
      padding: 16px;
      color: var(--SmartThemeBodyColor);
      background: #0a1018;
      font: 14px/1.45 "Microsoft YaHei UI", system-ui, sans-serif;
    }
    button, select, textarea {
      border: 1px solid var(--SmartThemeBorderColor);
      border-radius: 7px;
      color: inherit;
      background: #182332;
    }
    button:disabled { opacity: .48; }
  </style>
</head>
<body>
  <button id="launcher" type="button">打开阶段5导演台</button>
  <script type="module">
    import { createTurnBoundary } from '/v2/director/index.mjs';
    import {
      createBranch,
      createMessageFingerprint,
      hashCanonical,
      hashText,
    } from '/v2/transaction/index.mjs';
    import { installDualSurfaceUI } from '/v2/surface/index.mjs';

    const targetResult = createMessageFingerprint({
      chatId: 'chat:surface-browser',
      logicalIndex: 6,
      messageId: 'message:surface-browser',
      swipeId: 0,
      generation: 1,
      branchId: 'branch:surface-browser',
      parentHash: hashText('parent'),
      content: 'exact browser target',
    });
    const target = targetResult.value;
    const branch = createBranch({
      id: target.branchId,
      divergenceFingerprint: target,
      headFingerprint: target,
      checkpointRef: 'checkpoint:surface-browser',
    }).value;
    const evidence = {
      kind: 'message',
      ref: 'message:surface-browser',
      branchId: target.branchId,
    };
    const potion = {
      id: 'item:potion',
      schemaVersion: '2.0',
      revision: 0,
      name: '恢复药剂',
      kind: 'consumable',
      quantity: 2,
      stackable: true,
      description: '类型化恢复道具。',
      mechanics: {
        use: {
          consumes: 1,
          effects: [{
            type: 'resource-delta',
            delta: {
              resource: { ownerId: 'player', resourceId: 'hp' },
              amount: 20,
              reason: 'typed healing',
            },
          }],
        },
      },
      provenance: [evidence],
    };
    const turnBoundary = createTurnBoundary({
      id: 'turn:surface-browser',
      branchId: target.branchId,
      target,
      authorizations: [{
        id: 'authorization:item',
        kind: 'resource-consumption',
        actorId: 'player',
        evidence: [evidence],
      }],
      negativeConstraints: [],
      claims: [],
      unselectedCandidateIds: [],
      protectedPlayerStateRefs: [],
      darkChoices: [],
    }).value;
    const session = {
      catalog: [{
        id: 'action:item',
        label: '使用恢复药剂',
        utterances: ['使用恢复药剂'],
        authorizationId: 'authorization:item',
        actorId: 'player',
        command: {
          type: 'item-use',
          payload: { itemId: potion.id },
        },
      }],
      target,
      currentFingerprint: target,
      activeBranch: branch,
      turnBoundary,
      evidence: [evidence],
      campaign: {
        id: 'campaign:surface-browser',
        version: 'rules:1',
        branchId: target.branchId,
        records: { item: { [potion.id]: '/items/potion' } },
        resources: [{
          resource: { ownerId: 'player', resourceId: 'hp' },
          path: '/resources/player/hp',
          minimum: 0,
          maximum: 100,
        }],
        slotTaxonomy: [],
        slotBindings: [],
        checks: [],
        effectBindings: {},
      },
      state: {
        records: {
          item: { path: '/items/potion', before: potion },
        },
        resources: [{
          resource: { ownerId: 'player', resourceId: 'hp' },
          path: '/resources/player/hp',
          before: 50,
        }],
      },
      createdAt: 700,
      migrations: [{
        kind: 'legacy-skill',
        status: 'unresolved',
        canTransact: false,
      }],
      rollback: {
        available: true,
        status: 'recoverable',
        pathCount: 2,
        recordId: 'rollback:surface-browser',
      },
    };
    const hostState = {
      executeCount: 0,
      undoCount: 0,
      escapedToHost: 0,
      lastPlan: null,
    };
    const host = {
      captureSession: () => structuredClone(session),
      executePlan(plan) {
        hostState.executeCount += 1;
        hostState.lastPlan = structuredClone(plan);
        return { status: 'committed', transactionId: plan.value.transaction.id };
      },
      undo() {
        hostState.undoCount += 1;
        return { status: 'rolled-back' };
      },
    };
    const surface = installDualSurfaceUI({ host });
    document.querySelector('#launcher').addEventListener('click', (event) => {
      surface.open(event.currentTarget);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hostState.escapedToHost += 1;
    });
    window.__SURFACE_TEST__ = { surface, hostState, hashCanonical };
  </script>
</body>
</html>`;

function typeOf(file) {
    if (file.endsWith('.html')) return 'text/html; charset=utf-8';
    if (file.endsWith('.css')) return 'text/css; charset=utf-8';
    return 'text/javascript; charset=utf-8';
}

test('phase-5 director surface is touch-safe, keyboard-safe and confirmation-gated', async () => {
    const server = http.createServer((request, response) => {
        const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
        if (requestPath === '/') {
            response.writeHead(200, { 'content-type': typeOf('.html') });
            response.end(harness);
            return;
        }
        const file = path.resolve(pluginRoot, requestPath.slice(1));
        if (file.startsWith(pluginRoot) && fs.existsSync(file)) {
            response.writeHead(200, { 'content-type': typeOf(file) });
            response.end(fs.readFileSync(file));
            return;
        }
        response.writeHead(404);
        response.end('not found');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const launchOptions = { headless: true };
    if (systemBrowser) launchOptions.executablePath = systemBrowser;
    const browser = await chromium.launch(launchOptions);

    try {
        const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
        });
        await page.goto(`http://127.0.0.1:${port}/`, {
            waitUntil: 'networkidle',
        });
        await page.waitForFunction(() => !!window.__SURFACE_TEST__);

        await page.locator('#launcher').click();
        await page.locator('#mvuad-surface-panel').waitFor({ state: 'visible' });
        assert.equal(
            await page.evaluate(() => document.activeElement?.id),
            'mvuad-surface-natural',
        );

        const mobileMetrics = await page.evaluate(() => {
            const panel = document.querySelector('#mvuad-surface-panel');
            const shell = panel.querySelector('.mvuad-surface-shell');
            const footer = panel.querySelector('.mvuad-surface-footer');
            const execute = panel.querySelector('.mvuad-surface-execute');
            const shellRect = shell.getBoundingClientRect();
            const footerRect = footer.getBoundingClientRect();
            const executeRect = execute.getBoundingClientRect();
            const interactive = [...panel.querySelectorAll(
                'button, select, textarea',
            )].filter((node) => node.getClientRects().length > 0).map((node) => ({
                tag: node.tagName,
                text: node.textContent,
                height: node.getBoundingClientRect().height,
            }));
            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                documentScrollWidth: document.documentElement.scrollWidth,
                panelScrollWidth: panel.scrollWidth,
                shellScrollWidth: shell.scrollWidth,
                shellClientWidth: shell.clientWidth,
                shellRect: {
                    top: shellRect.top,
                    right: shellRect.right,
                    bottom: shellRect.bottom,
                    left: shellRect.left,
                },
                footerRect: {
                    top: footerRect.top,
                    right: footerRect.right,
                    bottom: footerRect.bottom,
                    left: footerRect.left,
                },
                executeRect: {
                    top: executeRect.top,
                    right: executeRect.right,
                    bottom: executeRect.bottom,
                    left: executeRect.left,
                },
                interactive,
            };
        });
        assert.equal(mobileMetrics.viewportWidth, 390);
        assert.equal(mobileMetrics.viewportHeight, 844);
        assert.ok(mobileMetrics.documentScrollWidth <= 390);
        assert.ok(mobileMetrics.panelScrollWidth <= 390);
        assert.ok(
            mobileMetrics.shellScrollWidth <= mobileMetrics.shellClientWidth,
        );
        assert.ok(mobileMetrics.shellRect.left >= 0);
        assert.ok(mobileMetrics.shellRect.top >= 0);
        assert.ok(mobileMetrics.shellRect.right <= 390);
        assert.ok(mobileMetrics.shellRect.bottom <= 844);
        assert.ok(mobileMetrics.footerRect.top >= 0);
        assert.ok(mobileMetrics.footerRect.bottom <= 844);
        assert.ok(mobileMetrics.executeRect.top >= 0);
        assert.ok(mobileMetrics.executeRect.bottom <= 844);
        assert.ok(
            mobileMetrics.interactive.every((entry) => entry.height >= 44),
            JSON.stringify(mobileMetrics.interactive),
        );

        await page.locator('.mvuad-surface-close').focus();
        await page.keyboard.press('Shift+Tab');
        assert.notEqual(
            await page.evaluate(() => document.activeElement),
            null,
        );
        await page.keyboard.press('Escape');
        await page.locator('#mvuad-surface-panel').waitFor({ state: 'hidden' });
        assert.equal(
            await page.evaluate(() => document.activeElement?.id),
            'launcher',
        );
        assert.equal(
            await page.evaluate(() => (
                window.__SURFACE_TEST__.hostState.escapedToHost
            )),
            0,
        );

        await page.keyboard.press('Enter');
        await page.locator('#mvuad-surface-panel').waitFor({ state: 'visible' });
        await page.locator('#mvuad-surface-natural').fill('使用恢复药剂');
        await page.locator('.mvuad-surface-entry-pane')
            .first()
            .locator('button')
            .click();
        await page.locator('.mvuad-surface-confirmation')
            .waitFor({ state: 'visible' });
        assert.equal(
            await page.locator('.mvuad-surface-execute').isDisabled(),
            true,
        );
        assert.equal(
            await page.evaluate(() => window.__SURFACE_TEST__.hostState.executeCount),
            0,
        );

        const disclosure = page.locator('.mvuad-surface-card').first();
        const toggle = disclosure.locator('.mvuad-surface-card-toggle');
        const body = disclosure.locator('.mvuad-surface-card-body');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await body.isHidden(), true);
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await body.isVisible(), true);

        await page.locator('.mvuad-surface-confirm').click();
        await page.waitForFunction(() => (
            window.__SURFACE_TEST__.surface.getResult().status === 'valid'
        ));
        assert.equal(
            await page.locator('.mvuad-surface-execute').isEnabled(),
            true,
        );
        const naturalDigest = await page.evaluate(() => {
            const result = window.__SURFACE_TEST__.surface.getResult();
            return window.__SURFACE_TEST__.hashCanonical({
                command: result.value.candidate.command,
                idempotencyKey: result.value.plan.value.idempotencyKey,
                preconditions: result.value.plan.value.transaction.preconditions,
                transaction: result.value.plan.value.transaction,
            });
        });
        await page.locator('.mvuad-surface-execute').click();
        await page.waitForFunction(() => (
            window.__SURFACE_TEST__.hostState.executeCount === 1
        ));

        const uiPane = page.locator('.mvuad-surface-entry-pane').nth(1);
        await uiPane.locator('select').selectOption('action:item');
        await uiPane.locator('button').focus();
        await page.keyboard.press('Enter');
        await page.locator('.mvuad-surface-confirmation')
            .waitFor({ state: 'visible' });
        assert.equal(
            await page.locator('.mvuad-surface-execute').isDisabled(),
            true,
        );
        await page.locator('.mvuad-surface-confirm').click();
        await page.waitForFunction(() => (
            window.__SURFACE_TEST__.surface.getResult().status === 'valid'
        ));
        const uiDigest = await page.evaluate(() => {
            const result = window.__SURFACE_TEST__.surface.getResult();
            return window.__SURFACE_TEST__.hashCanonical({
                command: result.value.candidate.command,
                idempotencyKey: result.value.plan.value.idempotencyKey,
                preconditions: result.value.plan.value.transaction.preconditions,
                transaction: result.value.plan.value.transaction,
            });
        });
        assert.equal(uiDigest, naturalDigest);
        assert.match(
            await page.locator('.mvuad-surface-card.transaction').innerText(),
            /精确写入|前置条件|幂等键/,
        );
        assert.match(
            await page.locator('.mvuad-surface-card.migration').innerText(),
            /只读/,
        );
        assert.match(
            await page.locator('.mvuad-surface-card.rollback').innerText(),
            /可撤销/,
        );
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
});
