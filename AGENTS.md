# Mandatory real-environment QC

Any major repair must pass the real SillyTavern QC procedure before it is pushed.

A major repair includes changes to runtime JavaScript, CSS, model routing, persistence,
forum/world continuity, MVU writes, host lifecycle handling, or release metadata. Pure
documentation changes are exempt only when they do not change packaged runtime files.

Required order:

1. Finish implementation and automated tests.
2. Follow `docs/REAL_ENV_QC.md` against a real SillyTavern instance on
   `http://127.0.0.1:8011`.
3. Use a real model request through the memory-only QC proxy. Never store or commit the
   API key.
4. Verify the actual character chat, generated forum content, pointer/touch opening,
   full-text expand/collapse, and the 390×844 mobile layout.
5. For social-motive or relationship changes, run the same-main-model A/B ablation in
   `docs/REAL_ENV_QC.md`; DeepSeek's own warm tone is not proof that the runtime guard
   worked.
6. Update the matching structured report in `docs/qc-reports/`.
7. Run `npm run qc:ci`, commit the complete change, then run `npm run qc:record`.
8. Run `npm run qc:gate`. Push only when it passes.

The tracked `.githooks/pre-push` hook enforces the receipt for this clone. Install it
with `npm run qc:install`. Do not bypass the hook with `--no-verify`. A failing or
incomplete real-environment check is a hard stop: fix the defect, repeat QC, update the
report, recommit, and record a new receipt before pushing.

Never include API keys, raw private chats, user data directories, cookies, browser
profiles, or unredacted model payloads in a QC report or archive.

That reporting rule does not prohibit normal, explicitly authorized model inference.
Author-published character cards and the card, preset, world-book, or synthetic QC
context that would normally be sent to the user's selected model may be used in real
QC. Private user-chat originals require explicit authorization or an isolated,
sanitized copy. In every case, keep credentials and raw request/response payloads out
of repository files, reports, screenshots, archives, and delegated tasks.

Privacy uncertainty is not a reason to skip real QC. Isolate the test, minimize the
data, use a public/synthetic fixture when needed, and continue testing. Block only the
specific case whose boundary cannot be proved; do not convert that uncertainty into a
claim that the product passed.
