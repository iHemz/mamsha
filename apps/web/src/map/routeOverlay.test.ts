import { sampleRoute } from "../test/sampleRoute";
import { FakeMapController } from "./FakeMapController";
import { drawRoute, routeMarkers } from "./routeOverlay";

describe("routeMarkers", () => {
  it("lists the hotel, numbered stops and the gate in walking order", () => {
    expect(routeMarkers(sampleRoute).map((m) => [m.kind, m.id, m.label])).toEqual([
      ["hotel", "test-hotel", "Test Hotel"],
      ["stop", "stop-1", "1. Fixture stop one"],
      ["stop", "stop-2", "2. Fixture stop two"],
      ["gate", "test-gate", "Test Gate"],
    ]);
  });

  it("uses each place's own position", () => {
    const [hotel, firstStop] = routeMarkers(sampleRoute);
    expect(hotel?.position).toEqual(sampleRoute.hotel.position);
    expect(firstStop?.position).toEqual(sampleRoute.stops[0]?.position);
  });
});

describe("drawRoute", () => {
  it("draws the full path and all markers", () => {
    const map = new FakeMapController();
    drawRoute(map, sampleRoute);
    expect(map.route).toEqual(sampleRoute.path);
    expect(map.markers).toHaveLength(sampleRoute.stops.length + 2);
  });
});
