import { NextResponse } from "next/server";
import { dispatchPending } from "@/lib/events/dispatcher";

// Call this route to process pending domain events.
// In production, wire it to a Vercel Cron every minute.
export async function POST() {
  const processed = await dispatchPending(50);
  return NextResponse.json({ processed });
}

export async function GET() {
  const processed = await dispatchPending(50);
  return NextResponse.json({ processed });
}
