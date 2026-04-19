# Mira

Voice-controlled desktop actuator. Press to talk, the model decides what to do, your machine does it.

Provider-agnostic by design: bring your own Anthropic or OpenAI key. Voice runs on-device (Whisper) so audio never leaves your machine.

> Status: rebuild in progress on `feat/multi-provider-voice`. The original AI-Studio export wired Gemini Live; the rewrite swaps that for a typed provider abstraction with on-device speech. See `PLAN.md`.

## Run locally

**Prerequisites:** Node.js 20+, macOS (Windows/Linux later).

```bash
npm install
cp .env.local.example .env.local   # fill in ANTHROPIC_API_KEY and/or OPENAI_API_KEY
npm run dev
```

`npm run dev` starts Vite (port 5173) and Electron together. Closing either kills both.

## Scripts

- `npm run dev` — dev mode (Vite + Electron, hot reload)
- `npm run build` — production renderer build
- `npm run start` — run packaged app against the production build
- `npm run typecheck` — `tsc --noEmit`
