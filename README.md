# Barangay Management System

## Backend

The backend is now Node.js/Express and lives in `backend/src`.

```bash
cd backend
npm install
npm run dev
```

The API keeps the existing `/api` route shape used by the React frontend.
MongoDB remains the primary database. Supabase Storage is used for resident
photos and generated PDF files when the configured bucket is available.

Copy `backend/.env.example` for production setup and set:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for private/server-side storage access
- `SUPABASE_BUCKET`, defaulting to `barangay-assets`

If `SUPABASE_SERVICE_ROLE_KEY` is configured, the backend will try to create
`SUPABASE_BUCKET` automatically as a private bucket when it is missing. If only
the publishable key is configured, private uploads intentionally fall back to
local storage because Supabase will reject private bucket writes through RLS.

You can also create/update the required private storage bucket by running
`docs/supabase/storage-buckets.sql` in the Supabase SQL Editor.
