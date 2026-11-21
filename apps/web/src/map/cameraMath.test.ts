import {
  at,
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
