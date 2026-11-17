export const VOICE_MODES = ["live", "pipeline", "text", "scripted"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export interface AppEnv {
  /** Base URL of the FastAPI service. `/api` in dev (proxied by Vite). */
  apiBaseUrl: string;
  /** Browser Maps key (referrer-restricted). Optional until the 3D map lands. */
  googleMapsApiKey: string | undefined;
  defaultMode: VoiceMode;
}

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment:\n- ${problems.join("\n- ")}`);
    this.name = "EnvError";
  }
}

type RawEnv = Partial<Record<string, string>>;

function isVoiceMode(value: string): value is VoiceMode {
  return (VOICE_MODES as readonly string[]).includes(value);
}

/** Validate the raw `import.meta.env` values. Throws an EnvError listing every problem. */
export function parseEnv(raw: RawEnv): AppEnv {
  const problems: string[] = [];

  const apiBaseUrl = (raw["VITE_API_BASE_URL"] ?? "/api").trim().replace(/\/+$/, "");
  if (!apiBaseUrl.startsWith("/") && !/^https?:\/\//.test(apiBaseUrl)) {
    problems.push("VITE_API_BASE_URL must be a path like /api or an http(s) URL");
  }

  const mapsKey = raw["VITE_GOOGLE_MAPS_API_KEY"]?.trim();

  const mode = (raw["VITE_DEFAULT_MODE"] ?? "live").trim();
  if (!isVoiceMode(mode)) {
    problems.push(`VITE_DEFAULT_MODE must be one of ${VOICE_MODES.join(", ")} (got "${mode}")`);
  }

  if (problems.length > 0 || !isVoiceMode(mode)) throw new EnvError(problems);

  return {
    apiBaseUrl,
    googleMapsApiKey: mapsKey === "" ? undefined : mapsKey,
    defaultMode: mode,
  };
}
