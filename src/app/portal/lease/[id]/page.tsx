import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  FileText,
  Wallet,
  Clock,
  Building2,
} from "lucide-react";
import { requireTenantSelf } from "@/lib/auth/require-tenant-self";
import { getMyLease } from "@/lib/db/tenant-portal";
import { formatPHP } from "@/lib/utils/format-php";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  expiring: "Expiring soon",
  ended: "Ended",
  terminated: "Terminated",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-ink-500/20 text-white/90",
  active: "bg-white/25 text-white",
  expiring: "bg-amber-500/40 text-white",
  ended: "bg-ink-500/30 text-white/80",
  terminated: "bg-red-500/40 text-white",
};

export default async function PortalLeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireTenantSelf();

  const detail = await getMyLease(id, tenant.id);
  if (!detail) notFound();

  const { lease, invoices, payments, deposits, contract, stats } = detail;

  return (
    <div className="space-y-5">
      <Link
        href="/portal/lease"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All leases
      </Link>

      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-5 text-white shadow-lg shadow-brand-500/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-white/70">
              <Building2 className="h-3.5 w-3.5" />
              Property
            </div>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight">
              {lease.property_name ?? "-"}
            </h1>
            {lease.unit_number && (
              <p className="mt-0.5 text-sm text-white/85">
                Unit {lease.unit_number}
              </p>
            )}
          </div>
          <span
            className={
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide " +
              (STATUS_TONE[lease.status] ?? "bg-white/25 text-white")
            }
          >
            {STATUS_LABEL[lease.status] ?? lease.status}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-white/15 pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">
              Monthly rent
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatPHP(lease.monthly_rent)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">
              Duration
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {stats.duration_days} days
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Wallet}
          tone="brand"
          label="Outstanding"
          value={formatPHP(stats.outstanding)}
        />
        <StatCard
          icon={Clock}
          tone={stats.days_remaining <= 30 ? "amber" : "emerald"}
          label="Days remaining"
          value={
            stats.days_remaining >= 0 ? String(stats.days_remaining) : "Expired"
          }
        />
        <StatCard
          icon={Calendar}
          tone="emerald"
          label="Rent due"
          value={lease.due_date ? fmtDayOfMonth(lease.due_date) : "-"}
        />
        <StatCard
          icon={FileText}
          tone="brand"
          label="Invoices"
          value={String(invoices.length)}
        />
      </div>

      <Section title="Lease terms">
        <Row label="Start date" value={fmtDate(lease.start_date)} />
        <Row label="End date" value={fmtDate(lease.end_date)} />
        <Row label="Move-in" value={fmtDate(lease.move_in_date)} />
        <Row label="Term" value={fmtTerm(lease.term, lease.term_months)} />
        <Row label="Deposit" value={formatPHP(lease.deposit_amount)} />
        {lease.deposit_1 != null && lease.deposit_1 > 0 && (
          <Row label="1st deposit" value={formatPHP(lease.deposit_1)} />
        )}
        {lease.deposit_2 != null && lease.deposit_2 > 0 && (
          <Row label="2nd deposit" value={formatPHP(lease.deposit_2)} />
        )}
        <Row label="Notice period" value={lease.notice_period_days + " days"} />
        {lease.property_address && (
          <Row label="Address" value={lease.property_address} />
        )}
      </Section>

      {contract && (
        <Section title="Contract">
          <Row
            label="Status"
            value={
              contract.status === "signed"
                ? "Signed " + fmtDate(contract.signed_at)
                : contract.status
            }
          />
          {contract.template_name && (
            <Row label="Template" value={contract.template_name} />
          )}
          {contract.signed_document_url && (
            <a
              href={contract.signed_document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-between rounded-xl bg-brand-500/5 px-3 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
            >
              <span>View signed contract</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          )}
        </Section>
      )}

      <Section title={"Invoices"} count={invoices.length}>
        {invoices.length === 0 ? (
          <p className="text-sm text-ink-500">No invoices yet.</p>
        ) : (
          <div className="-mx-4 divide-y divide-ink-100 dark:divide-white/[0.04]">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    {inv.display_number ?? "Invoice"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Due {fmtDate(inv.due_date)}{" "}
                    <span className="capitalize">&middot; {inv.type}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink-900">
                    {formatPHP(inv.amount)}
                  </p>
                  <span
                    className={
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                      (inv.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : inv.status === "overdue"
                        ? "bg-danger-500/10 text-danger-700 dark:text-danger-500"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-500")
                    }
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Payments" count={payments.length}>
        {payments.length === 0 ? (
          <p className="text-sm text-ink-500">No payments recorded.</p>
        ) : (
          <div className="-mx-4 divide-y divide-ink-100 dark:divide-white/[0.04]">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular-nums text-ink-900">
                    {formatPHP(p.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {fmtDate(p.paid_at)}{" "}
                    <span className="capitalize">&middot; {p.method}</span>
                    {p.receipt_number ? " \u00b7 " + p.receipt_number : ""}
                  </p>
                </div>
                {p.invoice_display && (
                  <p className="shrink-0 text-xs font-medium text-ink-500">
                    {p.invoice_display}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {deposits.length > 0 && (
        <Section title="Deposits">
          <div className="-mx-4 divide-y divide-ink-100 dark:divide-white/[0.04]">
            {deposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium capitalize text-ink-700">
                  {d.status}
                </p>
                <p className="text-sm font-semibold tabular-nums text-ink-900">
                  {formatPHP(d.amount)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <p className="pt-2 text-center text-xs text-ink-400">
        Questions? Message the property office on Facebook Messenger.
      </p>
    </div>
  );
}

const TONE_MAP = {
  brand: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
} as const;

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_MAP;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-3.5 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
      <div className={"flex h-8 w-8 items-center justify-center rounded-lg " + TONE_MAP[tone]}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-900">
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-white/[0.04]">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          {title}
        </p>
        {typeof count === "number" && (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/[0.06]">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-800">{value}</span>
    </div>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDayOfMonth(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
      ? "nd"
      : day === 3 || day === 23
      ? "rd"
      : "th";
  return day + suffix;
}

function fmtTerm(term: string | null, months: number | null): string {
  if (!term) return "-";
  if (term === "other") {
    if (months && months > 0) return months + " month" + (months === 1 ? "" : "s");
    return "Custom";
  }
  return term.replace(/_/g, " ");
}
