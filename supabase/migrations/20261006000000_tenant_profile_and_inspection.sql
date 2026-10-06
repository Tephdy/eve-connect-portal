-- Part A: 26 new tenant columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'core' AND table_name = 'tenant'
  AND column_name IN (
    'first_name','middle_name','last_name','birth_date','gender','nationality',
    'religion','civil_status','permanent_address','recent_address',
    'company','work_status','work_position','company_address','company_tel',
    'company_email','company_messenger',
    'ec1_name','ec1_phone','ec1_email','ec1_messenger',
    'ec2_name','ec2_phone','ec2_email','ec2_messenger',
    'marketing_source'
  )
ORDER BY column_name;
-- Expected: 26 rows

-- Part B: prep.unit_inspection table exists
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'prep' AND table_name = 'unit_inspection'
ORDER BY ordinal_position;
-- Expected: ~35 columns

-- Part C: RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'prep' AND tablename = 'unit_inspection';
-- Expected: rowsecurity = true

-- Part D: policies present
SELECT policyname FROM pg_policies
WHERE schemaname = 'prep' AND tablename = 'unit_inspection';
-- Expected: 3 rows (staff_read, staff_write, unit_inspection_self)