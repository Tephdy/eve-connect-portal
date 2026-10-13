// @@CONTRACT_ENGINE:sign-page
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PenTool } from "lucide-react";
import { requireTenantSelf } from "@/lib/auth/require-tenant-self";
import { createClient } from "@/lib/supabase/server";
import { SignatureForm } from "./signature-form";

export const dynamic = "force-dynamic";

export default async function PortalSignContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leaseId } = await params;
  const { tenant } = await requireTenantSelf();
  const supabase = await createClient();

  const { data: lease } = await supabase
    .schema("core")
    .from("lease")
    .select("id, tenant_id")
    .eq("id", leaseId)
    .maybeSingle();

  if (!lease || lease.tenant_id !== tenant.id) notFound();

  const { data: contract } = await supabase
    .schema("prep")
    .from("contract")
    .select("id, generated_body, status")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (!contract) {
    return (
      <div className="space-y-5">
        <Link
          href={"/portal/lease/" + leaseId}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to lease
        </Link>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          No contract yet. Please contact the property office.
        </div>
      </div>
    );
  }

  if (contract.status === "signed") redirect("/portal/lease/" + leaseId);

  return (
    <div className="space-y-5">
      <Link
        href={"/portal/lease/" + leaseId}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to lease
      </Link>

      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <PenTool className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink-900 dark:text-white">
              Sign your contract
            </h1>
            <p className="text-xs text-ink-500">
              Review the full contract, then draw your signature below.
            </p>
          </div>
        </div>

        <div className="mt-5 max-h-[520px] overflow-y-auto rounded-xl border border-ink-100 bg-white p-4 text-xs leading-relaxed text-ink-800 dark:border-white/[0.06] dark:bg-[#0b0c10] dark:text-ink-100">
          <div
            dangerouslySetInnerHTML={{
              __html: contract.generated_body ?? "<p>Body unavailable.</p>",
            }}
          />
        </div>

        <div className="mt-5">
          <SignatureForm contractId={contract.id} leaseId={leaseId} />
        </div>
      </div>
    </div>
  );
}
