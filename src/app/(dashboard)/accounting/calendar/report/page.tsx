import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { getCalendarMonth } from "@/lib/calendar/aggregate";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MonthReport } from "@/components/calendar/month-report";
import { PrintButton } from "@/components/accounting/print-button";

export default async function CalendarReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; property?: string }>;
}) {
  await requirePagePermission("invoice:read");
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1);
  const propertyId = sp.property ?? null;

  const supabase = await createClient();

  const [data, property] = await Promise.all([
    getCalendarMonth(year, month, {
      property_id: propertyId,
      types: [],
    }),
    propertyId
      ? supabase.from("property").select("name").eq("id", propertyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link
          href="/accounting/calendar"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to calendar
        </Link>
        <PageHeader
          title="Monthly report"
          description="Printable summary of calendar events"
          action={<PrintButton />}
        />
      </div>

      <MonthReport
        month={data}
        propertyName={property.data?.name ?? undefined}
      />
    </div>
  );
}
