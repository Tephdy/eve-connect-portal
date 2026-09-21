"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { UnitProfileHeader } from "./profile-header";
import { UnitOverviewTab } from "./tabs/overview-tab";
import { UnitLeaseHistoryTab } from "./tabs/lease-history-tab";
import { UnitJobOrdersTab } from "./tabs/job-orders-tab";
import { UnitAssetsTab } from "./tabs/assets-tab";
import type { UnitProfile as Profile } from "@/lib/db/unit-profile";

type TabKey = "overview" | "archive" | "jobs" | "assets";

export function UnitProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "archive", label: "Rental archive", count: profile.leases.length },
    { key: "jobs", label: "Job orders", count: profile.jobOrders.length },
    { key: "assets", label: "Assets", count: profile.assets.length },
  ];

  return (
    <div className="space-y-6">
      <UnitProfileHeader profile={profile} />
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
          {tab === "overview" && <UnitOverviewTab profile={profile} />}
          {tab === "archive" && <UnitLeaseHistoryTab profile={profile} />}
          {tab === "jobs" && <UnitJobOrdersTab profile={profile} />}
          {tab === "assets" && <UnitAssetsTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
