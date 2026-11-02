import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The B2B app token is a server secret (zadanie 02, §5): never `NEXT_PUBLIC_*`, never the existing
 * `SALEOR_APP_TOKEN`, never in the client bundle, props, browser storage, errors, analytics or logs.
 * A source check, because the bundler would inline a `NEXT_PUBLIC_` name silently and a client import of a server
 * module only fails when `server-only` is reached at build time.
 */

const root = process.cwd();
const src = path.join(root, "src");

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory())
			return name === "__fixtures__" || name === "gql" ? [] : sourceFiles(full);
		return /\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
	});
}

const files = sourceFiles(src).map((file) => ({ file, text: readFileSync(file, "utf8") }));
const rel = (file: string) => path.relative(root, file);

describe("SALEOR_B2B_APP_TOKEN stays on the server", () => {
	it("is read in exactly one module, which is server-only", () => {
		const readers = files.filter(({ text }) =>
			/process\.env\.SALEOR_B2B_APP_TOKEN|process\.env\[["']SALEOR_B2B_APP_TOKEN/.test(text),
		);
		expect(readers.map(({ file }) => rel(file))).toEqual(["src/checkout/lib/b2b/server/b2b-config.ts"]);
		expect(readers[0]!.text).toMatch(/^import "server-only";/m);
	});

	it("no NEXT_PUBLIC_ name for it exists anywhere", () => {
		for (const { file, text } of files) {
			expect(text, rel(file)).not.toMatch(/NEXT_PUBLIC_[A-Z_]*B2B[A-Z_]*TOKEN/);
		}
		const example = readFileSync(path.join(root, ".env.example"), "utf8");
		expect(example).not.toMatch(/NEXT_PUBLIC_[A-Z_]*B2B/);
	});

	it("the token getter is used only by the B2B Saleor client", () => {
		const users = files.filter(({ text }) => /\bb2bAppToken\s*\(/.test(text)).map(({ file }) => rel(file));
		expect(users.sort()).toEqual([
			"src/checkout/lib/b2b/server/b2b-config.ts",
			"src/checkout/lib/b2b/server/b2b-saleor-client.ts",
		]);
	});

	it("every module under b2b/server is server-only", () => {
		const server = files.filter(({ file }) => file.includes(`${path.sep}b2b${path.sep}server${path.sep}`));
		expect(server.length).toBeGreaterThanOrEqual(8);
		for (const { file, text } of server) expect(text, rel(file)).toMatch(/^import "server-only";/m);
	});

	it("no client module imports a B2B server module", () => {
		const clientModules = files.filter(({ text }) => /^\s*["']use client["'];?/m.test(text.slice(0, 200)));
		expect(clientModules.length).toBeGreaterThan(20);
		for (const { file, text } of clientModules) {
			expect(text, rel(file)).not.toMatch(/from\s+["'][^"']*b2b\/server\//);
			expect(text, rel(file)).not.toMatch(/SALEOR_B2B_APP_TOKEN|b2bAppToken/);
		}
	});

	it("the server actions file the browser calls exposes only async functions and no token", () => {
		const actions = readFileSync(path.join(src, "checkout/lib/b2b/actions.ts"), "utf8");
		expect(actions).toMatch(/^"use server";/);
		expect(actions).not.toMatch(/SALEOR_B2B_APP_TOKEN|b2bAppToken/);
		const exported = [
			...actions.matchAll(/^export\s+(async\s+function|function|const|let|class|type)\s+(\w+)/gm),
		];
		for (const [, kind, name] of exported) expect(`${kind} ${name}`).toMatch(/^async function /);
	});

	it("the RSC loader hands the client two booleans, not the config", () => {
		const loader = readFileSync(path.join(src, "checkout/checkout-session-loader.tsx"), "utf8");
		expect(loader).toMatch(/b2bConfig/);
		expect(loader).not.toMatch(/readB2bRuntimeConfig|b2bAppToken/);
	});
});
