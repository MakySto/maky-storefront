import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createWorld, waitForHttp, type World } from "./__fixtures__/deploy-world/world";

/**
 * scripts/ops/nginx-upstream.sh against a box whose nginx is a small program that reads the same
 * files and answers the same way: `nginx -t` refuses a site file that names an upstream nobody
 * defined, a reload takes effect a moment after it returns, and a request through the loopback
 * listener names, in X-Maky-Upstream, every server that was tried.
 */

let world: World | undefined;
afterEach(async () => {
	await world?.dispose();
	world = undefined;
});

async function box(): Promise<World> {
	world = await createWorld();
	return world;
}

const read = (path: string) => readFileSync(path, "utf8");
const state = (w: World) => /^# state: (.+)$/m.exec(read(w.upstreamFile))?.[1];
const backups = (w: World) =>
	readdirSync(dirname(w.siteFile)).filter((name) => name.startsWith("storefront.conf.pre-upstream-"));
const canonical = (w: World) => `127.0.0.1:${w.ports.canonical}`;
const bridge = (w: World) => `127.0.0.1:${w.ports.bridge}`;
const probe = (w: World) => w.tool(["probe"]).out.trim();

/** The bridge, as the deploy script starts it: a second server of the same app on its own port. */
async function startBridge(w: World) {
	const started = spawnSync(
		"pm2",
		[
			"start",
			"npm",
			"--name",
			"maky-storefront-bridge",
			"--cwd",
			w.app,
			"--",
			"start",
			"--",
			"-p",
			String(w.ports.bridge),
		],
		{ env: w.env },
	);
	expect(started.status).toBe(0);
	await waitForHttp(`http://${bridge(w)}/sk`);
}

async function preparedBox(): Promise<World> {
	const w = await box();
	const installed = w.installNginx();
	expect(installed.code, installed.out).toBe(0);
	return w;
}

