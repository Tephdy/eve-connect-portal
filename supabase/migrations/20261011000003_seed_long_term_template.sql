-- ---------------------------------------------------------------------------
-- 20261011000003_seed_long_term_template.sql
--
-- Seeds the canonical long-term contract template.
-- Scope: property_id = null (generic), term_type = 'long_term'.
-- Placeholder syntax: {{snake_case}}.
-- Idempotent: skips insert if an active long_term template already exists.
-- ---------------------------------------------------------------------------

do $$
declare
  v_body text;
begin
  -- Skip if an active generic long_term template already exists.
  if exists (
    select 1 from prep.contract_template
    where property_id is null
      and term_type = 'long_term'
      and active = true
  ) then
    raise notice 'Active long_term template already exists — skipping seed.';
    return;
  end if;

  v_body := $tpl$
<!-- ===================================================================== -->
<!-- LONG TERM CONTRACT OF LEASE                                            -->
<!-- Template version 3.3 — Enterprise Digital Controlled Version           -->
<!-- ===================================================================== -->

<div class="contract-header">
  <p>CONTROL NUMBER: <strong>{{control_number}}</strong></p>
  <p class="barcode-placeholder">{{barcode}}</p>
</div>

<h1>ADI LONG TERM CONTRACT OF LEASE</h1>

<p>
This AGREEMENT made and entered into by and between:
</p>

<p>
<strong>Herminio M. Junio</strong>, of legal age, Filipino citizen, single and residing at
Brgy. Talacsan, San Rafael, Bulacan, Philippines hereinafter known as the <strong>LESSOR</strong>;
</p>

<p>and</p>

<p>
<strong>{{legal_name}}</strong>, of legal age, Filipino citizen, and a resident of
{{perm_address}}, hereinafter known as the <strong>LESSEE</strong>;
</p>

<h2>WITNESSETH:</h2>

<ol>
  <li>
    That the LESSOR hereby agrees to lease unto the LESSEE a residential unit located at
    Blk. 15 Lot 6 Kayumanggi St., Karangalan Village, Brgy. San Isidro, Cainta, Rizal,
    Philippines in consideration of the monthly rental of {{rate}} and
    {{occupancy_fee}} for monthly occupancy support fee, payable in advance on the
    {{due_date}}.
  </li>
  <li>
    That the LESSEE upon execution of this agreement shall pay an advance rental for
    one (1) month of {{advance_amount}}, and a security deposit equivalent to two (2) months
    of {{sec_dep}} (payable as {{deposit_1}} and {{deposit_2}}), and
    {{utility_dep}} utility deposit, Philippine currency. Security and utility deposit
    is not consumable and refundable only upon completion of contract subject to
    maintenance evaluation.
  </li>
  <li>
    That the term of this lease is {{term_months}} month(s), commencing from
    {{rental_start}}, and expiring on {{rental_end}}.
  </li>
  <li>
    That the LESSEE and its companions or housemate/s agrees to provide 1 valid I.D and
    actual picture upon signing of contract or move-in and complete the information
    sheet provided by the LESSOR before the issuance of biometric access.
  </li>
  <li>
    That the Unit has a maximum capacity of 3 persons only. That the LESSEE's companions
    or housemate/s is not allowed to use the trial promo after the first trial promo
    contract is finished. NO KIDS are allowed. That in the event of non-conformity from
    this clause, the LESSOR will have a ground for the immediate termination of contract;
  </li>
  <li>That the LESSEE is fully aware that the unit has NO PROVISION for air-conditioning unit.</li>
  <li>
    That I, LESSEE, give the full authority to the LESSOR to suspend the water and
    electricity supply on my rented unit and authorize the LESSOR to market the unit
    to another prospect tenant/s.
  </li>
</ol>

