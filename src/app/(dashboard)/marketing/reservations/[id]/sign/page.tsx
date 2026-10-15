// // @@CONTRACT_ENGINE:reservation-sign-page
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PenTool } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import {
  ensureRepresentativeSignatureMarkup,
  ensureTenantSignatureMarkup,
} from "@/lib/contracts/reservation-attach";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignatureForm } from "./signature-form";

export const dynamic = "force-dynamic";

export default async function StaffReservationSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;

  const admin = createAdminClient();
  const { data: contract } = await admin
    .schema("prep")
    .from("reservation_contract")
    .select("id, status, generated_body, tenant_signature")
    .eq("reservation_id", id)
    .maybeSingle();

  if (!contract) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/marketing/reservations/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to reservation
      </Link>

      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <PenTool className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink-900 dark:text-white">
              Sign reservation contract
            </h1>
            <p className="text-xs text-ink-500">
              Have the client review the contract below, then draw their signature.
            </p>
          </div>
        </div>

        {contract.status === "signed" && (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-500">
            This contract has already been signed.
          </p>
        )}

        <div className="mt-5 max-h-[520px] overflow-y-auto rounded-xl border border-ink-100 bg-white p-4 text-xs leading-relaxed text-ink-800 dark:border-white/[0.06] dark:bg-[#0b0c10] dark:text-ink-100">
          <div
            dangerouslySetInnerHTML={{
              __html:
                ensureTenantSignatureMarkup(
                  ensureRepresentativeSignatureMarkup(
                    contract.generated_body ?? "<p>Body unavailable.</p>"
                  ),
                  contract.tenant_signature
                ),
            }}
          />
        </div>

        {contract.status !== "signed" && (
          <div className="mt-5">
            <SignatureForm contractId={contract.id} reservationId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
