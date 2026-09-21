"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { LeaseProfileHeader } from "./profile-header";
import { LeaseOverviewTab } from "./tabs/overview-tab";
import { LeaseInvoicesTab } from "./tabs/invoices-tab";
import { LeasePaymentsTab } from "./tabs/payments-tab";
import { LeaseDepositsTab } from "./tabs/deposits-tab";
import { LeaseActivityTab } from "./tabs/activity-tab";
import type { LeaseProfile as Profile } from "@/lib/db/lease-profile";

type TabKey = "overview" | "invoices" | "payments" | "deposits" | "activity";

export function LeaseProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "invoices", label: "Invoices", count: profile.invoices.length },
    { key: "payments", label: "Payments", count: profile.payments.length },
    { key: "deposits", label: "Deposits", count: profile.deposits.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <LeaseProfileHeader profile={profile} />
      <div>
        <div className="flex flex-wrap gap-1 border-b border-ink-200 dark:border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/[0.06]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "overview" && <LeaseOverviewTab profile={profile} />}
          {tab === "invoices" && <LeaseInvoicesTab profile={profile} />}
          {tab === "payments" && <LeasePaymentsTab profile={profile} />}
          {tab === "deposits" && <LeaseDepositsTab profile={profile} />}
          {tab === "activity" && <LeaseActivityTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
