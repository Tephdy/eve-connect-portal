"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";
import { updateLeaseCellAction, type EditableField } from "@/app/(dashboard)/accounting/spreadsheet/actions";
import type { SpreadsheetRow, SpreadsheetResult } from "@/lib/db/spreadsheet";

const EDITABLE = new Set<EditableField>([
  "monthly_rent",
  "deposit_1",
  "deposit_2",
  "start_date",
  "end_date",
]);

type ColumnKey = keyof SpreadsheetRow;

type ColumnDef = {
  key: ColumnKey;
  label: string;
  width: number;
  align?: "right";
  editable?: boolean;
  format: (v: unknown, row: SpreadsheetRow) => string;
  parse?: (s: string) => string;
};

function php(n: number): string {
  return "\u20b1" + Number(n ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

const COLUMNS: ColumnDef[] = [
  { key: "unit_number", label: "Unit", width: 90, format: (v) => (v ? String(v) : "\u2014") },
  { key: "tenant_name", label: "Tenant", width: 200, format: (v) => (v ? String(v) : "\u2014") },
  { key: "lease_status", label: "Status", width: 90, format: (v) => String(v ?? "") },
  { key: "start_date", label: "Start", width: 110, editable: true, format: (v) => shortDate(v as string) },
  { key: "end_date", label: "End", width: 110, editable: true, format: (v) => shortDate(v as string) },
  { key: "monthly_rent", label: "Monthly rent", width: 120, align: "right", editable: true, format: (v) => php(Number(v ?? 0)) },
  { key: "deposit_1", label: "Deposit 1", width: 110, align: "right", editable: true, format: (v) => php(Number(v ?? 0)) },
  { key: "deposit_2", label: "Deposit 2", width: 110, align: "right", editable: true, format: (v) => php(Number(v ?? 0)) },
  { key: "invoiced_month", label: "Invoiced", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "paid_month", label: "Paid", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "balance", label: "Balance", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "last_payment_date", label: "Last payment", width: 130, format: (v) => shortDate(v as string | null) },
  { key: "overdue", label: "Overdue", width: 120, align: "right", format: (v) => php(Number(v ?? 0)) },
  { key: "utility_balance", label: "Utility bal.", width: 130, align: "right", format: (v) => php(Number(v ?? 0)) },
];

const TOTALS_LABELS: Partial<Record<ColumnKey, string>> = {
  monthly_rent: "Monthly rent",
  deposit_1: "Deposit 1",
  deposit_2: "Deposit 2",
  invoiced_month: "Invoiced",
  paid_month: "Paid",
  balance: "Balance",
  overdue: "Overdue",
  utility_balance: "Utility bal.",
};

export function SpreadsheetGrid({
  initial,
  property_id,
}: {
  initial: SpreadsheetResult;
  property_id: string;
}) {
  const [rows, setRows] = useState<SpreadsheetRow[]>(initial.rows);
  const [totals, setTotals] = useState(initial.totals);
  const [editing, setEditing] = useState<{ leaseId: string; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when the server sends fresh data (e.g., after a month/tab change).
  useEffect(() => {
    setRows(initial.rows);
    setTotals(initial.totals);
  }, [initial]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const recomputeTotals = useCallback((rs: SpreadsheetRow[]) => {
    return rs.reduce(
      (acc, r) => ({
        monthly_rent: acc.monthly_rent + r.monthly_rent,
        deposit_1: acc.deposit_1 + r.deposit_1,
        deposit_2: acc.deposit_2 + r.deposit_2,
        invoiced_month: acc.invoiced_month + r.invoiced_month,
        paid_month: acc.paid_month + r.paid_month,
        balance: acc.balance + r.balance,
        overdue: acc.overdue + r.overdue,
        utility_balance: acc.utility_balance + r.utility_balance,
      }),
      {
        monthly_rent: 0,
        deposit_1: 0,
        deposit_2: 0,
        invoiced_month: 0,
        paid_month: 0,
        balance: 0,
        overdue: 0,
        utility_balance: 0,
      }
    );
  }, []);

  function beginEdit(leaseId: string, field: EditableField, currentValue: number | string) {
    setEditing({ leaseId, field });
    setEditValue(String(currentValue ?? ""));
  }

  function commit(leaseId: string, field: EditableField, raw: string) {
    const row = rows.find((r) => r.lease_id === leaseId);
    if (!row) {
      setEditing(null);
      return;
    }

    // Optimistic update
    const prevValue = row[field as keyof SpreadsheetRow];
    let parsed: number | string = raw;
    if (field === "monthly_rent" || field === "deposit_1" || field === "deposit_2") {
      parsed = Number(raw.replace(/[₱,\s]/g, "")) || 0;
    }

    const nextRows = rows.map((r) =>
      r.lease_id === leaseId ? { ...r, [field]: parsed } : r
    );
    setRows(nextRows);
    setTotals(recomputeTotals(nextRows));
    setEditing(null);

    start(async () => {
      const res = await updateLeaseCellAction(leaseId, field, raw);
      if (!res.ok) {
        // Roll back
        const rolled = rows.map((r) =>
          r.lease_id === leaseId ? { ...r, [field]: prevValue } : r
        );
        setRows(rolled);
        setTotals(recomputeTotals(rolled));
        toast.push(res.error, "error");
      } else {
        toast.push("Saved", "success");
      }
    });
  }

  function cancel() {
    setEditing(null);
  }

  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    leaseId: string,
    field: EditableField
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(leaseId, field, editValue);
      // Move down to same column in next row
      const idx = rows.findIndex((r) => r.lease_id === leaseId);
      const next = rows[idx + 1];
      if (next) beginEdit(next.lease_id, field, next[field as keyof SpreadsheetRow] as number | string);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(leaseId, field, editValue);
      // Move right (or left with Shift) to next editable column in same row
      const editableKeys = COLUMNS.filter((c) => c.editable).map((c) => c.key) as EditableField[];
      const ci = editableKeys.indexOf(field);
      const dir = e.shiftKey ? -1 : 1;
      const target = editableKeys[ci + dir];
      if (target) {
        const idx = rows.findIndex((r) => r.lease_id === leaseId);
        const r = rows[idx];
        setTimeout(() => beginEdit(leaseId, target, r[target as keyof SpreadsheetRow] as number | string), 0);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/40 py-16 text-center text-sm text-ink-500 dark:border-white/[0.06] dark:bg-white/[0.02]">
        No active leases in this property.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-white/40 bg-white/40 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.02]">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface-raised/95 backdrop-blur-sm">
          <tr className="border-b border-white/40 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-white/[0.06]">
            {COLUMNS.map((c, i) => (
              <th
                key={c.key}
                style={{
                  minWidth: c.width,
                  position: i < 2 ? "sticky" : undefined,
                  left: i === 0 ? 0 : i === 1 ? 90 : undefined,
                  zIndex: i < 2 ? 11 : 1,
                  background: i < 2 ? "rgb(var(--surface-raised))" : undefined,
                }}
                className={cn(
                  "px-3 py-2 font-semibold",
                  c.align === "right" && "text-right"
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.lease_id}
              className="border-b border-white/30 hover:bg-white/30 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
            >
              {COLUMNS.map((c, i) => {
                const value = r[c.key];
                const isEditing =
                  editing?.leaseId === r.lease_id && editing.field === (c.key as EditableField);

                return (
                  <td
                    key={c.key}
                    style={{
                      position: i < 2 ? "sticky" : undefined,
                      left: i === 0 ? 0 : i === 1 ? 90 : undefined,
                      zIndex: i < 2 ? 2 : 1,
                      background:
                        i < 2
                          ? "rgb(var(--surface-raised) / 0.94)"
                          : undefined,
                    }}
                    className={cn(
                      "px-3 py-2 tabular-nums",
                      c.align === "right" && "text-right",
                      c.editable && !isEditing && "cursor-pointer hover:bg-brand-500/5"
                    )}
                    onClick={() => {
                      if (c.editable && !isEditing) {
                        beginEdit(
                          r.lease_id,
                          c.key as EditableField,
                          value as number | string
                        );
                      }
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type={c.key === "start_date" || c.key === "end_date" ? "date" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commit(r.lease_id, c.key as EditableField, editValue)}
                        onKeyDown={(e) =>
                          onKeyDown(e, r.lease_id, c.key as EditableField)
                        }
                        className="w-full rounded border border-brand-400 bg-white px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-ink-900"
                      />
                    ) : (
                      c.format(value, r)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-surface-raised/95 backdrop-blur-sm">
          <tr className="border-t border-white/40 text-sm font-semibold dark:border-white/[0.06]">
            {COLUMNS.map((c, i) => {
              const label = TOTALS_LABELS[c.key];
              const total = label ? (totals as Record<string, number>)[c.key] : undefined;
              return (
                <td
                  key={c.key}
                  style={{
                    position: i < 2 ? "sticky" : undefined,
                    left: i === 0 ? 0 : i === 1 ? 90 : undefined,
                    zIndex: i < 2 ? 2 : 1,
                    background: i < 2 ? "rgb(var(--surface-raised) / 0.94)" : undefined,
                  }}
                  className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums")}
                >
                  {i === 0 ? "TOTAL" : total !== undefined ? php(total) : ""}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
