// apply-chunk-2-invites.mjs
// Creates the 7 NEW files for Chunk 2 (tenant invite flow).
// Does NOT edit existing files. Safe to re-run.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const FILES = [
  // ----------------------------------------------------------------
  {
    path: "src/lib/invites/tokens.ts",
    content: `import "server-only";
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
`,
  },

  // ----------------------------------------------------------------
  {
    path: "src/lib/db/tenant-invites.ts",
    content: `import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteToken, hashInviteToken, INVITE_EXPIRY_DAYS } from "@/lib/invites/tokens";

export type TenantInvite = {
  id: string;
  tenant_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
};

export async function createTenantInvite(input: {
  tenant_id: string;
  created_by: string | null;
}): Promise<{ invite: TenantInvite; rawToken: string }> {
  const admin = createAdminClient();

  const { error: invalidateErr } = await admin
    .schema("core")
    .from("tenant_invite")
    .update({ used_at: new Date().toISOString() })
    .eq("tenant_id", input.tenant_id)
    .is("used_at", null);

  if (invalidateErr) {
    throw new Error("Failed to invalidate prior invites: " + invalidateErr.message);
  }

  const { raw, hash } = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .schema("core")
    .from("tenant_invite")
    .insert({
      tenant_id: input.tenant_id,
      token_hash: hash,
      created_by: input.created_by,
      expires_at: expiresAt,
    })
    .select("id, tenant_id, created_by, created_at, expires_at, used_at, used_by")
    .single();

  if (error) throw new Error(error.message);
  return { invite: data as TenantInvite, rawToken: raw };
}

export async function findUsableInvite(rawToken: string): Promise<TenantInvite | null> {
  const hash = hashInviteToken(rawToken);
  const admin = createAdminClient();

  const { data, error } = await admin
    .schema("core")
    .from("tenant_invite")
    .select("id, tenant_id, created_by, created_at, expires_at, used_at, used_by")
    .eq("token_hash", hash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as TenantInvite;
}

export async function getInviteTenantName(tenant_id: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .schema("core")
    .from("tenant")
    .select("full_name")
    .eq("id", tenant_id)
    .maybeSingle();
  return (data as { full_name: string } | null)?.full_name ?? null;
}

export async function markInviteUsed(input: {
  invite_id: string;
  used_by: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("core")
    .from("tenant_invite")
    .update({ used_at: new Date().toISOString(), used_by: input.used_by })
    .eq("id", input.invite_id);
  if (error) throw new Error(error.message);
}
`,
  },

  // ----------------------------------------------------------------
  {
    path: "src/app/(dashboard)/property/tenants/actions.ts",
    content: `"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTenantInvite } from "@/lib/db/tenant-invites";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/lib/actions/result";

export async function createTenantInviteAction(
  tenant_id: string
): Promise<ActionResult<{ invite_url: string; expires_at: string }>> {
  try {
    await assertPermission("tenant:update");
  } catch {
    return { ok: false, error: "Forbidden: missing tenant:update" };
  }

  const session = await getSession();
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .schema("core")
    .from("tenant")
    .select("id, full_name")
    .eq("id", tenant_id)
    .maybeSingle();

  if (!tenant) return { ok: false, error: "Tenant not found" };

  const { data: existingLink } = await admin
    .schema("core")
    .from("tenant_user")
    .select("auth_user_id")
    .eq("tenant_id", tenant_id)
    .limit(1)
    .maybeSingle();

  if (existingLink) {
    return { ok: false, error: "This tenant already has a linked login account" };
  }

  try {
    const { invite, rawToken } = await createTenantInvite({
      tenant_id,
      created_by: session?.id ?? null,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const invite_url =
      baseUrl.replace(/\\/$/, "") + "/portal/accept-invite?token=" + rawToken;

    await logAudit({
      actor_id: session?.id ?? null,
      entity_type: "tenant_invite",
      entity_id: invite.id,
      action: "create",
      after: {
        tenant_id,
        expires_at: invite.expires_at,
      },
      reason: "Sent login invite",
    });

    revalidatePath("/property/tenants/" + tenant_id);
    return {
      ok: true,
      data: { invite_url, expires_at: invite.expires_at },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create invite",
    };
  }
}
`,
  },

  // ----------------------------------------------------------------
  {
    path: "src/components/tenant/send-invite-button.tsx",
    content: `"use client";

import { useState, useTransition } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createTenantInviteAction } from "@/app/(dashboard)/property/tenants/actions";

export function SendInviteButton({ tenantId }: { tenantId: string }) {
  const [pending, start] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleGenerate = () => {
    start(async () => {
      const res = await createTenantInviteAction(tenantId);
      if (!res.ok) {
        toast.push(res.error, "error");
        return;
      }
      setInviteUrl(res.data.invite_url);
      setExpiresAt(res.data.expires_at);
      setCopied(false);
      toast.push("Invite link generated", "success");
    });
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.push("Copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.push("Copy failed - select and copy manually", "error");
    }
  };

  return (
    <div className="space-y-3">
      {!inviteUrl ? (
        <Button onClick={handleGenerate} loading={pending} variant="primary">
          Send login invite
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 dark:border-emerald-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <div className="text-xs text-ink-700">
              <p className="font-medium">Share this link with the tenant</p>
              <p className="mt-0.5 text-ink-500">
                Paste it into Meta Business Suite / Messenger. It expires on{" "}
                {expiresAt ? new Date(expiresAt).toLocaleString("en-PH") : "-"}.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-md border border-ink-200 bg-surface px-2 py-1.5 font-mono text-xs text-ink-700 dark:border-white/[0.06]"
            />
            <Button
              size="sm"
              variant={copied ? "secondary" : "primary"}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </>
              )}
            </Button>
          </div>

          <button
            onClick={() => {
              setInviteUrl(null);
              setExpiresAt(null);
            }}
            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Generate new link
          </button>
        </div>
      )}
    </div>
  );
}
`,
  },

  // ----------------------------------------------------------------
  {
    path: "src/app/portal/accept-invite/page.tsx",
    content: `import { findUsableInvite, getInviteTenantName } from "@/lib/db/tenant-invites";
import { isPlausibleToken } from "@/lib/invites/tokens";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";

  if (!token || !isPlausibleToken(token)) {
    return <InvalidState reason="This link is malformed or incomplete." />;
  }

  const invite = await findUsableInvite(token);
  if (!invite) {
    return (
      <InvalidState reason="This link is expired, already used, or invalid. Ask the office to send a new one." />
    );
  }

  const tenantName = await getInviteTenantName(invite.tenant_id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm dark:border-white/[0.06]">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-ink-900">
            Create your login
          </h1>
          <p className="text-sm text-ink-500">
            {tenantName ? "Welcome, " + tenantName : "Welcome"}
          </p>
        </div>

        <AcceptInviteForm token={token} />

        <p className="text-center text-xs text-ink-400">
          After you submit, check your email to confirm your address. Then log in
          at <span className="font-mono">/portal/login</span>.
        </p>
      </div>
    </div>
  );
}

function InvalidState({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 p-6 text-center dark:border-danger-500/20">
        <h1 className="text-lg font-semibold text-danger-700 dark:text-danger-500">
          Invite link problem
        </h1>
        <p className="text-sm text-ink-600">{reason}</p>
      </div>
    </div>
  );
}
`,
  },

  // ----------------------------------------------------------------
  {
    path: "src/app/portal/accept-invite/accept-invite-form.tsx",
    content: `"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    start(async () => {
      const res = await acceptInviteAction({ token, email: trimmed, password });
      if (!res.ok) {
        setError(res.error);
        toast.push(res.error, "error");
        return;
      }
      setSubmitted(true);
      toast.push("Account created - check your email", "success");
    });
  };

  if (submitted) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center dark:border-emerald-500/20">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Account created
        </p>
        <p className="text-xs text-ink-600">
          We sent a confirmation link to <strong>{email}</strong>. Click the link
          in that email, then log in at <span className="font-mono">/portal/login</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        required
        autoComplete="new-password"
      />
      <Input
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />

      {error && (
        <div className="rounded-md border border-danger-500/30 bg-danger-500/5 px-3 py-2 text-xs text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}

      <Button type="submit" loading={pending} className="w-full">
        Create my login
      </Button>
    </form>
  );
}
`,
  },

  // ----------------------------------------------------------------
  {
    path: "src/app/portal/accept-invite/actions.ts",
    content: `"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { findUsableInvite, markInviteUsed } from "@/lib/db/tenant-invites";
import { isPlausibleToken } from "@/lib/invites/tokens";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/lib/actions/result";

export async function acceptInviteAction(input: {
  token: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ email: string }>> {
  if (!isPlausibleToken(input.token)) {
    return { ok: false, error: "Invalid invite link" };
  }
  if (!input.email || !input.email.includes("@")) {
    return { ok: false, error: "Invalid email" };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const invite = await findUsableInvite(input.token);
  if (!invite) {
    return {
      ok: false,
      error: "This invite is expired or already used. Ask the office to send a new one.",
    };
  }

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false,
  });

  if (createErr) {
    const msg = createErr.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      return {
        ok: false,
        error: "This email is already registered. Try logging in instead.",
      };
    }
    return { ok: false, error: msg || "Failed to create account" };
  }

  if (!created?.user?.id) {
    return { ok: false, error: "Account creation failed" };
  }

  const newUserId = created.user.id;

  await admin
    .schema("core")
    .from("app_user")
    .upsert(
      {
        id: newUserId,
        email: input.email,
        full_name: "",
        status: "active",
      },
      { onConflict: "id" }
    );

  const { data: tenantRole } = await admin
    .schema("core")
    .from("role")
    .select("id")
    .eq("key", "tenant")
    .maybeSingle();

  if (tenantRole) {
    await admin
      .schema("core")
      .from("user_role")
      .upsert(
        {
          user_id: newUserId,
          role_id: (tenantRole as { id: string }).id,
          scope_type: "global",
        },
        { onConflict: "user_id,role_id" }
      );
  }

  await admin
    .schema("core")
    .from("tenant_user")
    .upsert(
      {
        auth_user_id: newUserId,
        tenant_id: invite.tenant_id,
        relationship: "self",
        verified_at: null,
      },
      { onConflict: "auth_user_id,tenant_id" }
    );

  await markInviteUsed({ invite_id: invite.id, used_by: newUserId });

  await logAudit({
    actor_id: newUserId,
    entity_type: "tenant_user",
    entity_id: invite.tenant_id,
    action: "create",
    after: { auth_user_id: newUserId, tenant_id: invite.tenant_id },
    reason: "Accepted invite",
  });

  return { ok: true, data: { email: input.email } };
}
`,
  },
];

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log("=== apply-chunk-2-invites.mjs ===\n");
let written = 0;
let skipped = 0;

for (const f of FILES) {
  if (existsSync(f.path)) {
    console.log("SKIP  " + f.path + "  (already exists)");
    skipped++;
    continue;
  }
  ensureDir(f.path);
  writeFileSync(f.path, f.content, "utf8");
  console.log("WRITE " + f.path);
  written++;
}

console.log("");
console.log("Done. Written: " + written + ", Skipped: " + skipped);
console.log("");
console.log("Next steps:");
console.log("  1. Add NEXT_PUBLIC_SITE_URL=http://localhost:3000 to .env.local");
console.log("  2. Edit src/middleware.ts  (add /portal/accept-invite to PUBLIC_PATHS)");
console.log("  3. Edit src/app/(dashboard)/property/tenants/[id]/page.tsx  (add SendInviteButton)");
console.log("  4. npm run typecheck");
console.log("  5. npm run dev");
console.log("");
console.log("Verify 'Confirm email' is ON in Supabase Dashboard → Authentication → Providers → Email.");