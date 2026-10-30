# Contributing to Mira

Use Node 24 and `npm ci`. Before opening a change, run `npm run typecheck`, `npm test`, and `npm run build`.

## Working together

- Fetch before starting; use a short-lived branch for a focused change.
- Keep commits small, describe the behavior changed, and push completed work promptly.
- Never force-push shared branches or overwrite someone else's local changes.
- Add regression coverage for behavior changes, especially IPC, native routing, cancellation, and persistence.
- Describe which operating systems were actually tested. A renderer build does not verify native automation.
- Do not commit credentials, audio recordings, private repositories, screenshots, or transcript logs.

See [the production tracker](docs/production-roadmap.md) before picking up a milestone. Changes to IPC contracts, settings schemas, native resources, or packaging should document compatibility implications.

## Attribution

Mira started as a collaborative hackathon prototype. Preserve existing authorship and notices. Contributions are provided under the repository's MIT license; bundled third-party components retain their respective licenses.
