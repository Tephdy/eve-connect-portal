-- ---------------------------------------------------------------------------
-- 20261013000000_remove_body_barcode_placeholder.sql
--
-- Removes the redundant <p class="barcode-placeholder">{{barcode}}</p> from
-- the Adi 168 long_term template body. The barcode is rendered by the print
-- page's letterhead; the placeholder inside the body produced duplicate text.
-- ---------------------------------------------------------------------------

update prep.contract_template
set body_markdown = regexp_replace(
  body_markdown,
  '<p class="barcode-placeholder">\{\{barcode\}\}</p>',
  '<!-- @@CONTRACT_ENGINE:no-barcode-in-body -->',
  'g'
)
where term_type = 'long_term'
  and active = true
  and body_markdown like '%barcode-placeholder%';

-- Also clean any already-generated bodies that still contain the placeholder
update prep.contract
set generated_body = regexp_replace(
  generated_body,
  '<p class="barcode-placeholder">[\s\S]*?</p>',
  '<!-- @@CONTRACT_ENGINE:no-barcode-in-body -->',
  'g'
)
where generated_body is not null
  and generated_body like '%barcode-placeholder%';
