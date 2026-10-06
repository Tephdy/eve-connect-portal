"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateMyProfileAction, updateMyInspectionAction } from "./actions";

const INSPECTION_ITEMS: Array<{ key: string; label: string }> = [
  { key: "switches", label: "Switches" },
  { key: "sockets", label: "Sockets" },
  { key: "cabinet", label: "Cabinet" },
  { key: "lavatory", label: "Lavatory" },
  { key: "light_bulb", label: "Light bulb" },
  { key: "faucets", label: "Faucets" },
  { key: "shower_head", label: "Shower head" },
  { key: "declogging", label: "Declogging" },
  { key: "toilet_bowl", label: "Toilet bowl" },
  { key: "kitchen_sink", label: "Kitchen sink" },
  { key: "wall_paint", label: "Wall paint" },
  { key: "optional_items", label: "Optional items" },
  { key: "door", label: "Door" },
];

export function ProfileEditForm({
  tenant,
  activeLeaseId,
  inspection,
}: {
  tenant: Record<string, string | null>;
  activeLeaseId: string | null;
  inspection: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, startSave] = useTransition();
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [inspectionErrors, setInspectionErrors] = useState<Record<string, string>>({});

  const saveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setProfileErrors({});
    startSave(async () => {
      const res = await updateMyProfileAction(fd);
      if (!res.ok) {
        if (res.fieldErrors) setProfileErrors(res.fieldErrors);
        toast.push(res.error, "error");
        return;
      }
      toast.push("Profile saved", "success");
      router.push("/portal/profile");
      router.refresh();
    });
  };

  const saveInspection = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setInspectionErrors({});
    startSave(async () => {
      const res = await updateMyInspectionAction(fd);
      if (!res.ok) {
        if (res.fieldErrors) setInspectionErrors(res.fieldErrors);
        toast.push(res.error, "error");
        return;
      }
      toast.push("Checklist saved", "success");
      router.push("/portal/profile");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href="/portal/profile"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to profile
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Edit my profile
      </h1>

      <form onSubmit={saveProfile} className="space-y-5">
        {/* ---- Personal information ---- */}
        <SectionCard
          title="Personal information"
          description="Your details as they should appear on official documents."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input name="last_name" label="Last name" required defaultValue={tenant.last_name ?? ""} error={profileErrors.last_name} />
            <Input name="first_name" label="First name" required defaultValue={tenant.first_name ?? ""} error={profileErrors.first_name} />
            <Input name="middle_name" label="Middle name" defaultValue={tenant.middle_name ?? ""} error={profileErrors.middle_name} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input name="birth_date" type="date" label="Date of birth" defaultValue={tenant.birth_date ?? ""} error={profileErrors.birth_date} />
            <Input name="gender" label="Gender" defaultValue={tenant.gender ?? ""} error={profileErrors.gender} />
            <Input name="civil_status" label="Civil status" defaultValue={tenant.civil_status ?? ""} error={profileErrors.civil_status} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input name="nationality" label="Nationality" defaultValue={tenant.nationality ?? ""} error={profileErrors.nationality} />
            <Input name="religion" label="Religion" defaultValue={tenant.religion ?? ""} error={profileErrors.religion} />
            <div className="hidden lg:block" />
          </div>

          <Input name="permanent_address" label="Permanent address" defaultValue={tenant.permanent_address ?? ""} error={profileErrors.permanent_address} />
          <Input name="recent_address" label="Recent address" defaultValue={tenant.recent_address ?? ""} error={profileErrors.recent_address} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input name="phone" label="Mobile number" required defaultValue={tenant.phone ?? ""} error={profileErrors.phone} />
            <Input name="messenger_name" label="FB / Messenger name" defaultValue={tenant.messenger_name ?? ""} error={profileErrors.messenger_name} />
            <Input name="email" type="email" label="Email" required defaultValue={tenant.email ?? ""} error={profileErrors.email} />
          </div>
        </SectionCard>

        {/* ---- Employment ---- */}
        <SectionCard
          title="Employment"
          description="Optional. Fill in if you are currently employed."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input name="company" label="Company" defaultValue={tenant.company ?? ""} error={profileErrors.company} />
            <Input name="work_status" label="Work status" defaultValue={tenant.work_status ?? ""} error={profileErrors.work_status} />
            <Input name="work_position" label="Position" defaultValue={tenant.work_position ?? ""} error={profileErrors.work_position} />
          </div>
          <Input name="company_address" label="Company address" defaultValue={tenant.company_address ?? ""} error={profileErrors.company_address} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input name="company_tel" label="Company tel. number" defaultValue={tenant.company_tel ?? ""} error={profileErrors.company_tel} />
            <Input name="company_email" label="Company email" defaultValue={tenant.company_email ?? ""} error={profileErrors.company_email} />
            <Input name="company_messenger" label="Company FB / Messenger" defaultValue={tenant.company_messenger ?? ""} error={profileErrors.company_messenger} />
          </div>
          <Input name="marketing_source" label="How did you find Eve's Residences?" defaultValue={tenant.marketing_source ?? ""} error={profileErrors.marketing_source} />
        </SectionCard>

        {/* ---- Emergency contacts ---- */}
        <SectionCard
          title="Emergency contact 1"
          description="Required. Someone we can reach in an emergency."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input name="ec1_name" label="Name" required defaultValue={tenant.ec1_name ?? ""} error={profileErrors.ec1_name} />
            <Input name="ec1_phone" label="Phone number" required defaultValue={tenant.ec1_phone ?? ""} error={profileErrors.ec1_phone} />
            <Input name="ec1_email" label="Email" defaultValue={tenant.ec1_email ?? ""} error={profileErrors.ec1_email} />
            <Input name="ec1_messenger" label="FB / Messenger" defaultValue={tenant.ec1_messenger ?? ""} error={profileErrors.ec1_messenger} />
          </div>
        </SectionCard>

        <SectionCard
          title="Emergency contact 2"
          description="Optional."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input name="ec2_name" label="Name" defaultValue={tenant.ec2_name ?? ""} />
            <Input name="ec2_phone" label="Phone number" defaultValue={tenant.ec2_phone ?? ""} />
            <Input name="ec2_email" label="Email" defaultValue={tenant.ec2_email ?? ""} />
            <Input name="ec2_messenger" label="FB / Messenger" defaultValue={tenant.ec2_messenger ?? ""} />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-3">
          <Link href="/portal/profile">
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" loading={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            Save profile
          </Button>
        </div>
      </form>

      {/* ---- Move-in checklist ---- */}
      {activeLeaseId ? (
        <form onSubmit={saveInspection} className="space-y-5">
          <input type="hidden" name="lease_id" value={activeLeaseId} />

          <SectionCard
            title="Move-in checklist"
            description="Report the condition of each item. Add comments for any damage."
          >
            <div className="max-w-xs">
              <Input
                name="number_of_persons"
                label="Number of persons"
                type="number"
                min={1}
                required
                defaultValue={String(inspection?.number_of_persons ?? "")}
                error={inspectionErrors.number_of_persons}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {INSPECTION_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="space-y-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3 dark:border-white/[0.04] dark:bg-white/[0.02]"
                >
                  <Input
                    name={item.key}
                    label={item.label}
                    defaultValue={(inspection?.[item.key] as string) ?? ""}
                    placeholder="Condition (OK, damaged, etc.)"
                  />
                  <Input
                    name={item.key + "_comment"}
                    label="Comment"
                    defaultValue={(inspection?.[item.key + "_comment"] as string) ?? ""}
                    placeholder="Any notes about this item"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="flex justify-end gap-3">
            <Button type="submit" loading={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              Save checklist
            </Button>
          </div>
        </form>
      ) : (
        <SectionCard title="Move-in checklist">
          <p className="text-sm text-ink-500">
            You don&apos;t have an active lease, so there&apos;s no checklist to fill.
          </p>
        </SectionCard>
      )}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#111318]">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs text-ink-400">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}