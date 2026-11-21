import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  ClassificationType,
  Color,
  ConstantProperty,
  createGooglePhotorealistic3DTileset,
  type Entity,
  HeightReference,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  VerticalOrigin,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import type {
  CameraPose,
  LatLng,
  MapController,
  MapMarker,
  MapStatus,
  MarkerKind,
} from "./MapController";

const MARKER_COLOURS: Record<MarkerKind, Color> = {
  hotel: Color.fromCssColorString("#f2c14e"),
  stop: Color.fromCssColorString("#ffffff"),
  gate: Color.fromCssColorString("#5cc8a8"),
};
const HIGHLIGHT_COLOUR = Color.fromCssColorString("#ff8a3d");
const ROUTE_COLOUR = Color.fromCssColorString("#f2c14e").withAlpha(0.9);

function toCartesian(pose: CameraPose): Cartesian3 {
  return Cartesian3.fromDegrees(pose.position.lng, pose.position.lat, pose.height);
}

function toOrientation(pose: CameraPose) {
  return {
    heading: CesiumMath.toRadians(pose.heading),
    pitch: CesiumMath.toRadians(pose.pitch),
    roll: 0,
  };
}

/**
 * Renders Google Photorealistic 3D Tiles streamed from Cesium ion.
 *
 * The ion token is restricted to that one asset, so every Viewer default that would
 * call another ion asset or service (globe imagery, terrain, geocoder, base layer
 * picker) is switched off. No Google key is ever passed: without one, Cesium loads
 * the tiles through ion. Credits, including Google's logo, stay in the credit bar.
 */
export class CesiumMapController implements MapController {
  private viewer: Viewer | null = null;
  private routeEntity: Entity | null = null;
  private readonly markerEntities = new Map<string, { entity: Entity; kind: MarkerKind }>();
  private status: MapStatus = { state: "loading" };
  private readonly listeners = new Set<(status: MapStatus) => void>();

  constructor(private readonly ionToken: string) {}

  async mount(container: HTMLElement): Promise<void> {
    Ion.defaultAccessToken = this.ionToken;

    const viewer = new Viewer(container, {
      globe: false,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      timeline: false,
      animation: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    });
    this.viewer = viewer;
    // Sky and atmosphere stay on. There is no ellipsoid because there is no globe.
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;

    try {
      const tileset = await createGooglePhotorealistic3DTileset({
        // We use no geocoder at all, which satisfies Google's "Google geocoder only" rule.
        onlyUsingWithGoogleGeocoder: true,
      });
      if (viewer.isDestroyed()) return;
      viewer.scene.primitives.add(tileset);
      tileset.initialTilesLoaded.addEventListener(() => {
        this.setStatus({ state: "ready" });
      });
    } catch (error) {
      this.setStatus({
        state: "error",
        message: `The 3D city could not be loaded (${describe(error)}). Check the Cesium ion token.`,
      });
    }
  }

  destroy(): void {
    if (this.viewer && !this.viewer.isDestroyed()) this.viewer.destroy();
    this.viewer = null;
    this.routeEntity = null;
    this.markerEntities.clear();
    this.listeners.clear();
  }

  showRoute(path: readonly LatLng[]): void {
    const viewer = this.requireViewer();
    this.hideRoute();
    this.routeEntity = viewer.entities.add({
      polyline: {
        positions: path.map((p) => Cartesian3.fromDegrees(p.lng, p.lat)),
        width: 6,
        material: ROUTE_COLOUR,
        clampToGround: true,
        // There is no globe, so drape the line on the 3D tiles.
        classificationType: ClassificationType.CESIUM_3D_TILE,
      },
    });
  }

  hideRoute(): void {
    if (this.routeEntity && this.viewer) this.viewer.entities.remove(this.routeEntity);
    this.routeEntity = null;
  }

  setMarkers(markers: readonly MapMarker[]): void {
    const viewer = this.requireViewer();
    for (const { entity } of this.markerEntities.values()) viewer.entities.remove(entity);
    this.markerEntities.clear();

    for (const marker of markers) {
      const entity = viewer.entities.add({
        id: `marker-${marker.id}`,
        position: Cartesian3.fromDegrees(marker.position.lng, marker.position.lat),
        point: {
          pixelSize: 12,
          color: MARKER_COLOURS[marker.kind],
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: marker.label,
          font: "600 14px system-ui, sans-serif",
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 3,
          outlineColor: Color.BLACK,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -14),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.markerEntities.set(marker.id, { entity, kind: marker.kind });
    }
  }

  highlight(markerId: string | null): void {
    for (const [id, { entity, kind }] of this.markerEntities) {
      if (!entity.point) continue;
      const on = id === markerId;
      entity.point.pixelSize = new ConstantProperty(on ? 20 : 12);
      entity.point.color = new ConstantProperty(on ? HIGHLIGHT_COLOUR : MARKER_COLOURS[kind]);
    }
  }

  setCamera(pose: CameraPose): void {
    const viewer = this.requireViewer();
    viewer.camera.cancelFlight();
    viewer.camera.setView({ destination: toCartesian(pose), orientation: toOrientation(pose) });
  }

  flyTo(pose: CameraPose, durationSeconds: number): Promise<void> {
    const viewer = this.requireViewer();
    return new Promise((resolve, reject) => {
      viewer.camera.flyTo({
        destination: toCartesian(pose),
        orientation: toOrientation(pose),
        duration: durationSeconds,
        complete: resolve,
        cancel: () => {
          reject(new Error("Camera flight cancelled"));
        },
      });
    });
  }

  async groundHeights(positions: readonly LatLng[]): Promise<(number | undefined)[]> {
    const viewer = this.viewer;
    if (!viewer || viewer.isDestroyed() || !viewer.scene.sampleHeightSupported) {
      return positions.map(() => undefined);
    }
    const samples = await viewer.scene.sampleHeightMostDetailed(
      positions.map((p) => Cartographic.fromDegrees(p.lng, p.lat)),
    );
    // Cesium leaves `height` undefined where nothing was hit, despite its type.
    return samples.map((s) => (s && Number.isFinite(s.height) ? s.height : undefined));
  }

  setCameraInput(enabled: boolean): void {
    const viewer = this.viewer;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.screenSpaceCameraController.enableInputs = enabled;
  }

  onStatus(listener: (status: MapStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: MapStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private requireViewer(): Viewer {
    if (!this.viewer || this.viewer.isDestroyed()) {
      throw new Error("CesiumMapController used before mount() or after destroy()");
    }
    return this.viewer;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
