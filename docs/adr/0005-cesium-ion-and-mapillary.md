# 0005: CesiumJS with Cesium ion for 3D, Mapillary for street level

- **Status:** Accepted
- **Date:** 2026-11-17
- **Supersedes:** [0003](0003-maps-js-3d-over-cesium.md)

## Context

ADR 0003 chose the Maps JavaScript API for 3D and Street View. Every Google Maps Platform service except the limited Maps Demo Key needs a Google Cloud billing account with a card, and the Demo Key does not cover Street View. The demo has to run with no paid accounts, and Niyvaru's own Maps key may not arrive before the deadline.

## Decision

- **3D:** CesiumJS rendering Google Photorealistic 3D Tiles streamed through Cesium ion. Cesium ion includes these tiles in its free Community plan with no Google Cloud sign-up. `CesiumMapController` implements `MapController`.
- **Street level:** a `StreetLevelProvider` interface with a fallback chain at each stop:
  1. Google Street View, registered only when `VITE_GOOGLE_MAPS_API_KEY` is set.
  2. Mapillary: the nearest image through the Mapillary Graph API (360° preferred), shown in MapillaryJS. Free for any use.
  3. Cesium street-height camera: the 3D camera at eye height facing the walking direction. Always available.
- The `enter_street_view` and `exit_street_view` tool names stay as they are, so the schemas, generated types and prompts don't churn. They now mean "street-level view" whatever the provider.

## Why

- Same real Google imagery for the 3D city, at no cost.
- CesiumJS gives finer camera control for the fly-along, which suits the walk.
- The provider chain keeps the demo working when coverage or keys are missing, and never fakes imagery.

## Consequences

- More setup than `maps3d`: CesiumJS static assets in Vite, its own attribution handling, and route lines clamped to 3D tiles.
- Mapillary coverage is crowdsourced and uneven. Williams checks it when choosing the route, and stop image ids can be pinned in `route.json` after review.
- Cesium ion's Community plan is for personal, non-commercial use. A commercial Niyvaru build needs a paid Cesium plan or a billed Google Maps Platform key. Because the map sits behind `MapController` and `StreetLevelProvider`, switching back to Google's own APIs is a new implementation, not a rewrite.
- The Cesium ion token is used in the browser, so it is restricted to allowed URLs and to the Google 3D Tiles asset.
