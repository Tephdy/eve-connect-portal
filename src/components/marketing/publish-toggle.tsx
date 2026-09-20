"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { publishListingAction, unpublishListingAction } from "@/app/(dashboard)/marketing/listings/actions";

export function PublishToggle({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function onPublish() {
    start(async () => {
      try {
        await publishListingAction(id);
        toast.push("Listing published", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  function onUnpublish() {
    start(async () => {
      try {
        await unpublishListingAction(id);
        toast.push("Listing unpublished", "success");
      } catch { toast.push("Failed", "error"); }
    });
  }

  if (status === "published") {
    return <Button variant="secondary" onClick={onUnpublish} loading={pending}>Unpublish</Button>;
  }
  return <Button onClick={onPublish} loading={pending}>Publish</Button>;
}
