import { NextResponse } from "next/server";
import { requirePagePermission } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a signed contract as HTML.
 *
 * The contract's generated_body and signature live in Supabase Storage.
 * This route fetches them with the admin client (bypassing RLS + bucket
 * privacy) and streams the HTML back with the correct content type so
 * the browser renders it inline.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requirePagePermission("contract:read");
  const { id } = await ctx.params;

  const admin = createAdminClient();

  const { data: contract, error } = await admin
    .from("contract")
    .select("id, status, signed_document_url, generated_body, tenant_signature")
    .eq("id", id)
    .maybeSingle();

  if (error || !contract) {
    return new NextResponse("Contract not found", { status: 404 });
  }

  // Prefer the stored signed HTML. Fall back to the raw body if it's missing.
  let html: string | null = null;

  if (contract.signed_document_url) {
    // Extract the storage path from the public URL and fetch via admin.
    // Public URL looks like:
    //   .../storage/v1/object/public/contracts/<lease_id>/<contract_id>.html
    const match = String(contract.signed_document_url).match(
      /\/object\/(?:public|sign)\/([^/]+)\/(.+)$/
    );
    if (match) {
      const bucket = match[1];
      const objectPath = match[2];
      const { data: blob, error: dlErr } = await admin.storage
        .from(bucket)
        .download(objectPath);

      if (!dlErr && blob) {
        html = await blob.text();
      } else if (dlErr) {
        console.error("[contract-viewer] storage download failed:", dlErr);
      }
    }
  }

  // Fallback — render the raw body inside a minimal wrapper.
  if (!html) {
    html = wrapMinimal(
      "Signed Contract",
      contract.generated_body ?? "",
      contract.tenant_signature ?? null
    );
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'inline; filename="contract-' + id + '.html"',
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}

function wrapMinimal(title: string, body: string, signatureUrl: string | null): string {
  const sig = signatureUrl
    ? '<div class="signature-block"><div><p><strong>Lessee</strong></p>' +
      '<img class="sig-img" src="' + signatureUrl + '" alt="signature" /></div></div>'
    : "";
  return (
    '<!DOCTYPE html><html lang="en-PH"><head><meta charset="utf-8" />' +
    '<title>' + title + '</title>' +
    '<style>body{font-family:Georgia,"Times New Roman",serif;line-height:1.6;' +
    'max-width:800px;margin:40px auto;padding:24px;color:#111}' +
    '.signature-block{margin-top:64px;display:flex;gap:40px}' +
    '.sig-img{max-width:240px;max-height:90px;margin-top:12px}</style>' +
    '</head><body>' + body + sig + '</body></html>'
  );
}
