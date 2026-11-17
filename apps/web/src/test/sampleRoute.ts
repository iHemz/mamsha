import type { RouteData } from "@niyvaru/shared";

/** Fixture data for tests only. Not real places or facts. */
export const sampleRoute: RouteData = {
  hotel: {
    id: "test-hotel",
    name: "Test Hotel",
    position: { lat: 21.419, lng: 39.823 },
    facts: [],
  },
  gate: {
    id: "test-gate",
    name: "Test Gate",
    position: { lat: 21.4215, lng: 39.826 },
    facts: [],
  },
  path: [
    { lat: 21.419, lng: 39.823 },
    { lat: 21.4215, lng: 39.826 },
  ],
  stops: [
    {
      id: "stop-1",
      title: "Fixture stop one",
      position: { lat: 21.4195, lng: 39.8236 },
      heading: 45,
      facts: [
        {
          id: "stop-1-slope",
          text: "Fixture fact.",
          profiles: ["wheelchair_family"],
          verified_from: "test fixture",
        },
      ],
    },
    {
      id: "stop-2",
      title: "Fixture stop two",
      position: { lat: 21.4205, lng: 39.8248 },
      heading: 50,
      facts: [
        {
          id: "stop-2-crossing",
          text: "Fixture fact.",
          profiles: ["young_couple"],
          verified_from: "test fixture",
        },
      ],
    },
  ],
};
