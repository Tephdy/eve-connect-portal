#!/usr/bin/env node
/**
 * Phase 1 Part 4 - Contract templates + generation + signature + lease.signed event
 * Usage: node scaffold-phase1-part4.mjs
 */

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// SCHEMAS
// =============================================================================

FILES["src/lib/schemas/contract.ts"] =
`import { z } from "zod";

export const templateCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  body_markdown: z.string().min(20, "Body is too short").max(100000),
  active: z.coerce.boolean().default(true),
});

export const templateUpdateSchema = templateCreateSchema.partial();

export const contractCreateSchema = z.object({
  lease_id: z.string().uuid("Lease is required"),
  template_id: z.string().uuid("Template is required"),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
`;

// =============================================================================
// DB: templates
// =============================================================================

FILES["src/lib/db/templates.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TemplateCreateInput, TemplateUpdateInput } from "@/lib/schemas/contract";

export type ContractTemplate = {
  id: string;
  name: string;
  body_markdown: string;
  version: number;
  active: boolean;
};

export async function listTemplates(): Promise<ContractTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_template")
    .select("id, name, body_markdown, version, active")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractTemplate[];
}

export async function getTemplate(id: string): Promise<ContractTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_template")
    .select("id, name, body_markdown, version, active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContractTemplate) ?? null;
}

export async function createTemplate(input: TemplateCreateInput): Promise<ContractTemplate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_template")
    .insert({
      name: input.name,
      body_markdown: input.body_markdown,
      active: input.active,
    })
    .select("id, name, body_markdown, version, active")
    .single();
  if (error) throw new Error(error.message);
  return data as ContractTemplate;
}

export async function updateTemplate(
  id: string,
  input: TemplateUpdateInput
): Promise<ContractTemplate> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.body_markdown !== undefined) patch.body_markdown = input.body_markdown;
  if (input.active !== undefined) patch.active = input.active;
  const { data, error } = await supabase
    .from("contract_template")
    .update(patch)
    .eq("id", id)
    .select("id, name, body_markdown, version, active")
    .single();
  if (error) throw new Error(error.message);
  return data as ContractTemplate;
}

export async function archiveTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contract_template")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// =============================================================================
// DB: contracts
// =============================================================================

FILES["src/lib/db/contracts.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Contract = {
  id: string;
  lease_id: string;
  template_id: string | null;
  generated_body: string | null;
  status: "draft" | "sent" | "signed" | "void";
  signed_at: string | null;
  signed_document_url: string | null;
  tenant_signature: string | null;
  created_at: string;
  template_name?: string;
  tenant_name?: string;
  unit_number?: string;
};

async function enrich(rows: Contract[]): Promise<Contract[]> {
  if (rows.length === 0) return rows;
  const supabase = await createClient();

  const leaseIds = Array.from(new Set(rows.map((c) => c.lease_id)));
  const tplIds = Array.from(new Set(rows.map((c) => c.template_id).filter(Boolean))) as string[];

  const [{ data: leases }, { data: templates }] = await Promise.all([
    supabase.from("lease").select("id, tenant_id, unit_id").in("id", leaseIds),
    tplIds.length > 0
      ? supabase.from("contract_template").select("id, name").in("id", tplIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const tenantIds = Array.from(new Set((leases ?? []).map((l) => l.tenant_id)));
  const unitIds = Array.from(new Set((leases ?? []).map((l) => l.unit_id)));

  const [{ data: tenants }, { data: units }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from("tenant").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    unitIds.length > 0
      ? supabase.from("unit").select("id, unit_number").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
  ]);

  const leaseMap = new Map((leases ?? []).map((l) => [l.id, l]));
  const tplMap = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const tenMap = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const unitMap = new Map((units ?? []).map((u) => [u.id, u.unit_number]));

  rows.forEach((c) => {
    c.template_name = c.template_id ? tplMap.get(c.template_id) : undefined;
    const lease = leaseMap.get(c.lease_id);
    if (lease) {
      c.tenant_name = tenMap.get(lease.tenant_id);
      c.unit_number = unitMap.get(lease.unit_id);
    }
  });
  return rows;
}

export async function listContracts(): Promise<Contract[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return enrich((data ?? []) as Contract[]);
}

export async function getContract(id: string): Promise<Contract | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [enriched] = await enrich([data as Contract]);
  return enriched;
}

export async function createContractDraft(input: {
  lease_id: string;
  template_id: string;
  generated_body: string;
}): Promise<Contract> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .insert({
      lease_id: input.lease_id,
      template_id: input.template_id,
      generated_body: input.generated_body,
      status: "draft",
    })
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Contract;
}

