import { notFound } from "next/navigation";
import { IntakeForm } from "../intake-form";

export const dynamic = "force-dynamic";

const BUILDINGS = [
  "ADI 168", "BED AND BATH", "DREAM", "ECO 1", "ECO 2",
  "GREEN", "HOMEY", "KALAYAAN 888", "PENTHAUZ", "PLEASANT",
];

function matchBuilding(slug: string): string | null {
  const normalized = slug.toLowerCase().replace(/[-_]/g, " ");
  return (
    BUILDINGS.find(
      (b) => b.toLowerCase().replace(/[^a-z0-9]/g, " ") === normalized
    ) ?? null
  );
}

export default async function IntakeBuildingPage({
  params,
}: {
  params: Promise<{ building: string }>;
}) {
  const { building } = await params;
  const matched = matchBuilding(decodeURIComponent(building));
  if (!matched) notFound();

  return (
    <div className="h-screen overflow-y-auto bg-ink-50/60 dark:bg-[#0a0b0f]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Tenant intake form
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {matched} — fill in your details and sign to begin your lease.
          </p>
        </div>
        <IntakeForm defaultBuilding={matched} />
      </div>
    </div>
  );
}