describe("nginx-upstream.sh: installing", () => {
	it("says a box that has not been prepared is not", async () => {
		const w = await box();
		const status = w.tool(["status"]);

		expect(status.code).toBe(2);
		expect(status.out).toContain("state=absent");
		expect(status.out).toContain("site-wired=no");
		expect(w.tool(["set", "bridge-primary"]).code).toBe(1);
	});

	it("shows what it would change on a dry run, and changes nothing", async () => {
		const w = await box();
		const site = read(w.siteFile);
		const result = w.tool(["setup"]);

		expect(result.code, result.out).toBe(0);
		expect(result.out).toContain("proxy_pass http://maky_storefront;");
		expect(result.out).toContain("dry run");
		expect(read(w.siteFile)).toBe(site);
		expect(existsSync(w.upstreamFile)).toBe(false);
		expect(backups(w)).toEqual([]);
	});

	it("installs once: one line of the site file, one managed file, a backup, and the same answer as before", async () => {
		const w = await box();
		const original = read(w.siteFile);
		const result = w.installNginx();

		expect(result.code, result.out).toBe(0);
		const site = read(w.siteFile);
		expect(site.match(/proxy_pass/g)).toHaveLength(1);
		expect(site).toContain("proxy_pass http://maky_storefront;");
		expect(site).not.toContain(`proxy_pass http://${canonical(w)}`);
		// Everything else in the site file is as it was.
		expect(site.replace("http://maky_storefront;", `http://${canonical(w)};`)).toBe(original);

		const upstream = read(w.upstreamFile);
		expect(state(w)).toBe("canonical-only");
		expect(upstream).toContain(`server ${canonical(w)};`);
		expect(upstream).not.toContain("backup");
		expect(upstream).toContain(`listen 127.0.0.1:${w.ports.probe};`);
		expect(upstream).toContain("add_header X-Maky-Upstream $upstream_addr always;");

		expect(backups(w)).toHaveLength(1);
		expect(read(join(dirname(w.siteFile), backups(w)[0]!))).toBe(original);
		// No half-written file is left where an include glob could find it.
		expect(
			readdirSync(dirname(w.siteFile)).filter(
				(name) => /\.new$|\.tmp$/.test(name) && !name.startsWith("running"),
			),
		).toEqual([]);

		expect(probe(w)).toBe(`200 ${canonical(w)}`);
		const status = w.tool(["status"]);
		expect(status.code).toBe(0);
		expect(status.out).toContain("state=canonical-only");
		expect(status.out).toContain("site-wired=yes");
	});

	it("does nothing the second time", async () => {
		const w = await preparedBox();
		const again = w.tool(["setup", "--apply"]);

		expect(again.code, again.out).toBe(0);
		expect(again.out).toContain("already installed");
		expect(backups(w)).toHaveLength(1);
	});

	it("puts the original back, and says so, when nginx refuses the new configuration", async () => {
		const w = await box();
		const original = read(w.siteFile);
		w.setCtl("nginx-t-fail-when-canonical-only");
		const result = w.tool(["setup", "--apply"]);

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("putting the original back");
		expect(result.out).toContain("original configuration is back and loaded");
		expect(read(w.siteFile)).toBe(original);
		expect(existsSync(w.upstreamFile)).toBe(false);
	});

	it("says nginx may be in an unknown state when even the original will not load", async () => {
		const w = await box();
		const original = read(w.siteFile);
		w.setCtl("nginx-t-fail");
		const result = w.tool(["setup", "--apply"]);

		expect(result.code, result.out).toBe(2);
		expect(result.out).toContain("nginx may be in an unknown state");
		// Even so the files on disk are the original ones, so the next `nginx -t` finds nothing of ours.
		expect(read(w.siteFile)).toBe(original);
		expect(existsSync(w.upstreamFile)).toBe(false);
	});

	it("puts the original back when nginx accepts the file but does not take it", async () => {
		const w = await box();
		const original = read(w.siteFile);
		w.setCtl("reload-noop");
		const result = w.tool(["setup", "--apply"], { VERIFY_TIMEOUT_S: "2" });

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("putting the original back");
		expect(read(w.siteFile)).toBe(original);
		expect(existsSync(w.upstreamFile)).toBe(false);
	});

	it("refuses a site file it does not understand", async () => {
		const w = await box();
		const original = read(w.siteFile);
		writeFileSync(w.siteFile, `${original}\n# a second one\n    proxy_pass http://${canonical(w)};\n`);
		const edited = read(w.siteFile);
		const result = w.tool(["setup", "--apply"]);

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("expected exactly one");
		expect(read(w.siteFile)).toBe(edited);
		expect(existsSync(w.upstreamFile)).toBe(false);
	});

	it("refuses when the loopback port is taken", async () => {
		const w = await box();
		const squatter = createServer();
		await new Promise<void>((resolve) => squatter.listen(w.ports.probe, "127.0.0.1", resolve));
		try {
			const result = w.tool(["setup", "--apply"]);
			expect(result.code, result.out).toBe(1);
			expect(result.out).toContain("is already in use");
			expect(existsSync(w.upstreamFile)).toBe(false);
		} finally {
			await new Promise((resolve) => squatter.close(resolve));
		}
	});

	it("refuses to build on a half-installed box, and says how to get out", async () => {
		const w = await preparedBox();
		// The site file is back to the original but the managed file is still there.
		writeFileSync(w.siteFile, read(join(dirname(w.siteFile), backups(w)[0]!)));
		const partly = w.tool(["status"]);
		expect(partly.code).toBe(3);

		const result = w.tool(["setup", "--apply"]);
		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("revert --apply");
		expect(w.tool(["set", "bridge-primary"]).code).toBe(1);
	});

	it("goes back to the original with revert, and a dry run of revert changes nothing", async () => {
		const w = await preparedBox();
		const prepared = read(w.siteFile);
		const original = read(join(dirname(w.siteFile), backups(w)[0]!));

		const dry = w.tool(["revert"]);
		expect(dry.code, dry.out).toBe(0);
		expect(dry.out).toContain("dry run");
		expect(read(w.siteFile)).toBe(prepared);
		expect(existsSync(w.upstreamFile)).toBe(true);

		const done = w.tool(["revert", "--apply"]);
		expect(done.code, done.out).toBe(0);
		expect(read(w.siteFile)).toBe(original);
		expect(existsSync(w.upstreamFile)).toBe(false);
	});

	it("has nothing to revert on a box it never touched", async () => {
		const w = await box();
		const result = w.tool(["revert", "--apply"]);

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("no ");
		expect(result.out).toContain("pre-upstream-");
	});
});

