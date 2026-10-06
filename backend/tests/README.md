# FJMS Authentication tests

Feature: Authentication; functions register, verifyEmail, login from the group's FJMS code. Framework: Jest29.7, Babel for ES modules, Supertest for Express component integration. At least80% coverage required; current scoped coverage100%.

```bash
cd backend
npm ci
npm test
npm run test:ci
```

No SQL Server/Gmail credentials needed for this suite. Production config is mocked before controller import. Unit mocks bcrypt/JWT/email/SQL; integration uses real HTTP/Express/controllers/bcrypt/JWT and a stateful SQL adapter fake. It is not a live database test.

```text
tests/
  unit/auth.test.js
  unit/mocks/dependencies.js
  integration/auth-flow.test.js
  coverage/index.html
  results.json
  README.md
```

Setup: beforeEach resets mock SQL, fixture state and spies; unit freezes clock/RNG, afterEach restores mocks/timers. Integration keeps real timers; each test owns a fresh Express app/state. 48 cases,192 assertions,4/test; see ../../docs/Test-plan.md, Metrics.md, AI-prompts.md and Report5_UnitTest.xlsx. test:ci fails on test failure or coverage below80%. JSON and HTML are regenerated, CI uploads them as artifacts. Coverage includes only controllers/authCore.js; three handlers and one role-mapping callback, not the rest of the backend.

Reference: [Jest setup](https://jestjs.io/docs/29.7/getting-started), [JUnit examples](https://github.com/junit-team/junit-examples), [GitHub Maven CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/java-with-maven). JUnit is used for MathUtil/Sales; Jest is used for FJMS because this backend is Node.js.
