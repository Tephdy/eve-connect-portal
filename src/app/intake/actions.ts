"use server";

import { intakeSchema } from "@/lib/schemas/intake";
import { createTenantWithLeaseAndContract } from "@/lib/db/intake";
import type { ActionResult } from "@/lib/actions/result";

// Simple in-memory rate limit — per serverless instance, not global.
// Good enough to stop casual abuse. Replace with Upstash / Vercel KV if
// the form gets hammered.
const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const last = recentSubmissions.get(key);
  if (last && now - last < RATE_LIMIT_MS) return false;
  recentSubmissions.set(key, now);
  // Opportunistic cleanup
  if (recentSubmissions.size > 1000) {
    for (const [k, t] of recentSubmissions) {
      if (now - t > RATE_LIMIT_MS) recentSubmissions.delete(k);
    }
  }
  return true;
}

export async function submitIntakeAction(
  formData: FormData
): Promise<ActionResult<{ tenant_id: string; lease_id: string; contract_id: string }>> {
  // ---- Honeypot ----
  const trap = String(formData.get("website") ?? "").trim();
  if (trap.length > 0) {
    // Pretend success; do nothing. Bots move on.
    return { ok: true, data: { tenant_id: "", lease_id: "", contract_id: "" } };
  }

  // ---- Rate limit ----
  const key =
    String(formData.get("email") ?? "").trim().toLowerCase() ||
    "unknown";
  if (!checkRateLimit(key)) {
    return { ok: false, error: "Too many submissions. Please wait a minute and try again." };
  }

  // ---- Parse ----
  const raw = Object.fromEntries(formData.entries());
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors };
  }

  try {
    const result = await createTenantWithLeaseAndContract(parsed.data);
    return {
      ok: true,
      data: {
        tenant_id: result.tenant_id,
        lease_id: result.lease_id,
        contract_id: result.contract_id,
      },
    };
  } catch (err) {
    console.error("[intake] submit failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Submission failed",
    };
  }
}
