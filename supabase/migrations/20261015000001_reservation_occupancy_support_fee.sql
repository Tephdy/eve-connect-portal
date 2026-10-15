update prep.contract_template
set body_markdown =
  replace(
    replace(
      replace(
        replace(
          body_markdown,
          '<tr><td>Add-ons Total Amount:</td><td>P{{add_ons_amount}}.00</td><td>Admin Fee:</td><td>P{{admin_fee}}.00</td></tr>',
          '<tr><td>Add-ons Total Amount:</td><td colspan="3">P{{add_ons_amount}}</td></tr>'
        ),
        '<tr><td>Add-ons Total Amount:</td><td>P{{add_ons_amount}}</td><td>Admin Fee:</td><td>P{{admin_fee}}</td></tr>',
        '<tr><td>Add-ons Total Amount:</td><td colspan="3">P{{add_ons_amount}}</td></tr>'
      ),
      '<tr><td>Occupancy Support Fee:</td><td>P{{occupancy_fee}}.00</td><td></td><td></td></tr>',
      '<tr><td>Occupancy Support Fee:</td><td colspan="3">P{{occupancy_fee}}</td></tr>'
    ),
    '<tr><td>Occupancy Support Fee:</td><td>P{{occupancy_fee}}</td><td></td><td></td></tr>',
    '<tr><td>Occupancy Support Fee:</td><td colspan="3">P{{occupancy_fee}}</td></tr>'
  )
where doc_type = 'reservation'
  and active = true;
