# Progress

## Tue 17 Nov 2026: Day 1, foundations and route data

**Done** (branch `feat/day-1-foundations`, PR #1, CI green, `make check` passes)

- Repo scaffold: `services/api` (uv, FastAPI, Python 3.12), `apps/web` (pnpm, Vite, React, strict TS), pnpm workspace, root `Makefile` (`install`, `dev`, `check`, `gen`, `test`, `build`).
- Tooling: ruff, mypy strict, pytest and pre-commit for the API; ESLint (typescript-eslint strict and jsx-a11y), Prettier, Vitest, Husky + lint-staged for the web; commitlint. Husky owns the git hooks and calls pre-commit for the API.
- Config: pydantic-settings (repo-root `.env`, keys as `SecretStr`), validated web env module, `.env.example`.
- Schemas: `RouteData`, `Place`, `Stop`, `Fact` (`verified_from` required), `TravellerProfile`, `MapAction` (`{name, args}`, discriminated on `name`), `AgentTurnRequest` and `AgentTurnResponse`, with tests.
- Schema pipeline: `export_schemas.py` → `schemas/*.json` → `scripts/gen-types.mjs` → `packages/shared`. `make drift` and CI fail if either output is stale (checked by deliberately editing a generated file).
- API: `GET /health`, `GET /route` (503 when `data/route.json` is missing or invalid), with tests.
- CI: api, web and schema-drift jobs.
- ADRs 0001–0004.
- Web shell: conversation on the left, walk on the right, stacked on small screens. Skip link, captions log region, loading and error states with retry. The route is loaded through the Vite `/api` proxy and validated with Ajv. Checked in a browser at 1280px and 375px against the fixture route.

**Left**

- `data/route.json` (not ticked). Waiting on Williams's hotel, gate and stops, and on a confirmed `verified_from` for every fact. The pytest that validates it (4–5 stops, both profiles covered at every stop) is written and skips until the file exists. Until then `/route` returns 503 and the shell shows its error state. So the day's "Done when" (route.json validates and the shell renders it) is only met with fixture data so far.
- Williams's items: coverage check, hotel choice, Gemini and Groq keys, Maps key reminder.

**Notes and decisions**

- `make` was missing on Windows. GNU Make 4.4.1 is now installed through winget (`ezwinports.make`). Open a new terminal for it to be on PATH.
- Version pins: TypeScript 6.0 (typescript-eslint doesn't support TS 7 yet) and ESLint 9 (eslint-plugin-jsx-a11y doesn't support ESLint 10 yet). Revisit when they catch up.
- `httpx2` replaces `httpx` for the FastAPI test client (Starlette deprecated the httpx one).
- In dev the web calls `/api/*` through the Vite proxy, so CORS isn't needed yet. CORS for the deployed setup stays a Thursday item.
- The Ajv setup for discriminated unions (`MapAction`) is a Friday concern: Pydantic emits a `discriminator.mapping`, which Ajv's discriminator support doesn't accept.

**Blockers**

- `data/route.json` needs Williams's route choice.

## Tue 17 Nov 2026: plan change, Cesium ion and Mapillary instead of Google Maps Platform

Google Maps Platform needs a billing account with a card for 3D Tiles and Street View, and Williams can't add one. The plan now uses CesiumJS with Google Photorealistic 3D Tiles via Cesium ion (free) and Mapillary for street level, with Google Street View kept as an optional first provider. See ADR 0005.

- Updated: `docs/BUILD_PLAN.md` (sections 1 to 6 and the Tue, Wed, Thu, Sat and Mon checklists), `CLAUDE.md`, ADR 0003 marked superseded, new ADR 0005, `.env.example` (new web tokens and model names).
- Not changed: application code. The Day 1 `config/env.ts` update for the new web variables is now the first Wednesday item.
- New Williams items for today: Cesium ion account and token, Mapillary token, and a Mapillary coverage check before choosing the route.

## Wed 18 Nov 2026: replan after Abdiladiif's reply

No build work today. Abdiladiif confirmed: the experience only (no hotel APIs), any hotel and route, "as close to 100% real as possible", no Google Maps project from Niyvaru, and quality over speed.

- Realism is now the main success criterion, with three core parts: sight, sound and voice. New "Realism layer" section in `docs/BUILD_PLAN.md`: eye-height walking camera along the full path, local time-of-day lighting with shadows and atmosphere, crossfades to street-level photos, a licensed ambient soundscape that follows the walk and ducks under the voice.
- Days replanned: Thu 19 3D and walking camera, Fri 20 street level, light and sound, Sat 21 agent backend, Mon 23 Gemini Live voice, Tue 24 fallback chain and hardening, Wed 25 polish, deploy and deliver. Target moved from Mon 23 to Wed 25.
- The project is also a portfolio piece: public-facing text stays free of Niyvaru's name and private details (rule in `CLAUDE.md` and `BUILD_PLAN.md`).
- Still open from Day 1: `data/route.json`, waiting on Williams's route choice.

## Wed 18 Nov 2026: route drafted and confirmed

- Williams confirmed Google Earth shows realistic 3D for central Makkah, so the Cesium plan stands.
- Route chosen for imagery: Emaar Andalusia Hotel Makkah to King Abdul Aziz Gate (Gate 1), about 870 m along Al Mesial Road (pedestrian) and the Clock Tower plaza. Mapillary photos from June 2026 sit within about 25 m of every stop.
- Written to `data/route.json` (validates against `RouteData`, 5 stops, both profiles at every stop). Review checklist with photo links in `docs/route-review.md`.
- Williams confirmed all 10 facts, and each `verified_from` now records that. The Day 1 `route.json` item and his review item are his to tick.

- Day 1 closed: Williams completed the route review, and the Cesium ion, Mapillary, Gemini and Groq keys are in `.env`. No Google Maps key, so Street View stays off. Next: Thu 19 3D city and walking camera.

## Sat 21 Nov 2026: 3D city, route and camera math

Thu 19 work, done today.

- Done: web env for Cesium, Mapillary and the street-level provider; `MapController` with a fake; CesiumJS in Vite, loaded on demand (main bundle 361 kB, Cesium chunk 4.2 MB); `CesiumMapController` showing Google Photorealistic 3D Tiles through ion; route line and markers draped on the tiles; camera math module (27 tests). Page and API titles renamed to Mamsha.
- Checked in Chrome: no 401s from ion, every ion and tile request 200, Google and Cesium credits visible. First detailed tiles take about 15 s.
- Deviation: a missing ion token shows an error on the map instead of failing at startup, so chat and the scripted walk keep working.
- Optional terrain fallback not built: the token has no extra assets, so the error state covers it.
- Left from Thu 19: the walking camera and manual controls. Items stay unticked until the day's "Done when" (walking at eye height) is met.
- Schedule: Thu 19 and Fri 20 slipped. Compressed into today, target still Wed 25.
- Blocker: OneDrive syncing `node_modules` and `dist` slowed a web test run from about 1 to over 6 minutes. Williams paused syncing. Move the repo out of OneDrive if it persists.
