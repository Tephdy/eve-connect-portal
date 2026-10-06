// fix-session-hardening.mjs
// 1. get-session.ts — wrap getUser() in try/catch, return null on error
// 2. logout/route.ts — explicitly clear sb-* cookies on the response
// 3. login/page.tsx — defensive getSession, redirect only on real session
//
// Fail-loud. Backs up every file it touches.

import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";

const GET_SESSION = "src/lib/auth/get-session.ts";
const LOGOUT_ROUTE = "src/app/portal/logout/route.ts";
const LOGIN_PAGE = "src/app/portal/login/page.tsx";

console.log("=== fix-session-hardening.mjs ===\n");

function backupAndWrite(path, content, label) {
  if (!existsSync(path)) {
    console.error("MISSING  " + path);
    return false;
  }
  copyFileSync(path, path + ".bak");
  writeFileSync(path, content, "utf8");
  console.log(label.padEnd(8) + path);
  return true;
}

// ---------------------------------------------------------------------------
// 1. get-session.ts — the root fix
// ---------------------------------------------------------------------------
const GET_SESSION_NEW = `import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getSession = cache(async () => {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    // Supabase throws on stale/invalid refresh tokens. Treat as logged out.
    // Do NOT re-throw — the caller (layout/page) will handle the null case.
    if (
      err &&
      typeof err === "object" &&
      "code" in err
    ) {
      const code = (err as { code: string }).code;
      if (
        code === "refresh_token_not_found" ||
        code === "invalid_grant" ||
        code === "user_not_found"
      ) {
        return null;
      }
    }
    console.error("[getSession] unexpected error:", err);
    return null;
  }
});
`;

console.log("--- 1. get-session.ts ---");
const gsSrc = readFileSync(GET_SESSION, "utf8");
if (gsSrc.includes("refresh_token_not_found")) {
  console.log("SKIP     " + GET_SESSION + "  (already hardened)");
} else {
  backupAndWrite(GET_SESSION, GET_SESSION_NEW, "REPLACE");
}

console.log("");

// ---------------------------------------------------------------------------
// 2. logout/route.ts — aggressive cookie cleanup
// ---------------------------------------------------------------------------
const LOGOUT_NEW = `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[portal/logout] signOut failed:", err);
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const response = NextResponse.redirect(new URL("/portal/login", base), {
    status: 303,
  });

  // Explicitly clear every known Supabase auth cookie. signOut() usually does
  // this, but if it throws (already-signed-out session), cookies can persist.
  const cookieNames = [
    "sb-auth-token",
    "sb-access-token",
    "sb-refresh-token",
  ];
  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return response;
}
`;

console.log("--- 2. logout/route.ts ---");
const loSrc = readFileSync(LOGOUT_ROUTE, "utf8");
if (loSrc.includes("maxAge: 0")) {
  console.log("SKIP     " + LOGOUT_ROUTE + "  (already hardened)");
} else {
  backupAndWrite(LOGOUT_ROUTE, LOGOUT_NEW, "REPLACE");
}

console.log("");

// ---------------------------------------------------------------------------
// 3. login/page.tsx — defensive
// ---------------------------------------------------------------------------
const LOGIN_NEW = `import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { PortalLoginForm } from "./portal-login-form";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  // getSession() is hardened to return null on stale tokens rather than throwing.
  const session = await getSession();
  if (session) redirect("/portal");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-200 bg-surface p-6 shadow-sm dark:border-white/[0.06]">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-ink-900">
            Tenant portal
          </h1>
          <p className="text-sm text-ink-500">
            Sign in to view your lease, invoices, and payments.
          </p>
        </div>
        <PortalLoginForm />
      </div>
    </div>
  );
}
`;

console.log("--- 3. login/page.tsx ---");
const liSrc = readFileSync(LOGIN_PAGE, "utf8");
if (liSrc.includes("hardened to return null")) {
  console.log("SKIP     " + LOGIN_PAGE + "  (already hardened)");
} else {
  backupAndWrite(LOGIN_PAGE, LOGIN_NEW, "REPLACE");
}

console.log("");
console.log("=== Done ===");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  git add .");
console.log('  git commit -m "Harden session handling against stale refresh tokens"');
console.log("  git push");