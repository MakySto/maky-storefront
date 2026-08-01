# MAKY.STORE — Frontend Design System Rules

This file is the persistent contract for design and frontend work on the MAKY.STORE
Next.js storefront. It encodes decisions that are NOT inferable from code. Read it
before any design/UI task.

> Companion reference: `docs/design/storefront-analysis-20260621.md` is the read-only
> audit of the current token/component/i18n state. Read it before token or component work.

## 1. Project context

MAKY.STORE is a Slovak (sk-SK first) e-commerce storefront built on Saleor + a
Paper/Next.js fork. The first launch scope is Auto-Moto accessories:

- Strešné nosiče (roof racks)
- Strešné boxy (roof boxes)
- Nosiče bicyklov (bike carriers)
- Nosiče lyží (ski carriers)
- Snehové reťaze (snow chains)
- Autochladničky (car fridges)
- Strešné stany (roof tents)
- Poradňa (advice / blog)

Do NOT surface other future categories (workwear, work shoes, hand tools, marketplace
categories) until explicitly requested.
Do NOT promote towbars or electrical kits on the homepage until the business model and
installation partner are confirmed.

## 2. Source of truth (read this first)

- Existing **code** is canonical for the current implementation and the existing
  **OKLCH design tokens**. Never invent a parallel token system (e.g. a new hex system).
  The single canonical token file is `src/styles/brand.css` (Tailwind v4, CSS-first,
  no `tailwind.config.js`).
- **This file (CLAUDE.md) + `docs/design/`** is canonical for design decisions and
  business/messaging rules.
- For **new or significantly changed UI**, a Figma frame OR a written spec is the design
  _intent_. Implement in code, then review.
- The **implemented, validated code** is the final truth.

Practical rule: before changing or "redesigning" any existing component, FIRST read its
real implementation in code. Do not rebuild it from scratch in Figma. Figma mirrors and
documents the current system and is a sketch space for changes.

**Figma is a one-way mirror, not a write target (from design analysis 2026-06-21):**
There is NO MCP tool that writes Figma variables, and the account is Pro tier (no
Enterprise Variables REST API). Mirror tokens code→Figma by generating a versioned
`design/tokens.json` from `brand.css` and importing it via the Tokens Studio plugin at
milestone cadence. The conversion is OKLCH→sRGB (lossy) and one-way — Figma never
becomes the source.

## 3. Design-change workflow

For any non-trivial UI change:

1. Read the existing code (component, tokens, props, where it is used).
2. Take design intent from a Figma frame or a written spec.
3. Propose an implementation plan and wait for approval.
4. Implement in a small, single-purpose branch.
5. Run validation (see §11).
6. Capture desktop + mobile screenshots and summarize differences vs. intent.
7. Update `docs/design/` or Figma documentation if relevant.

Prefer small branches and small commits. For significant edits, show the plan/diff
before applying.

## 4. Color semantics (anchored to existing OKLCH tokens)

Use the existing OKLCH tokens as the canonical primitive source. Define a **semantic
layer** on top of them; components must reference semantic tokens, not hardcoded
primitive colors.

Current design semantics:

- **Brown** = MAKY brand — logo, footer, brand navigation, "Všetky kategórie".
- **Amber** = promotions, discounts, benefits, seasonal highlights.
- **Green/teal** = purchase CTA, continue action, confirmed compatibility, positive status.
- **Graphite / dark neutral** = normal price + main text.
- **Red-orange** = sale price and destructive/error attention.
- **Green** = in stock, compatible, positive status.

Hard rules:

- The primary purchase action (add-to-cart / buy) must be a **full, high-contrast**
  button using the purchase-CTA semantic token. It must read as the clear primary action
  on the page.
- Do **NOT** use brown as the primary add-to-cart color.
- One primary-action color per page; everything else gets lower visual weight.
- No hardcoded hex/oklch in components — always go through semantic tokens.

The exact value of the purchase-CTA token can evolve; the rule is the semantic usage,
not a fixed color value.

### 4.1 Token reality & naming (from design analysis 2026-06-21)

The semantic layer mostly **already exists** in `src/styles/brand.css` (`@theme inline`
aliases + `:root` semantics). Treat token work as **extend/normalize**, not "build a new
layer". Concretely:

