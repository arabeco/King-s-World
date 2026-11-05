import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashLobbyPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyLobbyPassword(password: string, hash: string): boolean {
  if (!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash)) return false;
  const [salt, expected] = hash.split(":");
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), 32), Buffer.from(expected, "hex"));
}
