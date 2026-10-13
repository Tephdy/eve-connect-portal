#!/usr/bin/env node
// scripts/allow-reserve-non-vacant.mjs
//
// Allows reserving units that aren't vacant (occupied, maintenance) while
// still blocking double-reservation of already-reserved units.
//
// Touches:
//   1. src/lib/db/unit-reservations.ts        — conditional unit flip
//   2. src/components/marketing/forecast-table.tsx — unblock button, pass flag
//   3. src/components/marketing/reserve-dialog.tsx — warning banner
//
// Idempotent, marker-based, backups to scripts/.backups/

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const M = {
  dalFlip:      "// @@CONTRACT_ENGINE:reserve-conditional-flip",
  tableEnable:  "// @@CONTRACT_ENGINE:reserve-allow-non-vacant",
  dialogWarn:   "// @@CONTRACT_ENGINE:reserve-warning-banner",
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

console.log("Allow reserve on non-vacant units");
console.log("=================================");

// ===========================================================================
// 1. src/lib/db/unit-reservations.ts — conditional unit flip
//    Only flip to "reserved" if the unit was vacant. If occupied/maintenance,
//    leave the status intact — the reservation is a soft hold.
// ===========================================================================
replaceOnce(
  "src/lib/db/unit-reservations.ts",
  `  if (error) throw new Error(error.message);

  // Flip unit status
  await admin.from("unit").update({ status: "reserved" }).eq("id", input.unit_id);

  return data as UnitReservation;
}`,
  `  if (error) throw new Error(error.message);

  // @@CONTRACT_ENGINE:reserve-conditional-flip
  // Only flip to "reserved" when the unit is currently vacant. If it's
  // occupied or under maintenance, preserve that status — the reservation
  // acts as a soft hold for when the unit becomes available.
  const { data: currentUnit } = await admin
    .schema("core")
    .from("unit")
    .select("status")
    .eq("id", input.unit_id)
    .maybeSingle();

  const priorStatus = (currentUnit as { status?: string } | null)?.status;

  if (priorStatus === "vacant") {
    await admin
      .schema("core")
      .from("unit")
      .update({ status: "reserved" })
      .eq("id", input.unit_id);
  }
  // Otherwise: leave occupied/maintenance/reserved untouched.

  return data as UnitReservation;
}`,
  M.dalFlip
);

// ===========================================================================
// 2. src/components/marketing/forecast-table.tsx — unblock button
//    Change: `disabled={u.status !== "vacant"}` → `disabled={u.status === "reserved"}`
//    And pass `unitStatus` to ReserveDialog so it can show a warning.
// ===========================================================================
replaceOnce(
  "src/components/marketing/forecast-table.tsx",
  `                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setReserving(u.id)}
                              disabled={u.status !== "vacant"}
                            >
                              Reserve
                            </Button>
                          )}`,
  `                          ) : (
                            // @@CONTRACT_ENGINE:reserve-allow-non-vacant
                            // Allow reserving any unit except already-reserved ones.
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setReserving(u.id)}
                              disabled={u.status === "reserved"}
                            >
                              Reserve
                            </Button>
                          )}`,
  M.tableEnable
);

// ===========================================================================
// 3. src/components/marketing/reserve-dialog.tsx — warning banner
//    Show an amber warning when the unit is not vacant.
// ===========================================================================
replaceOnce(
  "src/components/marketing/reserve-dialog.tsx",
  `        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reserve Unit {unit.unit_number}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>`,
  `        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reserve Unit {unit.unit_number}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* @@CONTRACT_ENGINE:reserve-warning-banner */}
        {unit.status !== "vacant" && unit.status !== "reserved" && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <strong className="font-semibold">⚠ Unit is currently {unit.status}.</strong>{" "}
            Reserving creates a <strong>soft hold only</strong>. The unit status will
            not change, and the reservation does not guarantee availability. Contact
            the current occupant or maintenance to confirm a handover date.
          </div>
        )}`,
  M.dialogWarn
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. npm run typecheck");
console.log("  2. Test: forecast → pick an occupied unit → Reserve button is enabled");
console.log("     → dialog shows amber warning → reserve succeeds");
console.log("  3. Confirm the reserved unit's status stayed 'occupied' (not flipped)");
console.log("");
console.log("Backups in scripts/.backups/");