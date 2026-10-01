// apply-tenant-status-import.mjs
// Adds Status field to the tenants import target.
// Idempotent. Backs up each touched file.

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";

const F_DEFS   = "src/lib/import/field-defs.ts";
const F_COMMIT = "src/lib/import/commit.ts";
const F_VALID  = "src/lib/import/validate.ts";

function nlOf(s) { return s.includes("\r\n") ? "\r\n" : "\n"; }
function norm(s) { return s.replace(/\r\n/g, "\n"); }
function denorm(s, nl) { return nl === "\r\n" ? s.replace(/\n/g, "\r\n") : s; }

function patch(path, mutate, label) {
  if (!existsSync(path)) { console.error("MISSING " + path); process.exit(1); }
  const original = readFileSync(path, "utf8");
  const nl = nlOf(original);
  const src = norm(original);
  const out = mutate(src);
  if (out === null) { console.log("SKIP  " + path + "  (already applied)"); return; }
  if (out === src)   { console.log("NO CHANGE  " + path + "  (anchor not found)"); return; }
  copyFileSync(path, path + ".bak");
  writeFileSync(path, denorm(out, nl), "utf8");
  console.log("PATCH " + path + "  (" + label + ")");
}

// ---------------------------------------------------------------------
// 1. field-defs.ts — add status field to tenants target
// ---------------------------------------------------------------------
patch(F_DEFS, (src) => {
  if (src.includes('key: "status", label: "Status"')) return null;

  const anchor = '{ key: "government_id", label: "Government ID", required: false, type: "text", aliases: ["id", "gov id", "government id"] },';
  if (!src.includes(anchor)) return src; // no-op if anchor missing

  const insert = anchor + '\n      { key: "status", label: "Status", required: false, type: "enum", enumValues: ["prospect", "active", "former", "blacklisted"], aliases: ["status", "state", "tenant status"], hint: "prospect, active, former, blacklisted" },';
  return src.replace(anchor, insert);
}, "added status to tenants target");

// ---------------------------------------------------------------------
// 2. commit.ts — read status from row
// ---------------------------------------------------------------------
patch(F_COMMIT, (src) => {
  if (src.includes("ALLOWED_STATUS")) return null;

  const oldBlock = `      else if (input.target === "tenants") {
        const email = clean(row.mapped.email).toLowerCase();
        const payload = {
          full_name: clean(row.mapped.full_name),
          email: email || null,
          phone: clean(row.mapped.phone) || null,
          messenger_name: clean(row.mapped.messenger_name) || null,
          government_id: clean(row.mapped.government_id) || null,
          status: "active",
        };`;

  const newBlock = `      else if (input.target === "tenants") {
        const email = clean(row.mapped.email).toLowerCase();
        const statusRaw = clean(row.mapped.status).toLowerCase();
        const ALLOWED_STATUS = ["prospect", "active", "former", "blacklisted"];
        const status = ALLOWED_STATUS.includes(statusRaw) ? statusRaw : "active";
        const payload = {
          full_name: clean(row.mapped.full_name),
          email: email || null,
          phone: clean(row.mapped.phone) || null,
          messenger_name: clean(row.mapped.messenger_name) || null,
          government_id: clean(row.mapped.government_id) || null,
          status,
        };`;

  if (!src.includes(oldBlock)) return src;
  return src.replace(oldBlock, newBlock);
}, "read status from row.mapped");

// ---------------------------------------------------------------------
// 3. validate.ts — fix mojibake in enum warning
// ---------------------------------------------------------------------
patch(F_VALID, (src) => {
  if (!src.includes("-”")) return null;
  return src.replace(/-”/g, "-");
}, "fixed mojibake in validate.ts");