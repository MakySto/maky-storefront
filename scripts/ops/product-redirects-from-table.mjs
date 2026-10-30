#!/usr/bin/env node
// Writes src/lib/catalog-content/product-redirects.json from CFM's table of old -> new product addresses
// (nordrive-kargo/zlucenie-20261030/). Reads a TSV or CSV with a header row; touches nothing else.
//
//   node scripts/ops/product-redirects-from-table.mjs <table.tsv> --release <name> [--market sk] [--check]
//
// Columns are found by header: the old address is the one named old / stara / from / zdroj, the new one
// new / nova / to / ciel, an optional market one trh / market. A cell may be a slug, a path (`/sk/slug`)
// or a full URL; only the last path segment is kept, and the market comes from the cell when it names
// one, else from the market column, else from --market (default sk). Anything that is not exactly one
// slug on each side, a row that points at itself, a slug with two different targets and a target that is
// itself retired STOPS the run with the rows named: nothing is written. --check validates and prints counts.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const file = args.find((a) => !a.startsWith("--") && a !== flag("--release") && a !== flag("--market"));
if (!file || !flag("--release")) {
	console.error(
		"usage: product-redirects-from-table.mjs <table.tsv|csv> --release <name> [--market sk] [--check]",
	);
	process.exit(2);
}

const MARKETS = new Set(["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const bytes = readFileSync(file);
const text = bytes.toString("utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const sep = lines[0].includes("\t") ? "\t" : ",";
const cells = (line) => line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
const header = cells(lines[0]).map((h) => h.toLowerCase());
const col = (re) => header.findIndex((h) => re.test(h));
const iOld = col(/(^|[^a-z])(old|stara|from|zdroj)/);
const iNew = col(/(^|[^a-z])(new|nova|to|ciel)/);
const iMarket = col(/(^|[^a-z])(trh|market)/);
if (iOld < 0 || iNew < 0) {
	console.error(`STOP: no old/new column in header: ${header.join(" | ")}`);
	process.exit(1);
}

function parse(cell) {
	let value = cell;
	try {
		value = new URL(cell).pathname;
	} catch {}
	const parts = value
		.split("/")
		.filter(Boolean)
		.map((p) => decodeURIComponent(p));
	let market;
	if (parts.length > 1 && MARKETS.has(parts[0])) market = parts.shift();
	return { market, parts };
}

const problems = [];
const exact = {};
for (const [n, line] of lines.slice(1).entries()) {
	const row = cells(line);
	const a = parse(row[iOld] ?? "");
	const b = parse(row[iNew] ?? "");
	const market =
		a.market ??
		b.market ??
		(iMarket >= 0 ? row[iMarket]?.toLowerCase() : undefined) ??
		flag("--market") ??
		"sk";
	const where = `row ${n + 2}`;
	if (!MARKETS.has(market)) problems.push(`${where}: market "${market}"`);
	else if (a.parts.length !== 1 || b.parts.length !== 1)
		problems.push(`${where}: not one slug on each side (${row[iOld]} -> ${row[iNew]})`);
	else if (!SLUG.test(a.parts[0]) || !SLUG.test(b.parts[0]))
		problems.push(`${where}: unusable slug (${a.parts[0]} -> ${b.parts[0]})`);
	else if (a.parts[0] === b.parts[0]) problems.push(`${where}: points at itself (${a.parts[0]})`);
	else {
		const map = (exact[market] ??= {});
		if (map[a.parts[0]] && map[a.parts[0]] !== b.parts[0])
			problems.push(`${where}: ${a.parts[0]} has two targets`);
		map[a.parts[0]] = b.parts[0];
	}
}
for (const [market, map] of Object.entries(exact)) {
	for (const [from, to] of Object.entries(map))
		if (map[to]) problems.push(`${market}: target ${to} (from ${from}) is itself retired`);
}

const total = Object.values(exact).reduce((n, m) => n + Object.keys(m).length, 0);
const targets = new Set(Object.values(exact).flatMap((m) => Object.values(m)));
console.log(
	`rows ${lines.length - 1}, entries ${total}, distinct targets ${targets.size}, markets ${
		Object.keys(exact).join(",") || "-"
	}`,
);
if (problems.length) {
	console.error(`STOP: ${problems.length} problem(s), nothing written`);
	for (const p of problems.slice(0, 40)) console.error("  " + p);
	process.exit(1);
}
if (args.includes("--check")) process.exit(0);

const sorted = Object.fromEntries(
	Object.entries(exact).map(([m, map]) => [
		m,
		Object.fromEntries(Object.entries(map).sort(([x], [y]) => x.localeCompare(y))),
	]),
);
const out = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../src/lib/catalog-content/product-redirects.json",
);
const sha = createHash("sha256").update(bytes).digest("hex");
writeFileSync(
	out,
	JSON.stringify(
		{ release: flag("--release"), source: `${file.split("/").pop()} sha256 ${sha}`, exact: sorted },
		null,
		"\t",
	) + "\n",
);
console.log(`written ${out}`);
