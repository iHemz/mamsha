---
name: bugs
description: Structured 5-phase bug investigation and fix planning for this repo (Vite + React voice/map web app, FastAPI API) - root cause with file:line evidence, options, then fix.
argument-hint: "[bug description]"
---

# Bug Exploration & Fix Planning

Work as a senior debugging specialist: find the root cause, assess the impact, and design the fix. Explore the code on your own, then present fix options with honest trade-offs.

## Project context

**Stack:** Vite + React + strict TypeScript (`apps/web`, pnpm) · FastAPI + Pydantic v2 (`services/api`, uv) · Gemini Live (browser WebSocket using an ephemeral token) · Groq Whisper/LLM fallback · Google Maps 3D (`maps3d`) + Street View.

**Where bugs usually live. Trace the full path:**
- **Voice:** mic → AudioWorklet (16 kHz PCM) → `VoiceSession` (GeminiLive → Pipeline → Text → Scripted fallback) → transcripts, tool calls and audio (24 kHz playback). Check for token expiry, sample-rate mismatches, interruption handling, and fallbacks that never trigger or trigger too eagerly.
- **Actions:** model tool call → dispatcher (Ajv against `schemas/*.json`) → `MapController` → the map. Check whether the schema rejected the call, whether the generated types drifted (`make gen`), and whether the call bypassed the dispatcher.
- **Walk:** walk state machine → `arrived_at_stop` event → agent narration. Look for an invalid transition, events firing twice, or a stop with no facts in `data/route.json`.
- **API:** router → provider interface (`LiveTokenIssuer`, `STTProvider`, `LLMProvider`) → external service. Check settings validation, CORS (`ALLOWED_ORIGIN`) and rate limits.
- **Grounding:** if the agent said something false about a place, check `data/route.json` and the prompt builder before blaming the model.

**Quality gate (before shipping any fix):** `make check`. Add `make test-e2e` if voice, walk or dispatcher flow changed.

**Shipping:** fixes go through `/ship`, using a branch and one concern per commit.

## The 5 phases

1. **Clarify.** Ask 1–3 targeted questions only if something critical is missing: repro steps, which voice mode was active (see the mode badge), browser, console errors. Skip this if the bug is clear.
2. **Investigate the root cause.** For anything beyond one file, hand the search to an `Explore` agent (or the `research-agent`). Have it trace the path above and find the exact file and line where things go wrong. For a deployed build, check Vercel runtime logs through the Vercel MCP before guessing. For Gemini Live, `google-genai` or Maps 3D behaviour, check the **current** docs. These APIs change often.
3. **Present the root cause.** Give the `file:line`, what is wrong and why, and the evidence (code or log).
4. **Lay out the options.** Give 2–3 fixes, each with effort, risk (does it touch the schemas, the voice fallback chain, secrets or tokens, or `route.json`?), the files affected, and the tests to add.
5. **Recommend and act.** Use the table below.

| Complexity | Action |
|---|---|
| **1–2** | Fix it, add a regression test, run `make check`, then `/ship` |
| **3–6** | Multi-file fix with tests, run `make check` (and `make test-e2e`), then `/ship` |
| **7+**, or it changes the plan's scope | Present the approach and wait for Williams before building |

## Principles

- Use specific `file:line` references, never vague observations.
- Every fix gets a regression test that would have caught the bug, written against the fakes, never a real API.
- Fix the root cause, not the symptom. Never "fix" grounding by loosening the rule, or validation by skipping Ajv.
- Give honest effort and risk estimates.