<h2>8. COLLECTION POLICY TERMS &amp; CONDITIONS</h2>
<ol>
  <li>That the rental payment should be made only thru Bank Transfer (BDO), Cash-In in MAYA/GCASH thru your personal GCASH number, Convenience Store (7/11, Alfamart or Uncle John's) or Sari-sari store near you. No CASH PAYMENT TRANSACTION is allowed.</li>
  <li>That the LESSOR's representative or staff is NOT allowed to receive cash payment from the LESSEE. In the event that the LESSEE pays in cash to the LESSOR's representative or staff, LESSOR is not responsible for any payment received and will not be able to confirm the payment.</li>
  <li>That the LESSEE is obliged to send a clear screenshot or picture of the rental payment. No picture or screenshot of the payment transaction is equivalent to non-payment of rental. Send the screenshot/picture of your payment transaction thru LESSOR's official Facebook account.</li>
  <li>After the confirmation of payment from the Accounting Department, LESSEE should ask for the Official Receipt.</li>
  <li>That the LESSOR is not responsible to remind or to send a text message to the LESSEE about his/her due date on rental payment.</li>
  <li>In that case LESSEE fails to pay within the 2 days grace period, on the 3rd day there will be a Php300.00 penalty per day until the 5th day.</li>
  <li>In case the LESSEE fails to pay on the 5th day, the LESSOR will issue a demand letter to pay to the LESSEE demanding that he/she needs to vacate the premises within 2 days.</li>
  <li>That on the 7th day, the LESSOR will issue a demand letter to vacate the property within 7 days and the property will be recovered/repossessed on the 15th day without need of any written authority.</li>
  <li>That in case the LESSEE fails to communicate with the LESSOR regarding the update of the LESSEE's monthly rental payment, the LESSOR will have the right to open its unit without need of any written letter.</li>
  <li>That in case the LESSEE fails to move-out or renew its contract to weekly, monthly, 3 mos. or 6 mos., the LESSOR will have the right to open its unit without need of any written letter.</li>
  <li>That the daily rental penalty will only discontinue until the LESSEE's payment transaction sent to the LESSOR's Official Facebook account is confirmed by the Accounting Department.</li>
  <li>That the security and utility deposit is refundable upon completion of contract and subject for maintenance evaluation of the unit with formal move-out should be performed and properly filled out.</li>
  <li>That in case of fraud transaction, a penalty fee will be collected and termination of contract as soon as the LESSOR will prove its fraudulent action and the 1 month and utility security deposit will be forfeited deemed as damage.</li>
  <li>That in case of non-payment of the rental herein stipulated; or violation of any condition of this contract, the water and electricity supply will suspend automatically; the lease shall be considered rescinded, and the LESSOR shall have the right to demand that the LESSEE vacate the premises.</li>
</ol>

<h2>9. UTILITY COLLECTION TERMS &amp; CONDITIONS</h2>

<h3>9.1. WATER POLICY</h3>
<ol>
  <li>That all units are provided with water submeter; that the cost of water per cubic meter is Php70.00.</li>
  <li>That there will be a minimum of 1 cu.m charge automatically even if the LESSEE states that he/she is not living in the lease unit/did not consume the water including system loss charges in case there's any.</li>
  <li>That the water bill will be issued every 25th and 30th of the month, and need to settle the bill immediately.</li>
  <li>That the LESSEE must be the one responsible in monitoring their daily water reading, in case of abrupt increase of water reading, the LESSEE must report it immediately for proper action by the LESSOR.</li>
  <li>Every tenant is advised to pay his/her water on the 25th day on time. Should there be a delay of payment, a P10.00 penalty per day of late payment from the announced date of bills payment, will be collected.</li>
  <li>That the monthly water payment should be made only thru Bank Transfer (BDO), Cash-in in Maya/Gcash thru your personal Gcash number, Convenience Store (7/11, Alfamart or Uncle John's) or Sari-sari store near you. NO CASH PAYMENT TRANSACTION is allowed.</li>
  <li>That the LESSOR's representative or staff is NOT allowed to receive cash payment from the LESSEE.</li>
  <li>That the LESSEE is obliged to send a clear picture or screenshot of the water payment. No picture or screenshot of the payment transaction is equivalent to no payment of water bill.</li>
</ol>

<h3>10. ELECTRICITY POLICY</h3>
<ol>
  <li>All units are provided with an electric submeter that the cost of electricity per KWH is based on the total consumption of the LESSEE; a photocopy of Meralco receipt will be posted for transparency of its consumption.</li>
  <li>
    <strong>FORMULA:</strong> Total Electric bill Meralco ÷ Total Actual Usage of all tenants (kwh) = Rate per kwh.
  </li>
  <li>That there will be a minimum of 2Kwh charge automatically even if the LESSEE states that he/she is not living in the lease unit/did not consume the electricity including system loss charges in case there's any.</li>
  <li>That all LESSEE must be the one responsible in monitoring their daily electricity meter reading, in case of abrupt increase of electric reading, the LESSEE must report it immediately for proper action by the LESSOR.</li>
  <li>That the electricity bill will be issued every 25th and 30th of the month, and need to settle the bill immediately.</li>
  <li>Every tenant is advised to pay his/her electric 25th day on time. Should there be a delay of payment, a P10.00 penalty per day of late payment from the announced date of bills payment, will be collected.</li>
  <li>That the monthly electricity bill payment should be made only thru Bank Transfer (BDO), Cash-in in Maya/Gcash thru your personal Gcash number, Convenience Store (7/11, Alfamart or Uncle John's) or Sari-sari store near you. NO CASH PAYMENT TRANSACTION is allowed.</li>
  <li>That the LESSOR's representative or staff is NOT allowed to receive cash payment from the LESSEE.</li>
  <li>That the LESSEE is obliged to send a clear picture or screenshot of the electricity payment. No picture or screenshot of the payment transaction is equivalent to no payment of electricity bill.</li>
</ol>

<h2>11. HOUSE RULES</h2>
<p>That the LESSEE is fully aware of the house rules set by the LESSOR. Common areas must be kept CLEAN AT ALL TIMES.</p>
<p>Keeping the hallways/C.R corridors free from all kinds of furniture, appliances, kitchen supplies and the like including but not limited to: washing machines, furniture, appliances, shoes, shoe racks, tables, water containers, sandals, plants or ornaments, chairs, bicycles, toy motorcycles.</p>
<ol>
  <li>Drying Rack for clothes (any personal effects) and other interference that may cause safety hazard is not allowed in common areas.</li>
  <li>Smoking and drinking of alcohol are not allowed in the hallways, staircase and other common areas.</li>
  <li>Doing laundry outside of your unit or in the hallway is not allowed.</li>
  <li>No Partying or any event in the hallway/corridor is prohibited.</li>
  <li>No hanging of clothes on windows, hallways and common areas.</li>
  <li>No household garbage allowed in the hallways and common area.</li>
  <li>Place all your trash in a plastic bag and place it in our trash receptacles located outside the building with their respective designation.</li>
  <li>No cooking/barbecue or other form of cooking at the hallway/corridor.</li>
  <li>No pets allowed, no feeding of stray dogs and cats within the premises.</li>
  <li>No tissue/napkin/wet wipes to be thrown on the toilet bowl or anything that causes clogging.</li>
  <li>Cooking is allowed but the LESSEE can use only induction or electric cooker/rice cooker and the likes.</li>
  <li>Butane / Liquified Gas / Gasera / Candle and/or any flammable items is strictly not allowed to be used. In case of fire due to the following, the LESSEE will take the full responsibility towards this incident.</li>
</ol>

<h3>11.1 Sanctions for non-compliance</h3>
<table>
  <tr><td>1st Offense</td><td>Warning Letter</td></tr>
  <tr><td>2nd Offense</td><td>Php 250.00</td></tr>
  <tr><td>3rd Offense</td><td>Php 500.00</td></tr>
  <tr><td>4th Offense</td><td>Items confiscated will not be returned</td></tr>
  <tr><td>5th Offense</td><td>Termination of contract</td></tr>
</table>

<ol start="13">
  <li>That the LESSOR strictly advises the LESSEE to always keep the door closed at all times for your own security. LESSOR provides the biometric access for your security but the LESSEE is the one responsible for all his/her belongings. LESSOR is not responsible for any untoward incident (ex. theft, robbery, etc.) that may happen during the LESSEE's stay in the unit.</li>
  <li>That the LESSOR provides the CCTV Cameras but the LESSEE is still responsible for the safety of his/her unit. That the LESSOR is not responsible if there is an incident that happens and the CCTV malfunction at that time.</li>
  <li>That the Comfort Room that the LESSEE provides is a Manual/Pail Flush Water Closet Only, it cannot be converted into a flush system. LESSOR will provide pail and dipper upon LESSEE's move-in and need to surrender it to the Admin Office upon move out of the LESSEE.</li>
  <li>That the LESSOR shall provide fitted sheet, blanket, pillow, bed foam and bed frame to the LESSEE as one time supply during his/her stay at the unit. These must be surrendered to the Admin Office at the time of his or her departure, in a good condition, subject to inspection of the Admin Staff.</li>
  <li>That the LESSEE acknowledges that there will be no refund of rental payment due to shortened stay, unmet expectations or other reasons.</li>
  <li>That in the event the LESSEE will not pay all the amount due to his/her account or non-formal move out, the LESSEE gives the authority to the LESSOR to forward all the personal information as well as the identification cards provided by the LESSEE to use it as a tool by our Legal Department to recover all the amount due to LESSOR.</li>
  <li>The LESSEE should provide his/her own 2 padlocks mainly for the Unit Main Door and Comfort Room Door for your own security.</li>
  <li>That the LESSOR is not responsible for any fortuitous event like flood, earthquakes, etc.</li>
  <li>That the LESSEE shall not make or cause to be made any improvement in the premises without prior written consent of the LESSOR.</li>
  <li>That the LESSEE shall not directly or indirectly sublease, assign or transfer his/her right under contract to a third party or parties.</li>
  <li>That the lease property is solely for residential purposes only, it cannot be converted into a stock room, commissary, etc.</li>
  <li>That the LESSOR has the right to check/visit the lease property from time to time for the routine check-up of our Maintenance Team like checking of electrical wirings, sewerage, water leakage, etc.</li>
  <li>That the LESSEE hereby expressly acknowledge that the leased premises are in good and tenantable condition and agrees to keep the same in such a good and tenantable condition.</li>
  <li>In case the property is sold, the LESSOR will refund the remaining rental days of the LESSEE less the utility expenses within the period. That the LESSOR shall give the LESSEE a written notice to vacate the unit within thirty (30) days.</li>
  <li>That the LESSEE is fully aware that the LESSOR has the right not to renew the LESSEE's contract, if the LESSOR has the legitimate need/s of the property/unit or if there's a situation that the unit/property need to undergo maintenance work and/or sole discretion of the LESSOR if LESSEE is willing to renew the contract of the LESSEE.</li>
  <li>That any and all violations of the conditions of this contract shall subject the guilty party to the payment of damages, aside from costs of suits and attorney's fees.</li>
  <li>That I, the LESSEE, give the right to the LESSOR to open the door and remove the belongings in the rental unit during the following circumstances:
    <ol>
      <li>In case of non-payment and no communication from the LESSEE, the LESSOR has the right to open and reclaim the property without need of any written authority.</li>
      <li>In case of an emergency like fire, flood, suspicious faulty electrical wiring, gas leakage, water leakage, or other circumstances that the Maintenance team will decide to open your door.</li>
    </ol>
  </li>
  <li>Upon check out or end of contract, the Management will not be held responsible for any damages/loss of the tenant properties inside the unit.</li>
  <li>Upon check out or end of contract a Php100.00 storage fee will be charged per day to the LESSEE for leaving his/her personal belongings inside the property. The above rules are only applicable within the maximum period of 7 days, after 7 days the LESSOR will have the full rights to decide what to do with the LESSEE's personal belongings.</li>
  <li><strong>JUDICIAL RELIEF:</strong> Should any one of the parties herein be compelled to seek judicial relief against the other, the losing party shall pay an amount of One Hundred Percent (100%) of the amount claimed in the complaint as attorney's fees which shall in no case be less than Fifty Thousand Pesos (Php50,000.00) in addition to other cost and damages which the said party may be entitled to under the law.</li>
</ol>

<h2>12. SECURITY DEPOSIT COMPLETION</h2>
<ol>
  <li>If the Tenant commits to a specific date on which the outstanding Security Deposit will be paid, such promised payment date shall serve as the reference date for the payment deadline.</li>
  <li>If the tenant fails to pay on the promised payment date, a penalty of P500.00 per day of delay shall apply beginning on the day immediately following the promised payment date.</li>
  <li>The tenant shall be given a maximum of four (4) days from the promised payment date to complete and fully pay the outstanding Security Deposit.</li>
  <li>The P500.00 daily penalty shall continue to apply for each day of delay during the four (4)-day extension period until the outstanding Security Deposit is fully paid.</li>
  <li>If the Tenant fails to fully pay the outstanding Security Deposit within the maximum four (4)-day extension period, Management may enforce the applicable remedies under the Lease Agreement and applicable law, including termination of the tenancy/lease and requiring the Tenant to move out of the unit.</li>
  <li>No further extension beyond the maximum four (4)-day period shall be granted.</li>
</ol>

<p>
IN WITNESS WHEREOF, we have hereunto set our hands this day of {{current_date}} in
No. 69 Matahimik St. Riverside II Brgy. Sto. Domingo Cainta, Rizal.
</p>

<table class="signature-block">
  <tr>
    <td>HERMINIO M. JUNIO<br/><small>LESSOR</small></td>
    <td>{{legal_name}}<br/><small>LESSEE</small></td>
  </tr>
</table>

<hr/>

<h1>PROMISSORY NOTE</h1>
<p>Date: {{date}}</p>
<p>I, {{legal_name}}, fully aware of the following:</p>
<p>
I have reserved a studio unit of {{unit_no}}, amounting to {{rate}}/month. I made a
reservation/advance of {{reservation_fee}} that is non-refundable on
{{reserv_nonrefundable_on}}. Partial sec. deposit (1 month) of {{sec_dep}} is
non-refundable on {{deposit_nonrefund_on}}. The total amount to be paid on
{{target_move_in}} is {{total}}.
</p>
<p>Full sec. deposit of {{sec_dep}} is non-consumable but refundable upon end of contract only.</p>

<h2>RESERVATION TERMS AND CONDITIONS</h2>
<ol>
  <li>The tenant shall sign the Lease Contract before occupying the reserved unit.</li>
  <li>A two (2)-day grace period from the scheduled move-in date is allowed for the signing of the Lease Contract without penalty.</li>
  <li>If the Lease Contract is not signed within the grace period, a penalty of Eight Hundred Pesos (P800.00) per calendar day shall be charged starting on the third (3rd) day.</li>
  <li>The tenant shall have a maximum of {{move_in_date}} calendar days, starting from the third (3rd) day, to sign the Lease Contract. The P800.00 daily penalty shall continue to apply during this period.</li>
  <li>If the Tenant fails to sign the Lease Contract on or before the fifth (5th) day, the Lessor may cancel the reservation, forfeit the Reservation Fee, retain all accrued penalties, and offer the unit to another applicant, without further notice.</li>
</ol>

<hr/>

<h1>TENANT INFORMATION SHEET</h1>
<table class="tenant-info">
  <tr><td>NAME:</td><td>{{legal_name}}</td></tr>
  <tr><td>AGE:</td><td>{{age}}</td></tr>
  <tr><td>GENDER:</td><td>{{gender}}</td></tr>
  <tr><td>NATIONALITY:</td><td>{{nationality}}</td></tr>
  <tr><td>RELIGION:</td><td>{{religion}}</td></tr>
  <tr><td>PERMANENT ADDRESS:</td><td>{{perm_address}}</td></tr>
  <tr><td>RECENT ADDRESS:</td><td>{{rec_address}}</td></tr>
  <tr><td>CIVIL STATUS:</td><td>{{civil_status}}</td></tr>
  <tr><td>MOBILE NUMBER:</td><td>{{mobile_num}}</td></tr>
  <tr><td>EMAIL:</td><td>{{email_addr}}</td></tr>
</table>

<h2>EMPLOYMENT INFORMATION (IF APPLICABLE)</h2>
<table class="tenant-info">
  <tr><td>COMPANY:</td><td>{{company}}</td></tr>
  <tr><td>WORK STATUS:</td><td>{{status}}</td></tr>
  <tr><td>WORK POSITION:</td><td>{{position}}</td></tr>
  <tr><td>COMPANY ADDRESS:</td><td>{{comp_addr}}</td></tr>
  <tr><td>TEL. NUMBER:</td><td>{{comp_tel}}</td></tr>
  <tr><td>EMAIL:</td><td>{{comp_email}}</td></tr>
  <tr><td>FB MESSENGER:</td><td>{{comp_msgr}}</td></tr>
</table>

<p>HOW DID YOU FIND OUT ABOUT EVE'S RESIDENCES? {{marketing_src}}</p>

<p>I hereby certify that the information stated above is true and correct to the best of my knowledge.</p>

<table class="signature-block">
  <tr>
    <td>{{legal_name}}<br/><small>CLIENT SIGNATURE</small></td>
    <td>{{current_date}}<br/><small>DATE</small></td>
  </tr>
</table>

<h3>IN CASE OF EMERGENCY</h3>
<table class="tenant-info">
  <tr><td>NAME:</td><td>{{ec1_name}}</td><td>NAME:</td><td>{{ec2_name}}</td></tr>
  <tr><td>PHONE NO.:</td><td>{{ec1_tel}}</td><td>PHONE NO.:</td><td>{{ec2_tel}}</td></tr>
  <tr><td>EMAIL ADDRESS:</td><td>{{ec1_email}}</td><td>EMAIL ADDRESS:</td><td>{{ec2_email}}</td></tr>
  <tr><td>FB / MESSENGER:</td><td>{{ec1_mssgr}}</td><td>FB / MESSENGER:</td><td>{{ec2_mssgr}}</td></tr>
</table>

<hr/>

<h1>WAIVER FOR WATER &amp; ELECTRICITY POLICY</h1>
<p>I, {{legal_name}}, tenant of Adi 168, is fully aware of all the terms and conditions of the LESSOR pertaining to its water &amp; electric policy.</p>
<ol>
  <li>All unit/s is provided with water &amp; electricity submeter with automatic timer.</li>
  <li>That the cost of water per cubic meter is Php70.00 and the cost of electricity per KwH is based on the total.</li>
  <li>That there will be a minimum of 1 cu.m. for water and minimum 2 Kwh for electric charge automatically even if the LESSEE states that he/she is not living in the lease unit/did not consume the water including system loss charges in case there's any.</li>
  <li>In the event I consume all the utility deposit in 15 days, I agree to pay an additional amount for my utility deposit that is based on my average consumption.</li>
  <li>That I must be the one responsible in monitoring their daily water meter reading, in case of abrupt increase of water reading, that I must report it immediately for proper action by the LESSOR.</li>
  <li>Every tenant is advised to pay his/her water &amp; electric 25th day on time. Should there be a delay of payment, a P10.00 penalty per day of late payment from the announced date of bills payment, will be collected.</li>
  <li>That my monthly rental payment should be made only thru Bank Transfer (BDO), Cash-In in MAYA/GCASH thru your personal GCASH number, Convenience Store (7/11, Alfamart or Uncle John's) or Sari-sari store near you. No CASH PAYMENT TRANSACTION is allowed.</li>
  <li>That the LESSOR's representative or staff is NOT allowed to receive cash payment from me.</li>
  <li>That I should send a clear picture or screenshot of the water top up. No picture or screenshot of the payment transaction is equivalent to non-top up.</li>
</ol>

<h1>WAIVER FOR HOUSE RULES</h1>
<p>I, {{legal_name}}, tenant of Adi 168, unit {{unit_no}}, accepts and fully aware of all the HOUSE RULES implemented by the 168 ADI Bed and Bath.</p>
<table>
  <tr><td>1st Offense</td><td>Warning Letter</td></tr>
  <tr><td>2nd Offense</td><td>Penalty Fee of Php250.00</td></tr>
  <tr><td>3rd Offense</td><td>Penalty Fee of Php500.00</td></tr>
  <tr><td>4th Offense</td><td>Confiscate the item/s and it will not return to the owner</td></tr>
  <tr><td>5th Offense</td><td>Termination of Contract</td></tr>
</table>
<table class="signature-block">
  <tr>
    <td>{{legal_name}}<br/><small>LESSEE</small></td>
    <td>HERMINIO M. JUNIO<br/><small>LESSOR</small></td>
  </tr>
</table>

<h1>WAIVER FOR THE NON-RENEWAL OF CONTRACT</h1>
<p>I, {{legal_name}}, tenant of Adi 168, unit {{unit_no}}, hereby authorize and gives the full rights to the LESSOR to open my unit without need of any written letter document authorizing the LESSOR to recover possession of the premise devoid of any occupants in case of non-renewal of my contract.</p>
<p>That I am fully aware that in case of non-payment of the rental, the water and electricity supply will cease automatically as this is coincide with my monthly rental payment or violation of any conditions of this contract, the lease shall be considered rescinded and 168 ADI Bed and Bath Management shall have the right to demand to me to vacate the premises.</p>
<table class="signature-block">
  <tr><td>{{legal_name}}<br/><small>LESSEE</small></td></tr>
</table>

<h1>FIRE SAFETY, COMMON AREAS, AND UNIT INSPECTION</h1>
<ol>
  <li>In compliance with Republic Act No. 9514 (Fire Code of the Philippines) and as part of the LESSOR's Fire Safety Program, the LESSEE agrees to strictly keep all hallways, corridors, stairways, and common areas clear of any obstruction at all times.</li>
  <li>The placement, storage, or leaving of shoes, slippers, bicycles, furniture, appliances (old or unused), personal belongings, or any other items in hallways or common areas is strictly prohibited.</li>
  <li>Any items found obstructing hallways or common areas may be removed by Management without prior notice and transferred to the Management stockroom.</li>
  <li>The LESSOR or Management shall not be obligated to return any removed items to the LESSEE's unit.</li>
  <li>The LESSOR or Management shall likewise not be liable for any loss, damage, or deterioration of any items removed from common areas.</li>
  <li>Any items not claimed within thirty (30) days from the date of removal shall be deemed abandoned property and may be disposed of, donated, or recycled at the sole discretion of Management, without any liability on its part.</li>
</ol>

<h1>CONTRACT SIGNING AGREEMENT</h1>
<p>I am {{legal_name}} of {{unit_no}} of Adi 168 fully understanding and affixing my signature in the contract. I have no more questions regarding all the rules and regulations stipulated on the contract, Management representative {{rep}} witness in signing the contract.</p>
<p>Agreed with the management on the following condition stated that upon advance monthly rental/Security Deposit all documents to be signed by the tenant in our office only at #69 Matahimik St., Riverside, Brgy., Sto., Domingo, Cainta, Rizal. Failure to sign a contract will incur a penalty of Five Hundred Pesos (P500.00) per day. No contract, No move in.</p>
<table class="signature-block">
  <tr>
    <td>{{legal_name}}<br/><small>TENANT</small></td>
    <td>{{rep}}<br/><small>MANAGEMENT</small></td>
  </tr>
</table>

<h1>WAIVER TO OPEN ROOM</h1>
<p>I, {{legal_name}} of unit {{unit_no}} in Adi 168 hereby authorize 168 ADI Bed and Bath Management to open my door and remove my belongings in the rental unit during the following circumstances:</p>
<ol>
  <li>In case of non-payment and no communication from me, 168 ADI Bed and Bath Management have the right to open and reclaim the property without need of any written authority.</li>
  <li>In case of an emergency like fire, flood, suspicious faulty electrical wiring, gas leakage, water leakage or other circumstances that the Maintenance team may decide to open my door.</li>
</ol>
<table class="signature-block">
  <tr><td>{{legal_name}}<br/><small>LESSEE</small></td></tr>
</table>

<h1>PAYMENT CHANNELS</h1>
<p>{{legal_name}} of unit {{unit_no}} in Adi 168, is fully aware that the payment should be made only thru:</p>
<table class="payment-channels">
  <tr><td>Bank Transfer</td><td>BDO Account No.: 0114-4005-1265<br/>Account Name: Evelyn J. Salvador</td></tr>
  <tr><td>GCash</td><td>0977-856-2727<br/>Account Name: Evelyn J. Salvador</td></tr>
  <tr><td>GCash</td><td>0919-084-8050<br/>Account Name: Ariel Eugenio Y. Salvador</td></tr>
  <tr><td>Maya</td><td>0977-856-2727<br/>Account Name: Evelyn J. Salvador</td></tr>
</table>
<p>That I am fully aware that 168 ADI Bed and Bath is a NO CASH PAYMENT TRANSACTION. That the LESSOR's representative or staff is NOT allowed to receive cash payment from the LESSEE.</p>
<table class="signature-block">
  <tr>
    <td>{{legal_name}}<br/><small>LESSEE</small></td>
    <td>HERMINIO M. JUNIO<br/><small>LESSOR</small></td>
  </tr>
</table>

<h1>WAIVER — UTILITY DISCONNECTION</h1>
<p>The LESSOR shall have the right to disconnect any and all public utilities in the subject premises in the event that the public utilities bill reaches the amount of Php3,000.00.</p>
<p>The LESSEE hereby waives and quitclaims any and all rights his/her that may arise from such disconnection and shall hold the LESSOR free and harmless from any and all liabilities and actions, civil or criminal in nature.</p>
<p>{{legal_name}} of unit {{unit_no}} in Adi 168, fully agree on the above statement and Eves Residences has no responsibility that may occur during the period of cut off.</p>
<table class="signature-block">
  <tr>
    <td>{{legal_name}}<br/><small>LESSEE</small></td>
    <td>HERMINIO M. JUNIO<br/><small>LESSOR</small></td>
  </tr>
</table>

<h1>DIGITAL CONTRACT POLICY AND ACTIVE EMAIL ADDRESS</h1>
<p>The Lessee shall provide and maintain a valid and active email address, which shall serve as the official and exclusive channel for the delivery of contracts only.</p>
<p>All contracts shall be executed electronically and signed using digital signatures. Such electronic contracts shall be deemed valid, binding, and enforceable in accordance with Republic Act No. 8792 (Electronic Commerce Act of the Philippines).</p>
<p>Any contract sent to the Lessee's registered email address ({{email_addr}}) shall be deemed received, acknowledged, and legally binding upon transmission.</p>

<h1>ROOM MOVE-IN &amp; MOVE-OUT CHECKLIST</h1>
<p>I, {{legal_name}}, HEREBY CONFIRM AND AGREE THAT THE ABOVE FIXTURES IN MY UNIT ARE ALL IN GOOD CONDITION. THUS, I WILL BE RESPONSIBLE FOR ALL THE DAMAGES INCURRED ON THEM DURING MY STAY.</p>
<table class="checklist">
  <thead>
    <tr>
      <th>PARTICULARS</th>
      <th>YES</th>
      <th>NO</th>
      <th>COMMENT (WRITE N/A IF NOT APPLICABLE)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Switches</td><td>{{switches}}</td><td></td><td>{{switches_com}}</td></tr>
    <tr><td>Sockets</td><td>{{sockets}}</td><td></td><td>{{sockets_com}}</td></tr>
    <tr><td>Cabinet</td><td>{{cabinet}}</td><td></td><td>{{cabinet_com}}</td></tr>
    <tr><td>Lavatory</td><td>{{lavatory}}</td><td></td><td>{{lavatory_com}}</td></tr>
    <tr><td>Light Bulb</td><td>{{light_bulb}}</td><td></td><td>{{light_bulb_com}}</td></tr>
    <tr><td>Faucets</td><td>{{faucets}}</td><td></td><td>{{faucets_com}}</td></tr>
    <tr><td>Shower Head</td><td>{{shower_head}}</td><td></td><td>{{shower_head_com}}</td></tr>
    <tr><td>De-clogging</td><td>{{declogging}}</td><td></td><td>{{declogging_com}}</td></tr>
    <tr><td>Toilet Bowl</td><td>{{toilet_bowl}}</td><td></td><td>{{toilet_bowl_com}}</td></tr>
    <tr><td>Kitchen Sink</td><td>{{kitchen_sink}}</td><td></td><td>{{kitchen_sink_com}}</td></tr>
    <tr><td>Wall Paint</td><td>{{wall_paint}}</td><td></td><td>{{wall_paint_com}}</td></tr>
    <tr><td>Optional (bed mattress, aircon, tables, and chairs, etc.)</td><td>{{optional}}</td><td></td><td>{{optional_com}}</td></tr>
    <tr><td>Doors</td><td>{{doors}}</td><td></td><td>{{doors_com}}</td></tr>
  </tbody>
</table>
<table class="checklist-footer">
  <tr>
    <td>NUMBER OF PERSONS: {{num_per}}</td>
    <td>WATER READING: {{water}}</td>
    <td>ELECTRIC READING: {{electric}}</td>
  </tr>
</table>
<table class="signature-block">
  <tr><td>{{legal_name}}<br/><small>TENANT SIGNATURE</small></td></tr>
</table>

<h1>MASTER LEASE CONTRACT</h1>
<p>VERSION 3.3 - ENTERPRISE DIGITAL CONTROLLED VERSION</p>
<p>
This Contract is processed under Republic Act No. 8792 (Electronic Commerce Act of 2000).
Electronic signatures and digitally transmitted documents are legally valid and enforceable.
</p>
<p>
All initial contracts and renewals must be executed in the physical presence of an authorized
Property Representative. Digital archiving shall occur only after proper execution.
</p>
<p>
<strong>ANTI-FRAUD AND AUTHENTICITY CLAUSE:</strong> Any falsification, impersonation,
or unauthorized alteration shall constitute material breach and may result in immediate
termination and legal action.
</p>
<p>
Official Email Address of Lessee (MANDATORY): {{email_addr}}
</p>
<p>
Upon signing and approval by the concerned department, the fully executed contract shall
be transmitted to the declared email address. Transmission shall constitute official
delivery regardless of actual receipt.
</p>
<p>
<strong>Entire Agreement and Execution:</strong> The signatures below constitute full
acceptance of this Agreement in its entirety.
</p>

<table class="signature-block">
  <tr>
    <td>{{legal_name}}<br/><small>LESSEE</small></td>
    <td>{{rep}}<br/><small>PROPERTY REPRESENTATIVE</small></td>
  </tr>
</table>
$tpl$;

  insert into prep.contract_template
    (name, title, body_markdown, version, active, property_id, term_type)
  values
    ('long_term_v3_3', 'Long Term Contract of Lease', v_body, 1, true, null, 'long_term');

  raise notice 'Seeded long_term template.';
end $$;