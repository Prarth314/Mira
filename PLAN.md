# Mira — Provider-Agnostic Voice Actuator

## Goal

Turn the Google-AI-Studio export into a working, provider-flexible voice-controlled desktop actuator. Customers choose Anthropic or OpenAI; voice runs on-device.

## Scope

In: Electron app that boots, listens for wake/press-to-talk, transcribes on-device, calls Claude or GPT with an "actuate" tool, executes OS actions, speaks a response, optionally sends a screen frame for vision.

Out (v0.1): Wake-word, cross-platform parity (macOS first; Windows/Linux later), hosted mode, multi-user, telemetry beyond log viewer.

## Phases

### Phase 1 — Foundation (in progress)
- Reorganize files to match imports (`components/`, `utils/`) ✓
- Remove `@google/genai` importmap hack; add Vite + React bundling ✓
- Dev workflow: `npm run dev` spawns Vite + Electron; prod builds to `dist/` ✓
- Untrack `.env.local`; add `.env.local.example` ✓
- **Exit criterion:** `npm install && npm run dev` opens the window with the existing UI (Gemini code broken but UI renders).

### Phase 2 — Provider Abstraction
**Shape:**
```ts
// src/providers/types.ts
interface Provider {
  name: 'anthropic' | 'openai';
  chat(input: { messages: Msg[]; tools: Tool[]; image?: Buffer }): AsyncIterable<Chunk>;
}
```
- `src/providers/anthropic.ts` — wraps `@anthropic-ai/sdk`, streams tool-use blocks
- `src/providers/openai.ts` — wraps `openai` SDK, streams function calls
- `actuate` tool defined once in provider-neutral shape; each provider adapter translates schema
- Provider selection: `MIRA_PROVIDER=anthropic|openai` env var + UI switcher in settings panel
- **Keys live in main process.** Renderer never sees API keys. All provider calls proxied over IPC (`mira:chat` request/response stream).
- **Exit criterion:** Switch provider in settings, get identical tool-call behavior.

### Phase 3 — On-device Voice
- **STT:** `nodejs-whisper` (whisper.cpp bindings) — small.en or base.en model, lazy-downloaded to `~/.mira/models/` on first run (~75–140MB).
- **VAD:** Simple energy-based gate in renderer before streaming to whisper; upgrade to Silero VAD later.
- **TTS:** macOS `say` command via `child_process` in main process. Pluggable interface so we can swap to Piper/Coqui later.
- **Audio loop:** Renderer captures mic → chunks to main via IPC → main runs whisper → transcript flows back to renderer → renderer invokes provider → tool-use triggers actuator (main) → main runs TTS on response text.
- **Exit criterion:** "Open calculator" spoken to mic launches Calculator on macOS, with spoken confirmation.

### Phase 4 — Actuator + Vision
- Replace fake telemetry (`Math.random`) with `systeminformation` package in main process
- `actuate` action implementations (macOS first):
  - `LAUNCH` / `SYSTEM` — `open -a <app>` / `osascript`
  - `VOLUME_ADJUST` — `osascript -e "set volume output volume X"`
  - `BRIGHTNESS_ADJUST` — `brightness` binary (Homebrew) or private API via node-mac-contacts pattern
  - `BROWSER` — `open <url>`
  - `TYPE` — AppleScript keystroke injection (request Accessibility permission)
  - `VISION_DESCRIBE` — `desktopCapturer.getSources` → JPEG → attach to next provider message
- **Exit criterion:** Each enum action works end-to-end on macOS with a demo script.

## Key architectural decisions (want eng review on these)

1. **IPC boundary:** all provider + tool + audio logic in main process, renderer is thin. Keeps keys safe, simplifies testing, but adds IPC message overhead.
2. **Whisper binding:** `nodejs-whisper` (native) vs `transformers.js` (WebGPU in renderer). Native is faster + no renderer bloat; cross-platform native builds are a packaging burden.
3. **Tool schema translation:** one source of truth (TS types) with adapter layer per provider. Alternative: two parallel definitions (simpler, drift risk).
4. **Streaming vs non-streaming:** stream provider output for perceived latency, but tool-use only fires at end-of-turn for both. Ship non-streaming first, add streaming in v0.2.
5. **Vision cadence:** one-shot on VISION_DESCRIBE vs continuous frame streaming. One-shot for v0.1 — cheaper and simpler.

## Open questions

- **Windows/Linux TTS:** Piper is ~60MB + voice model. Worth bundling, or punt to v0.2?
- **Model store:** ship whisper model inside app bundle (~140MB app size) or first-run download (smaller install, needs network)?
- **Settings UI:** build a proper panel now, or env-var-only for v0.1 and add UI in v0.2?

## Non-goals for this PR

- Wake word ("Hey Mira") — press-to-talk first
- Fine-tuning or RAG over user history
- Mobile, web, browser-extension variants
- Usage-based billing or subscription scaffolding