export async function markContractSigned(input: {
  contract_id: string;
  signature_url: string;
  signed_document_url: string | null;
}): Promise<Contract> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      tenant_signature: input.signature_url,
      signed_document_url: input.signed_document_url,
    })
    .eq("id", input.contract_id)
    .select("id, lease_id, template_id, generated_body, status, signed_at, signed_document_url, tenant_signature, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Contract;
}

export async function voidContract(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contract").update({ status: "void" }).eq("id", id);
  if (error) throw new Error(error.message);
}
`;

// =============================================================================
// Contract rendering
// =============================================================================

FILES["src/lib/contracts/render.ts"] =
`import "server-only";

type RenderData = Record<string, string>;

export function renderTemplate(template: string, data: RenderData): string {
  return template.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (_, key) => data[key] ?? "");
}

export function buildLeaseData(input: {
  property_name: string;
  property_address: string | null;
  unit_number: string;
  tenant_full_name: string;
  tenant_email: string | null;
  tenant_phone: string | null;
  lease_start: string;
  lease_end: string;
  monthly_rent: number;
  deposit_amount: number;
  notice_period_days: number;
}): RenderData {
  const php = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  });
  return {
    property_name: input.property_name,
    property_address: input.property_address ?? "",
    unit_number: input.unit_number,
    tenant_full_name: input.tenant_full_name,
    tenant_email: input.tenant_email ?? "",
    tenant_phone: input.tenant_phone ?? "",
    lease_start: input.lease_start,
    lease_end: input.lease_end,
    monthly_rent: php.format(input.monthly_rent),
    deposit_amount: php.format(input.deposit_amount),
    notice_period_days: String(input.notice_period_days),
    today: new Date().toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric",
    }),
  };
}
`;

FILES["src/lib/contracts/wrap.ts"] =
`export function wrapPrintableHtml(title: string, body: string): string {
  return \`<!DOCTYPE html>
<html lang="en-PH">
<head>
<meta charset="utf-8" />
<title>\${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 24px; color: #111; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  p  { margin: 8px 0; }
  .meta { text-align: center; color: #666; font-size: 13px; margin-bottom: 32px; }
  .signature-block { margin-top: 64px; display: flex; gap: 40px; }
  .signature-block > div { flex: 1; }
  .sig-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 6px; font-size: 12px; }
  .sig-img { max-width: 240px; max-height: 90px; margin-top: 12px; }
  @media print { body { margin: 0; padding: 24px; } }
</style>
</head>
<body>\${body}</body>
</html>\`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
`;

// =============================================================================
// Events
// =============================================================================

FILES["src/lib/events/emit.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function emit(
  key: string,
  payload: Record<string, unknown>,
  actorId: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("domain_event").insert({
    event_key: key,
    payload,
    emitted_by_user_id: actorId,
  });
  if (error) {
    console.error("[emit] failed:", key, error);
    throw error;
  }
}
`;

FILES["src/lib/events/dispatcher.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { handlers } from "./registry";

export async function dispatchPending(limit = 50): Promise<number> {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("domain_event")
    .select("id, event_key, payload, retry_count")
    .is("processed_at", null)
    .eq("dead_letter", false)
    .order("emitted_at", { ascending: true })
    .limit(limit);

  if (!events || events.length === 0) return 0;

  let processed = 0;
  for (const evt of events) {
    const handler = (handlers as Record<string, (p: any) => Promise<void>>)[evt.event_key];
    if (!handler) {
      await admin.from("domain_event")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", evt.id);
      processed++;
      continue;
    }
    try {
      await handler(evt.payload);
      await admin.from("domain_event")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", evt.id);
      processed++;
    } catch (err) {
      console.error("[dispatch] failed:", evt.event_key, err);
      const retry = (evt.retry_count ?? 0) + 1;
      await admin.from("domain_event")
        .update({ retry_count: retry, dead_letter: retry >= 3 })
        .eq("id", evt.id);
    }
  }
  return processed;
}
`;

FILES["src/lib/events/registry.ts"] =
`import { onLeaseSigned } from "./consumers/lease-signed";
import { onLeaseCreated } from "./consumers/lease-created";
import { onLeaseTerminated } from "./consumers/lease-terminated";
import { onTenantCreated } from "./consumers/tenant-created";

export const handlers: Record<string, (payload: any) => Promise<void>> = {
  "lease.created": onLeaseCreated,
  "lease.signed": onLeaseSigned,
  "lease.terminated": onLeaseTerminated,
  "tenant.created": onTenantCreated,
};
`;

FILES["src/lib/events/consumers/tenant-created.ts"] =
`import "server-only";

export async function onTenantCreated(payload: { tenant_id: string }) {
  // Phase 3 will hook accounting ledger initialization here.
  console.log("[tenant.created] received:", payload.tenant_id);
}
`;

FILES["src/lib/events/consumers/lease-created.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseCreated(payload: {
  lease_id: string;
  unit_id: string;
  tenant_id: string;
}) {
  const admin = createAdminClient();
  // Mark unit as reserved when a lease is created
  await admin.from("unit").update({ status: "reserved" }).eq("id", payload.unit_id);
  console.log("[lease.created] unit reserved:", payload.unit_id);
}
`;

FILES["src/lib/events/consumers/lease-signed.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseSigned(payload: {
  lease_id: string;
  contract_id: string;
  signed_at: string;
}) {
  const admin = createAdminClient();

  // 1. Fetch the lease to get unit + tenant
  const { data: lease } = await admin
    .from("lease")
    .select("id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount")
    .eq("id", payload.lease_id)
    .single();

  if (!lease) {
    console.error("[lease.signed] lease not found:", payload.lease_id);
    return;
  }

  // 2. Mark lease active
  await admin.from("lease").update({ status: "active" }).eq("id", lease.id);

  // 3. Mark unit occupied
  await admin.from("unit").update({ status: "occupied" }).eq("id", lease.unit_id);

  // 4. Phase 3 will hook accounting: create deposit invoice here.
  console.log("[lease.signed] processed:", lease.id);
}
`;

