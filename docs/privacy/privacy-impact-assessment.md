# Privacy Impact Assessment (PIA)

Status: Draft for barangay review and approval  
System: Barangay Management System  
Owner: Barangay Darasa  
Last reviewed: 2026-05-28

## Purpose
This PIA identifies personal data processed by the Barangay Management System, likely privacy risks, and controls needed to keep processing transparent, legitimate, and proportionate under Republic Act No. 10173, the Data Privacy Act of 2012.

Reference materials:
- National Privacy Commission, Data Privacy Act of 2012: https://privacy.gov.ph/data-privacy-act/
- National Privacy Commission, Data Subject Rights: https://privacy.gov.ph/data-subject-rights
- National Privacy Commission, NPC Circular 16-01 on government agency security: https://privacy.gov.ph/npc-circular-16-01-security-of-personal-data-in-government-agencies/

## Processing Activities
- Resident registry management
- Household records management
- Barangay document and ID issuance
- Online portal document requests and tracking
- Blotter, health, welfare, appointment, payment, and business records
- User account, permission, and audit log administration

## Personal Data Processed
- Identity: full name, address, birth details, gender, civil status, household details
- Contact: email address, contact number
- Government/service records: document requests, barangay IDs, payments, appointments, incidents, welfare and health-related records
- Uploaded files: photos, supporting PDFs, generated certificates
- System data: account email, role, permissions, audit logs, IP address, user agent, timestamps

## Lawful and Operational Basis
Processing is performed to deliver barangay services, keep official records, verify requests, support public administration, protect residents, and maintain accountability. Sensitive records must be collected only when directly needed for a barangay service or legal/official function.

## Data Subjects
- Residents and requestors
- Business applicants
- Barangay officials and staff users
- Persons named in service, blotter, health, welfare, or household records

## Data Flow Summary
1. Staff enter records through authenticated admin pages, or residents submit requests through the public portal.
2. Backend API validates and stores records in MongoDB.
3. Uploaded photos/documents are stored in configured storage.
4. Generated PDFs are produced for approved services.
5. Audit logs record security-relevant activity.
6. Authorized staff retrieve records based on role and action permissions.

## Key Privacy Risks and Controls
| Risk | Impact | Required controls |
| --- | --- | --- |
| Unauthorized staff access | Exposure or misuse of resident data | Role/action permissions, admin-only account management, staff training |
| Excessive collection | Non-proportionate processing | Collect required fields only, review forms before adding new fields |
| Public access to uploaded files | Unintended disclosure | Use private storage or authenticated file proxy; avoid public URLs for private records |
| Weak passwords or shared accounts | Loss of accountability | Unique accounts, strong passwords, disabled leavers, audit logs |
| Unreviewed exports | Large-scale data leakage | Limit exports to authorized roles, audit export actions |
| Unclear retention | Over-retention of personal data | Apply the data retention policy and document approved disposal |
| Backup exposure | Breach through backup copies | Encrypt backups, restrict access, test restore procedures |

## Required Safeguards
- Authentication required for all admin functions.
- Least-privilege module and action permissions for staff.
- Audit logs for record access, changes, exports, approvals, and security actions where supported.
- HTTPS-only production deployment with secure cookies/headers.
- Private file storage for resident photos, uploaded IDs, generated PDFs, and request attachments.
- Regular backup and restore testing.
- Incident escalation and breach assessment workflow in the disaster recovery plan.

## Residual Risks
- Production operators must confirm private Supabase uploads use `SUPABASE_SERVICE_ROLE_KEY`; otherwise the app deliberately falls back to local private storage.
- Privacy and legal review is still required before this draft is adopted as an official barangay policy.
- Retention periods may need adjustment to match local ordinances, Commission on Audit rules, DILG guidance, or other applicable records laws.

## Review Triggers
Review this PIA when:
- A new module collects additional personal or sensitive personal information.
- Storage, hosting, or database providers change.
- A data breach or major security incident occurs.
- A new export or sharing workflow is added.
- At least once every 12 months.
