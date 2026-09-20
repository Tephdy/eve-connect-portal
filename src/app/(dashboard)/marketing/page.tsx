import Link from "next/link";
import { Megaphone, ListChecks, MessageSquare, ArrowRight, TrendingUp } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/db/inquiries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function MarketingHome() {
  await requirePagePermission("listing:read");
  const stats = await dashboardStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Listings, availability, and inquiries."
        action={
          <div className="flex gap-2">
            <Link href="/marketing/listings/new">
              <Button>+ New Listing</Button>
            </Link>
            <Link href="/marketing/inquiries/new">
              <Button variant="secondary">+ New Inquiry</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total units"
          value={stats.total_units}
          accent="brand"
          deltaLabel={stats.occupied + " occupied"}
        />
        <StatCard
          label="Occupancy"
          value={stats.occupancy_pct + "%"}
          accent="green"
          delta={stats.occupancy_pct >= 80 ? 5.2 : -2.1}
          deltaLabel={stats.vacant + " vacant"}
        />
        <StatCard
          label="Published listings"
          value={stats.published_listings}
          accent="purple"
        />
        <StatCard
          label="Open inquiries"
          value={stats.open_inquiries}
          accent="yellow"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickCard
          href="/marketing/listings"
          icon={Megaphone}
          title="Listings"
          description="Draft, publish, and manage unit listings."
        />
        <QuickCard
          href="/marketing/forecast"
          icon={ListChecks}
          title="Availability Forecast"
          description="Earliest available date per unit."
        />
        <QuickCard
          href="/marketing/inquiries"
          icon={MessageSquare}
          title="Inquiries"
          description="Track prospects and conversions."
        />
      </div>
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group">
      <Card interactive className="h-full">
        <CardBody className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:text-brand-400">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold text-ink-900">
              {title}
              <ArrowRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
