# Build plan: Niyvaru hotel-to-Haram walk demo

**Owner:** Williams Balogun
**Deadline:** Monday 23 November 2026 (send to Abdiladiif)
**Budget:** about 4 hours a day, Tue 17 to Mon 23 (Sat 21 is a planned working day for the fallback chain and hardening)
**Timezone for "today":** Africa/Lagos

Items marked **(Williams)** need a human. Claude Code must not tick them, and should remind Williams about them at the start of the day they fall on.

---

## 1. What the demo does

A single page, split in two:

- **Left: the agent.** A real-time voice conversation with live captions. The traveller speaks ("My father uses a wheelchair, we want a hotel near the Haram") and the agent answers out loud, and can be interrupted mid-sentence. A text box is always there.
- **Right: the real city.** Google's photorealistic 3D imagery of central Makkah, streamed through Cesium ion and rendered with CesiumJS.

The agent's speech drives the map through tool calls. It selects the hotel, draws the walking route, and flies the camera along it. At 4 or 5 stops it drops to street level facing the direction of walking (real 360° photos from Mapillary, or Google Street View if a Maps key is available) and explains what matters there for *this* traveller (slope, steps, crossings, entrance, a nearby pharmacy). Change the traveller profile and the narration changes.

**Success criteria (what Abdiladiif should feel):**
1. The streets look real (real 3D imagery and real street-level photos, not generated models).
2. The agent clearly understands the traveller's circumstances.
3. Voice, agent and map move together. It's not a chatbot sitting next to a map.
4. It never breaks during his review (a layered fallback chain ends in a scripted mode).

**Out of scope for this demo:** booking, multiple hotels, accounts, payments, the internal intelligence engine (the backend is laid out so it can be added later), mobile apps.

---

## 2. Architecture

```
Browser (apps/web, TypeScript)                         API (services/api, Python)
┌─────────────────────────────────────────┐            ┌───────────────────────────────────┐
│ VoiceSession interface                   │            │ FastAPI                            │
│  1. GeminiLiveSession ─────────── WebSocket ─▶ Gemini Live (direct, with ephemeral token)│
│  2. PipelineSession (fallback)           │            │                                    │
│  3. TextSession                          │  HTTPS     │ GET  /health                       │
│  4. ScriptedSession                      │ ─────────▶ │ GET  /route        (route.json)    │
│                                          │            │ POST /live/token   (ephemeral token│
│ Action dispatcher (Ajv + JSON Schema)    │            │                     locks model,   │
│        │                                 │            │                     prompt, tools) │
│        ▼                                 │            │ POST /stt          (Groq Whisper)  │
│ MapController interface                  │            │ POST /agent/turn   (Gemini text +  │
│  - CesiumMapController (Cesium ion 3D)   │            │                     tools, Groq LLM│
│  - FakeMapController (tests)             │            │                     as backup)     │
│ StreetLevelProvider chain                │            │                                    │
│  Google SV (if key) → Mapillary →        │            │                                    │
│  Cesium street-height camera             │            │                                    │
└─────────────────────────────────────────┘            │ Pydantic models = source of truth  │
                                                       └───────────────────────────────────┘
         schemas/*.json  ◀── exported from Pydantic ──▶  packages/shared (generated TS types)
```

### Why Python for the API and TypeScript for the web

- The browser side must be TypeScript: 3D maps, street-level imagery, the microphone and audio playback are browser APIs.
- The API is Python because the future intelligence engine (learning from conversations, proposing experiments, measuring conversion) is data and ML work. Starting in Python means the demo's backend can grow into the real product's backend instead of being thrown away.
- The cost of two languages (schema drift) is removed by making Pydantic the single source of truth: models export JSON Schema, TypeScript types are generated from it, the browser validates tool calls against the same JSON Schema with Ajv, and CI fails if anything is out of date.

### Voice: the fallback chain

Each layer implements one `VoiceSession` interface in the web app (`start`, `stop`, `sendText`, `onTranscript`, `onToolCall`, `onAudio`, `onError`). If a layer fails to connect or hits a quota, the app drops to the next one and shows a small status badge saying which mode is active.

