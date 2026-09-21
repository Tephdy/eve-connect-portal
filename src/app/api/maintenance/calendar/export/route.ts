import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { exportJobMonthCsv } from "@/lib/maintenance/calendar-aggregate";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await hasPermission("joborder:read");
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  try {
    const csv = await exportJobMonthCsv(year, month);
    const filename = "job-orders-" + year + "-" + String(month).padStart(2, "0") + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (err) {
    console.error("[api/maintenance/calendar/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
