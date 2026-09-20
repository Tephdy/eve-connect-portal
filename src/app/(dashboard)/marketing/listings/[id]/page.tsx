import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getListing } from "@/lib/db/listings";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { ListingForm } from "@/components/marketing/listing-form";
import { PublishToggle } from "@/components/marketing/publish-toggle";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("listing:read");
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const units = await listUnits();
  const vacant = units.filter((u) => u.status === "vacant" || u.status === "reserved" || u.id === listing.unit_id);

  return (
    <div>
      <PageHeader
        title={listing.title}
        description={(listing.unit_number ?? "") + " — " + (listing.property_name ?? "")}
        action={<PublishToggle id={listing.id} status={listing.status} />}
      />
      <ListingForm mode="edit" listing={listing} units={vacant} />
    </div>
  );
}
