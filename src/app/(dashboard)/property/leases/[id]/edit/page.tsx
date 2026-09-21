import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getLease } from "@/lib/db/leases";
import { listUnits } from "@/lib/db/units";
import { listTenants } from "@/lib/db/tenants";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseForm } from "@/components/lease/lease-form";

export default async function EditLeasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("lease:read");
  const { id } = await params;
  const lease = await getLease(id);
  if (!lease) notFound();

  const [units, tenants, properties] = await Promise.all([
    listUnits(),
    listTenants(),
    listProperties(),
  ]);

  return (
    <div>
      <Link
        href={"/property/leases/" + id}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>
      <PageHeader title={"Edit Lease — Unit " + (lease.unit_number ?? "")} />
      <LeaseForm
        mode="edit"
        lease={lease}
        units={units}
        tenants={tenants}
        properties={properties}
      />
    </div>
  );
}
