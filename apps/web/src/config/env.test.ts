import { EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("uses safe defaults when nothing is set", () => {
    expect(parseEnv({})).toEqual({
      apiBaseUrl: "/api",
      cesiumIonToken: undefined,
      mapillaryAccessToken: undefined,
      streetLevelProvider: "auto",
      googleMapsApiKey: undefined,
      defaultMode: "live",
    });
  });

  it("reads and normalises the values", () => {
    expect(
      parseEnv({
        VITE_API_BASE_URL: "https://api.example.com/",
        VITE_CESIUM_ION_TOKEN: " ion-token ",
        VITE_MAPILLARY_ACCESS_TOKEN: " MLY|123 ",
        VITE_STREET_LEVEL_PROVIDER: " mapillary ",
        VITE_GOOGLE_MAPS_API_KEY: " maps-key ",
        VITE_DEFAULT_MODE: "scripted",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.com",
      cesiumIonToken: "ion-token",
      mapillaryAccessToken: "MLY|123",
      streetLevelProvider: "mapillary",
      googleMapsApiKey: "maps-key",
      defaultMode: "scripted",
    });
  });

  it("treats blank optional tokens as missing", () => {
    const env = parseEnv({
      VITE_CESIUM_ION_TOKEN: " ",
      VITE_MAPILLARY_ACCESS_TOKEN: "",
      VITE_GOOGLE_MAPS_API_KEY: "  ",
    });
    expect(env.cesiumIonToken).toBeUndefined();
    expect(env.mapillaryAccessToken).toBeUndefined();
    expect(env.googleMapsApiKey).toBeUndefined();
  });

  it.each(["auto", "google", "mapillary", "cesium"])("accepts street-level provider %s", (p) => {
    expect(parseEnv({ VITE_STREET_LEVEL_PROVIDER: p }).streetLevelProvider).toBe(p);
  });

  it("rejects an unknown street-level provider", () => {
    expect(() => parseEnv({ VITE_STREET_LEVEL_PROVIDER: "bing" })).toThrow(EnvError);
  });

  it("reports every problem at once", () => {
    try {
      parseEnv({
        VITE_API_BASE_URL: "ftp://nope",
        VITE_DEFAULT_MODE: "telepathy",
        VITE_STREET_LEVEL_PROVIDER: "bing",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as EnvError).problems).toHaveLength(3);
    }
  });
});
