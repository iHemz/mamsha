export const VOICE_MODES = ["live", "pipeline", "text", "scripted"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const STREET_LEVEL_PROVIDERS = ["auto", "google", "mapillary", "cesium"] as const;
export type StreetLevelProviderChoice = (typeof STREET_LEVEL_PROVIDERS)[number];

export interface AppEnv {
  /** Base URL of the FastAPI service. `/api` in dev (proxied by Vite). */
  apiBaseUrl: string;
  /**
   * Cesium ion token, restricted to the Google Photorealistic 3D Tiles asset.
   * Needed for the 3D map. Missing means the map shows an error state and the rest of
   * the app (chat, scripted walk) still works, so it is not a startup failure.
   */
  cesiumIonToken: string | undefined;
  /** Mapillary client token (read-only). Optional: without it, Mapillary is skipped. */
  mapillaryAccessToken: string | undefined;
  /** Which street-level provider to use. `auto` tries Google, then Mapillary, then Cesium. */
  streetLevelProvider: StreetLevelProviderChoice;
  /** Browser Maps key (referrer-restricted). Optional: enables Google Street View. */
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

function isStreetLevelProvider(value: string): value is StreetLevelProviderChoice {
  return (STREET_LEVEL_PROVIDERS as readonly string[]).includes(value);
}

/** Trimmed value, or undefined when unset or blank. */
function optional(raw: RawEnv, name: string): string | undefined {
  const value = raw[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

/** Validate the raw `import.meta.env` values. Throws an EnvError listing every problem. */
export function parseEnv(raw: RawEnv): AppEnv {
  const problems: string[] = [];

  const apiBaseUrl = (raw["VITE_API_BASE_URL"] ?? "/api").trim().replace(/\/+$/, "");
  if (!apiBaseUrl.startsWith("/") && !/^https?:\/\//.test(apiBaseUrl)) {
    problems.push("VITE_API_BASE_URL must be a path like /api or an http(s) URL");
  }

  const streetLevelProvider = (raw["VITE_STREET_LEVEL_PROVIDER"] ?? "auto").trim();
  if (!isStreetLevelProvider(streetLevelProvider)) {
    problems.push(
      `VITE_STREET_LEVEL_PROVIDER must be one of ${STREET_LEVEL_PROVIDERS.join(", ")} (got "${streetLevelProvider}")`,
    );
  }

  const mode = (raw["VITE_DEFAULT_MODE"] ?? "live").trim();
  if (!isVoiceMode(mode)) {
    problems.push(`VITE_DEFAULT_MODE must be one of ${VOICE_MODES.join(", ")} (got "${mode}")`);
  }

  if (problems.length > 0 || !isVoiceMode(mode) || !isStreetLevelProvider(streetLevelProvider)) {
    throw new EnvError(problems);
  }

  return {
    apiBaseUrl,
    cesiumIonToken: optional(raw, "VITE_CESIUM_ION_TOKEN"),
    mapillaryAccessToken: optional(raw, "VITE_MAPILLARY_ACCESS_TOKEN"),
    streetLevelProvider,
    googleMapsApiKey: optional(raw, "VITE_GOOGLE_MAPS_API_KEY"),
    defaultMode: mode,
  };
}
