import { NextResponse } from "next/server";
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
