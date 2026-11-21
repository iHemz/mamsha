/**
 * Pure geometry for the camera: no Cesium, no DOM. Distances are metres, angles are
 * degrees, headings are compass bearings (0 north, 90 east). The walk is under a
 * kilometre, so spherical formulas are used for distance and bearing, and a local
 * flat approximation only where noted.
 */
import type { CameraPose, LatLng } from "./MapController";

const EARTH_RADIUS_M = 6_371_008.8;

/** Eye height of a standing adult above the ground. */
export const EYE_HEIGHT_M = 1.7;

/** `xs[i]`, failing loudly instead of returning undefined. */
export function at<T>(xs: readonly T[], i: number): T {
  const value = xs[i];
  if (value === undefined) throw new RangeError(`No element at index ${i}`);
  return value;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Wrap any angle into [0, 360). */
export function normaliseHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/** Signed shortest turn from `from` to `to`, in (-180, 180]. */
export function headingDelta(from: number, to: number): number {
  const d = normaliseHeading(to - from);
  return d > 180 ? d - 360 : d;
}

/** Interpolate between two headings the short way round. */
export function lerpHeading(from: number, to: number, t: number): number {
  return normaliseHeading(from + headingDelta(from, to) * t);
}

/** Great-circle distance in metres. */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from `a` to `b`. */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const Δλ = rad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normaliseHeading(deg(Math.atan2(y, x)));
}

/** The point `metres` away from `from` along compass `heading`. */
export function offset(from: LatLng, heading: number, metres: number): LatLng {
  const δ = metres / EARTH_RADIUS_M;
  const θ = rad(heading);
  const φ1 = rad(from.lat);
  const λ1 = rad(from.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: deg(φ2), lng: deg(λ2) };
}

/** A path with the distance from its start to each vertex precomputed. */
export interface MeasuredPath {
  points: readonly LatLng[];
  /** `cumulative[i]` is the distance along the path to `points[i]`. */
  cumulative: readonly number[];
  length: number;
}

export function measurePath(points: readonly LatLng[]): MeasuredPath {
  const first = points[0];
  if (!first || points.length < 2) throw new Error("A path needs at least two points");
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(at(points, i - 1), at(points, i));
    cumulative.push(total);
  }
  return { points, cumulative, length: total };
}

/** Index of the segment containing distance `d` (clamped to the path). */
function segmentAt(path: MeasuredPath, d: number): number {
  let lo = 0;
  let hi = path.points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (at(path.cumulative, mid) <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The point at distance `d` along the path, clamped to its ends. */
export function pointAt(path: MeasuredPath, d: number): LatLng {
  const clamped = Math.min(Math.max(d, 0), path.length);
  const i = segmentAt(path, clamped);
  const a = at(path.points, i);
  const b = at(path.points, i + 1);
  const start = at(path.cumulative, i);
  const span = at(path.cumulative, i + 1) - start;
  const t = span === 0 ? 0 : (clamped - start) / span;
  // Linear in lat/lng is accurate to millimetres over segments this short.
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Walking heading at distance `d`: the bearing from a point a little behind to a
 * point a little ahead. Corners are therefore turned gradually over about
 * `2 * window` metres instead of snapping at the vertex.
 */
export function headingAt(path: MeasuredPath, d: number, window = 12): number {
  let from = Math.max(0, d - window);
  let to = Math.min(path.length, d + window);
  // Keep a usable baseline at the very ends of the path.
  if (to - from < window) {
    if (from === 0) to = Math.min(path.length, window * 2);
    else from = Math.max(0, path.length - window * 2);
  }
  return bearing(pointAt(path, from), pointAt(path, to));
}

/**
 * Distance along the path of the point on it nearest to `p`. Used to place each stop
 * on the walk. Uses a local flat approximation, fine at city scale.
 */
export function distanceAlong(path: MeasuredPath, p: LatLng): number {
  const kx = Math.cos(rad(p.lat));
  let best = { gap: Number.POSITIVE_INFINITY, along: 0 };
  for (let i = 0; i < path.points.length - 1; i++) {
    const a = at(path.points, i);
    const b = at(path.points, i + 1);
    const abx = (b.lng - a.lng) * kx;
    const aby = b.lat - a.lat;
    const apx = (p.lng - a.lng) * kx;
    const apy = p.lat - a.lat;
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (apx * abx + apy * aby) / len2));
    const gap = (apx - abx * t) ** 2 + (apy - aby * t) ** 2;
    if (gap < best.gap) {
      const start = at(path.cumulative, i);
      const end = at(path.cumulative, i + 1);
      best = { gap, along: start + (end - start) * t };
    }
  }
  return best.along;
}

/** Camera height for a walker: the sampled ground plus eye height, or a fallback ground. */
export function eyeHeight(ground: number | undefined, fallbackGround: number): number {
  return (ground ?? fallbackGround) + EYE_HEIGHT_M;
}

/**
 * An aerial shot framing the whole route: behind the start, looking along the overall
 * direction of the walk and down at the route's middle.
 */
export function overviewPose(path: MeasuredPath, ground: number, pitch = -35): CameraPose {
  const start = at(path.points, 0);
  const end = at(path.points, path.points.length - 1);
  const heading = bearing(start, end);
  const middle = pointAt(path, path.length / 2);
  // Far enough back to see the whole route with some margin.
  const span = Math.max(path.length, 200);
  const back = span * 1.1;
  const altitude = back * Math.tan(rad(-pitch));
  return {
    position: offset(middle, heading + 180, back),
    height: ground + altitude,
    heading,
    pitch,
  };
}

/** Standing at distance `d` on the path, facing the way of walking, eyes slightly down. */
export function walkerPose(path: MeasuredPath, d: number, ground: number, pitch = -5): CameraPose {
  return {
    position: pointAt(path, d),
    height: ground + EYE_HEIGHT_M,
    heading: headingAt(path, d),
    pitch,
  };
}
