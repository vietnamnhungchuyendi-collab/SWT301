# Deliberate FAIL → PASS demonstration

This branch demonstrates regression detection; the fault is intentionally injected and is not an undiscovered production defect.

V08 tests OTP verification exactly at its expiry timestamp. The current implementation contract accepts equality (`now > expired_at` rejects only later timestamps). Changing this to `>=` introduces a boundary regression: expected HTTP 200, actual HTTP 400. The unchanged test should fail and GitHub Actions should become red.

The next commit restores the original comparison. V08 and all 48 existing cases should then pass. Main and the submission branch are unchanged. This demonstration does not revise the Report5 baseline or turn the five Pending staging cases into executed tests. Business approval of the equality rule remains outstanding.
