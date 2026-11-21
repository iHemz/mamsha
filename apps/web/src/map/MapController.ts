/**
 * The only way the app touches the map. Rendering lives behind this interface
 * (`CesiumMapController`), and everything that decides *where* the camera goes
 * (camera math, the walking camera, the dispatcher) sits above it and is tested
 * against `FakeMapController`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Degrees for heading and pitch, metres for height. */
export interface CameraPose {
  position: LatLng;
  /** Height above the WGS84 ellipsoid. The 3D tiles have no separate terrain. */
  height: number;
  /** Compass heading: 0 is north, 90 is east. */
  heading: number;
  /** 0 is level, negative looks down. */
  pitch: number;
}

export type MarkerKind = "hotel" | "stop" | "gate";

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  label: string;
  position: LatLng;
}

export type MapStatus =
  { state: "loading" } | { state: "ready" } | { state: "error"; message: string };

export interface MapController {
  /** Create the map inside `container`. Resolves once the first tiles are requested. */
  mount(container: HTMLElement): Promise<void>;
  /** Tear everything down. Safe to call twice. */
  destroy(): void;

  /** Draw the walking route on the ground, replacing any previous route. */
  showRoute(path: readonly LatLng[]): void;
  hideRoute(): void;

  /** Replace all markers. */
  setMarkers(markers: readonly MapMarker[]): void;
  /** Emphasise one marker, or none. */
  highlight(markerId: string | null): void;

  /** Move the camera now, with no animation. The walking camera calls this every frame. */
  setCamera(pose: CameraPose): void;
  /** Animate the camera to `pose`. Resolves when it arrives, rejects if cancelled. */
  flyTo(pose: CameraPose, durationSeconds: number): Promise<void>;

  /**
   * Height of the ground (top of the 3D tiles) at each position, in metres above the
   * ellipsoid, in the same order. An entry is `undefined` where the tiles are not
   * loaded or cannot be sampled. May take a while, since it loads the detailed tiles.
   */
  groundHeights(positions: readonly LatLng[]): Promise<(number | undefined)[]>;

  /** Let the user drag and zoom the camera, or not (the walking camera owns it). */
  setCameraInput(enabled: boolean): void;

  /** Current status, then every change. Returns an unsubscribe function. */
  onStatus(listener: (status: MapStatus) => void): () => void;
}
