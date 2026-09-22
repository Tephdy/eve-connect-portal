import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function FindingEvidence({ evidence }: { evidence: Record<string, unknown> }) {
  return (
    <Card>
      <CardHeader title="Evidence" description="Raw data that triggered this finding" />
      <CardBody>
        <pre className="overflow-x-auto rounded-lg bg-ink-900/95 p-4 text-xs leading-relaxed text-emerald-200 dark:bg-black/40">
          {JSON.stringify(evidence, null, 2)}
        </pre>
      </CardBody>
    </Card>
  );
}
