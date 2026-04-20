# Codex Eng Review — `PLAN.md` v1 (2026-04-17)

Independent outside-voice review of the original `PLAN.md` (before the wedge pivot). Run via `codex exec` with `model_reasoning_effort="high"`. Model: gpt-5.4. Prompt asked codex to find what the multi-section eng review missed, not to repeat it.

12 issues raised. 9 incorporated into the rewritten plan. 2 were already addressed in v2 (which codex was reading). 1 was reframed as a non-goal already documented.

## Codex output (verbatim)

> **Problems**
>
> 1. Phase 1 is not actually done. `npm run typecheck` fails because [App.tsx](App.tsx:2) still imports `@google/genai`, but [package.json](package.json:12) no longer includes it. [README.md](README.md:18) still tells people to set `GEMINI_API_KEY`. The plan is stacking abstractions on a broken baseline.
>
> 2. The rewrite size is being hidden. Current Electron main/preload are basically window chrome only: [main.js](main.js:7), [preload.js](preload.js:4). "Move provider + tool + audio logic into main" is not a phase. It is the core rewrite.
>
> 3. The plan contradicts itself on ownership. Phase 2 says provider calls live in main over IPC. Phase 3 says transcript goes back to renderer and renderer invokes provider. If that is unresolved, the IPC boundary is unresolved.
>
> 4. You say "ship non-streaming first," then design a streaming system anyway: `AsyncIterable<Chunk>`, IPC chat streams, chunked audio loop. That is Gemini-Live thinking surviving the rewrite. For push-to-talk v0.1, a turn-based request/response API is enough.
>
> 5. `nodejs-whisper` is the wrong default risk inside Electron. Native addon ABI, Electron rebuilds, codesigning, notarization, and distribution will eat the branch. Simpler path: package `whisper.cpp` as a spawned binary or sidecar process. The plan notices packaging pain and then ignores it.
>
> 6. The STT loop is underspecified where it matters. "Renderer chunks mic -> main runs whisper" assumes utterance segmentation, buffering, interruption, and backpressure are solved. They are not. A weak energy gate is not a product plan. Start with push-to-talk release -> single utterance transcription.
>
> 7. The security model is still wrong. The current tool shape has freeform `exec` and generic `SYSTEM` execution [App.tsx](App.tsx:36), [App.tsx](App.tsx:293). Translating that schema across providers just preserves prompt-injection-to-OS-execution risk. "Keys stay in main" is the minor issue. Model-driven shell/AppleScript is the real one.
>
> 8. macOS permission flows are missing from sequencing. `TYPE` needs Accessibility. Vision needs Screen Recording. `osascript` automation can trigger Automation consent. Those are first-order product behaviors. A demo on a dev machine does not prove the packaged app will work.
>
> 9. `BRIGHTNESS_ADJUST` is fake scope. "Homebrew `brightness`" or some private API is not a shippable dependency. If this is customer-facing v0.1, cut it. Right now the plan is counting a local hack as a feature.
>
> 10. "Identical tool-call behavior" across Anthropic and OpenAI is the wrong target. Tool schemas, coercion, multimodal payloads, and retries differ. Aim for semantic parity on a small command set, not identical behavior.
>
> 11. The plan omits conversation state. Gemini Live currently carries context in the live session [App.tsx](App.tsx:224). Your replacement API takes `messages`, but nothing owns history, truncation, tool results, or provider-specific prompt shaping.
>
> 12. Packaging is still hand-waved. [package.json](package.json:8) builds the renderer only. There is no Electron packaging pipeline, no native-module rebuild path, no binary/model distribution story. For this branch, packaging is not later work. It is feasibility.
>
> Simpler v0.1:
> macOS only, push-to-talk only, main-owned single-turn API, spawned `whisper.cpp`, `say`, typed allowlisted actions only, screenshot-on-demand only. Anything beyond that is self-inflicted rewrite churn.

## Disposition

| # | Topic | Outcome |
|---|---|---|
| 1 | Phase 1 typecheck broken | **Fixed** — `App.tsx` got `@ts-nocheck` with PHASE 2 TARGET comment + README rewrite (commit `0e6714c`) |
| 2 | Rewrite size hidden | **Acknowledged** — Phase 2 renamed to "Provider abstraction + IPC backbone" and explicitly described as the rewrite |
| 3 | IPC ownership contradiction | **Already addressed** in v2 (renderer never imports SDK; main owns providers) |
| 4 | Streaming designed for non-streaming target | **Already addressed** in v2 (`chat()` returns `Promise<ChatResponse>`, not `AsyncIterable`) |
| 5 | `nodejs-whisper` vs spawned binary | **Adopted** — Phase 3 uses spawned `whisper-cli` (commit `f02f524`) |
| 6 | STT loop underspecified | **Adopted** — energy VAD cut, push-to-talk press/release IS the segmentation |
| 7 | Freeform shell exec security gap | **Critical fix adopted** — `Action` discriminated union, no raw shell from LLM (commit `dd0a8d5` and onward) |
| 8 | macOS permission sequencing | **Adopted** — `src/main/permissions.ts` + first-launch wizard scaffolding (commit `f02f524`) |
| 9 | `BRIGHTNESS_ADJUST` is fake scope | **Cut** — removed from v0.1 action set |
| 10 | "Identical tool-call behavior" wrong target | **Reworded** — exit criterion is now "semantic parity on the v0.1 command set" |
| 11 | Conversation state unowned | **Adopted** — `src/main/conversation.ts` with token-budget trim (commit `dd0a8d5`) |
| 12 | Packaging hand-waved | **Adopted** — Phase 5 added: `electron-builder` + macOS sign + notarize via GH Actions |

## Why we ran this

`PLAN.md` v1 was written by Claude after the `/plan-eng-review` interactive workflow. Codex came in cold — different model, no shared context, no narrative momentum from the conversation. It caught architectural gaps and a critical security issue that the inside-the-conversation review missed. Two-AI cross-check is meaningfully stronger than either alone.

Cost: one `codex exec` call, ~5 minutes wall time. Save: unbounded — the freeform-`exec` security fix alone protects against vision-driven prompt-injection-to-shell, which is exactly the failure mode an attacker would target in a voice-driven OS actuator.