describe("nginx-upstream.sh: switching", () => {
	it("moves customers to the bridge and back, and each answer comes from the process the state names", async () => {
		const w = await preparedBox();
		await startBridge(w);

		const toBridge = w.tool(["set", "bridge-primary"]);
		expect(toBridge.code, toBridge.out).toBe(0);
		expect(state(w)).toBe("bridge-primary");
		expect(read(w.upstreamFile)).toContain(`server ${bridge(w)};`);
		expect(read(w.upstreamFile)).toContain(`server ${canonical(w)} backup;`);
		expect(probe(w)).toBe(`200 ${bridge(w)}`);

		const back = w.tool(["set", "canonical-only"]);
		expect(back.code, back.out).toBe(0);
		expect(state(w)).toBe("canonical-only");
		expect(probe(w)).toBe(`200 ${canonical(w)}`);
	});

	it("is a repair when asked for the state it already has", async () => {
		const w = await preparedBox();
		const result = w.tool(["set", "canonical-only"]);

		expect(result.code, result.out).toBe(0);
		expect(state(w)).toBe("canonical-only");
		// It tested and reloaded anyway: that is what makes it the repair for a run that died between file and reload.
		const events = w.events().map((event) => event.text);
		expect(events.filter((text) => /^systemctl reload nginx/.test(text)).length).toBeGreaterThanOrEqual(2);
	});

	it("keeps customers served by the live process if the bridge dies while it is in front", async () => {
		const w = await preparedBox();
		await startBridge(w);
		expect(w.tool(["set", "bridge-primary"]).code).toBe(0);

		expect(spawnSync("pm2", ["stop", "maky-storefront-bridge"], { env: w.env }).status).toBe(0);
		// nginx tries the bridge, cannot reach it, and falls back to the live process: still a 200.
		expect(probe(w)).toBe(`200 ${bridge(w)}, ${canonical(w)}`);
	});

	it("puts the previous file back when the bridge is not there to take customers", async () => {
		const w = await preparedBox();
		const result = w.tool(["set", "bridge-primary"], { VERIFY_TIMEOUT_S: "2" });

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("putting the previous file back");
		expect(result.out).toContain(`previous file is back and loaded: customers are served by ${canonical(w)}`);
		expect(state(w)).toBe("canonical-only");
		// Not "soon": by the time the tool returns, nginx is answering from where it answered before.
		expect(probe(w)).toBe(`200 ${canonical(w)}`);
	});

	it("puts the previous file back when nginx refuses the configuration", async () => {
		const w = await preparedBox();
		await startBridge(w);
		w.setCtl("nginx-t-fail-when-bridge-primary");
		const result = w.tool(["set", "bridge-primary"]);

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain("nginx -t refused the configuration");
		expect(state(w)).toBe("canonical-only");
		expect(probe(w)).toBe(`200 ${canonical(w)}`);
	});

	it("notices that nginx accepted a reload but went on with the old configuration", async () => {
		const w = await preparedBox();
		await startBridge(w);
		w.setCtl("reload-noop");
		const result = w.tool(["set", "bridge-primary"], { VERIFY_TIMEOUT_S: "2" });

		expect(result.code, result.out).toBe(1);
		expect(result.out).toContain(`wanted 200 via ${bridge(w)}`);
		expect(state(w)).toBe("canonical-only");
	});

	it("says it does not know what nginx is doing when nothing will load, and leaves the old file on disk", async () => {
		const w = await preparedBox();
		await startBridge(w);
		const before = read(w.upstreamFile);
		w.setCtl("nginx-t-fail");
		const result = w.tool(["set", "bridge-primary"]);

		expect(result.code, result.out).toBe(2);
		expect(result.out).toContain("nginx may be in an unknown state");
		expect(read(w.upstreamFile)).toBe(before);
	});

	it("says so when the reload itself fails", async () => {
		const w = await preparedBox();
		await startBridge(w);
		const before = read(w.upstreamFile);
		w.setCtl("reload-fail");
		const result = w.tool(["set", "bridge-primary"]);

		expect(result.code, result.out).toBe(2);
		expect(read(w.upstreamFile)).toBe(before);
	});

	it("refuses a state it does not know", async () => {
		const w = await preparedBox();
		const result = w.tool(["set", "sideways"]);

		expect(result.code).toBe(1);
		expect(result.out).toContain("usage");
		expect(state(w)).toBe("canonical-only");
	});

	it("explains itself", async () => {
		const w = await box();
		const help = w.tool(["--help"]);

		expect(help.code, help.out).toBe(0);
		expect(help.out).toContain("Exit codes");
		expect(help.out).toContain("setup --apply");
		expect(help.out).not.toContain("set -euo pipefail");
		expect(w.tool(["bogus"]).code).toBe(1);
	});
});
