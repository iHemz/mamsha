import {
  at,
  buildGroundProfile,
  groundAt,
  sampleDistances,
  smoothHeading,
  stepBob,
  bearing,
  distance,
  distanceAlong,
  EYE_HEIGHT_M,
  eyeHeight,
  headingAt,
  headingDelta,
  lerpHeading,
  measurePath,
  normaliseHeading,
  offset,
  overviewPose,
  pointAt,
  walkerPose,
} from "./cameraMath";
import type { LatLng } from "./MapController";

const ORIGIN: LatLng = { lat: 21.42, lng: 39.82 };
/** One degree of latitude in metres for the mean Earth radius used. */
const DEG_LAT_M = 111_195.08;

/** An L: 100 m north, then 100 m east. */
const corner = offset(ORIGIN, 0, 100);
const L_PATH = [ORIGIN, corner, offset(corner, 90, 100)];

describe("angles", () => {
  it.each([
    [370, 10],
    [-10, 350],
    [360, 0],
    [0, 0],
  ])("normalises %d to %d", (input, expected) => {
    expect(normaliseHeading(input)).toBeCloseTo(expected);
  });

  it("takes the short way round", () => {
    expect(headingDelta(350, 10)).toBeCloseTo(20);
    expect(headingDelta(10, 350)).toBeCloseTo(-20);
    expect(headingDelta(0, 180)).toBeCloseTo(180);
    expect(lerpHeading(350, 10, 0.5)).toBeCloseTo(0);
    expect(lerpHeading(90, 180, 0.25)).toBeCloseTo(112.5);
  });
});

describe("distance and bearing", () => {
  it("measures a degree of latitude", () => {
    expect(distance(ORIGIN, { lat: ORIGIN.lat + 1, lng: ORIGIN.lng })).toBeCloseTo(DEG_LAT_M, 0);
  });

  it("is zero for the same point", () => {
    expect(distance(ORIGIN, ORIGIN)).toBe(0);
  });

  it.each([
    [0, "north"],
    [90, "east"],
    [180, "south"],
    [270, "west"],
    [37, "north-east"],
  ])("finds bearing %d (%s)", (heading) => {
    expect(bearing(ORIGIN, offset(ORIGIN, heading, 500))).toBeCloseTo(heading, 3);
  });

  it("offsets by the requested distance", () => {
    expect(distance(ORIGIN, offset(ORIGIN, 123, 250))).toBeCloseTo(250, 6);
  });
});

describe("measurePath and pointAt", () => {
  const path = measurePath(L_PATH);

  it("adds up the segment lengths", () => {
    expect(path.length).toBeCloseTo(200, 3);
    expect(path.cumulative).toHaveLength(3);
    expect(path.cumulative[1]).toBeCloseTo(100, 3);
  });

  it("rejects a path with fewer than two points", () => {
    expect(() => measurePath([ORIGIN])).toThrow();
  });

  it("interpolates by distance, across vertices", () => {
    expect(distance(pointAt(path, 50), offset(ORIGIN, 0, 50))).toBeLessThan(0.01);
    expect(distance(pointAt(path, 100), corner)).toBeLessThan(0.01);
    expect(distance(pointAt(path, 150), offset(corner, 90, 50))).toBeLessThan(0.01);
  });

  it("clamps to the ends", () => {
    expect(pointAt(path, -20)).toEqual(ORIGIN);
    expect(distance(pointAt(path, 999), at(L_PATH, 2))).toBeLessThan(0.01);
  });

  it("copes with repeated points", () => {
    const dup = measurePath([ORIGIN, ORIGIN, corner]);
    expect(dup.length).toBeCloseTo(100, 3);
    expect(distance(pointAt(dup, 0), ORIGIN)).toBe(0);
  });
});

describe("headingAt", () => {
  const path = measurePath(L_PATH);

  it("faces along a straight segment", () => {
    expect(headingAt(path, 40)).toBeCloseTo(0, 1);
    expect(headingAt(path, 160)).toBeCloseTo(90, 1);
  });

  it("turns gradually through the corner instead of snapping", () => {
    const headingFor = (d: number) => headingAt(path, d);
    expect(headingFor(100)).toBeGreaterThan(30);
    expect(headingFor(100)).toBeLessThan(60);
    // Monotonic from north to east across the turn.
    const samples = [85, 92, 100, 108, 115].map(headingFor);
    for (let i = 1; i < samples.length; i++) {
      expect(at(samples, i)).toBeGreaterThanOrEqual(at(samples, i - 1));
    }
  });

  it("still has a heading at the very ends", () => {
    expect(headingAt(path, 0)).toBeCloseTo(0, 1);
    expect(headingAt(path, path.length)).toBeCloseTo(90, 1);
  });
});

