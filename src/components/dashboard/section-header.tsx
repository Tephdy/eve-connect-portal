import Link from "next/link";

export function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
