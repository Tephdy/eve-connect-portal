-- ---------------------------------------------------------------------------
-- 20261013000003_seed_reservation_template.sql
--
-- Seeds the reservation contract template. All sections from the PDF are
-- preserved. Placeholders normalized to {{snake_case}}.
-- Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  v_body text;
begin
  if exists (
    select 1 from prep.contract_template
    where doc_type = 'reservation' and term_type = 'reservation' and active = true
  ) then
    raise notice 'Active reservation template already exists - skipping.';
    return;
  end if;

  v_body := $tpl$<h1>RESERVATION AGREEMENT</h1>

<h2>1. CLIENT INFORMATION (MANDATORY)</h2>
<table class="contract-table">
  <tbody>
    <tr><td>FULLNAME:</td><td>{{legal_name}}</td><td>Age:</td><td>{{age}}</td></tr>
    <tr><td>Gender:</td><td>{{gender}}</td><td>Company (if applicable):</td><td>{{company_name}}</td></tr>
    <tr><td>Messenger Account (Active):</td><td>{{messenger_account}}</td><td>Position:</td><td>{{position}}</td></tr>
    <tr><td>Vehicle Plate Number (if any):</td><td>{{vehicle_plate}}</td><td>Valid Government ID Presented:</td><td>{{valid_id}}</td></tr>
    <tr><td>Declared Number of Occupants:</td><td>{{declared_occupants}}</td><td>Contact Number (Active &amp; Reachable):</td><td>{{contact_no}}</td></tr>
    <tr><td>Target Move-In Date:</td><td>{{target_move_in_date}}</td><td>Email Address (Active):</td><td>{{email}}</td></tr>
  </tbody>
</table>

<h2>2. RESERVATION DETAILS</h2>
<table class="contract-table">
  <tbody>
    <tr><td>Unit Number / Type:</td><td>{{unit_type}}</td><td>Advance Rental:</td><td>P{{advance_paid}}.00</td></tr>
    <tr><td>Property:</td><td>{{property}}</td><td>Security Deposit:</td><td>P{{total_dep}}.00</td></tr>
    <tr><td>Monthly Rental Rate:</td><td>P{{total_rental}}.00</td><td>Reservation Fee:</td><td>P{{reservation_fee}}.00</td></tr>
    <tr><td>Add-ons:</td><td colspan="3">{{add_ons}}</td></tr>
    <tr><td>AC:</td><td>P{{ac_amount}}.00</td><td>Bedframe:</td><td>P{{bf_amount}}.00</td></tr>
    <tr><td>Foam:</td><td>P{{foam_amount}}.00</td><td>Others:</td><td>P{{others_amount}}.00</td></tr>
    <tr><td>Add-ons Total Amount:</td><td>P{{add_ons_amount}}.00</td><td>Admin Fee:</td><td>P{{admin_fee}}.00</td></tr>
    <tr><td>Occupancy Support Fee:</td><td>P{{occupancy_fee}}.00</td><td></td><td></td></tr>
    <tr><td>Total Payable:</td><td>P{{total_payable}}.00</td><td>Total Amount Paid:</td><td>P{{amount_paid}}.00</td></tr>
  </tbody>
</table>

<h2>PROMISSORY LETTER</h2>
<p>
The Tenant, <strong>{{legal_name}}</strong>, hereby agrees to settle the following remaining dues on the specified dates:
</p>
<ul>
  <li>One (1) Month Advance (P{{total_advance}}.00): Payable on {{one_month_advance_date}}</li>
  <li>1st Security Deposit (P{{first_deposit}}.00): Payable on {{first_security_date}}</li>
  <li>2nd Security Deposit (P{{second_deposit}}.00): Payable on {{second_security_date}}</li>
</ul>

<p>
I, <strong>{{legal_name}}</strong>, fully aware of the following:
</p>
<p>
I have reserved a studio unit of {{unit_type}}, amounting to Php {{total_rental}}.00/month. I made a reservation/advance of PHP {{reservation_fee}}.00 that is non-refundable on {{reservation_no_refund}}; partial sec. deposit (1 month) of PHP {{first_deposit}}.00 is non-refundable on {{first_sec_no_refund}}. The remaining balance of Php {{remaining_advance}}.00 will be paid on {{one_month_advance_date}}. The total amount to be paid on {{one_month_advance_date}} is Php {{move_in_payable}}.00.
</p>
<p>
Full sec. deposit (2 MONTHS) OF PHP {{total_dep}}.00 is non-consumable but refundable upon end of contract only.
</p>

