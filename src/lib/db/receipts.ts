import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentFor =
  | "rent" | "utility" | "deposits" | "overdue" | "add-ons"
  | "reservation-fee" | "all" | "others";

export type TenantReceipt = {
  id: string;
  tenant_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  payment_for: string[];
  custom_label: string | null;
  reservation_id: string | null;
  drive_folder_id: string;
  drive_folder_url: string;
  drive_file_ids: { name: string; id: string; url: string }[];
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  payment_month: string | null;
  reference_no: string | null;
  tenant_name?: string;
  unit_number?: string;
  property_name?: string;
};

const SELECT =
  "id, tenant_id, property_id, unit_id, payment_for, custom_label, reservation_id, drive_folder_id, drive_folder_url, drive_file_ids, uploaded_by, uploaded_at, notes, payment_month, reference_no";

export type ReceiptFilter = {
  tenant_id?: string;
  property_id?: string;
  /** Matches any of the receipt's payment_for tags. */
  payment?: string | "all";
  /** Month folder name, e.g. "October 2026". */
  month?: string;
  /** Search across tenant, unit, property. */
  q?: string;
  limit?: number;
};

export async function listReceipts(filter: ReceiptFilter = {}): Promise<TenantReceipt[]> {
  const supabase = await createClient();
  // Read from the public view (accessible to the authenticated role).
  let q = supabase
    .from("tenant_receipt")
    .select(SELECT)
    .order("uploaded_at", { ascending: false })
    .limit(filter.limit ?? 500);

  if (filter.tenant_id) q = q.eq("tenant_id", filter.tenant_id);
  if (filter.property_id) q = q.eq("property_id", filter.property_id);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as TenantReceipt[];
  if (rows.length === 0) return rows;

  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean))) as string[];
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id).filter(Boolean))) as string[];
  const propIds = Array.from(new Set(rows.map((r) => r.property_id).filter(Boolean))) as string[];

  const [tenantsRes, unitsRes, propsRes] = await Promise.all([
    tenantIds.length
      ? supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    unitIds.length
      ? supabase.from("unit").select("id, unit_number").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
    propIds.length
      ? supabase.from("property").select("id, name").in("id", propIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const tMap = new Map((tenantsRes.data ?? []).map((t: any) => [t.id, t.full_name]));
  const uMap = new Map((unitsRes.data ?? []).map((u: any) => [u.id, u.unit_number]));
  const pMap = new Map((propsRes.data ?? []).map((p: any) => [p.id, p.name]));

  rows.forEach((r) => {
    if (r.tenant_id) r.tenant_name = tMap.get(r.tenant_id);
    if (r.unit_id) r.unit_number = uMap.get(r.unit_id);
    if (r.property_id) r.property_name = pMap.get(r.property_id);
  });

  // ----- JS-level filters -----
  // Payment tags (arrays are awkward via PostgREST)
  if (filter.payment && filter.payment !== "all") {
    const want = filter.payment;
    rows = rows.filter((r) =>
      Array.isArray(r.payment_for) && r.payment_for.includes(want)
    );
  }

  // Month (folder name)
  if (filter.month) {
    rows = rows.filter((r) => r.payment_month === filter.month);
  }

  // Free-text search
  const needle = filter.q?.trim().toLowerCase();
  if (needle) {
    rows = rows.filter((r) =>
      (r.tenant_name ?? "").toLowerCase().includes(needle) ||
      (r.unit_number ?? "").toLowerCase().includes(needle) ||
      (r.property_name ?? "").toLowerCase().includes(needle)
    );
  }


  return rows;
}

export async function getReceipt(id: string): Promise<TenantReceipt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_receipt")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TenantReceipt) ?? null;
}

export async function createReceipt(input: {
  tenant_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  payment_for: string[];
  custom_label: string | null;
  reservation_id: string | null;
  drive_folder_id: string;
  drive_folder_url: string;
  drive_file_ids: { name: string; id: string; url: string }[];
  uploaded_by: string | null;
  notes: string | null;
  payment_month?: string | null;
  reference_no?: string | null;
}): Promise<TenantReceipt> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("acct")
    .from("tenant_receipt")
    .insert(input)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as TenantReceipt;
}
