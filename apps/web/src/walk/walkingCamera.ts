/**
 * The walking camera: an aerial overview, a descent to the hotel door, then a walk
 * along the whole route path at walking pace, just above the crowd, easing down to
 * eye height at each stop.
 *
 * It only decides where the camera goes and hands each pose to `MapController`, so it
 * runs the same against Cesium and against `FakeMapController`. Time comes from a
 * `FrameClock`, which tests drive by hand.
 */
import type { RouteData } from "@mamsha/shared";

import {
  buildGroundProfile,
  distanceAlong,
  EYE_HEIGHT_M,
  type GroundProfile,
  groundAt,
  headingAt,
  type MeasuredPath,
  measurePath,
  overviewPose,
  pointAt,
  sampleDistances,
  smoothHeading,
} from "../map/cameraMath";
import type { CameraPose, MapController } from "../map/MapController";

export type WalkPhase = "idle" | "overview" | "walking" | "at_stop" | "paused" | "done";

export const WALK_SPEEDS = [0.5, 1, 2, 4] as const;
export type WalkSpeed = (typeof WALK_SPEEDS)[number];

/** What the UI shows. Changes only when something visible changes, not every frame. */
export interface WalkProgress {
  phase: WalkPhase;
  /**
   * The stop the walker is at (`at_stop`) or walking towards, 0-based. Equal to
   * `stopCount` once every stop is behind and only the gate is left.
   */
  stopIndex: number;
  stopCount: number;
  /** Metres left to the gate, rounded to 10 m. */
  remaining: number;
  /** Whole route length in metres, rounded to 10 m. */
  length: number;
  speed: WalkSpeed;
}

/** Source of animation frames. The browser one wraps `requestAnimationFrame`. */
export interface FrameClock {
  /** Call `callback` on the next frame with a timestamp in milliseconds. */
  request(callback: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

export const browserFrameClock: FrameClock = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => {
    cancelAnimationFrame(handle);
  },
};

export interface WalkingCameraOptions {
  clock?: FrameClock | undefined;
  /** Camera flights and height changes become cuts. */
  reducedMotion?: boolean | undefined;
  /** Metres per second at speed 1. */
  pace?: number | undefined;
  /** Seconds to stay at a stop before walking on. `Infinity` waits for `resume()`. */
  dwellSeconds?: number | undefined;
  /** Seconds to hold the aerial overview before descending. */
  overviewSeconds?: number | undefined;
  /** Give up on ground samples after this long and use what arrived. */
  sampleTimeoutMs?: number | undefined;
  /** Ground height used until (or if never) the tiles are sampled. */
  fallbackGround?: number | undefined;
  /**
   * Metres above the ground while walking between stops. Google's 3D tiles are made
   * from aerial photos and smear at true eye height, so the walk moves just above the
   * crowd and only drops to eye height at the stops.
   */
  walkAltitude?: number | undefined;
  /** Called once when the walker reaches each stop. */
  onArrive?: ((stopId: string) => void) | undefined;
}

/** Ground level near the Haram above the WGS84 ellipsoid, roughly. Only a fallback. */
const DEFAULT_GROUND_M = 280;
/** Ground samples per request, so a slow area doesn't hold up the rest. */
const SAMPLE_CHUNK = 12;
const DEFAULT_WALK_ALTITUDE_M = 20;
/** Looking ahead along the path and a little down onto it. */
const WALK_PITCH = -15;
/** Standing at a stop: eyes level, slightly down. */
const STOP_PITCH = -3;
/** Seconds for the height and pitch change on arriving at or leaving a stop. */
const DESCENT_TAU_S = 0.8;
/** Longest frame step, so a background tab doesn't teleport the walker on return. */
const MAX_FRAME_S = 0.1;

interface WalkStop {
  id: string;
  along: number;
  heading: number;
}

class Cancelled extends Error {}

/** Phases in which frames must keep running. */
function isActive(phase: WalkPhase): boolean {
  return phase === "overview" || phase === "walking" || phase === "at_stop";
}

export class WalkingCamera {
  private readonly path: MeasuredPath;
  private readonly stops: WalkStop[];
  private readonly clock: FrameClock;
  private readonly reducedMotion: boolean;
  private readonly pace: number;
  private readonly dwellSeconds: number;
  private readonly overviewSeconds: number;
  private readonly sampleTimeoutMs: number;
  private readonly fallbackGround: number;
  private readonly onArrive: ((stopId: string) => void) | undefined;

