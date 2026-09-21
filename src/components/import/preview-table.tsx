import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ParsedSheet } from "@/lib/import/types";

export function PreviewTable({ sheet, maxRows = 20 }: { sheet: ParsedSheet; maxRows?: number }) {
  const preview = sheet.rows.slice(0, maxRows);
  const hasMore = sheet.rows.length > maxRows;

  const desc = sheet.activeSheet
    ? "Sheet \"" + sheet.activeSheet + "\" · showing " + preview.length + " of " + sheet.totalRows
    : "Showing first " + preview.length + " of " + sheet.totalRows + " rows";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Preview"
        description={desc}
        action={
          <Badge tone="brand">
            {sheet.source.toUpperCase()} · {sheet.headers.length} columns
          </Badge>
        }
      />
      <CardBody className="p-0">
        <Table>
          <THead>
            <TR>
              <TH className="w-12 text-right">#</TH>
              {sheet.headers.map((h) => (
                <TH key={h}>{h}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {preview.map((row, i) => (
              <TR key={i}>
                <TD className="text-right text-xs text-ink-400">{i + 1}</TD>
                {sheet.headers.map((h) => (
                  <TD key={h} className="max-w-xs truncate">
                    {row[h] ?? ""}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
        {hasMore && (
          <div className="border-t border-ink-200 px-6 py-3 text-center text-xs text-ink-500 dark:border-white/[0.06]">
            + {sheet.rows.length - maxRows} more rows
          </div>
        )}
      </CardBody>
    </Card>
  );
}
