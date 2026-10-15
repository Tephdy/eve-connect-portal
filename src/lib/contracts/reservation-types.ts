// @@CONTRACT_ENGINE:reservation-types
export type ReservationPlaceholderKey =
  | "legal_name" | "age" | "gender" | "company_name" | "messenger_account"
  | "position" | "vehicle_plate" | "valid_id" | "declared_occupants"
  | "contact_no" | "target_move_in_date" | "email"
  | "unit_type" | "property" | "advance_paid" | "total_dep" | "total_rental"
  | "reservation_fee" | "add_ons" | "ac_amount" | "bf_amount"
  | "foam_amount" | "others_amount" | "add_ons_amount"
  | "admin_fee" | "occupancy_fee" | "total_payable" | "amount_paid"
  | "total_advance" | "remaining_advance" | "move_in_payable"
  | "first_deposit" | "second_deposit"
  | "one_month_advance_date" | "first_security_date" | "second_security_date"
  | "reservation_no_refund" | "first_sec_no_refund"
  | "days_to_move_in" | "representative"
  | "remaining_balance"
  // @@CONTRACT_ENGINE:rep-signature-types
  | "representative_signature"
  // // @@CONTRACT_ENGINE:promissory-types
  | "reservation_fee_applied_to_advance"
  | "reservation_fee_applied_to_deposit_1"
  | "remaining_deposit_1";

export type ReservationContext = {
  legal_name: string;
  age: string;
  gender: string;
  company_name: string;
  messenger_account: string;
  position: string;
  vehicle_plate: string;
  valid_id: string;
  declared_occupants: string;
  contact_no: string;
  target_move_in_date: string;
  email: string;

  unit_type: string;
  property: string;
  advance_paid: string;
  total_dep: string;
  total_rental: string;
  reservation_fee: string;
  add_ons: string;
  ac_amount: string;
  bf_amount: string;
  foam_amount: string;
  others_amount: string;
  add_ons_amount: string;
  admin_fee: string;
  occupancy_fee: string;
  total_payable: string;
  amount_paid: string;

  total_advance: string;
  remaining_advance: string;
  move_in_payable: string;
  first_deposit: string;
  second_deposit: string;

  one_month_advance_date: string;
  first_security_date: string;
  second_security_date: string;
  reservation_no_refund: string;
  first_sec_no_refund: string;

  days_to_move_in: string;
  representative: string;
  remaining_balance: string;
  // @@CONTRACT_ENGINE:rep-signature-types
  representative_signature: string;
  // // @@CONTRACT_ENGINE:promissory-types
  reservation_fee_applied_to_advance: string;
  reservation_fee_applied_to_deposit_1: string;
  remaining_deposit_1: string;
};
