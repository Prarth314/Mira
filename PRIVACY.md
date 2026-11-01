# Mira data handling

This describes the current development build, not a promise about third-party providers or operating-system services.

| Data | Processing and retention |
| --- | --- |
| Microphone audio | Captured after you start recording. Written to a temporary WAV for local Whisper processing and removed when processing ends. Abandoned app-owned speech scratch directories are cleaned on the next startup. |
| Microphone setup | An explicit access check opens a temporary stream and immediately stops its tracks without transcription or saving. The chosen device identifier is a local preference, excluded from diagnostics; device names are not sent to providers. |
| Drafts and original instructions | Kept in application memory. Mira does not save transcript history. Closing the app loses unsaved drafts. |
| Project index | Local, in memory, after you select a folder. Filenames are indexed; file contents are read when explicitly attached. Disconnecting clears the active index and selection. Existing draft snapshots remain until discarded or the app closes. |
| Project-aware dictation | Opt-in filename/declaration suggestions are calculated locally after transcription from indexed filenames, explicitly saved aliases, and parsed top-level names in attached JS/TS snapshots. No additional repository content is read, and no model training or vocabulary upload occurs. Each draft keeps its vocabulary snapshot in memory until replaced or discarded. Refreshing the index clears active attachments and their declaration hints. |
| Saved project pronunciations | Explicitly approved phrases and relative file paths persist as local JSON in the application profile, scoped by a hash of the canonical project path. They are not encrypted; do not put confidential text in aliases. The absolute project path and transcript history are not stored in these files. Inspect, edit, and remove aliases in Project pronunciations. Disconnect disables suggestions but does not delete saved aliases; reconnect and enable vocabulary to manage them. |
| Attached files | Visible in the draft preview. Included when you explicitly copy or paste the prompt package. Changed or disconnected files must be reattached before delivery. |
| Cloud refinement | Sends only the spoken or typed instruction to your selected Anthropic or OpenAI provider. Attached project contents are not sent for refinement. Provider terms and retention policies apply. |
| Provider keys | Stored using Electron's OS-backed secure storage. Saved key values are not exposed through the renderer API. Removing a key updates the active store; OS backups are outside Mira's control. |
| Speech model and runtime | Model setup contacts Hugging Face. Development/build preparation fetches pinned upstream GitHub archives. Network providers receive normal connection metadata. |
| Interrupted model setup | Downloads use exclusively created UUID partial files under validated app-profile storage. Failed/cancelled transfers remove their partial file; startup and retry remove only matching app-owned abandoned partial files. |
| Diagnostics | Generated on request from an allowlist of app/runtime versions, platform, coarse hardware/memory and speech-setup status. No transcript, key, project path or attached source is included. You choose whether to copy or share it. |

Mira does not upload analytics or crash reports in this build. Copy/paste uses the system clipboard; OS clipboard history and synchronization are controlled by your system settings. Preferences and model weights remain in the application profile until removed through normal app/data management.

Hiding the workspace, losing the owning renderer, or receiving a suspend event cancels owned recording/processing. Drafts already prepared remain in memory. Refining reviewed text sends that reviewed instruction only; attachments and saved vocabulary are not added. Evaluation and performance commands use isolated profiles and synthetic/public inputs; no live-provider evaluation or automatic credit spending is enabled.

For sensitive reports, follow [SECURITY.md](SECURITY.md). For public-release validation, see [the beta checklist](docs/BETA_TESTING.md).
