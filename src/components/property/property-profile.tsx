"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PropertyProfileHeader } from "./profile-header";
import { PropertyOverviewTab } from "./tabs/overview-tab";
import { PropertyUnitsTab } from "./tabs/units-tab";
import { PropertyLeasesTab } from "./tabs/leases-tab";
import { PropertyActivityTab } from "./tabs/activity-tab";
import type { PropertyProfile as Profile } from "@/lib/db/property-profile";

type TabKey = "overview" | "units" | "leases" | "activity";

export function PropertyProfileView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "units", label: "Units", count: profile.units.length },
    { key: "leases", label: "Leases", count: profile.leases.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <PropertyProfileHeader profile={profile} />
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
          {tab === "overview" && <PropertyOverviewTab profile={profile} />}
          {tab === "units" && <PropertyUnitsTab profile={profile} />}
          {tab === "leases" && <PropertyLeasesTab profile={profile} />}
          {tab === "activity" && <PropertyActivityTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
