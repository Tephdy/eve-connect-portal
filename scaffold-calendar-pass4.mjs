#!/usr/bin/env node
/**
 * Calendar Phase 4 — Email reminders + export
 * Usage: node scaffold-calendar-pass4.mjs
 *
 * Creates:
 *   src/lib/calendar/email-reminders.ts
 *   src/lib/calendar/csv-export.ts
 *   src/lib/db/reminder-prefs.ts
 *   src/app/api/cron/reminders/route.ts
 *   src/app/api/calendar/export/route.ts
 *   src/app/(dashboard)/settings/notifications/page.tsx
 *   src/app/(dashboard)/settings/notifications/actions.ts
 *   src/components/calendar/export-menu.tsx
 *   src/components/calendar/print-button.tsx
 *   src/components/settings/reminder-prefs-form.tsx
 *
 * Updates:
 *   src/lib/email/templates.ts                 (add reminder templates)
 *   src/components/calendar/calendar-shell.tsx (add export + print buttons)
 *   src/components/shell/sidebar.tsx           (add Settings link)
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const FILES = {};

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// =============================================================================
// 1. Reminder preferences DB
// =============================================================================
FILES["src/lib/db/reminder-prefs.ts"] =
`import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReminderPrefs = {
  user_id: string;
  email_enabled: boolean;
  invoice_overdue: boolean;
  lease_expiring: boolean;
  rent_due_soon: boolean;
  days_before: number;
};

export async function getPrefs(user_id: string): Promise<ReminderPrefs> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminder_pref")
    .select("user_id, email_enabled, invoice_overdue, lease_expiring, rent_due_soon, days_before")
    .eq("user_id", user_id)
    .maybeSingle();

  if (data) return data as ReminderPrefs;

  // Defaults when no row exists
  return {
    user_id,
    email_enabled: true,
    invoice_overdue: true,
    lease_expiring: true,
    rent_due_soon: true,
    days_before: 3,
  };
}

export async function savePrefs(input: Partial<ReminderPrefs> & { user_id: string }) {
  const admin = createAdminClient();
  const { error } = await admin.from("reminder_pref").upsert(
    {
      ...input,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function listSubscribers(): Promise<ReminderPrefs[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reminder_pref")
    .select("user_id, email_enabled, invoice_overdue, lease_expiring, rent_due_soon, days_before")
    .eq("email_enabled", true);
  return (data ?? []) as ReminderPrefs[];
}
`;

// =============================================================================
// 2. Email templates
// =============================================================================
FILES["src/lib/email/templates.ts"] =
`import "server-only";

export function receiptEmailHtml(input: {
  tenant_name: string;
  receipt_number: string;
  invoice_number: string | null;
  amount: string;
  method: string;
  paid_at: string;
  property_name: string;
  unit_number: string;
}): string {
  return \`<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="color: #2b5797;">Payment Receipt</h2>
  <p>Hi \${input.tenant_name},</p>
  <p>Thank you for your payment. Details below:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 6px 0; color: #666;">Receipt No.</td><td style="text-align: right;"><strong>\${input.receipt_number}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Invoice No.</td><td style="text-align: right;">\${input.invoice_number ?? "—"}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Property</td><td style="text-align: right;">\${input.property_name}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Unit</td><td style="text-align: right;">\${input.unit_number}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Method</td><td style="text-align: right;">\${input.method}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="text-align: right;">\${input.paid_at}</td></tr>
    <tr style="border-top: 2px solid #2b5797;"><td style="padding: 12px 0; font-weight: 600;">Amount paid</td><td style="padding: 12px 0; text-align: right; font-weight: 700; color: #1e7a3a;">\${input.amount}</td></tr>
  </table>
  <p style="color: #666; font-size: 13px;">This is an automated receipt. Please keep it for your records.</p>
</body>
</html>\`;
}

export function reminderEmailHtml(input: {
  recipient_name: string;
  title: string;
  items: { label: string; value: string; href?: string }[];
  cta_label?: string;
  cta_href?: string;
  severity?: "info" | "warning" | "danger";
}): string {
  const color =
    input.severity === "danger"
      ? "#b91c1c"
      : input.severity === "warning"
      ? "#b45309"
      : "#1d4ed8";
  const bg =
    input.severity === "danger"
      ? "#fef2f2"
      : input.severity === "warning"
      ? "#fffbeb"
      : "#eff6ff";

  const rows = input.items
    .map(
      (it) => \`<tr>
      <td style="padding: 8px 0; color: #666; vertical-align: top;">\${it.label}</td>
      <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #111;">
        \${it.href ? \`<a href="\${it.href}" style="color: \${color}; text-decoration: none;">\${it.value}</a>\` : it.value}
      </td>
    </tr>\`
    )
    .join("");

  return \`<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <div style="padding: 16px 20px; background: \${bg}; border-left: 4px solid \${color}; border-radius: 6px; margin-bottom: 24px;">
    <h2 style="margin: 0; color: \${color}; font-size: 18px;">\${input.title}</h2>
  </div>

  <p>Hi \${input.recipient_name},</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    \${rows}
  </table>

  \${
    input.cta_label && input.cta_href
      ? \`<a href="\${input.cta_href}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: \${color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">\${input.cta_label}</a>\`
      : ""
  }

  <p style="color: #999; font-size: 12px; margin-top: 32px;">
    You're receiving this because you have an account on the Apartment Portal.<br/>
    Manage your notification preferences in Settings.
  </p>
</body>
</html>\`;
}
`;

// =============================================================================
// 3. Email reminder engine
// =============================================================================
FILES["src/lib/calendar/email-reminders.ts"] =
`import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { reminderEmailHtml } from "@/lib/email/templates";
import { listSubscribers } from "@/lib/db/reminder-prefs";
import { formatPHP } from "@/lib/utils/format-php";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

type ReminderPayload = {
  key: string;
  type: "invoice_overdue" | "lease_expiring" | "rent_due_soon";
  title: string;
  severity: "info" | "warning" | "danger";
  items: { label: string; value: string; href?: string }[];
  cta_href: string;
};

/**
 * Build the reminder payloads for the current run.
 */
