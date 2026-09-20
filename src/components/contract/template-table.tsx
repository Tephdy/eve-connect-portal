import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ContractTemplate } from "@/lib/db/templates";

export function TemplateTable({ templates }: { templates: ContractTemplate[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH><TH>Version</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {templates.map((t) => (
            <TR key={t.id}>
              <TD className="font-medium">
                <Link href={"/property/templates/" + t.id} className="text-brand-600 hover:underline">
                  {t.name}
                </Link>
              </TD>
              <TD className="text-gray-600">v{t.version}</TD>
              <TD>
                <Badge tone={t.active ? "green" : "gray"}>{t.active ? "active" : "archived"}</Badge>
              </TD>
              <TD className="text-right">
                <Link href={"/property/templates/" + t.id} className="text-brand-600 hover:underline text-sm">
                  Edit
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
