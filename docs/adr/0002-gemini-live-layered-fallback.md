# 0002: Gemini Live as the primary voice path, with a layered fallback chain

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The demo must feel like a real conversation that drives the map: low latency, interruptible, with tool calls. It must also **never break during review**. Free-tier quotas, network issues or a provider outage can't be allowed to end the demo.

## Decision

The web app talks to voice through one `VoiceSession` interface, with four implementations tried in order:

1. **Gemini Live.** The browser connects directly to the Live WebSocket using a short-lived ephemeral token from `POST /live/token`. The token locks in the model, system prompt and tools. The server key never reaches the browser.
2. **Pipeline.** Push-to-talk, then Groq Whisper (`POST /stt`), then `POST /agent/turn` (Gemini text with the same tools, Groq LLM as backup), then TTS.
3. **Text.** Typed input through `/agent/turn`.
4. **Scripted.** Prepared replies and actions with no AI calls. Used for e2e tests and as the "never fails" mode.

A connect failure, a quota error (429) or a dropped socket moves to the next layer, and a visible badge shows the active mode. `?mode=` forces one.

## Consequences

- The API never holds long-lived connections, so it fits serverless hosting.
- Four session types to build and test. They share the dispatcher and `MapController`, and each is tested against fakes.
- Gemini Live and ephemeral tokens change often, so their current docs must be checked before implementing (CLAUDE.md).
