"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function UtilityTypeTabs({ value }: { value: "water" | "electricity" }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const set = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("type", v);
    router.push(path + "?" + next.toString());
  };

  return (
    <div className="inline-flex rounded-md border border-line-200 p-0.5">
      {["water", "electricity"].map((t) => (
        <button
          key={t}
          onClick={() => set(t)}
          className={
            "rounded px-3 py-1 text-sm capitalize " +
            (value === t
              ? "bg-brand-600 text-white"
              : "text-ink-600 hover:bg-surface-100")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}
