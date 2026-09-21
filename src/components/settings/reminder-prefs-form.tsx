"use client";

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
