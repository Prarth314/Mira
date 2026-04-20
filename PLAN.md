# Mira — Voice for Cursor & Claude Code (Wedge Pivot 2026-04-18)

> **NOTE — scope change.** The original plan was a general voice-controlled OS actuator with five typed actions. After /office-hours + codex landscape research (Wispr's "Master Plan" March 2026 + ChatGPT macOS voice retired Jan 2026 + Apple Voice Control rarely used in practice), the wedge collapsed to **voice-to-dev-tool prompt routing** for AI-heavy developers. The infrastructure stays; the product framing changes. Original sections below are preserved with updates inline. Full diagnostic and recommended approach lives at `~/.gstack/projects/Prarth314-Mira/eshwarankrishnan-feat-multi-provider-voice-design-20260418-214224.md`.

## Goal

Voice front-end for AI-heavy developers using Cursor, Claude Code, Warp, iTerm, Terminal, and VSCode. Press ⌥Space anywhere on macOS, speak a coding instruction, the cleaned-up text lands in the focused dev tool's prompt input — optionally auto-sent. Provider-agnostic infrastructure (Anthropic + OpenAI) but Anthropic Claude is the v0.1 default, OpenAI hidden behind "advanced".

## Scope (v0.1)

In: macOS Electron app. Press-and-hold Space to talk, on-device Whisper transcribes, Claude or GPT picks one of a few **strictly typed actions** (no freeform shell), main process runs it, `say` speaks the response. Optional one-shot screen capture for vision.

Out:
- Wake-word ("Hey Mira") — press-to-talk only
- Voice-Activity Detection — push-to-talk press/release IS the segmentation
- Cross-platform parity — macOS only; Windows/Linux as v0.2
- `TYPE` (keystroke injection) — Accessibility-permission UX is its own scope
- `BRIGHTNESS_ADJUST` — depends on out-of-tree binary; cut until we ship a real solution
- `SYSTEM` action with freeform `exec` — replaced by typed actions; see Security
- Streaming provider responses — non-streaming v0.1 (tool-use only fires at end-of-turn anyway)
- Conversation persistence across provider switches — switching clears history in v0.1
- Hosted/multi-user, billing

## What already exists (reuse, do not rebuild)

- `App.tsx` mic capture (`getUserMedia` + `AudioContext` 16kHz Int16) — keep, point at IPC
- `App.tsx` screen capture (`getDisplayMedia` + canvas → JPEG @0.4) — keep, gated to one-shot
- `App.tsx` `SystemHUD`, `components/AudioVisualizer.tsx`, `components/Sidebar.tsx` — keep
- `utils/audio.ts` — `decodeAudioData` becomes dead code (no remote audio playback). `encode`/`decode` likewise. **Delete in Phase 2.**

## Architecture

```
┌──────────────────────────────── Renderer (Chromium) ────────────────────────────────┐
│                                                                                      │
│  React UI ── useVoiceLoop()                                                          │
│      │                                                                               │
│      ├── press Space  ─► IPC: 'mira:voice:start'                                    │
│      ├── mic chunks   ─► IPC: 'mira:voice:chunk' (Buffer Int16, 16kHz)              │
│      ├── release Space ─► IPC: 'mira:voice:end'  ◄─── triggers full turn in main    │
│      ├── screen shot   ─► IPC: 'mira:vision:capture' (when actuator asks)           │
│      └── transcript + tool events ◄──── IPC events from main                        │
│                                                                                      │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
                                   │ Electron IPC (typed, async)
┌──────────────────────────────────▼───────────────────────────────────────────────────┐
│                              Main (Node, holds keys)                                 │
│                                                                                      │
│  src/main/ipc.ts ── channel registry                                                 │
│      │                                                                               │
│      ├──► src/main/stt.ts          (spawned `whisper.cpp` binary, sidecar process) │
│      ├──► src/main/conversation.ts (history owner: messages, tool results, trim)    │
│      ├──► src/providers/           (anthropic.ts, openai.ts behind Provider iface)  │
│      │       └── chat({ messages, tools, image? }): Promise<ChatResponse>           │
│      ├──► src/main/actuator.ts     (typed dispatch — NO freeform shell strings)    │
│      ├──► src/main/tts.ts          (spawn `say`; pluggable iface)                   │
│      ├──► src/main/keystore.ts     (electron safeStorage)                           │
│      └──► src/main/permissions.ts  (Accessibility / Screen Recording probes)        │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**IPC boundary rule:** browser-only APIs (mic, screen, audio playback, UI) stay in renderer. API keys, provider HTTP, native modules, OS calls live in main. Renderer never imports `@anthropic-ai/sdk` or `openai`. Enforced by ESLint `no-restricted-imports`.

## Phases

### Phase 1 — Foundation ✓ (committed)

- Reorg: `components/`, `utils/`
- Vite + React bundling replaces AI-Studio importmap
- `npm run dev` spawns Vite + Electron; `npm run build` produces `dist/`
- Untracked `.env.local`; `.env.local.example` lists `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
- App.tsx temporarily `// @ts-nocheck`'d at the top with a Phase-2-target comment, so `tsc --noEmit` passes despite the surviving Gemini code
- README rewritten — no more `GEMINI_API_KEY` references

### Phase 2 — Provider abstraction + IPC backbone

This is the rewrite. Renaming it doesn't make it smaller — owning that.

**New files:**
- `src/types/provider.ts` — `Provider`, `Tool`, `Msg`, `ChatResponse`, `ToolCall`
- `src/types/actions.ts` — discriminated union for every actuator action (typed, no freeform)
- `src/types/MiraError.ts` — single error union
- `src/providers/anthropic.ts`, `src/providers/openai.ts`, `src/providers/index.ts`
- `src/main/ipc.ts`, `src/main/keystore.ts`, `src/main/conversation.ts`
- `hooks/useVoiceLoop.ts` — extracts orchestration from App.tsx
- Settings panel (minimal): provider switcher + key entry
- `tests/unit/providers/{anthropic,openai}.test.ts`, `tests/unit/normalization.test.ts`, `tests/unit/conversation.test.ts`

**Action types (canonical, single source):**
```ts
type Action =
  | { kind: 'launch_app'; appName: string }              // mdfind-validated
  | { kind: 'open_url'; url: string }                    // https? only
  | { kind: 'set_volume'; level: number }                // 0..100, clamped
  | { kind: 'describe_screen' }                          // triggers vision capture
  | { kind: 'speak'; text: string };                     // direct TTS, no actuation
```
No `exec`. No `SYSTEM`. No raw shell. The LLM can only emit values that fit one of these shapes; the adapter rejects anything else with `MiraError 'tool_parse'`.

**Provider interface (non-streaming v0.1):**
```ts
type ChatResponse = {
  text: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
};

interface Provider {
  name: 'anthropic' | 'openai';
  chat(input: {
    messages: Msg[];
    tools: Tool[];
    images?: Buffer[];      // adapter encodes as base64 for both providers
    systemPrompt?: string;
  }): Promise<ChatResponse>;
}
```

**Conversation ownership:** `src/main/conversation.ts`. Holds `Msg[]` per session. Appends user transcript, assistant reply, tool calls, tool results in provider-neutral form. Truncates by token budget (rough heuristic: 4 chars/token, target 8000-token context). Provider adapters convert this neutral history to their own format on each call.

**Provider switching v0.1:** clears the conversation. Toast: "Switching providers clears chat history." Document explicitly.

**Per-request retry:** 3 attempts, backoff 200/400/800ms on 429/5xx. 401 → no retry, surface MiraError immediately.

**Key handling:** `electron safeStorage` (OS keychain on macOS). Encrypted at rest at `~/Library/Application Support/Mira/keys.enc`. Renderer requests `mira:keys:status` (booleans only) and `mira:keys:save` (write-only). Plaintext key never crosses IPC after initial save.

**Exit:** Settings panel switches provider. Spoken "open calculator" produces equivalent (semantically parallel — not byte-identical) tool call on both. Both pass the same eval suite (Phase 3).

### Phase 3 — On-device voice (push-to-talk only)

**New files:**
- `src/main/stt.ts` — spawns `whisper.cpp` binary as a sidecar process
- `src/main/tts.ts` — spawns `say`; kills prior in-flight utterance before starting next
- `src/main/audio-buffer.ts` — accumulates renderer chunks between `voice:start` and `voice:end`
- `vendor/whisper/` — bundled `whisper-cli` binary + model (see Distribution below)
- `tests/unit/stt.test.ts`, `tests/unit/tts.test.ts`, `tests/unit/audio-buffer.test.ts`

**STT decision: spawn `whisper.cpp` binary, not `nodejs-whisper` bindings.**

Codex was right. Native Node addons inside Electron mean ABI mismatches, `electron-rebuild` for every Electron upgrade, codesigning headaches, notarization. A spawned binary is a static dependency. We control the build, sign the binary alongside the app, done.

- Binary: `whisper-cli` from whisper.cpp (Metal-accelerated on Apple Silicon)
- Model: `ggml-base.en.bin` (~140MB), bundled in app or first-run download (decision: **first-run download** with progress bar; keeps installer small)
- Per turn: write PCM to temp WAV, exec `whisper-cli -m model.bin -f input.wav -nt -of txt`, read `.txt`
- Latency target: <1.5s on M1 for a 5s utterance; tune model size if too slow

**Voice loop:**
```
press Space   ─► main:  conversation.beginTurn()
mic chunks    ─► main:  audio-buffer.append(pcm)
release Space ─► main:  pcm = audio-buffer.flush()
                        wavPath = await wav.write(pcm)
                        text = await stt.transcribe(wavPath)
                        conversation.addUserMessage(text)
                        response = await provider.chat(conversation.snapshot())
                        for each toolCall: result = await actuator.run(toolCall.action)
                                            conversation.addToolResult(toolCall.id, result)
                        // if any toolCall returns intermediate vision-needed:
                        //   capture screen, re-call provider with images
                        await tts.speak(response.text)
```

**No VAD.** Press = open buffer; release = close buffer. Trivial, deterministic, debuggable. VAD is v0.2.

**Exit:** Press Space, say "Open Calculator," release. Calculator launches. `say` confirms. Logs show transcript, tool call, result.

### Phase 4 — Actuator + vision + permissions

**New files:**
- `src/main/actuator.ts` — typed action dispatcher
- `src/main/system-info.ts` — `systeminformation` for real telemetry (replaces `Math.random` in Sidebar)
- `src/main/permissions.ts` — first-launch wizard + per-action probe
- `tests/unit/actuator.test.ts`, `tests/e2e/launch-app.spec.ts`

**Actions (macOS v0.1):**
| Action | Implementation | Permissions |
|---|---|---|
| `launch_app` | `child_process.exec('open -a "<name>"')`, name validated against `mdfind` allowlist | none |
| `open_url` | `child_process.exec('open <url>')` after `URL.parse` + `https?:` check | none |
| `set_volume` | `osascript -e 'set volume output volume <0-100>'`, clamped | none |
| `describe_screen` | renderer captures via `desktopCapturer` → JPEG → IPC → main → next provider call | **Screen Recording** — first-launch wizard probes via `desktopCapturer.getSources` and prompts user to grant in System Settings; opens Settings deeplink |
| `speak` | direct `tts.speak(text)` | none |

**Cut from v0.1 (security/feasibility):**
- `SYSTEM` with freeform `exec`/`uri` — was the prompt-injection escalation path
- `TYPE` — Accessibility permission, separate scope
- `BRIGHTNESS_ADJUST` — needs out-of-tree binary or private API

**First-launch wizard (`src/main/permissions.ts`):**
- Probes Microphone (renderer-side `getUserMedia` → caught error if denied)
- Probes Screen Recording (`desktopCapturer.getSources` returns empty if denied)
- For each missing: shows in-app card with "Grant in System Settings" deeplink (`x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone`)
- Persists wizard-completed flag in `~/Library/Application Support/Mira/state.json`

**Telemetry:** `systeminformation` (Layer 1, cross-platform, MIT). Sidebar `Math.random` deleted.

**Exit:** Each non-deferred action works end-to-end on a freshly installed app on a clean macOS user account.

### Phase 5 — Distribution

Codex was right that this is feasibility, not afterwork. Without it the project is a dev-only toy.

**New files:**
- `electron-builder.yml` — macOS target, dmg + zip
- `.github/workflows/release.yml` — build + sign + notarize on tag
- Code signing certs in GH Actions secrets (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `MAC_CERTS`, `MAC_CERTS_PASSWORD`)
- `vendor/whisper/` shipped via `extraResources` in builder config

**Pipeline:**
```
git tag v0.1.0 ─► GH Actions ─► npm ci ─► npm run build ─► electron-builder
                                                                │
                                                ┌───────────────┼───────────────┐
                                                ▼               ▼               ▼
                                       sign with cert    notarize via       publish to
                                                          notarytool        GH Releases
```

**Whisper model distribution:** model file (`ggml-base.en.bin`, ~140MB) NOT bundled in app. First-launch downloader fetches from a known mirror with SHA-256 verification, stores in `~/Library/Application Support/Mira/models/`. Keeps installer ~80MB instead of ~220MB.

**Exit:** `git tag v0.1.0 && git push --tags` produces a signed, notarized DMG that opens cleanly on a Mac that has never seen this binary before.

## Test plan

**Framework:** Vitest (Vite-native). Add `vitest`, `@vitest/ui`, `@testing-library/react`, `playwright`, `@playwright/test` to devDeps.

```
PROVIDER LAYER                                              E2E?
══════════════                                              ════
[+] src/providers/anthropic.ts
    ├── chat() text-only                                    unit
    ├── chat() one tool call (well-formed)                  unit
    ├── chat() two tool calls in one response               unit
    ├── chat() with image                                   unit
    ├── chat() malformed tool args → MiraError 'tool_parse' unit  ← security
    ├── chat() 401 → MiraError no retry                     unit
    ├── chat() 429 → retries 3x with backoff                unit
    ├── chat() 500 → retries 3x with backoff                unit
    └── chat() network timeout → MiraError                  unit
[+] src/providers/openai.ts                                 (mirror)
[+] src/providers/index.ts (factory)
    ├── selects anthropic when provider=anthropic           unit
    ├── selects openai when provider=openai                 unit
    └── throws MiraError when key missing                   unit
[+] action schema validation (src/types/actions.ts)
    ├── valid launch_app                                    unit
    ├── valid open_url                                      unit
    ├── open_url with javascript: → reject                  unit  ← security
    ├── open_url with file: → reject                        unit  ← security
    ├── launch_app with shell metachars in name → reject    unit  ← security
    ├── set_volume 50 → ok                                  unit
    ├── set_volume -1 / 101 → clamps                        unit
    └── unknown kind → MiraError 'tool_parse'               unit

CONVERSATION LAYER
══════════════════
[+] src/main/conversation.ts
    ├── empty history snapshot                              unit
    ├── add user → snapshot has user msg                    unit
    ├── add assistant + tool calls                          unit
    ├── add tool result threads to right tool_use id        unit
    ├── truncates oldest pair when over budget              unit
    └── reset() clears                                      unit

STT / TTS / AUDIO BUFFER
════════════════════════
[+] src/main/stt.ts
    ├── transcribe(short.wav) → "hello world"               unit (fixture)
    ├── empty/silent input → ""                             unit
    └── propagates whisper-cli exit code != 0 as MiraError  unit
[+] src/main/tts.ts
    ├── speak('hello') resolves on `say` exit               unit
    ├── speak() interrupts prior in-flight utterance        unit
    └── platform != darwin → MiraError 'tts_unsupported'    unit
[+] src/main/audio-buffer.ts
    ├── append/flush round-trips PCM                        unit
    └── flush after no append → empty buffer                unit

ACTUATOR LAYER
══════════════
[+] src/main/actuator.ts
    ├── launch_app 'Calculator'                             unit (mocked exec)
    ├── launch_app unknown → MiraError 'app_not_found'      unit
    ├── open_url valid https                                unit
    ├── open_url javascript: → MiraError                    unit  ← security
    ├── set_volume clamping                                 unit
    └── unknown action.kind → MiraError                     unit

IPC LAYER
═════════
[+] src/main/ipc.ts
    ├── voice round-trip                                    unit
    ├── chat round-trip                                     unit
    ├── rejects calls when key missing                      unit
    └── rejects unknown channels                            unit

PERMISSIONS
═══════════
[+] src/main/permissions.ts
    ├── probe screen recording (mocked desktopCapturer)     unit
    └── probe microphone                                    unit

E2E (Playwright + Electron)
═══════════════════════════
[+] Spoken "open calculator" launches Calculator.app        E2E [→E2E]
[+] Provider switch in settings clears history              E2E [→E2E]
[+] Vision: "describe the screen" returns text              E2E [→E2E]
[+] Missing API key shows toast + opens settings            E2E [→E2E]
[+] First launch with no permissions shows wizard           E2E [→E2E]

EVAL (LLM judge)
════════════════
[+] Tool-selection eval: 20 spoken commands                 eval [→EVAL]
    Same suite run against both providers; judged by
    Claude on whether the right action.kind + args were
    emitted. Tracks regressions when system prompt changes.
    Phase 3 dependency.

DISTRIBUTION
════════════
[+] electron-builder config
    └── builds + signs + notarizes on macOS 14+ runner      CI

──────────────────────────────────────────────────────────
COVERAGE TARGET (Phase 2-5 exit): 100% of new files
ZERO TESTS TODAY.
GAPS: 47 paths, write each alongside its impl.
──────────────────────────────────────────────────────────
```

## Failure modes (one realistic failure per new codepath)

| Failure | Test | Handled | UX |
|---|---|---|---|
| Provider 401 mid-conversation | yes | yes | toast → opens settings |
| Provider 429 burst | yes | retry+backoff | spinner, no error if retry succeeds |
| Whisper model download fails | yes | retry button | progress bar + retry |
| `whisper-cli` binary missing/corrupt | yes | startup probe | block app start with download retry |
| `say` binary missing on macOS | yes (theoretical) | surface MiraError | toast |
| `osascript` permission denied (Automation) | E2E | surface MiraError | toast → "Grant in System Settings" |
| Mic permission denied | yes (E2E) | wizard prompt | first-launch wizard |
| Screen Recording denied | yes (E2E) | wizard prompt | first-launch wizard |
| Whisper hallucinates a command | mitigated by transcript-preview | logged, **executed only after preview** | 700ms preview chip with cancel |
| LLM emits malformed/unknown action | yes | reject at adapter | toast: "model returned invalid action" |
| LLM tries prompt-injection via vision | mitigated by typed actions only | no shell, no SYSTEM, can't escalate | n/a — by construction |

**Critical mitigation (security):** the typed `Action` union is the moat. The LLM cannot ask the actuator to run a shell command or open a URI scheme outside the allowlist, because there is no field in the schema for it. Vision-driven prompt injection becomes a no-op against unknown action kinds.

**Critical UX (transcript preview):** before any actuator dispatch, render a 700ms preview chip showing the transcript and the proposed action ("Open Calculator?"). User can press Esc to cancel. Defaults to execute on timeout. Stops most "whisper hallucinated a command" footguns without blocking the happy path.

## Architectural decisions (resolved)

1. **IPC boundary** — Renderer = browser APIs + UI. Main = keys + providers + native + OS. ESLint enforced.
2. **Whisper binding** — **Spawned `whisper.cpp` binary**, not `nodejs-whisper` bindings. Avoids native ABI / `electron-rebuild` / signing pain. (Codex influence.)
3. **Tool schema translation** — One source (TS types). Per-provider adapters. Adapters reject malformed args.
4. **Action schema** — Typed discriminated union. **No freeform shell strings ever.** (Codex influence — closes prompt-injection escalation path.)
5. **Streaming** — Non-streaming v0.1. Tool-use only fires at end-of-turn. Add streaming for spoken response in v0.2 if perceived latency demands it.
6. **Vision cadence** — One-shot, triggered by `describe_screen` action.
7. **Auto-reconnect** — Removed entirely. Per-request retry replaces it.
8. **Conversation ownership** — `src/main/conversation.ts`, single owner. (Codex influence — was unowned.)
9. **Conversation on provider switch** — Cleared. Documented in UI.
10. **Error model** — Single `MiraError` discriminated union. Single error toast. No silent failures.
11. **Key storage** — `electron safeStorage` (OS keychain).
12. **VAD** — None v0.1. Push-to-talk press/release IS the segmentation. (Codex influence.)
13. **Distribution** — `electron-builder` with macOS sign+notarize from day one. (Codex influence — was hand-waved.)
14. **Provider parity** — Semantic parity on the v0.1 command set, not byte-identical behavior. Eval suite enforces. (Codex influence.)

## Permissions checklist (macOS)

| Permission | Required for | Probe | Surfaced when |
|---|---|---|---|
| Microphone | always | `getUserMedia` rejection | first launch wizard |
| Screen Recording | `describe_screen` | empty `desktopCapturer.getSources` | first launch wizard, blocks vision |
| Automation (Apple Events) | `set_volume` (osascript) | first `osascript` triggers system prompt | on first invocation |

`x-apple.systempreferences:` deeplinks open the right pane for each.

## Open questions (defer or decide later)

- **Cross-platform TTS** — Piper for Windows/Linux. Punted to v0.2; ship macOS-first.
- **Settings UI** — minimal panel in v0.1 (provider switcher + key entry); proper preferences window in v0.2.
- **Transcript preview duration** — 700ms default; tunable; data-collect later.

## Worktree parallelization

| Step | Modules | Depends on |
|---|---|---|
| 2A: Provider iface + adapters | `src/providers/`, `src/types/` | — |
| 2B: IPC + keystore + settings | `src/main/{ipc,keystore}.ts`, settings UI | — |
| 2C: Conversation owner | `src/main/conversation.ts` | — |
| 3A: STT (whisper-cli wrapper) | `src/main/stt.ts` | — |
| 3B: TTS | `src/main/tts.ts` | — |
| 3C: Audio buffer | `src/main/audio-buffer.ts` | — |
| 3D: Voice loop wiring | `hooks/useVoiceLoop.ts`, App.tsx rewrite | 2A, 2B, 2C, 3A, 3B, 3C |
| 4A: Actuator | `src/main/actuator.ts` | 2B |
| 4B: System info / telemetry | `src/main/system-info.ts`, `Sidebar.tsx` | 2B |
| 4C: Permissions wizard | `src/main/permissions.ts`, wizard UI | 2B |
| 5A: electron-builder config | `electron-builder.yml`, `package.json` | 2-4 stable enough to package |
| 5B: GH Actions release pipeline | `.github/workflows/release.yml` | 5A |

**Lanes (after Phase 1 lands):**
- Lane A: 2A → 2B → 2C → 3D → integration commit
- Lanes B/C/D: 3A, 3B, 3C in parallel
- Lanes E/F/G: 4A, 4B, 4C after 2B
- Lane H: 5A then 5B

**Conflict watch:** Lanes A, E, F, G all touch `src/main/`. 2B writes the IPC channel registry first; later lanes only register handlers, never edit the registry shape.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 12 raised, 9 incorporated, 2 already-addressed-in-v2, 1 reframed |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 14 architectural decisions resolved, 47 test paths planned, 1 critical security fix (typed actions) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** caught typecheck regression in Phase 1, surfaced critical security gap (freeform `exec` enables prompt-injection-to-shell), pushed back on `nodejs-whisper` (correct — spawn binary instead), called out missing conversation ownership, deferred BRIGHTNESS_ADJUST, demanded explicit packaging story.

**CROSS-MODEL:** Strong agreement on every point that landed. Two points (IPC ownership, streaming/non-streaming) were already addressed in the v2 plan that codex was reading; no genuine tension.

**UNRESOLVED:** transcript-preview duration (700ms default, tunable later — not blocking).

**VERDICT:** ENG CLEARED — ready to implement Phase 2.