async function buildReminders(): Promise<ReminderPayload[]> {
  const admin = createAdminClient();
  const today = new Date();
  const todayStr = ymd(today);
  const in30 = ymd(new Date(today.getTime() + 30 * 86400000));
  const in3 = ymd(new Date(today.getTime() + 3 * 86400000));

  const reminders: ReminderPayload[] = [];

  // ---- Overdue invoices ----
  const { data: overdue } = await admin
    .from("invoice")
    .select("id, display_number, amount, due_date, lease_id, status")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })
    .limit(50);

  const overdueGroups = new Map<string, any[]>();
  for (const inv of overdue ?? []) {
    const days = Math.ceil(
      (today.getTime() - new Date(inv.due_date).getTime()) / 86400000
    );
    const key = "invoice_overdue:" + inv.id;
    reminders.push({
      key,
      type: "invoice_overdue",
      title: "Overdue invoices need attention",
      severity: days > 30 ? "danger" : "warning",
      items: [
        {
          label: inv.display_number ?? "Invoice",
          value: formatPHP(inv.amount) + " · " + days + "d late",
          href: APP_URL + "/accounting/invoices/" + inv.id,
        },
      ],
      cta_href: APP_URL + "/accounting/invoices?filter=overdue",
    });
  }

  // ---- Leases expiring ----
  const { data: expiring } = await admin
    .from("lease")
    .select("id, end_date, tenant_name, unit_number")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", in30)
    .order("end_date", { ascending: true })
    .limit(50);

  for (const l of expiring ?? []) {
    const days = Math.ceil(
      (new Date(l.end_date).getTime() - today.getTime()) / 86400000
    );
    reminders.push({
      key: "lease_expiring:" + l.id,
      type: "lease_expiring",
      title: "Lease expiring soon",
      severity: days <= 7 ? "danger" : "warning",
      items: [
        {
          label: l.tenant_name ?? "Tenant",
          value:
            "Unit " + (l.unit_number ?? "—") + " · " + days + "d left",
          href: APP_URL + "/property/leases/" + l.id,
        },
      ],
      cta_href: APP_URL + "/property/leases",
    });
  }

  // ---- Rent dues in the next N days ----
  const { data: activeLeases } = await admin
    .from("lease")
    .select("id, due_date, monthly_rent, tenant_name, unit_number, start_date, end_date")
    .in("status", ["active", "expiring"]);

  for (const l of activeLeases ?? []) {
    if (!l.due_date) continue;
    const dueDay = Number(l.due_date.slice(8, 10));
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(dueDay, lastDay);
    let dueDate = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (dueDate < today) {
      const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nmLast = new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate();
      dueDate = new Date(nm.getFullYear(), nm.getMonth(), Math.min(dueDay, nmLast));
    }
    if (dueDate < new Date(l.start_date) || dueDate > new Date(l.end_date)) continue;

    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > 3) continue;

    reminders.push({
      key: "rent_due_soon:" + l.id + ":" + ymd(dueDate),
      type: "rent_due_soon",
      title: "Rent due soon",
      severity: daysUntil <= 1 ? "warning" : "info",
      items: [
        {
          label: l.tenant_name ?? "Tenant",
          value:
            "Unit " + (l.unit_number ?? "—") + " · " +
            (daysUntil === 0 ? "Due today" : daysUntil === 1 ? "Tomorrow" : daysUntil + "d") +
            " · " + formatPHP(l.monthly_rent),
          href: APP_URL + "/property/leases/" + l.id,
        },
      ],
      cta_href: APP_URL + "/property/leases",
    });
  }

  return reminders;
}

