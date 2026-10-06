import { spawn, spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A whole deploy box in a temporary directory, for running scripts/ops/deploy-production.sh and
 * scripts/ops/nginx-upstream.sh for real.
 *
 * Nothing is mocked inside the scripts. What stands in for the outside is a set of small programs
 * that do the thing instead of pretending to: the fake `pm2` starts and stops real processes, those
 * processes are real web servers that serve the tree they were started in, the fake `nginx` proxy
 * routes each request by the upstream group it last "loaded", and `systemctl reload` loads it a
 * moment after it returns. So the order of the deploy's steps shows in what a customer's request
 * would have met, and a failure can be injected at any step with a file in `ctl/`.
 *
 * What this cannot show is how real nginx or real PM2 behave; that is the job of
 * `deploy-production.sh --rehearse` and of the first deploy on the box.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
// DEPLOY_SCRIPT_UNDER_TEST points the suite at a modified copy: break a copy on purpose and watch the tests notice.
const DEPLOY_SCRIPT =
	process.env.DEPLOY_SCRIPT_UNDER_TEST ??
	fileURLToPath(new URL("../../../../scripts/ops/deploy-production.sh", import.meta.url));
const NGINX_TOOL = fileURLToPath(new URL("../../../../scripts/ops/nginx-upstream.sh", import.meta.url));

interface RunResult {
	code: number | null;
	out: string;
}

interface LoadResult {
	total: number;
	failures: { status: number | string; at: number }[];
	upstreams: Record<string, number>;
}

interface Load {
	stop(): Promise<LoadResult>;
}

export interface World {
	root: string;
	app: string;
	build: string;
	rollbacks: string;
	siteFile: string;
	upstreamFile: string;
	ports: { canonical: number; bridge: number; probe: number };
	env: NodeJS.ProcessEnv;
	/** The deploy script's own `main`, with only the "not root" check lifted, since the tests may run as root. */
	run(args: string[], extraEnv?: Record<string, string>): Promise<RunResult>;
	/** scripts/ops/nginx-upstream.sh with the same fake box around it. */
	tool(args: string[], extraEnv?: Record<string, string>): RunResult;
	/** Runs `nginx-upstream.sh setup --apply`, which is how a box gets ready for a bridge. */
	installNginx(): RunResult;
	setCtl(name: string, content?: string): void;
	clearCtl(name: string): void;
	/** Adds files to the live checkout and commits them, so that the next build (git archive HEAD) has them. */
	commitFiles(files: Record<string, string>): void;
	events(): { t: number; text: string }[];
	/** Index of the first event matching `pattern` at or after `from`, or -1. */
	indexOf(pattern: RegExp, from?: number): number;
	pm2(name: string): "online" | "stopped" | "absent";
	/** Starts the loop that asks for the page through `url` as a customer would, until stopped. */
	startLoad(url: string): Load;
	canonicalUrl: string;
	/** What customers ask: nginx's loopback listener once nginx is installed, the live process before that. */
	customerUrl(): string;
	dispose(): Promise<void>;
}

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as { port: number };
			server.close(() => resolve(port));
		});
	});
}

function git(cwd: string, ...args: string[]): void {
	const result = spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
		cwd,
		encoding: "utf8",
	});
	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
}

