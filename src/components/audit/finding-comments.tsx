"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { commentFindingAction } from "@/app/(dashboard)/accounting/audit/actions";
import type { AuditComment } from "@/lib/audit/types";

export function FindingComments({
  findingId,
  comments,
}: {
  findingId: string;
  comments: AuditComment[];
}) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const toast = useToast();

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const result = await commentFindingAction(findingId, body);
      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }
      setBody("");
    });
  }

  return (
    <Card>
      <CardHeader title="Comments" description={comments.length + " comment(s)"} />
      <CardBody className="space-y-4">
        {comments.length > 0 && (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-white/40 bg-white/40 p-3 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink-700 dark:text-ink-300">
                    {c.author_email ?? "system"}
                  </span>
                  <span className="text-ink-400">
                    {new Date(c.created_at).toLocaleString("en-PH")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink-800 dark:text-ink-200">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          label="Add a comment"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Document your analysis, next steps, or communication..."
        />
        <div className="flex justify-end">
          <Button onClick={submit} loading={pending} disabled={!body.trim()}>
            Post comment
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
