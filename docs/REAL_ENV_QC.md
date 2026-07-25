# Real SillyTavern release QC

This is the mandatory release gate for major MVU Auto Doctor repairs. Automated tests
are necessary but not sufficient: pushing is allowed only after the same source state
passes a real SillyTavern host, a real model response, and mobile interaction checks.

## Safety and scope

- Use a disposable or explicitly selected QC chat. A forum refresh writes generated
  posts into that chat's extension metadata.
- Keep the model credential in memory only. Do not place it in repository files,
  SillyTavern configuration, shell history, screenshots, logs, reports, or archives.
- Do not upload `data/`, private chats, browser state, raw prompts, raw model responses,
  or user profiles.
- The reproducible environment recipe is archived in this repository. The private
  runtime instance and its user data remain local.

## Reference environment

| Component | Required value |
| --- | --- |
| SillyTavern | 1.18.0 release, commit `8172dcd` or a deliberately approved newer build |
| Host URL | `http://127.0.0.1:8011` |
| Browser launch | disabled in SillyTavern config |
| Extension path | `data/default-user/extensions/mvu-auto-doctor` |
| QC model proxy | `qc/deepseek-memory-proxy.mjs` on `127.0.0.1:9328` |
| Mobile viewport | 390×844 CSS pixels |
| Minimum touch target | 42×42 CSS pixels |

The public extension URL must resolve to
`/scripts/extensions/third-party/mvu-auto-doctor/`. Prefer the user extension
directory as the single source. Use a public-directory mirror only when the local
fixture server requires it, and verify that only one effective extension URL is
loaded.

## 1. Prepare the exact source state

1. Ensure implementation and tests are complete.
2. Run `npm run qc:fingerprint` and place the result in the matching
   `docs/qc-reports/vX.Y.Z.json`.
3. Copy the release files into the real user extension directory:
   `CHANGELOG.md`, `continuity-core.mjs`, `core.mjs`, `forum-core.mjs`, `index.js`,
   `LICENSE`, `manifest.json`, `model-queue.mjs`, `protocol-core.mjs`, `README.md`,
   and `style.css`.
4. Confirm the served manifest and the in-app version badge match the release.

## 2. Start the real host

Start SillyTavern as a hidden background process with port 8011 and
`browserLaunch.enabled: false`. Verify:

```text
GET http://127.0.0.1:8011/ -> 200
```

Open the real UI through background browser control, not a mocked DOM and not
foreground desktop automation. Load the explicitly selected character and QC chat.

## 3. Start the memory-only model proxy

Start:

```powershell
$env:DS_TEST_PORT = "9328"
node qc/deepseek-memory-proxy.mjs
```

Inject the credential from an approved secret source into
`POST http://127.0.0.1:9328/credential` with JSON `{ "apiKey": "..." }`. The endpoint
returns only `{ "ok": true }`; the proxy never prints or persists the key. Configure
the forum/lightweight model route to `http://127.0.0.1:9328/v1`.

Before continuing, verify `/health` reports `ok: true` and `credentialLoaded: true`.

## 4. Real forum and model checks

1. Open the selected real chat and the MVU Auto Doctor world panel.
2. Confirm the displayed plugin version.
3. Open the full forum with an actual pointer/touch click. Keyboard activation is an
   additional accessibility check, not a substitute for pointer/touch.
4. Refresh the forum.
5. Poll `/metrics` until the request completes. Require HTTP 200; 401, 403, 429, 5xx,
   parse fallback, or local synthetic posts fail QC.
6. Confirm the generated page is persisted in the selected chat, contains multiple
   topics, and renders category, title, body, author, heat, replies, and comments.
7. Generate another page when needed to obtain a body longer than the collapse
   threshold. Confirm history and pagination remain coherent.

## 5. Interaction and mobile checks

At 390×844:

1. Open the world panel and require its actual bounding box to remain fully inside the
   visual viewport. Then open the full forum with a pointer/touch click and require
   its panel to cover, but not extend beyond, the same viewport. This must be checked
   in the real SillyTavern root geometry; a mock page without SillyTavern's
   transformed root is not sufficient.
2. Require every topic card to expose exactly one
   `.mvuad-forum-thread-toggle`. A collapsed topic must line-clamp the owner post,
   keep the reply section `hidden`, and give both the reply section and every reply
   a zero-size visible rectangle.
3. Require the whole-thread button's bounding box to be at least 42×42.
4. Require the forum shell `scrollWidth <= clientWidth`.
5. Click `展开 N 条评论` (or `展开全文` when there are no replies) once. Require all
   of the following from that same click:
   `aria-expanded=true`, `.is-expanded`, the complete owner body, every reply,
   and no separate body/reply expansion control. The owner body's text must exactly
   match its source value, `overflow` must not clip, line clamp must be disabled,
   `scrollHeight === clientHeight`, and a DOM `Range` around the final characters
   must have a non-zero rectangle inside the reachable card. Hide the hot-comment
   preview while the real reply list is open.
6. Click `收起全文与评论` (or `收起全文`) and require the exact inverse:
   `aria-expanded=false`, no `.is-expanded`, owner body clamped, and replies hidden.
7. Capture and visually inspect both collapsed and expanded states. Reject clipped
   owner-post endings, missing replies, clipped headers, unreadable text,
   controls outside the shell, button/text overlap, inaccessible refresh/close
   controls, or a layout that loses the mobile information-flow density.

Also recheck the default desktop viewport when the repair affects shared layout.

## 6. Automated suite

Run the complete suite and wait for the browser runtime file to finish:

```powershell
npm.cmd test
```

Do not treat an external timeout as success. The suite must report zero failures.

## 7. Evidence, cleanup, and push gate

1. Update `docs/qc-reports/vX.Y.Z.json` with sanitized metrics.
2. Run `npm run qc:ci`.
3. Stop the credential proxy and verify the process is gone. Leaving the explicitly
   requested SillyTavern host running is acceptable; leaving the API key proxy running
   is not.
4. Build the offline release archive and record its SHA-256.
5. Commit the source, tests, report, policy, and intended artifacts.
6. Run:

```bash
npm run qc:install
npm run qc:record
npm run qc:gate
git push
```

`qc:record` binds the ignored local receipt to the exact committed `HEAD` and report
hash. Any later code edit, amended commit, version change, report change, expiration,
or dirty tracked file invalidates the receipt and blocks the tracked pre-push hook.

## Failure rule

Any reproducible defect, unexpected fallback, non-200 model result, interaction
failure, visual defect, test failure, or missing evidence fails QC. Fix it and repeat
the entire affected section. Do not push first and promise to verify later.
