import { hash as _hash, verify as _verify } from "@node-rs/argon2";

// Argon2id via @node-rs/argon2 defaults (spec-003-v2). Indirection keeps vendor
// APIs out of business code and makes hashing swappable in one place.
export function hashPassword(plain: string): Promise<string> {
  return _hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await _verify(hash, plain);
  } catch {
    return false; // malformed hash stored — treat as invalid credentials
  }
}
