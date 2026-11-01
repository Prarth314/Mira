# Five-minute desktop demo

Use the unsigned internal build or a production-compiled source checkout. This is a demonstration script, not evidence of real-user usefulness. Use only the [synthetic demo folder](../evaluation/demo-project/auth.ts); no private repository or recording is needed.

1. **Setup:** open Speech setup, choose a microphone, explicitly check access, and verify/download the English model. Explain that the check stream stops immediately and Dictate needs no provider key.
2. **Capture:** say or type: “Keep session t t l at 300. Do not change refresh session.” Recording requires the user's chosen microphone; automated CI uses a fake device instead.
3. **Context/review:** connect `evaluation/demo-project`, enable project-aware dictation, select `auth.ts`, then prepare a new instruction. Review `sessionTTL` / `refreshSession` suggestions and their source; accept one, keep another, undo and compare the immutable original.
4. **Optional refinement:** choose **Refine reviewed text** only after explaining that the instruction goes to the configured provider. Without a key, demonstrate the safe fallback. Do not configure a real key or make a live call as part of the default demo.
5. **Delivery:** copy into an owned disposable document. Explain attempted native paste versus confirmed receipt and why Mira does not retry uncertain delivery or press Enter.
6. **Recovery:** cancel a recording, close/reopen the workspace, show saved microphone choice and the diagnostic preview. For a compact-recorder session, open the workspace with Ctrl / Cmd + Shift + M and use its keyboard-accessible Cancel control. Never expose actual keys or private content in a recording.
7. **Evidence:** show [the matrix](ENGINEERING_EVIDENCE.md), [benchmark limits](BENCHMARKS.md), and outstanding signing/hardware/user-validation gates rather than calling the beta universally production-ready.

## Suggested résumé bullets

Use only after checking the linked results against the revision you present; retain team-origin attribution in the project description.

- Engineered an Electron/React voice workspace with local Whisper inference, sandboxed renderers, validated IPC, scoped filesystem access, OS-encrypted credentials and atomic preference recovery.
- Implemented owned recording sessions and cancellation across microphone permission races, worklet/native-process failures and window lifecycle events; verified with 170 unit tests, Electron end-to-end checks and Windows/macOS internal packaging workflows.
- Built versioned evaluation fixtures and repeatable desktop benchmarks; measured a 390 ms median usable-workspace startup (five launches) and 1.39 s median processing of an 11-second public speech sample (three runs) on one Ryzen 7 Windows machine.

These describe engineering and scoped measurements. They do not imply broad speech accuracy, users, productivity gains, independent security certification or a signed public release.
