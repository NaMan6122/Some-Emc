// T-031 prod hardening: configuration fails FAST with named errors instead of
// surfacing as an opaque 500 deep inside a request (the deployed-login failure
// mode). Import at server entry points; values are read lazily but validated
// eagerly on first use with precise, non-secret-leaking messages.

export class ConfigError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function requireEnv(name: string, opts?: { min?: number }): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new ConfigError("ENV_MISSING", `${name} is not set — server configuration incomplete`);
  }
  if (opts?.min && v.length < opts.min) {
    throw new ConfigError("ENV_INVALID", `${name} is shorter than ${opts.min} characters`);
  }
  return v;
}

/** AUTH_SECRET must exist and be >=16 chars (jose HS256 requirement). */
export function authSecret(): Uint8Array {
  const s = requireEnv("AUTH_SECRET", { min: 16 });
  return new TextEncoder().encode(s);
}
