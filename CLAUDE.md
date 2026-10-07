# MAKY.STORE — Frontend Design System Rules

This file is the persistent contract for design and frontend work on the MAKY.STORE
Next.js storefront. It encodes decisions that are NOT inferable from code. Read it
before any design/UI task.

> Companion reference: `docs/design/storefront-analysis-20260621.md` is the read-only
> audit of the current token/component/i18n state. Read it before token or component work.
>
> Live project state (what is done, what is open, who owns what):
> `docs/storefront-4.5/current-state.md`.

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

**Figma mirrors the code; it is not a prerequisite for it.** `src/styles/brand.css` stays the
source of truth and tokens flow code→Figma only: the conversion is OKLCH→sRGB (lossy), so Figma
never becomes the source. The official Figma MCP exposes `use_figma`, which runs Plugin API code
in a file and whose documented scope includes creating variables, components and frames (connection
checked 2026-09-22: Maky-88, Pro, Full seat), so writing to Figma is possible when a task calls
for it. The older route also works: a versioned `design/tokens.json` generated from `brand.css`
and imported with the Tokens Studio plugin at milestone cadence. Implementation does not wait for
either, and a Figma sync is not a reason to order a new audit of the Figma system.

## 3. Delivery workflow

Start with the requested customer or operator outcome and read the relevant existing
implementation. Use the agreed visual/written intent. Show a representative result in the
real application early, before expanding the implementation or its test matrix. A smaller
delivery reduces scope, not quality.

A task to implement or fix an outcome includes the necessary technical decisions, related
code/test changes, targeted validation, commits, pushing the working branch, and a pull
request. Do not require a second approval for an ordinary step or corrective commit inside
that task. A task that includes deployment includes completing deployment and checking its
effect through the established runbook.

Ask the owner only for a missing business decision, material new cost, irreversible external
effect, or work outside the assigned scope. A review-only request does not authorize
unrelated production changes.

Use branches and intermediate commits to preserve work. Coordinate overlapping changes and
one production switch at a time. Choose parallelism according to useful work and actual
capacity, not a fixed agent quota. Report the delivered outcome and its evidence, not only a
count of checks.

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
- **`promo` exists** (`--color-promo`, `-bg`, `-border`, `-solid` and `--color-on-promo` in
  `brand.css`). Use it; do not add it a second time.
- **A rename must not break existing usage.** Tailwind v4 generates utilities from token _names_;
  renaming silently kills every existing `bg-action-primary` / `text-danger` usage with
  **no build error** and no type-check (class strings are hand-rolled `cn()` objects, no
  `cva`). When a name has to change, update every consumer in the same change or keep the old
  name as a compatible alias, and check in the real application that the touched components
  still paint.

### 4.2 The shadcn → semantic bridge (landed)

The bridge is in place: `brand.css` maps the shadcn names that the primitives and much of
`account/*`, `pdp/*` and `cart/*` use (`bg-primary`, `text-muted-foreground`, `bg-card`,
`bg-background`, `bg-destructive`, `border-input`, `ring-ring`, …) onto the existing semantics in its
`@theme inline` block (search `--color-primary:`). Do not add it a second time, and do not treat it as
a step that has to come before component work. Its history is in
`docs/design/storefront-analysis-20260621.md` §6.4.

What still matters: under Tailwind v4 an undefined `--color-*` emits **no rule**, so a utility whose
token does not resolve renders colorless while the build stays green (this was the "ghost add-to-cart
button": `bg-primary` with no `--color-primary` → `background-color: rgba(0,0,0,0)`). When a component
uses a token name for the first time, check that it resolves in `brand.css`. When a component that still
carries raw palette literals (`bg-green-50`, `bg-red-50`) is touched, move it to the matching
`status-*` tokens.

### 4.3 Component work

No order of components is prescribed. The primitives are unblocked (§4.2), so a task starts where its
customer outcome is. A change to a shared primitive (`Badge`, `Button`, the price display, …) reaches
every card, PDP block and cart line that composes it, so look at those consumers in the real
application. For the vehicle selector and the compatibility box, read the real fitment implementation
(`src/lib/fitment`) first and build against its data shape, not an invented one.

## 5. Header rules

Keep: logo, large search, account, wishlist/favorites, cart, and "Vybrať vozidlo" as a
prominent CTA.

Do NOT include: a Compare feature, a contact/help box, or a standalone currency dropdown
(currency is tied to channel/route — it is not independently switchable).

Country/language selection may be less prominent (footer or account/settings is
acceptable). Do NOT implement hard IP-based redirects for language/country. A dismissible
"suggest local version" banner is acceptable later.

Desktop category row — priorities (owner, 2026-09-25):

- The catalogue categories come first. "Značky" and "Poradňa" are SECONDARY links: they follow
  the categories and are the first to give way when the row is short of width. Never make them
  mandatory in the row again, and never let a selling category disappear to keep them in view.
- They must stay reachable at every width: the "Všetky kategórie" menu, the phone menu and the
  homepage carry them.
- The row measures its own width (wrap-and-clip, `NavOverflowRow`); no link may run under the
  vehicle button, and a hidden link leaves the tab order (`inert`).

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

For roof-rack bundles, communicate the complete set as the product data shows it: the bars, the
feet and the fitting kit that are really in the bundle. "Kompletná zostava: tyče + pätky + kit" is
the wording only when all three are in it; a set with another composition says what it contains.

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

- Shipping is via Slovenská pošta and FedEx, as `/sk/doprava-a-platba` states (owner
  confirmed 2026-09-22).
- Shipping price depends on product size, weight and destination; say that it is calculated
  at checkout — "Cenu vypočítame v pokladni" (short) / "Cena dopravy sa vypočíta v pokladni".
  The earlier "cenu uvidíte v košíku" was untrue: the cart shows "Vypočíta sa v pokladni" until
  a delivery is chosen (owner, 2026-09-25). Every locale says the same.
- Do NOT claim free shipping unless explicitly implemented for specific products or
  campaigns.

Returns:

- The withdrawal period is **14 days**; registered customers who place the order while
  signed in get an extended **30 days** — exactly as `/sk/reklamacie-a-vratenie` states.
  Never present 30 days as unconditional. Structured data uses 14 (owner, 2026-09-22).
- Do NOT hardcode return-shipping-cost wording into badges/trust-lines until the policy
  per shipping class is confirmed. For oversized goods use cautious wording and link to
  a detailed returns page.

Warranty:

- Standard warranty is 2 years unless a product-specific warranty is confirmed.
- Confirmed (owner, 2026-10-05): the PRO-USER car fridges (CoolZ) carry **3 years**. The line under the
  buy button follows the product's own `warranty_years` for the fridge template only (`warrantyRef` in
  `src/lib/product-templates.ts`, `extendedWarrantyYears`): 3 to 10 whole years print "Záruka N roky /
  Na tento produkt", anything else keeps "Záruka 2 roky / Na tovar podľa zákona" (CoolZ Power TK20414
  holds 2). Another template gets the longer line only when the owner says so, and the statutory words
  are never printed beside a figure that is not the statute's.

