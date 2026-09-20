const LABELS: Record<string, string> = {
  accounting: "Accounting",
  marketing: "Marketing",
  maintenance: "Maintenance",
  property_rep: "Property Rep",
  executive: "Executive",
  system_admin: "System Admin",
};

export function RoleBadge({ roleKey }: { roleKey: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-0.5">
      {LABELS[roleKey] ?? roleKey}
    </span>
  );
}
