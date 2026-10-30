# Security

Mira handles microphone audio, API keys, project context, and desktop input. Do not include those materials in public issue reports.

Use GitHub's private vulnerability reporting when available. Otherwise contact the maintainer through their GitHub profile to arrange a private report before sharing exploit details. Do not open a public issue containing credentials or a working sensitive exploit.

The current development release is not a security-audited stable release. Production readiness is tracked in [the release checklist](docs/production-roadmap.md).

## Intended boundaries

- Provider keys remain in the Electron main process and use operating-system-backed encrypted storage.
- Local transcription does not imply that optional provider processing is offline.
- Project context and screenshots must be explicitly selected before external transmission.
- Provider output must not grant itself permissions or enable automatic submission.
- External application input is not transactional; uncertain delivery must never trigger an automatic retry.
