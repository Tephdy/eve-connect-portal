import "server-only";
import { qrDataUri } from "./qr";
import { getLogoDataUri } from "./logo";
import { buildVerifyUrl } from "./verify";

/**
 * Fallback if the property row doesn't carry logo_filename yet.
 * Prefer the DB column; this is a safety net.
 */
const BED_AND_BATH_PROPERTY_ID = "dcb38fe9-bd9b-4f3d-8a9f-1059e9e54f52";
const FALLBACK_DEFAULT_LOGO = "eves_logo.png";
const FALLBACK_BNB_LOGO = "bnb_logo.png";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export type WrapOptions = {
  title: string;
  /** Contract id (uuid). */
  contract_id: string;
  /** ISO timestamp from contracts.created_at. */
  contract_created_at: string;
  /** Lease id (uuid). */
  lease_id: string;
  /** Optional subtitle like "CTR-2026-0042". */
  document_number?: string;
  /**
   * Property this contract belongs to. If provided, drives which
   * logo is chosen (unless logo_filename is also provided).
   */
  property_id?: string;
  /** Explicit logo override. Wins over everything else. */
  logo_filename?: string;
};

function chooseLogo(opts?: Partial<WrapOptions>): string {
  // Explicit override always wins.
  if (opts?.logo_filename) return opts.logo_filename;
  // Then the hardcoded BED AND BATH mapping.
  if (opts?.property_id === BED_AND_BATH_PROPERTY_ID) return FALLBACK_BNB_LOGO;
  // Default.
  return FALLBACK_DEFAULT_LOGO;
}

export async function wrapPrintableHtml(
  title: string,
  body: string,
  opts?: Partial<WrapOptions>
): Promise<string> {
  const logoDataUri = await getLogoDataUri(chooseLogo(opts));

  let qrBlock = "";
  if (opts?.contract_id && opts?.contract_created_at && opts?.lease_id) {
    const url = buildVerifyUrl(
      opts.contract_id,
      opts.contract_created_at,
      opts.lease_id
    );
    const qr = await qrDataUri(url);
    qrBlock = `
      <div class="doc-qr">
        <img src="${qr}" alt="Verification QR" width="96" height="96" />
        <div class="doc-qr-label">Scan to verify</div>
      </div>
    `;
  }

  const subtitle = opts?.document_number
    ? `<div class="doc-number">${escapeHtml(opts.document_number)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en-PH">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.6;
    max-width: 800px;
    margin: 40px auto;
    padding: 24px;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-header {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding-bottom: 16px;
    border-bottom: 2px solid #111;
    margin-bottom: 32px;
  }
  .doc-header img.doc-logo {
    max-height: 64px;
    max-width: 180px;
    object-fit: contain;
  }
  .doc-header .doc-titles {
    flex: 1;
    text-align: center;
    padding: 0 12px;
  }
  .doc-header h1 {
    font-size: 20px;
    margin: 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .doc-header .doc-number {
    font-size: 12px;
    color: #555;
    margin-top: 4px;
    font-family: "Courier New", monospace;
  }
  .doc-qr { text-align: center; flex-shrink: 0; }
  .doc-qr img {
    display: block;
    border: 1px solid #ddd;
    padding: 2px;
    background: white;
  }
  .doc-qr-label {
    font-size: 9px;
    color: #666;
    margin-top: 3px;
    letter-spacing: 0.3px;
  }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  p  { margin: 8px 0; }
  .meta { text-align: center; color: #666; font-size: 13px; margin-bottom: 32px; }
  .signature-block { margin-top: 64px; display: flex; gap: 40px; }
  .signature-block > div { flex: 1; }
  .sig-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 6px; font-size: 12px; }
  .sig-img { max-width: 240px; max-height: 90px; margin-top: 12px; }
  @media print {
    body { margin: 0; padding: 20px; max-width: none; }
    .doc-header { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <header class="doc-header">
    <img class="doc-logo" src="${logoDataUri}" alt="Logo" />
    <div class="doc-titles">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle}
    </div>
    ${qrBlock}
  </header>
  ${body}
</body>
</html>`;
}
