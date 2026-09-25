import { requirePagePermission } from "@/lib/auth/guard";
import { listReservations } from "@/lib/db/unit-reservations";
import { listProperties } from "@/lib/db/properties";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ReservationTable } from "@/components/accounting/reservation-table";
import { ReservationFilters } from "@/components/accounting/reservation-filters";
import { listUnits } from "@/lib/db/units";
import { listInquiries } from "@/lib/db/inquiries";
import { ReserveUnitButton } from "@/components/property/reserve-unit-button";

export default async function PropertyReservationsPage({
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

  const inquiries = (inquiriesAll as any[]).filter((i) =>
    ["open", "contacted", "converted"].includes(i.status)
  );

  const rows =
    verificationFilter === "all"
      ? allRows
      : (allRows as any[]).filter(
          (r) => r.verification_status === verificationFilter
        );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Units currently reserved by marketing."
        action={
          <ReserveUnitButton units={units} inquiries={inquiries} />
        }
      />

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
        <ReservationTable rows={rows} readOnly />
      )}
    </div>
  );
}
