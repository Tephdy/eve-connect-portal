import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/_next",
  "/api/cron",
  "/portal/accept-invite",
  "/portal/login",
  "/portal/logout",
  "/portal/terms",
  "/portal/privacy",
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
  if (isPublic) return response;

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

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/portal/login")
    ) {
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
