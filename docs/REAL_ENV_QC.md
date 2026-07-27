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
   `LICENSE`, `manifest.json`, `model-queue.mjs`, `protocol-core.mjs`, `social-core.mjs`, `README.md`,
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

Either inject the credential from an approved secret source into
`POST http://127.0.0.1:9328/credential` with JSON `{ "apiKey": "..." }`. The endpoint
returns only `{ "ok": true }`; the proxy never prints or persists the key. Configure
the forum/lightweight model route to `http://127.0.0.1:9328/v1`. When the approved
credential is already stored in the explicitly selected local QC profile, the proxy
may instead accept that profile's `Authorization: Bearer ...` header for the current
request only. It forwards the value without logging, returning, or retaining it.

Before continuing, verify `/health` reports `ok: true` and
`requestCredentialAccepted: true`. If using explicit injection, also require
`credentialLoaded: true`.

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

## 5A. Versioned scenario-plan checks

Run this section for every major continuity/world-engine repair. It is also mandatory
whenever scenario goals, completion/failure conditions, apex threats, routes, time
limits, stakes, phases, or closure behavior can change.

1. Use a disposable bounded-scenario chat with explicit on-page evidence. A real
   model world pass may create `scenarioPlan` only when that evidence is sufficient.
   Require an active v0 plan, at least one baseline evidence item, and a
   `baselineSourceRef` that resolves to the processed assistant message.
2. Confirm the event panel exposes the current version and the immutable baseline,
   including the original goal, completion condition, apex threat, route, evidence,
   and source floor. The scenario summary target must be at least 42px high.
3. Produce one genuine main-model turn in which a player decision materially changes
   the established structure through an existing `main_derivative` event. Run the
   real world model again and require v1 or later with:
   `causeType=player_action`, one or more `sourceThreadIds`, a trigger, mechanism,
   evidence, exact before/after field changes, preserved achievements, and a source
   pointer back to that genuine assistant turn.
4. Confirm the current version changes while every v0 baseline field remains
   unchanged. Expand the revision history and verify the cause, evidence, field
   deltas, preserved achievements, and source floor are readable at 390x844.
5. The automated suite must prove the complementary rejection paths: a same-turn
   improvised `world_chain` cannot rewrite the plan; missing preservation evidence,
   an incorrect `before` value, invalid phases, and reopening a terminal plan are
   rejected. It must also prove that a mature pre-existing world chain may amend the
   plan, and that an apex threat can be removed as well as escalated.
6. Confirm the final main-chat injection describes the active plan as a soft
   structure, carries accepted revisions, forbids unsourced extra bosses/goals, and
   does not force a branch into every reply.

Do not manufacture a stronger boss merely to exercise the gate. A real apex
escalation is valid only when the selected QC chat already contains a mature,
pre-existing source chain. Otherwise the deterministic policy test is the required
evidence for that path.

## 5B. Social-motive and relationship ablation checks

Run this section whenever the narrative motive contract, closed-option isolation,
relationship detection, semantic second review, social audit persistence, or related
model routing changes.

1. Do not use DeepSeek as the main story model for proof of narrative improvement.
   Its default tone may already be warmer than the affected main model and cannot
   demonstrate that the plugin caused the change.
2. Use the same explicitly selected main model, disposable chat baseline, character,
   preset, user inputs, generation settings, and branch starting point for an A/B
   ablation. In A, disable only `socialNarrativeGuardEnabled`; in B, enable it. Keep
   the relationship second reviewer unchanged. Record only sanitized classifications,
   never raw private prompts or responses.
3. Cover at least: buying tea, bringing food, offering medicine, asking about a night
   shift, a dark character sincerely helping an ally, and an NPC with justified but
   limited suspicion. B must reduce unsupported omniscient motive attribution without
   forcing every NPC to trust the player or making the prose uniformly warm.
4. Inspect the real final chat-completion payload. Require the social contract sentinel
   to be present. Seed an old assistant message containing an unselected extreme
   `<options>` or `<branches>` candidate and require that block to be absent from the
   model-bound assistant history while remaining visible and unchanged in the stored
   chat. System format instructions and the user's actually submitted choice must
   remain present.
5. Use a traceable relationship-change case in which ordinary care was incorrectly
   persisted as control, fanaticism, ownership, or a comparable major relationship.
   Require one lightweight semantic review, a decision for every changed relationship
   path, restoration of rejected paths only, preservation of unrelated MVU values, a
   persisted correction block, and a source-linked social audit record.
6. Run a complementary explicit-dark case through the same second reviewer: an
   authorized threat, coercive ability, or other clearly selected dark action with a
   rule-supported consequence. Require `allow`, no relationship rollback caused by
   the reviewer's warm tone, and no narrative rewriting by the reviewer.
7. Confirm balanced mode makes no semantic call on an ordinary turn without a
   relationship change or suspicious motive attribution. Confirm usage/cost fields,
   per-chat monthly accumulation, the ¥5 soft warning behavior, and the configurable
   ¥10 hard-cap fallback without persisting a credential or raw model payload.
8. The automated suite must also replay fixed hostile outputs. This separates local
   enforcement from provider personality and is mandatory even when the live A/B
   sample appears improved.

## 5C. Phase-6 stable-barrier and downstream checks

Run this section whenever narrative repair ordering, the V2 host bridge, task
leases, recovery persistence, database integration, continuity, memory, or forum
downstream behavior changes.

1. Before the repair/model task begins, require a durable phase-6 record for the
   exact chat, logical floor, message identity, swipe, branch, and content
   fingerprint in `captured`.
2. Observe the record advance through `repairing` and `state-committing`. No
   database, memory, continuity, or forum reader may receive the narrative in
   either state.
3. Require the state transaction write-ahead record to be durable before the
   exact write, then require exact readback and a final fingerprint recheck before
   `settled`.
4. Call compatibility API v4 `runAfterTargetSettled`. Its reader must receive the
   final narrative and fingerprint only after `settled`. Repeat with regenerate,
   new swipe, chat switch, failure, and cancellation; each old target must return
   `abandoned/stale/failed` and produce zero downstream writes.
5. Reload the same chat and confirm the barrier, idempotency settlement, recovery
   record, TaskLease terminal state, and final fingerprint remain available.
6. Exercise TaskLease progress, a visible soft-cancel path, missed heartbeats, and
   hard timeout. A timed-out or stale late result must not call any unverified
   state or database writer.
7. Exercise the database gate with 600 and 601 Unicode characters, parameterized
   and concatenated SQL, and matching/conflicting revisions. The 601 +
   non-parameterized + revision-conflict case must report all three issues and
   perform zero commits.
8. Record only barrier states, fingerprints/digests, counts, status codes and
   durations. Do not record final narrative, a full prompt, raw payload or
   credential. Use `docs/2.0/PHASE_6_REAL_QC_TEMPLATE.json`.

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
