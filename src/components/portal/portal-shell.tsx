import Link from "next/link";
import { Home, FileText, Receipt, CreditCard, Droplet, LogOut } from "lucide-react";

const NAV = [
  { href: "/portal",           label: "Home",      icon: Home },
  { href: "/portal/lease",     label: "Lease",     icon: FileText },
  { href: "/portal/invoices",  label: "Invoices",  icon: Receipt },
  { href: "/portal/payments",  label: "Payments",  icon: CreditCard },
  { href: "/portal/utilities", label: "Utilities", icon: Droplet },
];

export function PortalShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-surface/95 backdrop-blur dark:border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
              <span className="text-xs font-bold text-white">E</span>
            </div>
            <span className="text-sm font-semibold text-ink-900">
              Eve's Residences
            </span>
          </Link>
          <span className="truncate text-xs text-ink-500">{email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-surface/95 backdrop-blur dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-2xl items-center justify-around">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-ink-600 hover:text-brand-600 dark:hover:text-brand-400"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <form action="/portal/logout" method="post" className="flex-1">
            <button
              type="submit"
              className="flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-ink-600 hover:text-danger-600 dark:hover:text-danger-500"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </div>
  );
}
