import { requirePagePermission } from "@/lib/auth/guard";
import { listUnits } from "@/lib/db/units";
import { PageHeader } from "@/components/layout/page-header";
import { ListingForm } from "@/components/marketing/listing-form";

export default async function NewListingPage() {
  await requirePagePermission("listing:create");
  const units = await listUnits();
  const vacant = units.filter((u) => u.status === "vacant" || u.status === "reserved");
  return (
    <div>
      <PageHeader title="New Listing" description="Publish a unit to the market." />
      <ListingForm mode="create" units={vacant} />
    </div>
  );
}
