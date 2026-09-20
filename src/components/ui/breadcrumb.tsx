import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumb({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav className={cn("flex items-center gap-1 text-sm text-ink-500", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-ink-800 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-ink-900 font-medium" : ""}>{item.label}</span>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 text-ink-300" />}
          </span>
        );
      })}
    </nav>
  );
}
