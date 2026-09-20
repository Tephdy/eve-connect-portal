import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listListings } from "@/lib/db/listings";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ListingTable } from "@/components/marketing/listing-table";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePagePermission("listing:read");
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "draft" | "published" | "unlisted") ?? "all";
  const listings = await listListings(filter);

  const all = await listListings("all");
  const published = all.filter((l) => l.status === "published").length;
  const draft = all.filter((l) => l.status === "draft").length;
  const unlisted = all.filter((l) => l.status === "unlisted").length;

  const tabs = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Draft" },
    { key: "unlisted", label: "Unlisted" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Unit listings across the portfolio."
        action={
          <Link href="/marketing/listings/new">
            <Button>+ New Listing</Button>
          </Link>
        }
      />

      {all.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total listings" value={all.length} accent="brand" />
          <StatCard label="Published" value={published} accent="green" />
          <StatCard label="Draft" value={draft} accent="yellow" />
          <StatCard label="Unlisted" value={unlisted} accent="purple" />
        </div>
      )}

      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={"/marketing/listings?filter=" + t.key}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
              (filter === t.key
                ? "bg-brand-500 text-white shadow-sm"
                : "border border-ink-200 bg-surface text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:border-white/[0.06] dark:hover:border-white/[0.12]")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <EmptyState
          title="No listings"
          description="Create a listing for a vacant unit."
          action={
            <Link href="/marketing/listings/new">
              <Button>+ New Listing</Button>
            </Link>
          }
        />
      ) : (
        <ListingTable listings={listings} />
      )}
    </div>
  );
}
