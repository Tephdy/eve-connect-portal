// apply-tenant-routing.mjs
// Complete tenant/staff routing fix. 5 files (1 new, 4 modified).
// Fail-loud. Signature-guarded. Backs up every file it touches.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { dirname } from "node:path";

console.log("=== apply-tenant-routing.mjs ===\n");

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function backup(path) {
  copyFileSync(path, path + ".bak");
}

// ===========================================================================
// 1. NEW: src/app/auth/post-login/route.ts
// ===========================================================================
const POST_LOGIN_PATH = "src/app/auth/post-login/route.ts";
const POST_LOGIN_CONTENT = `import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Server-side post-login redirect. Decides where the user lands based on role.
// Tenants -> /portal. Staff -> next param or /dashboard.
//
// Uses a fresh Supabase client so it reads the cookies that signInWithPassword
// just wrote on the client. Route handlers see the updated cookies.

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const nextParam = url.searchParams.get("next") ?? "";

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  // Not logged in -> straight to /login
  if (!user) {
    const redirect = NextResponse.redirect(new URL("/login", url.origin));
    return redirect;
  }

  // Fetch role from public.user_role (security_invoker view)
  const { data: roles } = await supabase
    .from("user_role")
    .select("role_key")
    .eq("user_id", user.id);

  const isTenant =
    Array.isArray(roles) && roles.some((r: any) => r.role_key === "tenant");

  // Tenant -> /portal. Ignore any next that points at staff routes.
  if (isTenant) {
    const redirect = NextResponse.redirect(new URL("/portal", url.origin));
    return redirect;
  }

  // Staff -> next param if safe, else /dashboard
  const safeNext =
    nextParam &&
    !nextParam.startsWith("/login") &&
    !nextParam.startsWith("/portal/login") &&
    !nextParam.startsWith("/auth")
      ? nextParam
      : "/dashboard";

  const redirect = NextResponse.redirect(new URL(safeNext, url.origin));
  return redirect;
}
`;

if (existsSync(POST_LOGIN_PATH)) {
  console.log("SKIP   " + POST_LOGIN_PATH + "  (already exists)");
} else {
  ensureDir(POST_LOGIN_PATH);
  writeFileSync(POST_LOGIN_PATH, POST_LOGIN_CONTENT, "utf8");
  console.log("WRITE  " + POST_LOGIN_PATH);
}

// ===========================================================================
// 2. NEW: src/lib/auth/get-user-roles-server.ts
// ===========================================================================
const SERVER_ROLES_PATH = "src/lib/auth/get-user-roles-server.ts";
const SERVER_ROLES_CONTENT = `import "server-only";
import { createClient } from "@/lib/supabase/server";

// Non-cached role lookup for use inside route handlers and other
// server-only contexts where the React cache from getUserRoles is not
// appropriate. Returns the raw role keys for the current user.

export async function getUserRoleKeys(): Promise<string[]> {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    return [];
  }
  if (!userId) return [];

  const { data } = await supabase
    .from("user_role")
    .select("role_key")
    .eq("user_id", userId);

  return (data ?? []).map((r: any) => String(r.role_key));
}
`;

if (existsSync(SERVER_ROLES_PATH)) {
  console.log("SKIP   " + SERVER_ROLES_PATH + "  (already exists)");
} else {
  ensureDir(SERVER_ROLES_PATH);
  writeFileSync(SERVER_ROLES_PATH, SERVER_ROLES_CONTENT, "utf8");
  console.log("WRITE  " + SERVER_ROLES_PATH);
}

// ===========================================================================
// 3. REPLACE: src/middleware.ts
// ===========================================================================
const MW_PATH = "src/middleware.ts";
const MW_CONTENT = `import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/post-login",
  "/_next",
  "/api/cron",
  "/portal/accept-invite",
  "/portal/login",
  "/portal/logout",
  "/portal/terms",
  "/portal/privacy",
];

// Staff-only route prefixes. Tenants hitting these get bounced to /portal.
const STAFF_PREFIXES = [
  "/dashboard",
  "/accounting",
  "/property",
  "/marketing",
  "/maintenance",
  "/executive",
  "/admin",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/favicon.ico" ||
    /\\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Public paths: don't force a session check, but still resolve the user
  // so we can bounce a logged-in tenant off /portal/login.
  if (isPublic) {
    if (pathname.startsWith("/portal/login") || pathname === "/login") {
      let user = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      } catch {
        user = null;
      }
      if (user) {
        // Who are they? Tenant -> /portal. Staff -> /dashboard.
        const { data: roles } = await supabase
          .from("user_role")
          .select("role_key")
          .eq("user_id", user.id);
        const isTenant =
          Array.isArray(roles) &&
          roles.some((r: any) => r.role_key === "tenant");
        const target = isTenant ? "/portal" : "/dashboard";
        return NextResponse.redirect(new URL(target, request.url));
      }
    }
    return response;
  }

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "refresh_token_not_found"
    ) {
      // Expected - swallow.
    } else {
      console.error("[middleware] getUser failed:", err);
    }
    user = null;
  }

  // Not logged in -> /login with next param
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (!pathname.startsWith("/login")) {
      url.searchParams.set("next", pathname);
    } else {
      url.search = "";
    }
    const redirect = NextResponse.redirect(url);
    for (const cookie of request.cookies.getAll()) {
      if (
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token")
      ) {
        redirect.cookies.delete(cookie.name);
      }
    }
    return redirect;
  }

  // Logged in: fetch roles
  const { data: roles } = await supabase
    .from("user_role")
    .select("role_key")
    .eq("user_id", user.id);

  const isTenant =
    Array.isArray(roles) && roles.some((r: any) => r.role_key === "tenant");
  const isStaff = !isTenant;

  // Tenant on a staff route -> /portal
  if (isTenant && STAFF_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  // Staff on /portal/* (except public ones) -> /dashboard
  if (
    isStaff &&
    pathname.startsWith("/portal/") &&
    !pathname.startsWith("/portal/accept-invite") &&
    !pathname.startsWith("/portal/login") &&
    !pathname.startsWith("/portal/logout") &&
    !pathname.startsWith("/portal/terms") &&
    !pathname.startsWith("/portal/privacy")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
`;

