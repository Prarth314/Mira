<div align="center">

![Mira — Your voice. Your tools. Your flow.](docs/assets/mira-banner.svg)

[![CI](https://github.com/Prarth314/Mira/actions/workflows/ci.yml/badge.svg)](https://github.com/Prarth314/Mira/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-a78bfa.svg)](LICENSE)
![Status: development](https://img.shields.io/badge/Status-development-67e8f9)

**A voice workspace for developers.**
Speak your intent. Preserve the details. Stay in your flow.

[Get started](#get-started) · [Architecture](#architecture) · [Roadmap](docs/production-roadmap.md) · [Contribute](CONTRIBUTING.md)

</div>

---

## The idea

Your best explanation of a coding task should not disappear between your microphone and your editor. Mira brings local speech transcription, optional AI refinement, and developer-tool delivery into a focused desktop experience.

> **Release status:** active development. The production roadmap is being implemented in verified increments. Signed installers, native platform certification, and public beta validation are release gates—not completed claims.

## The experience

**Speak → transcribe → inspect → deliver.**

| Capability | Direction |
| --- | --- |
| Local speech | Whisper transcription on your device |
| Your provider | Optional Anthropic or OpenAI processing with your own key |
| Deliberate delivery | Clear destination, review, cancellation and copy fallback |
| Developer context | Opt-in local filename index and previewable file attachments |
| Desktop presence | A compact overlay with a full workspace when you need it |

Native adapters exist for Windows and macOS. Keyboard delivery is reported as **attempted**, because simulated input cannot confirm receipt. Typed drafts use manual delivery; shortcut recordings capture a supported destination. Native-tool certification remains a beta gate. See the [execution tracker](docs/production-roadmap.md).

## Get started

Use **Node.js 24** and npm.

```bash
git clone https://github.com/Prarth314/Mira.git
cd Mira
npm ci
npm run dev
```

**Dictate** works without a provider key. **Refine** sends your instruction to the provider you configure in Settings. Keys are not loaded from `.env.local`.

Prepare the pinned speech runtime for development:

```bash
npm run prepare:speech
```

Windows x64 uses a checksum-verified upstream binary. macOS builds from pinned source and requires CMake and the Xcode command-line tools. Packaged builds include their speech runtime. Download the verified English model from the workspace before recording.

Use **Ctrl / Cmd + Shift + Space** to toggle recording without opening the workspace. Every recording produces a draft for review. Terminal delivery does not press Enter and rejects control characters and multiline text.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run package:dir
```

Vite serves the renderer on `127.0.0.1:5173`. Electron owns native operations, provider access and secure key storage. `npm run package` creates an internal installer; public signing remains a release gate. CI builds the code on Windows, macOS and Linux; native packaging targets Windows and macOS.

## Architecture

```text
Desktop workspace + recording overlay
                 │
          Preload / typed IPC
                 │
         Electron main process
          ├── Voice lifecycle + local Whisper
          ├── Optional provider processing
          ├── Settings + encrypted keys
          └── Native delivery adapters
```

The renderer does not own provider credentials. Desktop input and provider output require explicit policy; building the UI alone does not validate native behavior.

## Privacy, by design

- Local transcription keeps speech recognition on the device.
- Optional cloud processing sends its input to the selected provider.
- Never put API keys or private transcripts into issue reports.
- Drafts remain in memory; raw transcript history is not persisted.
- Connect a folder and explicitly select up to three files to attach to a draft. Common credential files, hidden paths, symlinks and ignored files are excluded. Refinement processes only the instruction; selected context is shared when you copy or paste.
- Project context, screenshot controls, retention and diagnostic redaction are tracked as explicit release requirements.

Read [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## Building in the open

Small commits, observable behavior, honest platform support. We value reliable cancellation, recoverable drafts and accurate technical instructions as much as visual polish.

Read the [contribution guide](CONTRIBUTING.md), [production roadmap](docs/production-roadmap.md), and [repository consolidation report](docs/consolidation.md).

## Origins & license

Mira began as a collaborative hackathon prototype in [startupOS](https://github.com/aashrithtutuku02-stack/startupOS). Continued development is maintained by Prarth Gupta with the original teammates' permission. The [Mira-AI](https://github.com/Prarth314/Mira-AI) history and original team attribution are preserved here. The original prototype was a team effort.

Released under the [MIT License](LICENSE). Third-party components retain their own licenses.

---

<div align="center"><sub>Built for the space between a thought and a working instruction.</sub></div>
