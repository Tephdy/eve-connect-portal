import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PenTool, Printer } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getReservation } from "@/lib/db/unit-reservations";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils/format-php";

export const dynamic = "force-dynamic";

export default async function PropertyReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();

  const admin = createAdminClient();
  const [{ data: contract }, { data: unit }] = await Promise.all([
    admin
      .schema("prep")
      .from("reservation_contract")
      .select("status, signed_at")
      .eq("reservation_id", id)
      .maybeSingle(),
    admin
      .schema("core")
      .from("unit")
      .select("unit_number, property_id")
      .eq("id", reservation.unit_id)
      .maybeSingle(),
  ]);

  let propertyName = "";
  if (unit?.property_id) {
    const { data: property } = await admin
      .schema("core")
      .from("property")
      .select("name")
      .eq("id", unit.property_id)
      .maybeSingle();
    propertyName = property?.name ?? "";
  }

  const addOns = reservation.add_ons ?? [];
  const addOnsTotal = addOns.reduce(
    (sum, addOn) => sum + Number(addOn.amount || 0),
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/property/reservations"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All reservations
      </Link>

      <PageHeader
        title={reservation.client_name}
        description={`${propertyName} ${unit?.unit_number ? "· Unit " + unit.unit_number : ""}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
              Reservation details
            </h2>
            <dl className="divide-y divide-ink-100 text-sm dark:divide-white/[0.06]">
              <Row label="Client" value={reservation.client_name} />
              <Row label="Phone" value={reservation.client_phone ?? "—"} />
              <Row label="Email" value={reservation.client_email ?? "—"} />
              <Row label="Gender" value={reservation.gender ?? "—"} />
              <Row label="Company" value={reservation.company ?? "—"} />
              <Row label="Position" value={reservation.position ?? "—"} />
              <Row label="Vehicle plate" value={reservation.vehicle_plate ?? "—"} />
              <Row
                label="Declared occupants"
                value={String(reservation.declared_occupants)}
              />
              <Row label="Reservation fee" value={formatPHP(reservation.reservation_fee ?? 0)} />
              <Row label="Mode of payment" value={reservation.payment_mode ?? "—"} />
              <Row label="Reference number" value={reservation.reference_number ?? "—"} />
              <Row label="Reserved at" value={new Date(reservation.reserved_at).toLocaleString("en-PH")} />
              <Row label="Target move-in" value={reservation.move_in_date ?? "—"} />
              <Row label="Monthly rent" value={formatPHP(reservation.monthly_rent ?? 0)} />
              <Row label="1st deposit" value={formatPHP(reservation.deposit_1 ?? 0)} />
              <Row label="2nd deposit" value={formatPHP(reservation.deposit_2 ?? 0)} />
              <Row
                label="Add-ons"
                value={
                  addOns.length
                    ? `${addOns.map((a) => `${a.label}: ${formatPHP(a.amount)}`).join(", ")} (Total ${formatPHP(addOnsTotal)})`
                    : "—"
                }
              />
              <Row label="Term" value={reservation.term ?? "—"} />
              <Row label="Verification" value={reservation.verification_status} />
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
                Contract
              </h2>
              {contract ? (
                <dl className="divide-y divide-ink-100 text-sm dark:divide-white/[0.06]">
                  <Row label="Status" value={contract.status} />
                  <Row
                    label="Signed at"
                    value={
                      contract.signed_at
                        ? new Date(contract.signed_at).toLocaleString("en-PH")
                        : "—"
                    }
                  />
                </dl>
              ) : (
                <p className="text-sm text-ink-500">
                  No contract has been generated for this reservation.
                </p>
              )}
            </CardBody>
          </Card>

          {contract && (
            <Card>
              <CardBody>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
                  Quick links
                </h2>
                <div className="space-y-2 text-sm">
                  <Link
                    href={`/marketing/reservations/${id}/print?returnTo=property`}
                    target="_blank"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
                  >
                    <Printer className="h-4 w-4" />
                    Print contract
                  </Link>
                  <Link
                    href={`/marketing/reservations/${id}/sign?returnTo=property`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
                  >
                    <PenTool className="h-4 w-4" />
                    Sign contract
                  </Link>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900 dark:text-ink-100">{value}</dd>
    </div>
  );
}
