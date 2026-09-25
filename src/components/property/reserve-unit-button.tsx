"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReserveUnitDialog } from "./reserve-unit-dialog";
import type { Unit } from "@/lib/db/units";
import type { Inquiry } from "@/lib/db/inquiries";

export function ReserveUnitButton({
  units,
  inquiries,
}: {
  units: Unit[];
  inquiries: Inquiry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Reserve a unit
      </Button>
      {open && (
        <ReserveUnitDialog
          units={units}
          inquiries={inquiries}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
