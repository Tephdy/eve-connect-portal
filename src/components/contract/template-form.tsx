"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createTemplateAction, updateTemplateAction } from "@/app/(dashboard)/property/templates/actions";
import type { ActionResult } from "@/lib/actions/result";
import type { ContractTemplate } from "@/lib/db/templates";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

export function TemplateForm({
  mode,
  template,
}: {
  mode: "create" | "edit";
  template?: ContractTemplate;
}) {
  const router = useRouter();
  const toast = useToast();
  const action = mode === "create" ? createTemplateAction : updateTemplateAction.bind(null, template!.id);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.push(mode === "create" ? "Template created" : "Template updated", "success");
      if (mode === "edit") router.refresh();
    } else if (state && !state.ok) {
      toast.push(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldError = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <Input
            name="name"
            label="Template name"
            defaultValue={template?.name ?? ""}
            error={fieldError("name")}
            required
          />
          <Textarea
            name="body_markdown"
            label="Body (HTML)"
            rows={24}
            defaultValue={template?.body_markdown ?? ""}
            error={fieldError("body_markdown")}
            hint="Use HTML. Available placeholders: {{today}}, {{property_name}}, {{property_address}}, {{unit_number}}, {{tenant_full_name}}, {{tenant_email}}, {{tenant_phone}}, {{lease_start}}, {{lease_end}}, {{monthly_rent}}, {{deposit_amount}}, {{notice_period_days}}"
          />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton label={mode === "create" ? "Create Template" : "Save Changes"} />
            <Button type="button" variant="secondary" onClick={() => router.push("/property/templates")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
