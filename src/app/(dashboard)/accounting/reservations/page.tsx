import { requirePagePermission } from "@/lib/auth/guard";
import { listReservations } from "@/lib/db/unit-reservations";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/layout/empty-state";
import { ReservationTable } from "@/components/accounting/reservation-table";
import { ReservationFilters } from "@/components/accounting/reservation-filters";
import { formatPHP } from "@/lib/utils/format-php";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; property?: string; verification?: string }>;
}) {
  await requirePagePermission("unit:read");
  const sp = await searchParams;

  const openOnly = (sp.status ?? "active") !== "all";
  const property_id = sp.property ?? "all";
  const verificationFilter = sp.verification ?? "all";

  const [allRows, properties] = await Promise.all([
    listReservations({ open_only: openOnly, property_id }),
    listProperties(),
  ]);

  const rows =
    verificationFilter === "all"
      ? allRows
      : (allRows as any[]).filter(
          (r) => r.verification_status === verificationFilter
        );

  // Stats: use the full active set (ignores property filter, respects active)
  const activeRows = await listReservations({
    open_only: true,
    property_id: "all",
  });
  const totalActive = activeRows.length;
  const totalFees = activeRows.reduce(
    (s, r) => s + Number(r.reservation_fee ?? 0),
    0
  );

  const now = new Date();
  const thisMonthCount = activeRows.filter((r) => {
    const d = new Date(r.reserved_at);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Unit reservations and fees collected."
      />

      {totalActive > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Active reservations" value={totalActive} accent="brand" />
          <StatCard
            label="Fees on hold"
            value={formatPHP(totalFees)}
            accent="yellow"
          />
          <StatCard
            label="Reserved this month"
            value={thisMonthCount}
            accent="green"
          />
        </div>
      )}

      <ReservationFilters
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No reservations"
          description={
            openOnly
              ? "No active reservations match your filters."
              : "No reservations found."
          }
        />
      ) : (
        <ReservationTable rows={rows} />
      )}
    </div>
  );
}