1. **Gemini Live (primary).** The browser calls `POST /live/token`. The API creates a short-lived ephemeral token with the model, system prompt (including route facts and the grounding rule) and tool declarations locked in. The browser opens the Live WebSocket with that token, streams mic audio (16 kHz PCM via an AudioWorklet), plays the model's audio (24 kHz PCM), shows input and output transcriptions as captions, and handles tool calls and interruptions.
2. **Pipeline (fallback).** Push-to-talk recording goes to `POST /stt` (Groq Whisper). The text goes to `POST /agent/turn` (Gemini text model with the same tools, and a Groq-hosted LLM as backup). The reply is spoken with a TTS step (browser `speechSynthesis` as the last resort).
3. **Text.** Typed input through `/agent/turn`. No audio.
4. **Scripted.** `?mode=scripted` plays prepared replies and actions with no network calls to any AI. Used for e2e tests and as the "never fails" demo mode.

### Map and street level: the fallback chain

The demo must work with no paid Google Maps account. See ADR 0005.

- **3D city:** CesiumJS rendering Google Photorealistic 3D Tiles streamed through Cesium ion (free Community plan, no Google Cloud billing). `CesiumMapController` implements `MapController`.
- **Street level** goes through a `StreetLevelProvider` interface, tried in this order at each stop:
  1. **Google Street View**, only when `VITE_GOOGLE_MAPS_API_KEY` is set (for example if Niyvaru supplies a billed key).
  2. **Mapillary**: the nearest image to the stop through the Mapillary Graph API, preferring 360° panoramas, shown in a MapillaryJS viewer facing the walking direction.
  3. **Cesium street-height camera**: no photo exists, so the 3D camera drops to eye height (about 1.7 m above the ground, sampled from the 3D tiles) and faces the walking direction. Never fake imagery.
- `VITE_STREET_LEVEL_PROVIDER` can force one provider (`auto`, `google`, `mapillary`, `cesium`). `auto` follows the order above.

### Agent tools (map actions)

| Tool | Effect |
|---|---|
| `set_traveller_profile(profile, needs)` | `wheelchair_family` or `young_couple`, plus needs noted |
| `select_hotel(hotel_id)` | Highlights the hotel and frames it in 3D |
| `show_route()` | Draws the walking route as a 3D line |
| `start_walk()` | Begins the camera fly-along |
| `fly_to_stop(stop_id)` | Moves the camera to a stop |
| `enter_street_view(stop_id)` | Street-level view at the stop, facing the walking direction, from the first provider that has imagery (name kept for schema stability, see ADR 0005) |
| `exit_street_view()` | Back to the 3D view |
| `pause_walk()` / `resume_walk()` | Walk control |

Tool declarations are generated from the Pydantic action models, so the model, the API and the browser all use the same definitions. During the walk the web app sends the agent an `arrived_at_stop` event so it narrates that stop for the current profile.

### Grounding rule (non-negotiable)

The agent may only state facts about a place that exist in `data/route.json`. If asked something it doesn't have, it says so. Every fact has a `verified_from` field. Real pilgrims may rely on this, so nothing gets invented.

---

## 3. Stack

