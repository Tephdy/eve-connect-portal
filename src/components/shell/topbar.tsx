import type { UserRole } from "@/lib/auth/get-user-roles";
import { RoleBadge } from "./role-badge";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Topbar({
  email,
  roles,
}: {
  email: string;
  roles: UserRole[];
}) {
  return (
    <div className="flex h-14 items-center justify-between px-6">
      <div className="flex items-center gap-2">
        {roles.map((r) => (
          <RoleBadge key={r.role_key} roleKey={r.role_key} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-ink-600 sm:inline">{email}</span>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}