FILES["src/lib/events/consumers/lease-terminated.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onLeaseTerminated(payload: {
  lease_id: string;
  unit_id: string;
}) {
  const admin = createAdminClient();
  // Set unit back to vacant
  await admin.from("unit").update({ status: "vacant" }).eq("id", payload.unit_id);
  console.log("[lease.terminated] unit vacated:", payload.unit_id);
}
`;

// =============================================================================
// Storage helper
// =============================================================================

FILES["src/lib/storage/contracts.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function uploadSignature(input: {
  lease_id: string;
  contract_id: string;
  pngBase64: string;
}): Promise<string> {
  const admin = createAdminClient();

  // Strip data URL prefix if present
  const base64 = input.pngBase64.replace(/^data:image\\/png;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const path = input.lease_id + "/" + input.contract_id + ".png";

  const { error } = await admin.storage
    .from("signatures")
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error("Signature upload failed: " + error.message);

  const { data } = admin.storage.from("signatures").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadSignedHtml(input: {
  lease_id: string;
  contract_id: string;
  html: string;
}): Promise<string> {
  const admin = createAdminClient();
  const path = input.lease_id + "/" + input.contract_id + ".html";
  const buffer = Buffer.from(input.html, "utf8");

  const { error } = await admin.storage
    .from("contracts")
    .upload(path, buffer, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });

  if (error) throw new Error("Contract upload failed: " + error.message);

  const { data } = admin.storage.from("contracts").getPublicUrl(path);
  return data.publicUrl;
}
`;

