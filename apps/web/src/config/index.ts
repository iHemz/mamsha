import { parseEnv } from "./env";

/** Validated once at startup: a bad value fails loudly instead of misbehaving later. */
export const env = parseEnv(import.meta.env);
