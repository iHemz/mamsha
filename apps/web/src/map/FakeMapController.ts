import type { CameraPose, LatLng, MapController, MapMarker, MapStatus } from "./MapController";

export type FakeMapCall =
  | { method: "mount" }
  | { method: "destroy" }
  | { method: "showRoute"; path: LatLng[] }
  | { method: "hideRoute" }
  | { method: "setMarkers"; markers: MapMarker[] }
  | { method: "highlight"; markerId: string | null }
  | { method: "setCamera"; pose: CameraPose }
  | { method: "flyTo"; pose: CameraPose; durationSeconds: number };

/**
 * In-memory MapController for tests. Records every call, keeps the visible state,
 * and lets the test choose the ground height and the status.
 */
export class FakeMapController implements MapController {
  readonly calls: FakeMapCall[] = [];
  route: LatLng[] | null = null;
  markers: MapMarker[] = [];
  highlighted: string | null = null;
  camera: CameraPose | null = null;
  mounted = false;

  /** Ground height returned by `groundHeight`. Set to `undefined` to simulate unloaded tiles. */
  ground: number | undefined = 0;

  private status: MapStatus = { state: "loading" };
  private readonly listeners = new Set<(status: MapStatus) => void>();

  mount(_container: HTMLElement): Promise<void> {
    this.calls.push({ method: "mount" });
    this.mounted = true;
    return Promise.resolve();
  }

  destroy(): void {
    this.calls.push({ method: "destroy" });
    this.mounted = false;
    this.listeners.clear();
  }

  showRoute(path: readonly LatLng[]): void {
    this.calls.push({ method: "showRoute", path: [...path] });
    this.route = [...path];
  }

  hideRoute(): void {
    this.calls.push({ method: "hideRoute" });
    this.route = null;
  }

  setMarkers(markers: readonly MapMarker[]): void {
    this.calls.push({ method: "setMarkers", markers: [...markers] });
    this.markers = [...markers];
  }

  highlight(markerId: string | null): void {
    this.calls.push({ method: "highlight", markerId });
    this.highlighted = markerId;
  }

  setCamera(pose: CameraPose): void {
    this.calls.push({ method: "setCamera", pose });
    this.camera = pose;
  }

  flyTo(pose: CameraPose, durationSeconds: number): Promise<void> {
    this.calls.push({ method: "flyTo", pose, durationSeconds });
    this.camera = pose;
    return Promise.resolve();
  }

  groundHeight(_position: LatLng): Promise<number | undefined> {
    return Promise.resolve(this.ground);
  }

  onStatus(listener: (status: MapStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** Test helper: change the status and notify listeners. */
  setStatus(status: MapStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  /** Test helper: the calls to one method, in order. */
  callsTo<M extends FakeMapCall["method"]>(method: M): Extract<FakeMapCall, { method: M }>[] {
    return this.calls.filter((c): c is Extract<FakeMapCall, { method: M }> => c.method === method);
  }
}
