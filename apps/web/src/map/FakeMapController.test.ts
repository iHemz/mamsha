import { FakeMapController } from "./FakeMapController";
import type { MapStatus } from "./MapController";

const pose = { position: { lat: 21.42, lng: 39.82 }, height: 300, heading: 90, pitch: -10 };

describe("FakeMapController", () => {
  it("records calls and keeps the visible state", async () => {
    const map = new FakeMapController();
    await map.mount(document.createElement("div"));
    map.showRoute([pose.position]);
    map.setMarkers([{ id: "h", kind: "hotel", label: "Hotel", position: pose.position }]);
    map.highlight("h");
    await map.flyTo(pose, 2);

    expect(map.mounted).toBe(true);
    expect(map.route).toEqual([pose.position]);
    expect(map.highlighted).toBe("h");
    expect(map.camera).toEqual(pose);
    expect(map.callsTo("flyTo")).toEqual([{ method: "flyTo", pose, durationSeconds: 2 }]);

    map.hideRoute();
    expect(map.route).toBeNull();
  });

  it("returns the chosen ground height, including unloaded tiles", async () => {
    const map = new FakeMapController();
    map.ground = 280;
    await expect(map.groundHeight(pose.position)).resolves.toBe(280);
    map.ground = undefined;
    await expect(map.groundHeight(pose.position)).resolves.toBeUndefined();
  });

  it("sends the current status, then changes, until unsubscribed", () => {
    const map = new FakeMapController();
    const seen: MapStatus[] = [];
    const off = map.onStatus((s) => seen.push(s));
    map.setStatus({ state: "ready" });
    off();
    map.setStatus({ state: "error", message: "x" });
    expect(seen).toEqual([{ state: "loading" }, { state: "ready" }]);
  });
});
