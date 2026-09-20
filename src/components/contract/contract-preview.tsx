"use client";

export function ContractPreview({ html }: { html: string }) {
  return (
    <div className="bg-surface border border-ink-200 rounded-lg">
      <div className="border-b border-ink-200 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-700">Preview</span>
        <button
          onClick={() => window.print()}
          className="text-xs text-brand-600 hover:underline"
        >
          Print / Save as PDF
        </button>
      </div>
      <div
        className="contract-body p-6 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .contract-body, .contract-body * { visibility: visible; }
          .contract-body { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
