-- ---------------------------------------------------------------------------
-- 20261013000006_add_rep_signature_placeholder.sql
--
-- Inserts {{representative_signature}} into the reservation template body
-- right after the "Authorized Representative" label, so the printed
-- contract shows the Property Rep's wet signature.
-- Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  v_updated integer;
begin
  update prep.contract_template
  set body_markdown = replace(
    body_markdown,
    '<p><strong>Authorized Representative</strong><br/>' ||
    'For Management: Authorized Representative</p>' ||
    '<p>Jorgette Sta Maria</p><br/>' ||
    '<p>Property Representative</p>',
    '<p><strong>Authorized Representative</strong><br/>' ||
    'For Management: Authorized Representative</p>' ||
    '{{representative_signature}}' ||
    '<p>Jorgette Sta Maria</p>' ||
    '<p>Property Representative</p>'
  )
  where doc_type = 'reservation'
    and active = true
    and body_markdown like '%Authorized Representative%'
    and body_markdown not like '%{{representative_signature}}%';

  get diagnostics v_updated = row_count;
  raise notice 'Updated % reservation template row(s).', v_updated;
end $$;
