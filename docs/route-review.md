# Route review: Emaar Andalusia to King Abdul Aziz Gate

Draft drawn on 18 Nov 2026 from OpenStreetMap data and the Mapillary Graph API. It lives in `data/route.draft.json` until Williams has checked it. **Do not rename it to `data/route.json` until every box below is ticked**, because the agent treats `route.json` as verified truth.

## Why this route

- **Best street-level imagery around the Haram.** Mapillary has no 360° panoramas here, but a contributor walked this exact corridor in June 2026. Every stop has a recent photo within about 25 m. No other approach to the Haram has comparable coverage.
- **Pedestrian almost all the way.** It follows Al Mesial Road, a mapped pedestrian street, from Ibrahim Al Khalil Road to the Clock Tower plaza, then crosses the plaza to King Abdul Aziz Gate (Gate 1).
- **Right length.** About 870 m walked, 735 m in a straight line, within the 500 to 900 m target.
- **Varied scenery for the camera:** a street start, under the First Ring Road bridge, the approach to the Clock Tower, the plaza, then the gate.

## The route

| # | Stop | Distance along route | Heading | Nearest Mapillary photo |
|---|---|---|---|---|
| Start | Emaar Andalusia Hotel Makkah (OSM node 14340183401) | 0 m | 115° | none |
| 1 | Onto Al Mesial Road | about 214 m | 9° | [1342206844132060](https://www.mapillary.com/app/?pKey=1342206844132060), 26 m, 9 Jun 2026 |
| 2 | Under the First Ring Road | about 350 m | 10° | [2076696866591638](https://www.mapillary.com/app/?pKey=2076696866591638), 6 m, 9 Jun 2026 |
| 3 | Approaching the Clock Tower | about 490 m | 32° | [890898367409042](https://www.mapillary.com/app/?pKey=890898367409042), 9 m, 9 Jun 2026 |
| 4 | Clock Tower plaza | about 646 m | 31° | [928380466978781](https://www.mapillary.com/app/?pKey=928380466978781), 2 m, 9 Jun 2026 |
| 5 | Final approach to Gate 1 | about 830 m | 8° | [4203068953169753](https://www.mapillary.com/app/?pKey=4203068953169753), 24 m, 12 Jun 2026 |
| End | King Abdul Aziz Gate 1 (OSM node 4755914231) | about 867 m | | |

All photos are ordinary (non-360°) images. The street-level provider shows them facing the walking direction, and falls back to the Cesium eye-height camera where a photo doesn't suit.

## Checklist for Williams

Open each Mapillary link and the same spot in the 3D view (Google Earth is fine), then tick:

- [x] The hotel exists, is open, and its entrance is near the start of the path (OSM node is recent, so confirm the name and position)
- [x] The first leg from the hotel to the pedestrian street (about 50 m) is walkable
- [x] Stop 1: Al Mesial Road is a pedestrian street from here
- [x] Stop 2: the First Ring Road bridge is overhead here
- [x] Stop 3: the Dhiouf Makkah and Al Nahdi pharmacies are there, and the food court entrance is ahead
- [x] Stop 4: steps are to the west of the plaza, the hospital is to the east, the prayer hall is to the south-east
- [x] **The plaza crossing** from about (21.42036, 39.82496) to (21.42025, 39.82579) is not a mapped footway. Check in 3D that it's open plaza, not a wall or barrier, and adjust the path if needed
- [x] Stop 5: Gate 1 is straight ahead
- [x] Wheelchair access: there are no facts about ramps or slopes yet, because nothing reliable was found. If you can see a ramp, kerb or slope clearly in a photo, add it as a fact. Otherwise the agent should say it doesn't know
- [x] For each confirmed fact, replace `(draft: confirm in Mapillary or 3D)` in `verified_from` with what you checked, for example `Mapillary photo 928380466978781 (Jun 2026) and OpenStreetMap, checked by Williams 19 Nov 2026`
- [x] Remove or rewrite any fact you couldn't confirm
- [x] Rename `data/route.draft.json` to `data/route.json`, run `make check`, and tick the Day 1 `route.json` item

## Optional

- Pin the Mapillary image ids above in `route.json` once the schema has a `street_level` field (Fri 20 Nov plan item), so the demo doesn't depend on a live search.
