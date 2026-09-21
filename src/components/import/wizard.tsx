"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { SourcePicker } from "./source-picker";
import { PreviewTable } from "./preview-table";
import { StepIndicator } from "./step-indicator";
import { TargetPicker } from "./target-picker";
import { MappingForm } from "./mapping-form";
import { ValidationSummary } from "./validation-summary";
import { ConfirmBar } from "./confirm-bar";
import { ImportSummaryCard } from "./import-summary";
import { SheetPicker } from "./sheet-picker";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { autoMapColumns } from "@/lib/import/auto-map";
import { getTarget } from "@/lib/import/field-defs";
import {
  validateImportAction,
  commitImportAction,
} from "@/app/(dashboard)/property/import/actions";
import type {
  ColumnMapping,
  ImportPreviewRow,
  ImportStep,
  ImportSummary,
  ParsedSheet,
  TargetTable,
} from "@/lib/import/types";

export function ImportWizard() {
  const [step, setStep] = useState<ImportStep>("source");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [target, setTarget] = useState<TargetTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (sheet && target) setMapping(autoMapColumns(target, sheet.headers));
  }, [sheet, target]);

  function handleParsed(parsed: ParsedSheet) {
    setSheet(parsed);
    setPreview(null);
    setStep("map");
  }

  function handleSheetSwitch(parsed: ParsedSheet) {
    setSheet(parsed);
    setPreview(null);
    // Recompute mapping against the new sheet's headers
    if (target) {
      setMapping(autoMapColumns(target, parsed.headers));
    }
  }

  function reset() {
    setSheet(null);
    setTarget(null);
    setMapping({});
    setPreview(null);
    setSummary(null);
    setStep("source");
  }

  function runValidation() {
    if (!sheet || !target) return;
    start(async () => {
      const result = await validateImportAction({ target, mapping, rows: sheet.rows });
      if (result.ok) {
        setPreview(result.data);
        setStep("review");
      } else toast.push(result.error, "error");
    });
  }

  function runCommit(updateDuplicates: boolean) {
    if (!sheet || !target || !preview) return;
    start(async () => {
      const result = await commitImportAction({
        target,
        mapping,
        rows: sheet.rows,
        preview,
        updateDuplicates,
      });
      if (result.ok) {
        setSummary(result.data);
        setStep("done");
        toast.push("Import complete — " + result.data.created + " created", "success");
      } else toast.push(result.error, "error");
    });
  }

  const def = target ? getTarget(target) : null;
  const missingRequired = def?.fields.filter((f) => f.required && !mapping[f.key]) ?? [];

  const hasMultipleSheets =
    sheet?.source === "xlsx" && (sheet.sheetNames?.length ?? 0) > 1;

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {step === "source" && <SourcePicker onParsed={handleParsed} />}

      {step === "map" && sheet && (
        <div className="space-y-6">
          {hasMultipleSheets && (
            <SheetPicker
              filename={sheet.filename}
              sheetNames={sheet.sheetNames ?? []}
              activeSheet={sheet.activeSheet}
              onSwitch={handleSheetSwitch}
            />
          )}

          <PreviewTable sheet={sheet} maxRows={10} />

          <Card>
            <CardHeader
              title="What are you importing?"
              description="Pick the table these rows should go into."
            />
            <CardBody>
              <TargetPicker value={target} onChange={setTarget} />
            </CardBody>
          </Card>

          {target && (
            <MappingForm
              target={target}
              headers={sheet.headers}
              mapping={mapping}
              onChange={setMapping}
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={reset}>
              Choose different file
            </Button>
            <div className="flex items-center gap-3">
              {missingRequired.length > 0 && (
                <span className="text-xs text-danger-700 dark:text-danger-500">
                  Map required: {missingRequired.map((f) => f.label).join(", ")}
                </span>
              )}
              <Button
                onClick={runValidation}
                loading={pending}
                disabled={!target || missingRequired.length > 0}
              >
                Validate {sheet.totalRows} rows
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "review" && preview && (
        <div className="space-y-6">
          <ValidationSummary rows={preview} />
          <ConfirmBar
            readyCount={preview.filter((r) => r.errors.length === 0 && !r.willSkip).length}
            skipCount={preview.filter((r) => r.willSkip).length}
            errorCount={preview.filter((r) => r.errors.length > 0).length}
            pending={pending}
            onConfirm={runCommit}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("map")}>
              Back to mapping
            </Button>
            <Button variant="secondary" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {step === "done" && summary && <ImportSummaryCard summary={summary} />}
    </div>
  );
}
