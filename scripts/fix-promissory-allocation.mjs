#!/usr/bin/env node
// scripts/fix-promissory-allocation.mjs
//
// Fixes the Promissory Letter allocation logic. Types file already patched
// in a previous run; this script finishes the context + migration.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const M = {
  context:   "// @@CONTRACT_ENGINE:promissory-context",
  migration: "/* @@CONTRACT_ENGINE:promissory-migration */",
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
  if (!cur.includes(from)) throw new Error(`Anchor not found in ${rel}:\n---\n${from.slice(0, 300)}`);
  backup(abs); writeFileSync(abs, cur.replace(from, to), "utf8");
  console.log(`  + ${rel} (patched)`);
}

function writeOrSkip(rel, body, marker) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  if (existsSync(abs) && readFileSync(abs, "utf8").includes(marker)) {
    console.log(`  = ${rel} (up to date)`); return;
  }
  backup(abs); writeFileSync(abs, body, "utf8");
  console.log(`  + ${rel} (written)`);
}

console.log("Fix Promissory Letter allocation");
console.log("================================");

// ===========================================================================
// 1. reservation-context.ts — replace the derived-values block
// ===========================================================================
replaceOnce(
  "src/lib/contracts/reservation-context.ts",
  `  const occupancySupportFee = 298;
  const totalPayable =
    totalAdvance + totalDep + addOnsAmount + occupancySupportFee;
  const amountPaid = reservationFee;
  const remainingBalance = totalPayable - amountPaid;
  const moveInPayable = remainingAdvance + deposit1 + deposit2;`,
  `  const occupancySupportFee = 298;
  const totalPayable =
    totalAdvance + totalDep + addOnsAmount + occupancySupportFee;
  const amountPaid = reservationFee;
  const remainingBalance = Math.max(0, totalPayable - amountPaid);
  const moveInPayable = remainingBalance;

  // ${M.context}
  // Option A allocation:
  //   reservation fee applies first to the 1-month advance,
  //   then the remainder to the 1st security deposit.
  const appliedToAdvance = Math.min(reservationFee, totalAdvance);
  const appliedToDeposit1 = Math.max(0, reservationFee - totalAdvance);
  const remainingDeposit1 = Math.max(0, deposit1 - appliedToDeposit1);`,
  M.context
);

// ===========================================================================
// 2. reservation-context.ts — add the new keys to the return object
// ===========================================================================
replaceOnce(
  "src/lib/contracts/reservation-context.ts",
  `    days_to_move_in: String(daysToMoveIn),
    representative: "Authorized Representative",
    representative_signature,
  };`,
  `    days_to_move_in: String(daysToMoveIn),
    representative: "Authorized Representative",
    representative_signature,

    // ${M.context}
    reservation_fee_applied_to_advance: fmt(appliedToAdvance),
    reservation_fee_applied_to_deposit_1: fmt(appliedToDeposit1),
    remaining_deposit_1: fmt(remainingDeposit1),
  };`,
  M.context + "-return"
);

// ===========================================================================
// 3. Migration
// ===========================================================================
writeOrSkip(
  "supabase/migrations/20261015000006_update_promissory_letter.sql",
  `-- ---------------------------------------------------------------------------
-- 20261015000006_update_promissory_letter.sql
--
-- Updates the reservation template's Promissory Letter to reflect the correct
-- allocation of the reservation fee (Option A).
-- Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  v_body text;
  v_before text;
  v_old_letter text;
  v_new_letter text;
begin
  select body_markdown into v_body
  from prep.contract_template
  where doc_type = 'reservation' and active = true
  limit 1;

  if v_body is null then
    raise exception 'No active reservation template found';
  end if;

  if v_body like '%reservation_fee_applied_to_advance%' then
    raise notice 'Template already updated - skipping.';
    return;
  end if;

  v_before := v_body;

  v_old_letter := '<ul>
  <li>One (1) Month Advance (P{{total_advance}}): Payable on {{one_month_advance_date}}</li>
  <li>1st Security Deposit (P{{first_deposit}}): Payable on {{first_security_date}}</li>
  <li>2nd Security Deposit (P{{second_deposit}}): Payable on {{second_security_date}}</li>
</ul>';

  v_new_letter := '<ul>
  <li>One (1) Month Advance (P{{total_advance}}): Payable on {{one_month_advance_date}} &mdash; P{{reservation_fee_applied_to_advance}} applied from reservation fee</li>
  <li>1st Security Deposit (P{{first_deposit}}): Payable on {{first_security_date}} &mdash; P{{reservation_fee_applied_to_deposit_1}} applied from reservation fee, remaining P{{remaining_deposit_1}}</li>
  <li>2nd Security Deposit (P{{second_deposit}}): Payable on {{second_security_date}}</li>
  <li>Occupancy Support Fee (P{{occupancy_fee}}): Payable on move-in day</li>
</ul>
<p>
Total remaining balance: P{{remaining_balance}}<br/>
Total amount to be paid on move-in day: P{{move_in_payable}}
</p>';

  v_body := replace(v_body, v_old_letter, v_new_letter);

  if v_body = v_before then
    raise notice 'Promissory Letter bullet list not found - body unchanged.';
    return;
  end if;

  update prep.contract_template
  set body_markdown = v_body,
      version = version + 1
  where doc_type = 'reservation' and active = true;

  raise notice 'Updated Promissory Letter (version bumped).';
end $$;
`,
  M.migration
);

console.log("");
console.log("Done. Next steps:");
console.log("  1. Apply migration 20261015000006_update_promissory_letter.sql in SQL Editor");
console.log("  2. npm run typecheck");
console.log("  3. Regenerate the reservation contract");
console.log("  4. Print preview");
console.log("");
console.log("Backups in scripts/.backups/");