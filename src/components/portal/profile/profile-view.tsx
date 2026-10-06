"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PortalProfileHeader } from "./profile-header";
import { PortalOverviewTab } from "./tabs/overview-tab";
import { PortalLeasesTab } from "./tabs/leases-tab";
import { PortalInvoicesTab } from "./tabs/invoices-tab";
import { PortalPaymentsTab } from "./tabs/payments-tab";
import { PortalDepositsTab } from "./tabs/deposits-tab";
import type { TenantProfile } from "@/lib/db/tenant-profile";

type TabKey = "overview" | "leases" | "invoices" | "payments" | "deposits";

export function PortalProfileView({ profile }: { profile: TenantProfile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "leases", label: "Leases", count: profile.leases.length },
    { key: "invoices", label: "Invoices", count: profile.invoices.length },
    { key: "payments", label: "Payments", count: profile.payments.length },
    { key: "deposits", label: "Deposits", count: profile.deposits.length },
  ];

  return (
    <div className="space-y-6">
      <PortalProfileHeader profile={profile} />

      <div>
        <div className="-mx-4 overflow-x-auto border-b border-ink-200 px-4 dark:border-white/[0.06]">
          <div className="flex flex-nowrap gap-1 whitespace-nowrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
        </div>

        <div className="mt-6">
          {tab === "overview" && <PortalOverviewTab profile={profile} />}
          {tab === "leases" && <PortalLeasesTab profile={profile} />}
          {tab === "invoices" && <PortalInvoicesTab profile={profile} />}
          {tab === "payments" && <PortalPaymentsTab profile={profile} />}
          {tab === "deposits" && <PortalDepositsTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
