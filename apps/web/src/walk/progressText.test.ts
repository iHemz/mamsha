import { sampleRoute } from "../test/sampleRoute";
import { announceProgress, describeProgress } from "./progressText";
import type { WalkProgress } from "./walkingCamera";

const base: WalkProgress = {
  phase: "walking",
  stopIndex: 1,
  stopCount: 2,
  remaining: 280,
  length: 420,
  speed: 1,
};

describe("progress text", () => {
  it.each<[Partial<WalkProgress>, string]>([
    [{ phase: "idle" }, "2 stops · 420 m to Test Gate"],
    [{ phase: "overview" }, "Overview of the route · 420 m"],
    [{}, "Stop 2 of 2 · 280 m to go"],
    [{ stopIndex: 2, remaining: 40 }, "Test Gate ahead · 40 m to go"],
    [{ phase: "at_stop" }, "At stop 2 of 2: Fixture stop two · 280 m to go"],
    [{ phase: "paused" }, "Paused · Stop 2 of 2 · 280 m to go"],
    [{ phase: "done", remaining: 0 }, "Arrived at Test Gate"],
  ])("describes %o", (change, text) => {
    expect(describeProgress({ ...base, ...change }, sampleRoute)).toBe(text);
  });

  it.each<[Partial<WalkProgress>, string]>([
    [{ phase: "idle" }, ""],
    [{ phase: "overview" }, "Walk started. Overview of the route."],
    [{}, "Walking to stop 2 of 2."],
    [{ stopIndex: 2 }, "Walking to Test Gate."],
    [{ phase: "at_stop" }, "Arrived at stop 2 of 2: Fixture stop two."],
    [{ phase: "paused" }, "Walk paused."],
    [{ phase: "done" }, "Arrived at Test Gate."],
  ])("announces %o without the metres", (change, text) => {
    expect(announceProgress({ ...base, ...change }, sampleRoute)).toBe(text);
  });
});
