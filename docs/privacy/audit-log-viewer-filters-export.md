# Audit Log Viewer, Filters, and Export (Implementation Notes)

## Overview
The system records security-relevant actions into the `audit_logs` collection. Administrators can view and export these logs for operational oversight and accountability.

## Data Source
- MongoDB collection: `audit_logs`
- Fields commonly used:
  - `id`, `created_at`
  - `action`, `method`, `path`
  - `collection`, `record_id`
  - `user_email`, `user_id`
  - `ip`, `user_agent`
  - `details`

## API Endpoints
### View (JSON)
`GET /api/audit-logs`
- Requires: authenticated user + admin
- Common query params:
  - `limit` (default 100, max 500)
  - `from` / `to` (ISO-8601 date strings)
  - `action`
  - `collection`
  - `user_email`
  - `search` (matches action/method/path/user_email)
  - `sort_by` = `created_at` (default) or `path`
  - `sort_dir` = `asc` or `desc`

Response:
- `{ logs: [...], total: <count> }`

### Export (CSV)
`GET /api/audit-logs/export`
- Requires: authenticated user + admin
- Same filtering params as the JSON view.
- Response: `text/csv` attachment.

## Frontend UX Requirements
- Provide filter controls (date range + action/path/user search)
- Show results in a scrollable table
- Export button downloads the CSV matching current filters

## Privacy Considerations
- Audit logs may contain personal data (e.g., `user_email`) and potentially request context.
- Access is admin-only.
- Export actions are recorded via the audit logging mechanism.

