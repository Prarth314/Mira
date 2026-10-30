# Mira repository consolidation

Compared on October 30, 2026.

| Evidence | Mira | Mira-AI |
| --- | --- | --- |
| Main revision | `b446c84` | `391c6cb` |
| Commits reachable from main | 12 | 3 |
| Tracked files | 66 | 17 |
| App | Electron + React with typed main-process IPC | Original Gemini Live prototype |
| Providers | Anthropic and OpenAI | Gemini Live in renderer |
| Voice | Local Whisper, floating overlay | Original live-audio interface |
| Native actions | Prompt routing and typed actuator actions | Prototype implementation |
| Engineering | Lockfile, build scripts, typecheck, nine unit test files | Minimal package manifest; no unit suite |
| Unique material to retain | Implementation and research docs | Team attribution and independent-continuation notice |

## Merge decision

Use **Prarth314/Mira** as the canonical repository. The root trees of Mira-AI's `7e03cb9` and Mira's `1172ee3` are identical (`git diff` is empty), despite having unrelated commit histories. Mira-AI's later commits change only its README attribution; Mira adds the subsequent rebuild.

The consolidation joins Mira-AI's main history to Mira using an `ours` strategy merge, retaining Mira's implementation tree. The prototype implementation is already present in Mira's starting revision; copying it over the rebuild would revert completed work. The updated README carries forward Mira-AI's attribution. Both parent histories remain reachable from the resulting merge commit.

The Mira feature branch `feat/multi-provider-voice` is already merged into its main branch. Neither repository needs to be deleted to use this single project. Mira-AI remains available as a historical reference.

## Next development priorities

1. Validate the actual microphone → Whisper → provider → focused-tool flow on macOS. Automated unit tests and renderer builds do not cover OS permissions, keyboard injection or live provider calls.
2. Add Windows support for speech-binary discovery, focused-window detection, paste routing, permission settings and speech output. The development machine runs Windows; the current native implementation assumes macOS.
3. Harden overlay startup and recording lifecycle, including first invocation, rapid toggles and cancellation during processing.
4. Restore saved provider selection on restart and surface failed key saves correctly in Settings.
5. Replace runtime CDN styling, add repeatable desktop packaging and smoke-test installers.

Treat the historical PLAN.md checklists as design history; verify each capability against current code before marking it complete.

## Consolidation verification

The initial `npm ci` failed because the inherited lockfile omitted required optional dependency records. Regenerated those records without upgrading the existing direct dependencies.

- TypeScript check: passed.
- Production renderer build: passed (main window and overlay).
- Unit suite: 59 tests passed across nine files on Windows with Node 24.
- Live microphone, provider calls and macOS automation: not exercised in this Windows environment.
