import { cache } from "react";
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
