import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getReservation } from "@/lib/db/unit-reservations";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { VerifyPanel } from "@/components/accounting/verify-panel";
import { formatPHP } from "@/lib/utils/format-php";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900 dark:text-ink-100">
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-500">
          {title}
        </h2>
        <div className="divide-y divide-white/30 dark:divide-white/[0.04]">
          {children}
        </div>
      </CardBody>
    </Card>
  );
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();

  // Get unit + property name
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("unit")
    .select("id, unit_number, property_id")
    .eq("id", reservation.unit_id)
    .maybeSingle();
  const property = unit
    ? (
        await supabase
          .from("property")
          .select("id, name")
          .eq("id", (unit as any).property_id)
          .maybeSingle()
      ).data
    : null;

  const addOns = (reservation.add_ons ?? []) as { label: string; amount: number }[];
  const addOnsTotal = addOns.reduce((s, a) => s + Number(a.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/accounting/reservations"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to reservations
      </Link>

      <PageHeader
        title={"Reservation — Unit " + ((unit as any)?.unit_number ?? "—")}
        description={
          (property as any)?.name
            ? (property as any).name + " · " + reservation.client_name
            : reservation.client_name
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Client">
            <Row label="Name" value={reservation.client_name} />
            <Row label="Phone" value={reservation.client_phone} />
            <Row label="Email" value={reservation.client_email} />
            {reservation.inquiry_id && (
              <Row
                label="Source inquiry"
                value={
                  <Link
                    href={"/marketing/inquiries/" + reservation.inquiry_id}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open inquiry
                  </Link>
                }
              />
            )}
          </SectionCard>

          <SectionCard title="Reservation">
            <Row label="Reservation fee" value={formatPHP(reservation.reservation_fee ?? 0)} />
            <Row label="Mode of payment" value={reservation.payment_mode ?? "—"} />
            <Row label="Reference number" value={reservation.reference_number} />
            <Row
              label="Reserved on"
              value={new Date(reservation.reserved_at).toLocaleString("en-PH")}
            />
            {reservation.released_at && (
              <Row
                label="Released"
                value={
                  new Date(reservation.released_at).toLocaleString("en-PH") +
                  (reservation.release_reason ? " · " + reservation.release_reason : "")
                }
              />
            )}
          </SectionCard>

          <SectionCard title="Lease draft">
            <Row label="Intent" value={reservation.intent} />
            <Row label="Term" value={reservation.term} />
            <Row label="Lease start" value={reservation.lease_start_date} />
            <Row label="Lease end" value={reservation.lease_end_date} />
            <Row label="Move-in date" value={reservation.move_in_date} />
            <Row label="Rent due date" value={reservation.rent_due_date} />
            <Row
              label="Monthly rent"
              value={formatPHP(reservation.monthly_rent ?? 0)}
            />
            <Row
              label="1st deposit"
              value={
                formatPHP(reservation.deposit_1 ?? 0) +
                (reservation.deposit_1_due_date ? " · due " + reservation.deposit_1_due_date : "")
              }
            />
            <Row
              label="2nd deposit"
              value={
                formatPHP(reservation.deposit_2 ?? 0) +
                (reservation.deposit_2_due_date ? " · due " + reservation.deposit_2_due_date : "")
              }
            />
            {addOns.length > 0 && (
              <Row
                label="Add-ons"
                value={
                  <div className="text-right">
                    {addOns.map((a, i) => (
                      <div key={i}>
                        {a.label} — {formatPHP(a.amount)}
                      </div>
                    ))}
                    <div className="font-bold">Total: {formatPHP(addOnsTotal)}</div>
                  </div>
                }
              />
            )}
            <Row
              label="Notice period"
              value={
                reservation.notice_period_days != null
                  ? reservation.notice_period_days + " days"
                  : "—"
              }
            />
            <Row label="Lease status" value={reservation.lease_status} />
          </SectionCard>
        </div>

        <div>
          <VerifyPanel reservation={reservation} />
        </div>
      </div>
    </div>
  );
}
