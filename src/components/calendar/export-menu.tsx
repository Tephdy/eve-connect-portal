"use client";

import { useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportMenu({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);

  function downloadCsv() {
    const url = "/api/calendar/export?year=" + year + "&month=" + month;
    window.location.href = url;
    setOpen(false);
  }

  function printCalendar() {
    setOpen(false);
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-ink-200 bg-surface p-1 shadow-lg dark:border-white/[0.08] dark:bg-surface-raised">
            <button
              onClick={downloadCsv}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download CSV
            </button>
            <button
              onClick={printCalendar}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-600 dark:hover:bg-white/[0.05]"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
