import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getContract } from "@/lib/db/contracts";
import { getLease } from "@/lib/db/leases";
import { getUnit } from "@/lib/db/units";
import { getTenant } from "@/lib/db/tenants";
import { getProperty } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ContractPreview } from "@/components/contract/contract-preview";
import { SignaturePad } from "@/components/contract/signature-pad";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("contract:read");
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  const lease = await getLease(contract.lease_id);
  const [unit, tenant] = lease
    ? await Promise.all([getUnit(lease.unit_id), getTenant(lease.tenant_id)])
    : [null, null];
  const property = unit ? await getProperty(unit.property_id) : null;

  return (
    <div>
      <PageHeader
        title={"Contract for Unit " + (unit?.unit_number ?? "—")}
        description={
          (tenant?.full_name ?? "") + (property ? " — " + property.name : "")
        }
        action={
          <Badge
            tone={
              contract.status === "signed" ? "green"
              : contract.status === "void" ? "red"
              : "yellow"
            }
          >
            {contract.status}
          </Badge>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ContractPreview html={contract.generated_body ?? ""} />
        </div>
        <div className="space-y-4">
          {contract.status === "signed" ? (
            <div className="bg-surface border border-ink-200 rounded-lg p-5">
              <p className="text-sm font-medium text-ink-700 mb-2">Signed</p>
              <p className="text-xs text-ink-500 mb-3">
                {contract.signed_at
                  ? new Date(contract.signed_at).toLocaleString("en-PH")
                  : ""}
              </p>
              {contract.tenant_signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.tenant_signature}
                  alt="Tenant signature"
                  className="border rounded bg-surface max-h-24"
                />
              )}
              {contract.signed_document_url && (
                <>
                  <a
                    href={"/property/contracts/" + contract.id + "/view"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-3 text-sm text-brand-600 hover:underline"
                  >
                    Open signed document
                  </a>
                <a
                  href={"/property/contracts/" + contract.id + "/print"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-sm text-brand-600 hover:underline"
                >
                  Download PDF
                </a>
                </>
              )}
            </div>
          ) : (
            <SignaturePad
              contractId={contract.id}
              tenantName={tenant?.full_name ?? ""}
            />
          )}
        </div>
      </div>
    </div>
  );
}
