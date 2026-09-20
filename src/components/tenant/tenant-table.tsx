import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Tenant } from "@/lib/db/tenants";

const STATUS_TONE: Record<string, "green" | "blue" | "gray" | "red"> = {
  prospect: "blue", active: "green", former: "gray", blacklisted: "red",
};

export function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH><TH>Email</TH><TH>Phone</TH><TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {tenants.map((t) => (
            <TR key={t.id}>
              <TD className="font-medium">
                <Link href={"/property/tenants/" + t.id} className="text-brand-600 hover:underline">
                  {t.full_name}
                </Link>
              </TD>
              <TD className="text-gray-600">{t.email ?? "—"}</TD>
              <TD className="text-gray-600">{t.messenger_name ?? "—"}</TD>
              <TD className="text-gray-600">{t.phone ?? "—"}</TD>
              <TD><Badge tone={STATUS_TONE[t.status] ?? "gray"}>{t.status}</Badge></TD>
              <TD className="text-right">
                <Link href={"/property/tenants/" + t.id} className="text-brand-600 hover:underline text-sm">
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
