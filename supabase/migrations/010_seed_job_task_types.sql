-- 010_seed_job_task_types.sql
-- Job task categories with PHP approval thresholds.

insert into maint.job_task_type (key, name, approval_threshold_php) values
  ('plumbing',     'Plumbing',          5000),
  ('electrical',   'Electrical',        5000),
  ('hvac',         'HVAC / Aircon',     8000),
  ('appliance',    'Appliance Repair',  3000),
  ('carpentry',    'Carpentry',         2000),
  ('painting',     'Painting',          2000),
  ('cleaning',     'Cleaning',          1000),
  ('pest_control', 'Pest Control',      1500),
  ('turnover',     'Unit Turnover',    10000),
  ('other',        'Other',             3000)
on conflict (key) do nothing;
