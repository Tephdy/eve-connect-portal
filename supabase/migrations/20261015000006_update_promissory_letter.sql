-- ---------------------------------------------------------------------------
-- 20261015000006_update_promissory_letter.sql
--
-- Updates the reservation template's Promissory Letter to reflect the correct
-- allocation of the reservation fee (Option A).
-- Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  v_body text;
  v_before text;
  v_old_letter text;
  v_new_letter text;
begin
  select body_markdown into v_body
  from prep.contract_template
  where doc_type = 'reservation' and active = true
  limit 1;

  if v_body is null then
    raise exception 'No active reservation template found';
  end if;

  if v_body like '%reservation_fee_applied_to_advance%' then
    raise notice 'Template already updated - skipping.';
    return;
  end if;

  v_before := v_body;

  v_old_letter := '<ul>
  <li>One (1) Month Advance (P{{total_advance}}): Payable on {{one_month_advance_date}}</li>
  <li>1st Security Deposit (P{{first_deposit}}): Payable on {{first_security_date}}</li>
  <li>2nd Security Deposit (P{{second_deposit}}): Payable on {{second_security_date}}</li>
</ul>';

  v_new_letter := '<ul>
  <li>One (1) Month Advance (P{{total_advance}}): Payable on {{one_month_advance_date}} &mdash; P{{reservation_fee_applied_to_advance}} applied from reservation fee</li>
  <li>1st Security Deposit (P{{first_deposit}}): Payable on {{first_security_date}} &mdash; P{{reservation_fee_applied_to_deposit_1}} applied from reservation fee, remaining P{{remaining_deposit_1}}</li>
  <li>2nd Security Deposit (P{{second_deposit}}): Payable on {{second_security_date}}</li>
  <li>Occupancy Support Fee (P{{occupancy_fee}}): Payable on move-in day</li>
</ul>
<p>
Total remaining balance: P{{remaining_balance}}<br/>
Total amount to be paid on move-in day: P{{move_in_payable}}
</p>';

  v_body := replace(v_body, v_old_letter, v_new_letter);

  if v_body = v_before then
    raise notice 'Promissory Letter bullet list not found - body unchanged.';
    return;
  end if;

  update prep.contract_template
  set body_markdown = v_body,
      version = version + 1
  where doc_type = 'reservation' and active = true;

  raise notice 'Updated Promissory Letter (version bumped).';
end $$;
