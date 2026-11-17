---
name: test
description: Write and run tests for this repo across the pyramid: pytest for the FastAPI service (services/api), Vitest for the Vite + React web app (apps/web) using the fake MapController/VoiceSession, and the Playwright smoke test in scripted mode.
argument-hint: "[path or feature to test, or 'setup' to scaffold the tooling]"
---

# Test: the project's testing method

This is the single reference for **how we test**. `/principal` and `/ship` defer to it. Call it directly to test a module or flow. Call it with `setup` to scaffold the tooling the first time (Day 1 of `docs/BUILD_PLAN.md`).

The rule: **new logic without tests is not done.** These must always stay covered (`CLAUDE.md`): **schemas, the prompt builder, tool declarations, camera math, the walk state machine, the action dispatcher and PCM conversion.**

## The test pyramid

| Layer | API (`services/api/`) | Web (`apps/web/`) |
|---|---|---|
| **Unit**: pure logic, no I/O | pytest: schemas, prompt builder, tool declarations, grounding | Vitest: camera math, walk state machine, PCM conversion, dispatcher |
| **Integration**: units wired together, boundaries faked | httpx/`TestClient` against routers, with fake providers injected | Vitest: dispatcher + `FakeMapController`, sessions + `FakeVoiceSession`, components with RTL |
| **End-to-end** | none | Playwright in `?mode=scripted` with the map faked (`make test-e2e`) |

**What to fake.** Tests never call a real API: not Gemini, Groq or Google Maps. They aren't free, they're slow, and their output varies.
- API: inject fake `LiveTokenIssuer`, `STTProvider` and `LLMProvider` through FastAPI dependency overrides. Never patch the `google-genai` or Groq SDKs deep inside a module. If you need to, the provider boundary is in the wrong place.
- Web: use `FakeMapController` and `FakeVoiceSession` (or `ScriptedSession`). Assert on the calls the fake recorded, not on pixels.
- Settings: build a `Settings(...)` instance in the test. Never read the developer's `.env`.

## API: pytest

Tests live in `services/api/tests/` and mirror `app/` (`tests/schemas/`, `tests/agent/`, `tests/routers/`, `tests/providers/`). Files are named `test_<module>.py`. mypy strict covers the tests too.

```bash
make check                                   # everything
cd services/api && uv run pytest -k <name>   # filter
cd services/api && uv run pytest --cov=app   # coverage
```

Patterns:
- **Schemas:** valid and invalid examples for each model, plus a check that every `MapAction` variant exports a JSON Schema and a tool declaration.
- **Prompt builder:** the prompt contains every `route.json` fact for the profile and the grounding rule. A fact without `verified_from` is rejected or left out.
- **Routes:** `POST /live/token` returns a token from the fake issuer, rate limits apply, and no server key ever appears in a response body.

```python
# services/api/tests/routers/test_live.py
def test_live_token_never_leaks_server_key(client, settings):
    r = client.post("/live/token")
    assert r.status_code == 200
    assert settings.gemini_api_key.get_secret_value() not in r.text
```

## Web: Vitest + RTL + Playwright

Unit and component tests sit next to their source (`walkMachine.test.ts`, `Captions.test.tsx`). E2E specs live in `apps/web/e2e/*.spec.ts`.

```bash
pnpm --dir apps/web test          # vitest once
pnpm --dir apps/web test --watch
make test-e2e                     # playwright, scripted mode
```

Patterns:
- **Dispatcher:** a valid tool call reaches `FakeMapController` with the right arguments. An invalid one (unknown `stop_id`, extra property, wrong type) is rejected by Ajv and **never** reaches the map.
- **Walk state machine:** table-driven tests for every transition: start, arrive, pause, resume, enter or exit Street View, finish. Invalid transitions are no-ops or errors, never silent state corruption.
- **PCM:** Float32 → Int16 16 kHz capture and Int16 24 kHz → Float32 playback, including clipping at ±1 and resampling lengths.
- **Camera math:** heading and bearing between stops, wraparound at 0/360 degrees, Street View facing the walking direction.
- **Fallback chain:** when a `VoiceSession` errors on connect, the app drops to the next mode and the mode badge updates.
- **Accessibility:** captions render for both input and output transcripts. Controls are reachable by keyboard. Reduced motion skips the fly animations.
- Query by role, label or text, the way a user finds things. Don't query by class names.

## First-time setup (`/test setup`)

Only when the harness doesn't exist yet. Add the tooling, wire it into `make check`, and commit one green smoke test per layer.
- API: `cd services/api && uv add --dev pytest pytest-asyncio pytest-cov httpx`. Then set `[tool.pytest.ini_options]` with `asyncio_mode = "auto"`, and add `tests/conftest.py` with `settings`, fake providers and a `client` fixture.
- Web: `pnpm --dir apps/web add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test`. Then add a `test` block to `vite.config.ts` (jsdom, `setupFiles`) and `playwright.config.ts` with `webServer` started in scripted mode.

## Definition of done

- Any new or changed logic in the covered areas above has unit tests. New routes have a router test using fake providers.
- New user-facing flows extend the scripted Playwright smoke test where it makes sense.
- `make check` is green before an item is ticked or shipped.
- No test touches a real AI provider, the Maps API or the developer's `.env`.