  private phase: WalkPhase = "idle";
  /** Phase to return to on resume. */
  private pausedFrom: WalkPhase = "walking";
  private walked = 0;
  private stopIndex = 0;
  private dwellLeft = 0;
  private heading = 0;
  private readonly walkAltitude: number;
  /** Current height above the ground and pitch, eased between walking and stops. */
  private altitude: number;
  private pitch = WALK_PITCH;
  private speed: WalkSpeed = 1;
  private profile: GroundProfile | null = null;
  private profileReady: Promise<GroundProfile> | null = null;
  /** Bumped whenever a running sequence (flight, wait) must stop. */
  private run = 0;
  /** A sequence (overview, glide, jump to a stop) owns the camera; the walk holds still. */
  private moving = false;
  private frame: number | null = null;
  private lastFrameMs: number | null = null;
  private waiters: { untilMs: number; resolve: () => void }[] = [];
  private nowMs = 0;

  private snapshot: WalkProgress;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly map: MapController,
    route: RouteData,
    options: WalkingCameraOptions = {},
  ) {
    this.path = measurePath(route.path);
    this.stops = route.stops
      .map((s) => ({ id: s.id, along: distanceAlong(this.path, s.position), heading: s.heading }))
      .sort((a, b) => a.along - b.along);
    this.clock = options.clock ?? browserFrameClock;
    this.reducedMotion = options.reducedMotion ?? false;
    this.pace = options.pace ?? 1.3;
    this.dwellSeconds = options.dwellSeconds ?? 6;
    this.overviewSeconds = options.overviewSeconds ?? 2.5;
    this.sampleTimeoutMs = options.sampleTimeoutMs ?? 15_000;
    this.fallbackGround = options.fallbackGround ?? DEFAULT_GROUND_M;
    this.onArrive = options.onArrive;
    this.walkAltitude = options.walkAltitude ?? DEFAULT_WALK_ALTITUDE_M;
    this.altitude = this.walkAltitude;
    this.heading = headingAt(this.path, 0);
    this.snapshot = this.computeProgress();
  }

  // ----- Public API -----

  /** The latest progress. Stable between changes, for `useSyncExternalStore`. */
  getProgress = (): WalkProgress => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Start from the hotel with the overview shot. Restarts a finished walk. */
  start(): void {
    if (this.phase !== "idle" && this.phase !== "done") return;
    const run = this.restart();
    this.walked = 0;
    this.stopIndex = 0;
    this.heading = headingAt(this.path, 0);
    this.altitude = this.walkAltitude;
    this.pitch = WALK_PITCH;
    this.map.setCameraInput(false);
    this.setPhase("overview");
    void this.guard(run, async () => {
      const profileReady = this.loadProfile();
      const overview = overviewPose(
        this.path,
        this.profile ? groundAt(this.profile, 0) : this.fallbackGround,
      );
      await this.moveTo(run, overview, 4);
      await this.wait(run, this.overviewSeconds);
      await profileReady;
      this.check(run);
      await this.moveTo(run, this.walkerPose(), 5);
      this.setPhase("walking");
    });
  }

  /** Stop where you are. The user can look around while paused. */
  pause(): void {
    if (this.phase !== "walking" && this.phase !== "at_stop" && this.phase !== "overview") return;
    this.pausedFrom = this.phase === "at_stop" ? "at_stop" : "walking";
    this.restart();
    this.setPhase("paused");
    this.map.setCameraInput(true);
  }

  /** Carry on from where the walk was paused, or leave a stop early. */
  resume(): void {
    if (this.phase === "at_stop") {
      this.leaveStop();
      return;
    }
    if (this.phase !== "paused") return;
    const run = this.restart();
    this.map.setCameraInput(false);
    void this.guard(run, async () => {
      await this.loadProfile();
      this.check(run);
      // The user may have moved the camera while paused: glide back first.
      await this.moveTo(run, this.walkerPose(), 1.5);
      this.setPhase(this.pausedFrom);
    });
  }

