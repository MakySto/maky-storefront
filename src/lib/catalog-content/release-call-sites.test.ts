import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every place that reads catalogue content must say which market it reads it for.
 *
 * With a release manifest, the file a market serves is chosen by the market (`de` and `at` can hold
 * different files though both read German). A call that names only a language is answered from the older
 * settings, which is what it always did, but it is also the call that would quietly show Germany's
 * visitors the file that was approved for nobody once Austria and Germany are published apart. Nothing
 * fails when a call site is forgotten, which is exactly why this scan fails for it.
 *
 * The scan is textual and deliberately small: it finds each call of the two loaders in production code,
 * takes its argument list, and holds it to two rules.
 */

const SRC = join(__dirname, "..", "..");
const LOADERS = /\b(loadCatalogView|loadCatalogContent)\(/g;

type Call = { readonly file: string; readonly loader: string; readonly args: readonly string[] };

function productionFiles(): string[] {
	return (readdirSync(SRC, { recursive: true }) as string[])
		.filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
		.filter(
			(path) =>
				!path.split(sep).some((part) => part === "gql" || part === "_reference" || part === "generated"),
		);
}

/** The top-level arguments of the call whose opening parenthesis is at `open`. */
function argumentsOf(source: string, open: number): string[] {
	const args: string[] = [];
	let depth = 0;
	let current = "";
	for (let i = open; i < source.length; i++) {
		const char = source[i];
		if (char === "(" || char === "[" || char === "{") {
			depth += 1;
			if (depth === 1) continue;
		} else if (char === ")" || char === "]" || char === "}") {
			depth -= 1;
			if (depth === 0) {
				if (current.trim()) args.push(current.trim());
				return args;
			}
		} else if (char === "," && depth === 1) {
			args.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	throw new Error("a call of a catalogue loader is never closed");
}

function calls(): Call[] {
	const found: Call[] = [];
	for (const file of productionFiles()) {
		const source = readFileSync(join(SRC, file), "utf8");
		for (const match of source.matchAll(LOADERS)) {
			const at = match.index ?? 0;
			// `function loadCatalogView(…)` is the definition, not a call.
			if (/function\s+$/.test(source.slice(Math.max(0, at - 20), at))) continue;
			found.push({ file, loader: match[1] ?? "", args: argumentsOf(source, at + match[0].length - 1) });
		}
	}
	return found;
}

describe("every call that reads catalogue content names the market", () => {
	const all = calls();

	it("finds the calls it is meant to hold to account", () => {
		// If this ever finds nothing, the scan has stopped looking and the rules below prove nothing.
		expect(all.length).toBeGreaterThanOrEqual(6);
		expect(new Set(all.map((call) => call.loader))).toEqual(
			new Set(["loadCatalogView", "loadCatalogContent"]),
		);
	});

	it("passes a second argument at every call site", () => {
		const without = all
			.filter((call) => call.args.length < 2)
			.map((call) => `${call.file}: ${call.loader}(${call.args.join(", ")})`);

		expect(without).toEqual([]);
	});

	it("passes the market, and not the Saleor channel the route happens to carry", () => {
		// `channel` in a route is either the friendly code or the Saleor slug (`sk-eur`); only the friendly
		// code names a target. `REVERSE_MAP[channel] ?? channel` is the translation.
		const bare = all
			.filter((call) => call.args[1] === "channel")
			.map((call) => `${call.file}: ${call.loader}(${call.args.join(", ")})`);

		expect(bare).toEqual([]);
	});
});
