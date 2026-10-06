import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = readFileSync(
	fileURLToPath(new URL("../../scripts/ops/deploy-production.sh", import.meta.url)),
	"utf8",
);

/** One function of the deploy script as written: from `name() {` to the first `}` in column 0. */
function shellFunction(name: string): string {
	const found = SCRIPT.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"));
	if (!found) throw new Error(`scripts/ops/deploy-production.sh no longer defines ${name}()`);
	return found[0];
}

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Runs the script's own `verify_external` — the post-deploy check of nginx, the public page and the
 * public stylesheet — against a fake `curl`. `served` is what each URL answers as curl's
 * `-w '%{http_code} %{size_download}'` prints it; `cssOnDisk` is the size of the stylesheet in the
 * build, or `null` when the file is absent.
 */
function verifyExternal(served: { page?: string; css?: string }, cssOnDisk: number | null) {
	const app = mkdtempSync(join(tmpdir(), "maky-verify-external-"));
	dirs.push(app);
	mkdirSync(join(app, ".next/static/chunks"), { recursive: true });
	if (cssOnDisk !== null) writeFileSync(join(app, ".next/static/chunks/fonts.css"), "a".repeat(cssOnDisk));

	const harness = [
		"set -euo pipefail",
		`info() { printf '==> %s\\n' "$*"; }`,
		`warn() { printf 'warn: %s\\n' "$*" >&2; }`,
		"step() { :; }",
		"MIN_ASSET_BYTES=1000",
		"EXTERNAL_RETRIES=2",
		"EXTERNAL_RETRY_SLEEP_S=0",
		"PUBLIC_HOST=maky.store",
		"PUBLIC_URL=https://maky.store",
		"NGINX_LOCAL_IP=127.0.0.1",
		"SMOKE_PATH=/sk",
		`APP_DIR='${app}'`,
		"CSS_PATH=/_next/static/chunks/fonts.css",
		`curl() { case "\${*: -1}" in *.css) printf '%s' "$FAKE_CSS" ;; *) printf '%s' "$FAKE_PAGE" ;; esac; }`,
		shellFunction("fetch_ok"),
		shellFunction("check_external"),
		shellFunction("verify_external"),
		"set +e",
		"verify_external",
		`echo "rc=$?"`,
	].join("\n");

	const result = spawnSync("bash", ["-c", harness], {
		encoding: "utf8",
		env: { ...process.env, FAKE_PAGE: served.page ?? "200 50000", FAKE_CSS: served.css ?? "200 478" },
	});
	return {
		rc: Number(/rc=(\d+)/.exec(result.stdout)?.[1] ?? NaN),
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

/**
 * The deploy of 2026-10-05 and again 2026-10-06 ended with exit 75 although the build was fine: the
 * public stylesheet check took the first stylesheet of the page, a 478 B file holding only the
 * `@font-face` rules, and held it to a 1 000 B floor. A chunk can be that small. The public check now
 * compares the served body with the file in the build, which is what the local gate already did.
 */
describe.skipIf(process.platform !== "linux")("deploy-production.sh verify_external", () => {
	it("accepts a tiny stylesheet when it is the build's own file", () => {
		const run = verifyExternal({ css: "200 478" }, 478);
		expect(run.rc).toBe(0);
		expect(run.stdout).toContain("(478 B, matches build)");
	});

	it("accepts the main stylesheet at its real size", () => {
		expect(verifyExternal({ css: "200 178593" }, 178593).rc).toBe(0);
	});

	it("rejects an empty stylesheet", () => {
		const run = verifyExternal({ css: "200 0" }, 478);
		expect(run.rc).toBe(1);
		expect(run.stderr).toContain("build has 478 B");
	});

	it("rejects the page's HTML answered at the stylesheet's address", () => {
		// The classic failure of a bad URL: 200, a large body, and not a stylesheet.
		expect(verifyExternal({ css: "200 50000" }, 478).rc).toBe(1);
	});

	it("rejects a stylesheet that does not answer 200", () => {
		expect(verifyExternal({ css: "404 0" }, 478).rc).toBe(1);
	});

	it("still holds the pages to the byte floor", () => {
		const run = verifyExternal({ page: "200 10" }, 478);
		expect(run.rc).toBe(1);
		expect(run.stderr).toContain("public page FAILED");
	});

	it("reports a stylesheet that is missing from the build", () => {
		const run = verifyExternal({}, null);
		expect(run.rc).toBe(1);
		expect(run.stderr).toContain("missing or empty on disk");
	});
});
