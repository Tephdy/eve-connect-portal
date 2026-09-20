import "server-only";

export async function onTenantCreated(payload: { tenant_id: string }) {
  // Phase 3 will hook accounting ledger initialization here.
}
