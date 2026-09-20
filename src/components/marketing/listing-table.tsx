import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatPHP } from "@/lib/utils/format-php";
import type { Listing } from "@/lib/db/listings";

const STATUS_TONE: Record<string, "gray" | "green" | "yellow"> = {
  draft: "gray",
  published: "green",
  unlisted: "yellow",
};

export function ListingTable({ listings }: { listings: Listing[] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Listing</TH>
              <TH>Unit</TH>
              <TH className="text-right">Asking rent</TH>
              <TH>Status</TH>
              <TH className="text-right"></TH>
            </TR>
          </THead>
          <TBody>
            {listings.map((l) => (
              <TR key={l.id}>
                <TD>
                  <Link
                    href={"/marketing/listings/" + l.id}
                    className="flex items-center gap-3 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Megaphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {l.title}
                      </p>
                      {l.property_name && (
                        <p className="truncate text-xs text-ink-500">
                          {l.property_name}
                        </p>
                      )}
                    </div>
                  </Link>
                </TD>
                <TD className="text-ink-600">{l.unit_number ?? "—"}</TD>
                <TD className="text-right font-medium text-ink-900">
                  {l.asking_rent != null ? formatPHP(l.asking_rent) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[l.status] ?? "gray"} dot>
                    {l.status}
                  </StatusPill>
                </TD>
                <TD className="text-right">
                  <Link
                    href={"/marketing/listings/" + l.id}
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