- **Real names differ from generic vocabulary.** `cta` exists as **`action`**
  (`--action-primary/secondary/ghost`); status `error` exists as **`danger`**
  (`--color-status-danger*`). Use the real names; add thin aliases if a generic name is
  required.
- **`promo` is the only genuinely missing color category** — add it (mirror the
  `price`/`status` pattern: base/-bg/-border + on-promo).
- **NEVER rename an existing token.** Tailwind v4 generates utilities from token _names_;
  renaming silently kills every existing `bg-action-primary` / `text-danger` usage with
  **no build error** and no type-check (class strings are hand-rolled `cn()` objects, no
  `cva`). Only ADD aliases.

### 4.2 The shadcn → semantic bridge (known context — undefined-token wall)

~70 component files — every shadcn UI primitive (`Button`, `Badge`, `Input`,
`Checkbox`, `Sheet`, `Accordion`, `Carousel`, `DropdownMenu`) plus much of `account/*`,
`pdp/*`, `cart/*` — use a shadcn token vocabulary (`bg-primary`, `text-muted-foreground`,
`bg-card`, `bg-background`, `bg-destructive`, `border-input`, `ring-ring`) that is **not
defined** in `brand.css`. Under Tailwind v4 an undefined `--color-*` emits **no rule**, so
those utilities render **colorless** (this is the "ghost add-to-cart button":
`bg-primary` with no `--color-primary` → `background-color: rgba(0,0,0,0)`).

The fix is a **token change, not a component change**: one additive `@theme inline` block
mapping the shadcn names onto existing semantics (`--color-primary: var(--action-primary)`,
`--color-destructive: var(--color-status-danger)`, `--color-background: var(--surface-primary)`,
`--color-muted-foreground: var(--text-tertiary)`, `--color-input: var(--border-default)`,
`--color-ring: var(--focus-ring)`, …). This **Step-0 bridge un-breaks all ~70 files at
once and must land before any component redesign.** Separately, the defined-but-unused
`status-*` tokens should replace raw `bg-green-50`/`bg-red-50` literals during
per-component work. Full bridge in `docs/design/storefront-analysis-20260621.md` §6.4.

### 4.3 Component sequence (dependency order)

Redesign in dependency-topological order, NOT starting at ProductCard (it composes the
broken primitives): **token bridge → Badge → Button → new `Price` primitive →
ProductCard → fan out**. Vehicle-selector / CompatibilityBox comes after primitives,
built against a **mocked** fitment data shape (real fitment data is a parallel track).

## 5. Header rules

Keep: logo, large search, account, wishlist/favorites, cart, and "Vybrať vozidlo" as a
prominent CTA.

Do NOT include: a Compare feature, a contact/help box, or a standalone currency dropdown
(currency is tied to channel/route — it is not independently switchable).

Country/language selection may be less prominent (footer or account/settings is
acceptable). Do NOT implement hard IP-based redirects for language/country. A dismissible
"suggest local version" banner is acceptable later.

## 6. Homepage rules

Focus on the current Auto-Moto launch scope.

- Do NOT show free-shipping claims anywhere.
- Do NOT render empty product sections with English placeholders. Hide empty sections or
  use Slovak localized empty states.
- Hero copy must speak to customer benefits, not internal/founder metrics (no
  "13 markets / 4 suppliers" framing).

Consumer-facing homepage brands (for now): Thule, Nordrive, Menabo, Yakima, Peruzzo,
Pro-USER, Spinder, Green Valley, SnowDrive, DAC.
Do NOT show Cruz, HAK-SYSTEM, GALIA, ORIS or JAEGER on the homepage until explicitly
approved.

## 7. Product card rules

Cards must be more informative than generic cards. Where data exists, show: brand,
product type/category, availability, price (using price tokens), a short benefit, and
compatibility status.

Compatibility badge states:

- "Overená kompatibilita" — when fit with the selected vehicle is confirmed.
- "Vyberte vozidlo" — when no vehicle is selected and the product is vehicle-specific.
- "Univerzálny produkt" — for universal products.

For roof-rack bundles, communicate the complete set:
"Kompletná zostava: tyče + pätky + kit".

## 8. Product detail (PDP) rules

Compatibility must be visible **near the purchase CTA**, not buried in the description.

States:

