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

## Babel parser

Mira bundles @babel/parser 8.0.10 for local declaration extraction. Source: https://github.com/babel/babel/tree/main/packages/babel-parser. The upstream MIT notice follows.

```text
Copyright (C) 2012-2014 by various contributors (see AUTHORS)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
