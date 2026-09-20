import { requirePagePermission } from "@/lib/auth/guard";
import { listLeases } from "@/lib/db/leases";
import { listTemplates } from "@/lib/db/templates";
import { PageHeader } from "@/components/layout/page-header";
import { GenerateContractForm } from "@/components/contract/generate-contract-form";

export default async function NewContractPage() {
  await requirePagePermission("contract:create");
  const [leases, templates] = await Promise.all([listLeases(), listTemplates()]);
  const activeTemplates = templates.filter((t) => t.active);

  return (
    <div>
      <PageHeader
        title="Generate Contract"
        description="Pick a lease and a template."
      />
      <GenerateContractForm leases={leases} templates={activeTemplates} />
    </div>
  );
}
