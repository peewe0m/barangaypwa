# Disaster Recovery Plan

Status: Draft for barangay review and approval  
System: Barangay Management System  
Owner: Barangay Darasa  
Last reviewed: 2026-05-28

## Purpose
This plan defines how the barangay restores critical system operations after outage, data loss, cyber incident, or hosting/provider failure.

## Critical Services
1. Staff login and resident lookup
2. Document request processing and issuance
3. Portal request submission and tracking
4. Audit log access for incident review
5. File/PDF retrieval for approved records

## Roles
| Role | Responsibility |
| --- | --- |
| Barangay Captain or authorized officer | Declares incident priority, approves production restore, approves public notices |
| System administrator | Performs technical triage, restore, deployment, and access control actions |
| Data Protection Officer or privacy lead | Assesses privacy impact, coordinates breach documentation and reporting |
| Records officer | Verifies restored records and identifies missing official files |
| Front desk/service staff | Uses manual continuity forms while system is unavailable |

## Incident Priorities
| Priority | Examples | Target response |
| --- | --- | --- |
| P1 Critical | System unavailable, suspected breach, database loss | Start response within 1 hour |
| P2 High | Portal unavailable, PDF/file access broken, permission failure | Same business day |
| P3 Normal | Non-critical feature degraded | Within 2 business days |

## Response Steps
1. Open an incident record with date/time, reporter, symptoms, affected modules, and initial priority.
2. Preserve logs and avoid deleting evidence.
3. Disable compromised accounts or tokens if account misuse is suspected.
4. Decide whether to keep the system online, place it in maintenance, or shut down affected functions.
5. Restore from the latest verified backup if data loss or corruption is confirmed.
6. Validate restored data with staff before reopening service.
7. Document root cause, records affected, downtime, and corrective actions.

## Data Breach Assessment
If personal data may have been accessed, altered, lost, or disclosed without authorization:
- Notify the privacy lead immediately.
- Identify affected systems, record types, dates, and number of data subjects if known.
- Preserve audit logs, access logs, and related files.
- Follow applicable National Privacy Commission breach notification requirements and barangay legal guidance.
- Prepare resident-facing notices if directed by the privacy lead or barangay leadership.

## Manual Continuity
During outage, staff may use paper forms for urgent requests. Once service is restored, encode manual transactions into the system, mark the source as manual continuity, and file the paper forms according to the retention policy.

## Post-Incident Review
Within 5 business days after recovery:
- Confirm final incident timeline.
- Compare actual RTO/RPO against targets.
- Identify missing backups, permission gaps, or monitoring gaps.
- Assign corrective actions with owners and due dates.

## Annual Exercise
Run at least one tabletop disaster recovery exercise per year and one technical restore test per quarter.

