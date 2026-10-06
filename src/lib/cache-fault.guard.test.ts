import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Nothing may be thrown out of a `"use cache"` function.
 *
 * Next reports every error that leaves a cache function, and fails the static prerender it
 * happens in on that report — whether or not the caller catches the error. A page is prerendered
 * whenever it has no stored shell, its shell is past `expire`, or `/api/revalidate` has expired
 * one of its tags, and the visitor waiting for it gets a 500. One optional reader that threw —
 * the brand strip, the scenery photos, a price filter — was enough. The readers hand a fault out
 * as a value instead (`@/lib/cache-fault`), and this reads the source and refuses the throw.
 *
 * What it checks, lexically: inside a function that opens with the `"use cache"` directive there
 * is no `throw`, no `Promise.reject` and no `valueOrThrow` (which rethrows what the cache handed
 * out). A closure inside such a function counts as inside it. What it cannot see is a throw in a
 * function the cache function CALLS; those go through `settle` / `cachedOutcome`, which take what
 * was thrown for a fault, and the tests of each reader pin that.
 */

type Finding = { readonly file: string; readonly line: number; readonly what: string };

const DIRECTIVE = /^use cache(?::\s*\w+)?$/;

function directiveOf(body: ts.Block): boolean {
	for (const statement of body.statements) {
		if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
		if (DIRECTIVE.test(statement.expression.text)) return true;
	}
	return false;
}

function isFunctionWithBody(node: ts.Node): node is ts.FunctionLikeDeclaration & { body: ts.Block } {
	return (
		(ts.isFunctionDeclaration(node) ||
			ts.isFunctionExpression(node) ||
			ts.isArrowFunction(node) ||
			ts.isMethodDeclaration(node)) &&
		node.body !== undefined &&
		ts.isBlock(node.body)
	);
}

/** Cached functions of one source file, and what inside them throws. */
function scanSource(file: string, source: string): { cached: number; findings: Finding[] } {
	const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const findings: Finding[] = [];
	let cached = 0;

	// A module-level directive makes every export a cache function; this scan does not follow
	// it, so it refuses the file rather than pass it unseen.
	for (const statement of sourceFile.statements) {
		if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
		if (DIRECTIVE.test(statement.expression.text)) {
			findings.push({ file, line: 1, what: 'a module-level "use cache" directive (not scanned)' });
		}
	}

	const lineOf = (node: ts.Node) => sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

	const inspect = (node: ts.Node) => {
		if (ts.isThrowStatement(node)) {
			findings.push({ file, line: lineOf(node), what: "throw" });
		} else if (ts.isCallExpression(node)) {
			const callee = node.expression.getText(sourceFile);
			if (callee === "Promise.reject") findings.push({ file, line: lineOf(node), what: callee });
			if (callee === "valueOrThrow") findings.push({ file, line: lineOf(node), what: callee });
		}
		ts.forEachChild(node, inspect);
	};

	const visit = (node: ts.Node) => {
		if (isFunctionWithBody(node) && directiveOf(node.body)) {
			cached += 1;
			ts.forEachChild(node.body, inspect);
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);

	return { cached, findings };
}

describe("the scan itself", () => {
	it("refuses a throw in a cache function, in a closure of it too", () => {
		const { cached, findings } = scanSource(
			"a.ts",
			[
				"export async function read() {",
				'\t"use cache";',
				"\tconst result = await fetchIt();",
				'\tif (!result.ok) throw new Error("down");',
				"\tconst each = (x: number) => { if (x < 0) throw new RangeError(); return x; };",
				"\treturn each(1);",
				"}",
			].join("\n"),
		);
		expect(cached).toBe(1);
		expect(findings.map((finding) => [finding.line, finding.what])).toEqual([
			[4, "throw"],
			[5, "throw"],
		]);
	});

	it("refuses what rethrows the cache's own answer", () => {
		const { findings } = scanSource(
			"a.ts",
			[
				"const read = async () => {",
				'\t"use cache";',
				"\treturn valueOrThrow(await inner());",
				"};",
				"async function other() {",
				'\t"use cache: remote";',
				"\treturn Promise.reject(new Error());",
				"}",
			].join("\n"),
		);
		expect(findings.map((finding) => finding.what)).toEqual(["valueOrThrow", "Promise.reject"]);
	});

	it("lets the wrapper outside the cache throw: that is where the fault is handed back", () => {
		const { cached, findings } = scanSource(
			"a.ts",
			[
				"export async function get() {",
				"\treturn valueOrThrow(await read());",
				"}",
				"async function read() {",
				'\t"use cache";',
				'\tif (down()) return faulted("down");',
				"\treturn answered(1);",
				"}",
				"function plain() { throw new Error('fine, not cached'); }",
			].join("\n"),
		);
		expect(cached).toBe(1);
		expect(findings).toEqual([]);
	});

	it("does not take a string that merely says use cache for a directive", () => {
		const { cached, findings } = scanSource(
			"a.ts",
			["function f() {", '\tconsole.log("use cache");', "\tthrow new Error();", "}"].join("\n"),
		);
		expect(cached).toBe(0);
		expect(findings).toEqual([]);
	});

	it("refuses a module-level directive, which it does not follow", () => {
		const { findings } = scanSource("a.ts", '"use cache";\nexport async function f() { return 1; }\n');
		expect(findings).toHaveLength(1);
		expect(findings[0]?.what).toContain("module-level");
	});
});

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			// Generated GraphQL types and fixtures hold no cache functions of ours.
			if (entry.name === "gql" || entry.name === "__fixtures__" || entry.name === "node_modules") continue;
			files.push(...sourceFiles(full));
		} else if (
			/\.tsx?$/.test(entry.name) &&
			!/\.(test|box\.test)\.tsx?$/.test(entry.name) &&
			!entry.name.endsWith(".d.ts")
		) {
			files.push(full);
		}
	}
	return files;
}

describe("the storefront's cache functions", () => {
	const scanned = sourceFiles(SRC)
		.map((file) => ({ file, source: readFileSync(file, "utf8") }))
		.filter(({ source }) => source.includes("use cache"))
		.map(({ file, source }) => ({ file, ...scanSource(path.relative(SRC, file), source) }));

	it("are found: the scan has not gone blind", () => {
		const cached = scanned.reduce((sum, { cached: count }) => sum + count, 0);
		expect(cached).toBeGreaterThanOrEqual(10);
	});

	it("throw nothing out of the cache; a fault is a value (see @/lib/cache-fault)", () => {
		const findings = scanned.flatMap(({ findings: found }) => found);
		expect(
			findings.map((finding) => `${finding.file}:${finding.line} ${finding.what}`),
			'A "use cache" function must hand a fault out as a value — `faulted(...)`, `settle(...)` or ' +
				"`cachedOutcome(...)` — and let its exported wrapper throw outside the cache.",
		).toEqual([]);
	});
});
