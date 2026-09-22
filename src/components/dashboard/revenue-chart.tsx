"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RevenueDatum = {
  month: string;
  label: string;
  collected: number;
  invoiced: number;
};

export function RevenueChart({
  data,
  height = 280,
}: {
  data: RevenueDatum[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-ink-500">
        No data yet.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-collected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b6fff" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b6fff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-invoiced" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-ink-200/50 dark:text-white/[0.06]"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-ink-500"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-ink-500"
            tickFormatter={(v: number) =>
              v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)
            }
          />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.15 }}
            contentStyle={{
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 14,
              fontSize: 12,
              boxShadow: "0 8px 32px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
            labelStyle={{ color: "#0f172a", fontWeight: 700 }}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value ?? 0);
              const label = name === "collected" ? "Collected" : "Invoiced";
              return ["₱" + num.toLocaleString("en-PH"), label];
            }}
          />
          <Area
            type="monotone"
            dataKey="invoiced"
            stroke="#22d3ee"
            strokeWidth={2.5}
            fill="url(#grad-invoiced)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="#3b6fff"
            strokeWidth={2.5}
            fill="url(#grad-collected)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
