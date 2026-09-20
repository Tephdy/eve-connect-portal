export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="py-12 text-center text-sm text-gray-500">{label}</div>
  );
}