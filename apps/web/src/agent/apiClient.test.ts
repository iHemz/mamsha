import { sampleRoute } from "../test/sampleRoute";
import { fetchRoute, RouteError } from "./apiClient";

function respond(body: unknown, init: ResponseInit = {}): typeof fetch {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
      ...init,
    }),
  );
}

async function expectRouteError(promise: Promise<unknown>, kind: RouteError["kind"]) {
  await expect(promise).rejects.toBeInstanceOf(RouteError);
  await expect(promise).rejects.toMatchObject({ kind });
}

describe("fetchRoute", () => {
  it("returns route data that matches the shared schema", async () => {
    const fetchImpl = respond(sampleRoute);
    await expect(fetchRoute("/api", { fetchImpl })).resolves.toEqual(sampleRoute);
    expect(fetchImpl).toHaveBeenCalledWith("/api/route", expect.anything());
  });

  it("reports a non-2xx answer as unavailable", async () => {
    const fetchImpl = respond({ detail: "Route data is not available yet." }, { status: 503 });
    await expectRouteError(fetchRoute("/api", { fetchImpl }), "unavailable");
  });

  it("rejects data that doesn't match the schema", async () => {
    const [firstStop] = sampleRoute.stops;
    const broken = {
      ...sampleRoute,
      stops: [
        { ...firstStop, facts: [{ id: "f", text: "No source", profiles: ["young_couple"] }] },
      ],
    };
    await expectRouteError(fetchRoute("/api", { fetchImpl: respond(broken) }), "invalid");
  });

  it("rejects a body that isn't JSON", async () => {
    await expectRouteError(fetchRoute("/api", { fetchImpl: respond("<html>") }), "invalid");
  });

  it("reports a failed request as a network error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expectRouteError(fetchRoute("/api", { fetchImpl }), "network");
  });

  it("lets an abort through untouched", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(abort);
    await expect(fetchRoute("/api", { fetchImpl })).rejects.toBe(abort);
  });
});
