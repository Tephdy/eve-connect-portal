import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTenant } from "@/lib/db/tenants";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenant/tenant-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import type { Lease } from "@/lib/db/leases";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tenant:read");
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  // Fetch active lease + unit + contract
  const supabase = await createClient();
  const { data: leaseRows } = await supabase
    .from("lease")
    .select(
      "id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, " +
      "notice_period_days, status, created_at, due_date, deposit_1, deposit_2, " +
      "move_in_date, intent, ad_ons, ad_ons_amount"
    )
    .eq("tenant_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const lease = (leaseRows?.[0] ?? null) as Lease | null;

  let unitNumber: string | null = null;
  let contractInfo: { status: string; id: string } | null = null;

  if (lease) {
    const { data: unit } = await supabase
      .from("unit").select("unit_number").eq("id", lease.unit_id).maybeSingle();
    unitNumber = unit?.unit_number ?? null;

    const { data: contract } = await supabase
      .from("contract")
      .select("id, status")
      .eq("lease_id", lease.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    contractInfo = contract ? { id: contract.id, status: contract.status } : null;
  }

  return (
    <div>
      <PageHeader
        title={tenant.full_name}
        description={tenant.email ?? ""}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TenantForm mode="edit" tenant={tenant} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Current lease"
              description={lease ? "Most recent lease" : "No lease yet"}
            />
            <CardBody className="text-sm space-y-2">
              {!lease ? (
                <div>
                  <p className="text-ink-500 mb-3">This tenant has no lease on file.</p>
                  <Link href="/property/leases/new">
                    <Button size="sm">Create lease</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <Row label="Unit" value={unitNumber ?? "—"} />
                  <Row label="Contract" value={
                    contractInfo
                      ? <Badge tone={contractInfo.status === "signed" ? "green" : "yellow"}>{contractInfo.status}</Badge>
                      : <span className="text-ink-400">none</span>
                  } />
                  <Row label="Due date" value={lease.due_date ?? "—"} />
                  <Row label="Rate" value={formatPHP(lease.monthly_rent)} />
                  <Row label="Monthly rent" value={formatPHP(lease.monthly_rent)} />
                  <Row label="1st Deposit" value={formatPHP(lease.deposit_1 ?? 0)} />
                  <Row label="2nd Deposit" value={formatPHP(lease.deposit_2 ?? 0)} />
                  <Row label="Move-in date" value={lease.move_in_date ?? "—"} />
                  <Row label="End of contract" value={lease.end_date} />
                  <Row label="Intent" value={lease.intent ?? "—"} />
                  <Row
                    label="Add-ons"
                    value={
                      Array.isArray(lease.ad_ons) && lease.ad_ons.length > 0
                        ? (lease.ad_ons as { text: string }[]).map((x) => x.text).join(", ")
                        : "—"
                    }
                  />
                  <Row label="Add-ons amount" value={formatPHP(lease.ad_ons_amount ?? 0)} />
                  <div className="pt-3 border-t border-ink-100">
                    <Link
                      href={"/property/leases/" + lease.id}
                      className="text-brand-600 hover:underline text-sm"
                    >
                      View full lease →
                    </Link>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}