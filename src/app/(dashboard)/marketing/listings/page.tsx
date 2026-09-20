import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listListings } from "@/lib/db/listings";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
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

  const tabs = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Draft" },
    { key: "unlisted", label: "Unlisted" },
  ];

  return (
    <div>
      <PageHeader
        title="Listings"
        description="Unit listings across the portfolio."
        action={<Link href="/marketing/listings/new"><Button>+ New Listing</Button></Link>}
      />
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <Link key={t.key} href={"/marketing/listings?filter=" + t.key}
            className={"px-3 py-1.5 rounded text-sm " +
              (filter === t.key
                ? "bg-brand-500 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}>
            {t.label}
          </Link>
        ))}
      </div>
      {listings.length === 0 ? (
        <EmptyState title="No listings" description="Create a listing for a vacant unit." />
      ) : (
        <ListingTable listings={listings} />
      )}
    </div>
  );
}
