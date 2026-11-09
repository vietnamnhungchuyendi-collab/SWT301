/**
 * =============================================================
 * UNIT TEST – FEATURE 2: USER PROFILE (getProfile / updateProfile)
 * =============================================================
 * Techniques Applied:
 *   - Black Box: Equivalence Partitioning (EP), Boundary Value Analysis (BVA)
 *   - White Box: Statement Coverage & Decision Coverage → target 100%
 *
 * Function under test: controllers/userController.js → getProfile, updateProfile
 * Test IDs: GP01–GP06 (getProfile), UP01–UP12 (updateProfile)
 * =============================================================
 */

jest.mock('../../config/db.js', () => {
  const d = require('./mocks/userDependencies.js');
  return { sql: d.mockSql, poolPromise: Promise.resolve(d.mockPool) };
});
jest.mock('bcryptjs', () => ({
  genSaltSync: jest.fn(() => 'salt'),
  hashSync: jest.fn(() => 'hashed_new'),
  compareSync: jest.fn(() => true),
  compare: jest.fn().mockResolvedValue(true)
}));

import { getProfile, updateProfile } from '../../controllers/userController.js';
import { mockQuery, mockQueries, resetDb, response, mockPool } from './mocks/userDependencies.js';

// ── Shared fixtures ───────────────────────────────────────────
const baseUser = {
  user_id: 10, full_name: 'Nguyen Van A', email: 'a@test.com',
  phone: '0912345678', role_default: 'FREELANCER', avatar_url: null,
  bio: null, company_name: null, website_url: null, address: null,
  created_at: new Date(), is_email_verified: true
};
const baseFreelancer = {
  headline: 'JS Dev', experience_years: 3,
  hourly_rate: 25, availability_status: 'AVAILABLE', portfolio_summary: 'my work'
};

beforeEach(() => {
  resetDb();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

// ════════════════════════════════════════════════════════════
// FEATURE 2A – getProfile
// ════════════════════════════════════════════════════════════
describe('Feature 2 – getProfile', () => {

  /**
   * EP Class 1: User not found in DB → 404
   * White Box: covers branch `userResult.recordset.length === 0`
   */
  test('GP01 [EP] user not found → 404', async () => {
    // DB returns empty for user query
    mockQuery.mockResolvedValueOnce({ recordset: [] });
    const req = { user: { id: 999 } };
    const res = response();

    await getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toContain('Không tìm thấy');
    // Only 1 query executed (early return)
    expect(mockQueries).toHaveLength(1);
  });

  /**
   * EP Class 2: FREELANCER user with full profile data → 200 with bio_extras
   * White Box: covers main success path with freelancer profile branch
   */
  test('GP02 [EP] freelancer user found → 200 with bio_extras', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [baseUser] })          // users
      .mockResolvedValueOnce({ recordset: [baseFreelancer] })    // freelancer_profiles
      .mockResolvedValueOnce({ recordset: [{ skill_name: 'JavaScript' }, { skill_name: 'React' }] }); // skills

    const req = { user: { id: 10 } };
    const res = response();

    await getProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }));
    const returnedUser = res.json.mock.calls[0][0].user;
    const bioExtras = JSON.parse(returnedUser.bio_extras);

    expect(bioExtras.skills).toEqual(['JavaScript', 'React']);
    expect(bioExtras.availability).toBe('AVAILABLE');
  });

  /**
   * EP Class 3: EMPLOYER user (no freelancer profile) → returns empty fl object
   * White Box: covers `flResult.recordset[0] || {}` branch (undefined path)
   */
  test('GP03 [EP] employer user (no freelancer profile) → 200 with empty extras', async () => {
    const employer = { ...baseUser, role_default: 'EMPLOYER' };
    mockQuery
      .mockResolvedValueOnce({ recordset: [employer] })   // users
      .mockResolvedValueOnce({ recordset: [] })            // freelancer_profiles → empty
      .mockResolvedValueOnce({ recordset: [] });           // skills → empty

    const req = { user: { id: 10 } };
    const res = response();

    await getProfile(req, res);

    expect(res.json).toHaveBeenCalled();
    const bioExtras = JSON.parse(res.json.mock.calls[0][0].user.bio_extras);
    expect(bioExtras.skills).toEqual([]);
    expect(bioExtras.title).toBe('');
  });

  /**
   * BVA: experience_years = 1 → ENTRY (boundary at 1)
   * White Box: covers `experience_years <= 1` branch
   */
  test('GP04 [BVA] experience_years=1 → ENTRY level', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [{ ...baseFreelancer, experience_years: 1 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 } };
    const res = response();
    await getProfile(req, res);

    const bioExtras = JSON.parse(res.json.mock.calls[0][0].user.bio_extras);
    expect(bioExtras.experience).toBe('ENTRY');
  });

  /**
   * BVA: experience_years = 2 → INTERMEDIATE (between 1 and 3)
   * White Box: covers `experience_years <= 3` branch
   */
  test('GP05 [BVA] experience_years=2 → INTERMEDIATE level', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [{ ...baseFreelancer, experience_years: 2 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 } };
    const res = response();
    await getProfile(req, res);

    const bioExtras = JSON.parse(res.json.mock.calls[0][0].user.bio_extras);
    expect(bioExtras.experience).toBe('INTERMEDIATE');
  });

  /**
   * BVA: experience_years = 4 → EXPERT (above 3)
   * White Box: covers else branch of experience mapping
   */
  test('GP06 [BVA] experience_years=4 → EXPERT level', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [{ ...baseFreelancer, experience_years: 4 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 } };
    const res = response();
    await getProfile(req, res);

    const bioExtras = JSON.parse(res.json.mock.calls[0][0].user.bio_extras);
    expect(bioExtras.experience).toBe('EXPERT');
  });

  /**
   * EP Class: DB failure → 500
   * White Box: covers catch block in getProfile
   */
  test('GP07 [EP] DB error → 500', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection lost'));
    const req = { user: { id: 10 } };
    const res = response();

    await getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toContain('Lỗi server');
  });
});