- Vehicle selected + compatible → "Overená kompatibilita" with the selected vehicle
  (e.g. brand / model / generation / year).
- No vehicle selected → "Overiť kompatibilitu s vaším vozidlom" + a button to select
  the vehicle.
- Vehicle selected + incompatible → a clear warning + a link to compatible products.
- Universal product → universal-product status.

The selected vehicle must persist across the visit (set once, reused on listing + PDP).
Highlight manuals/PDFs on the product page where available (not on the homepage).

## 9. Shipping / returns / warranty — storefront messaging

Shipping:

- Shipping is via FedEx.
- Shipping price depends on product size, weight and destination; communicate
  "cenu uvidíte v košíku".
- Do NOT claim free shipping unless explicitly implemented for specific products or
  campaigns.

Returns:

- "30 dní na vrátenie" may be communicated.
- Do NOT hardcode return-shipping-cost wording into badges/trust-lines until the policy
  per shipping class is confirmed. For oversized goods use cautious wording and link to
  a detailed returns page.

Warranty:

- Standard warranty is 2 years unless a product-specific warranty is confirmed.

Operating-entity details (legal name, address, IČO, DIČ, register entry, SOI as the
supervisory authority): the entity is now **MAKY.STORE s. r. o.** These live on
`/kontakt`, `/obchodne-podmienky` and `/reklamacie-a-vratenie`, NOT in the footer —
Marek removed the footer block on 2026-07-29 as visual noise. The footer must keep
linking `/kontakt` and `/obchodne-podmienky` from every page; that link path is what
satisfies "easily, directly and permanently accessible" under zákon 22/2004 and
Directive 2000/31/EC Art. 5. **Do not reintroduce the footer block, and do not remove
those two links without moving the details somewhere equally reachable.**

## 10. Technical restrictions

Do NOT change the following without explicit approval:

- Saleor integration / GraphQL query structure
- checkout logic
- cart logic
- CFM integration
- channel / routing / i18n locale logic
- environment / secrets
- deployment configuration

Do NOT copy XStore code or assets. XStore is a layout/UX reference only.
Do NOT add new dependencies solely for styling without approval.

## 11. Validation requirements

For UI changes:

- run lint
- run typecheck
- run build
- capture desktop + mobile screenshots where possible
- summarize visual differences vs. the design intent
- list changed files

Use small branches and small commits. Follow the project's established commit-hook
convention.

Additional gates (from design analysis 2026-06-21):

- **i18n 12-locale parity check (en-GB/gb-gbp market removed 2026-07-20)** whenever copy changes — all message files must stay
  structurally parallel — the invariant is that **all 12 files are identical** (missing 0 / extra 0),
  NOT a fixed count (it drifts as keys are added/removed; ~219 as of 2026-06-30). next-intl is NOT type-augmented, so missing
  keys fail silently at runtime, not at build. Parity script:
  ```bash
  node -e 'const fs=require("fs");function flat(o,p=""){let r=[];for(const k of Object.keys(o)){const key=p?p+"."+k:k;o[k]&&typeof o[k]=="object"&&!Array.isArray(o[k])?r=r.concat(flat(o[k],key)):r.push(key)}return r}const d="src/i18n/messages/",L=["cs-CZ","de-AT","de-DE","en-CA","en-US","es-ES","fr-FR","hu-HU","it-IT","pl-PL","ro-RO","sk-SK"],ref=new Set(flat(JSON.parse(fs.readFileSync(d+"en-US.json"))));for(const l of L){const k=new Set(flat(JSON.parse(fs.readFileSync(d+l+".json"))));console.log(l,"missing",[...ref].filter(x=>!k.has(x)),"extra",[...k].filter(x=>!ref.has(x)))}'
  ```
- **Manual light-only visual check.** Dark mode is NOT wired — there is no `.dark` block
  (`color-scheme: light` is hardcoded), so any `dark:` variant in components is dead.
  Do not rely on or add `dark:` variants until dark mode is intentionally introduced.
- **`next build` passing does NOT certify token correctness.** Tailwind v4 silently emits
  nothing for an undefined `--color-*`; a colorless utility passes the build. Visually
  verify that touched components actually paint (see §4.2).

## 12. Token system — current state (from design analysis 2026-06-21)

Ground truth captured by `docs/design/storefront-analysis-20260621.md`:

