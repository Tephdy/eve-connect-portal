import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET_ENV = "CONTRACT_VERIFY_SECRET";

function getSecret(): string {
  const secret = process.env[SECRET_ENV];
  if (!secret || secret.length < 32) {
    throw new Error(
      SECRET_ENV + " is not set or too short. Generate one with: " +
      "node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
  return secret;
}

/**
 * The signed message is a stable concatenation of the contract's
 * immutable fields. If any of these change after issuance, the
 * signature no longer matches and the verify page flags it.
 */
function message(contract_id: string, created_at: string, lease_id: string): string {
  return "contract-v1|" + contract_id + "|" + created_at + "|" + lease_id;
}

export function signContract(
  contract_id: string,
  created_at: string,
  lease_id: string
): string {
  return createHmac("sha256", getSecret())
    .update(message(contract_id, created_at, lease_id))
    .digest("hex");
}

export function verifyContractSignature(
  contract_id: string,
  created_at: string,
  lease_id: string,
  signature: string
): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = signContract(contract_id, created_at, lease_id);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature.toLowerCase(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Base URL for the verify page. Override with NEXT_PUBLIC_SITE_URL
 * in production (e.g. https://portal.example.com). Defaults to
 * localhost for dev.
 */
export function getVerifyBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function buildVerifyUrl(
  contract_id: string,
  created_at: string,
  lease_id: string
): string {
  const sig = signContract(contract_id, created_at, lease_id);
  return getVerifyBaseUrl() + "/verify/" + contract_id + "?sig=" + sig;
}
