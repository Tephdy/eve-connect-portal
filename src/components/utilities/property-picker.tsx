"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function PropertyPicker({
  properties,
  value,
}: {
  properties: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  return (
    <select
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        next.set("property", e.target.value);
        router.push(path + "?" + next.toString());
      }}
      className="rounded border border-line-300 px-2 py-1 text-sm"
    >
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
