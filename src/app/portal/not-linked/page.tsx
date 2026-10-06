export default function NotLinkedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="max-w-md space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <h1 className="text-lg font-semibold text-amber-800 dark:text-amber-400">
          Account not yet linked
        </h1>
        <p className="text-sm text-ink-600">
          Your account exists but isn't linked to a tenant record yet.
          Please contact the management office and ask them to link your account.
        </p>
      </div>
    </div>
  );
}