/**
 * Send all pending reminders to all opted-in users.
 * Idempotent — checks reminder_log before sending.
 */
export async function sendReminders(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const subscribers = await listSubscribers();
  if (subscribers.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  // Fetch user emails
  const userIds = subscribers.map((s) => s.user_id);
  const { data: users } = await admin
    .from("app_user")
    .select("id, email, full_name")
    .in("id", userIds);

  const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));

  const reminders = await buildReminders();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Group reminders by type for one email per type per user
  const byType = new Map<string, ReminderPayload[]>();
  for (const r of reminders) {
    const list = byType.get(r.type) ?? [];
    list.push(r);
    byType.set(r.type, list);
  }

  for (const sub of subscribers) {
    const user = userMap.get(sub.user_id);
    if (!user?.email) continue;

    // For each reminder type the user wants
    for (const [type, list] of byType.entries()) {
      if (type === "invoice_overdue" && !sub.invoice_overdue) continue;
      if (type === "lease_expiring" && !sub.lease_expiring) continue;
      if (type === "rent_due_soon" && !sub.rent_due_soon) continue;

      if (list.length === 0) continue;

      // Group into a single email per type per user
      const groupKey = type + ":" + ymd(new Date());
      const { data: already } = await admin
        .from("reminder_log")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("reminder_key", groupKey)
        .maybeSingle();

      if (already) {
        skipped++;
        continue;
      }

      // Build email
      const title =
        type === "invoice_overdue"
          ? list.length + " overdue invoice" + (list.length === 1 ? "" : "s")
          : type === "lease_expiring"
          ? list.length + " lease" + (list.length === 1 ? "" : "s") + " expiring"
          : list.length + " rent payment" + (list.length === 1 ? "" : "s") + " due soon";

      const items = list.slice(0, 10).flatMap((r) => r.items);

      const html = reminderEmailHtml({
        recipient_name: user.full_name || user.email.split("@")[0],
        title,
        items,
        cta_label: "View in portal",
        cta_href: list[0].cta_href,
        severity: list[0].severity,
      });

      const subject =
        type === "invoice_overdue"
          ? "⚠️ " + title
          : type === "lease_expiring"
          ? "📋 " + title
          : "📅 " + title;

      const ok = await sendEmail({
        to: user.email,
        subject,
        html,
      });

      if (ok) {
        await admin.from("reminder_log").insert({
          user_id: sub.user_id,
          reminder_key: groupKey,
          channel: "email",
        });
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, skipped, failed };
}
`;

// =============================================================================
// 4. CSV export
// =============================================================================
FILES["src/lib/calendar/csv-export.ts"] =
`import "server-only";
import { getCalendarMonth } from "./aggregate";
import { TYPE_LABELS, type CalendarEvent } from "./types";

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\\n")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function formatAmount(n?: number): string {
  if (n == null) return "";
  return n.toFixed(2);
}

