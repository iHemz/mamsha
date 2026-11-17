# 0004: A hand-drawn route in `data/route.json`

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The walk covers one hotel and one Haram gate. Near the Haram, routing APIs can suggest paths that aren't the ones pilgrims actually walk: closed gates, crowd-control barriers, or step-free versus stepped routes. The agent also needs place facts it can state safely, because real pilgrims may rely on them.

## Decision

- The route is drawn by hand in `data/route.json`: hotel, gate, path coordinates, and 4 or 5 stops (position, walking heading, title, facts). `GET /route` serves it.
- It is validated by the `RouteData` Pydantic model, by pytest against the real file, and by Ajv in the browser.
- Every fact has a `verified_from` value that Williams has confirmed (for example, from walking it in Street View). The agent may only state facts in this file.

## Why not the Routes API

The Routes API costs money, gives less control over the exact path near the Haram, and supplies no facts to narrate. The demo needs one carefully chosen route, not routing in general.

## Consequences

- Adding hotels means drawing and verifying more routes by hand. That's acceptable for a demo, and the schema already supports it.
- Facts are only as good as their verification. The schema forces a `verified_from` value but can't check it, so Williams's review (Thu 19 Nov) stays a required human step.
