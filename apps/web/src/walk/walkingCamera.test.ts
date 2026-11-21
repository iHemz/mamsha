import type { RouteData } from "@mamsha/shared";

import { distance, EYE_HEIGHT_M, headingDelta, offset } from "../map/cameraMath";

/** The default height above the ground while walking between stops. */
const WALK_ALT = 20;
import { FakeMapController } from "../map/FakeMapController";
import type { LatLng } from "../map/MapController";
import { ManualClock } from "../test/manualClock";
import { stopDistances, WalkingCamera, type WalkingCameraOptions } from "./walkingCamera";

const ORIGIN: LatLng = { lat: 21.42, lng: 39.82 };
const CORNER = offset(ORIGIN, 0, 100);
const END = offset(CORNER, 90, 100);

/** 100 m north, then 100 m east, with one stop on each leg. */
const route: RouteData = {
  hotel: { id: "hotel", name: "Hotel", position: ORIGIN, facts: [] },
  gate: { id: "gate", name: "Gate", position: END, facts: [] },
  path: [ORIGIN, CORNER, END],
  stops: [
    // Listed out of order on purpose: the walk uses the order along the path.
    { id: "east", title: "East", position: offset(CORNER, 90, 50), heading: 180, facts: [] },
    { id: "north", title: "North", position: offset(ORIGIN, 0, 40), heading: 270, facts: [] },
  ],
};

function setup(options: WalkingCameraOptions = {}) {
  const map = new FakeMapController();
  map.ground = 300;
  const clock = new ManualClock();
  const arrived: string[] = [];
  const walk = new WalkingCamera(map, route, {
    clock,
    pace: 10,
    dwellSeconds: 1,
    overviewSeconds: 0.5,
    onArrive: (id) => arrived.push(id),
    ...options,
  });
  return { map, clock, walk, arrived };
}

/** Start and get through the overview and descent. */
async function startWalking(ctx: ReturnType<typeof setup>) {
  ctx.walk.start();
  await ctx.clock.advance(600);
  expect(ctx.walk.getProgress().phase).toBe("walking");
}

