import { NextResponse, type NextRequest } from "next/server";
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
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/i.test(pathname)
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

  // Public paths: skip the auth dance entirely. The login pages
  // (/login, /portal/login) already handle "logged in? redirect" server-side
  // with their own role check. Doing it here caused a redirect loop when a
  // stale token triggered Supabase's internal refresh, which emitted its own
  // redirect on every request.
  if (isPublic) {
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

  // Not logged in -> /login with next param, and wipe stale cookies.
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
      if (cookie.name.startsWith("sb-")) {
        redirect.cookies.delete(cookie.name);
      }
    }
    return redirect;
  }

  // Logged in: fetch roles from the security_invoker view.
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};