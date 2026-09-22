"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpreadsheetToolbar({ property_id }: { property_id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);

  function onMonthChange(v: string) {
    const params = new URLSearchParams(sp.toString());
    if (v) params.set("month", v);
    else params.delete("month");
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  const exportHref =
    "/accounting/spreadsheet/export?property=" +
    encodeURIComponent(property_id) +
    "&month=" +
    encodeURIComponent(month);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-semibold text-ink-500">Month</label>
      <input
        type="month"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-100"
      />
      <a href={exportHref} download>
        <Button variant="secondary" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </a>
    </div>
  );
}
