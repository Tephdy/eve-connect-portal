#!/usr/bin/env node
// Injects a blank signature line when the reservation is unsigned.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REL = "src/lib/contracts/reservation-attach.ts";
const ABS = join(ROOT, REL);
const MARKER = "// @@CONTRACT_ENGINE:blank-slot-when-unsigned";

if (!existsSync(ABS)) { console.error("Missing:", REL); process.exit(1); }
const cur = readFileSync(ABS, "utf8");
if (cur.includes(MARKER)) { console.log("  = already patched"); process.exit(0); }

const from = `export function ensureTenantSignatureMarkup(
  body: string,
  tenantSignature: string | null | undefined
): string {
  if (!body || !tenantSignature) return body;

  const escapedSignature = tenantSignature
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const signatureImage =
    '<img class="client-signature" src="' +
    escapedSignature +
    '" alt="Tenant signature" />';
  const withoutOldSignature = body.replace(
    /<p>\\s*<img\\b(?=[^>]*\\bclass=["'][^"']*\\bclient-signature\\b[^"']*["'])[^>]*>\\s*<\\/p>\\s*/gi,
    ""
  );
  const declarationIndex = withoutOldSignature.search(
    /<h[1-6]\\b[^>]*>\\s*12\\.\\s*DECLARATION\\s*<\\/h[1-6]>/i
  );
  if (declarationIndex < 0) return body;

  const declaration = withoutOldSignature.slice(declarationIndex);
  const clientNameBlock =
    /<p>\\s*<strong>[^<]*<\\/strong>\\s*<br\\s*\\/?>\\s*NAME\\s*\\/\\s*SIGNATURE\\s*<\\/p>/i;
  const blockMatch = declaration.match(clientNameBlock);
  if (!blockMatch || blockMatch.index === undefined) return body;

  const insertionPoint = declarationIndex + blockMatch.index;
  return (
    withoutOldSignature.slice(0, insertionPoint) +
    signatureImage +
    "\\n" +
    withoutOldSignature.slice(insertionPoint)
  );
}`;

const to = `export function ensureTenantSignatureMarkup(
  body: string,
  tenantSignature: string | null | undefined
): string {
  ${MARKER}
  // Always inject a signature slot: image if signed, blank line if unsigned.
  if (!body) return body;

  let signatureImage: string;
  if (tenantSignature) {
    const escapedSignature = tenantSignature
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    signatureImage =
      '<img class="client-signature" src="' +
      escapedSignature +
      '" alt="Tenant signature" />';
  } else {
    // Blank ruled line for the tenant to sign on
    signatureImage = '<span class="client-signature-blank" aria-hidden="true"></span>';
  }

  const withoutOldSignature = body
    .replace(
      /<p>\\s*<img\\b(?=[^>]*\\bclass=["'][^"']*\\bclient-signature\\b[^"']*["'])[^>]*>\\s*<\\/p>\\s*/gi,
      ""
    )
    .replace(
      /<p>\\s*<span\\b(?=[^>]*\\bclass=["'][^"']*\\bclient-signature-blank\\b[^"']*["'])[^>]*>\\s*<\\/span>\\s*<\\/p>\\s*/gi,
      ""
    );
  const declarationIndex = withoutOldSignature.search(
    /<h[1-6]\\b[^>]*>\\s*12\\.\\s*DECLARATION\\s*<\\/h[1-6]>/i
  );
  if (declarationIndex < 0) return body;

  const declaration = withoutOldSignature.slice(declarationIndex);
  const clientNameBlock =
    /<p>\\s*<strong>[^<]*<\\/strong>\\s*<br\\s*\\/?>\\s*NAME\\s*\\/\\s*SIGNATURE\\s*<\\/p>/i;
  const blockMatch = declaration.match(clientNameBlock);
  if (!blockMatch || blockMatch.index === undefined) return body;

  const insertionPoint = declarationIndex + blockMatch.index;
  return (
    withoutOldSignature.slice(0, insertionPoint) +
    signatureImage +
    "\\n" +
    withoutOldSignature.slice(insertionPoint)
  );
}`;

if (!cur.includes(from)) {
  console.error("Function anchor not found. Current definition:");
  const idx = cur.indexOf("export function ensureTenantSignatureMarkup");
  console.error(cur.slice(idx, idx + 1600));
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(ROOT, "scripts", ".backups");
mkdirSync(dir, { recursive: true });
copyFileSync(ABS, join(dir, `reservation-attach.${stamp}.bak`));

writeFileSync(ABS, cur.replace(from, to), "utf8");
console.log("  + ensureTenantSignatureMarkup now injects a blank slot when unsigned");