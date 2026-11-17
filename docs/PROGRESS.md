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
