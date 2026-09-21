import "server-only";
import { getCalendarMonth } from "./aggregate";
import { TYPE_LABELS, type CalendarEvent } from "./types";

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function formatAmount(n?: number): string {
  if (n == null) return "";
  return n.toFixed(2);
}

export async function exportMonthCsv(
  year: number,
  month: number
): Promise<string> {
  const data = await getCalendarMonth(year, month, { types: [] });

  const rows: string[] = [];
  rows.push(
    ["Date", "Type", "Title", "Tenant/Unit", "Property", "Amount", "Status", "Link"]
      .map(escapeCsv)
      .join(",")
  );

  const dates = Object.keys(data.eventsByDate).sort();
  for (const date of dates) {
    for (const evt of data.eventsByDate[date]) {
      rows.push(
        [
          evt.date,
          TYPE_LABELS[evt.type] ?? evt.type,
          evt.title,
          evt.subtitle ?? "",
          evt.property_name ?? "",
          formatAmount(evt.amount),
          evt.status ?? "",
          evt.href ? (process.env.NEXT_PUBLIC_APP_URL ?? "") + evt.href : "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    }
  }

  return rows.join("\n");
}
