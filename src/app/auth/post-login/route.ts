import { NextResponse, type NextRequest } from "next/server";
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
