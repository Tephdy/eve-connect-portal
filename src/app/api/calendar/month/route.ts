import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hasPermission } from "@/lib/auth/require-permission";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
import { ALL_TYPES, type CalendarEventType } from "@/lib/calendar/types";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await hasPermission("invoice:read");
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const propertyId = url.searchParams.get("property");
  const typesParam = url.searchParams.get("types") ?? "";

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const types: CalendarEventType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as CalendarEventType)) as CalendarEventType[])
    : [];

  try {
    const data = await getCalendarMonth(year, month, {
      property_id: propertyId || null,
      types,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/calendar/month]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