Operating-entity details (legal name, address, IČO, DIČ, register entry, SOI as the
supervisory authority): the entity is now **MAKY.STORE s. r. o.** These live on
`/kontakt`, `/obchodne-podmienky` and `/reklamacie-a-vratenie`, NOT in the footer —
Marek removed the footer block on 2026-07-29 as visual noise. The footer must keep
linking `/kontakt` and `/obchodne-podmienky` from every page; that link path is what
satisfies "easily, directly and permanently accessible" under zákon 22/2004 and
Directive 2000/31/EC Art. 5. **Do not reintroduce the footer block, and do not remove
those two links without moving the details somewhere equally reachable.**

## 10. Task scope and integrations

An assigned storefront feature or fix may include necessary changes to GraphQL, cart,
checkout, CFM/Payload consumers, routing, locale handling, tests and related configuration.
These are not separately forbidden merely because they cross a file or module boundary.
Preserve each system's data ownership and coordinate with the current implementer when work
overlaps.

Use appropriate development, sandbox or VPS access for the task. Do not mistake a missing
capability for a permanent policy restriction. Production activation and genuine business
effects must be part of the assigned scope; they are not incidental side effects of a
preview or a general review.

Resolve routine engineering choices yourself. A dependency is not prohibited by category,
but must serve the requested result without unnecessary complexity, material unapproved cost
or license conflict.

Do not copy XStore code or assets. XStore remains a layout/UX reference only.

## 10.1 The repository is a public fork — a leaked secret can never be unleaked

`MakySto/maky-storefront` is **public**, because it is a **fork of `saleor/storefront`** and a fork
of a public repo is created public. Nobody chose this; it was never noticed. Audited clean
2026-08-07 (gitleaks over all 299 commits and all 34 refs: no credential has ever been committed).

The rule that follows is absolute, and it is stronger here than for an ordinary public repo:

**Never let a credential reach a commit. If one ever does, the only remedy is to REVOKE AND ROTATE
it — immediately, before anything else.**

Deleting the branch does not help. Rewriting history does not help. Deleting our fork does not
help. Making the repo private does not help, and in any case GitHub will not let a fork be made
private at all. In a fork network a commit pushed to any repo in the network stays reachable by its
SHA from every other repo in that network, permanently. The object lives in the network, not in our
copy of it.

Practical consequences:

- `.env` is gitignored and has never been tracked. Keep it that way. Real values belong in
  `/opt/storefront/.env`, never in a file git can see, and never in a doc or a commit message.
- Secret **names** in code and tests are fine — values are not. Test fixtures must be obvious
  fakes (`"rotated-secret"`), never a real value "just for the test".
- Going private is a migration, not a toggle: a new private repo, push the content, repoint the
  remote and the deploy path, delete the fork. Treat it as a planned operation, never as a fix for
  a leak that already happened.

## 11. Verification proportional to the change

Use relevant existing tests and add regression coverage for the behavior being changed. Type
checks, lint, integration builds, locale parity, accessibility checks and wider suites are
selected by the impact of the change. An inexpensive existing suite may run in full; shared
behavior needs broader coverage than an isolated copy or spacing change.

Exercise the decisive user/data path early. Inspect UI in the real application on desktop
and mobile. A fixture preview is not proof of a producer-to-storefront integration; a loaded
hash is not proof of updated HTML. Check the actual output that matters to the task.

Reuse evidence when its code, inputs and environment remain relevant. Do not regenerate
unchanged artifacts, repeat complete audits, or ask multiple reviewers to rerun the same
commands merely to increase confidence without a specific concern. Do not weaken or skip
failing tests just to get a green result.

Finish when the agreed outcome is demonstrated and relevant regressions are addressed. A
specific unresolved defect can justify more verification. A speculative unrelated concern
does not block this delivery; record it separately.

