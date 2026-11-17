import { EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("uses safe defaults when nothing is set", () => {
    expect(parseEnv({})).toEqual({
      apiBaseUrl: "/api",
      googleMapsApiKey: undefined,
      defaultMode: "live",
    });
  });

  it("reads and normalises the values", () => {
    expect(
      parseEnv({
        VITE_API_BASE_URL: "https://api.example.com/",
        VITE_GOOGLE_MAPS_API_KEY: " maps-key ",
        VITE_DEFAULT_MODE: "scripted",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.com",
      googleMapsApiKey: "maps-key",
      defaultMode: "scripted",
    });
  });

  it("treats a blank maps key as missing", () => {
    expect(parseEnv({ VITE_GOOGLE_MAPS_API_KEY: "  " }).googleMapsApiKey).toBeUndefined();
  });

  it("reports every problem at once", () => {
    try {
      parseEnv({ VITE_API_BASE_URL: "ftp://nope", VITE_DEFAULT_MODE: "telepathy" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as EnvError).problems).toHaveLength(2);
    }
  });
});
