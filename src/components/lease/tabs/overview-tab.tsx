import Link from "next/link";
import {
  Mail,
  Phone,
  MessageCircle,
  IdCard,
  Calendar,
  Banknote,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/utils/format-php";
import { cn } from "@/lib/utils/cn";
import type { LeaseProfile } from "@/lib/db/lease-profile";

const TERM_LABEL: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "2_years": "2 years",
  "3_years": "3 years",
  other: "Other",
};

const TENANT_STATUS_TONE: Record<string, "green" | "yellow" | "gray" | "red"> = {
  active: "green",
  prospect: "yellow",
  former: "gray",
  blacklisted: "red",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function adOnsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).filter(Boolean);
}

export function LeaseOverviewTab({ profile }: { profile: LeaseProfile }) {
  const { lease, contract, stats } = profile;
  const adOns = adOnsList(lease.ad_ons);

  // Progress bar for lease duration
  const totalDays = Math.max(1, stats.duration_days);
  const elapsedPct = Math.min(100, Math.max(0, Math.round((stats.days_elapsed / totalDays) * 100)));

  return (
    <div className="space-y-6">
      {/* Alert banner if expiring */}
      {stats.is_expiring_soon && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-500/30 bg-warning-500/5 px-4 py-3 dark:border-warning-500/20 dark:bg-warning-500/[0.06]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700 dark:text-warning-500" />
          <div>
            <p className="text-sm font-medium text-ink-900">
              This lease expires in {stats.days_remaining} day{stats.days_remaining === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Reach out to the tenant about renewal.
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink-800">Lease progress</span>
            <span className="text-ink-500">{elapsedPct}% elapsed</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all"
              style={{ width: elapsedPct + "%" }}
            />
          </div>
          <div className="flex justify-between text-xs text-ink-500">
            <span>{formatDate(lease.start_date)}</span>
            <span>{formatDate(lease.end_date)}</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tenant */}
        <Card>
          <CardHeader
            title="Tenant"
            action={
              <Link href={"/property/tenants/" + lease.tenant_id}>
                <Button variant="secondary" size="sm">View profile</Button>
              </Link>
            }
          />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-white/[0.04]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-semibold text-white">
                {(lease.tenant_name ?? "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{lease.tenant_name ?? "—"}</p>
                {lease.tenant_status && (
                  <StatusPill tone={TENANT_STATUS_TONE[lease.tenant_status] ?? "gray"} dot>
                    {lease.tenant_status}
                  </StatusPill>
                )}
              </div>
            </div>

            <InfoRow
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email"
              value={lease.tenant_email ?? "—"}
            />
            <InfoRow
              icon={<Phone className="h-3.5 w-3.5" />}
              label="Phone"
              value={lease.tenant_phone ?? "—"}
            />
            <InfoRow
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label="Messenger"
              value={lease.tenant_messenger_name ?? "—"}
            />
            <InfoRow
              icon={<IdCard className="h-3.5 w-3.5" />}
              label="Government ID"
              value={lease.tenant_government_id ?? "—"}
            />
            {lease.tenant_since && (
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Tenant since"
                value={formatDate(lease.tenant_since)}
              />
            )}
          </CardBody>
        </Card>

        {/* Unit + property */}
        <Card>
          <CardHeader
            title="Unit & property"
            action={
              lease.property_id ? (
                <Link href={"/property/properties/" + lease.property_id}>
                  <Button variant="secondary" size="sm">View property</Button>
                </Link>
              ) : undefined
            }
          />
          <CardBody className="space-y-3 text-sm">
            <InfoRow
              icon={<span className="text-xs font-semibold">U</span>}
              label="Unit"
              value={lease.unit_number ?? "—"}
              href={"/property/units/" + lease.unit_id}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">P</span>}
              label="Property"
              value={lease.property_name ?? "—"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">A</span>}
              label="Address"
              value={lease.property_address ?? "—"}
            />
          </CardBody>
        </Card>

        {/* Terms */}
        <Card>
          <CardHeader title="Lease terms" />
          <CardBody className="space-y-3 text-sm">
            <InfoRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Start date"
              value={formatDate(lease.start_date)}
            />
            <InfoRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="End of contract"
              value={formatDate(lease.end_date)}
            />
            {lease.move_in_date && (
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Move-in date"
                value={formatDate(lease.move_in_date)}
              />
            )}
            {lease.due_date && (
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Rent due date"
                value={formatDate(lease.due_date)}
              />
            )}
            <InfoRow
              icon={<span className="text-xs font-semibold">T</span>}
              label="Term"
              value={lease.term ? (TERM_LABEL[lease.term] ?? lease.term) : "—"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">I</span>}
              label="Intent"
              value={lease.intent ?? "—"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">N</span>}
              label="Notice period"
              value={lease.notice_period_days + " days"}
            />
            <InfoRow
              icon={<span className="text-xs font-semibold">D</span>}
              label="Duration"
              value={Math.round(stats.duration_days / 30) + " months"}
            />
          </CardBody>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader title="Financials" />
          <CardBody className="space-y-3 text-sm">
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="Monthly rent"
              value={formatPHP(lease.monthly_rent)}
            />
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="1st deposit"
              value={formatPHP(lease.deposit_1 ?? 0)}
            />
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="2nd deposit"
              value={formatPHP(lease.deposit_2 ?? 0)}
            />
            <InfoRow
              icon={<Banknote className="h-3.5 w-3.5" />}
              label="Add-ons amount"
              value={formatPHP(lease.ad_ons_amount ?? 0)}
            />
            <div className="border-t border-ink-100 pt-3 dark:border-white/[0.04]">
              <InfoRow
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-success-500" />}
                label="Total paid"
                value={formatPHP(stats.total_paid)}
              />
              <InfoRow
                icon={<AlertTriangle className={cn("h-3.5 w-3.5", stats.outstanding > 0 ? "text-danger-500" : "text-ink-300")} />}
                label="Outstanding"
                value={formatPHP(stats.outstanding)}
                tone={stats.outstanding > 0 ? "danger" : "default"}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Add-ons */}
      {adOns.length > 0 && (
        <Card>
          <CardHeader title="Add-ons" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {adOns.map((a, i) => (
                <StatusPill key={i} tone="brand">{a}</StatusPill>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Contract */}
      <Card>
        <CardHeader
          title="Contract"
          action={
            contract ? (
              <Link href={"/property/contracts/" + contract.id}>
                <Button variant="secondary" size="sm">View contract</Button>
              </Link>
            ) : undefined
          }
        />
        <CardBody className="text-sm">
          {contract ? (
            <div className="space-y-3">
              <InfoRow
                icon={<span className="text-xs font-semibold">T</span>}
                label="Template"
                value={contract.template_name ?? "—"}
              />
              <div className="flex items-center justify-between gap-4">
                <span className="text-ink-500">Status</span>
                <StatusPill tone={contract.status === "signed" ? "green" : "yellow"} dot>
                  {contract.status}
                </StatusPill>
              </div>
              {contract.signed_at && (
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Signed at"
                  value={formatDate(contract.signed_at)}
                />
              )}
              {contract.signed_document_url && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-500">Signed document</span>
                  <a
                    href={contract.signed_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="mb-3 text-ink-500">No contract generated for this lease yet.</p>
              <Link href="/property/contracts/new">
                <Button size="sm">Generate contract</Button>
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  tone?: "default" | "danger";
}) {
  const valueColor = tone === "danger" ? "text-danger-700 dark:text-danger-500" : "text-ink-900";
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
      </span>
      {href ? (
        <Link href={href} className="text-right font-medium text-brand-600 hover:underline dark:text-brand-400">
          {value}
        </Link>
      ) : (
        <span className={cn("text-right font-medium capitalize", valueColor)}>{value}</span>
      )}
    </div>
  );
}
