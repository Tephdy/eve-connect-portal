import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .schema("acct")
      .from("tenant_receipt")
      .select("*")
      .limit(5);
    results.userClientAcct = {
      count: data?.length ?? null,
      error: error?.message ?? null,
      code: error?.code ?? null,
      rows: data ?? null,
    };
  } catch (e) {
    results.userClientAcct = { thrown: String(e) };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenant_receipt")
      .select("*")
      .limit(5);
    results.userClientPublic = {
      count: data?.length ?? null,
      error: error?.message ?? null,
      code: error?.code ?? null,
    };
  } catch (e) {
    results.userClientPublic = { thrown: String(e) };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .schema("acct")
      .from("tenant_receipt")
      .select("*")
      .limit(5);
    results.adminClientAcct = {
      count: data?.length ?? null,
      error: error?.message ?? null,
      code: error?.code ?? null,
    };
  } catch (e) {
    results.adminClientAcct = { thrown: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
