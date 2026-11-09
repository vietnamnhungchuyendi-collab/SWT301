/**
 * =============================================================
 * UNIT TEST – FEATURE 3: CHANGE PASSWORD & DELETE ACCOUNT
 * =============================================================
 * Techniques Applied:
 *   - Black Box: Equivalence Partitioning (EP), Boundary Value Analysis (BVA)
 *   - White Box: Statement Coverage & Decision Coverage → target 100%
 *
 * Function under test: controllers/userController.js → changePassword, deleteAccount
 * Test IDs: CP01–CP09 (changePassword), DA01–DA07 (deleteAccount)
 * =============================================================
 */

jest.mock('../../config/db.js', () => {
  const d = require('./mocks/userDependencies.js');
  return { sql: d.mockSql, poolPromise: Promise.resolve(d.mockPool) };
});
jest.mock('bcryptjs', () => ({
  genSaltSync: jest.fn(() => 'salt'),
  hashSync: jest.fn(() => 'hashed_new'),
  compare: jest.fn().mockResolvedValue(true)
}));

import { changePassword, deleteAccount } from '../../controllers/userController.js';
import { mockQuery, mockQueries, resetDb, response } from './mocks/userDependencies.js';
import bcrypt from 'bcryptjs';

// ── Shared fixtures ───────────────────────────────────────────
const VALID_NEW_PASSWORD = 'NewPass1!';
const WEAK_PASSWORD_7 = 'Short1!';          // BVA: 7 chars (below 8)
const WEAK_NO_UPPER = 'newpass1!';           // EP: no uppercase
const WEAK_NO_SPECIAL = 'NewPass12';         // EP: no special char
const VALID_OLD_PASSWORD = 'OldPass1!';

const dbUser = {
  password_hash: 'hashed_old',
  role_default: 'FREELANCER'
};

