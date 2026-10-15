// @@CONTRACT_ENGINE:reservation-edit-page
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guard";
import { getReservation } from "@/lib/db/unit-reservations";
import { PageHeader } from "@/components/layout/page-header";
import { EditForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("unit:reserve");
  const { id } = await params;

  const reservation = await getReservation(id);
  if (!reservation) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/marketing/reservations/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to reservation
      </Link>

      <PageHeader
        title={`Edit ${reservation.client_name}`}
        description="Update reservation details. The contract will regenerate on save."
      />

      <EditForm reservation={reservation} />
    </div>
  );
}
