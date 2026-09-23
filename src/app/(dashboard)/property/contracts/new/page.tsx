import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { listTemplates } from "@/lib/db/templates";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { GenerateContractForm } from "@/components/contract/generate-contract-form";

export default async function NewContractPage() {
  await requirePagePermission("contract:create");
  const [allLeases, templates, units] = await Promise.all([
    listLeases(),
    listTemplates(),
    listUnits(),
  ]);

  // Only leases marked active can be contracted.
  const onlyActive = (allLeases as any[]).filter(
    (l) => l.status === "active"
  );
  const activeTemplates = templates.filter((t) => t.active);

  return (
    <div>
      <PageHeader
        title="Generate Contract"
        description="Pick a lease and a template."
      />
      <GenerateContractForm
        leases={onlyActive}
        templates={activeTemplates}
        units={units}
      />
    </div>
  );
}
