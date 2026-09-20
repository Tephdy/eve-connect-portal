export function ErrorState({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5">
      <p className="font-medium text-red-800">{title}</p>
      {description && <p className="text-sm text-red-700 mt-1">{description}</p>}
    </div>
  );
}