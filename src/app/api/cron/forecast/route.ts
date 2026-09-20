import { NextResponse } from "next/server";
import { recalculateForecasts } from "@/lib/db/forecast";

export async function GET() {
  const count = await recalculateForecasts();
  return NextResponse.json({ recalculated: count });
}

export async function POST() { return GET(); }
