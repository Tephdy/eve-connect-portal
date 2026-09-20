import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { ContractTemplate } from "@/lib/db/templates";

export function TemplateTable({ templates }: { templates: ContractTemplate[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Template</TH>
              <TH>Version</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {templates.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link
                    href={"/property/templates/" + t.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <ScrollText className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {t.name}
                    </span>
                  </Link>
                </TD>
                <TD className="text-ink-600">v{t.version}</TD>
                <TD>
                  <StatusPill tone={t.active ? "green" : "gray"} dot>
                    {t.active ? "active" : "archived"}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/templates/" + t.id}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Edit
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