<h2>RESERVATION TERMS AND CONDITIONS</h2>
<ol>
  <li>The tenant shall sign the Lease Contract before occupying the reserved unit.</li>
  <li>A two (2)-day grace period from the scheduled move-in date is allowed for the signing of the Lease Contract without penalty.</li>
  <li>If the Lease Contract is not signed within the grace period, a penalty of Eight Hundred Pesos (P800.00) per calendar day shall be charged starting on the third (3rd) day.</li>
  <li>The tenant shall have a maximum of {{days_to_move_in}} calendar days, starting from the third (3rd) day, to sign the Lease Contract. The P800.00 daily penalty shall continue to apply during this period.</li>
  <li>If the Tenant fails to sign the Lease Contract on or before the fifth (5th) day, the Lessor may cancel the reservation, forfeit the Reservation Fee, retain all accrued penalties, and offer the unit to another applicant, without further notice.</li>
</ol>

<h2>RESERVATION FEE AND UNIT ACCEPTANCE CLAUSE</h2>
<p>The Applicant acknowledges that he/she has personally inspected the unit and has been afforded sufficient opportunity to identify and report any defects, concerns, or necessary repairs prior to occupancy. Any reported items shall be evaluated by the Lessor or Management and, where appropriate, shall be attended to within a reasonable period, taking into consideration the nature and extent of the required work.</p>
<p>The Reservation Fee is STRICTLY NON-REFUNDABLE and NON-TRANSFERABLE under any circumstance, except where otherwise required by applicable law. Payment of the Reservation Fee constitutes the Applicant&rsquo;s confirmation that the unit has been inspected and accepted in its existing condition, subject only to the repairs or corrections expressly agreed upon in writing by the Management.</p>
<p>Any minor defects, cosmetic imperfections, normal wear and tear, personal preferences, or matters that have been disclosed, inspected, repaired, corrected, or reasonably addressed by the Management shall not constitute valid grounds for cancellation of the reservation, refund of the Reservation Fee, postponement or refusal of occupancy, or any claim for damages against the Lessor or Management.</p>
<p>The Applicant further agrees that any additional requests, modifications, improvements, or repairs made after payment of the Reservation Fee shall be subject solely to the discretion and approval of the Management and shall not affect the validity of the reservation nor create any obligation on the part of the Lessor to grant a refund, cancellation, or other concession.</p>

<h2>SECURITY DEPOSIT COMPLETION TERMS</h2>
<ol>
  <li><strong>Agreed Payment Date and Daily Penalty.</strong> If the Tenant commits to a specific date on which the outstanding Security Deposit will be paid, such promised payment date shall serve as the reference date for the payment deadline. If the tenant fails to pay on the promised payment date, a penalty of P500.00 per day of delay shall apply beginning on the day immediately following the promised payment date.</li>
  <li><strong>Maximum Four (4)-Day Extension.</strong> The tenant shall be given a maximum of four (4) days from the promised payment date to complete and fully pay the outstanding Security Deposit.</li>
  <li><strong>Penalty During the Four (4)-Day Extension.</strong> The P500.00 daily penalty shall continue to apply for each day of delay during the four (4)-day extension period until the outstanding Security Deposit is fully paid.</li>
  <li><strong>Failure to Pay Within Four (4) Days.</strong> If the Tenant fails to fully pay the outstanding Security Deposit within the maximum four (4)-day extension period, Management may enforce the applicable remedies under the Lease Agreement and applicable law, including termination of the tenancy/lease and requiring the Tenant to move out of the unit, subject to the required notice and legal procedures.</li>
  <li><strong>No Further Extension.</strong> No further extension beyond the maximum four (4)-day period shall be granted.</li>
</ol>