| Area | Choice | Why |
|---|---|---|
| Web | TypeScript (strict), Vite, React | Browser APIs require it, fits his experience |
| API | Python 3.12, FastAPI, Pydantic v2, pydantic-settings | Typed, fast, the natural home for the future intelligence engine |
| Python tooling | uv, ruff (lint + format), mypy (strict), pytest + pytest-asyncio, httpx test client | Professional baseline |
| Primary voice | Gemini Live API via `google-genai` (Python, for tokens) and the browser Live WebSocket | Real-time speech-to-speech with tool calling, free tier to start |
| Fallback STT | Groq Whisper (`whisper-large-v3-turbo`) | Free tier, no card |
| Fallback TTS | Groq Orpheus (`canopylabs/orpheus-v1-english`), browser `speechSynthesis` last | A real voice in the pipeline fallback (check it's on the free tier) |
| Fallback LLM | Gemini text model with tools, Groq-hosted LLM as backup | Same tools, different provider |
| 3D | CesiumJS + Google Photorealistic 3D Tiles via Cesium ion (`createGooglePhotorealistic3DTileset`) | Real Google imagery with no Google Cloud billing, finer camera control. Free Community plan (personal, non-commercial) |
| Street level | Mapillary (Graph API + MapillaryJS), Google Street View when a key exists, Cesium street-height camera as the last resort | Free real photos, with fallbacks for coverage gaps |
| Route | Hand-drawn coordinates in `data/route.json`, served by `GET /route` | Full control near the Haram, no Routes API cost |
| Shared schema | Pydantic → JSON Schema → `json-schema-to-typescript` types + Ajv runtime validation | One source of truth across languages |
| JS tooling | pnpm, ESLint, Prettier, Vitest, Playwright | Standard |
| Repo hygiene | pre-commit (ruff, mypy) + Husky/lint-staged (web), commitlint, conventional commits | Consistent history |
| CI | GitHub Actions: two jobs (api, web) plus a schema-drift check | Runs on every push and PR |
| Hosting | Vercel: web as a static site, API as a Python (FastAPI) function | Free. The API needs no long-lived connections, since the browser talks to Gemini Live directly |

---

## 4. Repository layout

```
mamsha/
├── apps/
│   └── web/                     # Vite + React + TS
│       └── src/
│           ├── voice/           # VoiceSession interface + GeminiLive, Pipeline, Text, Scripted sessions,
│           │                    # AudioWorklet capture, PCM playback
│           ├── agent/           # api client, action dispatcher (Ajv), conversation state
│           ├── map/             # MapController (Cesium + Fake), StreetLevelProvider (Google, Mapillary,
│           │                    # Cesium street-height), camera math
│           ├── walk/            # walk state machine
│           └── components/      # ChatPanel, Captions, ModeBadge, ProfileToggle, WalkProgress
├── services/
│   └── api/                     # FastAPI, managed with uv
│       ├── app/
│       │   ├── main.py
│       │   ├── config.py        # pydantic-settings
│       │   ├── routers/         # health, route, live, stt, agent
│       │   ├── schemas/         # Pydantic models: RouteData, Stop, MapAction, AgentTurn... (source of truth)
│       │   ├── agent/           # prompt builder, tool declarations from schemas, grounding
│       │   ├── providers/       # LiveTokenIssuer, STTProvider (Groq), LLMProvider (Gemini, Groq, Scripted)
│       │   └── export_schemas.py
│       └── tests/
├── packages/
│   └── shared/                  # GENERATED TS types + JSON Schemas (do not edit by hand)
├── schemas/                     # exported JSON Schemas (generated, committed)
├── data/route.json
├── docs/
│   ├── BUILD_PLAN.md
│   ├── PROGRESS.md
│   └── adr/
├── .github/workflows/ci.yml
├── .env.example
├── CLAUDE.md
└── README.md
```

**Environment (validated at startup, never committed):**

- Web: `VITE_CESIUM_ION_TOKEN`, `VITE_MAPILLARY_ACCESS_TOKEN`, `VITE_STREET_LEVEL_PROVIDER` (`auto`, `google`, `mapillary`, `cesium`), `VITE_GOOGLE_MAPS_API_KEY` (optional), `VITE_API_BASE_URL`, `VITE_DEFAULT_MODE` (`live`, `pipeline`, `text`, `scripted`)
- API: `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`, `GEMINI_TEXT_MODEL`, `GROQ_API_KEY`, `GROQ_STT_MODEL`, `GROQ_LLM_MODEL`, `GROQ_LLM_MODEL_FALLBACK`, `GROQ_TTS_MODEL`, `GEMINI_TEXT_MODEL_FALLBACK`, `ALLOWED_ORIGIN`, `RATE_LIMIT_PER_MIN`, `LIVE_TOKEN_TTL_SECONDS`

Browser tokens are public by nature, so each is scoped: the Cesium ion token is restricted to the allowed URLs (localhost and the deployed domain) and to the Google 3D Tiles asset, the Mapillary client token is read-only, and the optional Maps key is referrer-restricted. Gemini and Groq keys only live on the server. The browser only ever receives short-lived Live tokens.

---

## 5. Day-by-day checklist

Each day ends with: `make check` passing (api and web lint, types, tests, schema drift), work committed with conventional commits, and a line added to `docs/PROGRESS.md`.

### Tue 17 Nov: foundations and route data

- [ ] **(Williams)** Check coverage around the Haram: Mapillary imagery on mapillary.com (green lines and dots, prefer 360° images) and the 3D view in Google Earth
- [ ] **(Williams)** Choose one hotel 500 to 900 m from a Haram gate, on a route with Mapillary imagery at as many stops as possible
- [ ] **(Williams)** Create a free Cesium ion Community account (cesium.com) and an access token restricted to localhost and the Google Photorealistic 3D Tiles asset
- [ ] **(Williams)** Get a Mapillary client access token from the Mapillary Developer Portal
- [ ] **(Williams)** Get free API keys: Gemini (Google AI Studio) and Groq (console.groq.com)
- [ ] **(Williams)** Optional: if Abdiladiif sends a Google Maps key, add it to `.env` to enable Street View as the first street-level provider
- [x] Scaffold the repo: `apps/web` (pnpm, Vite, React, strict TS), `services/api` (uv, FastAPI), root `Makefile` with `dev`, `check`, `gen`, `test`, `build`
- [x] Tooling: ruff, mypy strict, pytest, pre-commit for the API. ESLint, Prettier, Vitest, Husky + lint-staged for web. commitlint
- [x] Config: `pydantic-settings` for the API, a validated env module for web, `.env.example`
- [x] Pydantic schemas: `RouteData`, `Stop`, `Fact` (with `verified_from`), `TravellerProfile`, `MapAction` (discriminated union), `AgentTurnRequest`, `AgentTurnResponse`, with tests
- [x] Schema pipeline: `export_schemas.py` writes `schemas/*.json`, `make gen` generates `packages/shared` TS types, CI fails on drift
- [ ] `data/route.json`: hotel, Haram gate, route coordinates, 4 or 5 stops (position, heading, title, facts). Validated by a pytest
- [x] API: `GET /health` and `GET /route`, with tests
- [x] GitHub Actions CI: api job, web job, schema-drift job
- [x] ADRs: 0001 Python API + TypeScript web with generated types, 0002 Gemini Live with a layered fallback chain, 0003 Maps JS 3D over CesiumJS (superseded by 0005), 0004 hand-drawn route
- [x] ADR 0005: CesiumJS + Cesium ion for 3D, Mapillary for street level, Google Street View optional
- [x] Web shell: split layout (chat left, map right), loads the route from the API, responsive, keyboard accessible

**Done when:** CI is green, `route.json` validates, and the shell renders the route data.

### Wed 18 Nov: 3D map and fly-along

- [ ] Web env: add `VITE_CESIUM_ION_TOKEN` (required), `VITE_MAPILLARY_ACCESS_TOKEN` (optional), `VITE_STREET_LEVEL_PROVIDER` (default `auto`) to `config/env.ts` with tests. The Google key stays optional. Update `.env.example` comments if needed
- [ ] `MapController` interface plus `FakeMapController` for tests
- [ ] CesiumJS set up in Vite (static assets via `vite-plugin-static-copy` or `vite-plugin-cesium`, `CESIUM_BASE_URL`), lazy-loaded so the chat panel renders first
- [ ] `CesiumMapController`: viewer that loads only Google Photorealistic 3D Tiles from Cesium ion, centred on the hotel. Google logo and Cesium credits visible. The token is restricted to that one asset, so turn off every Cesium default that requests other ion assets or services: create the `Viewer` with `globe: false`, `baseLayer: false`, `baseLayerPicker: false`, `geocoder: false`, `terrain` unset, and also `timeline: false`, `animation: false`, `homeButton: false`, `sceneModePicker: false`, `navigationHelpButton: false`. Show the sky but no ellipsoid. Done when the network tab shows no 401s from ion
- [ ] Optional fallback (only if Williams adds Cesium World Terrain and Cesium OSM Buildings to the token): if the Google tiles fail to load, enable the globe with World Terrain plus OSM Buildings and show a small notice. Otherwise show a clear error state with the scripted walk still usable
- [ ] Draw the route as a polyline clamped to the 3D tiles, and add markers (entities) for the hotel, stops and the gate
- [ ] Camera math module (bearing, path interpolation, camera at each stop), with unit tests
- [ ] Fly-along: move the camera stop by stop with `camera.flyTo` (heading and pitch from the camera math), pause at each, show `WalkProgress` ("Stop 2 of 5 · 280 m to go")
- [ ] Manual controls (start, pause, next stop) so the walk works without the agent

**Done when:** pressing Start flies the route smoothly in real 3D and the camera math tests pass.

### Thu 19 Nov: street level, walk logic and the agent backend

- [ ] `StreetLevelProvider` interface (`findImagery(stop)`, `show(stop)`, `hide()`), plus a fake for tests
- [ ] `MapillaryProvider`: query the Graph API for the nearest image to the stop (bbox around the stop, prefer `is_pano`), open a MapillaryJS viewer facing the walking heading, Mapillary attribution with a link
- [ ] `CesiumStreetHeightProvider`: camera to about 1.7 m above the sampled tile height at the stop, facing the walking heading (always available)
- [ ] `GoogleStreetViewProvider`: only registered when `VITE_GOOGLE_MAPS_API_KEY` is set (`getPanorama` with outdoor source)
- [ ] Provider chain: `auto` tries Google (if registered), then Mapillary, then Cesium street height, with smooth switches in and out of the 3D view. Tested with fakes, including "no imagery anywhere"
- [ ] Optional: pre-resolve each stop's Mapillary image id once and store it in `route.json` (`street_level.mapillary_image_id`) after Williams checks it, so the demo doesn't depend on a live search
- [ ] Walk state machine (idle, flying, at stop, street view, done), with tests
- [ ] **(Williams)** Walk the route in Mapillary and the 3D view, and confirm or correct every fact in `route.json`
- [ ] Agent core (API): system prompt builder injecting route facts and the grounding rule, tool declarations generated from `MapAction`, with tests
- [ ] `POST /live/token`: creates an ephemeral Gemini Live token with model, prompt and tools locked in, short expiry, rate limited. Tested with the provider mocked
- [ ] `POST /agent/turn` with `LLMProvider` (Gemini text first, Scripted for tests). Invalid tool calls are dropped and logged
- [ ] CORS restricted to `ALLOWED_ORIGIN`, error handler, request logging

**Done when:** the full walk with street-level views works by hand, and the API returns a valid Live token and valid text-mode replies (mocked in tests).

### Fri 20 Nov: Gemini Live voice (primary path)

- [ ] `VoiceSession` interface and `GeminiLiveSession`: fetch the token, open the Live WebSocket, handle setup and close
- [ ] Mic capture with an AudioWorklet, resampled to 16 kHz PCM and streamed
- [ ] Audio playback of 24 kHz PCM with a small buffer, and stop playback instantly on interruption
- [ ] Captions from input and output transcription
- [ ] Tool calls: validate with Ajv against the shared JSON Schema, run through the dispatcher on the `MapController`, send tool responses back to the session
- [ ] `arrived_at_stop` events sent into the session during the walk
- [ ] Profile toggle (wheelchair family, young couple) feeds into the conversation
- [ ] Unit tests for the PCM conversion and the dispatcher. The session itself is tested against a fake WebSocket

**Done when:** a spoken conversation selects the hotel, starts the walk, narrates each stop for the profile, and can be interrupted.

### Sat 21 Nov: fallback chain and hardening

- [ ] `POST /stt` with `STTProvider` (Groq Whisper), with size and type limits and tests
- [ ] Groq LLM as the backup `LLMProvider` behind `/agent/turn`
- [ ] `PipelineSession` (push-to-talk, STT, agent turn, TTS), `TextSession` and `ScriptedSession`
- [ ] Automatic fallback on connect failure, quota (429) or socket drop, plus a `ModeBadge` and a manual `?mode=` override
- [ ] Playwright smoke test in scripted mode (conversation, walk start, stop narration), with the map faked
- [ ] Loading, error and permission states (mic denied, quota hit, no street-level imagery, Cesium token invalid)
- [ ] Accessibility: keyboard controls, focus order, captions always on, reduced-motion option for camera moves

### Mon 23 Nov: polish, deploy, deliver

- [ ] Deploy web and API to Vercel and set env vars there. Add the deployed domain to the Cesium ion token's allowed URLs (and to the Maps key, if used)
- [ ] Test each mode (live, pipeline, text, scripted) on desktop Chrome and on a phone
- [ ] README: what it is, a GIF, architecture diagram, how to run locally, the fallback chain, decisions (link the ADRs), what's real vs scripted, how the intelligence engine would plug in
- [ ] Tag `v0.1.0` and write release notes
- [ ] **(Williams)** Record a 60 to 90 second screen video of the full flow (backup in case the link has problems)
- [ ] **(Williams)** Email Abdiladiif: the link, the video, a short note on the approach and next steps, and a reminder about the terms

---

## 6. Rules for the build

- Never commit keys. Gemini and Groq keys stay on the server. The browser only gets short-lived Live tokens and scoped public tokens (Cesium ion, Mapillary, optional Maps key).
- Don't download, store or cache 3D tiles, Mapillary or Street View imagery. Load it live. Keep the Google logo, Cesium credits and Mapillary attribution visible.
- Cesium ion's Community plan is for personal, non-commercial use. If Niyvaru uses this commercially, it needs a paid Cesium plan or its own Google Maps Platform key.
- Every place fact comes from `route.json` and has a `verified_from` value.
- Pydantic models are the only place schemas are written by hand. Everything else is generated.
- The repo stays Williams's. Share only the deployed link and the video.
- Small conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), one concern each.
