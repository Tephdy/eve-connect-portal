import { invoicePaidNoPayment } from "./invoice-paid-no-payment";
import { paymentExceedsInvoice } from "./payment-exceeds-invoice";
import { duplicatePayment } from "./duplicate-payment";
import { paymentBeforeInvoice } from "./payment-before-invoice";
import { overdueInvoiceUnflagged } from "./overdue-invoice-unflagged";
import { depositHeldTooLong } from "./deposit-held-too-long";
import { leaseTerminatedWithUnpaid } from "./lease-terminated-with-unpaid";
import { manualInvoiceWithoutLease } from "./manual-invoice-without-lease";
import { ledgerMismatch } from "./ledger-mismatch";
import { sameUserCreatedAndApproved } from "./same-user-created-and-approved";
import { penaltyWithoutOverdue } from "./penalty-without-overdue";
import { orphanInvoice } from "./orphan-invoice";

export const RULES = [
  invoicePaidNoPayment,
  paymentExceedsInvoice,
  duplicatePayment,
  paymentBeforeInvoice,
  overdueInvoiceUnflagged,
  depositHeldTooLong,
  leaseTerminatedWithUnpaid,
  manualInvoiceWithoutLease,
  ledgerMismatch,
  sameUserCreatedAndApproved,
  penaltyWithoutOverdue,
  orphanInvoice,
];
