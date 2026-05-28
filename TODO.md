# TODO - Portal Request -> Document Request workflow fix

## Goal
Ensure portal requests marked by admin do **not** immediately appear in Documents/download flow. Only when admin performs document approval/link should the document request appear and become downloadable.

## Steps
1. Inspect current portal processing endpoint `PUT /portal-requests/:reqId/process` and confirm it creates `document_requests` immediately.
2. Update backend:
   - Change `/portal-requests/:reqId/process` to only set portal status to `waiting_for_admin_approval` (no document_requests creation yet).
   - Add new endpoint to link/create the `document_requests` record when admin approves/linking.
3. Update backend document listing `GET /document-requests` to exclude any non-ready statuses if added.
4. Update frontend:
   - Update `PortalRequestsPage` to call new backend endpoint for approval/linking, not the old process endpoint.
5. Verify portal download endpoints:
   - Ensure portal download still requires document_request_id to exist and document status to be approved.
6. Verify reports:
   - Payments/reports should still populate only after download.
7. Run backend/frontend locally if available and sanity test flows.
8. Update UI/logic text if needed (portal status labels).


