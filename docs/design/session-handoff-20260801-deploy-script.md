# Session handoff — 2026-08-01, deploy script and §13

Written by a Claude Code session running **off-box** (claude.ai/code cloud container, a
fresh `git clone`, no SSH and no AWS). Everything below is either verified from the repo,
verified over public HTTP, or explicitly marked as coming from someone else's pasted
terminal output. The distinction matters — this session got several things wrong early by
reading container output as if it came from the server.

The next session should run **on the box** (`ssh maky-nextjs`, or `claude` in a terminal
already connected there). Three things are waiting and all of them need a shell on
`/opt/storefront`.

---

## 1. Do this first

### 1.1 Fix the pin marker — before any deploy

A `.keep` file currently sits **inside** `.next.rollback-b6b633da-JAODjLtaigo1DL9m6h614`.
That was this session's earlier advice and it was wrong: a restore moves the snapshot's
contents into the live tree, so the marker rides along and the next deploy carries it into
the _new_ snapshot — pinning the wrong build and leaving the CMS-pilot rollback exposed to
pruning. The marker must be a sidecar.

```bash
sudo rm -f /opt/storefront-rollbacks/.next.rollback-b6b633da-JAODjLtaigo1DL9m6h614/.keep
sudo touch /opt/storefront-rollbacks/.next.rollback-b6b633da-JAODjLtaigo1DL9m6h614.keep
```

### 1.2 Merge the ops work

`claude/frontend-status-check-ieb0oj` is based on `db1aba3` and is a clean fast-forward
(verified). It touches only `CLAUDE.md` and `scripts/ops/deploy-production.sh` — nothing
that reaches a build.

```bash
cd /opt/storefront
git fetch origin
git merge --ff-only origin/claude/frontend-status-check-ieb0oj
git push origin feat/cms-m2
```

### 1.3 Dry run

```bash
cd /opt/storefront
./scripts/ops/deploy-production.sh --dry-run
```

Two things it will print that are **not** faults:

- the snapshot name will contain `unknown` instead of a sha, because the live `.next` from
  1 Aug has no `MAKY_DEPLOY_META`; the first scripted deploy creates one
- preflight may stop on `only NNNN MB of memory available` if an agent is running. Override
  for that run only — do not lower the default:
  `MIN_FREE_MEM_MB=6144 ./scripts/ops/deploy-production.sh --dry-run`

### 1.4 Then, as a separate command, the first real deploy

Not appended to the dry run. The first live run should be this ops-only commit — no
withdrawal form, no other functional change.

```bash
./scripts/ops/deploy-production.sh -m "first scripted deploy: ops tooling only"
```

---

## 2. What is on production right now

```
instance   m9g.xlarge (4 vCPU, 15 GiB), i-055e78d2d862175ed, eu-central-1b
branch     feat/cms-m2 @ db1aba3
BUILD_ID   CInTIHi97tjA3HE3gKOY4   built 1 Aug ~11:32 UTC
PM2        maky-storefront (:3000), maky-smtp-app — both online
swap       4 GiB, swappiness 10
```

Instance/PM2/swap facts come from Marek's pasted terminal output, not from this session.

**M.2 is live.** Production moved from `b6b633d` (CMS pilot) to `db1aba3`, which is all
sixteen M.2 commits: seven v2 block renderers, the new `/sk/poradna` route, contract
boundary enforcement, the four silent-degrade fixes, slug identity, `fallback-locale=none`,
unknown-Lexical-node handling, and the restored production image hosts.

Verified over public HTTP from outside on 1 Aug:

```
/sk                     200  MAKY.STORE
/sk/o-nas               200  O nás | MAKY.STORE
/sk/poradna             200  Ako vybrať strešný nosič | Poradňa MAKY.STORE
/sk/obchodne-podmienky  200  Všeobecné obchodné podmienky | MAKY.STORE
```

`/sk/poradna` is serving a real CMS document, not the bootstrap fallback.

**But it went out without the acceptance gate.** The 30 Jul handoff said "stop before
deploying" for M.2; PR #1 (`feat/cms-m2` → `feat/cms-o-nas-pilot`) is still an open draft,
and there is no cutover record for M.2 the way there was for the CMS pilot. The deploy
happened as a side effect of measuring build memory. The code itself is verified — see §3 —
but somebody should decide whether M.2 gets a retrospective step-7 style gate.

