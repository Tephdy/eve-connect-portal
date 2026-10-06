import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalNotification = {
  id: string;
  kind: "rent_due" | "overdue" | "contract_expiring" | "renewal_notice";
  severity: "info" | "warning" | "danger";
  title: string;
  body: string;
  href: string;
  date: string;
  days_away: number;
};

const RENT_DUE_WARN_DAYS = 7;
const CONTRACT_WARN_DAYS = [60, 30, 7] as const;

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function getMyNotifications(
  tenantId: string
): Promise<PortalNotification[]> {
  const admin = createAdminClient();
  const today = todayUTC();

  const notifications: PortalNotification[] = [];

  const { data: lease } = await admin
    .schema("core")
    .from("lease")
    .select("id, end_date, due_date, notice_period_days, monthly_rent, status")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "expiring"])
    .order("end_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: invoices } = await admin
    .schema("acct")
    .from("invoice")
    .select("id, lease_id, display_number, type, amount, due_date, status")
    .eq("tenant_id", tenantId)
    .in("status", ["unpaid", "overdue"])
    .order("due_date", { ascending: true });

  const invoiceRows = (invoices ?? []) as any[];

  for (const inv of invoiceRows) {
    const dueDate = new Date(inv.due_date + "T00:00:00Z");
    const days = daysBetween(today, dueDate);
    if (days >= 0) continue;

    notifications.push({
      id: "overdue_" + inv.id,
      kind: "overdue",
      severity: "danger",
      title: "Payment overdue",
      body:
        (inv.display_number ?? "Invoice") +
        " was due on " +
        fmtDate(inv.due_date) +
        ". Please settle as soon as possible.",
      href: lease ? "/portal/lease/" + lease.id : "/portal/profile",
      date: inv.due_date,
      days_away: days,
    });
  }

  for (const inv of invoiceRows) {
    if (inv.status !== "unpaid") continue;
    const dueDate = new Date(inv.due_date + "T00:00:00Z");
    const days = daysBetween(today, dueDate);
    if (days < 0 || days > RENT_DUE_WARN_DAYS) continue;

    notifications.push({
      id: "rent_due_" + inv.id,
      kind: "rent_due",
      severity: days <= 2 ? "warning" : "info",
      title:
        days === 0
          ? "Payment due today"
          : "Payment due in " + days + " day" + (days === 1 ? "" : "s"),
      body:
        (inv.display_number ?? "Invoice") +
        " is due on " +
        fmtDate(inv.due_date) +
        ".",
      href: lease ? "/portal/lease/" + lease.id : "/portal/profile",
      date: inv.due_date,
      days_away: days,
    });
  }

  if (lease) {
    const endDate = new Date((lease as any).end_date + "T00:00:00Z");
    const days = daysBetween(endDate, today);

    const matched = CONTRACT_WARN_DAYS.find((t) => days <= t && days >= 0);
    if (matched !== undefined) {
      const severity: PortalNotification["severity"] =
        days <= 7 ? "danger" : days <= 30 ? "warning" : "info";

      notifications.push({
        id: "contract_expiring_" + matched + "_" + (lease as any).id,
        kind: "contract_expiring",
        severity,
        title:
          days === 0
            ? "Lease ends today"
            : "Lease ends in " + days + " day" + (days === 1 ? "" : "s"),
        body:
          "Your contract expires on " +
          fmtDate((lease as any).end_date) +
          ". Contact the office to discuss renewal or move-out.",
        href: "/portal/lease/" + (lease as any).id,
        date: (lease as any).end_date,
        days_away: days,
      });
    }

    const noticeDays = Number((lease as any).notice_period_days ?? 30);
    if (
      days <= noticeDays &&
      days > 0 &&
      !notifications.some((n) => n.kind === "contract_expiring")
    ) {
      notifications.push({
        id: "renewal_notice_" + (lease as any).id,
        kind: "renewal_notice",
        severity: "warning",
        title: "Renewal notice period",
        body:
          "Per your contract, please confirm your renewal or non-renewal " +
          "at least " +
          noticeDays +
          " days before " +
          fmtDate((lease as any).end_date) +
          ".",
        href: "/portal/lease/" + (lease as any).id,
        date: (lease as any).end_date,
        days_away: days,
      });
    }
  }

  const severityRank = { danger: 0, warning: 1, info: 2 } as const;
  notifications.sort((a, b) => {
    const s = severityRank[a.severity] - severityRank[b.severity];
    if (s !== 0) return s;
    return a.days_away - b.days_away;
  });

  return notifications;
}
