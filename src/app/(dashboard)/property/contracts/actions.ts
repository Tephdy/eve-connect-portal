"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createContractDraft, getContract, markContractSigned, voidContract } from "@/lib/db/contracts";
import { getLease } from "@/lib/db/leases";
import { getTemplate } from "@/lib/db/templates";
import { getProperty } from "@/lib/db/properties";
import { getUnit } from "@/lib/db/units";
import { getTenant } from "@/lib/db/tenants";
import { buildLeaseData, renderTemplate } from "@/lib/contracts/render";
import { wrapPrintableHtml } from "@/lib/contracts/wrap";
import { uploadSignature, uploadSignedHtml } from "@/lib/storage/contracts";
import { emit } from "@/lib/events/emit";
import { logAudit } from "@/lib/audit/log";
import { contractCreateSchema } from "@/lib/schemas/contract";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function generateContractAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("contract:create");
  const parsed = parseForm(contractCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };

  const lease = await getLease(parsed.data.lease_id);
  if (!lease) return { ok: false, error: "Lease not found" };

  const template = await getTemplate(parsed.data.template_id);
  if (!template) return { ok: false, error: "Template not found" };

  const [unit, tenant] = await Promise.all([
    getUnit(lease.unit_id),
    getTenant(lease.tenant_id),
  ]);
  if (!unit || !tenant) return { ok: false, error: "Missing unit or tenant" };

  const property = await getProperty(unit.property_id);

  const data = buildLeaseData({
    property_name: property?.name ?? "",
    property_address: property?.address ?? null,
    unit_number: unit.unit_number,
    tenant_full_name: tenant.full_name,
    tenant_email: tenant.email,
    tenant_phone: tenant.phone,
    lease_start: lease.start_date,
    lease_end: lease.end_date,
    monthly_rent: lease.monthly_rent,
    deposit_amount: lease.deposit_amount,
    notice_period_days: lease.notice_period_days,
  });

  const renderedBody = renderTemplate(template.body_markdown, data);

  const contract = await createContractDraft({
    lease_id: lease.id,
    template_id: template.id,
    generated_body: renderedBody,
  });

  const session = await getSession();
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract",
    entity_id: contract.id,
    action: "create",
    after: { lease_id: contract.lease_id, template_id: contract.template_id },
  });

  revalidatePath("/property/contracts");
  redirect("/property/contracts/" + contract.id);
}

export async function signContractAction(
  contract_id: string,
  signatureBase64: string
): Promise<ActionResult> {
  await assertPermission("contract:send");
  const session = await getSession();

  const contract = await getContract(contract_id);
  if (!contract) return { ok: false, error: "Contract not found" };
  if (contract.status === "signed") return { ok: false, error: "Already signed" };

  // Upload signature
  const signatureUrl = await uploadSignature({
    lease_id: contract.lease_id,
    contract_id: contract.id,
    pngBase64: signatureBase64,
  });

  // Fetch lease to build final HTML with signature embedded
  const lease = await getLease(contract.lease_id);
  if (!lease) return { ok: false, error: "Lease missing" };

  const finalHtml = wrapPrintableHtml(
    "Signed Contract",
    (contract.generated_body ?? "") +
      "<div class='signature-block'><div><p><strong>Lessee</strong></p><img class='sig-img' src='" +
      signatureUrl +
      "' alt='signature' /></div></div>"
  );

  const signedDocUrl = await uploadSignedHtml({
    lease_id: contract.lease_id,
    contract_id: contract.id,
    html: finalHtml,
  });

  await markContractSigned({
    contract_id: contract.id,
    signature_url: signatureUrl,
    signed_document_url: signedDocUrl,
  });

  await emit(
    "lease.signed",
    { lease_id: contract.lease_id, contract_id: contract.id, signed_at: new Date().toISOString() },
    session?.id ?? null
  );

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract",
    entity_id: contract.id,
    action: "update",
    after: { status: "signed" },
  });

  revalidatePath("/property/contracts");
  revalidatePath("/property/contracts/" + contract.id);
  return { ok: true, data: undefined };
}

export async function voidContractAction(id: string): Promise<void> {
  await assertPermission("contract:void");
  const session = await getSession();
  await voidContract(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract",
    entity_id: id,
    action: "archive",
    reason: "voided",
  });
  revalidatePath("/property/contracts");
  redirect("/property/contracts");
}
