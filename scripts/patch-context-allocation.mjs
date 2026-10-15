#!/usr/bin/env node
// Adds allocation computation + return fields to reservation-context.ts.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REL = "src/lib/contracts/reservation-context.ts";
const ABS = join(ROOT, REL);
const MARKER = "// @@CONTRACT_ENGINE:promissory-context";

if (!existsSync(ABS)) { console.error("Missing:", REL); process.exit(1); }
let cur = readFileSync(ABS, "utf8");

if (cur.includes(MARKER)) { console.log("  = already patched"); process.exit(0); }

const from1 = `  const occupancySupportFee = 298;
  const totalPayable =
    totalAdvance + totalDep + addOnsAmount + occupancySupportFee;
  const amountPaid = reservationFee;
  const remainingBalance = totalPayable - amountPaid;
  const moveInPayable = remainingAdvance + deposit1 + deposit2;`;

const to1 = `  const occupancySupportFee = 298;
  const totalPayable =
    totalAdvance + totalDep + addOnsAmount + occupancySupportFee;
  const amountPaid = reservationFee;
  const remainingBalance = Math.max(0, totalPayable - amountPaid);
  const moveInPayable = remainingBalance;

  ${MARKER}
  // Option A allocation:
  //   reservation fee applies first to the 1-month advance,
  //   then remainder to the 1st security deposit.
  const appliedToAdvance = Math.min(reservationFee, totalAdvance);
  const appliedToDeposit1 = Math.max(0, reservationFee - totalAdvance);
  const remainingDeposit1 = Math.max(0, deposit1 - appliedToDeposit1);`;

if (!cur.includes(from1)) {
  console.error("Allocation anchor not found. Current:");
  const idx = cur.indexOf("occupancySupportFee");
  console.error(cur.slice(idx - 100, idx + 400));
  process.exit(1);
}
cur = cur.replace(from1, to1);

const from2 = `    days_to_move_in: String(daysToMoveIn),
    representative: "Authorized Representative",
    representative_signature,
  };`;

const to2 = `    days_to_move_in: String(daysToMoveIn),
    representative: "Authorized Representative",
    representative_signature,

    ${MARKER}
    reservation_fee_applied_to_advance: fmt(appliedToAdvance),
    reservation_fee_applied_to_deposit_1: fmt(appliedToDeposit1),
    remaining_deposit_1: fmt(remainingDeposit1),
  };`;

if (!cur.includes(from2)) {
  console.error("Return anchor not found. Current:");
  const idx = cur.indexOf("representative_signature,");
  console.error(cur.slice(idx - 100, idx + 200));
  process.exit(1);
}
cur = cur.replace(from2, to2);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(ROOT, "scripts", ".backups");
mkdirSync(dir, { recursive: true });
copyFileSync(ABS, join(dir, `reservation-context.${stamp}.bak`));

writeFileSync(ABS, cur, "utf8");
console.log("  + reservation-context.ts patched");
console.log("");
console.log("Now run: npm run typecheck");