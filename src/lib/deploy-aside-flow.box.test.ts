import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
const PM2_START_LIVE = /^pm2 start maky-storefront \[/;
const PM2_START_BRIDGE = /^pm2 start npm --name maky-storefront-bridge /;
const PM2_DELETE_BRIDGE = /^pm2 delete maky-storefront-bridge/;
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
	return {
		...result,
		customers,
		lines: w
			.events()
			.slice(mark)
			.map((event) => event.text),
		mark,
	};
}

type Run = Awaited<ReturnType<typeof deployUnderLoad>>;

/** What a deploy that stopped before it touched the live process has to look like afterwards. */
function expectLiveSiteUntouched(w: World, before: string, run: Run) {
	expect(
		run.lines.filter((line) => PM2_STOP_LIVE.test(line) || PM2_START_LIVE.test(line)),
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
				PM2_START_LIVE,
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

			// The bridge runs on a clean environment; the live process, as always, on whatever started it.
			const bridgeStart = run.lines.find((line) => PM2_START_BRIDGE.test(line)) ?? "";
			expect(bridgeStart).toContain("secret-visible=no");
			expect(bridgeStart).toContain(`-p ${w.ports.bridge} -H 127.0.0.1`);
			expect(run.lines.find((line) => PM2_STOP_LIVE.test(line))).toContain("secret-visible=yes");

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

			// The recovery the message prints: repair the live process, move customers back, remove the bridge.
			w.clearCtl("pm2-fail-start-maky-storefront");
			expect(pm2(w, "start", LIVE_APP).status).toBe(0);
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
			expect(count(run.lines, /^(nginx|systemctl) /)).toBe(0);
			expectLiveSiteUntouched(w, before, run);
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
