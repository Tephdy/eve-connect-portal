import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function uploadSignature(input: {
  lease_id: string;
  contract_id: string;
  pngBase64: string;
}): Promise<string> {
  const admin = createAdminClient();

  // Strip data URL prefix if present
  const base64 = input.pngBase64.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const path = input.lease_id + "/" + input.contract_id + ".png";

  const { error } = await admin.storage
    .from("signatures")
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error("Signature upload failed: " + error.message);

  const { data } = admin.storage.from("signatures").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadSignedHtml(input: {
  lease_id: string;
  contract_id: string;
  html: string;
}): Promise<string> {
  const admin = createAdminClient();
  const path = input.lease_id + "/" + input.contract_id + ".html";
  const buffer = Buffer.from(input.html, "utf8");

  const { error } = await admin.storage
    .from("contracts")
    .upload(path, buffer, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });

  if (error) throw new Error("Contract upload failed: " + error.message);

  const { data } = admin.storage.from("contracts").getPublicUrl(path);
  return data.publicUrl;
}
