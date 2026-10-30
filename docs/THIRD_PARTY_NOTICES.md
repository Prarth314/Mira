# Third-party notices

Mira's own code uses the MIT license. Bundled software and models retain their respective licenses.

## whisper.cpp

Source: https://github.com/ggml-org/whisper.cpp

Pinned release: v1.9.2, commit `306c88f4d1286aec1bf96e544632897886af5501`.

License: MIT. The exact upstream license is copied from the checksum-verified source archive into `resources/whisper/LICENSE-whisper.txt` by the preparation script.

Windows x64 runtime is the official CPU archive, SHA-256 `49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a`. macOS builds use the pinned source archive, SHA-256 `f3585ebf64df3e41b26c45d93bdb38b423ca1de0bf40cc4b6d320254867a75df`.

## Whisper model

The English base model is downloaded separately, not shipped in the installer. Source: https://huggingface.co/ggerganov/whisper.cpp (converted OpenAI Whisper weights). Model revision, exact size and SHA-256 are in `src/main/model-info.ts`. Whisper's upstream code and model weights are released under MIT: https://github.com/openai/whisper/blob/main/LICENSE.

## Electron and JavaScript dependencies

Electron includes Chromium and Node.js notices. Preserve the license files included in the Electron distribution. Installed JavaScript dependencies retain their license files. Generate a dependency inventory for each public release; this document is not a substitute for reviewing newly bundled components.