  /** Go straight to the next stop (or the gate, after the last one). */
  nextStop(): void {
    if (this.phase === "idle" || this.phase === "done") return;
    const target = this.phase === "at_stop" ? this.stopIndex + 1 : this.stopIndex;
    const run = this.restart();
    this.map.setCameraInput(false);
    if (this.phase === "paused" || this.phase === "overview") this.setPhase("walking");
    void this.guard(run, async () => {
      await this.loadProfile();
      this.check(run);
      const stop = this.stops[target];
      this.walked = stop ? stop.along : this.path.length;
      this.stopIndex = target;
      if (stop) {
        this.heading = stop.heading;
        this.altitude = EYE_HEIGHT_M;
        this.pitch = STOP_PITCH;
      }
      await this.moveTo(run, this.walkerPose(), 2.5);
      if (stop) this.arrive();
      else this.finish();
    });
  }

  setSpeed(speed: WalkSpeed): void {
    this.speed = speed;
    this.emit();
  }

  /**
   * Stop everything and hand the camera back to the user. Subscribers keep their own
   * unsubscribe, so React can dispose and re-subscribe in any order.
   */
  dispose(): void {
    this.restart();
    this.stopFrames();
    this.map.setCameraInput(true);
  }

  // ----- Sequencing -----

  /** Cancel whatever is running and return the new run id. */
  private restart(): number {
    this.run += 1;
    this.moving = false;
    for (const w of this.waiters) w.resolve();
    this.waiters = [];
    return this.run;
  }

  private check(run: number): void {
    if (run !== this.run) throw new Cancelled();
  }

  /** Run a sequence, ignoring the cancellation of a superseded one. */
  private async guard(run: number, sequence: () => Promise<void>): Promise<void> {
    this.moving = true;
    try {
      await sequence();
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    } finally {
      if (run === this.run) this.moving = false;
    }
  }

  private async moveTo(run: number, pose: CameraPose, seconds: number): Promise<void> {
    this.check(run);
    if (this.reducedMotion) {
      this.map.setCamera(pose);
      return;
    }
    try {
      await this.map.flyTo(pose, seconds);
    } catch {
      // Cut short by a newer sequence (then `check` stops us), or by something else:
      // finish with a cut so the walk carries on.
      this.check(run);
      this.map.setCamera(pose);
    }
    this.check(run);
  }

  /** Resolve after `seconds` of frame time. */
  private wait(run: number, seconds: number): Promise<void> {
    this.check(run);
    return new Promise<void>((resolve) => {
      this.waiters.push({ untilMs: this.nowMs + seconds * 1000, resolve });
    }).then(() => {
      this.check(run);
    });
  }

  // ----- Ground -----

  private loadProfile(): Promise<GroundProfile> {
    this.profileReady ??= this.sampleGround().then((profile) => {
      this.profile = profile;
      return profile;
    });
    return this.profileReady;
  }

  private async sampleGround(): Promise<GroundProfile> {
    const distances = sampleDistances(this.path.length, 10);
    const positions = distances.map((d) => pointAt(this.path, d));
    const chunks: Promise<(number | undefined)[]>[] = [];
    for (let i = 0; i < positions.length; i += SAMPLE_CHUNK) {
      const chunk = positions.slice(i, i + SAMPLE_CHUNK);
      chunks.push(this.withTimeout(this.map.groundHeights(chunk), chunk.length));
    }
    const samples = (await Promise.all(chunks)).flat();
    return buildGroundProfile(distances, samples, this.fallbackGround);
  }