Facts that decide what a check proves (not a checklist to run every time):

- **Locale parity.** When copy changes, all 12 message files must stay structurally parallel: the
  invariant is that they are identical (missing 0 / extra 0), not a fixed count (it drifts as keys are
  added or removed; en-GB/gb-gbp market removed 2026-07-20). next-intl is NOT type-augmented, so a
  missing key fails silently at runtime, not at build. Parity script:
  ```bash
  node -e 'const fs=require("fs");function flat(o,p=""){let r=[];for(const k of Object.keys(o)){const key=p?p+"."+k:k;o[k]&&typeof o[k]=="object"&&!Array.isArray(o[k])?r=r.concat(flat(o[k],key)):r.push(key)}return r}const d="src/i18n/messages/",L=["cs-CZ","de-AT","de-DE","en-CA","en-US","es-ES","fr-FR","hu-HU","it-IT","pl-PL","ro-RO","sk-SK"],ref=new Set(flat(JSON.parse(fs.readFileSync(d+"en-US.json"))));for(const l of L){const k=new Set(flat(JSON.parse(fs.readFileSync(d+l+".json"))));console.log(l,"missing",[...ref].filter(x=>!k.has(x)),"extra",[...k].filter(x=>!ref.has(x)))}'
  ```
- **Light only.** Dark mode is NOT wired: there is no `.dark` block and `color-scheme: light` is
  hardcoded, so any `dark:` variant in a component is dead. Do not rely on or add `dark:` variants
  until dark mode is intentionally introduced.
- **A passing `next build` does NOT certify token correctness.** Tailwind v4 silently emits nothing
  for an undefined `--color-*`; a colorless utility passes the build. Look at the touched components in
  the real application to see that they paint (§4.2).
- **A test owns its clock.** A committed dataset or fixture that carries a date the code compares with
  `Date.now()` (`generatedAt` with `validity.staleAfterDays`, `validUntil`) expires on a calendar day, and
  `deploy-production.sh` runs the whole suite on the box before every deploy: a test that asks the real clock
  goes red on that day and no deploy goes out. It happened on 2026-10-06 20:36 UTC, when the pilot's thirty
  days ran out under `pilot.test.ts`. Pass `now` to the resolver, or generate the date from the clock the code
  reads. To look for the next one, run the suite with `Date.now()`, `new Date()` and `performance.timeOrigin`
  moved to a few dates over the coming years (a throwaway vitest setup file that offsets them): whatever goes
  red is a clock dependence. The live fitment dataset has its own date, `staleAfter` in `/api/fitment/status`.
- Commits follow the project's established commit-hook convention (husky + lint-staged).

## 12. Token system — current state (from design analysis 2026-06-21)

Ground truth captured by `docs/design/storefront-analysis-20260621.md`:

- **Canonical source:** `src/styles/brand.css`. Tailwind v4 CSS-first; layers
  are `@theme` primitives (OKLCH, ~51 tokens: copper/forest/sand/gray + red/amber/blue),
  `@theme inline` semantic aliases, `:root` semantic tokens (var()-chained to primitives),
  `@layer base`.
- **Already complete semantic categories:** surface, text, border, price, status
  (success/warning/danger/info), action (=cta), promo, plus component/z-index/control/disabled/
  focus/motion tokens.
- **Gaps:** `brand` (only via primitives), `error` alias (use `danger`), `overlay`/scrim
  (hardcoded). `promo` and the shadcn vocabulary have since landed (§4.1, §4.2).
- **Two distinct issues — do not conflate:** (a) a token name that is _used-but-undefined_
  renders colorless and has to be defined or mapped (the shadcn names were this and are now
  mapped); (b) `status-*` tokens are _defined-but-unused_ in places → fine, migrate raw palette
  literals to them when a component is touched.
