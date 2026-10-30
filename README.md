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
| Developer context | Planned opt-in project vocabulary and visible context attachments |
| Desktop presence | A compact overlay with a full workspace when you need it |

Native automation started on macOS. Windows support and reliable destination handling are being developed. See the [execution tracker](docs/production-roadmap.md) for scope and acceptance gates.

## Get started

Use **Node.js 24** and npm.

```bash
git clone https://github.com/Prarth314/Mira.git
cd Mira
npm ci
npm run dev
```

Enter a provider key in **Settings** to use cloud processing. The current keystore does not load keys from `.env.local`.

Local speech requires a compatible `whisper-cli` runtime while bundled distribution is being completed. On macOS, developers can install it with `brew install whisper-cpp`. The English model downloads on first use and is verified before use.

## Development

```bash
npm run typecheck
npm test
npm run build
```

Vite serves the renderer on `127.0.0.1:5173`. Electron owns native operations, provider access and secure key storage. Production build and packaging details evolve with the [release tracker](docs/production-roadmap.md).

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
