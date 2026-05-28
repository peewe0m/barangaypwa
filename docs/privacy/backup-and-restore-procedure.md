# Backup and Restore Procedure

Status: Draft for barangay review and approval  
System: Barangay Management System  
Owner: Barangay Darasa  
Last reviewed: 2026-05-28

## Purpose
This procedure ensures barangay records can be recovered after accidental deletion, system failure, hosting failure, or security incident.

## Backup Scope
- MongoDB database named by `DB_NAME`
- Uploaded resident photos and supporting documents
- Generated PDFs and portal request attachments
- Environment configuration inventory, excluding plaintext secrets in shared documents
- Deployment notes and application version/commit used in production

## Schedule
| Backup type | Frequency | Retention |
| --- | --- | --- |
| Database snapshot/export | Daily | 30 days |
| File storage backup | Daily or provider snapshot | 30 days |
| Monthly archive | Monthly | 12 months if approved |
| Pre-release backup | Before production deployment | Until deployment is accepted |

## Backup Requirements
- Store backups outside the production server account when possible.
- Encrypt backups at rest.
- Restrict backup access to the system administrator and authorized barangay officer.
- Never commit `.env`, database dumps, or storage archives to Git.
- Record backup completion, location, date, and responsible staff member.

## Restore Test Procedure
Perform a restore test at least quarterly.

1. Create or use an isolated test environment.
2. Restore the latest database backup into the test database.
3. Restore a sample of uploaded files and generated PDFs.
4. Start the backend and frontend against the test environment.
5. Verify login, resident lookup, document request lookup, PDF access, and audit log visibility.
6. Confirm no test restore is publicly accessible.
7. Delete the test restore when verification is complete.
8. Record the test date, backup date restored, result, issues found, and corrective actions.

## Recovery Targets
- Recovery Time Objective (RTO): 8 business hours
- Recovery Point Objective (RPO): 24 hours

## Restore Authorization
Production restore requires approval from the Barangay Captain or authorized officer, except during an emergency where the system administrator may restore to protect service availability and must report afterward.

## Test Log Template
| Date | Backup restored | Tested by | Result | Issues | Follow-up |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | YYYY-MM-DD daily backup | Name | Pass/Fail | Notes | Ticket/action |