  /** The samples, or all `undefined` if they fail or take too long. */
  private withTimeout(
    request: Promise<(number | undefined)[]>,
    count: number,
  ): Promise<(number | undefined)[]> {
    const missing = () => Array.from({ length: count }, () => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<(number | undefined)[]>((resolve) => {
      timer = setTimeout(() => {
        resolve(missing());
      }, this.sampleTimeoutMs);
    });
    return Promise.race([request.catch(missing), timeout]).finally(() => {
      clearTimeout(timer);
    });
  }

  private groundHere(): number {
    return this.profile ? groundAt(this.profile, this.walked) : this.fallbackGround;
  }

  // ----- Frames -----

  private ensureFrames(): void {
    if (this.frame !== null) return;
    this.lastFrameMs = null;
    this.frame = this.clock.request(this.tick);
  }

  private stopFrames(): void {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
    this.lastFrameMs = null;
  }

  private readonly tick = (nowMs: number): void => {
    this.frame = null;
    const dt =
      this.lastFrameMs === null ? 0 : Math.min(MAX_FRAME_S, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;
    // Frame time, not wall time, so waits stretch with a throttled tab like the walk does.
    this.nowMs += dt * 1000;
    this.releaseWaiters();

    if (this.phase === "walking" || this.phase === "at_stop") this.step(dt);

    if (isActive(this.phase) || this.waiters.length > 0) this.frame = this.clock.request(this.tick);
    else this.lastFrameMs = null;
  };

  private releaseWaiters(): void {
    const due = this.waiters.filter((w) => w.untilMs <= this.nowMs);
    if (due.length === 0) return;
    this.waiters = this.waiters.filter((w) => w.untilMs > this.nowMs);
    for (const w of due) w.resolve();
  }

  /** Advance the walk by `dt` seconds and place the camera. Skipped during flights. */
  private step(dt: number): void {
    if (this.moving) return;

    if (this.phase === "walking") {
      this.walked = Math.min(this.path.length, this.walked + this.pace * this.speed * dt);
      this.heading = smoothHeading(this.heading, headingAt(this.path, this.walked), dt);
      const stop = this.stops[this.stopIndex];
      if (stop && this.walked >= stop.along) {
        this.walked = stop.along;
        this.arrive();
      } else if (!stop && this.walked >= this.path.length) {
        this.map.setCamera(this.walkerPose());
        this.finish();
        return;
      }
    } else {
      const stop = this.stops[this.stopIndex];
      if (stop) this.heading = smoothHeading(this.heading, stop.heading, dt, 0.8);
      this.dwellLeft -= dt;
      if (this.dwellLeft <= 0) this.leaveStop();
    }

    this.easeHeight(dt);
    this.map.setCamera(this.walkerPose());
    this.emit();
  }

  /** Ease down to eye height at a stop and back up when walking on. */
  private easeHeight(dt: number): void {
    const atStop = this.phase === "at_stop";
    const altitude = atStop ? EYE_HEIGHT_M : this.walkAltitude;
    const pitch = atStop ? STOP_PITCH : WALK_PITCH;
    const t = this.reducedMotion ? 1 : 1 - Math.exp(-dt / DESCENT_TAU_S);
    this.altitude += (altitude - this.altitude) * t;
    this.pitch += (pitch - this.pitch) * t;
  }

  private walkerPose(): CameraPose {
    return {
      position: pointAt(this.path, this.walked),
      height: this.groundHere() + this.altitude,
      heading: this.heading,
      pitch: this.pitch,
    };
  }

  private arrive(): void {
    const stop = this.stops[this.stopIndex];
    if (!stop) return;
    this.dwellLeft = this.dwellSeconds;
    this.setPhase("at_stop");
    this.onArrive?.(stop.id);
  }

  private leaveStop(): void {
    this.stopIndex += 1;
    this.setPhase("walking");
  }

  private finish(): void {
    this.walked = this.path.length;
    this.stopIndex = this.stops.length;
    this.setPhase("done");
    this.map.setCameraInput(true);
  }

  // ----- Progress -----

  private setPhase(phase: WalkPhase): void {
    this.phase = phase;
    if (isActive(phase)) this.ensureFrames();
    this.emit();
  }

  private computeProgress(): WalkProgress {
    const round = (m: number) => Math.round(m / 10) * 10;
    return {
      phase: this.phase,
      stopIndex: Math.min(this.stopIndex, this.stops.length),
      stopCount: this.stops.length,
      remaining: round(this.path.length - this.walked),
      length: round(this.path.length),
      speed: this.speed,
    };
  }

  private emit(): void {
    const next = this.computeProgress();
    const prev = this.snapshot;
    const same = (Object.keys(next) as (keyof WalkProgress)[]).every((k) => next[k] === prev[k]);
    if (same) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

/** Distance along the path of each stop, in walking order. */
export function stopDistances(route: RouteData): number[] {
  const path = measurePath(route.path);
  return route.stops.map((s) => distanceAlong(path, s.position)).sort((a, b) => a - b);
}
