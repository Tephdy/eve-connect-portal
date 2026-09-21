import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { getJobCalendarMonth } from "@/lib/maintenance/calendar-aggregate";
import { ALL_JOB_PRIORITIES, ALL_JOB_STATUSES } from "@/lib/maintenance/calendar-types";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await hasPermission("joborder:read");
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const propertyId = url.searchParams.get("property");
  const statusesParam = url.searchParams.get("statuses") ?? "";
  const prioritiesParam = url.searchParams.get("priorities") ?? "";

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const statuses = statusesParam
    ? statusesParam.split(",").filter((s) => ALL_JOB_STATUSES.includes(s))
    : [];
  const priorities = prioritiesParam
    ? prioritiesParam.split(",").filter((p) => ALL_JOB_PRIORITIES.includes(p))
    : [];

  try {
    const data = await getJobCalendarMonth(year, month, {
      property_id: propertyId || null,
      statuses,
      priorities,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/maintenance/calendar/month]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
