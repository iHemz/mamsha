import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FakeMapController } from "../map/FakeMapController";
import { ManualClock } from "../test/manualClock";
import { sampleRoute } from "../test/sampleRoute";
import { RoutePanel } from "./RoutePanel";

function renderWalk() {
  const map = new FakeMapController();
  map.ground = 300;
  const clock = new ManualClock();
  render(
    <RoutePanel
      state={{ status: "ready", route: sampleRoute }}
      onRetry={() => undefined}
      createMap={() => Promise.resolve(map)}
      clock={clock}
    />,
  );
  return { map, clock, user: userEvent.setup() };
}

/** Wait for the map to mount and the walk to be ready, then mark the tiles loaded. */
async function ready(map: FakeMapController) {
  const start = await screen.findByRole("button", { name: "Start walk" });
  await waitFor(() => {
    expect(start).toBeEnabled();
  });
  act(() => {
    map.setStatus({ state: "ready" });
  });
  return start;
}

const advance = (clock: ManualClock, ms: number) => act(() => clock.advance(ms));

describe("walk controls", () => {
  it("are disabled until the 3D city is ready, without the map", () => {
    render(
      <RoutePanel
        state={{ status: "ready", route: sampleRoute }}
        onRetry={() => undefined}
        createMap={undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Start walk" })).toBeDisabled();
    expect(screen.getByText(/starts once the 3D city is ready/)).toBeInTheDocument();
  });

  it("start the walk, show progress and pause and resume it", async () => {
    const { map, clock, user } = renderWalk();
    const start = await ready(map);
    expect(screen.getByText(/2 stops · \d+ m to Test Gate/)).toBeInTheDocument();

    await user.click(start);
    expect(screen.getByText(/^Overview of the route · \d+ m$/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Walk started");
    await advance(clock, 3500);
    expect(screen.getByText(/Stop 1 of 2 · \d+ m to go/)).toBeInTheDocument();
    expect(map.camera?.height).toBeCloseTo(301.7, 0);

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText(/^Paused · Stop 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Walk paused.");
    await user.click(screen.getByRole("button", { name: "Resume" }));
    await advance(clock, 100);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("jump stop to stop and then to the gate", async () => {
    const { map, clock, user } = renderWalk();
    await user.click(await ready(map));
    await user.click(screen.getByRole("button", { name: "Next stop" }));
    await advance(clock, 100);
    expect(screen.getByText(/^At stop 1 of 2: Fixture stop one · /)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Arrived at stop 1 of 2: Fixture stop one.",
    );

    await user.click(screen.getByRole("button", { name: "Next stop" }));
    await advance(clock, 100);
    await user.click(screen.getByRole("button", { name: "To the gate" }));
    await advance(clock, 100);
    expect(
      screen.getByText("Arrived at Test Gate", { selector: ".walk-progress-text" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Walk again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "To the gate" })).toBeDisabled();
  });

  it("change the walking speed", async () => {
    const { map, user } = renderWalk();
    await ready(map);
    const speed = screen.getByRole("combobox", { name: "Speed" });
    await user.selectOptions(speed, "4");
    expect(speed).toHaveValue("4");
  });
});
