# 0001: Python API and TypeScript web, with generated shared types

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The browser side has to be TypeScript: the 3D map, Street View, the microphone and audio playback are all browser APIs. The backend is small for the demo (route data, Live tokens, a text fallback), but it is meant to grow into the intelligence engine, which is data and ML work. Two languages risk the API and the web disagreeing about the shape of shared data, especially model tool calls.

## Decision

- The API is Python (FastAPI, Pydantic v2), and the web is TypeScript (Vite, React).
- Pydantic models in `services/api/app/schemas/` are the **only** hand-written schemas.
- `make gen` exports them to JSON Schema (`schemas/*.json`) and generates TypeScript types into `packages/shared` with `json-schema-to-typescript`. Both outputs are committed and never edited by hand.
- The browser validates runtime data (the route, and every model tool call) with Ajv against the same JSON Schemas.
- `make drift`, run in CI and in `make check`, regenerates both outputs in memory and fails if the committed files differ.

## Consequences

- One change to a model updates the API validation, the TS types and the browser validation together. Forgetting to regenerate fails CI.
- Contributors need both uv and pnpm. The Makefile hides the difference.
- JSON Schema features with no TypeScript equivalent (min/max items, string patterns) are enforced at runtime by Pydantic and Ajv, not by the type checker.
