"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/get-session";
import { refundDeposit } from "@/lib/db/deposits";
import { logAudit } from "@/lib/audit/log";
import { emit } from "@/lib/events/emit";

export async function refundDepositAction(
  id: string,
  amount: number,
  forfeit: boolean
) {
  await assertPermission("deposit:refund");
  const session = await getSession();

  await refundDeposit(id, amount, forfeit);

  await logAudit({
    actor_id: session?.id ?? null,
    entity_type: "deposit",
    entity_id: id,
    action: "update",
    after: { refunded_amount: amount, forfeited: forfeit },
  });

  await emit("deposit.refunded", { deposit_id: id, amount, forfeit }, session?.id ?? null);

  revalidatePath("/accounting/deposits");
}