export async function exportMonthCsv(
  year: number,
  month: number
): Promise<string> {
  const data = await getCalendarMonth(year, month, { types: [] });

  const rows: string[] = [];
  rows.push(
    ["Date", "Type", "Title", "Tenant/Unit", "Property", "Amount", "Status", "Link"]
      .map(escapeCsv)
      .join(",")
  );

  const dates = Object.keys(data.eventsByDate).sort();
  for (const date of dates) {
    for (const evt of data.eventsByDate[date]) {
      rows.push(
        [
          evt.date,
          TYPE_LABELS[evt.type] ?? evt.type,
          evt.title,
          evt.subtitle ?? "",
          evt.property_name ?? "",
          formatAmount(evt.amount),
          evt.status ?? "",
          evt.href ? (process.env.NEXT_PUBLIC_APP_URL ?? "") + evt.href : "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    }
  }

  return rows.join("\\n");
}
`;

// =============================================================================
// 5. Cron endpoint
// =============================================================================
FILES["src/app/api/cron/reminders/route.ts"] =
`import { NextResponse, type NextRequest } from "next/server";
import { sendReminders } from "@/lib/calendar/email-reminders";

export async function GET(request: NextRequest) {
  // Optional auth via CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== "Bearer " + secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendReminders();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/reminders]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
`;

// =============================================================================
// 6. CSV export API route
// =============================================================================
FILES["src/app/api/calendar/export/route.ts"] =
`import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { exportMonthCsv } from "@/lib/calendar/csv-export";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await hasPermission("invoice:read");
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  try {
    const csv = await exportMonthCsv(year, month);
    const filename = "calendar-" + year + "-" + String(month).padStart(2, "0") + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (err) {
    console.error("[api/calendar/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
`;

// =============================================================================
// 7. Export menu component
// =============================================================================
FILES["src/components/calendar/export-menu.tsx"] =
`"use client";

import { useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportMenu({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);

  function downloadCsv() {
    const url = "/api/calendar/export?year=" + year + "&month=" + month;
    window.location.href = url;
    setOpen(false);
  }

  function printCalendar() {
    setOpen(false);
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-ink-200 bg-surface p-1 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
            <button
              onClick={downloadCsv}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download CSV
            </button>
            <button
              onClick={printCalendar}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
`;

// =============================================================================
// 8. Settings — notification preferences
// =============================================================================
FILES["src/app/(dashboard)/settings/notifications/actions.ts"] =
`"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/get-session";
import { savePrefs } from "@/lib/db/reminder-prefs";
import { logAudit } from "@/lib/audit/log";

export async function saveReminderPrefsAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const prefs = {
    user_id: session.id,
    email_enabled: formData.get("email_enabled") === "on",
    invoice_overdue: formData.get("invoice_overdue") === "on",
    lease_expiring: formData.get("lease_expiring") === "on",
    rent_due_soon: formData.get("rent_due_soon") === "on",
    days_before: Number(formData.get("days_before") ?? 3),
  };

  await savePrefs(prefs);
  await logAudit({
    actor_id: session.id,
    entity_type: "reminder_pref",
    entity_id: session.id,
    action: "update",
    after: prefs,
  });

  revalidatePath("/settings/notifications");
}
`;

FILES["src/components/settings/reminder-prefs-form.tsx"] =
`"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { saveReminderPrefsAction } from "@/app/(dashboard)/settings/notifications/actions";
import type { ReminderPrefs } from "@/lib/db/reminder-prefs";

export function ReminderPrefsForm({ prefs }: { prefs: ReminderPrefs }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [emailEnabled, setEmailEnabled] = useState(prefs.email_enabled);

  function onSubmit(formData: FormData) {
    start(async () => {
      try {
        await saveReminderPrefsAction(formData);
        toast.push("Preferences saved", "success");
      } catch (err) {
        toast.push(err instanceof Error ? err.message : "Failed", "error");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <Card>
        <CardHeader
          title="Email reminders"
          description="Get notified about dues, expirations, and overdue items."
        />
        <CardBody className="space-y-4">
          <Toggle
            name="email_enabled"
            label="Enable email reminders"
            description="Master switch for all reminder emails"
            defaultChecked={prefs.email_enabled}
            onChange={setEmailEnabled}
          />
        </CardBody>
      </Card>

      <Card className={emailEnabled ? "" : "opacity-50 pointer-events-none"}>
        <CardHeader title="What to notify me about" />
        <CardBody className="space-y-4">
          <Toggle
            name="invoice_overdue"
            label="Overdue invoices"
            description="When invoices go past their due date"
            defaultChecked={prefs.invoice_overdue}
          />
          <Toggle
            name="lease_expiring"
            label="Leases expiring soon"
            description="When leases are within 30 days of ending"
            defaultChecked={prefs.lease_expiring}
          />
          <Toggle
            name="rent_due_soon"
            label="Rent due soon"
            description="3 days before each rent due date"
            defaultChecked={prefs.rent_due_soon}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">
              Days before due date
            </label>
            <select
              name="days_before"
              defaultValue={prefs.days_before}
              className="h-9 w-full max-w-xs rounded-md border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/[0.06]"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
      />
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className="text-xs text-ink-500">{description}</p>
      </div>
    </label>
  );
}
`;

FILES["src/app/(dashboard)/settings/notifications/page.tsx"] =
`import { requirePagePermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { getPrefs } from "@/lib/db/reminder-prefs";
import { PageHeader } from "@/components/layout/page-header";
import { ReminderPrefsForm } from "@/components/settings/reminder-prefs-form";

export default async function NotificationSettingsPage() {
  await requirePagePermission("invoice:read");
  const session = await getSession();
  if (!session) return null;

  const prefs = await getPrefs(session.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification settings"
        description="Choose what emails you receive."
      />
      <ReminderPrefsForm prefs={prefs} />
    </div>
  );
}
`;

// =============================================================================
// 9. Update calendar shell — add export menu to toolbar
// =============================================================================
FILES["src/components/calendar/calendar-shell.tsx"] = `"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, List, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "./month-grid";
import { ListView } from "./list-view";
import { DayPanel } from "./day-panel";
import { EventPreview } from "./event-preview";
import { Legend } from "./legend";
import { CalendarFilters } from "./calendar-filters";
import { ExpiringBanner } from "./expiring-banner";
import { ExportMenu } from "./export-menu";
import {
  ALL_TYPES,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonth,
} from "@/lib/calendar/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarShell({
  initial,
  properties,
  expiringCount,
  expiringDays,
  expiringHref,
}: {
  initial: CalendarMonth;
  properties: { id: string; name: string }[];
  expiringCount: number;
  expiringDays: number;
  expiringHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [month, setMonth] = useState<CalendarMonth>(initial);
  const [view, setView] = useState<"month" | "list">(
    (searchParams.get("view") as "month" | "list") ?? "month"
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<CalendarEvent | null>(null);
  const [pending, setPending] = useState(false);

  const selectedProperty = searchParams.get("property");
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  function updateQuery(next: {
    property?: string | null;
    types?: CalendarEventType[];
    view?: "month" | "list";
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.property !== undefined) {
      if (next.property) params.set("property", next.property);
      else params.delete("property");
    }
    if (next.types !== undefined) {
      if (next.types.length > 0) params.set("types", next.types.join(","));
      else params.delete("types");
    }
    if (next.view !== undefined) params.set("view", next.view);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    setPending(true);

    const params = new URLSearchParams();
    params.set("year", String(month.year));
    params.set("month", String(month.month));
    if (selectedProperty) params.set("property", selectedProperty);
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));

    fetch("/api/calendar/month?" + params.toString(), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setMonth(data);
          setSelectedDate(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, typesParam, month.year, month.month]);

  async function goToMonth(year: number, m: number) {
    setPending(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(m));
      if (selectedProperty) params.set("property", selectedProperty);
      if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));

      const res = await fetch("/api/calendar/month?" + params.toString(), {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as CalendarMonth;
        setMonth(data);
        setSelectedDate(null);
      }
    } finally {
      setPending(false);
    }
  }

  function prevMonth() {
    const m = month.month === 1 ? 12 : month.month - 1;
    const y = month.month === 1 ? month.year - 1 : month.year;
    goToMonth(y, m);
  }

  function nextMonth() {
    const m = month.month === 12 ? 1 : month.month + 1;
    const y = month.month === 12 ? month.year + 1 : month.year;
    goToMonth(y, m);
  }

  function today() {
    const now = new Date();
    goToMonth(now.getFullYear(), now.getMonth() + 1);
  }

  const selectedEvents = selectedDate ? month.eventsByDate[selectedDate] ?? [] : [];

  return (
    <div className="space-y-4 no-print-wrapper">
      <ExpiringBanner count={expiringCount} days={expiringDays} href={expiringHref} />

      <CalendarFilters
        properties={properties}
        selectedProperty={selectedProperty}
        onPropertyChange={(id) => updateQuery({ property: id })}
        selectedTypes={selectedTypes}
        onTypesChange={(t) => updateQuery({ types: t })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={prevMonth} disabled={pending}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[180px] text-lg font-semibold tracking-tight text-ink-900">
            {MONTH_NAMES[month.month - 1]} {month.year}
          </h2>
          <Button variant="secondary" size="icon" onClick={nextMonth} disabled={pending}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={today} disabled={pending}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-white/[0.06]">
            <button
              onClick={() => { setView("month"); updateQuery({ view: "month" }); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "month" ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Month
            </button>
            <button
              onClick={() => { setView("list"); updateQuery({ view: "list" }); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "list" ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-ink-100 dark:hover:bg-white/[0.05]"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          <ExportMenu year={month.year} month={month.month} />
        </div>
      </div>

      <Legend />

      {view === "month" ? (
        <MonthGrid
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreview={setPreview}
        />
      ) : (
        <ListView month={month} />
      )}

      <DayPanel
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
        onPreview={setPreview}
      />

      <EventPreview event={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
`;

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function main() {
  const pkg = join(ROOT, "package.json");
  if (!(await exists(pkg))) {
    console.error("package.json not found. Run from project root.");
    process.exit(1);
  }

  console.log("Calendar Phase 4 — Reminders + Export\n");

  let count = 0;
  for (const [relPath, content] of Object.entries(FILES)) {
    const full = join(ROOT, relPath);
    const exists_ = await exists(full);
    console.log((exists_ ? "  ~ " : "  + ") + relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    count++;
  }

  console.log("\nDone — " + count + " file(s) written.\n");
  console.log("Next:");
  console.log("  1. Run the 028_reminders.sql migration in Supabase");
  console.log("  2. npm run typecheck");
  console.log("  3. npm run dev");
  console.log("\nTest:");
  console.log("  - Visit /settings/notifications to set preferences");
  console.log("  - Visit /accounting/calendar → Export → Download CSV");
  console.log("  - Trigger reminders manually: curl http://localhost:3000/api/cron/reminders");
  console.log("\nSchedule in vercel.json:");
  console.log('  { "path": "/api/cron/reminders", "schedule": "0 1 * * *" }');
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});