import type { RouteData } from "@niyvaru/shared";
import { useCallback, useEffect, useState } from "react";

export type LoadRoute = (signal: AbortSignal) => Promise<RouteData>;

export type RouteState =
  | { status: "loading" }
  | { status: "ready"; route: RouteData }
  | { status: "error"; message: string };

/** Load the route once on mount, with a retry for the error state. */
export function useRoute(loadRoute: LoadRoute): { state: RouteState; retry: () => void } {
  const [state, setState] = useState<RouteState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadRoute(controller.signal).then(
      (route) => {
        setState({ status: "ready", route });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Something went wrong.";
        setState({ status: "error", message });
      },
    );
    return () => {
      controller.abort();
    };
  }, [loadRoute, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
