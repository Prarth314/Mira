# Speech and refinement evaluation

## Reproduce without provider credits

```bash
npm run evaluate
npm run prepare:speech
npm run test:speech
npm run test:performance
# Windows only; briefly focuses disposable test windows:
npm run test:native
```

`evaluate` is offline and deterministic. Other commands are explicit opt-ins, isolated from default Playwright and packaging smoke tests. The optional GitHub workflow can run public-sample/performance/native checks on Windows and macOS runners (native paste fixture is Windows-only); it has no provider credentials or release permissions.

## Versioned corpus contract

[corpus.v1.json](../evaluation/corpus.v1.json) declares `schemaVersion`, corpus `version`, case `id`, `split`, source kind/reference/permission/license, reference transcript and review status, observed transcript, expected technical tokens, constraint indicators, files/symbols, and expected suggestion candidate sets. Its public-audio case references the pinned upstream sample. Noise/silence-audio and interrupted consented speech are explicitly not collected; they are not treated as passes.

The current corpus contains eleven authored synthetic text fixtures and three unmeasured audio cases. Text fixtures are licensed with this repository, not represented as real recordings, model outputs, or independently reviewed gold labels. The declared held-out regression split is not proof that its author has never tuned against it. A future real speech study must keep participant-consented held-out recordings separate from development examples, record asset hashes and access scope, and obtain independent transcript/constraint review before publishing accuracy.

Do not commit private recordings, project contents, provider keys, or sensitive paths. The runner never dereferences corpus audio paths or calls a provider implicitly. Reports contain case IDs, counts and metrics, not raw transcripts or missing-token values.

## Metrics and grading policy

| Metric | Definition | What it cannot establish |
| --- | --- | --- |
| Text-pair WER | Levenshtein word edits divided by reference words; lowercase Unicode letters/numbers/underscore, punctuation split. Empty-reference/nonempty-output rate is null. | Synthetic fixture WER is not ASR accuracy. Full real-audio WER is unmeasured until a reviewed full reference exists. |
| Technical preservation | Case-sensitive literal matches at identifier boundaries; `300` does not match `3000`. Report counts before/after policy fallback. | Equivalent spelling or meaning, correct code semantics, or complete preservation of an instruction. |
| Filename/symbol candidate-set correctness | Exact match of expected phrase and complete sorted candidate set, including ambiguous and no-match cases. | Whether a user chose the intended file, or recognition performance on unseen audio. |
| Constraint marker retention | Explicit required phrases checked against output. | Semantic equivalence. `semanticGrade` remains null. |
| Fallback/abstention | Policy restores original on detected losses; no suggestion is an abstention. Rates/counts identify the fixture denominator. | Abstention is not automatically an error; no-match cases should abstain. |
| Errors/latency | Runner failures fail the command; policy duration is measured separately. Real speech/provider errors and latency remain separate measurements. | Mocked failures do not measure a live service's reliability or latency. |

Human meaning rubric for future reviewed outputs: **0** preserves all stated requirements; **1** changes presentation without changing requirements; **2** omits/adds an actionable requirement; **3** contradicts a constraint, changes an exact value/identifier materially, or creates an unsafe instruction. Record reviewer, evidence, disagreements and adjudication. No current output is assigned a human semantic score automatically.

[Observed synthetic report](benchmarks/synthetic-policy-v1.json): eleven fixture candidate sets and eleven expected fallback decisions matched; three audio cases remain unmeasured. Eight no-suggestion outcomes and four fallbacks are fixture behaviors, not market-level success rates. [Refinement tests](../tests/unit/refinement.test.ts) and [actual main handlers](../tests/unit/studio-integration.test.ts) cover missing/invalid credentials, transport errors, malformed/oversized output, detail loss, enforced deadline, cancellation and late results. [Provider adapter tests](../tests/unit/provider-output.test.ts) cover truncated output; [retry tests](../tests/unit/retry.test.ts) cover retry policy. None are presented as live-provider results.

## Live-provider evaluation gate

No live runner or automatic credit spending is enabled. Before manual live evaluation, explicitly authorize the provider/model, synthetic inputs, maximum request count and currency budget; use securely configured credentials; stop on the first unexpected cost/retention condition. Record model version, input/output token usage, latency, failures and human grades. Never attach repository files implicitly. Live quality, real rate limits and billing behavior are currently **unverified**.

The optional workflow’s `compareNative` input runs three paired macOS CLI trials with the same WAV/model and four threads, alternating default native mode and `-ng` CPU-only mode. It excludes IPC, model verification and WAV preparation; see [the scoped comparison](BENCHMARKS.md). Packaged inference can be verified separately with the packaging workflow’s `validateSpeech` input.
