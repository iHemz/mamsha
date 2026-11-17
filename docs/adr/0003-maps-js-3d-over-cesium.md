# 0003: Maps JavaScript 3D maps instead of CesiumJS

- **Status:** Superseded by [0005](0005-cesium-ion-and-mapillary.md) on 2026-11-17
- **Date:** 2026-11-17

## Context

The success criterion is that the streets look real: photorealistic 3D around the Haram, plus real street-level photos. Both options can show Google's Photorealistic 3D Tiles.

## Decision

Use the Maps JavaScript API 3D maps (`maps3d`: `Map3DElement`, `Polyline3DElement`, `Marker3DElement`, `flyCameraTo`) for the city, and `StreetViewPanorama` for street level. The map is touched only through a `MapController` interface, with `GoogleMapController` in the app and `FakeMapController` in tests.

## Why not CesiumJS

CesiumJS gives finer camera control, but it needs a separate tile setup, its own attribution handling and more code for markers and lines. It also doesn't integrate with Street View. For a one-week demo, `maps3d` gives real imagery, markers, polylines and camera flights with far less code, and Street View sits in the same API family and uses the same key.

## Consequences

- `maps3d` may need the beta or alpha channel, and its API may change. Check the current docs before building (Wed 18 Nov).
- Imagery is always loaded live and never downloaded or cached, and Google's attribution stays visible.
- Because the map sits behind `MapController`, switching to CesiumJS later only means a new controller, not a rewrite.