<h2>MOVE-IN AND CONTRACT EXECUTION POLICY</h2>
<p>This Policy is hereby established as part of the Lease Agreement and shall form an integral and binding provision thereof between the Tenant and the Management. By signing the Lease Agreement, the Tenant acknowledges that he/she has read, understood, and voluntarily agrees to comply with this Policy.</p>

<h3>1. NO CONTRACT, NO MOVE-IN POLICY</h3>
<p>The Tenant shall not be permitted to move into the leased premises until the Lease Agreement has been duly executed by both the Tenant and the Management and all required move-in requirements have been completed.</p>

<h3>2. PROCEDURE FOR UNAVOIDABLE CIRCUMSTANCES</h3>
<p>If the Tenant is unable to appear on the scheduled move-in date or contract signing due to unavoidable circumstances, the Tenant shall notify the Management in writing or through any officially recognized communication channel of the Management prior to or within the Grace Period stated below. Any request for rescheduling or extension shall be subject to the review and approval of the Management. The Management reserves the right to approve or deny such request based on the reason presented, the availability of the unit, operational requirements, and other relevant circumstances. The Management shall exercise such discretion reasonably and in good faith.</p>

<h3>3. GRACE PERIOD</h3>
<p>The tenant shall be granted a grace period of three (3) calendar days from the scheduled move-in date or contract signing date within which to appear, communicate with the Management, or request a rescheduling.</p>

<h3>4. ADMINISTRATIVE PENALTY</h3>
<p>If the tenant fails to appear or fails to communicate with the Management within the three (3)-day grace period, an administrative penalty of Five Hundred Pesos (P500.00) shall be charged and shall be deducted from the Reservation Fee.</p>

<h3>5. TERMINATION OF RESERVATION</h3>
<p>If, after the expiration of the three (3)-day grace period, the Tenant still fails to appear, communicate, or obtain an approved rescheduling from the Management, the Management may, in its sole discretion, terminate the reservation and cancel the proposed Lease Agreement.</p>
<p>Upon such termination:</p>
<ul>
  <li>The reserved unit may immediately be offered to another applicant without further notice.</li>
  <li>The applicable deduction from or forfeiture of the Reservation Fee shall be governed by the Reservation Agreement and applicable law.</li>
  <li>Any request for reinstatement shall be subject to the sole discretion and written approval of the Management and shall depend on unit availability.</li>
  <li>The Management shall notify the Tenant of such termination through the Tenant&rsquo;s last known contact details or any official communication channel previously provided by the Tenant.</li>
</ul>

<p>Conforme:</p>
<p><strong>{{legal_name}}</strong><br/>NAME / SIGNATURE</p>

<h2>FORCE MAJEURE</h2>
<p>The Lessor or Management shall not be liable for any delay, interruption, or failure to perform any obligation under this Agreement when such delay or failure is caused by events beyond its reasonable control (&ldquo;Force Majeure&rdquo;), including but not limited to:</p>
<ul>
  <li>Acts of God, including typhoons, earthquakes, floods, fires, and other natural disasters;</li>
  <li>War, terrorism, civil commotion, riots, or public disturbances;</li>
  <li>Government laws, regulations, orders, lockdowns, quarantines, or mandated closures;</li>
  <li>Widespread power outages, utility interruptions, infrastructure failures, or disruptions in public services;</li>
  <li>Pandemics, epidemics, or other public health emergencies; and</li>
  <li>Any other event beyond the reasonable control of the Lessor or Management.</li>
</ul>
<p>During the occurrence of a Force Majeure event, the obligations of the Lessor or Management affected by such event shall be suspended for the duration of the Force Majeure, without constituting a breach of this Agreement.</p>
<p>The Tenant acknowledges that temporary interruptions in utilities, access, or occupancy arising directly from a Force Majeure event shall not entitle the Tenant to any refund, rent reduction, damages, or compensation, except where otherwise expressly required by applicable law.</p>
<p>The Lessor or Management shall exercise reasonable diligence to restore normal operations and resume performance of its obligations as soon as practicable after the cessation of the Force Majeure event.</p>

<h2>3. MANDATORY CONTACT INFORMATION CLAUSE</h2>
<p>The Client is required to provide a valid and active email address, valid Messenger account, and valid contact number. These contact details shall be used for official communications, contract transmission, billing notices, and important correspondence. Failure to provide complete, accurate, and verifiable contact information shall result in suspension or cancellation of contract processing without liability on the part of Management. In such event, all reservation payments made shall be forfeited and shall not be subject to refund.</p>

