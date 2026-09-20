import { requirePagePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/contract/template-form";

export default async function NewTemplatePage() {
  await requirePagePermission("template:manage");
  return (
    <div>
      <PageHeader title="New Template" description="Create a contract template." />
      <TemplateForm mode="create" />
    </div>
  );
}
