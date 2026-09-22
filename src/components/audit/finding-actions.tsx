"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { setFindingStatusAction } from "@/app/(dashboard)/accounting/audit/actions";
import type { FindingStatus } from "@/lib/audit/types";

export function FindingActions({ id, status }: { id: string; status: FindingStatus }) {
  const [pending, start] = useTransition();
  const [resolution, setResolution] = useState("");
  const [mode, setMode] = useState<"none" | "resolve" | "dismiss">("none");
  const toast = useToast();

  function submit(newStatus: FindingStatus) {
    start(async () => {
      const result = await setFindingStatusAction(id, newStatus, resolution.trim() || undefined);
      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }
      toast.push("Finding updated", "success");
      setMode("none");
      setResolution("");
    });
  }

  if (status === "resolved" || status === "dismissed") {
    return (
      <Card>
        <CardHeader title="Actions" />
        <CardBody>
          <Button variant="secondary" onClick={() => submit("open")} loading={pending}>
            Reopen finding
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Actions" />
      <CardBody className="space-y-3">
        {status === "open" && (
          <Button variant="secondary" onClick={() => submit("investigating")} loading={pending} className="w-full">
            Mark as investigating
          </Button>
        )}

        {mode === "none" && (
          <>
            <Button onClick={() => setMode("resolve")} className="w-full">Resolve</Button>
            <Button variant="secondary" onClick={() => setMode("dismiss")} className="w-full">Dismiss</Button>
          </>
        )}

        {mode !== "none" && (
          <>
            <Textarea
              label={mode === "resolve" ? "Resolution note" : "Reason for dismissal"}
              rows={3}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder={mode === "resolve" ? "What was done to fix this?" : "Why is this a false positive?"}
            />
            <div className="flex gap-2">
              <Button onClick={() => submit(mode === "resolve" ? "resolved" : "dismissed")} loading={pending} className="flex-1">
                {mode === "resolve" ? "Confirm resolve" : "Confirm dismiss"}
              </Button>
              <Button variant="secondary" onClick={() => { setMode("none"); setResolution(""); }} className="flex-1">
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
