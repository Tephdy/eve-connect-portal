import Link from "next/link";
import { User } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_TONE: Record<string, "brand" | "green" | "gray" | "red" | "yellow"> = {
  prospect: "yellow",
  active: "green",
  former: "gray",
  blacklisted: "red",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Contact</TH>
              <TH>Messenger</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {tenants.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link
                    href={"/property/tenants/" + t.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white">
                      {initials(t.full_name) || <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {t.full_name}
                      </p>
                      {t.email && (
                        <p className="truncate text-xs text-ink-500">{t.email}</p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-sm text-ink-600">{t.phone ?? "—"}</TD>
                <TD className="text-sm text-ink-600">{t.messenger_name ?? "—"}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[t.status] ?? "gray"} dot>
                    {t.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/property/tenants/" + t.id}
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
