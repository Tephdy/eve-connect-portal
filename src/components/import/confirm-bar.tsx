"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmBar({
  readyCount,
  skipCount,
  errorCount,
  pending,
  onConfirm,
}: {
  readyCount: number;
  skipCount: number;
  errorCount: number;
  pending: boolean;
  onConfirm: (updateDuplicates: boolean) => void;
}) {
  const [updateDuplicates, setUpdateDuplicates] = useState(false);

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-ink-200 bg-surface p-5 md:flex-row md:items-center dark:border-white/[0.06]">
      <div>
        <p className="text-sm font-medium text-ink-900">
          Ready to import {readyCount} row{readyCount === 1 ? "" : "s"}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {skipCount > 0 && (skipCount + " duplicate" + (skipCount === 1 ? "" : "s") + " will be " + (updateDuplicates ? "updated" : "skipped"))}
          {skipCount > 0 && errorCount > 0 && " · "}
          {errorCount > 0 && (errorCount + " row" + (errorCount === 1 ? "" : "s") + " will fail")}
          {skipCount === 0 && errorCount === 0 && "No duplicates or errors"}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {skipCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={updateDuplicates}
              onChange={(e) => setUpdateDuplicates(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
            />
            Update existing instead of skip
          </label>
        )}
        <Button
          onClick={() => onConfirm(updateDuplicates)}
          loading={pending}
          disabled={readyCount === 0 && skipCount === 0}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import now
        </Button>
      </div>
    </div>
  );
}
