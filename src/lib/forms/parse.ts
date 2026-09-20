import { z } from "zod";

export function parseForm<S extends z.ZodTypeAny>(
  schema: S,
  formData: FormData
): { ok: true; data: z.infer<S> } | { ok: false; fieldErrors: Record<string, string>; error: string } {
  const raw: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    raw[key] = value === "" ? undefined : value;
  });

  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  return { ok: false, fieldErrors, error: "Please check the form." };
}