// =============================================================================
// TEMPLATES UI
// =============================================================================

FILES["src/app/(dashboard)/property/templates/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTemplates } from "@/lib/db/templates";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { TemplateTable } from "@/components/contract/template-table";

export default async function TemplatesPage() {
  await requirePagePermission("template:manage");
  const templates = await listTemplates();
  return (
    <div>
      <PageHeader
        title="Contract Templates"
        description="Reusable HTML templates for lease contracts."
        action={<Link href="/property/templates/new"><Button>+ New Template</Button></Link>}
      />
      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create a template to generate contracts."
          action={<Link href="/property/templates/new"><Button>+ New Template</Button></Link>}
        />
      ) : (
        <TemplateTable templates={templates} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/templates/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { createTemplate, updateTemplate, archiveTemplate } from "@/lib/db/templates";
import { logAudit } from "@/lib/audit/log";
import { templateCreateSchema, templateUpdateSchema } from "@/lib/schemas/contract";
import { parseForm } from "@/lib/forms/parse";
import type { ActionResult } from "@/lib/actions/result";

export async function createTemplateAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("template:manage");
  const parsed = parseForm(templateCreateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const tpl = await createTemplate(parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract_template",
    entity_id: tpl.id,
    action: "create",
    after: tpl,
  });
  revalidatePath("/property/templates");
  redirect("/property/templates/" + tpl.id);
}

export async function updateTemplateAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await assertPermission("template:manage");
  const parsed = parseForm(templateUpdateSchema, formData);
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const session = await getSession();
  const updated = await updateTemplate(id, parsed.data);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract_template",
    entity_id: id,
    action: "update",
    after: updated,
  });
  revalidatePath("/property/templates");
  revalidatePath("/property/templates/" + id);
  return { ok: true, data: undefined };
}

export async function archiveTemplateAction(id: string): Promise<void> {
  await assertPermission("template:manage");
  const session = await getSession();
  await archiveTemplate(id);
  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "contract_template",
    entity_id: id,
    action: "archive",
  });
  revalidatePath("/property/templates");
  redirect("/property/templates");
}
`;

FILES["src/app/(dashboard)/property/templates/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/contract/template-form";

export default async function NewTemplatePage() {
  await requirePagePermission("template:manage");
  return (
    <div>
      <PageHeader title="New Template" description="Create a contract template." />
      <TemplateForm mode="create" />
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/templates/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTemplate } from "@/lib/db/templates";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/contract/template-form";
import { ArchiveTemplateButton } from "@/components/contract/archive-template-button";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("template:manage");
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <div>
      <PageHeader
        title={template.name}
        description={"Version " + template.version}
        action={<ArchiveTemplateButton id={template.id} />}
      />
      <TemplateForm mode="edit" template={template} />
    </div>
  );
}
`;

FILES["src/components/contract/template-form.tsx"] =
`"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createTemplateAction, updateTemplateAction } from "@/app/(dashboard)/property/templates/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { ContractTemplate } from "@/lib/db/templates";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function TemplateForm({
  mode,
  template,
}: {
  mode: "create" | "edit";
  template?: ContractTemplate;
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createTemplateAction : updateTemplateAction.bind(null, template!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Template created" : "Template updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input
            name="name"
            label="Template name"
            defaultValue={template?.name ?? ""}
            error={fieldError("name")}
            required
          />
          <Textarea
            name="body_markdown"
            label="Body (HTML)"
            rows={24}
            defaultValue={template?.body_markdown ?? ""}
            error={fieldError("body_markdown")}
            hint="Use HTML. Available placeholders: {{today}}, {{property_name}}, {{property_address}}, {{unit_number}}, {{tenant_full_name}}, {{tenant_email}}, {{tenant_phone}}, {{lease_start}}, {{lease_end}}, {{monthly_rent}}, {{deposit_amount}}, {{notice_period_days}}"
          />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Template" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/templates")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/contract/template-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ContractTemplate } from "@/lib/db/templates";

export function TemplateTable({ templates }: { templates: ContractTemplate[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH><TH>Version</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {templates.map((t) => (
            <TR key={t.id}>
              <TD className="font-medium">
                <Link href={"/property/templates/" + t.id} className="text-brand-600 hover:underline">
                  {t.name}
                </Link>
              </TD>
              <TD className="text-gray-600">v{t.version}</TD>
              <TD>
                <Badge tone={t.active ? "green" : "gray"}>{t.active ? "active" : "archived"}</Badge>
              </TD>
              <TD className="text-right">
                <Link href={"/property/templates/" + t.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

FILES["src/components/contract/archive-template-button.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { archiveTemplateAction } from "@/app/(dashboard)/property/templates/actions";

export function ArchiveTemplateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  function onClick() {
    if (!confirming) { setConfirming(true); return; }
    start(async () => {
      try { await archiveTemplateAction(id); }
      catch { toast.push("Failed to archive", "error"); }
    });
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} loading={pending}>
      {confirming ? "Click again to confirm" : "Archive"}
    </Button>
  );
}
`;

