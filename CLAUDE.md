# CLAUDE.md

This repo is a demo for Niyvaru: a real-time voice agent that walks a traveller from a Makkah hotel to the Haram through real 3D imagery (Google Photorealistic 3D Tiles via Cesium ion, rendered with CesiumJS) and real street-level photos (Mapillary, or Google Street View when a key exists). The web app is TypeScript (Vite + React). The API is Python (FastAPI). The full plan is in `docs/BUILD_PLAN.md`.

## How to work each session

1. Read `docs/BUILD_PLAN.md` and `docs/PROGRESS.md`.
2. Work out today's date in Africa/Lagos and find that day's section. If earlier days have unticked items, finish those first, oldest first.
3. At the start, list any **(Williams)** items due today so he can do them. Never tick those yourself.
4. Work through the unticked items in order. Keep each change small and focused.
5. Only tick an item (`- [ ]` to `- [x]`) when it meets the day's "Done when" and `make check` passes.
6. Commit with conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), one concern per commit.
7. At the end, add a dated entry to `docs/PROGRESS.md`: what was done, what's left, any blockers.

If something in the plan is wrong or blocked (an API has changed, a model name is outdated, coverage is missing), stop and explain the options. Don't quietly change scope. Check current docs for Gemini Live, `google-genai` ephemeral tokens, CesiumJS, Cesium ion and the Mapillary API before writing code against them, since these change often.

## Standards

**Python (`services/api`)**
- Python 3.12, managed with uv. ruff for lint and format, mypy strict, pytest.
- Pydantic models in `app/schemas/` are the single source of truth for all shared data. Settings via pydantic-settings.
- External services only through provider interfaces (`LiveTokenIssuer`, `STTProvider`, `LLMProvider`). Tests never call real APIs.

**TypeScript (`apps/web`)**
- Strict mode. No `any` without a comment saying why.
- Never hand-edit `packages/shared` or `schemas/`. Run `make gen` after changing a Pydantic model.
- Model tool calls are validated with Ajv against the shared JSON Schema before anything touches the map.
- The map is only touched through `MapController`, street-level imagery only through `StreetLevelProvider`, voice only through `VoiceSession`. Logic is tested with the fake implementations.

**Both**
- New logic comes with tests. Schemas, prompt builder, tool declarations, camera math, the walk state machine, the dispatcher and PCM conversion must stay covered.
- Accessible by default: keyboard operable, captions always on, respects reduced motion.

## Hard rules

- Never commit secrets. Keys live in `.env` (gitignored). Keep `.env.example` current.
- Gemini and Groq keys are server-side only. The browser only receives short-lived Live tokens from `POST /live/token`.
- Never download, store or cache 3D tiles, Mapillary or Street View imagery. Keep the Google logo, Cesium credits and Mapillary attribution visible.
- Never fake street-level imagery. If no provider has imagery for a stop, use the Cesium street-height camera.
- The Google Maps key is optional. The app must run fully without it.
- The Cesium ion token is browser-side and restricted to the Google Photorealistic 3D Tiles asset. Never enable Cesium viewer defaults that call other ion assets or services (globe imagery, terrain, geocoder, base layer picker).
- The agent may only state place facts that exist in `data/route.json`. Never add facts without a `verified_from` value Williams has confirmed.

## Commands

- `make dev`: run the API (uvicorn) and web (Vite) together
- `make check`: ruff, mypy, pytest, ESLint, tsc, Vitest and the schema-drift check (must pass before ticking anything)
- `make gen`: export JSON Schemas from Pydantic and regenerate the TS types
- `make test-e2e`: Playwright smoke test in scripted mode
- `make build`: production builds
