import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guard";
import { listTemplates } from "@/lib/db/templates";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { TemplateTable } from "@/components/contract/template-table";

export default async function TemplatesPage() {
  await requirePagePermission("template:manage");
  const templates = await listTemplates();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Templates"
        description="Reusable HTML templates for lease contracts."
        action={
          <Link href="/property/templates/new">
            <Button>+ New Template</Button>
          </Link>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create a template to generate contracts."
          action={
            <Link href="/property/templates/new">
              <Button>+ New Template</Button>
            </Link>
          }
        />
      ) : (
        <TemplateTable templates={templates} />
      )}
    </div>
  );
}
