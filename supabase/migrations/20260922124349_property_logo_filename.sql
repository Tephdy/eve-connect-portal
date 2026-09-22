-- Per-property contract header logo.
-- Default: eves_logo.png (Apartment Portal brand).
-- Override per property, e.g. BED AND BATH uses bnb_logo.png.

alter table core.property
  add column if not exists logo_filename text not null default 'eves_logo.png';

-- Point BED AND BATH to the BnB-branded logo.
update core.property
set logo_filename = 'bnb_logo.png'
where id = 'dcb38fe9-bd9b-4f3d-8a9f-1059e9e54f52';

-- Sanity check (9 rows eves_logo.png, 1 row bnb_logo.png):
-- select id, name, logo_filename from core.property order by name;
