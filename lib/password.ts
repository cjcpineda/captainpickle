import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** False (never throws) when the stored value isn't a "salt:hash" pair made by hashPassword. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored ?? "").trim().split(":");
  if (!salt || !hash || !/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]{128}$/i.test(hash)) return false;
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), 64), expected);
}