// ════════════════════════════════════════════════════════════
// FEATURE 2B – updateProfile
// ════════════════════════════════════════════════════════════
describe('Feature 2 – updateProfile', () => {

  const bioExtrasJSON = JSON.stringify({
    title: 'Senior Dev', hourlyRate: '50', availability: 'AVAILABLE',
    experience: 'EXPERT', skills: ['NodeJS'], portfolio: 'my-port',
    companyDesc: 'desc', location: 'HCM', website: 'my.com', companyName: 'Co'
  });

  /**
   * EP Class 1: Missing fullName → 400
   * White Box: covers `!fullName` branch (early return)
   */
  test('UP01 [EP] missing fullName → 400', async () => {
    const req = { user: { id: 10 }, body: { fullName: '', phone: '' } };
    const res = response();

    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Tên không được để trống');
    expect(mockQueries).toHaveLength(0);
  });

  /**
   * EP Class 2: Valid update WITHOUT bioExtras → only users table updated
   * White Box: covers `if (bioExtras)` = false branch
   */
  test('UP02 [EP] valid update no bioExtras → updates users only', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })          // UPDATE users
      .mockResolvedValueOnce({ recordset: [{ ...baseUser, full_name: 'New Name' }] })  // SELECT updated user
      .mockResolvedValueOnce({ recordset: [] })           // freelancer_profiles
      .mockResolvedValueOnce({ recordset: [] });          // skills

    const req = { user: { id: 10 }, body: { fullName: 'New Name', phone: '0912345678' } };
    const res = response();

    await updateProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('thành công') }));
  });

  /**
   * EP Class 3: Valid update WITH bioExtras (EXPERT) → updates users + freelancer_profiles + skills
   * White Box: covers full happy path with all 3 inner blocks
   */
  test('UP03 [EP] valid update with bioExtras EXPERT → all tables updated', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })                    // UPDATE users
      .mockResolvedValueOnce({ recordset: [] })                    // UPSERT freelancer_profiles
      .mockResolvedValueOnce({ recordset: [] })                    // DELETE skills
      .mockResolvedValueOnce({ recordset: [{ skill_id: 1 }] })    // SELECT skill (exists)
      .mockResolvedValueOnce({ recordset: [] })                    // INSERT freelancer_skills
      .mockResolvedValueOnce({ recordset: [baseUser] })            // SELECT updated user
      .mockResolvedValueOnce({ recordset: [baseFreelancer] })      // SELECT updated fl
      .mockResolvedValueOnce({ recordset: [{ skill_name: 'NodeJS' }] }); // SELECT updated skills

    const req = { user: { id: 10 }, body: { fullName: 'Nguyen Van A', bioExtras: bioExtrasJSON } };
    const res = response();

    await updateProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('thành công') }));
  });

  /**
   * BVA: experience = 'ENTRY' → experienceYears = 1
   * White Box: covers `ex.experience === 'ENTRY'` branch
   */
  test('UP04 [BVA] experience=ENTRY → experienceYears=1', async () => {
    const bioEntry = JSON.stringify({ ...JSON.parse(bioExtrasJSON), experience: 'ENTRY', skills: [] });
    mockQuery.mockResolvedValue({ recordset: [] });
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })          // UPDATE users
      .mockResolvedValueOnce({ recordset: [] })          // UPSERT fl
      .mockResolvedValueOnce({ recordset: [] })          // DELETE skills (empty array → skip loop)
      .mockResolvedValueOnce({ recordset: [baseUser] })  // SELECT updated user
      .mockResolvedValueOnce({ recordset: [] })          // SELECT updated fl
      .mockResolvedValueOnce({ recordset: [] });         // SELECT updated skills

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioEntry } };
    const res = response();

    await updateProfile(req, res);

    // Find UPSERT query and verify experienceYears input = 1
    const upsertQuery = mockQueries.find(q => q.text && q.text.includes('freelancer_profiles'));
    expect(upsertQuery.inputs.experienceYears).toBe(1);
  });

  /**
   * BVA: experience = 'INTERMEDIATE' → experienceYears = 2 (default)
   * White Box: covers else branch of experience mapping
   */
  test('UP05 [BVA] experience=INTERMEDIATE → experienceYears=2', async () => {
    const bioMid = JSON.stringify({ ...JSON.parse(bioExtrasJSON), experience: 'INTERMEDIATE', skills: [] });
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioMid } };
    const res = response();
    await updateProfile(req, res);

    const upsertQuery = mockQueries.find(q => q.text && q.text.includes('freelancer_profiles'));
    expect(upsertQuery.inputs.experienceYears).toBe(2);
  });

  /**
   * EP Class: bioExtras with invalid JSON → catch inner error, still completes
   * White Box: covers inner `catch (err)` in bioExtras parse block
   */
  test('UP06 [EP] invalid JSON in bioExtras → graceful fallback, 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })          // UPDATE users
      .mockResolvedValueOnce({ recordset: [baseUser] })  // SELECT updated user
      .mockResolvedValueOnce({ recordset: [] })          // SELECT updated fl
      .mockResolvedValueOnce({ recordset: [] });         // SELECT updated skills

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: '{INVALID_JSON' } };
    const res = response();

    await updateProfile(req, res);

    // Should still respond (inner catch doesn't re-throw)
    expect(res.json).toHaveBeenCalled();
  });

  /**
   * EP Class: skills array with NEW skill (not in DB) → inserts new skill
   * White Box: covers `skillIdResult.recordset.length === 0` branch
   */
  test('UP07 [EP] new skill not in DB → insert skill then link', async () => {
    const bioWithNewSkill = JSON.stringify({ ...JSON.parse(bioExtrasJSON), skills: ['NewSkill'] });
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })                              // UPDATE users
      .mockResolvedValueOnce({ recordset: [] })                              // UPSERT fl
      .mockResolvedValueOnce({ recordset: [] })                              // DELETE old skills
      .mockResolvedValueOnce({ recordset: [] })                              // SELECT skill → NOT FOUND
      .mockResolvedValueOnce({ recordset: [{ skill_id: 99 }] })             // INSERT new skill → returns id
      .mockResolvedValueOnce({ recordset: [] })                              // INSERT freelancer_skills
      .mockResolvedValueOnce({ recordset: [baseUser] })                      // SELECT updated user
      .mockResolvedValueOnce({ recordset: [baseFreelancer] })                // SELECT updated fl
      .mockResolvedValueOnce({ recordset: [{ skill_name: 'NewSkill' }] });   // SELECT updated skills

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioWithNewSkill } };
    const res = response();

    await updateProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('thành công') }));
    // Verify skill INSERT query was called
    const insertSkillQuery = mockQueries.find(q => q.text && q.text.includes('INSERT INTO skills'));
    expect(insertSkillQuery).toBeDefined();
  });

  /**
   * EP Class: DB error in UPDATE users → 500
   * White Box: covers outer catch block of updateProfile
   */
  test('UP08 [EP] DB error → 500', async () => {
    mockQuery.mockRejectedValueOnce(new Error('timeout'));
    const req = { user: { id: 10 }, body: { fullName: 'A' } };
    const res = response();

    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toContain('Lỗi server');
  });
});