if (!existsSync(MW_PATH)) {
  console.error("MISSING " + MW_PATH);
  process.exit(1);
}
backup(MW_PATH);
writeFileSync(MW_PATH, MW_CONTENT, "utf8");
console.log("REPLACE " + MW_PATH);

// ===========================================================================
// 4. PATCH: src/app/(auth)/login/page.tsx
// ===========================================================================
const LOGIN_PATH = "src/app/(auth)/login/page.tsx";
const LOGIN_SIG = `    router.replace(next);
    router.refresh();`;

if (!existsSync(LOGIN_PATH)) {
  console.error("MISSING " + LOGIN_PATH);
} else {
  const src = readFileSync(LOGIN_PATH, "utf8");
  if (src.includes("/auth/post-login")) {
    console.log("SKIP   " + LOGIN_PATH + "  (already patched)");
  } else if (!src.includes(LOGIN_SIG)) {
    console.error("ABORT  " + LOGIN_PATH + "  (signature not found)");
    console.error("       Expected: router.replace(next);");
  } else {
    backup(LOGIN_PATH);
    const patched = src.replace(
      LOGIN_SIG,
      `    // Full-page nav so /auth/post-login sees the fresh session cookies
    // and can route by role. Tenants never touch /dashboard.
    window.location.href = "/auth/post-login?next=" + encodeURIComponent(next);`
    );
    writeFileSync(LOGIN_PATH, patched, "utf8");
    console.log("PATCH  " + LOGIN_PATH);
  }
}

// ===========================================================================
// 5. PATCH: src/app/portal/login/portal-login-form.tsx
// ===========================================================================
const PORTAL_LOGIN_FORM = "src/app/portal/login/portal-login-form.tsx";
const PORTAL_LOGIN_SIG = `      toast.push("Welcome back", "success");
      router.push("/portal");
      router.refresh();`;

if (!existsSync(PORTAL_LOGIN_FORM)) {
  console.error("MISSING " + PORTAL_LOGIN_FORM);
} else {
  const src = readFileSync(PORTAL_LOGIN_FORM, "utf8");
  if (src.includes("/auth/post-login")) {
    console.log("SKIP   " + PORTAL_LOGIN_FORM + "  (already patched)");
  } else if (!src.includes(PORTAL_LOGIN_SIG)) {
    console.error("ABORT  " + PORTAL_LOGIN_FORM + "  (signature not found)");
  } else {
    backup(PORTAL_LOGIN_FORM);
    const patched = src.replace(
      PORTAL_LOGIN_SIG,
      `      toast.push("Welcome back", "success");
      // Full-page nav so /auth/post-login can route by role.
      window.location.href = "/auth/post-login";`
    );
    writeFileSync(PORTAL_LOGIN_FORM, patched, "utf8");
    console.log("PATCH  " + PORTAL_LOGIN_FORM);
  }
}

// ===========================================================================
// 6. REPLACE: src/app/portal/login/page.tsx
// ===========================================================================
const PORTAL_LOGIN_PAGE = "src/app/portal/login/page.tsx";
const PORTAL_LOGIN_PAGE_CONTENT = `import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getUserRoleKeys } from "@/lib/auth/get-user-roles-server";
import { PortalLoginForm } from "./portal-login-form";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const session = await getSession();

  // If already logged in: route by role so staff don't see the tenant login.
  if (session) {
    const roles = await getUserRoleKeys();
    const isTenant = roles.includes("tenant");
    redirect(isTenant ? "/portal" : "/dashboard");
  }

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

if (!existsSync(PORTAL_LOGIN_PAGE)) {
  console.error("MISSING " + PORTAL_LOGIN_PAGE);
} else {
  backup(PORTAL_LOGIN_PAGE);
  writeFileSync(PORTAL_LOGIN_PAGE, PORTAL_LOGIN_PAGE_CONTENT, "utf8");
  console.log("REPLACE " + PORTAL_LOGIN_PAGE);
}

console.log("");
console.log("=== Done ===");
console.log("");
console.log("Next:");
console.log("  npm run typecheck");
console.log("  git add .");
console.log('  git commit -m "Role-aware routing: tenants to /portal, staff to /dashboard"');
console.log("  git push");
console.log("");
console.log("Then WAIT for Vercel to deploy, and hard-refresh (Ctrl+Shift+R) to test.");