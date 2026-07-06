# Known issues (tracked, not yet fixed)

Running log of confirmed issues that are deliberately deferred to a later, correct
fix — recorded here so they are not lost. Each entry says WHERE it must be fixed.

## must-fix-before-launch

### set-password route leaks the raw token + sets dead cookies
- **Where:** `src/app/api/auth/set-password/route.ts` (~:78–96)
- **What:** the route returns the raw Saleor **token in the JSON response**, and sets
  HttpOnly `token`/`refreshToken` cookies that **nobody reads** (the session lives in the
  auth-sdk cookies). Net effect: after a password reset the user is not actually logged in
  though the UI implies success, and a sensitive token is exposed in a response body.
- **Severity:** must-fix-before-launch (security + broken auth UX).
- **Do NOT fix in the SEO/hygiene branch.** The correct fix belongs to the **BFF auth
  foundation (Track B, Spec B §4 step 2)** — the route becomes the first internal consumer
  of the `/api/auth/login` BFF contract; the dead cookies and the token-in-body both go away
  when auth moves to server-set session cookies via `resolveSessionUser`.
- **Source:** `checkout-v2-migration-inventory.md §5` (landmine a) · O1 routing inventory.
