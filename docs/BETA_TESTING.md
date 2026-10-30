# Mira beta acceptance guide

## Internal builds

`npm run package` builds the native installer; `npm run package:dir` builds an unpacked application. Speech binaries are pinned and prepared as part of both commands. GitHub's **Desktop packages** workflow retains internal artifacts for seven days. These builds are unsigned and are not a public stable release.

Download the artifact from a successful [Desktop packages run](https://github.com/Prarth314/Mira/actions/workflows/package.yml). Windows artifacts contain the installer; macOS artifacts contain an inner ZIP made with `ditto` so application permissions and bundle metadata survive artifact storage. Extract that ZIP before opening the app. Each artifact includes `SHA256SUMS.txt` and an unsigned build inventory. Checksums detect transfer corruption; they do not replace publisher signatures.

Use disposable machines or CI for install/uninstall exercises. Never uninstall an existing user's app as part of a smoke test. The Windows CI job installs into a dedicated runner-temp directory and exercises that executable before invoking its own uninstaller.

## Record the environment

For each acceptance run record commit, installer hash, OS version, CPU/architecture, memory, microphone, language, destination application/version, test case, expected result and observed result. Settings → Recovery & diagnostics provides an allowlisted report without transcript text, credentials, project paths or file contents. Review it before sharing.

## Native acceptance matrix

For each advertised editor/terminal on each supported OS:

- Fresh installation and first-run setup, including interrupted model download.
- Record and stop; rapid repeated shortcut presses; cancellation before/after transcription begins.
- Permission denial and recovery; microphone removal; sleep/wake; multiple monitors and scaling.
- Close the destination; change focus; reopen a different window; attempt delivery once.
- Verify prompt lands in the intended focused input. Keyboard injection reports **attempted**, not confirmed receipt.
- Confirm no Return key is injected into terminals and multiline/control-character terminal prompts require manual copy.
- Copy other content during processing and confirm Mira does not later restore an old clipboard value.
- Provider failure, invalid key and rate limit preserve the original instruction.
- Explicit context selection, preview, stale-file rejection and disconnect. Test ignored files and symbolic links.
- Keyboard-only setup, editing and diagnostics; screen reader; contrast; reduced motion.
- Upgrade from the previous build, settings migration, failed update recovery and uninstall.

Automated synthetic microphone tests and the public Whisper sample are smoke tests, not evidence of broad speech accuracy or application compatibility.

## Accuracy and performance

Keep a held-out, consented corpus separate from examples used during development. Measure technical-token preservation, meaning, error rate, transcription/refinement/delivery latency, idle CPU, peak memory and battery impact. Report sample size and hardware. Do not report a percentage from a single public sample as general accuracy.

The opt-in speech test writes `test-results/speech-benchmark.json`. A recorded Windows run is saved in [benchmarks/windows-public-sample.json](benchmarks/windows-public-sample.json): 11 seconds of audio, 1,564 ms for model verification/transcription/draft preparation. Recording time, optional cloud refinement and external delivery are excluded. Model setup was measured separately. This is a smoke benchmark on one environment, not a latency guarantee.

Opt-in public-sample transcription:

```powershell
npm run prepare:speech
npm run build
$env:MIRA_SPEECH_TEST = '1'
npx playwright test tests/e2e/speech.spec.ts
```

## Public release blockers

Publisher signing and macOS notarization credentials; signed native-resource verification; authenticated update testing; real native-tool matrix results; consented beta feedback; final privacy/licensing review. Never label an internal artifact stable just because CI is green.
