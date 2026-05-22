# Barangay Management System - PRD

## Original Problem Statement
Create a FULL STACK Barangay Management System for the Philippines with a modern professional government-style design, modular architecture, responsive layout, and scalable backend.

## User Choices
- **Backend**: FastAPI + MongoDB (adapted from Node.js/Express + MySQL)
- **Auth**: JWT-based authentication
- **PDF Generation**: Server-side (reportlab)
- **Design**: Green/earth tones (Forest Green #2d6a4f), professional government aesthetic
- **Priority**: All modules

## Tech Stack
- Frontend: React 19, Shadcn UI, Tailwind CSS, Recharts, Lucide icons
- Backend: FastAPI, MongoDB (Motor), bcrypt, PyJWT, ReportLab, qrcode
- Fonts: Work Sans (headings), IBM Plex Sans (body)

## User Personas
1. **Super Admin / Captain**: Full system access, manage users, configure settings
2. **Secretary / Staff**: Manage residents, process documents, generate certificates
3. **Treasurer**: Handle payments, financial reports
4. **Kagawad**: Limited admin access for specific modules
5. **Resident**: View own profile, request documents online (future)

## Core Requirements (Implemented)
✅ Authentication (JWT cookies, bcrypt, brute-force protection, role-based)
✅ Dashboard with stats, charts, recent activity, animated counters
✅ Resident Management (CRUD, search, filter, status badges)
✅ Document Request Workflow (create, approve, PDF download with QR codes)
✅ Server-side PDF generation (3 certificate types: Clearance, Residency, Indigency)
✅ Sample data seeder for instant demo
✅ Sidebar navigation with all 13 modules
✅ Glassmorphism login page with green earthy theme
✅ Responsive layout (mobile-friendly with hamburger menu)
✅ Config files: theme.js, system.js, api.js (frontend), system.py (backend)

## What's Been Implemented (Feb 22, 2026)
### Backend (FastAPI + MongoDB)
- `/api/auth/*` - Login, register, logout, /me with JWT httpOnly cookies
- `/api/residents/*` - Full CRUD with search, pagination
- `/api/document-requests/*` - Create, approve, download PDF
- `/api/dashboard/stats` - Aggregated statistics
- `/api/households/*` - Household management endpoints
- `/api/blotters/*` - Blotter case management
- `/api/payments/*` - Payment recording
- `/api/seed/sample-data` - Sample data seeder (12 residents, 8 docs, 3 blotters)
- `/api/config/system` - System configuration

### Frontend (React)
- LoginPage: Glassmorphism design with community center background
- DashboardPage: Welcome banner, 8 stat cards with animations, 2 charts, recent activity
- ResidentsPage: Add/delete residents, search, status badges
- DocumentsPage: Create requests, approve, download PDF certificates
- PlaceholderPage: For under-development modules (Households, Business, Blotter, Health, Welfare, ID, Appointments, Payments, Reports, Settings)
- Sidebar with active state highlighting
- AnimatedNumber component for counter animations
- AuthContext with cookie-based session management

## Test Credentials
- Email: admin@barangay.gov.ph
- Password: admin123
- Role: super_admin

## Prioritized Backlog
### P0 (Remaining for first 100% completion)
- None - core MVP complete

### P1 (Next Phase Features)
- Implement Households CRUD with member assignment
- Implement Business Clearance module with renewal tracking
- Implement Blotter Management with full case workflow
- Implement Health Records (vaccination, medical assistance)
- Implement Social Welfare module
- Implement Barangay ID generation with photo upload + QR
- Implement Appointment scheduling with calendar view
- Implement Payment receipt generation
- Implement Reports module with PDF/Excel export
- Implement Settings (theme, user management, audit logs)

### P2 (Enhancement Features)
- Resident edit functionality
- Resident detail/profile view
- Family tree visualization for households
- Multi-language support (English/Tagalog)
- Email/SMS notifications for document approval
- Online appointment booking for residents
- Dark mode toggle
- Activity logs and audit trail

## Architecture Notes
- All static values in config files (system.py, theme.js, system.js, api.js)
- MongoDB collections: users, residents, households, document_requests, blotters, payments, login_attempts, password_reset_tokens
- All MongoDB documents use `id` field (secrets.token_urlsafe) instead of `_id` for API access
- All API routes prefixed with `/api` for Kubernetes ingress
- Frontend uses `REACT_APP_BACKEND_URL` env variable
- Cookie-based auth with `credentials: 'include'`

## Known Limitations
- 10 of 13 modules use PlaceholderPage (Households, Business, Blotter, Health, Welfare, Barangay ID, Appointments, Payments, Reports, Settings)
- No resident edit functionality (only add/delete/view)
- PDF templates only support 3 of 8 document types (Clearance, Residency, Indigency)
- No file upload for resident photos yet