- **Canonical source:** `src/styles/brand.css` (463 lines). Tailwind v4 CSS-first; layers
  are `@theme` primitives (OKLCH, ~51 tokens: copper/forest/sand/gray + red/amber/blue),
  `@theme inline` semantic aliases, `:root` semantic tokens (var()-chained to primitives),
  `@layer base`.
- **Already complete semantic categories:** surface, text, border, price, status
  (success/warning/danger/info), action (=cta), plus component/z-index/control/disabled/
  focus/motion tokens.
- **Gaps:** `promo` (missing), `brand` (only via primitives), `error` alias (use `danger`),
  `overlay`/scrim (hardcoded). The shadcn vocabulary is undefined (§4.2).
- **Two distinct issues — do not conflate:** (a) shadcn tokens are _used-but-undefined_
  → broken, fix via the bridge; (b) `status-*` tokens are _defined-but-unused_ → fine,
  migrate raw palette literals to them.
- **Stale/misleading:** `src/styles/README.md` describes a hex `--background`/`.dark`
  system that does not exist in `brand.css`; `src/app/api/og/route.tsx` ships those stale
  hex values (Satori can't read CSS vars). Reconcile before declaring "code canonical".

## 13. Build / deploy safety (ops)

Production `maky.store` is served by **PM2** process `maky-storefront` (`npm start` =
`next start -p 3000`, cwd `/opt/storefront`), proxied by nginx
(`/etc/nginx/conf.d/storefront.conf` → `proxy_pass 127.0.0.1:3000`). It serves the
on-disk `.next` build. `maky-smtp-app` is a **separate** PM2 process on the same box and
carries transactional e-mail — never stop, restart or include it in a deploy.

### 13.1 The one rule

**NEVER run `pnpm build` / `next build` in `/opt/storefront` while the PM2
`maky-storefront` process is running** — not to deploy, and not "just to measure
something". The build replaces the hashed chunks on disk while the live `next start`
keeps serving HTML that references the old, now-deleted hashes. Every `/_next/static/*`
request 404s, so the site answers **HTTP 200 and renders unstyled**. Confirmed twice:
2026-06-21, and again 2026-08-01 when an agent ran a build to measure peak memory.

This is not a memory problem and no amount of RAM fixes it — `pnpm build` peaks at
~988 MB on a 15 GiB box. The failure is about _replacing files under a running server_.

It is also invisible to every uptime check that only looks at status codes. An external
monitor on `/sk` must use a **keyword check**, not HTTP 200.

### 13.2 Production deploy — run the script, not the steps

```bash
cd /opt/storefront
./scripts/ops/deploy-production.sh -m "why this is going out"
```

Manual deploys are forbidden. The script exists because the order of the steps is what
makes them safe, and five steps in the wrong order is exactly what an agent or a tired
human gets wrong at 23:00. What it does:

```
lock        flock — Claude, Codex and a human share this box; two deploys must not race
preflight   memory, disk, clean tree, current BUILD_ID + its sha, NEXT_OUTPUT unset,
            sudo, PM2 app
stop        maky-storefront only — never maky-smtp-app
snapshot    sudo mv -T .next → rollbacks/.next.rollback-<prev-sha>-<prev-BUILD_ID>-<UTC>
build       pnpm build, output teed to a log file
metadata    write .next/MAKY_DEPLOY_META (git sha, build id, timestamp)
start       pm2 start maky-storefront, wait for the port to answer
─────────── the commit point ────────────────────────────────────────────────────
gate        127.0.0.1:3000 — page, CSS chunk on disk, CSS chunk over HTTP
verify      nginx via --resolve, then the public URL — retried, warn only
log         append a block to /opt/DEPLOYMENTS.log
prune       keep the newest 2 snapshots plus any pinned with a sidecar .keep
```

**Everything before the gate rolls back on failure. Nothing after it does.** Once the
artifact is serving correctly on `127.0.0.1:3000`, it stays — a failed log write, a
pruning error or a network blip on the public check is a post-deploy problem, not a
reason to throw away a verified build. The script exits `75` in that case and says so.

Only the artifact's own behaviour is in the rollback gate. If nginx or public DNS is
broken, swapping the build back does not fix it, so those checks report and do not
revert. Exit codes: `0` deployed, `1` failed and rolled back, `70` internal state error,
`71` the deploy failed **and** the restore failed (site may be down), `75` deployed but a
post-deploy step failed.

Budget 2–5 minutes of planned downtime. That is the accepted cost until the scratch
worktree swap (§13.8) is proven.

Rehearse with `--dry-run` first: it runs preflight, prints the plan and touches nothing.

Two deliberate omissions. There is **no `--allow-dirty`**: a deploy from an uncommitted
tree would write a `git_sha` into `MAKY_DEPLOY_META` that does not describe what was
built, which defeats the point of recording it. Commit first, even for a hotfix. And
preflight demands ~10 GB of free memory — the build itself peaks under 1 GB, so this is
really an interlock against deploying while an agent is holding several gigabytes. Override
it per-run (`MIN_FREE_MEM_MB=6144 ./scripts/ops/deploy-production.sh`) rather than lowering
the default, until a real cgroup `memory.peak` has been measured across a few deploys.

**Snapshotting by `mv` also gives the build a cold `.next/cache`.** That is load-bearing,
not hygiene: on the CMS pilot cutover a warm `fetch-cache` baked a pre-cleanup CMS
document into the build and shipped a duplicated company block. Content changes in the
CMS must precede the build, and the build must not inherit the old fetch cache.

### 13.3 Snapshots and rollback — never `cp -al`

`/opt/storefront-rollbacks/` is `root:root`, so every move into or out of it needs
`sudo mv`. Deliberate: an agent working in `/opt/storefront` cannot delete the rollbacks
by accident.

- **Out (deploy):** `sudo mv -T .next /opt/storefront-rollbacks/.next.rollback-<prev-sha>-<prev-BUILD_ID>-<UTC>`
- **Back, automatic** (the deploy just failed): `sudo mv -T <snapshot> .next`. That
  snapshot is the artifact this run displaced seconds ago, nothing else refers to it, and
  `mv` is instant. The script does this itself.
- **Back, manual** (restoring an older, pinned build): `sudo cp -a <snapshot> .next`, so
  the snapshot survives and can be used again.
- Always `-T` on `mv`. Without it, if the target directory already exists, `mv` puts
  `.next` **inside** it instead of failing — which corrupts the snapshot and breaks the
  automatic restore that depends on it. The snapshot name also carries a UTC timestamp so
  a repeat deploy of the same sha cannot collide in the first place.
- The snapshot is named after the **commit the snapshotted build came from**, read from
  its `MAKY_DEPLOY_META` — not from `git HEAD`, which is the commit about to be built. A
  build with no metadata is named `unknown`, which is honest; during an incident people
  read directory names, not the files inside them.
- **Never `cp -al`.** Hardlinks share the inode, and `next start` rewrites ISR cache
  under `.next/server/app/*.html` with `O_TRUNC` — it modifies the existing inode rather
  than replacing the file, so the live server silently mutates the snapshot. Static
  chunks under `.next/static/` are never rewritten after a build, so a hardlinked
  snapshot is not useless — but it stops being _immutable_, which is its whole point.

Manual rollback to a known-good build — seconds, no rebuild:

```bash
ls /opt/storefront-rollbacks/                  # what is available
cat /opt/storefront-rollbacks/<pick>/MAKY_DEPLOY_META   # which sha it was built from
pm2 stop maky-storefront
cd /opt/storefront
rm -rf .next                                   # only now: the snapshot is safe
sudo cp -a /opt/storefront-rollbacks/<pick> .next
sudo chown -R ubuntu:ubuntu .next              # PM2 runs as ubuntu and writes ISR cache
git checkout <git_sha from MAKY_DEPLOY_META>   # keep the tree in sync with the artifact
pm2 start maky-storefront
```

**Do not rebuild from a branch during an incident** — slow, and the result is unverified
at the worst possible moment. Restore the artifact, then diagnose.

Keep at most 2 snapshots. A snapshot that must never be pruned gets a **sidecar** marker
next to it, not a file inside it:

```bash
sudo touch /opt/storefront-rollbacks/.next.rollback-b6b633da-JAODjLtaigo1DL9m6h614.keep
```

The marker must stay outside the directory because a restore moves the snapshot's
contents back into the live tree. A `.keep` stored inside would ride along, and the next
deploy would move it into the new snapshot — silently pinning the wrong build and letting
the one you meant to protect be pruned.

### 13.4 When the build fails

- **Never start PM2 over a partial `.next`.** A build killed halfway leaves an
  unservable tree; starting it turns a failed deploy into an outage.
- `rm -rf .next` is **forbidden before the snapshot exists** — that is what leaves you
  with no fast rollback. After a _failed_ build it is exactly right: delete the partial
  artifact, restore the snapshot, then work out why the build failed.
- `pm2 restart maky-storefront` is a valid recovery **only after a build that finished**
  (`.next/BUILD_ID` exists and the smoke test passes). It is the fix for the unstyled-site
  symptom in §13.1. After an interrupted build it starts the broken tree — roll back
  instead.

### 13.5 Smoke test — HTTP 200 is not the test

The failure mode this catches returns 200. The page must be _styled_, and the stylesheet
must be one this build actually contains. Run this against `127.0.0.1:3000` — that is the
rollback gate. The same checks against nginx and the public URL come after the commit
point and only warn (§13.2).

```bash
HTML=$(mktemp)
curl -fsS http://127.0.0.1:3000/sk -o "$HTML"
CSS=$(grep -oE '/_next/static/[^"]+\.css' "$HTML" | head -1)
test -n "$CSS" || { echo "FAIL: no CSS chunk in the served HTML"; exit 1; }
test -f ".next/${CSS#/_next/}" || { echo "FAIL: served CSS is not in this build"; exit 1; }
curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' "http://127.0.0.1:3000$CSS"
curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' "https://maky.store$CSS"
rm -f "$HTML"
```

Both must be `200` with a non-trivial byte count — a 200 serving an empty file is still a
broken site. Check the chunk **locally and through nginx**: they fail independently.

Two traps that have already produced wrong runbooks:

- **The path is `/_next/static/chunks/*.css`, not `/_next/static/css/*.css`.** Next 16
  with Turbopack emits stylesheets next to the JS chunks. A pattern anchored on
  `/_next/static/css/` matches nothing on a perfectly healthy page — verified against
  live production on 2026-08-01 — so it would fail every smoke test and trigger a
  needless rollback.
- **Guard against an empty variable.** `curl "$URL$CSS"` with an empty `$CSS` fetches the
  homepage and returns 200, so the test passes while proving nothing.
- **Probe sudo with `sudo -n true`, never `sudo -v`.** `-v` validates credentials, and
  that asks for a password even under `NOPASSWD` — the rule exempts running commands, not
  authenticating. `ubuntu` on this box has `NOPASSWD` from cloud-init, so `sudo -n true`
  succeeds while `sudo -n -v` answers "a password is required". A `-v` probe therefore
  blocks the deploy on a box where sudo was never a problem, which is how the first run of
  this script died (2026-08-01).

Finish with a look in a real browser. Automated checks cannot see a colourless button
(§4.2).

### 13.6 Never set `NEXT_OUTPUT` for a production deploy

`next.config.js` selects the output mode from `NEXT_OUTPUT`; unset means normal mode,
which is what production runs. PM2 starts `/usr/bin/npm start -- -p 3000` = `next start`,
which reads `.next` directly.

Setting `NEXT_OUTPUT=standalone` produces `.next/standalone/server.js`, which that PM2
command never launches — you get a build that looks fine and serves nothing new. The
variable is legitimate for the **Dockerfile**; the ban is on the production PM2 deploy
path only. Any runbook telling you to build standalone and copy `public` and
`.next/static` into `.next/standalone/` is stale — it does not describe this box.

### 13.7 Local validation

For a build artifact that only needs to be inspected, build in a **separate
worktree or clone** and never in the live deploy directory. Nothing about §13.1 changes
because the intent is "just checking".

### 13.8 Open, not approved: scratch worktree swap

Building in a scratch worktree and swapping the directory would cut the downtime from
minutes to seconds. It is **not approved** — `.next/required-server-files.json` records
an absolute path to the project root, and whether a moved build tolerates that has not
been tested. Prove it off production first: build in worktree A, create worktree B at the
same sha, move A's `.next` into B, serve B on a spare port, and check homepage, CSS, a
PLP, a PDP and a CMS page. Until that passes, stop–build–start with planned downtime is
the procedure.