describe("distanceAlong", () => {
  const path = measurePath(L_PATH);

  it("projects a point beside the path onto it", () => {
    const beside = offset(offset(ORIGIN, 0, 60), 90, 8);
    expect(distanceAlong(path, beside)).toBeCloseTo(60, 0);
  });

  it("finds points on the second segment", () => {
    expect(distanceAlong(path, offset(corner, 90, 30))).toBeCloseTo(130, 0);
  });

  it("clamps points beyond the ends", () => {
    expect(distanceAlong(path, offset(ORIGIN, 180, 50))).toBeCloseTo(0, 3);
  });
});

describe("camera poses", () => {
  const path = measurePath(L_PATH);

  it("puts the eyes 1.7 m above the ground", () => {
    expect(eyeHeight(300, 250)).toBeCloseTo(300 + EYE_HEIGHT_M);
    expect(eyeHeight(undefined, 250)).toBeCloseTo(250 + EYE_HEIGHT_M);
  });

  it("stands the walker on the path, facing the way of walking", () => {
    const pose = walkerPose(path, 50, 300);
    expect(distance(pose.position, offset(ORIGIN, 0, 50))).toBeLessThan(0.01);
    expect(pose.height).toBeCloseTo(301.7);
    expect(pose.heading).toBeCloseTo(0, 1);
    expect(pose.pitch).toBeLessThan(0);
    expect(pose.pitch).toBeGreaterThan(-15);
  });

  it("frames the whole route from behind and above", () => {
    const pose = overviewPose(path, 300);
    const middle = pointAt(path, path.length / 2);
    const overall = bearing(ORIGIN, at(L_PATH, 2));
    expect(pose.heading).toBeCloseTo(overall, 3);
    // The camera sits behind the middle, looking towards it.
    expect(headingDelta(bearing(pose.position, middle), overall)).toBeCloseTo(0, 1);
    expect(pose.height).toBeGreaterThan(300 + 100);
    expect(pose.pitch).toBe(-35);
  });
});

describe("smoothHeading", () => {
  it("turns part of the way each frame, the short way round", () => {
    const next = smoothHeading(350, 10, 0.1, 0.5);
    expect(headingDelta(350, next)).toBeGreaterThan(0);
    expect(headingDelta(350, next)).toBeLessThan(20);
  });

  it("is frame-rate independent", () => {
    let fast = 0;
    for (let i = 0; i < 10; i++) fast = smoothHeading(fast, 90, 0.01);
    expect(fast).toBeCloseTo(smoothHeading(0, 90, 0.1), 6);
  });

  it("snaps when there is no smoothing", () => {
    expect(smoothHeading(0, 450, 0.016, 0)).toBe(90);
  });
});

describe("stepBob", () => {
  it("stays within its amplitude and is level at rest", () => {
    expect(stepBob(0)).toBe(0);
    for (let d = 0; d < 5; d += 0.05) expect(Math.abs(stepBob(d, 0.02))).toBeLessThanOrEqual(0.02);
  });
});

describe("ground profile", () => {
  it("spaces samples evenly and includes both ends", () => {
    expect(sampleDistances(25, 10)).toEqual([0, 25 / 3, 50 / 3, 25]);
    expect(sampleDistances(0, 10)).toEqual([0, 0]);
  });

  it("fills missing samples from their neighbours", () => {
    const profile = buildGroundProfile([0, 10, 20, 30], [undefined, 300, undefined, 304], 0, 0);
    expect(profile.heights).toEqual([300, 300, 302, 304]);
  });

  it("uses the fallback when nothing could be sampled", () => {
    const profile = buildGroundProfile([0, 10], [undefined, Number.NaN], 280);
    expect(profile.heights).toEqual([280, 280]);
  });

  it("removes a spike such as a car or canopy but keeps a slope", () => {
    const distances = [0, 10, 20, 30, 40, 50, 60];
    const slope = [300, 301, 302, 303, 304, 305, 306];
    const spiked = [...slope];
    spiked[3] = 309;
    // The 6 m spike is gone; what is left is within a metre of the true ground.
    expect(buildGroundProfile(distances, spiked, 0).heights[3]).toBe(304);
    expect(buildGroundProfile(distances, slope, 0).heights).toEqual(slope);
  });

  it("rejects mismatched inputs", () => {
    expect(() => buildGroundProfile([0, 10], [1], 0)).toThrow();
  });

  it("interpolates between samples and clamps at the ends", () => {
    const profile = { distances: [0, 10, 20], heights: [300, 302, 301] };
    expect(groundAt(profile, -5)).toBe(300);
    expect(groundAt(profile, 5)).toBe(301);
    expect(groundAt(profile, 15)).toBe(301.5);
    expect(groundAt(profile, 99)).toBe(301);
    expect(() => groundAt({ distances: [], heights: [] }, 0)).toThrow();
  });
});
