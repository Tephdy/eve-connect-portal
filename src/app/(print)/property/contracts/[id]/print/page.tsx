import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { getContract } from "@/lib/db/contracts";
import { getLease } from "@/lib/db/leases";
import { getUnit } from "@/lib/db/units";
import { getProperty } from "@/lib/db/properties";
import { controlNumberFromId } from "@/lib/contracts/control-number";
import { code128Svg } from "@/lib/contracts/barcode";
import { getLogoDataUri } from "@/lib/contracts/logo";
import { PrintTrigger } from "./print-trigger";

export const dynamic = "force-dynamic";

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("contract:read");
  const { id } = await params;

  const contract = await getContract(id);
  if (!contract) notFound();

  const lease = await getLease(contract.lease_id);
  const unit = lease ? await getUnit(lease.unit_id) : null;
  const property = unit ? await getProperty(unit.property_id) : null;

  const controlNumber = controlNumberFromId(contract.id);
  const barcodeSvg = code128Svg(controlNumber, { height: 10, scale: 2 });

  const logoFilename =
    property?.name?.toUpperCase().includes("BED AND BATH")
      ? "bnb_logo.png"
      : "eves_logo.png";
  const logoDataUri = await getLogoDataUri(logoFilename);

  const bodyHtml =
    (contract.generated_body ?? "") +
    (contract.tenant_signature
      ? "<div class='signature-block'>" +
        "<div><p><strong>Lessee</strong></p>" +
        "<img class='sig-img' src='" +
        contract.tenant_signature +
        "' alt='signature' /></div>" +
        "</div>"
      : "");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <PrintTrigger />

      <div className="print-root">
        <div className="screen-toolbar">
          <a href={"/property/contracts/" + contract.id} className="back-link">
            ← Back to contract
          </a>
          <button type="button" className="print-btn">
            Print / Save as PDF
          </button>
        </div>

        <article className="page">
          <img className="watermark" src={logoDataUri} alt="" aria-hidden />

          <header className="letterhead">
            <img className="header-logo" src={logoDataUri} alt="" />
            <div className="control-block">
              <div className="control-label">CONTROL NUMBER:</div>
              <div className="control-value">{controlNumber}</div>
            </div>
            <div className="codes-row">
              <div
                className="barcode"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />
            </div>
          </header>

          <section
            className="contract-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          <footer className="page-footer">
            <span>{controlNumber}</span>
          </footer>
        </article>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('click',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('print-btn')){window.print();}});",
        }}
      />
    </>
  );
}

const printCss = `
  @page { size: 8.5in 14in; margin: 0; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #e5e7eb;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /* Force-scrollable on screen — overrides any global overflow:hidden */
    overflow: auto !important;
    height: auto !important;
    min-height: 100% !important;
  }

  .print-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 40px;
  }

  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #111;
  }

  /* ---- Screen-only toolbar ---- */
  .screen-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 24px;
    background: #1f2937;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
  }
  .screen-toolbar .back-link { color: #cbd5e1; text-decoration: none; }
  .screen-toolbar .back-link:hover { color: white; }
  .screen-toolbar .print-btn {
    background: #3b6fff; color: white; border: 0;
    padding: 8px 16px; border-radius: 8px;
    font-weight: 600; cursor: pointer; font-size: 13px;
  }
  .screen-toolbar .print-btn:hover { background: #2b59e8; }

  /* ---- A4 page ---- */
  .page {
    position: relative;
    width: 215.9mm;
    min-height: 355.6mm;
    margin: 24px auto;
    align-self: center;
    flex-shrink: 0;
    padding: 15mm 20mm 18mm 20mm;
    background: white;
    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
  }

  /* ---- Header region ---- */
  .letterhead {
    flex: 0 0 auto;
    text-align: center;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid #d1d5db;
    position: relative;
    z-index: 1;
  }
  .header-logo {
    display: block;
    margin: 0 auto 4px;
    max-height: 110px;
    width: auto;
    object-fit: contain;
  }

  .control-block {
    text-align: left;
    margin-top: 12px;
    font-family: "Courier New", monospace;
    font-size: 11pt;
    line-height: 1.25;
  }
  .control-label { font-weight: 700; letter-spacing: 0.6px; }
  .control-value { font-weight: 700; margin-top: 2px; }

  .codes-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
  }
  .barcode svg { display: block; height: 44px; width: auto; }

  /* ---- Body region ---- */
  .contract-body {
    flex: 1 1 auto;
    min-height: 0;
    font-size: 10.5pt;
    line-height: 1.5;
    position: relative;
    z-index: 1;
  }
  .contract-body h1 {
    font-size: 14pt;
    text-align: center;
    margin: 4px 0 6px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-weight: 700;
  }
  .contract-body h2 { font-size: 12pt; margin: 16px 0 6px; font-weight: 700; }
  .contract-body p { margin: 7px 0; }
  .contract-body ol, .contract-body ul { margin: 6px 0 6px 22px; }
  .contract-body li { margin: 4px 0; }

  .signature-block {
    margin-top: auto;
    padding-top: 48px;
    display: flex;
    gap: 48px;
    break-inside: avoid;
    page-break-inside: avoid;
    flex-shrink: 0;
  }
  .signature-block > div { flex: 1; }
  .sig-img {
    display: block;
    max-width: 220px;
    height: 60px;
    object-fit: contain;
    margin-top: 8px;
  }

  /* ---- Watermark ---- */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    max-width: 340px;
    height: auto;
    opacity: 0.05;
    z-index: 0;
    pointer-events: none;
    user-select: none;
  }

  /* ---- Footer region ---- */
  .page-footer {
    flex: 0 0 auto;
    margin-left: -20mm;
    margin-right: -20mm;
    padding: 5px 20mm;
    border-top: 1px solid #d1d5db;
    text-align: right;
    font-size: 9pt;
    color: #666;
    font-family: "Courier New", monospace;
  }

  /* ---- Page break rules ---- */
  .contract-body h1 { break-after: avoid-page; }
  .contract-body h2 { break-after: avoid-page; }
  .contract-body p { orphans: 3; widows: 3; }

  /* ---- Print mode: hide the toolbar, keep the page full-bleed ---- */
  @media print {
    html, body {
      background: white;
      width: 215.9mm;
      min-height: 355.6mm;
    }
    .screen-toolbar { display: none !important; }
    .page {
      width: 215.9mm;
      min-height: 355.6mm;
      margin: 0;
      box-shadow: none;
    }
  }
`;
