export type CalendarEventType =
  | "rent_due"
  | "invoice_due"
  | "lease_starting"
  | "lease_ending"
  | "payment";

export type ViewMode = "month" | "week" | "list";

export type CalendarEvent = {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  href?: string;
  property_id?: string;
  property_name?: string;
  /** Source record id — the lease id for lease events, invoice id for invoices, etc. */
  source_id?: string;
  meta?: Record<string, string | number | undefined>;
};

export type CalendarMonth = {
  year: number;
  month: number;
  eventsByDate: Record<string, CalendarEvent[]>;
};

export type CalendarFilters = {
  property_id?: string | null;
  types: CalendarEventType[];
};

export const ALL_TYPES: CalendarEventType[] = [
  "rent_due",
  "invoice_due",
  "lease_starting",
  "lease_ending",
  "payment",
];

export const TYPE_LABELS: Record<CalendarEventType, string> = {
  rent_due: "Rent due",
  invoice_due: "Invoice due",
  lease_starting: "Lease starts",
  lease_ending: "Lease ends",
  payment: "Payment received",
};

export const TYPE_COLORS: Record<
  CalendarEventType,
  { dot: string; bg: string; text: string; border: string }
> = {
  rent_due: {
    dot: "bg-brand-500",
    bg: "bg-brand-500/10",
    text: "text-brand-700 dark:text-brand-400",
    border: "border-brand-500/30",
  },
  invoice_due: {
    dot: "bg-warning-500",
    bg: "bg-warning-500/10",
    text: "text-warning-700 dark:text-warning-500",
    border: "border-warning-500/30",
  },
  lease_starting: {
    dot: "bg-success-500",
    bg: "bg-success-500/10",
    text: "text-success-700 dark:text-success-500",
    border: "border-success-500/30",
  },
  lease_ending: {
    dot: "bg-danger-500",
    bg: "bg-danger-500/10",
    text: "text-danger-700 dark:text-danger-500",
    border: "border-danger-500/30",
  },
  payment: {
    dot: "bg-success-500",
    bg: "bg-success-500/10",
    text: "text-success-700 dark:text-success-500",
    border: "border-success-500/30",
  },
};
