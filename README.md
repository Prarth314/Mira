# Mira

Voice prompts for developer tools. Mira is an Electron + React app that transcribes speech locally with Whisper, processes instructions through Anthropic or OpenAI, and routes prompts into the focused developer tool.

The canonical project is [Prarth314/Mira](https://github.com/Prarth314/Mira). The original [Mira-AI](https://github.com/Prarth314/Mira-AI) prototype has been consolidated here with its Git history and attribution preserved. See [the consolidation report](docs/consolidation.md) for the comparison and next steps.

## Current implementation

- Toggle the recording overlay with Option+Space on macOS; press it again to finish recording.
- Local transcription through an installed `whisper-cli` binary.
- Anthropic and OpenAI adapters, with API keys stored through Electron's encrypted `safeStorage`.
- Prompt cleanup and routing for Cursor, VS Code, Claude Desktop, Warp, iTerm and Terminal. Claude Code running inside a terminal receives the terminal's paste.
- Optional automatic submission, plus typed actions for app launch, URLs, volume, screen description and speech.
- Settings, permission reporting, system telemetry and unit tests.

**Platform status:** native prompt routing, app launch, volume and speech currently target macOS. Windows/Linux parity and packaged installers are unfinished. A successful renderer build does not establish working desktop automation on those platforms.

## Run locally

Prerequisites: Node.js 22.12+ (Node 24 recommended), macOS for native actions, and `whisper-cli` on PATH (`brew install whisper-cpp`).

```bash
npm ci
npm run dev
```

Vite runs at `http://127.0.0.1:5173` and Electron opens alongside it. Enter an Anthropic or OpenAI API key in **Settings**. Environment files are not loaded by the current keystore; no `.env.local` copy is required. Provider selection is available under Advanced.

The first transcription downloads the approximately 148 MB Whisper model into the app's user-data directory and verifies its SHA-256. First use requires a network connection. Transcription is local; transcripts and any explicitly captured images are sent to the selected provider.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

`npm start` opens Electron using the production renderer build; it does not create an installer. `npm run test:watch` watches unit tests.

## Project origins

Originally built collaboratively as a hackathon prototype. Continued development is maintained by Prarth Gupta with the original teammates' permission.

- Original team repository: [aashrithtutuku02-stack/startupOS](https://github.com/aashrithtutuku02-stack/startupOS).
- Original commit history and authorship are preserved. The prototype was a team effort; this project does not claim sole authorship.

Historical implementation planning lives in [PLAN.md](PLAN.md), with supporting artifacts in [docs/research](docs/research/README.md). The consolidation report records the current follow-up priorities.
