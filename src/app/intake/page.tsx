import { IntakeForm } from "./intake-form";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  return (
    <div className="h-screen overflow-y-auto bg-ink-50/60 dark:bg-[#0a0b0f]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Tenant intake form
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Fill in your details and sign to begin your lease with Eve's Residences.
          </p>
        </div>
        <IntakeForm />
      </div>
    </div>
  );
}