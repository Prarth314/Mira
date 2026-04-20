# Mira research artifacts

This directory contains the structured research that drove the scope decisions on the `feat/multi-provider-voice` branch. Saved here so anyone reviewing the PR can read the full context, not just the summary.

| File | What |
|---|---|
| `PMF-design-doc.md` | Final design doc from `/office-hours` (autonomous mode). 9/10 after one adversarial-review pass. The product wedge, persona, success/kill criteria, and 3 weekend timeline. |
| `codex-eng-review.md` | Codex (gpt-5.4, high reasoning) outside-voice review of `PLAN.md` v1. 12 punches; 9 changed the plan. Source of the typed-action security fix, the spawned-whisper-binary call, and the distribution-as-feasibility framing. |
| `codex-pmf-diagnostic.md` | Codex outside-voice PMF diagnostic with live web search. Cited sources: Wispr "Master Plan" (Mar 2026), OpenAI ChatGPT macOS voice retirement (Jan 2026), Apple Voice Control docs, Anthropic voice mode docs. Source of the wedge collapse from "general OS actuator" to "voice for Cursor & Claude Code." |
| `spec-review.md` | Adversarial cold-read of the design doc by an independent subagent. 5-dimension scoring; 4 issues caught and patched. |
| `eng-review-test-plan.md` | Test plan artifact written by `/plan-eng-review`. Lists pages, interactions, edge cases, and critical paths for QA. |

## Why this much research for a side project?

Solo builder, single weekend per phase, multiple platform competitors (Wispr, Apple, ChatGPT, Claude desktop). Cheap to do the diagnostics; expensive to ship the wrong product. Two structured reviews (Eng + PMF) plus a cross-model debate (Claude + Codex) caught: a critical security gap (freeform shell exec via prompt injection), a stale market assumption (Wispr is no longer "pure dictation"), and a scope error (5 actions instead of 1). Combined cost: ~30 minutes of skill execution. Combined save: an unknown number of weekends spent building toward the wrong wedge.

See `PLAN.md` in the repo root for the live implementation plan, and the PR description for the executive summary.