// ════════════════════════════════════════════════════════════
// SUPPLEMENTARY TESTS – Cover remaining branches in userController.js
// Lines: 86-89 (bioExtras field OR-defaults), 124-127 (hourlyRate/title),
//        161 (skills not array), 229 (experience mapping after update)
// ════════════════════════════════════════════════════════════
describe('Feature 2 – updateProfile (supplementary branch coverage)', () => {

  beforeEach(() => {
    resetDb();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); });

  /**
   * UP09 [BVA] bioExtras with companyDesc set → finalBio = companyDesc (line 89-90)
   * White Box: covers `if (ex.companyDesc)` truthy branch
   */
  test('UP09 [BVA] bioExtras companyDesc truthy → finalBio assigned', async () => {
    const bioWithDesc = JSON.stringify({
      companyName: 'FJMS Corp', website: 'fjms.com',
      location: 'Hanoi', companyDesc: 'We build great software', skills: []
    });
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })          // UPDATE users
      .mockResolvedValueOnce({ recordset: [] })          // UPSERT fl (no title/etc)
      .mockResolvedValueOnce({ recordset: [] })          // DELETE skills
      .mockResolvedValueOnce({ recordset: [{ ...baseUser, bio: 'We build great software', company_name: 'FJMS Corp' }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioWithDesc } };
    const res = response();
    await updateProfile(req, res);

    expect(res.json).toHaveBeenCalled();
    // Verify bio was set via UPDATE query input
    const updateQuery = mockQueries.find(q => q.text && q.text.includes('UPDATE users'));
    expect(updateQuery.inputs.bio).toBe('We build great software');
    expect(updateQuery.inputs.companyName).toBe('FJMS Corp');
    expect(updateQuery.inputs.websiteUrl).toBe('fjms.com');
    expect(updateQuery.inputs.address).toBe('Hanoi');
  });

  /**
   * UP10 [EP] bioExtras with no title / no hourlyRate → null/0 defaults (lines 124-125)
   * White Box: covers `ex.title || null` falsy, `ex.hourlyRate ? : 0` falsy
   */
  test('UP10 [EP] bioExtras missing title + hourlyRate → defaults null/0', async () => {
    const bioNoTitle = JSON.stringify({ skills: ['React'] });
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })                      // UPDATE users
      .mockResolvedValueOnce({ recordset: [] })                      // UPSERT fl
      .mockResolvedValueOnce({ recordset: [] })                      // DELETE skills
      .mockResolvedValueOnce({ recordset: [{ skill_id: 5 }] })      // SELECT skill (exists)
      .mockResolvedValueOnce({ recordset: [] })                      // INSERT fl_skills
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioNoTitle } };
    const res = response();
    await updateProfile(req, res);

    const flQuery = mockQueries.find(q => q.text && q.text.includes('freelancer_profiles'));
    expect(flQuery.inputs.headline).toBeNull();
    expect(flQuery.inputs.hourlyRate).toBe(0);
  });

  /**
   * UP11 [EP] bioExtras skills is NOT an array → skip skills update block (line 161)
   * White Box: covers `Array.isArray(ex.skills)` = false branch
   */
  test('UP11 [EP] bioExtras skills not array → skips DELETE/INSERT skills', async () => {
    const bioNoSkillsArr = JSON.stringify({ title: 'Dev', skills: 'NodeJS' }); // string, not array
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })          // UPDATE users
      .mockResolvedValueOnce({ recordset: [] })          // UPSERT fl
      // No DELETE or INSERT skills queries since skills is not array
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioNoSkillsArr } };
    const res = response();
    await updateProfile(req, res);

    const deleteSkillQuery = mockQueries.find(q => q.text && q.text.includes('DELETE FROM freelancer_skills'));
    expect(deleteSkillQuery).toBeUndefined(); // Should NOT have been called
    expect(res.json).toHaveBeenCalled();
  });

  /**
   * UP12 [BVA] updated freelancer experience_years=undefined → 'INTERMEDIATE' default (line 229)
   * White Box: covers ternary `experience_years !== undefined ? ... : 'INTERMEDIATE'` falsy path
   */
  test('UP12 [BVA] updatedFl.experience_years=undefined → experience=INTERMEDIATE default', async () => {
    const bioSimple = JSON.stringify({ skills: [] });
    mockQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [baseUser] })
      .mockResolvedValueOnce({ recordset: [{ headline: null, experience_years: undefined, hourly_rate: undefined, availability_status: null, portfolio_summary: null }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = { user: { id: 10 }, body: { fullName: 'A', bioExtras: bioSimple } };
    const res = response();
    await updateProfile(req, res);

    const returnedUser = res.json.mock.calls[0][0].user;
    const bioExtras = JSON.parse(returnedUser.bio_extras);
    expect(bioExtras.experience).toBe('INTERMEDIATE');
    expect(bioExtras.hourlyRate).toBe('');
    expect(bioExtras.availability).toBe('AVAILABLE');
  });
});

