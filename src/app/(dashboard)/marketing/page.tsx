import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function MarketingHome() {
  await requirePagePermission("listing:read");
  const stats = await dashboardStats();

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Listings, availability, and inquiries."
        action={
          <div className="flex gap-2">
            <Link href="/marketing/listings/new"><Button>+ New Listing</Button></Link>
            <Link href="/marketing/inquiries/new"><Button variant="secondary">+ New Inquiry</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Total units" value={String(stats.total_units)} tone="text-gray-900" />
        <Stat label="Occupancy" value={stats.occupancy_pct + "%"} tone="text-green-700" />
        <Stat label="Vacant" value={String(stats.vacant)} tone="text-yellow-700" />
        <Stat label="Published listings" value={String(stats.published_listings)} tone="text-brand-600" />
        <Stat label="Open inquiries" value={String(stats.open_inquiries)} tone="text-gray-900" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard href="/marketing/listings" title="Listings" desc="Draft, publish, and manage unit listings." />
        <QuickCard href="/marketing/forecast" title="Availability Forecast" desc="Earliest available date per unit." />
        <QuickCard href="/marketing/inquiries" title="Inquiries" desc="Track prospects and conversions." />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card><CardBody>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={"text-2xl font-semibold mt-1 " + tone}>{value}</p>
    </CardBody></Card>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-brand-500 transition-colors"><CardBody>
        <p className="font-medium text-brand-600">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{desc}</p>
      </CardBody></Card>
    </Link>
  );
}
