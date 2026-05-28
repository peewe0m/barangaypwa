-- Barangay Management System - Supabase Storage setup
--
-- How to use:
-- 1. Open Supabase Dashboard > SQL Editor.
-- 2. Paste this file and run it.
-- 3. Set backend/.env:
--    SUPABASE_URL=https://ecpinptphmrdrjaigaaz.supabase.co
--    SUPABASE_BUCKET=barangay-assets
--    SUPABASE_SERVICE_ROLE_KEY=<your service role key>
--
-- The backend writes through the service role key and keeps files private.
-- Do not make this bucket public.
--
-- Important:
-- The backend must use SUPABASE_SERVICE_ROLE_KEY for private uploads.
-- If the backend uses SUPABASE_PUBLISHABLE_KEY/anon key, Supabase will reject
-- writes with "new row violates row-level security policy".
-- Do not solve that by adding an anon upload policy for this bucket.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'barangay-assets',
  'barangay-assets',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The app stores files in these private prefixes inside barangay-assets:
-- residents/<resident-id>.<ext>
-- documents/<document-request-id>.pdf
-- barangay-ids/<barangay-id-document-id>.pdf
-- portal-requests/<request-id>/photo.<ext>
-- document-templates/<document-type>/<filename>

-- Optional policy for browser-side authenticated uploads.
-- The current backend does not need this when SUPABASE_SERVICE_ROLE_KEY is used.
-- Uncomment only if you intentionally allow authenticated Supabase users to upload
-- directly from the browser.
-- This policy does not help the Express backend unless the request is made as
-- a Supabase authenticated user; backend uploads should use the service role key.
--
-- create policy "Authenticated users can upload barangay assets"
-- on storage.objects
-- for insert
-- to authenticated
-- with check (bucket_id = 'barangay-assets');

-- Optional policy for browser-side authenticated reads.
-- The current app serves private files through backend authenticated routes, so this
-- should normally stay disabled.
--
-- create policy "Authenticated users can read barangay assets"
-- on storage.objects
-- for select
-- to authenticated
-- using (bucket_id = 'barangay-assets');