describe("WalkingCamera", () => {
  it("places stops in walking order", () => {
    const [north, east] = stopDistances(route);
    expect(north).toBeCloseTo(40, 0);
    expect(east).toBeCloseTo(150, 0);
  });

  it("starts idle with the route summary", () => {
    const { walk, map } = setup();
    expect(walk.getProgress()).toEqual({
      phase: "idle",
      stopIndex: 0,
      stopCount: 2,
      remaining: 200,
      length: 200,
      speed: 1,
    });
    expect(map.calls).toEqual([]);
  });

  it("flies to an aerial overview, then down to the hotel door", async () => {
    const ctx = setup();
    ctx.walk.start();
    expect(ctx.walk.getProgress().phase).toBe("overview");
    expect(ctx.map.cameraInput).toBe(false);
    await ctx.clock.advance(600);

    const [overview, door] = ctx.map.callsTo("flyTo");
    expect(overview?.pose.height).toBeGreaterThan(300 + 100);
    expect(overview?.pose.pitch).toBeLessThan(-20);
    expect(door?.pose.height).toBeCloseTo(300 + WALK_ALT, 1);
    expect(door?.pose.position.lat).toBeCloseTo(ORIGIN.lat, 6);
    expect(Math.abs(headingDelta(door?.pose.heading ?? NaN, 0))).toBeLessThan(1);
    expect(ctx.walk.getProgress().phase).toBe("walking");
  });

  it("samples the ground along the whole path before walking", async () => {
    const ctx = setup();
    await startWalking(ctx);
    const sampled = ctx.map.callsTo("groundHeights").flatMap((c) => c.positions);
    // At most 10 m apart, from the hotel door to the gate.
    for (let i = 1; i < sampled.length; i++) {
      expect(distance(sampled[i - 1] ?? ORIGIN, sampled[i] ?? ORIGIN)).toBeLessThanOrEqual(10);
    }
    expect(sampled[0]).toEqual(ORIGIN);
    expect(distance(sampled.at(-1) ?? ORIGIN, END)).toBeLessThan(0.01);
  });

  it("walks at pace and speed, just above the sampled ground", async () => {
    const ctx = setup();
    ctx.map.ground = (p) => 300 + (p.lat - ORIGIN.lat) * 1000;
    await startWalking(ctx);
    await ctx.clock.advance(2000);
    const pose = ctx.map.camera;
    // 10 m/s for about 2 s, along the first leg.
    const walked = distance(ORIGIN, pose?.position ?? ORIGIN);
    expect(walked).toBeGreaterThan(18);
    expect(walked).toBeLessThan(22);
    const expectedGround = 300 + ((pose?.position.lat ?? 0) - ORIGIN.lat) * 1000;
    expect(pose?.height).toBeCloseTo(expectedGround + WALK_ALT, 1);
    expect(pose?.pitch).toBeLessThan(0);

    ctx.walk.setSpeed(2);
    expect(ctx.walk.getProgress().speed).toBe(2);
    const before = distance(ORIGIN, ctx.map.camera?.position ?? ORIGIN);
    await ctx.clock.advance(500);
    const after = distance(ORIGIN, ctx.map.camera?.position ?? ORIGIN);
    expect(after - before).toBeCloseTo(10, 0);
  });

  it("stops at each stop, turns to its view, then walks on", async () => {
    const ctx = setup();
    await startWalking(ctx);
    await ctx.clock.advance(4000);
    expect(ctx.arrived).toEqual(["north"]);
    expect(ctx.walk.getProgress()).toMatchObject({
      phase: "at_stop",
      stopIndex: 0,
      remaining: 160,
    });
    expect(
      distance(ctx.map.camera?.position ?? ORIGIN, route.stops[1]?.position ?? END),
    ).toBeLessThan(1);

    await ctx.clock.advance(900);
    // Easing towards the stop's heading of 270 from the walking heading of 0.
    expect(Math.abs(headingDelta(ctx.map.camera?.heading ?? 0, 270))).toBeLessThan(45);

    await ctx.clock.advance(500);
    expect(ctx.walk.getProgress()).toMatchObject({ phase: "walking", stopIndex: 1 });
  });

  it("turns the corner gradually instead of snapping", async () => {
    const ctx = setup();
    await startWalking(ctx);
    const headings: number[] = [];
    for (let i = 0; i < 300; i++) {
      await ctx.clock.advance(50);
      if (ctx.map.camera) headings.push(ctx.map.camera.heading);
    }
    const biggestTurn = Math.max(
      ...headings.slice(1).map((h, i) => Math.abs(headingDelta(headings[i] ?? h, h))),
    );
    expect(biggestTurn).toBeLessThan(10);
  });

  it("arrives at the gate, finishes and hands the camera back", async () => {
    const ctx = setup({ dwellSeconds: 0 });
    await startWalking(ctx);
    await ctx.clock.advance(25_000);
    expect(ctx.arrived).toEqual(["north", "east"]);
    expect(ctx.walk.getProgress()).toMatchObject({ phase: "done", stopIndex: 2, remaining: 0 });
    expect(ctx.map.cameraInput).toBe(true);
    expect(distance(ctx.map.camera?.position ?? ORIGIN, END)).toBeLessThan(0.5);
    expect(ctx.clock.waiting).toBe(0);
  });

  it("pauses, lets the user look around, and glides back on resume", async () => {
    const ctx = setup();
    await startWalking(ctx);
    await ctx.clock.advance(1000);
    ctx.walk.pause();
    expect(ctx.walk.getProgress().phase).toBe("paused");
    expect(ctx.map.cameraInput).toBe(true);
    const where = ctx.map.camera;
    await ctx.clock.advance(3000);
    expect(ctx.map.camera).toEqual(where);

    ctx.walk.resume();
    await ctx.clock.advance(100);
    expect(ctx.map.cameraInput).toBe(false);
    expect(ctx.map.callsTo("flyTo").at(-1)?.durationSeconds).toBe(1.5);
    expect(ctx.walk.getProgress().phase).toBe("walking");
  });

  it("can leave a stop early, and wait at stops when asked to", async () => {
    const ctx = setup({ dwellSeconds: Number.POSITIVE_INFINITY });
    await startWalking(ctx);
    await ctx.clock.advance(10_000);
    expect(ctx.walk.getProgress().phase).toBe("at_stop");
    ctx.walk.resume();
    await ctx.clock.advance(100);
    expect(ctx.walk.getProgress()).toMatchObject({ phase: "walking", stopIndex: 1 });
  });

  it("jumps to the next stop, then to the gate", async () => {
    const ctx = setup();
    await startWalking(ctx);
    ctx.walk.nextStop();
    await ctx.clock.advance(100);
    expect(ctx.arrived).toEqual(["north"]);
    ctx.walk.nextStop();
    await ctx.clock.advance(100);
    expect(ctx.arrived).toEqual(["north", "east"]);
    expect(ctx.walk.getProgress()).toMatchObject({ phase: "at_stop", stopIndex: 1, remaining: 50 });
    ctx.walk.nextStop();
    await ctx.clock.advance(100);
    expect(ctx.walk.getProgress().phase).toBe("done");
  });

  it("skips the overview when next stop is pressed during it", async () => {
    const ctx = setup();
    ctx.walk.start();
    ctx.walk.nextStop();
    await ctx.clock.advance(100);
    expect(ctx.arrived).toEqual(["north"]);
    expect(ctx.walk.getProgress().phase).toBe("at_stop");
  });

  it("cuts instead of flying and changes height without easing with reduced motion", async () => {
    const ctx = setup({ reducedMotion: true });
    await startWalking(ctx);
    expect(ctx.map.callsTo("flyTo")).toEqual([]);
    expect(ctx.map.camera?.height).toBeCloseTo(300 + WALK_ALT, 6);
    await ctx.clock.advance(4000);
    expect(ctx.walk.getProgress().phase).toBe("at_stop");
    expect(ctx.map.camera?.height).toBeCloseTo(300 + EYE_HEIGHT_M, 6);
  });

  it("eases down to eye height at a stop and back up when walking on", async () => {
    const ctx = setup({ dwellSeconds: 4 });
    await startWalking(ctx);
    await ctx.clock.advance(4000);
    expect(ctx.walk.getProgress().phase).toBe("at_stop");
    const arriving = ctx.map.camera?.height ?? 0;
    expect(arriving).toBeGreaterThan(300 + EYE_HEIGHT_M);
    expect(arriving).toBeLessThan(300 + WALK_ALT);
    await ctx.clock.advance(3500);
    expect(ctx.map.camera?.height).toBeCloseTo(300 + EYE_HEIGHT_M, 0);
    expect(ctx.map.camera?.pitch).toBeCloseTo(-3, 0);
    await ctx.clock.advance(4000);
    expect(ctx.walk.getProgress().phase).toBe("walking");
    expect(ctx.map.camera?.height).toBeCloseTo(300 + WALK_ALT, 0);
  });

  it("lands at eye height when jumping to a stop", async () => {
    const ctx = setup();
    await startWalking(ctx);
    ctx.walk.nextStop();
    await ctx.clock.advance(100);
    expect(ctx.map.callsTo("flyTo").at(-1)?.pose.height).toBeCloseTo(300 + EYE_HEIGHT_M, 6);
  });

  it("walks on the fallback ground when the tiles cannot be sampled", async () => {
    const ctx = setup({ fallbackGround: 250 });
    ctx.map.ground = undefined;
    await startWalking(ctx);
    expect(ctx.map.camera?.height).toBeCloseTo(250 + WALK_ALT, 1);
  });

  it("gives up on samples that never arrive", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const ctx = setup({ sampleTimeoutMs: 1000, fallbackGround: 250 });
      ctx.map.groundHeights = () => new Promise(() => undefined);
      ctx.walk.start();
      await ctx.clock.advance(600);
      expect(ctx.walk.getProgress().phase).toBe("overview");
      await vi.advanceTimersByTimeAsync(1000);
      await ctx.clock.advance(100);
      expect(ctx.walk.getProgress().phase).toBe("walking");
      expect(ctx.map.camera?.height).toBeCloseTo(250 + WALK_ALT, 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries on with a cut if a flight is interrupted from outside", async () => {
    const ctx = setup();
    ctx.map.flyTo = () => Promise.reject(new Error("Camera flight cancelled"));
    await startWalking(ctx);
    expect(ctx.map.camera?.height).toBeCloseTo(300 + WALK_ALT, 1);
  });

  it("notifies subscribers only when the visible progress changes", async () => {
    const ctx = setup();
    const seen = vi.fn();
    ctx.walk.subscribe(seen);
    await startWalking(ctx);
    const before = seen.mock.calls.length;
    await ctx.clock.advance(500, 10);
    // 5 m walked: about one 10 m step of "remaining", not one call per frame.
    expect(seen.mock.calls.length - before).toBeLessThanOrEqual(2);
  });

  it("ignores controls that make no sense in the current phase", () => {
    const { walk, map } = setup();
    walk.pause();
    walk.resume();
    walk.nextStop();
    expect(walk.getProgress().phase).toBe("idle");
    expect(map.calls).toEqual([]);
  });

  it("can walk again after finishing, and stops cleanly when disposed", async () => {
    const ctx = setup({ dwellSeconds: 0 });
    await startWalking(ctx);
    await ctx.clock.advance(25_000);
    expect(ctx.walk.getProgress().phase).toBe("done");
    ctx.walk.start();
    expect(ctx.walk.getProgress()).toMatchObject({ phase: "overview", remaining: 200 });
    ctx.walk.dispose();
    expect(ctx.clock.waiting).toBe(0);
    expect(ctx.map.cameraInput).toBe(true);
  });
});
