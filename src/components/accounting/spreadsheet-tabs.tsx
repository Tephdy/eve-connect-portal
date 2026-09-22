"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function SpreadsheetTabs({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("property") ?? properties[0]?.id ?? "";
  const month = sp.get("month") ?? "";

  function hrefFor(id: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("property", id);
    if (month) params.set("month", month);
    return pathname + "?" + params.toString();
  }

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-white/40 pb-2 dark:border-white/[0.06]">
      {properties.map((p) => {
        const isActive = p.id === active;
        return (
          <Link
            key={p.id}
            href={hrefFor(p.id)}
            scroll={false}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-brand-gradient text-white shadow-sm shadow-brand-500/30"
                : "text-ink-600 hover:bg-white/60 dark:hover:bg-white/[0.06]"
            )}
          >
            {p.name}
          </Link>
        );
      })}
    </div>
  );
}
