import "server-only";
import { randomBytes, createHash } from "node:crypto";

export function generateInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function isPlausibleToken(raw: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(raw);
}

export const INVITE_EXPIRY_DAYS = 7;