`db1aba3` differs from `f7f7f97` only in `.gitignore` and `.vscode/settings.json`, so the
unplanned rebuild was content-identical to the intended one.

---

## 3. Code health, verified this session

Run in an isolated worktree at `feat/cms-m2`, with GraphQL types generated against the demo
instance the CI uses (`storefront1.saleor.cloud`), because this container has no `.env`:

| check          | result                                         |
| -------------- | ---------------------------------------------- |
| `vitest run`   | 615/615 passed, 39 files                       |
| `tsc --noEmit` | clean                                          |
| `eslint`       | 0 errors, 6 warnings — the documented baseline |
| `i18n:check`   | commerce closure OK, locale matrix OK (12)     |
| `next build`   | passed                                         |

Two limits on that: types came from the demo instance, not `api.maky.store`, so this proves
code/types/routes and not catalogue data; and `next build` passing does not certify tokens
(§12 — Tailwind v4 emits nothing for an undefined `--color-*`).

---

## 4. What this session changed in the repo

Branch `claude/frontend-status-check-ieb0oj`, three commits over `db1aba3`:

```
354ee13  ops: make the production deploy a script, and rewrite §13 around it
616ff15  ops: fix the deploy script's transactional boundary, and lock it against races
9451697  ops: probe sudo with `sudo -n true`, not `sudo -v`
```

`CLAUDE.md` §13 was rewritten as 13.1–13.8. The old text told you to `rm -rf .next` before
building and to roll back by rebuilding `feat/phase0-setup` — a March branch, months behind
production. Both predated the existence of rollback snapshots; following them during an
incident destroyed the only fast rollback and then asked for a rebuild of an unrelated
branch.

`scripts/ops/deploy-production.sh` is now the procedure.

### The commit point

This is the design decision worth carrying forward:

```
lock → preflight → stop → snapshot(mv -T) → build → meta → start
──────────────────── the commit point ────────────────────────────
gate(local) → verify(nginx + public) → log → prune
```

Everything before the gate rolls back on failure. **Nothing after it does.** Once the
artifact serves correctly on `127.0.0.1:3000` it stays; a failed log write, a pruning error
or a network blip is a post-deploy problem, and the run exits `75` saying so.

Only the artifact's own behaviour gates a rollback. nginx and the public URL are checked
after the commit point, with retries, warn-only — if nginx or DNS is broken, swapping the
build back does not fix it and costs a verified artifact.

Exit codes: `0` deployed · `1` failed, rolled back · `70` internal state error · `71` the
deploy failed **and** the restore failed (site may be down) · `75` deployed, post-deploy
step failed.

### Sandbox coverage

Thirteen scenarios, all passing, against a fake `/opt/storefront` with stubbed
`pnpm`/`pm2`/`sudo` and a fixture HTTP server. Never run against production.

happy path · failed build · an unstyled 200 page · failed deploy log · failed prune ·
`exit 0` before the commit point · failed restore · pin marker not riding back · `flock`
blocking a second run · `mv -T` refusing to nest · sidecar pinning · `--dry-run` ·
the removed `--allow-dirty`. Plus two sudo cases (§5.2).

---

## 5. Findings that must not be lost

### 5.1 The CSS path in every draft runbook was wrong

Next 16 with Turbopack emits stylesheets under **`/_next/static/chunks/*.css`**, not
`/_next/static/css/*.css`. Verified against live production, 1 Aug — the only stylesheet on
`/sk` is `/_next/static/chunks/2w_l0b3336ijx.css`, 200, 122 958 B.

Every proposed smoke test — the handoff's, ChatGPT's and this session's own first draft —
anchored on `/_next/static/css/`, which matches **nothing** on a healthy page. Shipped as
written, the deploy script would have failed its smoke test on every single deploy and
auto-rolled-back every good build. Use `/_next/static/[^"]+\.css`.

The script also checks that the advertised chunk exists on disk in the build just made.
That is the direct test for the stale-chunk symptom, not an indirect one.

### 5.2 Probe sudo with `sudo -n true`, never `sudo -v`

`sudo -v` validates credentials, and validation asks for a password **even under
NOPASSWD** — the rule exempts running commands, not authenticating. On this box:

```
sudo -n true   → OK
sudo -n -v     → sudo: a password is required
```

A `-v` probe therefore blocks the deploy on a box where sudo could never have been a
problem. This is exactly how the script's first run died on 1 Aug. With NOPASSWD the ticket
never expires, so the keepalive is skipped entirely; it only starts on a box that really
does need a password.

