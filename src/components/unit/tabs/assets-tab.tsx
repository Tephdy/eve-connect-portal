import Link from "next/link";
import { Package } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { UnitProfile } from "@/lib/db/unit-profile";

export function UnitAssetsTab({ profile }: { profile: UnitProfile }) {
  const now = new Date();

  if (profile.assets.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-sm text-ink-500">
          No assets tracked for this unit.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Asset</TH>
              <TH>Type</TH>
              <TH>Installed</TH>
              <TH>Warranty until</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {profile.assets.map((a) => {
              const inW = a.warranty_until && new Date(a.warranty_until) >= now;
              return (
                <TR key={a.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Package className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-ink-900">{a.name}</span>
                    </div>
                  </TD>
                  <TD className="text-sm text-ink-600">{a.type ?? "—"}</TD>
                  <TD className="text-sm text-ink-500">
                    {a.install_date ? new Date(a.install_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </TD>
                  <TD className="text-sm text-ink-500">
                    {a.warranty_until ? new Date(a.warranty_until).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </TD>
                  <TD>
                    {a.warranty_until ? (
                      <StatusPill tone={inW ? "green" : "yellow"} dot>
                        {inW ? "in warranty" : "expired"}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="gray">unknown</StatusPill>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Link href={"/maintenance/assets/" + a.id} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                      View
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
