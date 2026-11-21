import type { RouteData } from "@mamsha/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import { sampleRoute } from "./test/sampleRoute";

describe("App shell", () => {
  it("shows the conversation and the route side by side", async () => {
    render(<App loadRoute={() => Promise.resolve(sampleRoute)} />);

    expect(screen.getByRole("region", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Captions" })).toBeInTheDocument();

    const stops = await screen.findByRole("list", { name: "Stops on the walk" });
    expect(
      within(stops)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Fixture stop one", "Fixture stop two"]);
    expect(screen.getByText("Test Hotel")).toBeInTheDocument();
    expect(screen.getByText("Test Gate")).toBeInTheDocument();
  });

  it("announces loading while the route is on its way", () => {
    render(<App loadRoute={() => new Promise<RouteData>(() => undefined)} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the route");
  });

  it("shows an error with a keyboard-reachable retry", async () => {
    const loadRoute = vi
      .fn<(signal: AbortSignal) => Promise<RouteData>>()
      .mockRejectedValueOnce(new Error("The route service answered 503."))
      .mockResolvedValueOnce(sampleRoute);
    const user = userEvent.setup();
    render(<App loadRoute={loadRoute} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("answered 503");

    await user.tab(); // skip link
    await user.tab();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("list", { name: "Stops on the walk" })).toBeInTheDocument();
    expect(loadRoute).toHaveBeenCalledTimes(2);
  });

  it("offers a skip link as the first focus stop", async () => {
    const user = userEvent.setup();
    render(<App loadRoute={() => Promise.resolve(sampleRoute)} />);
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
  });
});
