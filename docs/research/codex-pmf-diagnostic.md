# Codex PMF Diagnostic — Mira (2026-04-18)

Independent outside-voice review of Mira's product-market-fit thesis. Run during the `/office-hours` autonomous-mode session. Codex (`gpt-5.4`, `model_reasoning_effort="high"`) was given Claude's structured self-answers to the six YC forcing questions (Q1 Demand, Q2 Status Quo, Q3 Specific User, Q4 Wedge, Q5 Observation, Q6 Future Fit) and asked to web-search the actual landscape, then deliver a 7-point PMF diagnostic with sources.

This was the artifact that flipped Mira from "general voice OS actuator" to "voice for Cursor & Claude Code."

## Codex output (verbatim)

> **1. Actual landscape**
>
> - Your present-tense Wispr read is stale. On March 3, 2026, Wispr publicly said its roadmap is `reliable voice input -> voice to action -> wearables`, and said it was already prototyping voice actions with power users. Mira is not entering empty space; it is trying to outrun the adjacent roadmap of the dictation incumbent. Source: [Wispr, "The Master Plan"](https://wisprflow.ai/post/the-master-plan)
> - Reported Wispr complaints are real, but they are mostly about brittleness, not lack of demand: Product Hunt reviewers call out Windows stability, setup friction, CPU/RAM use, system integration issues, and privacy concerns. Inference: the opening is not "nobody wants voice"; it is "people want it, but current tools are fragile." Source: [Wispr Flow reviews on Product Hunt](https://www.producthunt.com/products/wisprflow/reviews)
> - Apple's native stack is stronger than you framed. macOS Voice Control can create custom spoken commands that press keyboard shortcuts and directly run a Shortcut. Inference: Apple already owns much of the action layer on Mac; it just ships it as accessibility plumbing instead of a product people love. Source: [Apple, "Customise Voice Control on Mac"](https://support.apple.com/en-euro/guide/mac-help/mchl9899c8a5/mac)
> - ChatGPT desktop is not the immediate Mac voice threat right now. OpenAI retired voice in the ChatGPT macOS app effective **January 15, 2026**. Inference: OpenAI is a long-run platform risk, but not the current Mac desktop voice incumbent. Source: [OpenAI ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes?os=ioxa42gdub)
> - Anthropic is moving toward voice-native usage too. Claude's official voice mode is live in English on Claude and mobile, with web search available in voice conversations. I did not find an official Anthropic source describing a macOS desktop voice-action agent; the live official docs I found are voice chat, not Mac OS actuation. Source: [Anthropic, "Using voice mode"](https://support.claude.com/en/articles/11101966-using-voice-mode)
>
> **2. Strongest steelman**
>
> Mira is not "voice assistant for your computer." Mira is a low-latency voice execution layer for people who already work through AI all day: it turns messy speech into reliable typed intent and routes it into the right tool or OS action without stealing focus. If Wispr made talking good enough to replace typing, Mira's credible ambition is to make talking good enough to operate real workflows.
>
> **3. Most revealing gap in your diagnostic**
>
> You wrote: **"Wispr does voice-to-text dictation beautifully but is purely a typing pipe with zero agency."**
>
> That is the hole. It is no longer true in the present tense. Wispr is already publicly on "voice to action," so the real question is not "is there a missing category?" It is "can Mira win a narrow wedge before the dictation incumbent and the platform vendors collapse that wedge?"
>
> **4. One premise of yours I think is wrong**
>
> You wrote: **"Apple's Voice Control is free and native — hard to beat."**
>
> Wrong premise. Apple is the platform threat, but not the real incumbent for a paid wedge. The real incumbent behavior is keyboard plus paid dictation plus app-native AI. Evidence that would prove me right: interview 10 target users in your wedge and see whether any of them actually use Voice Control daily. If 7+ are paying for or trialing Wispr/superwhisper/Aqua/Cursor/Claude workflows and 0-1 use Voice Control as their default, your "free Apple incumbent" framing is wrong.
>
> **5. Best v0.1 wedge**
>
> Pick **(a)**, but narrow it harder: **voice-to-Claude Code / Cursor for AI-heavy developers**.
>
> Why:
> - Highest willingness to pay
> - Highest daily frequency
> - Founder can dogfood it
> - You avoid Apple's strongest turf: generic OS accessibility/automation
> - You avoid the dead-end breadth of "voice OS for everyone"
>
> Named persona: **Nadia Patel, Staff Engineer at a 25-person SaaS startup.**
> Daily workflow: Cursor, Claude Code, Terminal, Linear, Slack, docs, PR reviews, repeated prompt-writing and code explanation.
> Why she pays: not to "launch apps with voice," but to stay in flow and save her wrists while issuing long, precise coding instructions 30-50 times a day. If Mira reliably lets her say "trace the auth retry bug, patch it, add a regression test, then summarize the diff for the PR," that is worth real money.
>
> **6. Strongest competitor that is not another startup**
>
> **Apple's built-in stack: Voice Control + Shortcuts + Siri.**
>
> Be concrete: Apple already has OS privileges, default distribution, on-device speech, and the ability to bind voice to actions. If Apple ever turns that from accessibility tooling into a polished power-user product, Mira's broad "OS actuator" story gets crushed.
>
> **7. What to ship this weekend**
>
> Build **one** thing: a **push-to-talk developer prompt router**, not a general agent.
>
> In:
> - `Option+Space` overlay
> - local STT
> - frontmost-app detection for **Claude Code terminal** first
> - one action: `send_developer_prompt`
> - prompt cleanup for filenames, symbols, code jargon
> - optional auto-send
> - short spoken/text confirmation
>
> Out:
> - generic `launch_app`
> - `open_url`
> - `set_volume`
> - `speak`
> - `describe_screen` as a user feature
> - Apple Shortcuts
> - accessibility wedge
> - freeform shell exec
> - multi-provider story
>
> Demo:
> - Claude Code open on a real repo
> - founder says: "Find why webhook retries double-charge in billing, fix it, add a regression test, and summarize the change."
> - Mira transcribes cleanly, injects the prompt into Claude Code, sends it, and stays out of the way
>
> That demo is narrower, uglier, and far more credible than "voice OS."

## Cross-model synthesis

Claude (driving the `/office-hours` skill) and Codex (the outside voice) agreed on:
- The current "OS actuator for everyone" framing is too broad
- The wedge is voice-to-dev-tool with high WTP among AI-heavy developers
- The MVP demo should be specific (one action, one persona, one named workflow)

Codex went further on aggression than Claude:
- Codex would cut the action set to **one** (`send_developer_prompt`); Claude was inclined to keep `describe_screen` and `speak` as low-cost retentions
- Codex caught two outdated premises Claude held: (a) "Wispr is purely dictation" — invalidated by Wispr's "Master Plan"; (b) "Apple Voice Control is the incumbent" — invalidated by ground-truth user behavior
- Codex's web search pulled live sources Claude couldn't access

## What changed

Recommended wedge from this diagnostic became **Approach A** in the design doc, which the founder approved. Implementation lives in commit `773de83`:
- New `send_developer_prompt` action variant in `src/types/actions.ts`
- `src/main/frontmost-app.ts` (osascript wrapper)
- `src/main/dev-tool-router.ts` (Cursor / Claude Code / Warp / iTerm / Terminal / VSCode adapters)
- `src/main/prompt-cleanup.ts` (light dictionary + filler stripping)
- `src/main/settings.ts` (auto-send toggle, default provider)
- System prompt rewritten to default to `send_developer_prompt`
- Settings UI: Anthropic key headline, OpenAI behind "Advanced"

## Why we ran this

The `/plan-eng-review` (see `codex-eng-review.md`) caught the architectural and security gaps. It did not ask "should we build this at all?" That's the question `/office-hours` exists to force, and codex was the cheapest way to get the cold-read second opinion with live web data. Total cost: one `codex exec` call (~3 minutes). Save: an unknown number of weekends spent building five actions when one would have been enough.
