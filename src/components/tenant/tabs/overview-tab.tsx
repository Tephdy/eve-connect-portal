import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { TenantProfile } from "@/lib/db/tenant-profile";

const TERM_LABEL: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "2_years": "2 years",
  "3_years": "3 years",
  other: "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function OverviewTab({ profile }: { profile: TenantProfile }) {
  const { tenant, leases, stats } = profile;

  const activeLease = leases.find(
    (l) => l.status === "active" || l.status === "expiring"
  );

  // Label adjusts based on whether we have any lease history
  const sinceLabel = leases.length > 0 ? "Tenant since" : "Record created";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Personal details" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Full name" value={tenant.full_name} />
          <Row label="Email" value={tenant.email ?? "—"} />
          <Row label="Phone" value={tenant.phone ?? "—"} />
          <Row label="Messenger" value={tenant.messenger_name ?? "—"} />
          <Row label="Government ID" value={tenant.government_id ?? "—"} />
          <Row
            label="Status"
            value={
              <StatusPill tone={
                tenant.status === "active" ? "green"
                : tenant.status === "prospect" ? "yellow"
                : tenant.status === "blacklisted" ? "red"
                : "gray"
              } dot>
                {tenant.status}
              </StatusPill>
            }
          />
          {stats.first_move_in_date && (
            <Row label={sinceLabel} value={formatDate(stats.first_move_in_date)} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Current lease" />
        <CardBody className="text-sm">
          {activeLease ? (
            <div className="space-y-3">
              <Row label="Property" value={activeLease.property_name ?? "—"} />
              <Row label="Unit" value={activeLease.unit_number ?? "—"} />
              <Row label="Term" value={activeLease.term ? (TERM_LABEL[activeLease.term] ?? activeLease.term) : "—"} />
              <Row label="Intent" value={activeLease.intent ?? "—"} />
              <Row label="Start date" value={formatDate(activeLease.start_date)} />
              <Row label="End of contract" value={formatDate(activeLease.end_date)} />
              {activeLease.move_in_date && (
                <Row label="Move-in date" value={formatDate(activeLease.move_in_date)} />
              )}
              <Row label="Monthly rent" value={formatPHP(activeLease.monthly_rent)} />
              <Row
                label="Status"
                value={
                  <StatusPill tone={activeLease.status === "active" ? "green" : "yellow"} dot>
                    {activeLease.status}
                  </StatusPill>
                }
              />
              <Link
                href={"/property/leases/" + activeLease.id}
                className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                View full lease →
              </Link>
            </div>
          ) : (
            <p className="py-6 text-center text-ink-500">
              No active lease on file.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Summary" description="All-time figures" />
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Summary label="Total leases" value={String(leases.length)} />
            <Summary label="Active leases" value={String(stats.active_leases)} />
            <Summary label="Total invoices" value={String(profile.invoices.length)} />
            <Summary label="Total payments" value={String(profile.payments.length)} />
            <Summary label="Total invoiced" value={formatPHP(stats.total_invoiced)} />
            <Summary label="Total paid" value={formatPHP(stats.total_paid)} />
            <Summary label="Outstanding" value={formatPHP(stats.outstanding)} />
            <Summary label="Current balance" value={formatPHP(stats.current_balance)} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900 capitalize">{value}</span>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-ink-900">{value}</p>
    </div>
  );
}
