import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * Automated "permissionAction" checks.
 *
 * These tests are intentionally lightweight (static analysis) so they work in
 * environments where ripgrep isn't available.
 */

describe('permissionAction: security static checks', () => {
  const serverPath = path.resolve(process.cwd(), 'src/server.js');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  test('server defines module/action permission guards (requireModule/requireAction)', () => {
    assert.match(serverCode, /const requireAction\s*=/);
    assert.match(serverCode, /const requireModule\s*=/);
    assert.match(serverCode, /requireAction\(/);
  });

  test('approve/reject/download mutation routes enforce requireAction', () => {
    // Approve/reject
    assert.match(serverCode, /\/document-requests\/:requestId\/approve[\s\S]*requireAction\("documents", "approve"\)/);
    assert.match(serverCode, /\/document-requests\/:requestId\/reject[\s\S]*requireAction\("documents", "approve"\)/);

    // Download
    assert.match(serverCode, /\/document-requests\/:requestId\/download[\s\S]*requireAction\("documents", "download"\)/);
    assert.match(serverCode, /\/barangay-ids\/:id\/download[\s\S]*requireAction\("barangay_id", "download"\)/);
  });

  test('public portal downloads require an approved linked document request', () => {
    assert.match(serverCode, /\/portal\/track\/:trackingNumber\/download/);
    assert.match(serverCode, /if \(!portalReq\.document_request_id\) return bad\(res, 400, "Document not yet linked for processing"\)/);
    assert.match(serverCode, /if \(docReq\.status !== "approved"\) return bad\(res, 400, "Document not yet approved"\)/);
  });

  test('admin-only audit log endpoint requires admin', () => {
    assert.match(serverCode, /api\.get\("\/audit-logs",\s*requireUser,\s*requireAdmin/);
  });

  test('dangerous confirmation calls are not present in backend', () => {
    // Just a sanity check against common unsafe patterns.
    assert.doesNotMatch(serverCode, /window\.confirm\(/);
    assert.doesNotMatch(serverCode, /eval\(/);
    assert.doesNotMatch(serverCode, /innerHTML\s*=/);
  });
});

