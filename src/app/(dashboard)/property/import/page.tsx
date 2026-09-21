import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { StepIndicator } from "@/components/import/step-indicator";
import { ImportWizard } from "@/components/import/wizard";

export default async function ImportPage() {
  await requirePagePermission("unit:create");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/property/units"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to units
        </Link>
        <PageHeader
          title="Import data"
          description="Upload a CSV, Excel file, or Google Sheet to bulk-create properties, units, tenants, or leases."
        />
      </div>

      <ImportWizard />
    </div>
  );
}