function createApp(app: string): void {
	for (const dir of ["public", "scripts/checks", "node_modules/.pnpm"])
		mkdirSync(join(app, dir), { recursive: true });
	for (const file of [
		"robots.txt",
		"icon.png",
		"apple-icon.png",
		"opengraph-image.png",
		"twitter-image.png",
		"favicon.ico",
		"logo.svg",
	]) {
		writeFileSync(join(app, "public", file), `public file ${file}\n`);
	}
	writeFileSync(join(app, "package.json"), '{"name":"fixture","private":true}\n');
	writeFileSync(join(app, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	writeFileSync(join(app, "node_modules/.pnpm/lock.yaml"), "lockfileVersion: '9.0'\n");
	writeFileSync(join(app, "node_modules/marker.js"), "module.exports = 1;\n");
	writeFileSync(join(app, "scripts/checks/market-language.mjs"), "process.exit(0);\n");
	// The generated GraphQL types are ignored, as in the real repository.
	writeFileSync(
		join(app, ".gitignore"),
		"node_modules\n.next\n.env\n.env.*\nsrc/gql/\nsrc/checkout/graphql/generated/\n",
	);
	writeFileSync(join(app, ".env"), "SOME_SETTING=1\n");
	// Next reads this one at build and at start; the backups are only there to be left behind.
	writeFileSync(join(app, ".env.production"), "SOME_OTHER_SETTING=1\n");
	writeFileSync(join(app, ".env.backup-20260907T191201Z"), "SOME_SETTING=0\n");
	git(app, "init", "-q", "-b", "main");
	git(app, "add", "-A");
	git(app, "commit", "-q", "-m", "fixture storefront");

	// The build that is live before the deploy.
	const next = join(app, ".next");
	mkdirSync(join(next, "static/chunks"), { recursive: true });
	writeFileSync(join(next, "BUILD_ID"), "old-build");
	writeFileSync(join(next, "static/chunks/app-old.css"), "c".repeat(600));
	writeFileSync(join(next, "static/chunks/app-old.js"), "j".repeat(400));
	writeFileSync(
		join(next, "MAKY_DEPLOY_META"),
		"git_sha=0000000000000000000000000000000000000000\nbuild_id=old-build\n",
	);
	writeFileSync(join(next, "required-server-files.json"), JSON.stringify({ appDir: app }));
}

// The `location /` of the real /etc/nginx/conf.d/storefront.conf, which is what nginx-upstream.sh edits.
function siteConfig(canonicalPort: number): string {
	return `server {
    listen 80;
    server_name maky.store www.maky.store;
    return 301 https://maky.store$request_uri;
}

server {
    listen 443 ssl http2;
    server_name maky.store;

    location / {
        proxy_pass http://127.0.0.1:${canonicalPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`;
}

export async function waitForHttp(url: string, seconds = 15): Promise<void> {
	const deadline = Date.now() + seconds * 1000;
	while (Date.now() < deadline) {
		const ok = await new Promise<boolean>((resolve) => {
			http
				.get(url, { agent: false }, (res) => {
					res.resume();
					resolve(res.statusCode === 200);
				})
				.on("error", () => resolve(false));
		});
		if (ok) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error(`${url} never answered 200`);
}

export async function createWorld(): Promise<World> {
	const root = mkdtempSync(join(tmpdir(), "maky-world-"));
	const [canonical, bridge, probe] = [await freePort(), await freePort(), await freePort()];
	const dir = (name: string) => {
		const path = join(root, name);
		mkdirSync(path, { recursive: true });
		return path;
	};
	const bin = dir("bin");
	const fake = dir("fake");
	const ctl = dir("ctl");
	const rollbacks = dir("rollbacks");
	dir("nginx");
	const app = join(root, "app");
	const build = join(root, "build");
	const siteFile = join(root, "nginx/storefront.conf");
	const upstreamFile = join(root, "nginx/maky-storefront-upstream.conf");
	writeFileSync(join(root, "events.log"), "");

	for (const name of readdirSync(join(here, "bin"))) {
		copyFileSync(join(here, "bin", name), join(bin, name));
		chmodSync(join(bin, name), 0o755);
	}
	for (const name of ["fake-app-server.mjs", "fake-nginx-proxy.mjs"])
		copyFileSync(join(here, name), join(fake, name));
	createApp(app);
	writeFileSync(siteFile, siteConfig(canonical));

	const canonicalUrl = `http://127.0.0.1:${canonical}`;
	const env: NodeJS.ProcessEnv = {
		...process.env,
		PATH: `${bin}:${process.env.PATH ?? ""}`,
		FAKE_WORLD: root,
		FAKE_BOOT_MS: "300",
		APP_DIR: app,
		BUILD_DIR: build,
		ROLLBACK_DIR: rollbacks,
		LOCK_FILE: join(root, "deploy.lock"),
		DEPLOY_LOG: join(root, "DEPLOYMENTS.log"),
		BUILD_LOG: join(root, "build.log"),
		PM2_APP: "maky-storefront",
		LOCAL_URL: canonicalUrl,
		BRIDGE_PORT: String(bridge),
		PROBE_ADDR: `127.0.0.1:${probe}`,
		PUBLIC_URL: canonicalUrl,
		PUBLIC_HOST: "maky.store",
		NGINX_TOOL,
		SITE_FILE: siteFile,
		UPSTREAM_FILE: upstreamFile,
		SUDO: "",
		NGINX_BIN: "nginx",
		RELOAD_CMD: "systemctl reload nginx",
		VERIFY_TIMEOUT_S: "5",
		MIN_SITEMAP_URLS: "5",
		MIN_ASSET_BYTES: "200",
		MIN_FREE_MEM_MB: "1",
		MIN_FREE_DISK_MB: "1",
		READY_TIMEOUT_S: "20",
		RESTORE_TIMEOUT_S: "20",
		EXTERNAL_RETRIES: "1",
		EXTERNAL_RETRY_SLEEP_S: "0",
		DRAIN_TIMEOUT_S: "2",
		PROBE_INTERVAL_S: "0.1",
		CLAUDE_FAKE_SECRET: "must-not-reach-the-bridge",
	};
	delete env.DEPLOY_MODE;
	delete env.NEXT_OUTPUT;

	// The live process, started the way production starts it.
	const started = spawnSync(
		join(bin, "pm2"),
		["start", "npm", "--name", "maky-storefront", "--cwd", app, "--", "start", "--", "-p", String(canonical)],
		{ env },
	);
	if (started.status !== 0) throw new Error(`could not start the live fixture: ${started.stderr}`);
	await waitForHttp(`${canonicalUrl}/sk`);

	const events = () =>
		readFileSync(join(root, "events.log"), "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const space = line.indexOf(" ");
				return { t: Number(line.slice(0, space)), text: line.slice(space + 1) };
			});

	let nginxInstalled = false;
	const world: World = {
		root,
		app,
		build,
		rollbacks,
		siteFile,
		upstreamFile,
		ports: { canonical, bridge, probe },
		env,
		canonicalUrl,
		customerUrl: () => (nginxInstalled ? `http://127.0.0.1:${probe}/sk` : `${canonicalUrl}/sk`),

		run(args, extraEnv = {}) {
			const harness = [
				"set -euo pipefail",
				`source "${DEPLOY_SCRIPT}"`,
				"assert_not_root() { :; }",
				'main "$@"',
			].join("\n");
			return new Promise((resolve) => {
				const child = spawn("bash", ["-c", harness, "deploy", ...args], {
					cwd: app,
					env: { ...env, ...extraEnv },
				});
				let out = "";
				child.stdout.on("data", (chunk) => (out += chunk));
				child.stderr.on("data", (chunk) => (out += chunk));
				child.on("close", (code) => resolve({ code, out }));
			});
		},

		tool(args, extraEnv = {}) {
			// The deploy script hands these to the tool itself, derived from LOCAL_URL and BRIDGE_PORT.
			const addresses = { CANONICAL_ADDR: `127.0.0.1:${canonical}`, BRIDGE_ADDR: `127.0.0.1:${bridge}` };
			const result = spawnSync("bash", [NGINX_TOOL, ...args], {
				env: { ...env, ...addresses, ...extraEnv },
				encoding: "utf8",
				timeout: 60_000,
			});
			return { code: result.status, out: `${result.stdout}${result.stderr}` };
		},

		installNginx() {
			env.PUBLIC_URL = `http://127.0.0.1:${probe}`;
			const result = world.tool(["setup", "--apply"]);
			nginxInstalled = result.code === 0;
			return result;
		},

		setCtl(name, content = "1\n") {
			writeFileSync(join(ctl, name), content);
		},
		commitFiles(files) {
			for (const [name, content] of Object.entries(files)) {
				mkdirSync(dirname(join(app, name)), { recursive: true });
				writeFileSync(join(app, name), content);
			}
			git(app, "add", "-A");
			git(app, "commit", "-q", "-m", `fixture: ${Object.keys(files).join(", ")}`);
		},
		clearCtl(name) {
			rmSync(join(ctl, name), { force: true });
		},
		events,
		indexOf(pattern, from = 0) {
			const all = events();
			for (let i = from; i < all.length; i++) if (pattern.test(all[i]!.text)) return i;
			return -1;
		},
		pm2(name) {
			const file = join(root, "pm2", `${name}.status`);
			return existsSync(file) ? (readFileSync(file, "utf8").trim() as "online" | "stopped") : "absent";
		},

		startLoad(url) {
			const results: { status: number | string; at: number; upstream: string }[] = [];
			let running = true;
			const once = () =>
				new Promise<void>((resolve) => {
					let settled = false;
					const finish = (status: number | string, upstream = "") => {
						if (settled) return;
						settled = true;
						results.push({ status, at: Date.now(), upstream });
						resolve();
					};
					const request = http.get(url, { agent: false, timeout: 3000 }, (res) => {
						res.resume();
						res.on("end", () => finish(res.statusCode ?? 0, String(res.headers["x-maky-upstream"] ?? "")));
						res.on("close", () => finish(res.statusCode ?? 0, String(res.headers["x-maky-upstream"] ?? "")));
					});
					request.on("error", (error) => finish((error as NodeJS.ErrnoException).code ?? "error"));
					request.on("timeout", () => request.destroy(new Error("timeout")));
				});
			const client = async () => {
				while (running) {
					await once();
					await new Promise((resolve) => setTimeout(resolve, 15));
				}
			};
			const done = Promise.all([client(), client()]);
			return {
				async stop() {
					running = false;
					await done;
					const upstreams: Record<string, number> = {};
					for (const r of results) if (r.upstream) upstreams[r.upstream] = (upstreams[r.upstream] ?? 0) + 1;
					return {
						total: results.length,
						failures: results.filter((r) => r.status !== 200).map((r) => ({ status: r.status, at: r.at })),
						upstreams,
					};
				},
			};
		},

		async dispose() {
			const pids = [
				...(existsSync(join(root, "pm2"))
					? readdirSync(join(root, "pm2"))
							.filter((f) => f.endsWith(".pid"))
							.map((f) => join(root, "pm2", f))
					: []),
				join(root, "nginx/proxy.pid"),
			];
			for (const file of pids) {
				if (!existsSync(file)) continue;
				const pid = Number(readFileSync(file, "utf8").trim());
				try {
					process.kill(pid, "SIGKILL");
				} catch {
					// already gone
				}
			}
			rmSync(root, { recursive: true, force: true });
		},
	};
	return world;
}
