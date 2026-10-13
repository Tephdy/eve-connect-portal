-- ---------------------------------------------------------------------------
-- 20261013000007_fix_rep_signature.sql
--
-- Appends Jorgette Sta Maria / Property Representative to the reservation
-- template and inserts the signature placeholder. Also re-adds the
-- placeholder to any already-rendered reservation contracts that are missing it.
-- Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  v_updated integer;
begin
  -- 1. Update the template body
  update prep.contract_template
  set body_markdown = replace(
    body_markdown,
    '<p><strong>{{representative}}</strong><br/>For Management: Authorized Representative</p>',
    '<p><strong>{{representative}}</strong><br/>For Management: Authorized Representative</p>' ||
    E'\n{{representative_signature}}\n' ||
    '<p>Jorgette Sta Maria</p>' ||
    '<p>Property Representative</p>'
  )
  where doc_type = 'reservation'
    and active = true
    and body_markdown like '%For Management: Authorized Representative%'
    and body_markdown not like '%Jorgette Sta Maria%';

  get diagnostics v_updated = row_count;
  raise notice 'Template rows updated: %', v_updated;
end $$;