import type { RouteData } from "@mamsha/shared";
import routeDataSchema from "@mamsha/shared/schemas/route_data.json";
import { Ajv2020 } from "ajv/dist/2020";

const ajv = new Ajv2020({ allErrors: true });
const validateRouteData = ajv.compile<RouteData>(routeDataSchema);

export type RouteErrorKind = "unavailable" | "invalid" | "network";

export class RouteError extends Error {
  constructor(
    readonly kind: RouteErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

/** Fetch the route from `GET /route` and check it against the shared JSON Schema. */
export async function fetchRoute(
  apiBaseUrl: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<RouteData> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/route`, {
      headers: { Accept: "application/json" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new RouteError("network", "Couldn't reach the route service.");
  }

  if (!response.ok) {
    throw new RouteError("unavailable", `The route service answered ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RouteError("invalid", "The route service sent something that isn't JSON.");
  }
  if (!validateRouteData(body)) {
    const detail = ajv.errorsText(validateRouteData.errors, { dataVar: "route" });
    throw new RouteError("invalid", `The route data doesn't match the schema: ${detail}`);
  }
  return body;
}
