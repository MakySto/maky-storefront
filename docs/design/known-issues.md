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

### Unknown top-level segments render 200 index,follow (no market gate)
- **What:** `src/proxy.ts` has no market gate — any unknown first path segment falls through
  to `NextResponse.next()` and renders **HTTP 200 with `robots: index, follow`** instead of a
  404/noindex. Verified on a spare-port build (2026-07-06): `/admin`, `/products/login`,
  `/products/signup`, and single-segment legacy WordPress URLs (e.g.
  `/pilcicke-nohavice-engelbert-strauss-kwf-profi`) all return **200 index,follow**. (Deep
  legacy paths like `/…/kwf-profi/detail` already 404; `/sk-eur/*` correctly 301s to `/sk/*`.)
- **Impact:** Google indexes ghost/junk URLs. The SEO hygiene branch mitigates this with
  robots.txt Disallow (`/admin`, `/*/login$`, `/*/signup$`) + GSC Removals, but robots only
  blocks future crawling — it does **not** deindex, and GSC Removal is temporary (~6 months)
  unless the URL returns 404/noindex. So permanent removal needs a real gate.
- **Fix (separate, §10-approved task — NOT part of the hygiene branch):** add a **market gate**
  that returns **404/noindex for unknown channels** (first segment not in `FRIENDLY_SLUGS` /
  `SALEOR_SLUGS`). It **must not** break `/_next/*`, `/api/*`, `/robots.txt`, `/sitemap.xml`,
  static assets, or webhooks — routing is easy to break, so this needs its own validation.
- **Source:** O1 routing inventory §1 (no market gate) · SEO hygiene branch runtime verify 2026-07-06.
