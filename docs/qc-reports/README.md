# Real-environment QC reports

Each release that changes packaged runtime behavior must add or update
`vX.Y.Z.json`. Reports are deliberately structured so the local push gate and GitHub
Actions can validate them.

The `codeFingerprint` is the SHA-256 fingerprint printed by:

```bash
npm run qc:fingerprint
```

Record only sanitized evidence. Never include an API key, raw private chat, user data
directory, cookies, browser profile, full request payload, or full model response.

After the report and code are committed, create the local commit-bound receipt:

```bash
npm run qc:record
npm run qc:gate
```

The receipt lives in ignored `.qc/real-env-pass.json`. It is intentionally local,
expires after seven days, and becomes invalid whenever `HEAD`, the release version, or
the tracked report changes.
