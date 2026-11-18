import { act, render, screen, waitFor } from "@testing-library/react";

import { sampleRoute } from "../test/sampleRoute";
import { FakeMapController } from "./FakeMapController";
import { MapView } from "./MapView";

describe("MapView", () => {
  it("explains a missing ion token instead of crashing", () => {
    render(<MapView createMap={undefined} route={sampleRoute} />);
    expect(screen.getByRole("alert")).toHaveTextContent("VITE_CESIUM_ION_TOKEN");
    expect(screen.getByRole("alert")).toHaveTextContent("The walk still works");
  });

  it("mounts the map, frames the hotel and hands the controller over", async () => {
    const map = new FakeMapController();
    const onReady = vi.fn();
    render(
      <MapView createMap={() => Promise.resolve(map)} route={sampleRoute} onReady={onReady} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading the 3D city");
    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(map);
    });
    expect(map.mounted).toBe(true);
    expect(map.camera?.position.lng).toBe(sampleRoute.hotel.position.lng);
    expect(map.camera?.position.lat).toBeLessThan(sampleRoute.hotel.position.lat);
    expect(map.camera?.pitch).toBeLessThan(0);

    act(() => {
      map.setStatus({ state: "ready" });
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a map error while keeping the rest usable", async () => {
    const map = new FakeMapController();
    render(<MapView createMap={() => Promise.resolve(map)} route={sampleRoute} />);
    await waitFor(() => {
      expect(map.mounted).toBe(true);
    });
    act(() => {
      map.setStatus({ state: "error", message: "Tiles refused." });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Tiles refused.");
  });

  it("reports a map that fails to start", async () => {
    render(<MapView createMap={() => Promise.reject(new Error("no WebGL"))} route={sampleRoute} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("no WebGL");
  });

  it("destroys the map on unmount", async () => {
    const map = new FakeMapController();
    const { unmount } = render(
      <MapView createMap={() => Promise.resolve(map)} route={sampleRoute} />,
    );
    await waitFor(() => {
      expect(map.mounted).toBe(true);
    });
    unmount();
    expect(map.mounted).toBe(false);
  });

  it("labels the 3D view for screen readers", () => {
    render(<MapView createMap={undefined} route={sampleRoute} />);
    expect(
      screen.getByRole("img", { name: "3D view of the walk from Test Hotel to Test Gate" }),
    ).toBeInTheDocument();
  });
});
