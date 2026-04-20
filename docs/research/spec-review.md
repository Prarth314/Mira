# Spec Review — PMF Design Doc (2026-04-18)

Adversarial cold-read of the `/office-hours` design doc by an independent subagent. The reviewer had no conversation history; just the file path and a 5-dimension rubric. Score and issues below are verbatim.

## Reviewer output

### 1. Completeness — PASS with minor gaps
- Most decisions resolved. Gaps:
  - **No timeline / milestone breakdown.** Says "2-3 weekends" but no week-by-week plan tying interview phase → MVP build → 5-paying-customer target.
  - **No "what kills this" criteria.** Success criteria exist; explicit kill criteria don't (e.g., "if <2 of 10 interviewees mention prompt-typing pain, kill the wedge and reopen scope").
  - **Pricing is in Open Questions but never re-resolved** — the Stripe link in Distribution v0.2 needs a number.
  - **Whisper accuracy on code jargon** flagged as open question, but it's load-bearing for the whole wedge — needs a 30-min eval before committing 2-3 weekends.

### 2. Consistency — PASS with one contradiction
- Recommendation says "pick Claude as default … OpenAI stays available but isn't the headline" while also cutting "Multi-provider as a v0.1 selling point." Reasonable, but the **branch is literally named `feat/multi-provider-voice`** — design doesn't address whether the in-flight branch work gets shelved, kept as plumbing, or finished. Add one line: "in-flight provider abstraction stays as plumbing; UI/marketing copy ships single-provider."
- Premise 5 says "current codebase mostly reusable" but Constraints note "no Accessibility helper yet" and Recommendation depends on paste-via-Cmd+V working without it — there's a soft contradiction that hinges on the open question in §Open Questions. Resolve before Premise 5 is true.

### 3. Clarity — PASS
- Persona, wedge, cuts, and assignment are unambiguous. Eshwaran could open this Monday and act. The `osascript` snippet, action-set diff, and the assignment ("interview 10, ask one question") are concrete enough to execute solo.
- Minor: "OF1" Whisper hallucination example reads as fabricated — replace with a real observed mistranscription or remove.

### 4. Scope — PASS
- Doc actively fights scope creep (cuts 4 of 5 actions from marketing surface, defers cross-platform, defers wake word, defers bundled keys, defers App Store). The wedge is appropriately thin without being uncuttable: one persona, one action, one platform, BYOK.
- Not too thin — "send_developer_prompt to frontmost dev tool with cleanup pass" is a real product, not a feature.

### 5. Feasibility — PASS with risks flagged
- 2-3 weekends is plausible **if** clipboard+Cmd+V works without Accessibility (the doc admits this is unverified).
- Hidden complexity not surfaced:
  - **Cursor's chat panel input focus** is not always the frontmost element — paste may land in the editor instead of the prompt box. Per-app paste adapters are more than "paste"; they need focus discipline.
  - **Notarization (Phase 5)** is a known multi-day yak-shave for first-time solo Mac devs (cert provisioning, notarytool teething). Not a blocker, but "v0.1 ships in 2-3 weekends" should include it or defer to "v0.1.1 = signed build."
  - **Sourcing 10 interviewees** is the real critical path — founders chronically underestimate this. Doc treats it as a one-week task; realistically 2-3 weeks of cold outreach.

---

**Score: 8/10.** Sharp, honest, defensible. Reads like a doc written after real argument with a contrarian (Codex), not a one-shot Claude output. The premise audits, the explicit "what we don't have evidence for" framing, and the cross-model synthesis are unusually mature for a v0.1 design. Knock-offs: branch-name mismatch, kill criteria missing, pricing unresolved, and the paste-without-Accessibility assumption is load-bearing but unverified — that's 30 minutes of work that should happen before any of the 2-3 weekends. Fix those four and this is a 9.

## Disposition

All four knock-offs were patched into the design doc in the same session. Final design doc score after revisions: **9/10**.

| Issue | Fix |
|---|---|
| Missing kill criteria | Added "Kill Criteria" section with five concrete trip-wires (interview signal, whisper accuracy, latency, dogfood failure, payment) |
| Branch-name mismatch | Added explicit "Branch-name reality check" line: provider abstraction stays as plumbing, UI/marketing ships single-provider, branch keeps its name to preserve commit history |
| Pricing unresolved | Set v0.1 price at \$12/mo (split between Wispr \$15 and Cursor \$20, positions Mira as a Cursor add-on not a competitor) |
| Paste-without-Accessibility unverified | Added "Pre-Build Spike" section requiring two 30-60 min experiments before opening the editor for the implementation weekend |

## Why we ran this

A design doc that codex challenged is stronger than a one-shot Claude output. But two AI authors agreeing in the same conversation share too much context — they reinforce each other's biases. A cold-read subagent (no shared history) is the cheapest way to get genuinely independent quality assurance. Cost: one Agent invocation, ~40 seconds. Save: four real issues caught before they became weekend-eating gotchas.
