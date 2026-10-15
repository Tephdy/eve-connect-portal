#!/usr/bin/env node
// scripts/reserve-signature-space.mjs
//
// 1. Always inject a client signature slot into the reservation contract
//    body — as an image if signed, as a blank signature line if unsigned.
// 2. Enlarge the print CSS for both signature types.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const M = {
  attach: "// @@CONTRACT_ENGINE:always-inject-client-slot",
  css:    "/* @@CONTRACT_ENGINE:bigger-signature-boxes */",
};

function backup(abs) {
  if (!existsSync(abs)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(ROOT, "scripts", ".backups");
  mkdirSync(dir, { recursive: true });
  copyFileSync(abs, join(dir, `${abs.split(/[\\/]/).pop()}.${stamp}.bak`));
}

function replaceOnce(rel, from, to, marker) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) throw new Error(`Missing: ${rel}`);
  const cur = readFileSync(abs, "utf8");
  if (cur.includes(marker)) { console.log(`  = ${rel} (already patched)`); return; }
  if (!cur.includes(from)) throw new Error(`Anchor not found in ${rel}`);
  backup(abs); writeFileSync(abs, cur.replace(from, to), "utf8");
  console.log(`  + ${rel} (patched)`);
}

console.log("Reserve signature space");
console.log("=======================");

// 1. Always inject a signature slot into the body
replaceOnce(
  "src/lib/contracts/reservation-attach.ts",
  `    // // @@CONTRACT_ENGINE:client-signature-injection
    // Inject the client signature into the body, above the NAME / SIGNATURE
    // block for the client. Only if the reservation has already been signed.
    {
      const { data: sigRow } = await admin
        .schema("prep")
        .from("reservation_contract")
        .select("tenant_signature")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      const sigUrl = sigRow?.tenant_signature;
      if (sigUrl) {
        const sigImg =
          '<p><img class="client-signature" src="' +
          sigUrl +
          '" alt="Client signature" /></p>';

        // The template ends with:
        //   <p><strong>{{legal_name}}</strong><br/>NAME / SIGNATURE</p>
        // Insert the signature image just above it.
        rendered = rendered.replace(
          /<p><strong>([^<]*)<\\/strong><br\\/>NAME \\/ SIGNATURE<\\/p>/,
          sigImg + '<p><strong>$1</strong><br/>NAME / SIGNATURE</p>'
        );
      }
    }`,
  `    // ${M.attach}
    // Always inject a client signature slot into the body above
    // the NAME / SIGNATURE line. If signed → real image; if unsigned → a
    // blank line for the tenant to sign on.
    {
      const { data: sigRow } = await admin
        .schema("prep")
        .from("reservation_contract")
        .select("tenant_signature")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      const sigUrl = sigRow?.tenant_signature;
      const sigBlock = sigUrl
        ? '<p><img class="client-signature" src="' + sigUrl + '" alt="Client signature" /></p>'
        : '<p><span class="client-signature-blank" aria-hidden="true"></span></p>';

      rendered = rendered.replace(
        /<p>\\s*<strong>([^<]*)<\\/strong>\\s*<br\\s*\\/?>\\s*NAME\\s*\\/\\s*SIGNATURE\\s*<\\/p>/,
        sigBlock + '<p><strong>$1</strong><br/>NAME / SIGNATURE</p>'
      );
    }`,
  M.attach
);

// 2. Bigger signature boxes in print CSS
replaceOnce(
  "src/app/(dashboard)/marketing/reservations/[id]/print/page.tsx",
  `  .rep-signature { display: block; max-height: 55px; width: auto; margin: 6px 0 2px 0; page-break-inside: avoid; }
  .client-signature { display: block; max-height: 55px; width: auto; margin: 6px 0 2px 0; page-break-inside: avoid; }`,
  `  ${M.css}
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

  /* Reserved blank space when unsigned */
  .client-signature-blank {
    display: inline-block;
    width: 240px;
    height: 70px;
    border-bottom: 1px solid #333;
    margin: 10px 0 6px 0;
    page-break-inside: avoid;
  }`,
  M.css
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. npm run typecheck");
console.log("  2. Regenerate the reservation contract");
console.log("  3. Print preview:");
console.log("     - unsigned contract → shows a blank signature line");
console.log("     - signed contract   → shows the actual signature image");
console.log("");
console.log("Backups in scripts/.backups/");