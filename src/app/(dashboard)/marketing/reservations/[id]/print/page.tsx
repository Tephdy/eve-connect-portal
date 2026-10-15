// // @@CONTRACT_ENGINE:reservation-print-legal-layout
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import {
  ensureRepresentativeSignatureMarkup,
  ensureTenantSignatureMarkup,
} from "@/lib/contracts/reservation-attach";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ReservationContractPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requirePagePermission("unit:read");
  const { id } = await params;
  const sp = await searchParams;
  const backPath =
    sp.returnTo === "property"
      ? `/property/reservations/${id}`
      : `/marketing/reservations/${id}`;

  const admin = createAdminClient();

  const { data: contract } = await admin
    .schema("prep")
    .from("reservation_contract")
    .select("id, generated_body, status, signed_at, reservation_id, tenant_signature")
    .eq("reservation_id", id)
    .maybeSingle();

  if (!contract) notFound();

  // Resolve property for letterhead
  const { data: reservation } = await admin
    .schema("acct")
    .from("unit_reservation")
    .select("unit_id")
    .eq("id", id)
    .maybeSingle();

  let propertyName = "Eve's Residences";
  let logoFilename = "eves_logo.png";
  if (reservation?.unit_id) {
    const { data: unit } = await admin
      .schema("core")
      .from("unit")
      .select("property_id")
      .eq("id", reservation.unit_id)
      .maybeSingle();

    if (unit?.property_id) {
      const { data: prop } = await admin
        .schema("core")
        .from("property")
        .select("name")
        .eq("id", unit.property_id)
        .maybeSingle();
      propertyName = prop?.name ?? propertyName;
      if (propertyName.toUpperCase().includes("BED AND BATH")) {
        logoFilename = "bnb_logo.png";
      }
    }
  }

  // Some older contracts were rendered before the rep signature placeholder was
  // added to the reservation template; repair them in memory before printing.
  const bodyHtml = ensureTenantSignatureMarkup(
    ensureRepresentativeSignatureMarkup(contract.generated_body ?? ""),
    contract.tenant_signature
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <div className="print-root">
        <div className="screen-toolbar">
          <a href={backPath} className="back-link">
            ← Back to reservation
          </a>
          <button type="button" className="print-btn">
            Print / Save as PDF
          </button>
        </div>
        <article className="page">
          <header className="letterhead">
            <img className="header-logo" src={"/" + logoFilename} alt="" />
            <div className="letterhead-text">
              <h1 className="letterhead-title">{propertyName}</h1>
              <p className="letterhead-subtitle">RESERVATION AGREEMENT</p>
            </div>
          </header>

          <section
            className="contract-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
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
  /* @@CONTRACT_ENGINE:print-pagination-fix */
  @page {
    size: 8.5in 14in;
    margin: 0.6in 0.65in;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #e5e7eb;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* On-screen only: allow the page to scroll */
  @media screen {
    html, body {
      overflow: auto;
      height: auto;
      min-height: 100%;
    }
  }

  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #111;
    font-size: 11pt;
    line-height: 1.45;
  }

  .print-root {
    padding: 0 0 40px 0;
  }

  .screen-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    background: #1f2937;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
  }
  .screen-toolbar .back-link { color: #cbd5e1; text-decoration: none; }
  .screen-toolbar .back-link:hover { color: white; }
  .screen-toolbar .print-btn {
    background: #3b6fff;
    color: white;
    border: 0;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
  }

  /* On-screen preview: mimic Legal sheet; height grows with content */
  .page {
    width: 8.5in;
    margin: 24px auto;
    padding: 20mm 18mm;
    background: white;
    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
  }

  .letterhead {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 12px;
    margin-bottom: 14px;
    border-bottom: 1px solid #d1d5db;
  }
  .header-logo { height: 55px; width: auto; flex-shrink: 0; }
  .letterhead-text { flex: 1; }
  .letterhead-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 19px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.4px;
  }
  .letterhead-subtitle {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #6b7280;
    margin: 2px 0 0 0;
  }

  .contract-body {
    display: block;
  }

  .contract-body h1 { font-size: 15pt; margin: 12px 0 8px; page-break-after: avoid; }
  .contract-body h2 { font-size: 12pt; margin: 10px 0 6px; page-break-after: avoid; }
  .contract-body h3 { font-size: 11pt; margin: 8px 0 4px; page-break-after: avoid; }

  .contract-body table.contract-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }
  .contract-body table.contract-table td {
    border: 1px solid #999;
    padding: 4px 6px;
    vertical-align: top;
    font-size: 10pt;
  }
  .contract-body table.contract-table tr { page-break-inside: avoid; }

  .contract-body ul,
  .contract-body ol {
    margin: 6px 0 6px 20px;
    padding: 0;
  }
  .contract-body li { page-break-inside: avoid; }
  .contract-body p { margin: 6px 0; page-break-inside: avoid; }

  /* @@CONTRACT_ENGINE:bigger-signature-boxes */
  .rep-signature,
  .client-signature {
    display: block;
    max-height: 90px;
    min-height: 60px;
    width: auto;
    max-width: 280px;
    margin: 6px 0 2px 0;
    page-break-inside: avoid;
  }

  /* Reserved blank space when unsigned — 260x90 block */
  .client-signature-blank {
    display: block;
    width: 260px;
    height: 90px;
    border-bottom: 1px solid #333;
    margin: 12px 0 8px 0;
    page-break-inside: avoid;
  }

  /* Print mode: kill screen chrome, let content flow across pages */
  @media print {
    html, body {
      background: white !important;
      overflow: visible !important;
      height: auto !important;
      min-height: 0 !important;
    }
    .app-shell-v2 {
      display: block !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
    }
    .app-sidebar-v2,
    .app-header-v2,
    .app-shell-v2 > :not(.app-main-v2),
    .screen-toolbar {
      display: none !important;
    }
    .app-main-v2 {
      display: block !important;
      position: static !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .app-main-v2 > div {
      max-width: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .page {
      width: auto !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
    .print-root {
      padding: 0 !important;
      margin: 0 !important;
    }
    .contract-body {
      display: block !important;
    }
    /* Ensure no ancestor forces a single block */
    article, section, header {
      break-inside: auto;
      page-break-inside: auto;
    }
  }
`;
