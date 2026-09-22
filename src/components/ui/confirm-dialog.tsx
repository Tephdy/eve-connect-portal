"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => Promise<void> | void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function handleConfirm() {
    start(async () => {
      try {
        await onConfirm();
        onClose();
      } catch (err) {
        toast.push(err instanceof Error ? err.message : "Action failed", "error");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="" size="sm">
      <div className="flex flex-col items-center text-center">
        <div
          className={
            variant === "danger"
              ? "mb-3 rounded-full bg-rose-500/15 p-3 backdrop-blur-sm"
              : "mb-3 rounded-full bg-brand-500/15 p-3 backdrop-blur-sm"
          }
        >
          <AlertTriangle
            className={
              variant === "danger"
                ? "h-5 w-5 text-rose-600"
                : "h-5 w-5 text-brand-600"
            }
          />
        </div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        <div className="mt-6 flex w-full gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={pending}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