// =============================================================================
// CONTRACTS UI
// =============================================================================

FILES["src/app/(dashboard)/property/contracts/page.tsx"] =
`import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listContracts } from "@/lib/db/contracts";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ContractTable } from "@/components/contract/contract-table";

export default async function ContractsPage() {
  await requirePagePermission("contract:read");
  const contracts = await listContracts();
  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Generated lease contracts and their signatures."
        action={<Link href="/property/contracts/new"><Button>+ Generate Contract</Button></Link>}
      />
      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description="Generate a contract from a lease and a template."
          action={<Link href="/property/contracts/new"><Button>+ Generate Contract</Button></Link>}
        />
      ) : (
        <ContractTable contracts={contracts} />
      )}
    </div>
  );
}
`;

FILES["src/app/(dashboard)/property/contracts/actions.ts"] =
`"use server";

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
`;

FILES["src/app/(dashboard)/property/contracts/new/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
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
`;

FILES["src/app/(dashboard)/property/contracts/[id]/page.tsx"] =
`import { notFound } from "next/navigation";
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
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-sm font-medium text-gray-700 mb-2">Signed</p>
              <p className="text-xs text-gray-500 mb-3">
                {contract.signed_at
                  ? new Date(contract.signed_at).toLocaleString("en-PH")
                  : ""}
              </p>
              {contract.tenant_signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.tenant_signature}
                  alt="Tenant signature"
                  className="border rounded bg-white max-h-24"
                />
              )}
              {contract.signed_document_url && (
                <a
                  href={contract.signed_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-3 text-sm text-brand-600 hover:underline"
                >
                  Open signed document
                </a>
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
`;

FILES["src/components/contract/generate-contract-form.tsx"] =
`"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { generateContractAction } from "@/app/(dashboard)/property/contracts/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { Lease } from "@/lib/db/leases";
import type { ContractTemplate } from "@/lib/db/templates";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>Generate Contract</Button>;
}

export function GenerateContractForm({
  leases,
  templates,
}: {
  leases: Lease[];
  templates: ContractTemplate[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    generateContractAction,
    null
  );

  const leaseOptions = leases.map((l) => ({
    value: l.id,
    label:
      (l.unit_number ?? "Unit ?") +
      " — " +
      (l.tenant_name ?? "Tenant ?") +
      " (" +
      l.start_date +
      " → " +
      l.end_date +
      ")",
  }));

  const tplOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Select
            name="lease_id"
            label="Lease"
            options={leaseOptions}
            placeholder="Select a lease"
            error={state && !state.ok ? state.fieldErrors?.lease_id : undefined}
            required
          />
          <Select
            name="template_id"
            label="Template"
            options={tplOptions}
            placeholder="Select a template"
            error={state && !state.ok ? state.fieldErrors?.template_id : undefined}
            required
          />
          {state && !state.ok && (
            <p className="text-xs text-red-600">{state.error}</p>
          )}
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/contracts")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
`;

FILES["src/components/contract/contract-table.tsx"] =
`import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Contract } from "@/lib/db/contracts";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow" | "red"> = {
  draft: "gray", sent: "yellow", signed: "green", void: "red",
};

export function ContractTable({ contracts }: { contracts: Contract[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH><TH>Tenant</TH><TH>Template</TH>
            <TH>Status</TH><TH>Created</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {contracts.map((c) => (
            <TR key={c.id}>
              <TD className="font-medium">
                <Link href={"/property/contracts/" + c.id} className="text-brand-600 hover:underline">
                  {c.unit_number ?? "—"}
                </Link>
              </TD>
              <TD className="text-gray-600">{c.tenant_name ?? "—"}</TD>
              <TD className="text-gray-600">{c.template_name ?? "—"}</TD>
              <TD><Badge tone={STATUS_TONE[c.status] ?? "gray"}>{c.status}</Badge></TD>
              <TD className="text-gray-600 text-xs">
                {new Date(c.created_at).toLocaleDateString("en-PH")}
              </TD>
              <TD className="text-right">
                <Link href={"/property/contracts/" + c.id} className="text-brand-600 hover:underline text-sm">
                  View
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
`;

FILES["src/components/contract/contract-preview.tsx"] =
`"use client";

export function ContractPreview({ html }: { html: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Preview</span>
        <button
          onClick={() => window.print()}
          className="text-xs text-brand-600 hover:underline"
        >
          Print / Save as PDF
        </button>
      </div>
      <div
        className="contract-body p-6 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{\`
        @media print {
          body * { visibility: hidden; }
          .contract-body, .contract-body * { visibility: visible; }
          .contract-body { position: absolute; left: 0; top: 0; width: 100%; }
        }
      \`}</style>
    </div>
  );
}
`;

FILES["src/components/contract/signature-pad.tsx"] =
`"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { signContractAction } from "@/app/(dashboard)/property/contracts/actions";

export function SignaturePad({
  contractId,
  tenantName,
}: {
  contractId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [pending, start] = useTransition();

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let x = 0, y = 0;
    if ("touches" in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    return { x: x - rect.left, y: y - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    setHasDrawn(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function endDraw() {
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function submit() {
    if (!hasDrawn) {
      toast.push("Please draw your signature first", "error");
      return;
    }
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    start(async () => {
      try {
        const result = await signContractAction(contractId, dataUrl);
        if (!result.ok) {
          toast.push(result.error, "error");
          return;
        }
        toast.push("Contract signed", "success");
        router.refresh();
      } catch (e) {
        toast.push("Signing failed", "error");
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-700">Tenant signature</p>
        <p className="text-xs text-gray-500">
          Have {tenantName || "the tenant"} sign in the box below.
        </p>
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        className="border border-gray-300 rounded bg-white w-full touch-none"
      />
      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending}>Sign & Finalize</Button>
        <Button variant="secondary" onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}
`;

// =============================================================================
// DISPATCH API ROUTE (for cron / manual trigger)
// =============================================================================

FILES["src/app/api/events/dispatch/route.ts"] =
`import { NextResponse } from "next/server";
import { dispatchPending } from "@/lib/events/dispatcher";

// Call this route to process pending domain events.
// In production, wire it to a Vercel Cron every minute.
export async function POST() {
  const processed = await dispatchPending(50);
  return NextResponse.json({ processed });
}

export async function GET() {
  const processed = await dispatchPending(50);
  return NextResponse.json({ processed });
}
`;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  const pkgText = await readFile(pkg, "utf8");
  if (!pkgText.includes('"apartment-portal"')) {
    console.warn("package.json name isn't 'apartment-portal'. Continue? (Enter to proceed)");
    await new Promise((r) => process.stdin.once("data", r));
  }

  console.log("Phase 1 Part 4 - Contracts + Signature + Events\\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\\nDone - " + count + " file(s) written.\\n");
  console.log("Next:");
  console.log("  npm run typecheck");
  console.log("  npm run dev");
  console.log("\\nTest:");
  console.log("  http://localhost:3000/property/templates");
  console.log("  http://localhost:3000/property/contracts/new");
  console.log("\\nDispatch events with:");
  console.log("  curl -X POST http://localhost:3000/api/events/dispatch");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});