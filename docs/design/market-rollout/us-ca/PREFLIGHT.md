# US/CA — preflight, written after the package arrived

`ZADANIE.md` said this file would be written by the thread that actually receives the
bundle, not guessed in advance. This is that file. It records what arrived, what was
verified, and the four facts that changed how the implementation was written.

## The bundle

|                    |                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------- |
| File               | `/home/ubuntu/maky-podklady/MAKY_STORE_US_CA_preklad_a_implementacia_2026-09-09.zip`   |
| SHA-256            | `ae6ec6e3be577cb82de5faa9d9c50f0ca61d59cf2136a04071607f9235fec2b8` — matches the brief |
| Entries            | 91 — one top-level directory, no absolute paths, no `..`, no symlinks                  |
| Manifest           | `MANIFEST.json` (uppercase, unlike ES/RO), 90 files listed, **90/90 SHA-256 verified** |
| Supplied validator | `scripts/validate_bundle.py` → **414 passed, 0 failed**                                |

The archive was inspected for traversal and symlinks with an independent script **before**
extraction, and the manifest re-verified with a second independent script rather than
trusting the validator's own report. `selfExcluded: true` accounts for the 91st file being
the manifest.

The bundle names `8bd1c6cc26adf0b79abcc28c5203f2efa9b44a82` as its `referenceGitHubHead`,
which is the ES/RO tip this branch is built on. `git ls-remote` confirmed that branch still
stood at exactly that SHA, and `578c33b` (this worktree's starting point) is its ancestor,
so the branch fast-forwarded. No reset, no rebase, no force.

## Four things that changed the implementation

### 1. The negative fixture had nowhere left to go — the real work of this thread

`us` and `ca` were the last two markets in `CHANNEL_MAP` without approved copy, and five
assertions across four files depended on there being one. Registering English removes the
last of them.

This is written up in full in `uncovered-market.testkit.ts` and the registration commit.
The short version: the fixture now synthesises a market inside a test-only mock instead of
borrowing a real untranslated one, so it tests the mechanism rather than the accident of
which language is late. It was falsified in both directions before being trusted.

### 2. The two markets share most of their prose, and that is correct

The delivered US and Canadian pages are word-for-word identical over most of their length.
The package says so explicitly and warns that a test must not demand every string differ.
So each page is one shared component with the market's own text passed in, and the
withdrawal-copy test pins the shared set **as shared** rather than requiring difference.

The differences are law, not wording, and they point both ways — the FTC shipment rule
binds in the US and not in Canada; the FTC three-day Cooling-Off Rule must be _denied_ on
the US page because it does not reach online purchases; Canada's provincial rights and
Quebec's reasonable-durability rule have no US counterpart. Two are single letters —
`canceling`/`cancelling`, `inquiries`/`enquiries` — which is exactly why they are
parameters and never written into shared prose.

### 3. `showPickupInterest: false`, and the copy has to say so

`data/form-capabilities.en-{US,CA}.json` are editorial rules for R, not runtime config.
The `pickupInterest` key is kept so the object stays structurally like the other nine
languages; the delivered `pickupHelp` says in the customer's words that routine pickup is
not offered. The guard test asserts that sentence, not the flag.

The related trap is named in the R handoff and repeated here: the existing SK contract uses
`returnMethod: merchantPickup`, and a customer shipping the parcel themselves **must not**
be recorded under it.

### 4. The cookies page named a control that does not exist

The delivered copy tells the reader to return to a named control in the footer — and names
it **differently in each market**: "Privacy choices" for the US, "Privacy preferences" for
Canada. The footer renders neither. `footer.privacySettings` is **"Privacy settings"** in
both `en-US.json` and `en-CA.json`.

This is the same defect class as the inert `data-maky-component="privacy-settings"` marker
the package itself tells us to replace: it reads fine and does not work. The implemented
pages use the real label. The delivered names, and the fact that the package gives two
names to one shared control, are an item for M below — not something to settle by editing
footer chrome from a legal-copy thread.

## Verified in the delivered files

- **`metaTitle` carries ` | MAKY.STORE`** in all 16 delivered page records, as warned —
  stripped before `formatPageTitle`. Confirmed on all 96 rendered URLs: the suffix appears
  exactly once on every one.
- **Currency does not cross**: the US pages say `US dollars (USD)` and never mention CAD;
  the Canadian pages say `Canadian dollars (CAD)` and never mention USD. Confirmed in the
  rendered output, and the header currency selector shows USD on `/us` and CAD on `/ca`,
  read from `CHANNEL_MAP` rather than from any body.
- **`CHANNEL_MAP` already matched the brief** — `us → us-usd/USD/en-US/US`,
  `ca → ca-cad/CAD/en-CA/CA`. Nothing in it was changed.
- **The recipients table has two columns**, as in ES/RO. The prose under it says why. No
  third column of invented legal basis was added.
- **The four shipping states** in `pokyny-podla-zvozu.*.json` are editorial variants, not
  API enums. They are handed to R untouched.

## Deliberately not in this branch

`o-nas` is CMS. The bodies are in `o-nas.us.md` and `o-nas.ca.md` for M; `/us/o-nas` and
`/ca/o-nas` both 404 today, exactly like the other nine non-Slovak markets. A code
bootstrap is not CMS publication and no second static source was created.

`privacyHref` and the `formExtras` block are in the delivered JSON but are not fields of
`WithdrawalCopy`. They are recorded for R rather than bolted onto a shared type this thread
does not own.

The US privacy page does **not** decide whether any particular state statute covers MAKY.
The delivered copy says the rights depend on "the state law that applies and whether its
coverage conditions are met", and that is what shipped. Writing a confident "we never sell
or share" would have pre-empted M's item with an unverified claim.