- **Stale/misleading:** `src/styles/README.md` describes a hex `--background`/`.dark`
  system that does not exist in `brand.css`; `src/app/api/og/route.tsx` ships those stale
  hex values (Satori can't read CSS vars). Reconcile before declaring "code canonical".

## 13. Build / deploy safety (ops)

Production `maky.store` is served by **PM2** process `maky-storefront` (`npm start` =
`next start -p 3000`, cwd `/opt/storefront`), proxied by nginx
(`/etc/nginx/conf.d/storefront.conf` → `proxy_pass 127.0.0.1:3000`; once nginx has been
prepared for the bridge flow, §13.2.1, that line names the group `maky_storefront` instead). It serves the
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

The deploy script keeps this rule by never building there: it builds in a scratch tree
(`/opt/storefront-build`, §13.2), so the live `.next` is only ever replaced while the process
that served it is stopped.

### 13.1.1 A command that changes production must show its effect

A script is fine; the deploy itself runs as one (§13.2). What a script must not do is hide what it
changes or get around a refusal. Before it runs, its effect, its scope (which paths, which processes,
which data) and the permissions it runs with must be clear from the command and the file it runs, and
it is never used to take a step that a permission rule or a hook has already refused. If a rule refuses
a step you are entitled to take, deal with that rule or ask for the permission; a different wrapper
around the same step is not the permission.

Why this exists: on 2026-09-21 a long catalogue run was started as
`setsid nohup bash /tmp/.../step13_2_second.sh`. No prompt appeared because the permission rule matched
the wrapper and not what was inside it, the run took the box to load 40 with swap full, and `setsid` had
detached it from the one session that was watching it. What went wrong was an effect nobody had agreed
to, hidden in a file, and a long run nobody could see.

A run too long to sit in the foreground stays in front of a session that watches it, or it becomes a
systemd unit with `MemoryMax` and no swap, installed and started by a human. It is not detached with
`setsid` or `nohup`.

Routine diagnostics (logs, status, `--dry-run`, the smoke test in §13.5) and a rollback inside an
assigned deploy (§13.3) need no further go-ahead.

### 13.2 Production deploy — run the script, not the steps

```bash
cd /opt/storefront
./scripts/ops/deploy-production.sh --dry-run                    # preflight, the plan, changes nothing
./scripts/ops/deploy-production.sh --rehearse                   # build aside, gate it on a spare port, switch nothing
./scripts/ops/deploy-production.sh -m "why this is going out"   # the deploy
```

Manual deploys are forbidden. The script exists because the order of the steps is what
makes them safe, and five steps in the wrong order is exactly what an agent or a tired
human gets wrong at 23:00.

**The build is made beside the live site, never under it.** The script exports `HEAD`
(`git archive`) into a scratch tree, `/opt/storefront-build`, copies `node_modules` and `.env`
into it and builds there at `nice -n 10`. `maky-storefront` keeps serving for the whole build, and
nothing writes to the `.next` it serves, so §13.1 is never in play. It then switches in one of
three ways (`--mode`, default `auto`):

| mode      | what customers meet                                                 | needs                                 |
| --------- | ------------------------------------------------------------------- | ------------------------------------- |
| `bridge`  | no gap: they are served by a verified copy while the live one swaps | nginx prepared once (§13.2.1)         |
| `restart` | a gap of the few seconds the server takes to boot                   | nothing                               |
| `classic` | 3 to 4 minutes of 502: stop, build in place, start (the old flow)   | nothing — the emergency fallback only |

`auto` is `bridge` when nginx has been prepared and `restart` otherwise; `--dry-run` says which and why.

The bridge flow, in this order:

```
lock        flock — Claude, Codex and a human share this box; two deploys must not race
preflight   memory, disk, clean tree, tests, current BUILD_ID + its sha, NEXT_OUTPUT unset,
            sudo, PM2 app, nginx state (canonical-only), spare port free
secrets     copy the keys other systems issue from AWS SSM into .env (§13.9) — warn-only
scratch     /opt/storefront-build: git archive HEAD, node_modules, .env
build       pnpm build there; the log is teed to a file; the finished build must carry its own
            path only in required-server-files (§13.8)
metadata    write .next/MAKY_DEPLOY_META (git sha, build id, timestamp); keep a clean copy of .next
bridge      the same build on 127.0.0.1:3100 as a second PM2 app, maky-storefront-bridge, started
            like the live process (`next start -p 3100`, no `-H`, see §13.2.1) in a clean
            environment, logging to files of this run (/tmp/maky-deploy-<UTC>.log.bridge-out
            and .bridge-err, which stay); the whole gate runs on it while nobody is sent there
show        what the gate cannot see, read from the bridge before anyone is sent to it: the category
            list it read from Saleor (`[live-categories] … loaded=yes`, when the build has the
            module) and the catalogue release it took from CFM (`/api/catalog/status` shows what
            the live process shows, or newer) — see "What the bridge has to show" below
flip        nginx-upstream.sh set bridge-primary: nginx -t, graceful reload, a request through
            nginx's loopback listener must be answered by the bridge; then the public path too
swap        wait for the requests the live process holds, pm2 stop maky-storefront,
            sudo mv -T .next → rollbacks/.next.rollback-<prev-sha>-<prev-BUILD_ID>-<UTC>,
            the clean copy → .next, register maky-storefront afresh (pm2 delete, then pm2 start from
            a clean environment, see §13.2.1), wait for the port to answer, say what it was started with
─────────── the commit point ────────────────────────────────────────────────────
gate        127.0.0.1:3000 — the same gate as on the bridge, now on the live process
types       the GraphQL types the build generated go into /opt/storefront/src, where the next
            preflight imports them from (build output, ignored by git)
release     customers stay on the bridge until the live process serves the catalogue release the
            bridge serves, up to CATALOG_PARITY_WAIT_S — warn only
back        nginx-upstream.sh set canonical-only, wait for the bridge's requests, pm2 delete the
            bridge, remove the scratch tree
verify      nginx via --resolve, then the public URL — retried, warn only; the live process's own
            category read-back
log         append a block to /opt/DEPLOYMENTS.log, with what customers saw during the switch
prune       keep the newest 2 snapshots plus any pinned with a sidecar .keep
```

`restart` is the same without the bridge and the two nginx steps: the finished build is swapped in
and the gap is the stop-to-answer in the middle. `classic` is the original sequence: stop, snapshot,
build in place, start, gate. In all three the live process is started by registering it afresh (§13.2.1).

**What the bridge has to show before customers are sent to it.** The gate looks at pages and files.
Two things it cannot see are decided by the environment the process starts in, and the bridge starts
clean (`env -i`), so both are read back from the bridge itself, in the files its own log goes to:

- **The category list.** At boot the server reads the category list from Saleor and prints one line,
  `[live-categories] floor=30 live=0 refused=0 loaded=yes` (storefront PR #28; a build without
  `src/lib/live-categories.ts` is not asked). `no Saleor endpoint configured` means
  `NEXT_PUBLIC_SALEOR_API_URL` did not reach the process (`.env`), and `loaded=no` is a Saleor that did
  not answer within the few seconds boot waits for it: the build's own 30 categories still answer, so
  nobody would see a fault, but it is not the list the deploy meant to ship. The check nudges the
  server's retry with a request and accepts `loaded=no` followed by `Saleor answered again`, for up to
  `CATEGORIES_WAIT_S` (45). `refused=N` is reported, not failed: Saleor holds N categories the server
  will not route at the root, and the log names them.
- **The catalogue release.** CFM publishes the catalogue text per market and the fitment dataset
  through a release manifest, and each process takes the files in the background after boot, from its
  cache and then from the network (SYNC-1). CFM calls a release adopted only when every expected
  live process reports the same file on `/api/catalog/status`; the bridge is not one of them (its PM2
  name differs), but customers are on it while the live process swaps and passes the gate (182 s on the
  first deploy, 2026-10-06). So before they are sent there it has to
  serve what the live process serves from the manifest, or newer, for each market and for fitment,
  for up to `CATALOG_PARITY_WAIT_S` (90). A bridge that does not follow the manifest at all while the
  live process does (`MAKY_RELEASE_MANIFEST_URL` missing from its environment) fails at once, since
  waiting cannot fix it. A live process that serves no status, or serves the manifest as off, leaves
  nothing to compare. After the swap the same comparison runs the other way round and only warns:
  the live process on the new build is given the same time to catch up before customers go back to it.

Either failing is a failure before anyone was moved: the bridge and the scratch tree go, and the live
process was never touched. What the bridge wrote is the evidence, so its log files stay and the exit
handler prints their names and their last lines. A process that does not answer the readiness probe is
reported with what it did answer, first probe and last (the code, where a redirect points, a transfer that was
cut off, or no connection at all), and a bridge also with its state as PM2 sees it, whether its port takes
connections and the headers of one more request: the first `--rehearse` on the box ended on "did not answer
within 120s" and nothing else, and the cause was a redirect to itself. `--rehearse` runs both. The live process's
own category read-back is a post-commit step like the market-state read-back (exit `75` names it).

**Everything before the gate rolls back on failure. Nothing after it does.** Until nginx points at
the bridge a failure changes nothing a customer can see: the bridge and the scratch tree are removed
and the live process was never touched. After it, a failure puts the snapshot back, starts the live
process on its old build and only then moves customers back — in that order, so nobody is moved onto
a process that is not up. If the live process cannot be brought back, customers stay on the verified
bridge and the message says so and what to run (§13.2.1). Once the artifact is serving correctly on
`127.0.0.1:3000` it stays: a failed log write, a pruning error, a network blip on the public check or
nginx refusing to take customers back from the bridge is a post-deploy problem, not a reason to
throw away a verified build. The script exits `75` and names the step.

Only the artifact's own behaviour is in the rollback gate. If nginx or public DNS is broken,
swapping the build back does not fix it, so those checks report and do not revert. Exit codes: `0`
deployed, `1` failed and rolled back, `70` internal state error, `71` the deploy failed **and** the
restore failed (the site may be down; in bridge mode it may instead be running on the bridge, and
the message says which), `75` deployed but a post-deploy step failed.

**What customers met is measured, not claimed.** From just before the first step that could affect
them to just after the last, one request every 0.5 s goes through nginx's loopback listener (bridge)
or `LOCAL_URL` (the other flows). The output and `/opt/DEPLOYMENTS.log` carry the result as
"N of M probe requests failed", with the longest failing stretch when there is one.

Budget: the build time (a few minutes of waiting for whoever runs it, none for customers), then
the switching, during which customers are on the bridge. Measured on the first bridge deploy
(2026-10-06): 7 min 24 s from start to exit, of which `maky-storefront` itself was swapped in 182 s
behind the bridge, and 0 of 331 probe requests failed. `restart` costs customers the few seconds of
the swap, `classic` the old 3 to 4 minutes (197 to 206 s of 502 measured before the bridge).

`--rehearse` is the dress rehearsal: it builds aside, runs the build on the spare port, passes it
through the whole gate and removes everything again. It switches nothing and touches neither the
live process, nor nginx, nor the deployment log. Run it first on a box that has never done a bridge
deploy, and after anything that changes the build or its dependencies.

Two deliberate omissions. There is **no `--allow-dirty`**: a deploy from an uncommitted
tree would write a `git_sha` into `MAKY_DEPLOY_META` that does not describe what was
built, which defeats the point of recording it. Commit first, even for a hotfix. And
preflight demands ~10 GB of free memory — the build itself peaks under 1 GB, so this is
really an interlock against deploying while an agent is holding several gigabytes. Override
it per-run (`MIN_FREE_MEM_MB=6144 ./scripts/ops/deploy-production.sh`) rather than lowering
the default, until a real cgroup `memory.peak` has been measured across a few deploys.

**A new build starts with a cold `.next/cache`.** That is load-bearing, not hygiene: on the CMS
pilot cutover a warm `fetch-cache` baked a pre-cleanup CMS document into the build and shipped a
duplicated company block. Content changes in the CMS must precede the build, and the build must not
inherit the old fetch cache. The scratch tree starts empty, so it does not.

### 13.2.1 The bridge: nginx, prepared once

`proxy_pass 127.0.0.1:3000` names one address, so nginx has to be prepared once before the bridge
flow can run. `scripts/ops/nginx-upstream.sh` does it and owns everything nginx-related afterwards:

```bash
./scripts/ops/nginx-upstream.sh status             # absent, canonical-only or bridge-primary
./scripts/ops/nginx-upstream.sh setup              # dry run: the diff and the new file, changes nothing
./scripts/ops/nginx-upstream.sh setup --apply      # backs storefront.conf up, installs, nginx -t, reload, checks
```

`setup --apply` edits `/etc/nginx` once, so it belongs to rolling this procedure out and is not run
casually. It is reversible: `revert --apply` puts the backed-up `storefront.conf` back and removes
the managed file.

What it installs: `storefront.conf` changes in one line, to `proxy_pass http://maky_storefront;`, and
`/etc/nginx/conf.d/maky-storefront-upstream.conf` holds the group `maky_storefront` plus a
loopback-only listener (`127.0.0.1:3199`) that goes through the same group and answers with
`X-Maky-Upstream`, so the deploy can see which process a request reached. The group has two states:

```
canonical-only   server 127.0.0.1:3000;                           the resting state: what nginx did before
bridge-primary   server 127.0.0.1:3100;
                 server 127.0.0.1:3000 backup;                    the window while the live process swaps
```

The `backup` line is the safety net: if the bridge dies while it is in front, nginx falls back to the
live process by itself. Every change is `nginx -t`, a graceful reload (a request already in flight
finishes on the process that took it), and then a request through the loopback listener that must be
answered `200` by the process the new state names. If any of it fails the previous file is put back
and the tool says whether it could prove that (exit `1`) or that nginx may be in an unknown state (exit `2`).

By hand, which is for recovery only (a deploy does all of it):

```bash
./scripts/ops/nginx-upstream.sh set canonical-only    # customers back on the live process; also the repair for a
                                                      # run that died between writing the file and the reload
./scripts/ops/nginx-upstream.sh set bridge-primary
./scripts/ops/nginx-upstream.sh revert --apply        # the original storefront.conf, the managed file removed
```

A deploy refuses to start while nginx says `bridge-primary`: an earlier one did not finish. Two
recoveries are printed by the script itself when they are needed:

- **Exit 71 with customers on the bridge** (the live process would not come back): repair it
  (`pm2 logs maky-storefront --nostream --lines 50`; `pm2 start maky-storefront` when PM2 still lists
  it, otherwise the registration the message prints, `pm2 delete maky-storefront; env -i HOME="$HOME"
PATH="$PATH" pm2 start npm --name maky-storefront --cwd /opt/storefront -- start -- -p 3000`), check that
  `curl -fsS 127.0.0.1:3000/sk` answers, then `set canonical-only`, `pm2 delete maky-storefront-bridge`,
  `sudo rm -rf /opt/storefront-build` (`/opt` is root's, so a plain `rm -rf` leaves the emptied directory behind).
  Until then `/opt/storefront-build` is what the bridge serves from.
- **Exit 75 with "customers are still on the bridge"** (nginx would not take them back): the same last
  three commands, once nginx will reload.

What differs from a plain restart, and is accepted:

- **Version skew at the first flip.** A customer who loaded a page from the old build and asks for its
  chunks just after the flip meets the new build, as in any deploy. There is none at the flip back: the
  same artifact (same BUILD_ID, chunks and server-action keys) runs in both processes.
- **Per-process caches.** A `/api/revalidate` that reaches nginx between the live process's start and
  the flip back updates only the bridge, so the few pages the gate warmed on the live process can stay
  stale until the next revalidation. The window is the length of the gate, and publishing the document
  again closes it.
- **The bridge listens on every interface** for the minutes it runs, as the live process does on its port all
  the time: it is started the way that process is, `next start -p <port>`, with no `-H`. `-H 127.0.0.1` would keep
  it on loopback and does not work: Next hands the proxy a URL whose host it has turned from `127.0.0.1` into
  `localhost`, and calls a rewrite internal only when its origin equals the one built from `-H`, so `/sk` →
  `/sk-eur` became a request to the bridge itself and every market page answered a 301 to its own address (the
  first `--rehearse`, 2026-10-06; reproduced on a minimal app with the same Next 16.3.6, where no `-H` and
  `-H 0.0.0.0` answer 200). Do not put `-H` back. Whether a port is reachable from outside is the security
  group's doing and cannot be read from the box: 3100 has to stay closed there, as 3000 should be.
- **The image cache starts cold twice** (bridge, then the live process), where a restart did it once.
- **A process that has just started takes the catalogue release in the background.** Until it has, it
  serves the older `MAKY_CATALOG_CONTENT_*` files. That is what the release check above is for: the
  bridge is not used until it serves what the live process serves, and the live process on the new
  build is waited for before customers go back. If it does not catch up within the wait, customers go
  back anyway (the build is verified and live) and CFM reads its status until it has adopted.
- **Both processes are registered from a clean environment, at every deploy.** `pm2 start` keeps, with the
  process, the environment of the shell that registered it, and `pm2 stop` / `pm2 start <name>`, which this
  deploy used to end with, start it again from that record unchanged. The live process had been registered
  (and, going by the runbooks of the time, restarted with `--update-env`) from an agent's interactive SSH
  session, so its record carried that session's environment, tokens included, through every deploy. Found by
  the first bridge deploy (2026-10-06, names only, values never read): 153 variable names in the process, 28
  of them from agent sessions (`CLAUDE_CODE_*`, `CLAUDE_*`, `ANTHROPIC_BASE_URL`, among them a messaging
  token). A value stored with a process also wins over `.env`, because Next does not overwrite a variable
  that is already set.
  - **What was read on the box** (2026-10-06 20:22 UTC, names only, values never printed). The one PM2 record
    of `maky-storefront` (`fork_mode`, node running `/usr/bin/npm start -- -p 3000` in `/opt/storefront`, logs
    in `~/.pm2/logs`, no other options) held 83 names, a copy of the environment of a whole interactive SSH
    session: the 28 above plus `HOME`, `PATH`, `TMUX`, `SSH_*`, `VSCODE_*`, `MCP_*` and the like. Of `.env` it
    held only `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN` and `NEXT_PUBLIC_GTM_ID`, with the values `.env` has. The
    PM2 daemon and `~/.pm2/dump.pm2` are clean (no session names; the dump holds `maky-storefront` and
    `maky-smtp-app`, and `pm2-ubuntu.service` is enabled), so a reboot of the box starts the app clean. The 30
    names of `.env` that are not in `/proc/PID/environ` are no fault: Next reads `.env` itself, inside the
    process.
  - **What the deploy does now.** In the swap it takes the old record away (`pm2 delete maky-storefront`,
    while the bridge holds customers) and registers the process again with
    `env -i HOME PATH LANG [PM2_HOME] pm2 start npm --name maky-storefront --cwd /opt/storefront -- start -- -p 3000`,
    keeping the log paths of the record it replaces so that the market read-back still reads the file the
    boot wrote to. That is the record that was read (fork_mode, node, `npm start -- -p 3000`, the directory,
    the logs) without what the SSH session added. The bridge is registered the same way. Everything the app is
    configured with is in `.env`, which Next reads itself. The deploy that first does this resets the restart
    counter and the uptime PM2 shows. If PM2 will not delete the record the deploy stops there and rolls
    back; if the restore cannot register it either, it falls back to the record PM2 holds (a live process
    whose environment is not clean is better than none).
  - **What it says about it.** After each start one line per process, read from `/proc/PID/environ`, names
    only: `environment of <app> (pid N): K names, none looks like a credential, none hides a value of .env`,
    or a warning that names (never values) those that look like credentials (`CLAUDE_*`, `ANTHROPIC_*`,
    `*TOKEN*`, `*SECRET*` and the like) and are not `.env`'s, and those `.env` defines too, whose stored
    value wins. Warn-only. The preflight warns the same way about names the shell the deploy runs in
    exports and `.env` defines too, because the shell's value wins in the build. Whether the environment of
    the PM2 daemon leaks into what `env -i pm2 start` registers was measured on the first deploy with this
    registration (2026-10-07, `5f2ad3c`): the new record held 9 names (`HOME`, `LANG` and `PATH` from `env -i`,
    and `NODE_APP_INSTANCE`, `PM2_HOME`, `PM2_USAGE`, `PWD`, `unique_id` and the app name, which PM2 adds itself)
    and the process 77 (25 `npm_*` and 52 more: PM2's own record fields, npm's `COLOR`, `EDITOR`, `INIT_CWD`,
    `NODE`, `NODE_PATH`, and the names above), none from a session and none flagged. The count follows the PM2
    and npm versions, so nothing pins it. The script reports and does not filter.
  - **What it does not do: `pm2 save`.** That writes `~/.pm2/dump.pm2`, which `pm2 resurrect` reads, and the
    dump is clean today, so nothing needs it. It must never run before the live process is registered
    afresh (it would write the old record into the dump) and never while the bridge exists.
  - **Rule: never `pm2 restart ... --update-env` for this app.** It adds the whole environment of the calling
    shell to the record and never removes a name. An `.env` change needs only `pm2 restart maky-storefront`:
    Next reads `.env` itself when the process starts. A variable that must reach the process goes into `.env`,
    never into the shell that restarts it.
  - **To find the live server process, use its working directory, not its name.** `maky-smtp-app` runs a
    `next-server` too (Next 15), so `ps ... | awk '/next-server/'` takes both. Next sets the process title
    `next-server (v16.x)`, which makes `/proc/PID/comm` start with `next-server`; the live one is the one
    whose `/proc/PID/cwd` is `/opt/storefront` (`server_pid_in` in the script does exactly this).
- **A relative `*_PATH` or `*_DIR` in `.env`** resolves against the bridge's working directory. The
  preflight names such variables, never their values.
- **The build competes for CPU** with the live process; `nice -n 10` gives the live process the first claim.

### 13.2.2 Changing the deploy scripts

`deploy-production.sh` and `nginx-upstream.sh` have a regression suite that runs them for real:
`pnpm test:deploy-box`, about eight minutes (89 cases). It is not part of `pnpm vitest run`, which the deploy
preflight runs on the live box before every deploy.

The suite builds a whole box in a temporary directory (`src/lib/__fixtures__/deploy-world`): a git
checkout with a live `.next`, a `pm2` that really starts and stops web servers which serve the tree
they were started in, an nginx that reads the same two files and routes by the group it last loaded
(a reload takes effect a moment after it returns), a `pnpm` that "builds", and an app that writes into
the tree it serves as `next start` does. Nothing is mocked inside the scripts. What is asserted is what
a customer would have met (two clients ask for the home page all the way through) and what the box looks
like afterwards, for the deploy that goes well and for a failure at every step that can fail: the build,
the relocation audit, the gate on the bridge, nginx refusing the switch, the swapped-in build failing its
gate, the restore failing (exit `71`), nginx refusing to take customers back (exit `75`), and the refusals
that come before anything is changed. A bridge that is not ready has its own cases, one for each way it can
answer (a 500, a redirect, a redirect to the very address asked, a transfer cut off after its 200, a port nobody
listens on), and the fixture's app answers a market page with the redirect to itself when it is started with
`-H 127.0.0.1`, as Next 16.3.6 did on the box, so a `-H` put back into the bridge's start line stops the deploy
there. The read-backs have their own cases: the category list (loaded, loaded
after a retry, never loaded, no endpoint, refused slugs), the catalogue release (the bridge behind and
catching up, behind for good, behind on fitment only, not following the manifest, behind after the swap)
and the GraphQL types handed over after the commit point and not before. The fixture's `pm2` keeps, as the real
one does, the environment of the shell that registered a process and starts it again from that record. Its live
process was registered from a shell that exported an agent session's variables, so the cases for the clean
registration see them go (in the bridge, restart and classic flows), the log paths of the old record kept, a
daemon whose own environment leaks into what it starts, a `maky-smtp-app` with a `next-server` of its own, and PM2
refusing to delete the old record.

What it cannot show is how the real nginx and PM2 behave; that is what `--rehearse` and the first deploy
on the box are for. A new failure path gets a case here. To see that a case really guards its behaviour,
break a copy of the script on purpose and point the suite at it:
`DEPLOY_SCRIPT_UNDER_TEST=/path/to/broken-copy.sh pnpm test:deploy-box`.

### 13.3 Snapshots and rollback — never `cp -al`

`/opt/storefront-rollbacks/` is `root:root`, so every move into or out of it needs
`sudo mv`. Deliberate: an agent working in `/opt/storefront` cannot delete the rollbacks
by accident.

- **Out (deploy):** `sudo mv -T .next /opt/storefront-rollbacks/.next.rollback-<prev-sha>-<prev-BUILD_ID>-<UTC>`
- **Back, automatic** (the deploy just failed): `sudo mv -T <snapshot> .next`. That
  snapshot is the artifact this run displaced seconds ago, nothing else refers to it, and
  `mv` is instant. The script does this itself, with the live process stopped first and
  started again after, and in bridge mode customers are moved back only once it answers.
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

A build that fails in the scratch tree changes nothing a customer can see: the live process was
never touched, the scratch tree is removed, and the log is at `/tmp/maky-deploy-<UTC>.log`. What
follows is for `--classic` and for anything done by hand.

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
point and only warn (§13.2). In bridge mode the gate runs twice: on the bridge
(`127.0.0.1:3100`) before any customer is sent there, and on the live process after the swap.

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

### 13.8 Building aside and moving the build — why it is safe

A finished build names its own location in exactly two files, `.next/required-server-files.json`
and `.next/required-server-files.js` (`appDir`, the tracing root, the Turbopack root). Everything
else in `.next` is relative, so moving the build is a `mv -T` plus rewriting those two files. The
script does both and then proves the result instead of assuming it:

- `audit_relocatable` searches the finished build (source maps and `cache/` left out) for the scratch
  path and refuses the deploy if it is in any file other than those two;
- `rewrite_build_paths` rewrites the two files after the move (the JSON is parsed again, the write is atomic);
- the whole gate runs on the moved build, on the live process, before the commit point. If a moved
  build does not work, that is where it shows, and the snapshot goes back.

How it was established: a synthetic Next 16 app with `cacheComponents` and Turbopack, as in production,
was built in directory A, moved into B at the same sha and served from B; the real production artifact has
the same structure (read off the box, 2026-10-06). No run away from the box can show how its nginx and PM2
behave, so on a box that has never done a bridge deploy the first step is `--rehearse` (§13.2), and the
first bridge deploy is watched.

The same facts decide what the scratch tree must be: the commit as git has it (`git archive HEAD`, so
`MAKY_DEPLOY_META` describes what was built), a **copy** of `node_modules` (the script never installs;
preflight already refuses a tree whose lockfile differs from what `node_modules` was installed from)
and `.env`, on the same filesystem as `/opt/storefront` so that installing the build is a rename.

### 13.9 Secrets another system issues come from AWS SSM — never by hand

A key that another system issues for the storefront (today: the CMS's `preview-reader` key,
`PAYLOAD_PREVIEW_API_KEY`) reaches this server through AWS SSM Parameter Store — never through a
chat, a repository, a log or a person copying it (owner, 2026-09-26).

- The issuer writes a SecureString under `/maky/storefront/<issuer>/…`; `scripts/ops/sync-secrets.sh`
  copies the mapped ones into `/opt/storefront/.env` — atomically, mode 600, the previous file backed
  up outside the repo, values never printed. Exit `10` means `.env` changed: restart PM2 (a
  server-side variable needs no rebuild). `deploy-production.sh` runs it on every deploy, before
  the stop (a dry run only reports), so a rotated key is picked up by the next deploy on its own;
  between deploys, run the script and restart PM2.
- Access (IAM inline policies, set in CloudShell): `maky-ec2-ssm-role` (this server) reads
  `/maky/storefront/*`; `maky-cms-role` writes `/maky/storefront/cms/*` only.
- Only the parameters listed in the script's `MAPPINGS` are copied, each onto one variable, so an
  issuer can never override any other setting. A new secret = a reviewed `MAPPINGS` line, the issuer
  writes the parameter, the script runs, PM2 restarts.
- No other system gets write access to this repository for a hand-over (no deploy keys): code comes
  as a branch in its own repo, which this server can read, and is reviewed, merged and pushed here.
