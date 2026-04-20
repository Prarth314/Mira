# Mira

Voice for Cursor and Claude Code.

Press ⌥Space anywhere on macOS, speak your prompt, and Mira pastes the cleaned-up text into whatever dev tool is in front of you. On-device Whisper for transcription, your own Anthropic or OpenAI key for the brains. The app lives in the background as a non-activating overlay so it doesn't steal focus from the editor you were just in.

> **Status:** rebuild in progress on `feat/multi-provider-voice`. The starting point was an AI-Studio export wired to Gemini Live; the rewrite swaps that for a typed provider abstraction with on-device speech, then narrows the product surface to a single wedge: voice → frontmost dev tool. See `PLAN.md` and the design doc in `~/.gstack/projects/Prarth314-Mira/`.

## What it does today

- Hold ⌥Space (configurable later) anywhere on macOS — small overlay pops up at bottom-center, doesn't steal focus
- Whisper.cpp transcribes locally
- Active provider (default: Claude Sonnet) decides what to do with your utterance
- For coding prompts (the default behavior): cleans up "um/uh/so" filler, normalizes a small dictionary of jargon ("clawed code" → "Claude Code"), then pastes into the focused dev tool
- Per-app paste adapter knows about Cursor (Cmd+L → chat panel), Claude Code / Warp / iTerm / Terminal (paste into terminal), VSCode (Cmd+I)
- Optional auto-send (Return after paste)
- Fallback actions still wired (`launch_app`, `open_url`, `set_volume`, `describe_screen`, `speak`) but de-emphasized in the prompt

## Run locally

**Prerequisites:** Node.js 20+, macOS (Windows/Linux later), `whisper-cli` on PATH (`brew install whisper-cpp`).

```bash
npm install
cp .env.local.example .env.local   # not strictly needed; keys go through the Settings panel + safeStorage
npm run dev
```

`npm run dev` starts Vite on `:5173` and Electron together.

The Whisper model (`ggml-base.en.bin`, ~140 MB) downloads on first transcription with SHA-256 verification; lives in `~/Library/Application Support/Mira/models/`.

## Scripts

- `npm run dev` — dev mode (Vite + Electron, hot reload, dev tools detached)
- `npm run build` — production renderer build (multi-entry: main app + overlay)
- `npm run start` — run packaged app against the production build
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest unit suite
