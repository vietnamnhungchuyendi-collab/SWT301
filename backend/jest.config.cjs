module.exports = {
 testEnvironment: 'node', testMatch: ['<rootDir>/tests/**/*.test.js'],
 collectCoverageFrom: ['controllers/authCore.js'], coverageDirectory: 'tests/coverage',
 coverageReporters: ['text','html','lcov','json-summary'],
 coverageThreshold: {global: {statements:80, branches:80, functions:80, lines:80}},
 clearMocks: true, restoreMocks: true
};
