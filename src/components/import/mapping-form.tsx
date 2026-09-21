"use client";

import { AlertCircle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { getTarget } from "@/lib/import/field-defs";
import type { ColumnMapping, TargetTable } from "@/lib/import/types";

export function MappingForm({
  target,
  headers,
  mapping,
  onChange,
}: {
  target: TargetTable;
  headers: string[];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
}) {
  const def = getTarget(target);
  if (!def) return null;

  const options = [
    { value: "", label: "— Not mapped —" },
    ...headers.map((h) => ({ value: h, label: h })),
  ];

  return (
    <Card>
      <CardHeader
        title="Column mapping"
        description={"Match each field to a column from your file."}
      />
      <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {def.fields.map((field) => {
          const current = mapping[field.key] ?? "";
          return (
            <div key={field.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-medium text-ink-700">
                  {field.label}
                </span>
                {field.required ? (
                  <Badge tone="red">required</Badge>
                ) : (
                  <Badge tone="gray">optional</Badge>
                )}
              </div>
              <Select
                options={options}
                value={current}
                onChange={(e) => {
                  const next = { ...mapping };
                  next[field.key] = e.target.value || null;
                  onChange(next);
                }}
              />
              {field.hint && (
                <p className="mt-1 flex items-start gap-1 text-xs text-ink-500">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {field.hint}
                </p>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
