"use client";

import { useState, useTransition } from "react";
import { Upload, Link2, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { parseImportSourceAction } from "@/app/(dashboard)/property/import/actions";
import type { ParsedSheet } from "@/lib/import/types";

type Mode = "file" | "sheets";

export function SourcePicker({
  onParsed,
}: {
  onParsed: (sheet: ParsedSheet) => void;
}) {
  const [mode, setMode] = useState<Mode>("file");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  async function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    start(async () => {
      const result = await parseImportSourceAction(formData);
      if (result.ok) {
        const extra =
          result.data.sheetNames && result.data.sheetNames.length > 1
            ? " · " + result.data.sheetNames.length + " sheets"
            : "";
        toast.push(
          "Parsed — " + result.data.totalRows + " rows" + extra,
          "success"
        );
        onParsed(result.data);
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  async function handleSheets() {
    if (!sheetsUrl.trim()) {
      toast.push("Paste a Google Sheets URL", "error");
      return;
    }
    const formData = new FormData();
    formData.append("sheets_url", sheetsUrl.trim());
    start(async () => {
      const result = await parseImportSourceAction(formData);
      if (result.ok) {
        toast.push("Sheet parsed — " + result.data.totalRows + " rows", "success");
        onParsed(result.data);
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="flex gap-2">
          <ModeTab active={mode === "file"} onClick={() => setMode("file")} icon={Upload}>
            Upload file
          </ModeTab>
          <ModeTab active={mode === "sheets"} onClick={() => setMode("sheets")} icon={Link2}>
            Google Sheets
          </ModeTab>
        </div>

        {mode === "file" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors",
              dragging
                ? "border-brand-500 bg-brand-500/5"
                : "border-ink-200 dark:border-white/[0.08]"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-5 w-5" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-ink-900">
                Drop a CSV or Excel file here
              </p>
              <p className="mt-1 text-xs text-ink-500">or</p>
            </div>
            <label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                disabled={pending}
              />
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-brand-500 px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-600">
                Choose file
              </span>
            </label>
            <p className="text-xs text-ink-400">
              CSV, XLSX, XLS · Max 10 MB · Multi-tab supported
            </p>
          </div>
        )}

        {mode === "sheets" && (
          <div className="space-y-4">
            <Input
              label="Google Sheets URL"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              hint="Sheet must be shared as 'Anyone with the link can view'. Add #gid=NNNNNN to target a specific tab."
              disabled={pending}
            />
            <Button onClick={handleSheets} loading={pending}>
              Fetch sheet
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-400"
          : "border-ink-200 bg-surface text-ink-600 hover:border-ink-300 dark:border-white/[0.06] dark:hover:border-white/[0.12]"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
