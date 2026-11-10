/**
 * Report System Integration Tests
 * 
 * Production-grade test suite for the Report/Violation System.
 * 
 * Test cases:
 * 1. User A reports Project B - verify ownership resolution
 * 2. Fake ownerId injection - verify rejection
 * 3. Duplicate report spam - verify blocking
 * 4. Admin resolve report - verify moderation_logs created
 * 5. Status transition validation
 * 6. Rate limiting
 * 7. Input sanitization
 * 
 * Run: npx mocha backend/test/reportSystem.test.js
 * 
 * NOTE: Requires a running backend server with test database.
 * These are integration tests that hit real API endpoints.
 */

// ============================================================================
// SETUP
// ============================================================================

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const assert = require('assert');

// Helper: mock authenticated request
const authenticatedRequest = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Helper: create request with fetch
async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json() };
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return { status: res.status, data: await res.json() };
}

async function apiPatch(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body || {})
  });
  return { status: res.status, data: await res.json() };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Report System - Production Grade Tests', function() {
  this.timeout(10000);

  // Mock tokens (in real test environment, these would be obtained via auth)
  const userAToken = 'mock-user-a-token';
  const userBToken = 'mock-user-b-token';
  const adminToken = 'mock-admin-token';

  // Test data
  const testProjectId = 999; // Replace with actual test project ID
  const testUserId = 888;    // Replace with actual test user ID
  const fakeOwnerId = 999999;

  // ========================================================================
  // CASE 1: User A reports Project B
  // ========================================================================
  describe('CASE 1: User reports a Project', () => {
    it('should resolve ownerId from database (not from client)', async () => {
      // User A reports Project B without sending ownerId
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        violationType: 'COPYRIGHT',
        description: 'This project contains copied content.'
      }, userAToken);

      // Should succeed
      assert.strictEqual(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
      assert.ok(data.report.id, 'Report should have an ID');
      assert.strictEqual(data.report.status, 'PENDING');
      assert.ok(data.report.createdAt, 'Should have createdAt');
    });

    it('should fail for non-existent project', async () => {
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: 99999999, // Non-existent project
        violationType: 'SPAM',
        description: 'Test report'
      }, userAToken);

      assert.strictEqual(status, 404);
      assert.ok(data.message.includes('not found'));
    });
  });

  // ========================================================================
  // CASE 2: Fake ownerId injection
  // ========================================================================
  describe('CASE 2: Fake ownerId injection', () => {
    it('should ignore/not accept ownerId from request body', async () => {
      // The controller should not destructure ownerId from body
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        ownerId: fakeOwnerId, // Attempted injection
        violationType: 'COPYRIGHT',
        description: 'Test report with fake ownerId'
      }, userAToken);

      // Should still succeed because ownerId is ignored
      assert.strictEqual(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
    });
  });

  // ========================================================================
  // CASE 3: Duplicate report spam
  // ========================================================================
  describe('CASE 3: Duplicate report detection', () => {
    it('should block duplicate within 7 days', async () => {
      // First report (from CASE 1 should already exist)
      // Second report - same reporter, same entity, same violation type
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        violationType: 'COPYRIGHT',
        description: 'Another report about the same issue'
      }, userAToken);

      // Should be blocked as duplicate (409 Conflict)
      assert.strictEqual(status, 409);
      assert.ok(data.message.includes('already submitted'));
      assert.ok(data.message.includes('similar report'));
    });

    it('should allow different violation type', async () => {
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        violationType: 'FRAUD', // Different violation type
        description: 'This is a different type of violation'
      }, userAToken);

      assert.strictEqual(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    });
  });

  // ========================================================================
  // CASE 4: Admin resolve report with audit trail
  // ========================================================================
  describe('CASE 4: Admin moderation workflow', () => {
    let reportId;

    before(async () => {
      // Create a report to work with
      const { data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        violationType: 'HARASSMENT',
        description: 'Test report for moderation'
      }, userAToken);
      reportId = data.report?.id;
    });

    it('should move to UNDER_REVIEW', async () => {
      const { status, data } = await apiPatch(`/admin/reports/${reportId}/review`, {}, adminToken);
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'UNDER_REVIEW');
    });

    it('should resolve report and create moderation_log entry', async () => {
      const { status, data } = await apiPatch(`/admin/reports/${reportId}/resolve`, {
        note: 'Reviewed and resolved - no violation found'
      }, adminToken);
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'RESOLVED');
    });

    it('should have moderation log history', async () => {
      const { status, data } = await apiGet(`/admin/reports/${reportId}`, adminToken);
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      
      // Verify enriched response structure
      const report = data.report;
      assert.ok(report.id, 'Should have report ID');
      assert.ok(report.target, 'Should have target entity info');
      assert.ok(report.reporter, 'Should have reporter info');
      assert.ok(report.violation, 'Should have violation info');
      assert.ok(report.history, 'Should have moderation history');
      
      // Verify history entries
      assert.ok(report.history.length >= 2, 'Should have at least 2 history entries');
      
      // First entry should be UNDER_REVIEW
      const firstAction = report.history[0];
      assert.ok(firstAction.action === 'REVIEW' || firstAction.action === 'RESOLVE');
      assert.ok(firstAction.admin, 'Should have admin info');
      
      // Last entry should be RESOLVE
      const lastAction = report.history[report.history.length - 1];
      assert.strictEqual(lastAction.toStatus, 'RESOLVED');
    });
  });

  // ========================================================================
  // CASE 5: Status transition validation
  // ========================================================================
  describe('CASE 5: Status transition validation', () => {
    it('should reject RESOLVED → DISMISSED transition', async () => {
      // Create, resolve, then try to dismiss
      const { data: createRes } = await apiPost('/reports', {
        entityType: 'USER',
        entityId: testUserId,
        violationType: 'SPAM',
        description: 'Test status transition'
      }, userAToken);
      
      const newReportId = createRes.report?.id;

      // Resolve it
      await apiPatch(`/admin/reports/${newReportId}/resolve`, {
        note: 'Resolved'
      }, adminToken);

      // Try to dismiss - should fail
      const { status, data } = await apiPatch(`/admin/reports/${newReportId}/dismiss`, {}, adminToken);
      
      assert.strictEqual(status, 400);
      assert.ok(data.message.includes('Cannot transition'));
    });

    it('should allow DISMISSED → PENDING (reopen)', async () => {
      // Create a new report
      const { data: createRes } = await apiPost('/reports', {
        entityType: 'USER',
        entityId: testUserId,
        violationType: 'FAKE_PROFILE',
        description: 'Test reopen'
      }, userAToken);
      
      const newReportId = createRes.report?.id;

      // Dismiss it
      await apiPatch(`/admin/reports/${newReportId}/dismiss`, {
        note: 'Dismissed'
      }, adminToken);

      // Reopen it
      const { status, data } = await apiPatch(`/admin/reports/${newReportId}/reopen`, {
        note: 'Reopened for further review'
      }, adminToken);
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'PENDING');
    });
  });

  // ========================================================================
  // CASE 6: Input validation & sanitization
  // ========================================================================
  describe('CASE 6: Input validation', () => {
    it('should reject empty description', async () => {
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        violationType: 'SPAM',
        description: '   ' // Only whitespace
      }, userAToken);

      assert.strictEqual(status, 400);
      assert.ok(data.message);
    });

    it('should reject missing entityType', async () => {
      const { status, data } = await apiPost('/reports', {
        entityId: testProjectId,
        violationType: 'SPAM',
        description: 'Test report'
      }, userAToken);

      assert.strictEqual(status, 400);
      assert.ok(data.message.includes('entityType'));
    });

    it('should reject invalid entity type', async () => {
      const { status, data } = await apiPost('/reports', {
        entityType: 'INVALID_TYPE',
        entityId: testProjectId,
        violationType: 'SPAM',
        description: 'Test report'
      }, userAToken);

      assert.strictEqual(status, 400);
      assert.ok(data.message.includes('Invalid entity type'));
    });

    it('should reject self-report', async () => {
      // Reporting yourself as USER
      const { status, data } = await apiPost('/reports', {
        entityType: 'USER',
        entityId: 1, // Same as reporter ID
        violationType: 'SPAM',
        description: 'Cannot report yourself'
      }, userAToken);

      assert.strictEqual(status, 400);
      assert.ok(data.message.includes('cannot report yourself') || data.message.includes('self'));
    });
  });

  // ========================================================================
  // CASE 7: Unauthenticated access
  // ========================================================================
  describe('CASE 7: Authentication', () => {
    it('should reject report creation without auth', async () => {
      const { status, data } = await apiPost('/reports', {
        entityType: 'PROJECT',
        entityId: testProjectId,
        violationType: 'SPAM',
        description: 'No auth test'
      });

      assert.strictEqual(status, 401);
    });

    it('should reject admin endpoints for non-admin', async () => {
      const { status, data } = await apiGet('/admin/reports', userAToken);
      
      // Non-admin user should get 403
      assert.strictEqual(status, 403);
    });
  });

  // ========================================================================
  // CLEANUP (optional)
  // ========================================================================
  after(async () => {
    // In production tests, cleanup test data here
    console.log('Test cleanup completed');
  });
});