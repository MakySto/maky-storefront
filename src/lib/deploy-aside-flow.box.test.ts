import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createWorld, waitForHttp, type World } from "./__fixtures__/deploy-world/world";

/**
 * scripts/ops/deploy-production.sh, run for real against a box made of small programs that do what
 * pm2, nginx and the app do (see __fixtures__/deploy-world/world.ts). What is asserted is what a
 * customer would have met and what the box looks like afterwards, for the deploy that goes well and
 * for a failure at every step that can fail.
 *
 * Every deploy here takes several seconds because the script really waits for servers to boot.
 */

const SLOW = 120_000;
const BRIDGE_APP = "maky-storefront-bridge";
const LIVE_APP = "maky-storefront";

let world: World | undefined;
afterEach(async () => {
	await world?.dispose();
	world = undefined;
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every file under `dir` with its content, so "the live build was not touched" can mean byte for byte.
 * `cache/` is left out: a running server writes there (ISR shells, optimised images) all the time.
 */
function treeSignature(dir: string): string {
	const files = readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.filter((file) => !file.slice(dir.length).startsWith("/cache/"))
		.sort();
	const hash = createHash("sha1");
	for (const file of files) {
		hash.update(file.slice(dir.length));
		hash.update(readFileSync(file));
	}
	return `${files.length} files, ${hash.digest("hex")}`;
}

const read = (path: string) => readFileSync(path, "utf8");
const liveBuildId = (w: World) => read(join(w.app, ".next/BUILD_ID"));
const liveTree = (w: World) => treeSignature(join(w.app, ".next"));

function deployMeta(w: World): Record<string, string> {
	const text = readFileSync(join(w.app, ".next/MAKY_DEPLOY_META"), "utf8");
	return Object.fromEntries(
		text
			.split("\n")
			.filter((line) => line.includes("="))
			.map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
	);
}

function upstreamState(w: World): string {
	if (!existsSync(w.upstreamFile)) return "absent";
	return /^# state: (.+)$/m.exec(readFileSync(w.upstreamFile, "utf8"))?.[1] ?? "unknown";
}

const snapshots = (w: World) => readdirSync(w.rollbacks).filter((name) => name.startsWith(".next.rollback-"));
const head = (w: World) =>
	spawnSync("git", ["rev-parse", "HEAD"], { cwd: w.app, encoding: "utf8" }).stdout.trim();
const pm2 = (w: World, ...args: string[]) => spawnSync("pm2", args, { env: w.env, encoding: "utf8" });
const count = (lines: string[], pattern: RegExp) => lines.filter((line) => pattern.test(line)).length;

/** Index of the first line matching each pattern, each searched after the one before; fails if one is missing. */
function inOrder(lines: string[], ...patterns: RegExp[]): number[] {
	const found: number[] = [];
	let from = 0;
	for (const pattern of patterns) {
		const at = lines.findIndex((line, i) => i >= from && pattern.test(line));
		expect(at, `${pattern} should follow line ${from} in:\n${lines.join("\n")}`).toBeGreaterThanOrEqual(0);
		found.push(at);
		from = at + 1;
	}
	return found;
}

const lastIndex = (lines: string[], pattern: RegExp) => lines.findLastIndex((line) => pattern.test(line));

const PM2_STOP_LIVE = /^pm2 stop maky-storefront \[/;
const PM2_DELETE_LIVE = /^pm2 delete maky-storefront \[/;
// The live process is registered afresh, from a clean environment, as the bridge is: `pm2 start npm ...`, with the logs of the
// record it replaces. Not `pm2 start maky-storefront`, which starts a process again from the record PM2 holds.
const PM2_START_LIVE =
	/^pm2 start npm --name maky-storefront --cwd \S+( --output \S+)?( --error \S+)? -- start -- -p \d+ \[/;
const PM2_START_BRIDGE = /^pm2 start npm --name maky-storefront-bridge /;
const PM2_DELETE_BRIDGE = /^pm2 delete maky-storefront-bridge/;
/** What the fixture's live record holds from the shell that registered it, as the real one held an agent session's variables. */
const POLLUTION = [
	"CLAUDE_FAKE_SECRET",
	"CLAUDE_CODE_SESSION_ID",
	"ANTHROPIC_BASE_URL",
	"NEXT_PUBLIC_FIXTURE_FLAG",
];
/** The values of those, which must not be printed anywhere: the deploy names variables and never says what they hold. */
const POLLUTION_VALUES = [
	"must-not-reach-the-bridge",
	"fixture-session",
	"fixture.invalid",
	"stored-with-the-process",
];
/** The whole line, as `plain` text: a count and the verdict, so that nothing else (a value, say) can ride along on it. */
const CLEAN_ENVIRONMENT_REPORT = (who: string) =>
	new RegExp(
		`^==> environment of ${who} \\(pid \\d+\\): \\d+ names, none looks like a credential, none hides a value of \\.env$`,
		"m",
	);
/** The script colours `warn:` and `==>` whatever its output goes to; a person reads the text without the codes. */
const ESCAPE = String.fromCharCode(27);
const plain = (text: string) => text.replace(new RegExp(`${ESCAPE}\\[[0-9;]*m`, "g"), "");
/** A made-up process table laid out as /proc is: a directory a pid with `comm`, `cwd` (a link) and `environ` (NUL separated). */
function processTable(
	root: string,
	processes: { pid: number; comm: string; cwd?: string; environ?: string }[],
): string {
	mkdirSync(root, { recursive: true });
	for (const { pid, comm, cwd, environ } of processes) {
		const dir = join(root, String(pid));
		mkdirSync(dir);
		writeFileSync(join(dir, "comm"), `${comm}\n`);
		if (cwd) symlinkSync(realpathSync(cwd), join(dir, "cwd"));
		if (environ !== undefined) writeFileSync(join(dir, "environ"), environ);
	}
	return root;
}
const BUILD_IN_SCRATCH = /^pnpm build in \S+\/build( |$)/;
const BUILD_IN_LIVE_TREE = /^pnpm build in \S+\/app( |$)/;
const NGINX_RELOAD = /^systemctl reload nginx/;

async function bridgeWorld(): Promise<World> {
	world = await createWorld();
	const installed = world.installNginx();
	expect(installed.code, installed.out).toBe(0);
	return world;
}

async function plainWorld(): Promise<World> {
	world = await createWorld();
	return world;
}

/** The commit being deployed carries the module that reads the category list from Saleor (storefront PR #28). */
const withLiveCategories = (w: World) => w.commitFiles({ "src/lib/live-categories.ts": "export {};\n" });

const sha = (release: number) => String(release).repeat(64).slice(0, 64);

/**
 * What GET /api/catalog/status serves (src/lib/catalog-release/status.ts), cut down to what the deploy reads:
 * whether the process follows the release manifest, and the release it took for one market and for the
 * fitment dataset. `null` is a process that took nothing from the manifest yet.
 */
function catalogStatus(
	release: number | null,
	{ follows = true, fitment = release }: { follows?: boolean; fitment?: number | null } = {},
): string {
	const file = (n: number | null) =>
		n === null
			? { file: null, sha256: null, release: null, state: "missing", source: "none" }
			: { file: `release-${n}.json`, sha256: sha(n), release: n, state: "active", source: "manifest" };
	return JSON.stringify({
		artifact: "MAKY_STOREFRONT_CATALOG_STATUS",
		schemaVersion: "1.0.0",
		process: { bootId: `fixture-${release}` },
		capabilities: { contentByTarget: follows },
		content: { targets: { "sk-SK": file(release) } },
		fitment: follows ? file(fitment) : null,
	});
}

/** The process customers are on already serves a document: it sits in the live build, which the fake app reads per request. */
const liveServes = (w: World, doc: string) =>
	writeFileSync(join(w.app, ".next/FAKE_CATALOG_STATUS.json"), doc);

const staleTypes = ["src/gql/graphql.ts", "src/checkout/graphql/generated/index.ts"];

/** Types of an earlier commit in the live checkout, where gitignored build output lives. */
function seedStaleTypes(w: World) {
	for (const rel of staleTypes) {
		mkdirSync(dirname(join(w.app, rel)), { recursive: true });
		writeFileSync(join(w.app, rel), "types of an earlier commit\n");
	}
}

const typesIn = (w: World) => staleTypes.map((rel) => read(join(w.app, rel)));
const gitStatus = (w: World) =>
	spawnSync("git", ["status", "--porcelain"], { cwd: w.app, encoding: "utf8" }).stdout;

/** Runs the deploy while two clients keep asking for the home page, the way customers do. */
async function deployUnderLoad(w: World, args: string[], extraEnv: Record<string, string> = {}) {
	const mark = w.events().length;
	const load = w.startLoad(w.customerUrl());
	await sleep(300);
	const result = await w.run(args, extraEnv);
	await sleep(300);
	const customers = await load.stop();
	const lines = w
		.events()
		.slice(mark)
		.map((event) => event.text);
	// The deploy never saves PM2's list: ~/.pm2/dump.pm2 is clean, and a save made before the live process is registered
	// afresh would write the old record, with the environment of an agent's SSH session, into it (CLAUDE.md §13.2.1).
	expect(
		lines.filter((line) => /^pm2 save/.test(line)),
		"the deploy must not run pm2 save",
	).toEqual([]);
	return { ...result, customers, lines, mark };
}

type Run = Awaited<ReturnType<typeof deployUnderLoad>>;

/** What a deploy that stopped before it touched the live process has to look like afterwards. */
function expectLiveSiteUntouched(w: World, before: string, run: Run) {
	expect(
		run.lines.filter(
			(line) => PM2_STOP_LIVE.test(line) || PM2_DELETE_LIVE.test(line) || PM2_START_LIVE.test(line),
		),
		run.out,
	).toEqual([]);
	expect(liveBuildId(w)).toBe("old-build");
	expect(liveTree(w)).toBe(before);
	expect(snapshots(w)).toEqual([]);
	expect(w.pm2(LIVE_APP)).toBe("online");
	expect(w.pm2(BRIDGE_APP)).toBe("absent");
	expect(existsSync(w.build), "the scratch tree is removed").toBe(false);
	expect(run.customers.failures, "customers saw no error").toEqual([]);
}

describe("deploy-production.sh, bridge: nginx prepared", () => {
	it(
		"builds beside the live site, moves customers onto a verified bridge, swaps, and moves them back",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// The live process starts out the way the real one was found: carrying what the shell that registered it held.
			for (const name of POLLUTION) expect(w.processEnvNames(LIVE_APP)).toContain(name);
			const run = await deployUnderLoad(w, ["-m", "fixture deploy"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("switching with: bridge");
			expect(run.out).not.toContain("Terminated");
			expect(run.out).toMatch(/customers: 0 of \d+ probe requests failed/);
			expect(run.out).toContain("POST_DEPLOY_FAILED: none");

			// What customers met: no error, served by the bridge in the middle and by the live process either side.
			expect(run.customers.failures, JSON.stringify(run.customers.failures)).toEqual([]);
			expect(run.customers.total).toBeGreaterThan(100);
			expect(run.customers.upstreams[`127.0.0.1:${w.ports.bridge}`]).toBeGreaterThan(0);
			expect(run.customers.upstreams[`127.0.0.1:${w.ports.canonical}`]).toBeGreaterThan(0);

			// The order that makes it safe.
			inOrder(
				run.lines,
				BUILD_IN_SCRATCH,
				PM2_START_BRIDGE,
				NGINX_RELOAD, // customers to the bridge
				PM2_STOP_LIVE,
				PM2_DELETE_LIVE, // the record the process was registered with goes ...
				PM2_START_LIVE, // ... and it is registered again
				NGINX_RELOAD, // customers back
				PM2_DELETE_BRIDGE,
			);
			expect(count(run.lines, /^pnpm build in /)).toBe(1);
			expect(count(run.lines, BUILD_IN_LIVE_TREE)).toBe(0);
			expect(count(run.lines, NGINX_RELOAD)).toBe(2);
			// /opt belongs to root on the real box: the scratch directory is created with sudo, and its last step
			// (rmdir) is removed with sudo, while the tree in it is never deleted recursively with it.
			expect(run.lines.some((line) => new RegExp(`^sudo install -d .* ${w.build}$`).test(line))).toBe(true);
			expect(run.lines).toContain(`sudo rmdir -- ${w.build}`);
			expect(run.lines.filter((line) => /^sudo rm /.test(line) && line.includes(w.build))).toEqual([]);
			// The scratch tree is configured as the live one is: every env file Next reads, and none of the backups.
			expect(run.lines.find((line) => BUILD_IN_SCRATCH.test(line))).toContain(
				"envfiles=.env,.env.production",
			);

			// The bridge and the live process are both registered from a clean environment: what the live process
			// carried before (an agent session's variables, kept in its PM2 record through every deploy) is gone.
			const bridgeStart = run.lines.find((line) => PM2_START_BRIDGE.test(line)) ?? "";
			expect(bridgeStart).toContain("secret-visible=no");
			// And it is started the way the live process is: `next start -p <port>` and nothing after the port. With
			// -H 127.0.0.1 Next answered every market page with a redirect to itself (the first rehearsal on the
			// box); the fake app reproduces that, so a -H here would also stop this deploy at the bridge's readiness.
			expect(bridgeStart).toMatch(new RegExp(` -- start -- -p ${w.ports.bridge} \\[secret-visible=no\\]$`));
			const liveStart = run.lines.find((line) => PM2_START_LIVE.test(line)) ?? "";
			expect(liveStart).toMatch(new RegExp(` -- start -- -p ${w.ports.canonical} \\[secret-visible=no\\]$`));
			expect(run.lines.find((line) => PM2_STOP_LIVE.test(line))).toContain("secret-visible=yes");
			expect(liveStart).not.toContain(" -H ");

			// What it was started with now is what starting it takes and nothing an agent session held, and the deploy says so,
			// the names and never the values, for the bridge and the live process alike.
			const environment = w.processEnvNames(LIVE_APP);
			for (const name of POLLUTION) expect(environment).not.toContain(name);
			expect(environment).toContain("PATH");
			expect(plain(run.out)).toMatch(CLEAN_ENVIRONMENT_REPORT("the bridge"));
			expect(plain(run.out)).toMatch(CLEAN_ENVIRONMENT_REPORT(LIVE_APP));
			expect(plain(run.out)).not.toMatch(/warn: environment of/);
			for (const value of POLLUTION_VALUES) expect(run.out).not.toContain(value);
			// The live process is the one the report names, and not another next-server on the box.
			expect(Number(/environment of maky-storefront \(pid (\d+)\)/.exec(run.out)?.[1])).toBe(w.pid(LIVE_APP));

			// The box afterwards.
			const id = liveBuildId(w);
			expect(id).not.toBe("old-build");
			expect(deployMeta(w)).toMatchObject({ build_id: id, git_sha: head(w) });
			const server = JSON.parse(readFileSync(join(w.app, ".next/required-server-files.json"), "utf8")) as {
				appDir: string;
				config: { outputFileTracingRoot: string };
			};
			expect(server.appDir).toBe(w.app);
			expect(server.config.outputFileTracingRoot).toBe(w.app);
			expect(readFileSync(join(w.app, ".next/required-server-files.js"), "utf8")).toContain(w.app);
			expect(readFileSync(join(w.app, ".next/required-server-files.js"), "utf8")).not.toContain(w.build);
			const html = await (await fetch(`${w.canonicalUrl}/sk`)).text();
			expect(html).toContain(`app-${id}.css`);

			// What the bridge printed stays beside the build log, for whoever wants to know how it went.
			expect(read(`${w.env.BUILD_LOG}.bridge-out`)).toContain("[market-state]");

			// The bridge wrote into the tree it served (that is what a server does); what went into the live
			// directory is the copy taken before it ever started, so nothing of the bridge's is in it.
			const writers = new Set(read(join(w.app, ".next/cache/touched.log")).split("\n").filter(Boolean));
			expect([...writers]).toEqual([w.app]);

			const [snapshot] = snapshots(w);
			expect(snapshots(w)).toHaveLength(1);
			expect(snapshot).toMatch(/^\.next\.rollback-0000000-old-build-\d{8}T\d{6}Z$/);
			expect(treeSignature(join(w.rollbacks, snapshot ?? ""))).toBe(before);

			expect(w.pm2(LIVE_APP)).toBe("online");
			expect(w.pm2(BRIDGE_APP)).toBe("absent");
			expect(existsSync(w.build)).toBe(false);
			expect(upstreamState(w)).toBe("canonical-only");

			const log = readFileSync(w.env.DEPLOY_LOG!, "utf8");
			expect(log).toContain("flow:     bridge");
			expect(log).toContain("downtime: 0s for customers");
			expect(log).toMatch(/probes:   0 of \d+ probe requests failed/);
			expect(log).toContain("note:     fixture deploy");
		},
		SLOW,
	);

	it(
		"clears a bridge an earlier run left registered, and goes on",
		async () => {
			const w = await bridgeWorld();
			expect(
				pm2(
					w,
					"start",
					"npm",
					"--name",
					BRIDGE_APP,
					"--cwd",
					w.app,
					"--",
					"start",
					"--",
					"-p",
					String(w.ports.bridge),
				).status,
			).toBe(0);
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("left by an earlier run");
			inOrder(run.lines, PM2_DELETE_BRIDGE, /^pnpm build in /, PM2_START_BRIDGE, PM2_DELETE_BRIDGE);
			expect(w.pm2(BRIDGE_APP)).toBe("absent");
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"does not touch a bridge that nginx may be sending customers to, even to rehearse",
		async () => {
			const w = await bridgeWorld();
			expect(
				pm2(
					w,
					"start",
					"npm",
					"--name",
					BRIDGE_APP,
					"--cwd",
					w.app,
					"--",
					"start",
					"--",
					"-p",
					String(w.ports.bridge),
				).status,
			).toBe(0);
			await waitForHttp(`http://127.0.0.1:${w.ports.bridge}/sk`);
			expect(w.tool(["set", "bridge-primary"]).code).toBe(0);
			const run = await deployUnderLoad(w, ["--rehearse"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("customers may be on it");
			expect(count(run.lines, PM2_DELETE_BRIDGE)).toBe(0);
			expect(w.pm2(BRIDGE_APP)).toBe("online");
			expect(upstreamState(w)).toBe("bridge-primary");
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"does not start a bridge blind when PM2's list cannot be read",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl("pm2-jlist-garbage");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("cannot read PM2's process list");
			expect(count(run.lines, /^pnpm build /)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"records the commit it built, not the one the checkout moved to while it was building",
		async () => {
			const w = await bridgeWorld();
			const built = head(w);
			w.setCtl("commit-during-build");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(head(w)).not.toBe(built);
			expect(deployMeta(w).git_sha).toBe(built);
			expect(readFileSync(w.env.DEPLOY_LOG!, "utf8")).toContain(`git:      ${built.slice(0, 7)}`);
			expect(run.out).toContain(`deployed ${built.slice(0, 7)} as BUILD_ID`);
		},
		SLOW,
	);

	it(
		"leaves the live site alone when the build fails",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl("build-fail");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("pnpm build failed");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expect(count(run.lines, PM2_START_BRIDGE)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
			expect(upstreamState(w)).toBe("canonical-only");
		},
		SLOW,
	);

	it(
		"refuses a build that carries its own location, before anything is switched",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl("build-leaks-path");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("the build carries its own location");
			expect(run.out).toContain("leak.txt");
			expect(count(run.lines, PM2_START_BRIDGE)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"does not send a single customer to a bridge that fails the gate",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// The build's stylesheet is a 404 when it is served from the scratch directory.
			w.setCtl("next-behavior", "css404in=build\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toMatch(/404/);
			expect(count(run.lines, PM2_START_BRIDGE)).toBe(1);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
			expect(upstreamState(w)).toBe("canonical-only");
		},
		SLOW,
	);

	it(
		"does not send customers to a bridge that never comes up",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// The home page answers 500, so the bridge is never "ready".
			w.setCtl("next-behavior", "failhome=1\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { READY_TIMEOUT_S: "3" });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("the bridge did not answer");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);

			// The bridge and its scratch tree are gone by now; what it wrote is the only evidence of why it was not ready.
			const bridgeLog = `${w.env.BUILD_LOG}.bridge-out`;
			expect(run.out).toContain(`the last lines of ${bridgeLog}`);
			expect(run.out).toContain(`bridge log: ${bridgeLog}`);
			expect(read(bridgeLog)).toContain("[market-state]");

			// And it says what the bridge answered, not only that it did not answer: the first rehearsal on the box
			// ended on "did not answer within 120s", with a log that held nothing about a request.
			// (The first probe may meet a process that has not opened its port yet, so the message says first and last.)
			expect(run.out).toMatch(/the last: HTTP 500, 4 B|every probe got: HTTP 500, 4 B/);
			expect(run.out).toMatch(/the bridge as PM2 sees it: status=online restarts=0 up=\d+ s pid=\d+/);
			expect(run.out).toContain("takes connections");
			expect(run.out).toContain("/robots.txt: 200");
			expect(run.out).toContain("HTTP/1.1 500 Internal Server Error");
			expect(run.out).toMatch(/first 300 bytes of its body:\s+boom/);
		},
		SLOW,
	);

	it(
		"names the redirect a bridge answers with instead of the page",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl("next-behavior", "homestatus=308\nhomelocation=http://127.0.0.1:1/somewhere-else\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { READY_TIMEOUT_S: "3" });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toMatch(
				/(the last|every probe got): HTTP 308, redirecting to http:\/\/127\.0\.0\.1:1\/somewhere-else/,
			);
			expect(run.out).toMatch(/location: http:\/\/127\.0\.0\.1:1\/somewhere-else/i);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"names a bridge that redirects to the very address it was asked for",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// What the first rehearsal on the box met (next start -H 127.0.0.1): /sk answered 301 with Location: /sk.
			w.setCtl("next-behavior", "homestatus=301\nhomelocation=/sk\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { READY_TIMEOUT_S: "3" });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain(
				`HTTP 301, redirecting to the very address it was asked for (http://127.0.0.1:${w.ports.bridge}/sk)`,
			);
			expect(run.out).toMatch(/location: \/sk/i);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"keeps the fixture honest: its app answers as next start -H 127.0.0.1 did on the box, and as it does without",
		async () => {
			const w = await bridgeWorld();
			const url = `http://127.0.0.1:${w.ports.bridge}`;
			const start = (...host: string[]) =>
				pm2(
					w,
					"start",
					"npm",
					"--name",
					"host-probe",
					"--cwd",
					w.app,
					"--",
					"start",
					"--",
					"-p",
					String(w.ports.bridge),
					...host,
				);

			expect(start("-H", "127.0.0.1").status).toBe(0);
			await waitForHttp(`${url}/robots.txt`);
			const redirected = await fetch(`${url}/sk`, { redirect: "manual" });
			expect(redirected.status).toBe(301);
			expect(redirected.headers.get("location")).toBe("/sk");
			expect(redirected.headers.get("x-middleware-rewrite")).toBe(
				`http://localhost:${w.ports.bridge}/sk-eur`,
			);
			expect((await fetch(`${url}/sk/products`, { redirect: "manual" })).status).toBe(301);
			expect((await fetch(`${url}/robots.txt`)).status).toBe(200);
			expect(pm2(w, "delete", "host-probe").status).toBe(0);

			expect(start().status).toBe(0);
			await waitForHttp(`${url}/sk`);
			expect((await fetch(`${url}/sk`, { redirect: "manual" })).status).toBe(200);
			expect(pm2(w, "delete", "host-probe").status).toBe(0);
		},
		SLOW,
	);

	it(
		"says when the answer of a bridge is cut off after its 200",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// A stream that dies after the shell: curl has the status line and a piece of the body, then the connection drops.
			w.setCtl("next-behavior", "cut=/sk\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { READY_TIMEOUT_S: "3" });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toMatch(/HTTP 200, then the transfer failed after \d+ B \(curl exit (18|56)/);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"says when nothing comes of a bridge that PM2 reports as online",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl(`pm2-never-listen-${BRIDGE_APP}`);
			const run = await deployUnderLoad(w, ["-m", "x"], { READY_TIMEOUT_S: "3" });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toMatch(/no HTTP answer \(curl exit 7: .*Failed to connect/i);
			expect(run.out).toContain("the bridge as PM2 sees it: status=online");
			expect(run.out).toContain("refuses connections");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"reports a body cut short as 000 and not as the 200 that preceded it",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// The page is fine and ready; one of the gate's static files is cut off after its status line.
			w.setCtl("next-behavior", "cut=/robots.txt\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toMatch(/static asset \/robots\.txt answered 000\b/);
			expect(run.out).not.toContain("200000");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"stops before touching the live process when nginx will not switch",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl("nginx-t-fail-when-bridge-primary");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("nginx would not switch to the bridge");
			expect(run.out).toContain("nginx -t refused the configuration");
			expectLiveSiteUntouched(w, before, run);
			expect(upstreamState(w)).toBe("canonical-only");
		},
		SLOW,
	);

	it(
		"puts the old build back, and only then moves customers, when the swapped-in build fails its gate",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			// Fine on the bridge; the stylesheet is a 404 once the same build is served from the live directory.
			w.setCtl("next-behavior", "css404in=app\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("deploy failed before the commit point");
			expect(run.out).toContain("previous build is back up");
			expect(run.customers.failures, JSON.stringify(run.customers.failures)).toEqual([]);

			// The live process was stopped and started twice (the swap, then the restore) and customers were
			// moved back after the second start, never before.
			expect(count(run.lines, PM2_STOP_LIVE)).toBeGreaterThanOrEqual(2);
			expect(count(run.lines, PM2_START_LIVE)).toBe(2);
			expect(lastIndex(run.lines, NGINX_RELOAD)).toBeGreaterThan(lastIndex(run.lines, PM2_START_LIVE));
			expect(lastIndex(run.lines, PM2_DELETE_BRIDGE)).toBeGreaterThan(lastIndex(run.lines, NGINX_RELOAD));

			expect(liveBuildId(w)).toBe("old-build");
			expect(liveTree(w)).toBe(before);
			expect(snapshots(w)).toEqual([]);
			expect(w.pm2(LIVE_APP)).toBe("online");
			expect(w.pm2(BRIDGE_APP)).toBe("absent");
			expect(existsSync(w.build)).toBe(false);
			expect(upstreamState(w)).toBe("canonical-only");
			expect(run.customers.upstreams[`127.0.0.1:${w.ports.canonical}`]).toBeGreaterThan(0);
			// The old build is served by a process registered afresh, not by a start from the record that held the session's variables.
			for (const name of POLLUTION) expect(w.processEnvNames(LIVE_APP)).not.toContain(name);
		},
		SLOW,
	);

	it(
		"keeps customers on the verified bridge when the old build cannot be brought back, and can be recovered by hand",
		async () => {
			const w = await bridgeWorld();
			// After the swap the live process will not start at all, so neither the new build nor the restore comes up.
			w.setCtl("pm2-fail-start-maky-storefront");
			const run = await deployUnderLoad(w, ["-m", "x"], { RESTORE_TIMEOUT_S: "3" });

			expect(run.code, run.out).toBe(71);
			expect(run.out).toContain("CRITICAL: the deploy failed AND the restore failed");
			expect(run.out).toContain("customers are on the bridge");
			expect(run.out).toContain("must stay until");

			// Nobody saw it: the bridge went on serving the new, verified build.
			expect(run.customers.failures, JSON.stringify(run.customers.failures)).toEqual([]);
			expect(w.pm2(BRIDGE_APP)).toBe("online");
			expect(upstreamState(w)).toBe("bridge-primary");
			expect(existsSync(join(w.build, ".maky-scratch")), "the scratch tree stays under the bridge").toBe(
				true,
			);
			expect(liveBuildId(w)).toBe("old-build");
			expect((await fetch(`${w.customerUrl()}`)).status).toBe(200);

			// The recovery the message prints: register the live process again (PM2 may have lost its record), move
			// customers back, remove the bridge.
			const hint = /if PM2 no longer lists it: (.+)/.exec(run.out)?.[1];
			expect(hint, run.out).toContain(`pm2 start npm --name ${LIVE_APP} --cwd ${w.app}`);
			w.clearCtl("pm2-fail-start-maky-storefront");
			const registered = spawnSync("bash", ["-c", hint ?? "false"], { env: w.env, encoding: "utf8" });
			expect(registered.status, registered.stderr).toBe(0);
			await waitForHttp(`${w.canonicalUrl}/sk`);
			const back = w.tool(["set", "canonical-only"]);
			expect(back.code, back.out).toBe(0);
			expect(upstreamState(w)).toBe("canonical-only");
			expect(pm2(w, "delete", BRIDGE_APP).status).toBe(0);
			expect((await fetch(`${w.customerUrl()}`)).status).toBe(200);
		},
		SLOW,
	);

	it(
		"reports exit 75, leaves the verified bridge in front, and refuses the next deploy until it is put right",
		async () => {
			const w = await bridgeWorld();
			// nginx takes the switch to the bridge but refuses to go back.
			w.setCtl("nginx-t-fail-when-canonical-only");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(75);
			expect(run.out).toContain("POST_DEPLOY_FAILED:");
			expect(run.out).toContain("customers back on maky-storefront, bridge stopped");
			expect(run.out).toContain("customers are still on the bridge");
			expect(count(run.out.split("\n"), /customers are still on the bridge/)).toBe(1);
			expect(run.customers.failures, JSON.stringify(run.customers.failures)).toEqual([]);

			// The new build is live and verified on the live process; the bridge, which serves the same build, stays in front.
			expect(liveBuildId(w)).not.toBe("old-build");
			expect(w.pm2(LIVE_APP)).toBe("online");
			expect(w.pm2(BRIDGE_APP)).toBe("online");
			expect(upstreamState(w)).toBe("bridge-primary");
			expect(existsSync(w.build)).toBe(true);

			// An unfinished earlier deploy is not something to deploy on top of.
			const next = await w.run(["-m", "again"]);
			expect(next.code, next.out).toBe(1);
			expect(next.out).toContain("an earlier deploy did not finish");
			expect(next.out).toContain("set canonical-only");

			// The recovery the message prints.
			w.clearCtl("nginx-t-fail-when-canonical-only");
			const back = w.tool(["set", "canonical-only"]);
			expect(back.code, back.out).toBe(0);
			expect(pm2(w, "delete", BRIDGE_APP).status).toBe(0);
			expect(upstreamState(w)).toBe("canonical-only");
			expect((await fetch(w.customerUrl())).status).toBe(200);
		},
		SLOW,
	);

	it(
		"rehearses: builds aside, runs the bridge, passes the gate, and switches nothing",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["--rehearse"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("rehearsal passed");
			expect(run.out).toContain("the bridge and");
			inOrder(run.lines, BUILD_IN_SCRATCH, PM2_START_BRIDGE, PM2_DELETE_BRIDGE);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expect(count(run.lines, /^nginx /)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
			expect(upstreamState(w)).toBe("canonical-only");
			expect(existsSync(w.env.DEPLOY_LOG!), "a rehearsal writes nothing to the deployment log").toBe(false);
		},
		SLOW,
	);

	it(
		"says it was left behind, in its exit code, when a rehearsal cannot clean up",
		async () => {
			const w = await bridgeWorld();
			// A bridge nobody can delete: the rehearsal passes but must not claim the box is clean.
			w.setCtl("pm2-fail-delete-maky-storefront-bridge");
			const run = await deployUnderLoad(w, ["--rehearse"]);

			expect(run.code, run.out).toBe(75);
			expect(run.out).toContain("left maky-storefront-bridge");
			expect(run.out).not.toContain("the bridge and");
			expect(w.pm2(BRIDGE_APP)).toBe("online");
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"prints the plan on a dry run and changes nothing",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["--dry-run"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("Flow: bridge");
			expect(run.out).toContain("customers move to the bridge");
			expect(run.out).toContain(`register ${LIVE_APP} afresh from a clean environment`);
			expect(count(run.lines, /^pnpm build /)).toBe(0);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expect(count(run.lines, /^pm2 (stop|start|delete|restart)/)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"restarts instead of bridging when asked to, even with nginx prepared",
		async () => {
			const w = await bridgeWorld();
			const run = await deployUnderLoad(w, ["--mode", "restart", "-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("switching with: restart");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expect(count(run.lines, PM2_START_BRIDGE)).toBe(0);
			expect(liveBuildId(w)).not.toBe("old-build");
		},
		SLOW,
	);
});

describe("deploy-production.sh, bridge: what the new process must show before customers are sent to it", () => {
	it(
		"reads the category list back from the bridge before moving customers, and from the live process after the swap",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			w.setCtl("next-behavior", "categories=yes\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			const onBridge = run.out.indexOf("the bridge: [live-categories] floor=30 live=0 refused=0 loaded=yes");
			expect(onBridge, run.out).toBeGreaterThan(-1);
			expect(run.out.indexOf("customers → bridge")).toBeGreaterThan(onBridge);
			expect(run.out).toContain("maky-storefront: [live-categories] floor=30 live=0 refused=0 loaded=yes");
			expect(run.out).toContain("POST_DEPLOY_FAILED: none");
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"asks for nothing from a build that does not read categories from Saleor",
		async () => {
			const w = await bridgeWorld();
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("the bridge: this build does not read categories from Saleor");
			expect(run.out).toContain("maky-storefront: this build does not read categories from Saleor");
		},
		SLOW,
	);

	it(
		"does not send customers to a bridge that could not read the category list from Saleor",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			const before = liveTree(w);
			w.setCtl("next-behavior", "categories=no\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { CATEGORIES_WAIT_S: "4" });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("could not read the category list from Saleor within 4s");
			expect(run.out).toContain("customers were not sent to it");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
			expect(upstreamState(w)).toBe("canonical-only");
		},
		SLOW,
	);

	it(
		"accepts a bridge whose first read failed once Saleor has answered again",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			// The retry the server runs on a market request, 1.5 s after it started, is what the check waits for.
			w.setCtl("next-behavior", "categories=no\ncategoriesrecoverms=1500\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { CATEGORIES_WAIT_S: "20" });

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("loaded=no, then Saleor answered again — the list was read");
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"does not send customers to a bridge with no Saleor endpoint, which is the .env it did not get",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			const before = liveTree(w);
			w.setCtl("next-behavior", "categories=noendpoint\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("NEXT_PUBLIC_SALEOR_API_URL is missing from its environment (.env)");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"goes on, and says so, when Saleor holds categories that are not routed at the root",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			w.setCtl("next-behavior", "categories=refused\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("refused=2 — that many categories Saleor holds are not routed at the root");
		},
		SLOW,
	);

	it(
		"does not take what an earlier bridge left in PM2's own log for this bridge's boot line",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			const before = liveTree(w);
			mkdirSync(join(w.root, "pm2logs"), { recursive: true });
			writeFileSync(
				join(w.root, "pm2logs/maky-storefront-bridge-out.log"),
				"[live-categories] floor=30 live=0 refused=0 loaded=yes\n",
			);
			w.setCtl("next-behavior", "categories=noendpoint\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("NEXT_PUBLIC_SALEOR_API_URL is missing");
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"compares nothing while the release manifest is off in both processes, which is how production runs today",
		async () => {
			const w = await bridgeWorld();
			liveServes(w, catalogStatus(null, { follows: false }));
			w.setCtl("catalog-status.json", catalogStatus(null, { follows: false }));
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("catalogue release: the release manifest is off in both");
		},
		SLOW,
	);

	it(
		"says nothing can be compared when the live process serves no catalogue status",
		async () => {
			const w = await bridgeWorld();
			w.setCtl("catalog-status.json", catalogStatus(2));
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain(
				"maky-storefront serves no /api/catalog/status — nothing to compare the bridge with",
			);
		},
		SLOW,
	);

	it(
		"holds customers back until the bridge serves the catalogue release the live process serves",
		async () => {
			const w = await bridgeWorld();
			// Live is on release 2 (market and fitment). The bridge boots on release 1 and takes release 2 five seconds later.
			liveServes(w, catalogStatus(2));
			w.setCtl("catalog-status.json", catalogStatus(2));
			w.setCtl("catalog-status-lag.json", catalogStatus(1));
			w.setCtl("catalog-status-later.json", catalogStatus(2));
			w.setCtl("next-behavior", "statuslagin=build\nstatusafterms=5000\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { CATALOG_PARITY_POLL_S: "1" });

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain(
				"catalogue release: what maky-storefront took from the manifest (1 market target(s) and the fitment dataset) the bridge serves too",
			);
			const events = w.events().slice(run.mark);
			const bridgeStarted = events.find((event) => PM2_START_BRIDGE.test(event.text))!.t;
			const movedToBridge = events.find((event) => NGINX_RELOAD.test(event.text))!.t;
			expect(
				movedToBridge - bridgeStarted,
				"customers were sent to the bridge only once it served the release",
			).toBeGreaterThanOrEqual(5);
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"does not send customers to a bridge that never takes the release the live process serves",
		async () => {
			const w = await bridgeWorld();
			liveServes(w, catalogStatus(2));
			const before = liveTree(w);
			w.setCtl("catalog-status.json", catalogStatus(2));
			w.setCtl("catalog-status-lag.json", catalogStatus(1));
			w.setCtl("next-behavior", "statuslagin=build\n");
			const run = await deployUnderLoad(w, ["-m", "x"], {
				CATALOG_PARITY_WAIT_S: "3",
				CATALOG_PARITY_POLL_S: "1",
			});

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("sk-SK: the bridge serves release 1, maky-storefront serves release 2");
			expect(run.out).toContain("customers were not sent to it");
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"does not send customers to a bridge that is behind on the fitment dataset alone",
		async () => {
			const w = await bridgeWorld();
			liveServes(w, catalogStatus(2, { fitment: 3 }));
			const before = liveTree(w);
			w.setCtl("catalog-status.json", catalogStatus(2, { fitment: 2 }));
			const run = await deployUnderLoad(w, ["-m", "x"], {
				CATALOG_PARITY_WAIT_S: "2",
				CATALOG_PARITY_POLL_S: "1",
			});

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("fitment: the bridge serves release 2, maky-storefront serves release 3");
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"fails at once, without waiting for it, when the bridge does not follow the release manifest at all",
		async () => {
			const w = await bridgeWorld();
			liveServes(w, catalogStatus(2));
			const before = liveTree(w);
			w.setCtl("catalog-status.json", catalogStatus(2, { follows: false }));
			const startedAt = Date.now();
			const run = await deployUnderLoad(w, ["-m", "x"], { CATALOG_PARITY_WAIT_S: "60" });

			expect(run.code, run.out).toBe(1);
			// Waiting does not give a process the setting it lacks: the whole deploy is a few seconds, not the minute on offer.
			expect(Date.now() - startedAt).toBeLessThan(30_000);
			expect(run.out).toContain(
				"maky-storefront follows the release manifest and the bridge does not: MAKY_RELEASE_MANIFEST_URL is not in its environment (.env)",
			);
			expect(run.out).not.toContain("had 60s to take it");
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"goes on and says so when the live process on the new build is behind the bridge after the swap",
		async () => {
			const w = await bridgeWorld();
			liveServes(w, catalogStatus(2));
			w.setCtl("catalog-status.json", catalogStatus(2));
			w.setCtl("catalog-status-lag.json", catalogStatus(1));
			// The bridge answers with release 2; the live process, once the build is moved into the live directory, with release 1.
			w.setCtl("next-behavior", "statuslagin=app\n");
			const run = await deployUnderLoad(w, ["-m", "x"], {
				CATALOG_PARITY_WAIT_S: "3",
				CATALOG_PARITY_POLL_S: "1",
			});

			// After the commit point this can only delay and warn: the build is live and customers go back to it.
			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain(
				"sk-SK: maky-storefront on the new build serves release 1, the bridge serves release 2",
			);
			expect(run.out).toContain("maky-storefront on the new build gets customers back anyway");
			expect(liveBuildId(w)).not.toBe("old-build");
			expect(upstreamState(w)).toBe("canonical-only");
			expect(w.pm2(BRIDGE_APP)).toBe("absent");
			expect(count(run.lines, NGINX_RELOAD)).toBe(2);
			expect(run.customers.failures).toEqual([]);
		},
		SLOW,
	);

	it(
		"holds a rehearsal to the same two checks, and still switches nothing",
		async () => {
			const w = await bridgeWorld();
			withLiveCategories(w);
			const before = liveTree(w);
			w.setCtl("next-behavior", "categories=no\n");
			const noCategories = await deployUnderLoad(w, ["--rehearse"], { CATEGORIES_WAIT_S: "4" });
			expect(noCategories.code, noCategories.out).toBe(1);
			expect(noCategories.out).toContain(
				"the bridge did not read the category list from Saleor — nothing was switched",
			);
			expectLiveSiteUntouched(w, before, noCategories);

			liveServes(w, catalogStatus(2));
			const beforeLag = liveTree(w);
			w.setCtl("next-behavior", "categories=yes\nstatuslagin=build\n");
			w.setCtl("catalog-status.json", catalogStatus(2));
			w.setCtl("catalog-status-lag.json", catalogStatus(1));
			const lagging = await deployUnderLoad(w, ["--rehearse"], {
				CATALOG_PARITY_WAIT_S: "3",
				CATALOG_PARITY_POLL_S: "1",
			});
			expect(lagging.code, lagging.out).toBe(1);
			expect(lagging.out).toContain(
				"does not serve the catalogue release maky-storefront serves — nothing was switched",
			);
			expect(count(lagging.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, beforeLag, lagging);
		},
		SLOW,
	);
});

describe("deploy-production.sh, the GraphQL types a build generates", () => {
	it(
		"hands them to the live checkout after the commit point, and leaves the checkout clean for git",
		async () => {
			const w = await bridgeWorld();
			seedStaleTypes(w);
			w.setCtl("build-generates-types");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			const generated = `generated by ${liveBuildId(w)}\n`;
			expect(typesIn(w)).toEqual([generated, generated]);
			expect(gitStatus(w), "the next preflight demands a clean tree").toBe("");
			expect(run.out).toContain("the GraphQL types this build generated are now in");
		},
		SLOW,
	);

	it(
		"does the same after a restart",
		async () => {
			const w = await plainWorld();
			seedStaleTypes(w);
			w.setCtl("build-generates-types");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			const generated = `generated by ${liveBuildId(w)}\n`;
			expect(typesIn(w)).toEqual([generated, generated]);
			expect(gitStatus(w)).toBe("");
		},
		SLOW,
	);

	it(
		"does not touch them when the deploy is rolled back",
		async () => {
			const w = await bridgeWorld();
			seedStaleTypes(w);
			w.setCtl("build-generates-types");
			w.setCtl("next-behavior", "css404in=app\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(typesIn(w)).toEqual(["types of an earlier commit\n", "types of an earlier commit\n"]);
		},
		SLOW,
	);

	it(
		"says there was nothing to hand over when the build generates none",
		async () => {
			const w = await bridgeWorld();
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("this build generated no GraphQL types — nothing to hand over");
			expect(existsSync(join(w.app, "src/gql"))).toBe(false);
		},
		SLOW,
	);
});

describe("deploy-production.sh, restart: the live process's categories", () => {
	it(
		"reads them back after the restart, and names the step in exit 75 when the process has none",
		async () => {
			const w = await plainWorld();
			withLiveCategories(w);
			w.setCtl("next-behavior", "categories=noendpoint\n");
			const run = await deployUnderLoad(w, ["-m", "x"], { CATEGORIES_WAIT_S: "4" });

			expect(run.code, run.out).toBe(75);
			expect(run.out).toContain("maky-storefront: [live-categories] no Saleor endpoint is configured");
			expect(run.out).toContain("  - live categories");
			// A configuration fault does not undo a verified build.
			expect(liveBuildId(w)).not.toBe("old-build");
			expect(w.pm2(LIVE_APP)).toBe("online");
		},
		SLOW,
	);

	it(
		"passes when the restarted process has read them",
		async () => {
			const w = await plainWorld();
			withLiveCategories(w);
			w.setCtl("next-behavior", "categories=yes\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("maky-storefront: [live-categories] floor=30 live=0 refused=0 loaded=yes");
		},
		SLOW,
	);
});

describe("deploy-production.sh, restart: nginx not prepared", () => {
	it(
		"builds while the site serves, and the only gap is the swap",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			w.setCtl("build-sleep", "3");
			const run = await deployUnderLoad(w, ["-m", "fixture deploy"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("switching with: restart");
			expect(run.out).toContain("nginx is not prepared for a bridge");

			const [built, stopped, started] = inOrder(
				run.lines,
				/^pnpm build made /,
				PM2_STOP_LIVE,
				PM2_START_LIVE,
			);
			expect(built).toBeLessThan(stopped);
			expect(started).toBeGreaterThan(stopped);
			expect(count(run.lines, BUILD_IN_LIVE_TREE)).toBe(0);

			// Three seconds of build and not one request failed during them: every failure is after the stop.
			const stopAt = Number(w.events().slice(run.mark)[stopped]!.t) * 1000;
			const builtAt = Number(w.events().slice(run.mark)[built]!.t) * 1000;
			expect(stopAt - builtAt).toBeLessThan(10_000);
			expect(run.customers.total).toBeGreaterThan(100);
			expect(Math.min(...run.customers.failures.map((failure) => failure.at))).toBeGreaterThanOrEqual(
				stopAt - 250,
			);
			const failingFor =
				Math.max(...run.customers.failures.map((f) => f.at)) -
				Math.min(...run.customers.failures.map((f) => f.at));
			expect(failingFor, "the gap is the few seconds the server takes to boot").toBeLessThan(8_000);

			const [snapshot] = snapshots(w);
			expect(snapshot).toMatch(/^\.next\.rollback-0000000-old-build-/);
			expect(treeSignature(join(w.rollbacks, snapshot ?? ""))).toBe(before);
			expect(liveBuildId(w)).not.toBe("old-build");
			expect(existsSync(w.build)).toBe(false);
			expect(run.lines).toContain(`sudo rmdir -- ${w.build}`);
			expect(w.pm2(BRIDGE_APP)).toBe("absent");
			const log = readFileSync(w.env.DEPLOY_LOG!, "utf8");
			expect(log).toContain("flow:     restart");
			expect(log).toMatch(/probes:   \d+ of \d+ probe requests failed/);
		},
		SLOW,
	);

	it(
		"leaves the live site alone when the build fails",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			w.setCtl("build-fail");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"restores the old build when the new one fails its gate",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			w.setCtl("next-behavior", "css404in=app\n");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("deploy failed before the commit point");
			expect(run.out).toContain("previous build is back up");
			expect(liveBuildId(w)).toBe("old-build");
			expect(liveTree(w)).toBe(before);
			expect(snapshots(w)).toEqual([]);
			expect(w.pm2(LIVE_APP)).toBe("online");
			expect(existsSync(w.build)).toBe(false);
			expect((await fetch(`${w.canonicalUrl}/sk`)).status).toBe(200);
		},
		SLOW,
	);

	it(
		"refuses --mode bridge until nginx has been prepared once",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["--mode", "bridge"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("needs nginx prepared once");
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"prints the plan on a dry run and changes nothing",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["--dry-run"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("Flow: restart");
			expect(run.out).toContain(`register ${LIVE_APP} afresh from a clean environment`);
			expect(count(run.lines, /^pnpm build /)).toBe(0);
			expect(count(run.lines, /^pm2 (stop|start|delete|restart)/)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"rehearses without nginx being prepared at all",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["--rehearse"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("rehearsal passed");
			expect(plain(run.out)).toMatch(CLEAN_ENVIRONMENT_REPORT("the bridge"));
			expect(count(run.lines, /^(nginx|systemctl) /)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
			// A rehearsal touches nothing of the live process, its record and what it holds included.
			for (const name of POLLUTION) expect(w.processEnvNames(LIVE_APP)).toContain(name);
		},
		SLOW,
	);
});

describe("deploy-production.sh, classic: the old flow stays as the fallback", () => {
	it(
		"still stops, builds in place and starts",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["--classic", "-m", "fixture deploy"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("switching with: classic");
			inOrder(run.lines, PM2_STOP_LIVE, BUILD_IN_LIVE_TREE, PM2_START_LIVE);
			expect(count(run.lines, BUILD_IN_SCRATCH)).toBe(0);
			expect(existsSync(w.build)).toBe(false);
			expect(liveBuildId(w)).not.toBe("old-build");
			expect(deployMeta(w).build_id).toBe(liveBuildId(w));
			const [snapshot] = snapshots(w);
			expect(treeSignature(join(w.rollbacks, snapshot ?? ""))).toBe(before);
			expect(readFileSync(w.env.DEPLOY_LOG!, "utf8")).toContain("flow:     classic");
		},
		SLOW,
	);

	it(
		"still puts the old build back when the build fails",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			w.setCtl("build-fail");
			const run = await deployUnderLoad(w, ["--classic", "-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("previous build is back up");
			expect(liveBuildId(w)).toBe("old-build");
			expect(liveTree(w)).toBe(before);
			expect(snapshots(w)).toEqual([]);
			expect(w.pm2(LIVE_APP)).toBe("online");
		},
		SLOW,
	);
});

describe("deploy-production.sh, the environment a process is registered with", () => {
	it(
		"registers the live process afresh in the restart flow too, and says what it was started with",
		async () => {
			const w = await plainWorld();
			for (const name of POLLUTION) expect(w.processEnvNames(LIVE_APP)).toContain(name);
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("switching with: restart");
			inOrder(run.lines, PM2_STOP_LIVE, PM2_DELETE_LIVE, PM2_START_LIVE);
			expect(run.lines.find((line) => PM2_START_LIVE.test(line))).toMatch(/\[secret-visible=no\]$/);
			for (const name of POLLUTION) expect(w.processEnvNames(LIVE_APP)).not.toContain(name);
			expect(plain(run.out)).toMatch(CLEAN_ENVIRONMENT_REPORT(LIVE_APP));
			for (const value of POLLUTION_VALUES) expect(run.out).not.toContain(value);
		},
		SLOW,
	);

	it(
		"registers the live process afresh in the classic flow too",
		async () => {
			const w = await plainWorld();
			const run = await deployUnderLoad(w, ["--classic", "-m", "x"]);

			expect(run.code, run.out).toBe(0);
			inOrder(run.lines, PM2_STOP_LIVE, BUILD_IN_LIVE_TREE, PM2_DELETE_LIVE, PM2_START_LIVE);
			for (const name of POLLUTION) expect(w.processEnvNames(LIVE_APP)).not.toContain(name);
			expect(plain(run.out)).toMatch(CLEAN_ENVIRONMENT_REPORT(LIVE_APP));
		},
		SLOW,
	);

	it(
		"keeps the logs of the record it replaces, so the market read-back still reads this boot's",
		async () => {
			const w = await bridgeWorld();
			// A live process whose logs are not where PM2 would put them.
			const out = join(w.root, "elsewhere-out.log");
			const err = join(w.root, "elsewhere-error.log");
			expect(pm2(w, "delete", LIVE_APP).status).toBe(0);
			expect(
				pm2(
					w,
					"start",
					"npm",
					"--name",
					LIVE_APP,
					"--cwd",
					w.app,
					"--output",
					out,
					"--error",
					err,
					"--",
					"start",
					"--",
					"-p",
					String(w.ports.canonical),
				).status,
			).toBe(0);
			await waitForHttp(`${w.canonicalUrl}/sk`);
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("POST_DEPLOY_FAILED: none");
			const registered = run.lines.find((line) => PM2_START_LIVE.test(line)) ?? "";
			expect(registered).toContain(` --output ${out} --error ${err} -- start -- `);
			// The new process wrote its boot lines to the same file, and the read-back found them there.
			expect(read(out)).toContain("[market-state]");
			expect(run.out).toContain("[market-state] live=sk");
			expect(run.out).toContain("indexable markets confirmed: sk");
		},
		SLOW,
	);

	it(
		"warns, with names only, when what a process was started with looks like a credential or hides .env",
		async () => {
			const w = await bridgeWorld();
			// Whatever PM2 itself hands over (its daemon's environment, say) lands in a process however clean the registration.
			w.setCtl(
				"pm2-leak-env",
				"CLAUDE_FAKE_DAEMON_LEAK=leaked-value\nSOME_SETTING=leaked-over-the-env-file\n",
			);
			const run = await deployUnderLoad(w, ["-m", "x"]);

			// Warn-only: the build passed its gate, and what it was started with is something to read, not a reason to throw it away.
			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("POST_DEPLOY_FAILED: none");
			// Exactly these lines, and nothing more on them: a count, names, and no value.
			const said = plain(run.out).split("\n");
			expect(said.filter((line) => line.startsWith("==> environment of"))).toEqual(
				["the bridge", LIVE_APP].map((who) =>
					expect.stringMatching(new RegExp(`^==> environment of ${who} \\(pid \\d+\\): \\d+ names$`)),
				),
			);
			expect(said.filter((line) => line.startsWith("warn: environment of"))).toEqual(
				["the bridge", LIVE_APP].flatMap((who) => [
					`warn: environment of ${who}: 1 names look like credentials and are not .env's: CLAUDE_FAKE_DAEMON_LEAK (names only; PM2 copies the environment of the shell that registers a process, CLAUDE.md §13.2.1)`,
					`warn: environment of ${who}: 1 names are defined in .env too, and the value the process was started with wins: SOME_SETTING`,
				]),
			);
			for (const value of ["leaked-value", "leaked-over-the-env-file"]) expect(run.out).not.toContain(value);
			// What it said is what is there.
			expect(w.processEnvNames(LIVE_APP)).toContain("CLAUDE_FAKE_DAEMON_LEAK");
		},
		SLOW,
	);

	it(
		"finds the live process by its directory, not by the name next-server, which maky-smtp-app has too",
		async () => {
			const w = await bridgeWorld();
			// Started after the live process, so before the new one: a finder that takes the first next-server takes this one.
			const smtp = await w.startSmtpApp();
			expect(read(`/proc/${smtp}/comm`)).toMatch(/^next-server/);
			expect(w.processEnvNames("maky-smtp-app")).toContain("SMTP_FAKE_PASSWORD");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			const reported = Number(/environment of maky-storefront \(pid (\d+)\)/.exec(run.out)?.[1]);
			expect(reported).toBe(w.pid(LIVE_APP));
			expect(reported).not.toBe(smtp);
			expect(plain(run.out)).toMatch(CLEAN_ENVIRONMENT_REPORT(LIVE_APP));
			expect(run.out).not.toContain("SMTP_FAKE_PASSWORD");
			// And the other service was not touched.
			expect(w.pm2("maky-smtp-app")).toBe("online");
			expect(w.pid("maky-smtp-app")).toBe(smtp);
			expect(run.lines.filter((line) => line.includes("maky-smtp-app"))).toEqual([]);
		},
		SLOW,
	);

	it("finds the server whose working directory it is asked for, whatever order the process table lists them in", async () => {
		const w = await plainWorld();
		const smtp = join(w.root, "smtp");
		const elsewhere = join(w.root, "elsewhere");
		for (const dir of [smtp, elsewhere]) mkdirSync(dir, { recursive: true });
		// What /proc/<pid>/comm holds of `next-server (v16.3.6)`: the first fifteen characters.
		const server = "next-server (v1";
		let tables = 0;
		const find = (processes: { pid: number; comm: string; cwd?: string }[]) => {
			const root = processTable(join(w.root, `proc-${++tables}`), processes);
			return w.call(["server_pid_in", w.app], { PROC_ROOT: root });
		};

		// maky-smtp-app, first and then last: a finder that takes the first next-server takes it in one of the two.
		expect(
			find([
				{ pid: 100, comm: server, cwd: smtp },
				{ pid: 200, comm: server, cwd: w.app },
			]),
		).toEqual({ code: 0, out: "200\n" });
		expect(
			find([
				{ pid: 100, comm: server, cwd: w.app },
				{ pid: 200, comm: server, cwd: smtp },
			]),
		).toEqual({ code: 0, out: "100\n" });
		// Several others, one of them with a pid that sorts before the live one as text (the table is read in text order).
		expect(
			find([
				{ pid: 999, comm: server, cwd: smtp },
				{ pid: 1000, comm: server, cwd: w.app },
				{ pid: 1001, comm: server, cwd: elsewhere },
			]),
		).toEqual({ code: 0, out: "1000\n" });
		// Something else that was started in the directory is not the server.
		expect(
			find([
				{ pid: 50, comm: "bash", cwd: w.app },
				{ pid: 60, comm: server, cwd: w.app },
			]),
		).toEqual({ code: 0, out: "60\n" });
		// Nothing of ours there, or a process whose directory cannot be read: not found, and nothing printed.
		expect(find([{ pid: 100, comm: server, cwd: smtp }])).toEqual({ code: 1, out: "" });
		expect(find([{ pid: 70, comm: server }])).toEqual({ code: 1, out: "" });
	});

	it("reads the names a process was started with and never a value, however the value is written", async () => {
		const w = await plainWorld();
		const records = [
			"PLAIN=1",
			"CLAUDE_FAKE_KEY=-----BEGIN FAKE KEY-----\nsecret_part_one=line-one\nsecret_part_two=line-two\n-----END FAKE KEY-----",
			"WITH_EQUALS=a=b=c",
			"EMPTY=",
			"not-a-name=1",
			"=nameless",
			"NO_VALUE_AT_ALL",
		];
		const root = processTable(join(w.root, "proc"), [
			{
				pid: 321,
				comm: "next-server (v1",
				cwd: w.app,
				environ: `${records.join("\0")}\0TRAILING=without-a-final-nul`,
			},
		]);
		const names = w.call(["process_env_names", "321"], { PROC_ROOT: root });

		expect(names.code).toBe(0);
		// A value that holds newlines (a key) is cut at the NUL that ends it, not at its lines.
		expect(names.out.split("\n").filter(Boolean)).toEqual([
			"CLAUDE_FAKE_KEY",
			"EMPTY",
			"PLAIN",
			"TRAILING",
			"WITH_EQUALS",
		]);
		for (const fragment of [
			"secret_part",
			"line-one",
			"BEGIN FAKE KEY",
			"a=b=c",
			"without-a-final-nul",
			"nameless",
		]) {
			expect(names.out).not.toContain(fragment);
		}
		// A process that cannot be read gives no names and a failing status, which the report words as "cannot be read".
		expect(w.call(["process_env_names", "999"], { PROC_ROOT: root }).code).toBe(1);
	});

	it(
		"warns before the build about names the shell exports and .env defines, and prints no value",
		async () => {
			const w = await plainWorld();
			const run = await w.run(["--dry-run"], {
				SOME_SETTING: "value-from-the-shell",
				NEXT_PUBLIC_FIXTURE_FLAG: "other-value-from-the-shell",
			});

			expect(run.code, run.out).toBe(0);
			expect(plain(run.out)).toContain(
				`warn: this shell exports 2 names that ${w.app}/.env defines too, and the shell's value wins over .env in the build: NEXT_PUBLIC_FIXTURE_FLAG SOME_SETTING`,
			);
			expect(run.out).not.toContain("value-from-the-shell");

			const quiet = await w.run(["--dry-run"]);
			expect(quiet.code, quiet.out).toBe(0);
			expect(quiet.out).not.toContain("names that");
		},
		SLOW,
	);

	it(
		"falls back to the record PM2 holds when PM2 will not delete it, and the old build is back",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl(`pm2-fail-delete-${LIVE_APP}`);
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain(`pm2 could not delete the old record of ${LIVE_APP}`);
			expect(run.out).toContain("previous build is back up");
			expect(run.customers.failures, JSON.stringify(run.customers.failures)).toEqual([]);
			expect(liveBuildId(w)).toBe("old-build");
			expect(liveTree(w)).toBe(before);
			expect(w.pm2(LIVE_APP)).toBe("online");
			expect(w.pm2(BRIDGE_APP)).toBe("absent");
			expect(upstreamState(w)).toBe("canonical-only");
			// The fallback is the record it already had: a live process whose environment is not clean is better than none.
			expect(w.processEnvNames(LIVE_APP)).toContain("CLAUDE_FAKE_SECRET");
		},
		SLOW,
	);
});

describe("deploy-production.sh, refusals before anything changes", () => {
	it(
		"does not deploy while the test suite fails",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			w.setCtl("tests-fail");
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("the test suite fails");
			expect(count(run.lines, /^pnpm build /)).toBe(0);
			expect(count(run.lines, NGINX_RELOAD)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it(
		"does not deploy when the bridge port is taken by something else",
		async () => {
			const w = await bridgeWorld();
			const before = liveTree(w);
			const squatter = createServer();
			await new Promise<void>((resolve) => squatter.listen(w.ports.bridge, "127.0.0.1", resolve));
			try {
				const run = await deployUnderLoad(w, ["-m", "x"]);
				expect(run.code, run.out).toBe(1);
				expect(run.out).toContain(`port ${w.ports.bridge} is in use`);
				expect(count(run.lines, /^pnpm build /)).toBe(0);
				expectLiveSiteUntouched(w, before, run);
			} finally {
				await new Promise((resolve) => squatter.close(resolve));
			}
		},
		SLOW,
	);

	it(
		"will not build over a directory that is not its own scratch tree, and clears one that is",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			mkdirSync(w.build);
			writeFileSync(join(w.build, "somebody-elses-file"), "keep me\n");

			const refused = await deployUnderLoad(w, ["-m", "x"]);
			expect(refused.code, refused.out).toBe(1);
			expect(refused.out).toContain("is not a scratch tree of this script");
			expect(readFileSync(join(w.build, "somebody-elses-file"), "utf8")).toBe("keep me\n");
			expect(liveTree(w)).toBe(before);
			expect(count(refused.lines, /^pnpm build /)).toBe(0);
			expect(
				count(refused.lines, /^sudo rm(dir)? /),
				"a directory that is not its own is never removed",
			).toBe(0);

			// A tree this script left behind (it carries the marker) is cleared and the deploy goes on.
			writeFileSync(join(w.build, ".maky-scratch"), "");
			const cleared = await deployUnderLoad(w, ["-m", "x"]);
			expect(cleared.code, cleared.out).toBe(0);
			expect(cleared.out).toContain("removing a scratch tree left by an earlier run");
			expect(existsSync(join(w.build, "somebody-elses-file"))).toBe(false);
			// Once for the leftover, once when this run was done with its own: /opt is root's, so the directory itself goes with sudo.
			expect(cleared.lines.filter((line) => line === `sudo rmdir -- ${w.build}`)).toHaveLength(2);
			expect(count(cleared.lines, /^sudo rm -rf? /)).toBe(0);
		},
		SLOW,
	);

	it(
		"clears an empty directory where the scratch tree goes, as a plain rm -rf by the deploy user leaves it",
		async () => {
			const w = await plainWorld();
			mkdirSync(w.build);
			const run = await deployUnderLoad(w, ["-m", "x"]);

			expect(run.code, run.out).toBe(0);
			expect(run.out).toContain("removing an empty");
			expect(existsSync(w.build)).toBe(false);
		},
		SLOW,
	);

	it(
		"will not use a scratch directory inside the live one",
		async () => {
			const w = await plainWorld();
			const before = liveTree(w);
			const run = await deployUnderLoad(w, ["-m", "x"], { BUILD_DIR: join(w.app, "scratch") });

			expect(run.code, run.out).toBe(1);
			expect(run.out).toContain("is inside APP_DIR");
			expectLiveSiteUntouched(w, before, run);
		},
		SLOW,
	);

	it("explains itself", async () => {
		const w = await plainWorld();
		const help = await w.run(["--help"]);

		expect(help.code, help.out).toBe(0);
		expect(help.out).toContain("Exit codes");
		expect(help.out).toContain("--rehearse");
		expect(help.out).not.toContain("set -euo pipefail");
		const unknown = await w.run(["--mode", "sideways"]);
		expect(unknown.code).toBe(1);
		expect(unknown.out).toContain("unknown mode 'sideways'");
	});
});
