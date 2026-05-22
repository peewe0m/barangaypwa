# Barangay Management System - PRD

## Original Problem Statement
Create a FULL STACK Barangay Management System for the Philippines with a modern professional government-style design, modular architecture, responsive layout, and scalable backend.

## User Choices
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT-based authentication
- **PDF Generation**: Server-side (reportlab)
- **Design**: Green/earth tones (Forest Green #2d6a4f), professional government aesthetic

## Tech Stack
- Frontend: React 19, Shadcn UI, Tailwind CSS, Recharts, Lucide icons, jsPDF
- Backend: FastAPI, MongoDB (Motor), bcrypt, PyJWT, ReportLab, qrcode, Pillow
- Fonts: Work Sans (headings), IBM Plex Sans (body)

## Core Requirements (Implemented - Phase 2)
All 13 admin modules + public portal:

### Backend Endpoints (100+ endpoints)
- **Auth**: `/api/auth/{login,register,logout,me}` - JWT cookies, bcrypt, brute-force protection
- **Residents**: Full CRUD + photo upload at `/api/residents/{id}/photo`
- **Households**: CRUD + member assignment
- **Documents**: 8 certificate types with QR-coded PDF generation
- **Businesses**: Registration, renewal, deletion
- **Blotter**: CRUD with status workflow (pending → mediation → resolved)
- **Health Records**: Vaccination, medical, prenatal tracking
- **Welfare**: PWD/Senior/Solo Parent/4Ps assistance tracking
- **Appointments**: Scheduling with queue numbers + status tracking
- **Payments**: Receipt generation, revenue tracking
- **Barangay ID**: Card generation with QR + photo
- **Reports**: Demographics & financial reports with PDF/CSV export
- **Portal (public)**: `/api/portal/document-request` + `/api/portal/track/{tracking_number}` (no auth)
- **Portal Admin**: View & process online requests
- **Dashboard**: Comprehensive stats with monthly revenue
- **Seed**: Sample data populator

### Frontend Pages
- Public: PortalPage (online request + tracking)
- Auth: LoginPage with glassmorphism
- Admin (13 modules): Dashboard, Residents (CRUD + photo + edit), Households, Documents, Online Requests, Business, Blotter, Health (3 tabs), Welfare (4 program tabs), Barangay ID, Appointments, Payments, Reports, Settings

## What's Been Implemented (Feb 22, 2026)
### Phase 1 (Initial MVP)
- Auth, Dashboard, Residents, Documents, Sample data seeder

### Phase 2 (Today - Full Build-out)
- All 10 remaining modules with full CRUD
- Resident edit functionality
- Photo upload via clickable avatars
- Barangay ID generation with PDF export (front+back card layout)
- 8 document PDF templates (all certificate types)
- Reports with PDF and CSV export
- Public Resident Portal (online document requests + tracking)
- Portal requests admin view

## Test Credentials
- Email: admin@barangay.gov.ph
- Password: admin123
- Role: super_admin

## Test Results
- Backend: 46/47 tests passing (97.9%) → after fix: 47/47 expected
- Frontend: 95% (all routes load, portal works, edit dialog works)
- Only fixed issue: Barangay ID PDF reportlab LayoutError

## Public URLs
- Admin: `/login` → `/dashboard`
- Public Portal: `/portal`

## Configuration Files
- Backend: `/app/backend/config/system.py`
- Frontend: `/app/frontend/src/config/{theme.js,system.js,api.js}`
- All static values (barangay info, fees, document types, civil status, religions) editable

## Prioritized Backlog
### P2 (Future Enhancements)
- Email/SMS notifications for document approval
- Stripe/GCash integration for online payments
- Multi-language support (English/Tagalog)
- Dark mode toggle
- Activity logs and audit trail
- Calendar view for appointments
- Family tree visualization for households
- Replace native date inputs with shadcn Calendar component

## Architecture Notes
- All MongoDB documents use `id` field (secrets.token_urlsafe) - no ObjectId issues
- All API routes prefixed with `/api`
- Cookie-based auth with `credentials: 'include'`
- File uploads stored in `/app/backend/uploads/residents/`
- Server: 1062 lines (consider splitting into routers per resource for maintainability)
