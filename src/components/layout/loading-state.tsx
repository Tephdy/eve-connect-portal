export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="py-12 text-center text-sm text-ink-500">{label}</div>
  );
}