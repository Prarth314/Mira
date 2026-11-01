# Desktop measurement methodology

Run `npm run prepare:speech`, then `npm run test:performance`. This optional command uses isolated profiles, synthetic microphone input, temporary projects, the pinned public English model, and upstream public speech clips. It contacts the public model host but never calls an AI provider or records a real microphone. Close unrelated heavy workloads when comparing runs.

The [recorded Windows run](benchmarks/windows-desktop-v1.json) measured clean source commit `e8790b2` on Windows x64, OS release `10.0.26300`, Ryzen 7 8840HS, 16 logical processors and 15 GiB reported memory. It used Electron 45.1.0, pinned whisper.cpp v1.9.2 and verified `ggml-base.en.bin`. The JSON retains exact model/runtime hashes. This is a production-compiled source checkout (`packaged: false`), not installer startup or a CI-runner/consumer-device guarantee.

| Measurement | Observed result | Samples and boundary |
| --- | --- | --- |
| Startup to usable workspace | Median 390 ms; range 378–430 ms | Five fresh profiles; process launch through enabled typed input and responding IPC. OS/filesystem cache may be warm. |
| Recording cancellation | Median 50 ms; range 37–51 ms | Five synthetic recordings with current-session PCM observed; click through idle acknowledgement. Hardware release is checked in capture tests. |
| Local transcription/draft preparation | Median 1.24 / 1.28 / 1.39 s for 1 / 5 / 11 s clips | Three runs per duration. Includes IPC, model hash verification, a fresh native process/model load, inference and cleanup, plus sampler interval overhead. |
| Filename indexing | Median 5.04 / 5.89 / 16.54 ms for 100 / 1,000 / 5,000 files | Three reconnects per flat synthetic dataset. Not a deep monorepo, watcher or semantic-index benchmark. |
| IPC + animation-frame response during inference | Median 2.69 ms; p95 40.16 ms; max 54.05 ms | 104 probes during processing. This is a proxy, not a complete input-to-paint responsiveness score. |
| Idle Electron CPU | Median 0.045%; range 0–0.497% | Five 200 ms-spaced observations via Electron app metrics; not a long-duration idle or battery study. |
| Idle Electron working sets | Median 617 MiB | Sum of Electron process working sets; shared pages can be counted more than once. Not unique physical memory. |
| Sampled peak Electron working sets | 661 MiB | During the speech runs; separate from native child. |
| Native Whisper peak working set | 303 MiB | Windows OS PeakWorkingSet64 observed for owned Whisper child PIDs, 24 observations, zero query errors. Short-lived peaks/processes can be missed. |
| Model setup | 101.5 s | One public-model download plus verification. Network/setup cost is separate from startup and speech latency. |

The first speech process and subsequent processes are recorded in order. Whisper is invoked afresh each time, so this does **not** isolate model-load time from inference or demonstrate a persistent warm model. A separate read-only Windows sampler polls only children of the measured Electron main PID every 250 ms; its overhead is included. Native-child measurement is platform-specific. Battery and model-load/inference decomposition remain unmeasured.

Small groups report min/median/max; p95 is null below 20 observations. No optimization speedup is inferred by comparing these numbers to an older run with different boundaries. The concrete changes in this milestone address observed recovery/resource defects; this establishes a baseline for future performance work.

The public-sample smoke command is `npm run test:speech`. Its report asserts a known phrase and keeps the draft unsubmitted. It does not claim full-transcript WER or broad English accuracy without an independently reviewed reference. [Historical one-sample result](benchmarks/windows-public-sample.json) remains labeled with its earlier scope.

## macOS CI investigation

The [Windows public-sample CI run](benchmarks/windows-speech-ci-v1.json) processed the 11-second clip in 2.74 seconds; the [macOS ARM64 CI baseline](benchmarks/macos-speech-ci-v1.json) took 48.8 seconds. These are individual observations on different runners, not a platform ranking.

A subsequent [matched macOS native-mode experiment](benchmarks/macos-native-mode-comparison-v1.json) at `8fda466` ran three interleaved pairs on the same 3-logical-CPU, 7-GiB ARM64 runner. Median default-mode CLI duration was 35.10 seconds; CPU-only (`-ng`) median was 18.47 seconds, lower in all three pairs (about 47% lower median). Both modes used the same four-thread setting, WAV and verified model. Each invocation loaded a new process/model after an initial app inference; OS caches may be warm. This boundary excludes IPC, hash verification and WAV preparation. It does not isolate GPU initialization, explain the cause, or predict consumer Mac performance.

The beta now uses CPU-only mode on macOS, with thread count bounded by available processors and a maximum of four on all platforms. Consumer-device GPU tuning remains unverified. Packaged-app end-to-end results must be read separately from this CLI comparison.

## Packaged-app confirmation

At `b17b4ef`, the [Windows x64 packaged app](benchmarks/windows-packaged-speech-v1.json) processed the 11-second public sample in 1.411 seconds; the [macOS ARM64 packaged app](benchmarks/macos-packaged-speech-v1.json) took 18.655 seconds using the CPU baseline. Each is one end-to-end IPC/model-verification/native-inference/draft-preparation observation, not a distribution or a paired speedup experiment. Model download/verification setup was separately 3.504 seconds and 2.370 seconds. Both reports assert the known phrase, verified model and bundled runtime, with `packaged: true`; neither measures full-transcript WER.

The macOS CI latency still exceeds the clip duration. This is an explicit remaining performance limitation: benchmark physical target Macs before promising interactive latency. These measurements do not establish a universal platform difference or isolate model loading. [Packaging run](https://github.com/Prarth314/Mira/actions/runs/41331722381) also exercises disposable Windows installation/run/uninstall and macOS bundle startup.