beforeEach(() => {
  resetDb();
  bcrypt.compare.mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

// ════════════════════════════════════════════════════════════
// FEATURE 3A – changePassword
// ════════════════════════════════════════════════════════════
describe('Feature 3A – changePassword', () => {

  /**
   * EP Class 1: Missing oldPassword → 400
   * White Box: covers `!oldPassword` branch (early return)
   */
  test('CP01 [EP] missing oldPassword → 400', async () => {
    const req = { user: { id: 7 }, body: { oldPassword: '', newPassword: VALID_NEW_PASSWORD } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('đầy đủ');
    expect(mockQueries).toHaveLength(0);
  });

  /**
   * EP Class 1: Missing newPassword → 400
   * White Box: covers `!newPassword` branch (early return)
   */
  test('CP02 [EP] missing newPassword → 400', async () => {
    const req = { user: { id: 7 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: '' } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('đầy đủ');
    expect(mockQueries).toHaveLength(0);
  });

  /**
   * BVA: newPassword = 7 chars → invalid (boundary: min 8)
   * White Box: covers `!passwordRegex.test(newPassword)` branch
   */
  test('CP03 [BVA] newPassword 7 chars (below min 8) → 400', async () => {
    const req = { user: { id: 7 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: WEAK_PASSWORD_7 } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('8 ký tự');
    expect(mockQueries).toHaveLength(0);
  });

  /**
   * EP Class 2: newPassword no uppercase → 400
   * White Box: covers regex fail branch (`!passwordRegex.test`)
   */
  test('CP04 [EP] newPassword no uppercase → 400', async () => {
    const req = { user: { id: 7 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: WEAK_NO_UPPER } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('8 ký tự');
  });

  /**
   * EP Class 3: newPassword no special char → 400
   */
  test('CP05 [EP] newPassword no special char → 400', async () => {
    const req = { user: { id: 7 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: WEAK_NO_SPECIAL } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('8 ký tự');
  });

  /**
   * EP Class 4: User not found in DB → 404
   * White Box: covers `userResult.recordset.length === 0` branch
   */
  test('CP06 [EP] user not found → 404', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const req = { user: { id: 999 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: VALID_NEW_PASSWORD } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toContain('Không tìm thấy');
    expect(mockQueries).toHaveLength(1);
  });

  /**
   * EP Class 5: Old password wrong → 400
   * White Box: covers `!isMatch` branch
   */
  test('CP07 [EP] old password wrong → 400', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [dbUser] });
    bcrypt.compare.mockResolvedValueOnce(false);
    const req = { user: { id: 7 }, body: { oldPassword: 'WrongPass1!', newPassword: VALID_NEW_PASSWORD } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Mật khẩu cũ không chính xác');
    expect(mockQueries).toHaveLength(1); // No UPDATE happened
  });

  /**
   * EP Class 6 (Happy Path): Valid old + new password → 200
   * White Box: covers full success path
   */
  test('CP08 [EP] valid old+new password → 200 changed', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [dbUser] })   // SELECT user
      .mockResolvedValueOnce({ recordset: [] });          // UPDATE password

    const req = { user: { id: 7 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: VALID_NEW_PASSWORD } };
    const res = response();

    await changePassword(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Đổi mật khẩu thành công!' });
    expect(bcrypt.genSaltSync).toHaveBeenCalledWith(10);
    expect(bcrypt.hashSync).toHaveBeenCalledWith(VALID_NEW_PASSWORD, 'salt');
    expect(mockQueries).toHaveLength(2);
  });

  /**
   * EP Class 7: DB error → 500
   * White Box: covers catch block of changePassword
   */
  test('CP09 [EP] DB error → 500', async () => {
    mockQuery.mockRejectedValueOnce(new Error('timeout'));
    const req = { user: { id: 7 }, body: { oldPassword: VALID_OLD_PASSWORD, newPassword: VALID_NEW_PASSWORD } };
    const res = response();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toContain('Lỗi server');
  });
});

// ════════════════════════════════════════════════════════════
// FEATURE 3B – deleteAccount
// ════════════════════════════════════════════════════════════
describe('Feature 3B – deleteAccount', () => {

  /**
   * EP Class 1: Missing password → 400
   * White Box: covers `!password` branch (early return)
   */
  test('DA01 [EP] missing password → 400', async () => {
    const req = { user: { id: 7 }, body: { password: '' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('nhập mật khẩu');
    expect(mockQueries).toHaveLength(0);
  });

  /**
   * EP Class 2: User not found → 404
   * White Box: covers `userResult.recordset.length === 0` branch
   */
  test('DA02 [EP] user not found → 404', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const req = { user: { id: 999 }, body: { password: 'AnyPass1!' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toContain('Không tìm thấy');
    expect(mockQueries).toHaveLength(1);
  });

  /**
   * EP Class 3: User is ADMIN → cannot delete → 403
   * White Box: covers `user.role_default === 'ADMIN'` branch
   */
  test('DA03 [EP] ADMIN role → 403 forbidden', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ password_hash: 'hashed', role_default: 'ADMIN' }] });
    const req = { user: { id: 1 }, body: { password: 'AnyPass1!' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].message).toContain('Admin');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  /**
   * EP Class 4: Password wrong → 400
   * White Box: covers `!isMatch` branch
   */
  test('DA04 [EP] wrong password → 400', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ password_hash: 'hashed', role_default: 'FREELANCER' }] });
    bcrypt.compare.mockResolvedValueOnce(false);
    const req = { user: { id: 7 }, body: { password: 'WrongPass1!' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Mật khẩu không chính xác');
    expect(mockQueries).toHaveLength(1); // No UPDATE
  });

  /**
   * EP Class 5 (Happy Path): Valid password → soft-delete → 200
   * White Box: covers full success path (UPDATE status = DELETED)
   */
  test('DA05 [EP] valid password FREELANCER → soft deleted 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ password_hash: 'hashed', role_default: 'FREELANCER' }] })
      .mockResolvedValueOnce({ recordset: [] }); // UPDATE status=DELETED

    const req = { user: { id: 7 }, body: { password: 'CorrectPass1!' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Tài khoản đã được xóa thành công.' });
    // Verify soft-delete UPDATE query
    const updateQuery = mockQueries.find(q => q.text.includes('DELETED'));
    expect(updateQuery).toBeDefined();
    expect(mockQueries).toHaveLength(2);
  });

  /**
   * EP Class 5 (Happy Path): EMPLOYER also can delete account
   * White Box: covers EMPLOYER path (not ADMIN → passes role check)
   */
  test('DA06 [EP] valid password EMPLOYER → soft deleted 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ password_hash: 'hashed', role_default: 'EMPLOYER' }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 8 }, body: { password: 'CorrectPass1!' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Tài khoản đã được xóa thành công.' });
  });

  /**
   * EP Class 6: DB error → 500
   * White Box: covers catch block of deleteAccount
   */
  test('DA07 [EP] DB error → 500', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const req = { user: { id: 7 }, body: { password: 'AnyPass1!' } };
    const res = response();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toContain('Lỗi server');
  });
});
