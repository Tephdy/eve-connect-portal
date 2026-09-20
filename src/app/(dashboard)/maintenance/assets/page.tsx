import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { listAssets } from "@/lib/db/assets";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusPill } from "@/components/dashboard/status-pill";

export default async function AssetsPage() {
  await requirePagePermission("asset:read");
  const assets = await listAssets();

  const now = new Date();
  const inWarranty = assets.filter((a) => a.warranty_until && new Date(a.warranty_until) >= now).length;
  const outOfWarranty = assets.filter((a) => a.warranty_until && new Date(a.warranty_until) < now).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Equipment and fixtures tracked per unit."
        action={
          <Link href="/maintenance/assets/new">
            <Button>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Asset
            </Button>
          </Link>
        }
      />

      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total assets" value={assets.length} accent="brand" />
          <StatCard label="Under warranty" value={inWarranty} accent="green" />
          <StatCard label="Out of warranty" value={outOfWarranty} accent="yellow" />
          <StatCard label="No warranty info" value={assets.length - inWarranty - outOfWarranty} accent="purple" />
        </div>
      )}

      {assets.length === 0 ? (
        <EmptyState
          title="No assets yet"
          description="Track ACs, appliances, and fixtures per unit."
          action={
            <Link href="/maintenance/assets/new">
              <Button>+ New Asset</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Asset</TH>
                  <TH>Unit</TH>
                  <TH>Type</TH>
                  <TH>Installed</TH>
                  <TH>Warranty until</TH>
                  <TH>Status</TH>
                  <TH className="text-right"></TH>
                </TR>
              </THead>
              <TBody>
                {assets.map((a) => {
                  const inW = a.warranty_until && new Date(a.warranty_until) >= now;
                  return (
                    <TR key={a.id}>
                      <TD>
                        <Link
                          href={"/maintenance/assets/" + a.id}
                          className="flex items-center gap-3 group"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                            <Package className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {a.name}
                          </span>
                        </Link>
                      </TD>
                      <TD className="text-ink-600">{a.unit_number ?? "—"}</TD>
                      <TD className="text-ink-600">{a.type ?? "—"}</TD>
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
                        <Link
                          href={"/maintenance/assets/" + a.id}
                          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Edit
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