<h2>4. NON-REFUNDABLE POLICY</h2>
<p>All reservation payments are STRICTLY NON-REFUNDABLE. The reserved unit shall be held for {{days_to_move_in}} days from the date of this agreement. Failure to move in within the agreed period shall automatically cancel the reservation, and all payments made shall be forfeited.</p>

<h2>5. CONDITIONS OF RESERVATION</h2>
<p>No Contract Signing, No Move-In Policy strictly applies. Contract signing shall be conducted only at Eve&rsquo;s Residences Office, No. 69 Matahimik Street, Riverside II Subdivision, Cainta, Rizal. Upon move-in, the client must bring their own door knob (free installation). Move-in schedule strictly from 8:00 AM to 8:00 PM only. No pets and children allowed. Parking is at the client&rsquo;s own risk. No exclusive parking provided. The actual unit may slightly differ from photos and videos presented online.</p>

<h2>6. DIGITAL CONTRACT VALIDITY</h2>
<p>Eve&rsquo;s Residences utilizes a Digital Contract System recognized under Philippine laws governing electronic documents and electronic signatures. Electronic signatures and digitally transmitted contracts shall be legally binding and enforceable.</p>

<h2>7. DATA PRIVACY ACT COMPLIANCE</h2>
<p>In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), the Client consents to the collection, processing, and storage of personal information for purposes related to reservation processing, contract preparation, billing, and official communication. Personal data shall be protected and shall not be disclosed to third parties without lawful basis.</p>

<h2>8. MISREPRESENTATION CLAUSE</h2>
<p>The Client warrants that all information provided is true and accurate. Any false declaration or misrepresentation shall result in cancellation of reservation and forfeiture of all payments made, without prejudice to legal remedies.</p>

<h2>9. WAIVER CLAUSE</h2>
<p>Failure of Management to enforce any provision shall not be construed as a waiver of its rights. No waiver shall be valid unless made in writing.</p>

<h2>10. OFFICIAL COMMUNICATION CLAUSE</h2>
<p>All communications sent to the Client&rsquo;s declared email, Messenger, or contact number shall be deemed officially received upon transmission. Management shall not be liable for failed delivery due to incorrect or inactive contact information.</p>

<h2>11. CASHLESS PAYMENT POLICY</h2>
<p>All payments to Eve&rsquo;s Residences shall be made strictly on a CASHLESS basis. Cash payments are strictly prohibited and shall not be accepted under any circumstances. All reservation fees, advance rentals, security deposits, monthly rentals, utilities, penalties, and other charges must be paid only through the following official accounts:</p>
<ul>
  <li>GCash Account Number: 09190848050 | 09778562727</li>
  <li>BDO Account Number: 0114 4005 1265 &ndash; Evelyn Salvador</li>
  <li>PAYMAYA Account Number: 09778562727</li>
</ul>
<p>Only payments made to the above-declared official accounts shall be recognized as valid and binding. The Management and its representatives are not authorized to receive cash payments. Any payment made outside the declared official accounts shall be considered unauthorized and shall not be acknowledged by Management.</p>
<p>The Client shall submit proof of payment (clear screenshot or transaction receipt) immediately after payment. Failure to provide proof of payment may result in the payment being treated as unpaid until verified.</p>
<p>Management shall not be held liable for payments sent to incorrect, unauthorized, or unofficial accounts.</p>

<h2>12. DECLARATION</h2>
<p>I hereby confirm that I have read and agreed to all terms and conditions stated above.</p>
<p><strong>{{legal_name}}</strong><br/>NAME / SIGNATURE</p>
<p><strong>{{representative}}</strong><br/>For Management: Authorized Representative</p>
$tpl$;

  insert into prep.contract_template
    (name, title, body_markdown, version, active, property_id, term_type, doc_type)
  values
    ('reservation_v1', 'Reservation Agreement', v_body, 1, true, null, 'reservation', 'reservation');

  raise notice 'Seeded reservation template.';
end $$;
