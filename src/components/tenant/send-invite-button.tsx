"use client";

import { useState, useTransition } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createTenantInviteAction } from "@/app/(dashboard)/property/tenants/actions";

export function SendInviteButton({ tenantId }: { tenantId: string }) {
  const [pending, start] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleGenerate = () => {
    start(async () => {
      const res = await createTenantInviteAction(tenantId);
      if (!res.ok) {
        toast.push(res.error, "error");
        return;
      }
      setInviteUrl(res.data.invite_url);
      setExpiresAt(res.data.expires_at);
      setCopied(false);
      toast.push("Invite link generated", "success");
    });
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.push("Copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.push("Copy failed - select and copy manually", "error");
    }
  };

  return (
    <div className="space-y-3">
      {!inviteUrl ? (
        <Button onClick={handleGenerate} loading={pending} variant="primary">
          Send login invite
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 dark:border-emerald-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <div className="text-xs text-ink-700">
              <p className="font-medium">Share this link with the tenant</p>
              <p className="mt-0.5 text-ink-500">
                Paste it into Meta Business Suite / Messenger. It expires on{" "}
                {expiresAt ? new Date(expiresAt).toLocaleString("en-PH") : "-"}.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-md border border-ink-200 bg-surface px-2 py-1.5 font-mono text-xs text-ink-700 dark:border-white/[0.06]"
            />
            <Button
              size="sm"
              variant={copied ? "secondary" : "primary"}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </>
              )}
            </Button>
          </div>

          <button
            onClick={() => {
              setInviteUrl(null);
              setExpiresAt(null);
            }}
            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Generate new link
          </button>
        </div>
      )}
    </div>
  );
}
