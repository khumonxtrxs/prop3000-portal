-- ============================================================
-- PROP3000 PORTAL
-- Local development seed data
-- ============================================================

-- Runs after all migrations during:
--   npx supabase db reset

-- Migrations provide baseline records, including the 13
-- service types and the first 6 property listings. This file adds
-- demo users and transactional data needed by the
-- role dashboards and demo flows.

-- Development only

-- ============================================================
-- 1. DEMO AUTH AND ROLES
-- ============================================================

-- Five demo accounts use deterministic UUIDs so foreign-key
-- relationships remain stable after every db reset.

-- All demo accounts use the local-development password defined in
-- src/lib/demo-accounts.ts: Prop3000#2026

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
VALUES
(
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'client@prop3000.demo',
    crypt('Prop3000#2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Thandi Client"}'::jsonb,
    now() - interval '6 months',
    now(),
    '',
    '',
    '',
    ''
),
(
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'admin@prop3000.demo',
    crypt('Prop3000#2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Office Admin"}'::jsonb,
    now() - interval '6 months',
    now(),
    '',
    '',
    '',
    ''
),
(
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'agent@prop3000.demo',
    crypt('Prop3000#2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Riaan Agent"}'::jsonb,
    now() - interval '6 months',
    now(),
    '',
    '',
    '',
    ''
),
(
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'supervisor@prop3000.demo',
    crypt('Prop3000#2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Sipho Supervisor"}'::jsonb,
    now() - interval '6 months',
    now(),
    '',
    '',
    '',
    ''
),
(
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'owner@prop3000.demo',
    crypt('Prop3000#2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Leah''s Dad"}'::jsonb,
    now() - interval '6 months',
    now(),
    '',
    '',
    '',
    ''
);

-- Supabase Auth requires a matching email identity for each seeded
-- email/password user. Identity UUIDs are fixed

INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    created_at,
    updated_at
)
VALUES
(
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    jsonb_build_object(
        'sub', '10000000-0000-0000-0000-000000000001',
        'email', 'client@prop3000.demo',
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    now(),
    now()
),
(
    '11000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    jsonb_build_object(
        'sub', '10000000-0000-0000-0000-000000000002',
        'email', 'admin@prop3000.demo',
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    now(),
    now()
),
(
    '11000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    jsonb_build_object(
        'sub', '10000000-0000-0000-0000-000000000003',
        'email', 'agent@prop3000.demo',
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    now(),
    now()
),
(
    '11000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    jsonb_build_object(
        'sub', '10000000-0000-0000-0000-000000000004',
        'email', 'supervisor@prop3000.demo',
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    now(),
    now()
),
(
    '11000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    jsonb_build_object(
        'sub', '10000000-0000-0000-0000-000000000005',
        'email', 'owner@prop3000.demo',
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    now(),
    now()
);

-- handle_new_user() gives every new Auth user the client role.
-- Add each staff account's intended role, then remove the default
-- client role so every demo account represents one role.

INSERT INTO public.user_roles (user_id, role)
VALUES
    ('10000000-0000-0000-0000-000000000002', 'admin'),
    ('10000000-0000-0000-0000-000000000003', 'agent'),
    ('10000000-0000-0000-0000-000000000004', 'supervisor'),
    ('10000000-0000-0000-0000-000000000005', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'client'
  AND user_id IN (
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000005'
  );

-- ============================================================
-- 2. SERVICE REQUESTS
-- ============================================================

-- Six requests intentionally cover every valid workflow status so
-- the admin lead-triage UI can demonstrate each state.

INSERT INTO public.service_requests (
    id,
    reference,
    client_id,
    full_name,
    email,
    phone,
    address,
    latitude,
    longitude,
    service_types,
    description,
    budget_range,
    preferred_start_date,
    status,
    admin_notes,
    created_at
)
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'SR-DEMO01',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '12 Durban Road, Bellville',
    -33.9010,
    18.6292,
    ARRAY['Painting'],
    'Repaint the interior of a three-bedroom home.',
    'R20 000–R50 000',
    current_date + 21,
    'new',
    NULL,
    now() - interval '5 months'
),
(
    '20000000-0000-0000-0000-000000000002',
    'SR-DEMO02',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '44 Brackenfell Boulevard, Brackenfell',
    -33.8847,
    18.6994,
    ARRAY['Plumbing'],
    'Replace an old geyser and repair leaking pipework.',
    'R20 000–R50 000',
    current_date + 14,
    'contacted',
    'Client contacted by office.',
    now() - interval '4 months'
),
(
    '20000000-0000-0000-0000-000000000003',
    'SR-DEMO03',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '8 Main Road, Durbanville',
    -33.8324,
    18.6476,
    ARRAY['Renovations', 'Cabinet Making'],
    'Kitchen renovation including new cabinets and counters.',
    'R50 000–R150 000',
    current_date + 30,
    'quoted',
    'Quote prepared and sent.',
    now() - interval '3 months'
),
(
    '20000000-0000-0000-0000-000000000004',
    'SR-DEMO04',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '21 Langverwacht Road, Kuils River',
    -33.9277,
    18.6817,
    ARRAY['Electrical'],
    'Electrical inspection and replacement of distribution board.',
    'Under R20 000',
    current_date + 7,
    'approved',
    'Client approved the quoted work.',
    now() - interval '2 months'
),
(
    '20000000-0000-0000-0000-000000000005',
    'SR-DEMO05',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '73 Voortrekker Road, Parow',
    -33.9057,
    18.5869,
    ARRAY['Waterproofing'],
    'Waterproof a leaking flat roof before winter.',
    'R20 000–R50 000',
    current_date,
    'converted',
    'Converted into active job.',
    now() - interval '1 month'
),
(
    '20000000-0000-0000-0000-000000000006',
    'SR-DEMO06',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '19 Vasco Boulevard, Goodwood',
    -33.9102,
    18.5486,
    ARRAY['Building'],
    'Proposed second-storey extension.',
    'R150 000+',
    NULL,
    'declined',
    'Outside current project scope.',
    now() - interval '10 days'
);

-- ============================================================
-- 3. PROPERTY SUBMISSIONS
-- ============================================================

-- Four cash-sale leads cover early, mid-pipeline and completed
-- states for the admin cash-sale workflow.

INSERT INTO public.property_submissions (
    id,
    reference,
    client_id,
    full_name,
    email,
    phone,
    address,
    property_type,
    condition,
    bedrooms,
    bathrooms,
    erf_size,
    asking_price,
    description,
    reason_for_selling,
    status,
    offer_amount,
    created_at
)
VALUES
(
    '30000000-0000-0000-0000-000000000001',
    'PS-DEMO01',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '16 Churchill Road, Bellville',
    'house',
    'fair',
    3,
    2,
    '496 m²',
    895000,
    'Family home requiring cosmetic renovation.',
    'Relocating for work.',
    'new',
    NULL,
    now() - interval '4 months'
),
(
    '30000000-0000-0000-0000-000000000002',
    'PS-DEMO02',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '51 Brighton Road, Kraaifontein',
    'house',
    'good',
    3,
    2,
    '420 m²',
    980000,
    'Well-maintained freestanding home.',
    'Moving closer to family.',
    'reviewing',
    NULL,
    now() - interval '3 months'
),
(
    '30000000-0000-0000-0000-000000000003',
    'PS-DEMO03',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '6 Koeberg Road, Milnerton',
    'incomplete_build',
    'poor',
    2,
    1,
    '610 m²',
    720000,
    'Partially completed residential build.',
    'Project costs became too high.',
    'offer_made',
    650000,
    now() - interval '2 months'
),
(
    '30000000-0000-0000-0000-000000000004',
    'PS-DEMO04',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '28 Old Paarl Road, Brackenfell',
    'vacant_land',
    'fair',
    NULL,
    NULL,
    '740 m²',
    595000,
    'Residential vacant stand.',
    'No longer planning to build.',
    'purchased',
    560000,
    now() - interval '25 days'
);

-- ============================================================
-- 4. ADDITIONAL PROPERTY LISTINGS
-- ============================================================

-- Migrations already create six listings. These two bring the demo
-- total to eight and add price and suburb variety.

INSERT INTO public.listings (
    id,
    reference,
    title,
    address,
    suburb,
    city,
    latitude,
    longitude,
    property_type,
    condition,
    bedrooms,
    bathrooms,
    erf_size,
    price,
    description,
    status,
    agent_id,
    agent_name,
    created_at
)
VALUES
(
    '40000000-0000-0000-0000-000000000001',
    'LST-DEMO07',
    'Renovation Opportunity in Bellville',
    '22 Boston Street',
    'Bellville',
    'Cape Town',
    -33.8949,
    18.6260,
    'house',
    'fair',
    3,
    1,
    '495 m²',
    850000,
    'Three-bedroom home with strong renovation potential.',
    'published',
    '10000000-0000-0000-0000-000000000003',
    'Riaan Agent',
    now() - interval '2 months'
),
(
    '40000000-0000-0000-0000-000000000002',
    'LST-DEMO08',
    'Large Family Home in Durbanville',
    '14 Oxford Street',
    'Durbanville',
    'Cape Town',
    -33.8331,
    18.6508,
    'house',
    'good',
    4,
    2,
    '780 m²',
    1450000,
    'Spacious four-bedroom property with generous erf.',
    'published',
    '10000000-0000-0000-0000-000000000003',
    'Riaan Agent',
    now() - interval '12 days'
);

-- ============================================================
-- 5. JOBS
-- ============================================================

-- Four jobs demonstrate quoted, approved, in-progress and complete
-- stages. Linked quote amounts are kept consistent with quote totals.

INSERT INTO public.jobs (
    id,
    reference,
    service_request_id,
    client_id,
    client_name,
    client_phone,
    title,
    description,
    address,
    service_types,
    supervisor_id,
    status,
    progress,
    quote_amount,
    start_date,
    target_end_date,
    completed_at,
    created_at
)
VALUES
(
    '50000000-0000-0000-0000-000000000001',
    'JOB-DEMO01',
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    '082 555 0101',
    'Kitchen Renovation',
    'Kitchen renovation and cabinet replacement.',
    '8 Main Road, Durbanville',
    ARRAY['Renovations', 'Cabinet Making'],
    '10000000-0000-0000-0000-000000000004',
    'quoted',
    0,
    117300,
    current_date + 14,
    current_date + 42,
    NULL,
    now() - interval '3 months'
),
(
    '50000000-0000-0000-0000-000000000002',
    'JOB-DEMO02',
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    '082 555 0101',
    'Electrical Upgrade',
    'Distribution board replacement and compliance work.',
    '21 Langverwacht Road, Kuils River',
    ARRAY['Electrical'],
    '10000000-0000-0000-0000-000000000004',
    'approved',
    0,
    18400,
    current_date + 5,
    current_date + 7,
    NULL,
    now() - interval '2 months'
),
(
    '50000000-0000-0000-0000-000000000003',
    'JOB-DEMO03',
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    '082 555 0101',
    'Roof Waterproofing',
    'Waterproofing and sealing of flat roof.',
    '73 Voortrekker Road, Parow',
    ARRAY['Waterproofing'],
    '10000000-0000-0000-0000-000000000004',
    'in_progress',
    55,
    36000,
    current_date - 10,
    current_date + 8,
    NULL,
    now() - interval '6 weeks'
),
-- Historical standalone job. Leaving it unlinked lets the six seeded
-- service requests retain one row for every workflow status.
(
    '50000000-0000-0000-0000-000000000004',
    'JOB-DEMO04',
    NULL,
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    '082 555 0101',
    'Geyser Replacement',
    'Replacement geyser and repaired damaged pipework.',
    '44 Brackenfell Boulevard, Brackenfell',
    ARRAY['Plumbing'],
    '10000000-0000-0000-0000-000000000004',
    'complete',
    100,
    29500,
    current_date - 50,
    current_date - 45,
    now() - interval '45 days',
    now() - interval '4 months'
);

-- ============================================================
-- 6. JOB STATUS HISTORY
-- ============================================================

-- History rows are chronological and end at the current status of
-- each parent job so the supervisor dashboard has a useful audit trail.

INSERT INTO public.job_status_history (
    job_id,
    status,
    note,
    changed_by,
    created_at
)
VALUES
(
    '50000000-0000-0000-0000-000000000001',
    'quoted',
    'Quote prepared for client.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '3 months'
),
(
    '50000000-0000-0000-0000-000000000002',
    'quoted',
    'Initial quotation prepared.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '2 months'
),
(
    '50000000-0000-0000-0000-000000000002',
    'approved',
    'Client approved the work.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '7 weeks'
),
(
    '50000000-0000-0000-0000-000000000003',
    'quoted',
    'Waterproofing quote created.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '6 weeks'
),
(
    '50000000-0000-0000-0000-000000000003',
    'approved',
    'Work approved.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '5 weeks'
),
(
    '50000000-0000-0000-0000-000000000003',
    'in_progress',
    'Site team started waterproofing.',
    '10000000-0000-0000-0000-000000000004',
    now() - interval '10 days'
),
(
    '50000000-0000-0000-0000-000000000004',
    'quoted',
    'Plumbing quotation prepared.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '4 months'
),
(
    '50000000-0000-0000-0000-000000000004',
    'approved',
    'Client approved quotation.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '3 months'
),
(
    '50000000-0000-0000-0000-000000000004',
    'in_progress',
    'Technician started installation.',
    '10000000-0000-0000-0000-000000000004',
    now() - interval '2 months'
),
(
    '50000000-0000-0000-0000-000000000004',
    'complete',
    'Installation complete and tested.',
    '10000000-0000-0000-0000-000000000004',
    now() - interval '45 days'
);

-- ============================================================
-- 7. QUOTES
-- ============================================================

-- Two quotes provide actionable and completed client states.
-- VAT is 15%, and totals match the linked job quote amounts.

INSERT INTO public.quotes (
    id,
    quote_number,
    service_request_id,
    job_id,
    client_id,
    client_name,
    line_items,
    subtotal,
    vat,
    total,
    valid_until,
    status,
    notes,
    created_by,
    created_at
)
VALUES
(
    '60000000-0000-0000-0000-000000000001',
    'Q-DEMO01',
    '20000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    '[
      {"description":"Kitchen renovation labour","quantity":1,"unit_price":70000,"total":70000},
      {"description":"Cabinet manufacture and installation","quantity":1,"unit_price":32000,"total":32000}
    ]'::jsonb,
    102000,
    15300,
    117300,
    current_date + 14,
    'sent',
    'Valid for 14 days.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '14 days'
),
(
    '60000000-0000-0000-0000-000000000002',
    'Q-DEMO02',
    '20000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    '[
      {"description":"Distribution board replacement","quantity":1,"unit_price":12500,"total":12500},
      {"description":"Electrical compliance work","quantity":1,"unit_price":3500,"total":3500}
    ]'::jsonb,
    16000,
    2400,
    18400,
    current_date + 7,
    'approved',
    'Approved by client.',
    '10000000-0000-0000-0000-000000000002',
    now() - interval '1 month'
);

-- ============================================================
-- 8. BOOKINGS
-- ============================================================

-- Six bookings span several booking types, dates and statuses so
-- the admin diary contains both upcoming and historical entries.

INSERT INTO public.bookings (
    id,
    reference,
    booking_type,
    client_id,
    full_name,
    email,
    phone,
    address,
    scheduled_date,
    scheduled_time,
    notes,
    service_request_id,
    property_submission_id,
    job_id,
    assigned_to,
    status,
    created_at
)
VALUES
(
    '70000000-0000-0000-0000-000000000001',
    'BK-DEMO01',
    'site_visit',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '12 Durban Road, Bellville',
    current_date + 2,
    '09:00',
    'Initial site assessment.',
    '20000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    '10000000-0000-0000-0000-000000000004',
    'requested',
    now() - interval '5 days'
),
(
    '70000000-0000-0000-0000-000000000002',
    'BK-DEMO02',
    'consultation',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '8 Main Road, Durbanville',
    current_date + 4,
    '11:00',
    'Discuss kitchen layout.',
    '20000000-0000-0000-0000-000000000003',
    NULL,
    NULL,
    '10000000-0000-0000-0000-000000000002',
    'confirmed',
    now() - interval '8 days'
),
(
    '70000000-0000-0000-0000-000000000003',
    'BK-DEMO03',
    'property_viewing',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '6 Koeberg Road, Milnerton',
    current_date + 6,
    '14:00',
    'Property assessment.',
    NULL,
    '30000000-0000-0000-0000-000000000003',
    NULL,
    '10000000-0000-0000-0000-000000000003',
    'confirmed',
    now() - interval '10 days'
),
(
    '70000000-0000-0000-0000-000000000004',
    'BK-DEMO04',
    'renovation_start',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '73 Voortrekker Road, Parow',
    current_date - 10,
    '08:00',
    'Waterproofing start date.',
    '20000000-0000-0000-0000-000000000005',
    NULL,
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    'completed',
    now() - interval '1 month'
),
(
    '70000000-0000-0000-0000-000000000005',
    'BK-DEMO05',
    'consultation',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '44 Brackenfell Boulevard, Brackenfell',
    current_date - 60,
    '10:00',
    'Completed plumbing consultation.',
    '20000000-0000-0000-0000-000000000002',
    NULL,
    '50000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    'completed',
    now() - interval '3 months'
),
(
    '70000000-0000-0000-0000-000000000006',
    'BK-DEMO06',
    'property_viewing',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    '28 Old Paarl Road, Brackenfell',
    current_date - 20,
    '15:00',
    'Viewing cancelled by client.',
    NULL,
    '30000000-0000-0000-0000-000000000004',
    NULL,
    '10000000-0000-0000-0000-000000000003',
    'cancelled',
    now() - interval '2 months'
);

-- ============================================================
-- 9. OFFERS
-- ============================================================

-- Five offers exercise the buyer/agent lifecycle across pending,
-- countered, approved and declined states.

INSERT INTO public.offers (
    id,
    reference,
    listing_id,
    client_id,
    client_name,
    client_email,
    client_phone,
    amount,
    message,
    status,
    counter_amount,
    agent_notes,
    created_at,
    updated_at
)
VALUES
(
    '80000000-0000-0000-0000-000000000001',
    'OF-DEMO01',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    780000,
    'I am interested in the property and would like to make an offer.',
    'pending',
    NULL,
    NULL,
    now() - interval '5 days',
    now() - interval '5 days'
),
(
    '80000000-0000-0000-0000-000000000002',
    'OF-DEMO02',
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    1320000,
    'Please consider my offer.',
    'pending',
    NULL,
    NULL,
    now() - interval '3 days',
    now() - interval '3 days'
),
(
    '80000000-0000-0000-0000-000000000003',
    'OF-DEMO03',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    760000,
    'Offer subject to viewing.',
    'countered',
    810000,
    'Seller is willing to proceed at R810 000.',
    now() - interval '3 weeks',
    now() - interval '18 days'
),
(
    '80000000-0000-0000-0000-000000000004',
    'OF-DEMO04',
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    1380000,
    'Ready to proceed if accepted.',
    'approved',
    NULL,
    'Offer accepted.',
    now() - interval '2 months',
    now() - interval '7 weeks'
),
(
    '80000000-0000-0000-0000-000000000005',
    'OF-DEMO05',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Thandi Client',
    'client@prop3000.demo',
    '082 555 0101',
    700000,
    'Cash offer.',
    'declined',
    NULL,
    'Offer below seller expectation.',
    now() - interval '4 months',
    now() - interval '15 weeks'
);

-- ============================================================
-- 10. OFFER EVENTS
-- ============================================================

-- Event rows preserve the offer audit trail shown on the client and
-- agent dashboards.

INSERT INTO public.offer_events (
    id,
    offer_id,
    status,
    note,
    amount,
    actor_id,
    created_at
)
VALUES
(
    '90000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'pending',
    'Offer submitted by buyer.',
    780000,
    '10000000-0000-0000-0000-000000000001',
    now() - interval '5 days'
),
(
    '90000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000002',
    'pending',
    'Offer submitted by buyer.',
    1320000,
    '10000000-0000-0000-0000-000000000001',
    now() - interval '3 days'
),
(
    '90000000-0000-0000-0000-000000000003',
    '80000000-0000-0000-0000-000000000003',
    'pending',
    'Offer submitted by buyer.',
    760000,
    '10000000-0000-0000-0000-000000000001',
    now() - interval '3 weeks'
),
(
    '90000000-0000-0000-0000-000000000004',
    '80000000-0000-0000-0000-000000000003',
    'countered',
    'Agent sent a counter offer.',
    810000,
    '10000000-0000-0000-0000-000000000003',
    now() - interval '18 days'
),
(
    '90000000-0000-0000-0000-000000000005',
    '80000000-0000-0000-0000-000000000004',
    'pending',
    'Offer submitted by buyer.',
    1380000,
    '10000000-0000-0000-0000-000000000001',
    now() - interval '2 months'
),
(
    '90000000-0000-0000-0000-000000000006',
    '80000000-0000-0000-0000-000000000004',
    'approved',
    'Agent approved the offer.',
    1380000,
    '10000000-0000-0000-0000-000000000003',
    now() - interval '7 weeks'
),
(
    '90000000-0000-0000-0000-000000000007',
    '80000000-0000-0000-0000-000000000005',
    'pending',
    'Offer submitted by buyer.',
    700000,
    '10000000-0000-0000-0000-000000000001',
    now() - interval '4 months'
),
(
    '90000000-0000-0000-0000-000000000008',
    '80000000-0000-0000-0000-000000000005',
    'declined',
    'Agent declined the offer.',
    700000,
    '10000000-0000-0000-0000-000000000003',
    now() - interval '15 weeks'
);

-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================

-- A mix of read and unread notifications exercises both the alert
-- counter and notification history.

INSERT INTO public.notifications (
    id,
    user_id,
    title,
    body,
    link,
    offer_id,
    read,
    created_at
)
VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'New offer received',
    'Thandi Client submitted an offer of R780 000.',
    '/portal/agent',
    '80000000-0000-0000-0000-000000000001',
    false,
    now() - interval '5 days'
),
(
    'a0000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'New offer received',
    'Thandi Client submitted an offer of R1 320 000.',
    '/portal/agent',
    '80000000-0000-0000-0000-000000000002',
    false,
    now() - interval '3 days'
),
(
    'a0000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Agent countered your offer',
    'The agent countered at R810 000.',
    '/portal/offers',
    '80000000-0000-0000-0000-000000000003',
    false,
    now() - interval '18 days'
),
(
    'a0000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Offer approved',
    'Your offer of R1 380 000 has been approved.',
    '/portal/offers',
    '80000000-0000-0000-0000-000000000004',
    true,
    now() - interval '7 weeks'
),
(
    'a0000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'Offer declined',
    'Your offer of R700 000 was declined.',
    '/portal/offers',
    '80000000-0000-0000-0000-000000000005',
    true,
    now() - interval '15 weeks'
),
(
    'a0000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000004',
    'Job progress reminder',
    'Roof Waterproofing is currently at 55% progress.',
    '/portal/supervisor',
    NULL,
    false,
    now() - interval '2 days'
);