### 5.3 Never `cp -al` for snapshots

Hardlinks share the inode, and `next start` rewrites ISR cache under
`.next/server/app/*.html` with `O_TRUNC` — it modifies the existing inode rather than
replacing the file, so the live server silently mutates the snapshot. Static chunks under
`.next/static/` are never rewritten after a build, so a hardlinked snapshot is not useless,
but it stops being _immutable_, which is its whole point.

Out is `mv -T`. Back is `mv -T` when it is the artifact this run just displaced, and
`cp -a` when restoring an older pinned build that must survive.

`-T` matters: without it, an existing target directory makes `mv` nest `.next` **inside**
it instead of failing, corrupting both the snapshot and the restore that depends on it.

### 5.4 Snapshots are named from the artifact, not from git

The snapshot name takes its sha from the live build's own `MAKY_DEPLOY_META`, not from
`git HEAD` — HEAD is the commit about to be built, the artifact came from an earlier one.
No metadata means `unknown`, which is honest. During an incident people read directory
names, not files inside them.

### 5.5 `MIN_FREE_MEM_MB` is an interlock, not a memory calculation

The build peaks under 1 GB. The 10 GB requirement is really "no agent is holding several
gigabytes right now", which after the OOM history is deliberate. Override per-run rather
than lowering the default, until a real cgroup `memory.peak` has been measured across a few
deploys.

---

## 6. Corrections — claims made earlier in this thread that are wrong

| Claim                                                     | Reality                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| "DNS / the Cloudflare proxy looks like the cause"         | Retracted. `maky.store` is DNS-only and `cms.maky.store` is proxied; that is a normal setup and proves nothing.                  |
| "OOM / the build took the site down on 31 Jul"            | No. Marek's later evidence: a 95-minute EBS read runaway. The OOM in the console buffer was from **29 Jul** — a stale buffer.    |
| "put `.keep` inside the snapshot directory"               | Wrong, see §1.1. Sidecar.                                                                                                        |
| "the build peak was 988 MB so buildings were the problem" | Builds were never the problem. The 4.7 GB was Claude Code CLI (`/home/ubuntu/.claude/remote/ccd-cli/2.1.219`) in an SSH session. |

The general lesson from this thread: several diagnostic commands were run in a **local
container** and read as if they came from the server. `overlay` as the root filesystem, "not
booted with systemd", `pm2: command not found` and a missing `/opt/storefront/.next/BUILD_ID`
were all container artifacts. Check the shell prompt before trusting a diagnostic.

---

## 7. Still open

- **UptimeRobot** — external HTTP monitor on `https://maky.store/sk` with a keyword check on
  `Strešné nosiče`. The unstyled-site failure returns HTTP 200 and passes every AWS alarm; a
  keyword check is the only thing that catches it.
- **M.2 acceptance** — deployed without a gate, see §2.
- **`feat/withdrawal-form-v1`** — still unrebased, +17 commits over `b6b633d`, diverged from
  the M.2 line at that base.
- **Master plan §14.3** still prescribes `NEXT_OUTPUT=standalone` and copying `public` and
  `.next/static` into `.next/standalone/`. That does not describe this box — PM2 runs
  `npm start` = `next start`, which reads `.next` directly. §13.6 has the correct rule.
- **`known-issues.md`** — close "IAM role missing" and "CloudWatch alarms not deployed".
- **What started the EBS read runaway at ~14:55 on 31 Jul** — unknown; sysstat stopped at
  14:50 and the window is blind. `atop` is now installed at a 60 s interval, so a repeat will
  name the process.
- **Scratch worktree swap** (§13.8) — would cut downtime from minutes to seconds, not
  approved. `.next/required-server-files.json` records an absolute project root and it has
  not been tested whether a moved build tolerates that. Prove it off production first.

---

## 8. Repo facts that keep catching people

- `main` on GitHub is bare upstream Saleor from March, with none of the MAKY work. Do not
  clone it and start working. All real work lives in feature branches.
- `/opt/storefront` is a real git checkout of `feat/cms-m2`. `next start` serves the `.next`
  directory, not the git tree — the two can disagree, which is why `MAKY_DEPLOY_META` exists.
- `maky-smtp-app` runs on the same box and carries transactional mail. It is never part of a
  storefront deploy.
