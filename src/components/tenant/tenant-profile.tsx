"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ProfileHeader } from "./profile-header";
import { OverviewTab } from "./tabs/overview-tab";
import { LeasesTab } from "./tabs/leases-tab";
import { InvoicesTab } from "./tabs/invoices-tab";
import { PaymentsTab } from "./tabs/payments-tab";
import { DepositsTab } from "./tabs/deposits-tab";
import { LedgerTab } from "./tabs/ledger-tab";
import { ActivityTab } from "./tabs/activity-tab";
import type { TenantProfile as Profile } from "@/lib/db/tenant-profile";

type TabKey = "overview" | "leases" | "invoices" | "payments" | "deposits" | "ledger" | "activity";

export function TenantProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "leases", label: "Leases", count: profile.leases.length },
    { key: "invoices", label: "Invoices", count: profile.invoices.length },
    { key: "payments", label: "Payments", count: profile.payments.length },
    { key: "deposits", label: "Deposits", count: profile.deposits.length },
    { key: "ledger", label: "Ledger", count: profile.ledger.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} />

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
          {tab === "overview" && <OverviewTab profile={profile} />}
          {tab === "leases" && <LeasesTab profile={profile} />}
          {tab === "invoices" && <InvoicesTab profile={profile} />}
          {tab === "payments" && <PaymentsTab profile={profile} />}
          {tab === "deposits" && <DepositsTab profile={profile} />}
          {tab === "ledger" && <LedgerTab profile={profile} />}
          {tab === "activity" && <ActivityTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
