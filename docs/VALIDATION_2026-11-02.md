# Full desktop validation — November 2, 2026

Tested application source: `ca09efbbea38537eb188d2f26ff9146bb15f9302`, including the destroyed-WebContents crash fix. Local application checks and benchmarks ran against a clean checkout before this evidence-only documentation update. Existing benchmark snapshots remain unchanged.

## Executed checks

| Check | Result / scope |
| --- | --- |
| `npm run check` | Passed lint, strict TypeScript, 171 unit tests across 29 files, and production build. |
| `npm run format:check` | Passed. |
| Default Playwright | All three Electron scenarios passed, including main-process exception monitoring during recorder destruction, keyboard/copy, encrypted storage, and preference restart/recovery. |
| `npm run evaluate` | Eleven synthetic cases matched expected suggestion sets and fallback decisions; eight abstentions, four fallbacks, no policy errors. Three audio cases remain unmeasured. |
| `npm run prepare:speech` / `npm run test:speech` | Verified pinned runtime; real local inference on the public upstream sample passed without provider credentials. |
| `npm run test:performance` | Passed startup, cancellation, indexing, idle/resource, responsiveness and nine speech trials. |
| `npm run test:native` | Exact synthetic text received in an owned disposable Windows target; closed target rejected; no Enter/automatic submission. |
| `npm run package` | Built unsigned Windows x64 installer locally with publishing disabled. |
| `node scripts/smoke-packaged.mjs` | All three scenarios passed against the local unpacked packaged executable. |
| `node scripts/smoke-packaged.mjs --speech` | Real packaged inference passed; expected public-sample phrase recognized, draft unsubmitted. |
| `node scripts/archive-internal.mjs` | Generated local installer checksum/manifest. The local manifest's CI-only `sourceCommit` field is null; the tested source revision is recorded above and in the speech/benchmark reports. |
| Crash-fix source CI | [Passed Windows/macOS/Linux](https://github.com/Prarth314/Mira/actions/runs/41332503699). |
| Fresh Windows/macOS packaging | [Both passed](https://github.com/Prarth314/Mira/actions/runs/41485613126), including packaged speech, macOS bundle startup and disposable Windows install/run/uninstall. |
| Fresh optional cross-platform measurements | [Both passed](https://github.com/Prarth314/Mira/actions/runs/41485618577): public speech, Windows/macOS performance, three paired macOS native-mode comparisons and Windows controlled native delivery. Native paste fixture is Windows-only. |

## Local Windows measurements

Environment: Windows x64 `10.0.26300`, Ryzen 7 8840HS, 16 logical processors, 15 GiB reported memory, Electron 45.1.0, pinned whisper.cpp 1.9.2 / verified English base model. Source performance measurements are production-compiled, `packaged: false`. Model/runtime hashes, samples and full boundaries are retained in the [performance JSON](benchmarks/2026-11-02/local-windows-desktop-performance.json).

| Measurement | Observation | Boundary |
| --- | --- | --- |
| Usable workspace startup | Median 430 ms; range 427–528 ms | Five fresh-profile launches; OS caches may be warm. |
| Recording cancellation | Median 48 ms; range 36–60 ms | Five synthetic recordings, current-session audio through idle acknowledgement. |
| Filename indexing: 100 / 1,000 / 5,000 files | Median 4.15 / 10.22 / 28.70 ms | Three reconnects per flat synthetic dataset. |
| Speech: 1 / 5 / 11 seconds | Median 1.67 / 1.78 / 2.06 s | Three trials per clip, zero errors; includes IPC, hash verification, fresh native process/model load, inference, cleanup and sampler overhead. |
| IPC + animation-frame response | Median 2.93 ms; p95 8.68 ms; max 47.77 ms | 148 probes during processing, a responsiveness proxy. |
| Idle Electron CPU | Median 0.047% | Five short observations, not a long-duration or battery study. |
| Idle / sampled peak Electron working sets | Median 638 MiB / peak 710 MiB | Aggregate process working sets can double-count shared pages. |
| Native Whisper peak working set | 304 MiB | 32 owned-child observations, zero sampler query errors, 250 ms sampling; short processes may be missed. |
| Performance-suite model setup | 86.3 s | One network download plus verification, separate from inference. |
| Standalone public-sample speech | 2.118 s | One 11-second clip; setup separately 92.092 s. |
| Local packaged public-sample speech | 2.054 s | One 11-second clip through packaged IPC; setup separately 3.575 s. |

These are observations from one run, not evidence of an optimization speedup, a latency guarantee or broad ASR accuracy. Full-transcript WER, independently reviewed semantics, separate model-load/inference timing and battery impact remain unmeasured. See the shared [methodology](BENCHMARKS.md).

## Cross-platform observations

| Measurement | Windows x64 CI | macOS ARM64 CI | Scope |
| --- | --- | --- | --- |
| Startup median | 448 ms | 1,895 ms | Five fresh-profile launches each; different virtual hardware. |
| Cancellation median | 35 ms | 103 ms | Five synthetic sessions each; macOS maximum 482 ms. |
| 1 / 5 / 11-second speech median | 1.99 / 2.13 / 2.44 s | 2.33 / 2.25 / 2.51 s | Three trials per duration, zero reported errors on each platform; later multi-trial performance suite with responsiveness probes. |
| Standalone packaged 11-second speech | 2.517 s | 22.269 s | One observation per platform; separately created profiles and runtime builds. |

The macOS standalone source speech observation was also slow (23.942 s), whereas the later performance-suite full-clip samples were 4.302 / 2.512 / 2.292 s. The cause of this large difference is **not isolated**. Workload, OS caches, process scheduling and measurement conditions are uncontrolled; none is established as the explanation. Do not present the faster later trials as an optimization or a consumer-device guarantee. Profile physical Macs and instrument loading/inference separately before setting a latency promise.

The same-runner, interleaved direct CLI comparison used the same public WAV/model and four threads for three pairs: default median 41.89 s, CPU-only median 19.37 s, with CPU-only lower in all three pairs (about 54% lower median). That supports the existing CPU beta baseline on this runner only. These CLI durations exclude IPC, model hash verification and WAV preparation and are not comparable to the performance-suite medians as a speedup.

## Preserved evidence

- Local: [desktop contract](benchmarks/2026-11-02/local-windows-desktop-contract.json), [synthetic evaluation](benchmarks/2026-11-02/local-windows-evaluation.json), [public speech](benchmarks/2026-11-02/local-windows-speech-benchmark.json), [performance](benchmarks/2026-11-02/local-windows-desktop-performance.json), [native fixture](benchmarks/2026-11-02/local-windows-native-delivery.json).
- Local packaged build: [contract](benchmarks/2026-11-02/local-windows-packaged-contract.json), [speech](benchmarks/2026-11-02/local-windows-packaged-speech.json), [installer digest](benchmarks/2026-11-02/local-windows-installer.json).
- Windows CI: [speech](benchmarks/2026-11-02/ci-windows-speech-benchmark.json), [performance](benchmarks/2026-11-02/ci-windows-desktop-performance.json), [native fixture](benchmarks/2026-11-02/ci-windows-native-delivery.json), [packaged speech](benchmarks/2026-11-02/ci-windows-packaged-speech.json).
- macOS ARM64 CI: [standalone speech and native-mode pairs](benchmarks/2026-11-02/ci-macos-speech-benchmark.json), [performance](benchmarks/2026-11-02/ci-macos-desktop-performance.json), [packaged speech](benchmarks/2026-11-02/ci-macos-packaged-speech.json). All passed their scoped checks; standalone latency and cross-run variability remain limitations.

## Remaining manual and external gates

No real microphone or private recording was captured. Physical input selection/unplug/permission recovery and actual sleep/wake require hands-on testing. Real VS Code/Cursor/assistant focus and receipt, macOS Accessibility routing, physical-Mac latency, screen readers, consented speech references and beta usefulness remain unverified. Controlled fixture receipt does not certify a real editor, and production delivery remains an attempted paste.

No AI-provider credits were spent. Live-provider quality requires an explicitly configured provider/model and bounded budget. No testers were contacted. Signing/notarization credentials, authenticated updates and public-release approval remain separate gates. No public release was published.
