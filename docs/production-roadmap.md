# Production execution tracker

This is the active roadmap. Historical plans and research remain under `PLAN.md` and `docs/research/`. A checked item means implemented and verified as described, not independently certified production-ready.

## Release contract

Deliver a desktop voice workspace: record → transcribe → inspect/refine → choose destination → deliver. Windows first; macOS follows the same acceptance gates. English first. Local transcription; optional user-key cloud processing. No accounts, billing, autonomous shell execution, or unsupported platform claims in v1.

## Milestones

1. **Repository and build foundation:** MIT license, attribution, readable documentation, compiled main/preload, local styling, pinned tooling, CI, internal packaging.
2. **Trusted core:** runtime-validated IPC, trusted sender/window roles, permissions, navigation restrictions, owned sessions, cancellation, bounded resources, atomic settings and keys.
3. **Useful voice beta:** self-contained speech runtime, model lifecycle, microphone setup, explicit draft review, safe destination adapters, recovery and local dictation fallback.
4. **Distinctive beta:** opt-in project index, scoped and visible context, original/refined prompt comparison, reliable editor integration, evaluated technical vocabulary.
5. **Release candidate:** native acceptance matrix, performance baselines, accessibility, signed installers, authenticated update path, migrations and failed-update recovery.
6. **Public release:** observed beta use, corrected recurring defects, verified public desktop downloads on the deployed website, privacy documentation, support process and maintenance policy.

## Feasibility gates

- Install/run a packaged Windows app without Node or source files.
- Prove recording, transcription, destination identity and delivery outside development mode.
- Benchmark minimum supported hardware before promising latency or accuracy.
- Compare a real workflow with the tester's current tool before expanding modes.
- Validate repository vocabulary on held-out examples; preserve ambiguous originals.

## Quality gates

- No known critical security defects; malformed IPC cannot invoke capabilities.
- No cross-window session mixing or stale-result delivery after acknowledged cancellation.
- No blind retries of uncertain delivery; distinguish prepared, attempted and confirmed.
- Terminal paste never automatically executes in the initial release.
- No raw audio/transcripts/keys in default diagnostics.
- Every advertised OS/tool combination passes native acceptance tests.
- Clean install, upgrade, settings migration, interrupted update and uninstall are exercised.

## External prerequisites

Signed public releases require publisher credentials. macOS behavior requires real macOS testing. Product validation requires consenting beta users. These are release gates, not tasks that can be marked complete from Windows unit tests.

## Evidence

### Project-aware dictation

Implemented: opt-in local filename suggestions after transcription, explicit choice for ambiguous filenames, original transcript retention, single-correction undo, and explicitly saved project-specific pronunciations with editing/removal. Technical-detail and negation checks also appear during draft editing. Matching uses filename-derived spoken forms and aliases, not model fine-tuning or a semantic index. Tests cover matching boundaries, ambiguous candidates, stale/forged correction rejection, project-scoped persistence, and the Electron review workflow. See [the feature guide](PROJECT_AWARE_DICTATION.md).

Still to evaluate: real developer correction time, false suggestions, technical accuracy across accents and microphones, and repeat usage. No measured productivity or accuracy improvement is claimed.

Follow-up: attached JS/TS snapshots now supply parser-based top-level declaration hints, with source labels and spelled-acronym matching. Explicit index refresh handles renamed files and clears attachment snapshots; corrections recheck target existence and symbol-source freshness. This is scoped declaration extraction, not a repository-wide semantic index.

### Website deployment — October 31, 2026

The [Mira website](https://mira-gilt-chi.vercel.app) is deployed on Vercel and configured as the repository homepage in GitHub. An HTTP check returned 200, and the deployed renderer serves the workspace UI. Native capabilities still require the Electron preload and main process; the browser deployment is a UI preview, not a complete web implementation of the desktop workflow. Public desktop download distribution and release validation remain outstanding.

Record the exact commit, OS/app versions, hardware, sample size, failure definitions and commands for each release candidate. Tests must measure transcript meaning, technical terms, cancellation, routing, latency and resource use. Do not infer external receipt from a successfully issued keyboard shortcut.

## Implementation evidence — October 30, 2026

- Repository: MIT license, attributed README, contributor/security guidance, GitHub description and topics published.
- Build: strict TypeScript, lint, local CSS, compiled main/preload, three-OS CI. Initial Windows unpacked build and desktop smoke test passed.
- Trusted core: registered-window/top-frame IPC checks, role restrictions, bounded inputs, microphone-only permission handling, navigation restrictions, atomic serialized settings/key writes.
- Voice workspace: owned recording sessions, AudioWorklet capture, cancellable processing, optional cloud refinement, editable draft review, manual copy, explicit attempted-delivery semantics and terminal control-character rejection.
- Speech: pinned official runtime/source archives, resource manifest, pinned model revision/checksum, progress/cancellation, disk checks. Real English transcription through IPC passed with the upstream JFK sample on Windows.
- Automated baseline: 90 unit tests passed, plus desktop preparation/copy/discard, context, microphone cancellation, late permission and cold overlay validation. Automated WCAG checks cover the workspace and settings dialog; manual assistive-technology testing remains necessary.

- Project context: opt-in folder selection, local filename indexing, Git-style ignore rules, explicit attachment previews, boundary checks, bounded content and stale-file checks. Unit and desktop tests verify selected source is copied and `.env` content is excluded.
- CI: both Windows and macOS internal packaging jobs and desktop smoke tests passed for `5d2a636`.
- Recovery: versioned preferences with legacy migration, explicit reset with backup, key removal, corruption-preserving failure handling and allowlisted diagnostic reports.
- Packaging: branded Windows internal installer built locally; CI install/uninstall checks run only on disposable runners. Public signed distribution is not enabled.
- Retention: temporary WAV files are confined to app-owned speech scratch directories, with abandoned-directory cleanup on startup. See [PRIVACY.md](../PRIVACY.md).
- Performance: one public sample transcribed through the IPC pipeline; measured report and limitations are under [benchmarks](benchmarks/windows-public-sample.json).

Remaining: direct editor integration, broader accessibility testing, observed native delivery matrix, performance evaluation corpus, signed installers, authenticated updates, public beta and user validation. Public stable release remains blocked on those acceptance gates and signing credentials.
