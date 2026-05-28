# Manual Test Checklist

Use this checklist before a barangay production launch and after major releases.

## Accounts and Permissions
- [ ] Log in as super admin.
- [ ] Create a staff account with limited module permissions.
- [ ] Confirm the staff account cannot open disabled modules.
- [ ] Confirm non-admin staff cannot delete records.
- [ ] Confirm admin accounts can perform approved delete actions.

## Public Portal
- [ ] Submit a document request from `/portal`.
- [ ] Confirm the privacy notice checkbox is required.
- [ ] For Barangay Clearance, confirm camera photo capture is required.
- [ ] Track the request using the generated tracking number.
- [ ] Confirm unapproved portal documents cannot be downloaded.

## Approvals and Downloads
- [ ] Process a portal request into a document request.
- [ ] Approve a document request.
- [ ] Download the approved document as staff.
- [ ] Download the approved document through portal tracking.
- [ ] Generate and download a Barangay ID.
- [ ] Confirm generated PDFs include the expected resident details and photo where applicable.

## Private Files
- [ ] Upload a resident photo.
- [ ] Confirm the photo displays for an authenticated staff user.
- [ ] Confirm direct `/uploads/...` public URLs are not served.
- [ ] Confirm portal request photos open through `/api/private-files/...` only for authenticated staff.
- [ ] Confirm Supabase uploads succeed when `SUPABASE_SERVICE_ROLE_KEY` is set.

## Audit and Export
- [ ] Open audit logs as admin.
- [ ] Filter audit logs by date, action, and user.
- [ ] Export audit logs to CSV.
- [ ] Confirm export actions appear in audit logs where applicable.
- [ ] Confirm a non-admin user cannot access audit logs.

## Backup and Recovery
- [ ] Confirm a fresh database backup exists.
- [ ] Confirm file storage backup exists.
- [ ] Restore the latest backup into a test environment.
- [ ] Verify login, resident lookup, document lookup, and file retrieval in the restored test environment.

