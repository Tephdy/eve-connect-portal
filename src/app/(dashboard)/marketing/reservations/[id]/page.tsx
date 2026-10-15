// // @@CONTRACT_ENGINE:reservation-detail-page
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Printer, RefreshCw, PenTool } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getReservation } from "@/lib/db/unit-reservations";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";
import { ReservationActions } from "./reservation-actions";

export const dynamic = "force-dynamic";

export default async function MarketingReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; signed?: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const sp = await searchParams;

  const reservation = await getReservation(id);
  if (!reservation) notFound();

  const admin = createAdminClient();

  // Fetch the rendered contract
  const { data: contract } = await admin
    .schema("prep")
    .from("reservation_contract")
    .select("id, status, signed_at, tenant_signature, generated_body, template_id")
    .eq("reservation_id", id)
    .maybeSingle();

  let validIdUrl: string | null = null;
  if (reservation.valid_id_path) {
    const { data: signedId, error: signedIdError } = await admin.storage
      .from("reservation-ids")
      .createSignedUrl(reservation.valid_id_path, 300);
    if (signedIdError) {
      console.error("[reservation-detail] valid ID link creation failed:", signedIdError);
    } else {
      validIdUrl = signedId.signedUrl;
    }
  }

  // Unit + property for display
  const { data: unit } = await admin
    .schema("core")
    .from("unit")
    .select("unit_number, property_id")
    .eq("id", reservation.unit_id)
    .maybeSingle();

  let propertyName = "";
  if (unit?.property_id) {
    const { data: prop } = await admin
      .schema("core")
      .from("property")
      .select("name")
      .eq("id", unit.property_id)
      .maybeSingle();
    propertyName = prop?.name ?? "";
  }

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/reservations"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All reservations
      </Link>

      <PageHeader
        title={reservation.client_name}
        description={`${propertyName} ${unit?.unit_number ? "· Unit " + unit.unit_number : ""}`}
      />

      {sp.error && (
        <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-500">
          {sp.error}
        </div>
      )}
      {sp.signed === "1" && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-500">
          Contract signed successfully.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardBody>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
                Reservation details
              </h3>
              <dl className="space-y-2 text-sm">
                <Row label="Client" value={reservation.client_name} />
                <Row label="Phone" value={reservation.client_phone ?? "-"} />
                <Row label="Email" value={reservation.client_email ?? "-"} />
                <Row label="Gender" value={reservation.gender ?? "-"} />
                <Row label="Company" value={reservation.company ?? "-"} />
                <Row label="Position" value={reservation.position ?? "-"} />
                <Row
                  label="Valid ID"
                  value={
                    validIdUrl ? (
                      <a
                        href={validIdUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        View uploaded ID
                      </a>
                    ) : (
                      "Not uploaded"
                    )
                  }
                />
                <Row label="Vehicle plate" value={reservation.vehicle_plate ?? "-"} />
                <Row label="Declared occupants" value={String(reservation.declared_occupants)} />
                <Row label="Reservation fee" value={formatPHP(reservation.reservation_fee ?? 0)} />
                <Row label="Reserved at" value={new Date(reservation.reserved_at).toLocaleString()} />
                <Row label="Target move-in" value={reservation.move_in_date ?? "-"} />
                <Row label="Monthly rent" value={formatPHP(reservation.monthly_rent ?? 0)} />
                <Row label="1st deposit" value={formatPHP(reservation.deposit_1 ?? 0)} />
                <Row label="2nd deposit" value={formatPHP(reservation.deposit_2 ?? 0)} />
                <Row label="Term" value={reservation.term ?? "-"} />
                <Row label="Verification" value={reservation.verification_status} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
                Contract
              </h3>
              {!contract ? (
                <div className="space-y-3">
                  <p className="text-sm text-amber-700 dark:text-amber-500">
                    No contract generated yet.
                  </p>
                  <ReservationActions
                    reservationId={id}
                    contractId={null}
                    contractStatus={null}
                    mode="generate"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <dl className="space-y-2 text-sm">
                    <Row label="Status" value={contract.status} />
                    <Row
                      label="Signed at"
                      value={contract.signed_at ? new Date(contract.signed_at).toLocaleString() : "-"}
                    />
                    <Row label="Body length" value={String(contract.generated_body?.length ?? 0)} />
                  </dl>
                  <ReservationActions
                    reservationId={id}
                    contractId={contract.id}
                    contractStatus={contract.status}
                    mode="manage"
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
              Quick links
            </h3>
            <div className="space-y-2 text-sm">
              {contract && (
                <>
                  <Link
                    href={`/marketing/reservations/${id}/print`}
                    target="_blank"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-brand-600 hover:bg-brand-500/10"
                  >
                    <Printer className="h-4 w-4" />
                    Print contract
                  </Link>
                  <Link
                    href={`/marketing/reservations/${id}/sign`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-brand-600 hover:bg-brand-500/10"
                  >
                    <PenTool className="h-4 w-4" />
                    Sign contract
                  </Link>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900 dark:text-ink-100">{value}</dd>
    </div>
  );
}
