import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getTemplate } from "@/lib/db/templates";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "@/components/contract/template-form";
import { ArchiveTemplateButton } from "@/components/contract/archive-template-button";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("template:manage");
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <div>
      <PageHeader
        title={template.name}
        description={"Version " + template.version}
        action={<ArchiveTemplateButton id={template.id} />}
      />
      <TemplateForm mode="edit" template={template} />
    </div>
  );
}
