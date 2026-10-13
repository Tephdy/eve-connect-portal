// @@CONTRACT_ENGINE:marketing-reservations-page
import { requirePagePermission } from "@/lib/auth/guard";
import { listReservations } from "@/lib/db/unit-reservations";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/layout/empty-state";
import { ReservationTable } from "@/components/accounting/reservation-table";
import { ReservationFilters } from "@/components/accounting/reservation-filters";
import { ReserveUnitButton } from "@/components/property/reserve-unit-button";
import { listUnits } from "@/lib/db/units";
import { listInquiries } from "@/lib/db/inquiries";
import { formatPHP } from "@/lib/utils/format-php";

export default async function MarketingReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; property?: string; verification?: string }>;
}) {
  await requirePagePermission("unit:read");
  const sp = await searchParams;

  const openOnly = (sp.status ?? "active") !== "all";
  const property_id = sp.property ?? "all";
  const verificationFilter = sp.verification ?? "all";

  const [allRows, properties, units, inquiriesAll] = await Promise.all([
    listReservations({ open_only: openOnly, property_id }),
    listProperties(),
    listUnits(),
    listInquiries(),
  ]);

  const rows =
    verificationFilter === "all"
      ? allRows
      : allRows.filter((r) => r.verification_status === verificationFilter);

  const totalFees = rows.reduce(
    (s, r) => s + (Number(r.reservation_fee) || 0),
    0
  );

  const thisMonth = rows.filter((r) => {
    const t = new Date(r.reserved_at);
    const now = new Date();
    return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Unit reservations and fees collected."
        action={<ReserveUnitButton units={units} inquiries={inquiriesAll} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active reservations" value={String(rows.length)} />
        <StatCard label="Fees on hold" value={formatPHP(totalFees)} />
        <StatCard label="Reserved this month" value={String(thisMonth)} />
      </div>

      <ReservationFilters properties={properties} />

      {rows.length === 0 ? (
        <EmptyState
          title="No reservations yet"
          description="Reserve a unit from the Forecast page to get started."
        />
      ) : (
        <ReservationTable rows={rows} />
      )}
    </div>
  );
}
