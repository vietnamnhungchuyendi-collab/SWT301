# Selected authentication tests

45 unit cases: register R01-R15, resetPassword P01-P15, login L01-L15. Three isolated HTTP integration cases cover registration, forgotten-password reset, new-password login and used-token replay rejection. verifyEmail and forgotPassword are integration setup, not additional selected unit functions.

Run npm ci then npm run test:ci. Unit dependencies are mocked; integration uses real bcrypt/JWT and fake SQL/email. Coverage measures authSelectedCore.js and passwordRecovery.js with an 80 percent gate. Live SQL transactions, concurrency and SMTP require staging tests.
