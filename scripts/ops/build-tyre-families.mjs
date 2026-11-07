#!/usr/bin/env node
/**
 * Builds `src/lib/tyre-size/data/rodiny_20261105.json`: which snow-chain / snow-sock code belongs to which model family
 * and what its physical size is called ("22,7").
 *
 * The input is CFM's sealed batch of the 145 products (`backend/artifacts/snehove_retaze/produkty_20261105.json` in
 * CarFitManager-4). Only public facts are copied: the public code (`pn`), the family key, the family's brand and line
 * and the size label printed in the product's name. No CFM id, no price, no supplier name.
 *
 * Usage:   node scripts/ops/build-tyre-families.mjs <produkty_20261105.json> [out.json]
 * Check:   the output is a pure function of the input; `families.test.ts` pins its seal and the batch hash.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [input, out = "src/lib/tyre-size/data/rodiny_20261105.json"] = process.argv.slice(2);
if (!input) {
	console.error("usage: build-tyre-families.mjs <produkty_20261105.json> [out.json]");
	process.exit(2);
}

const sha = (text) => createHash("sha256").update(text).digest("hex");
const raw = readFileSync(input, "utf8");
const batch = JSON.parse(raw);
if (batch.batch_id !== "snehove_retaze_produkty_20261105")
	throw new Error(`unexpected batch ${batch.batch_id}`);

const families = {};
for (const family of Object.values(batch.families)) {
	const label = [family.brand, family.line].filter(Boolean).join(" ");
	families[family.key] = { label, kind: family.kind };
}

const products = {};
for (const product of batch.products) {
	const code = product.pn;
	if (typeof code !== "string" || code === "") throw new Error("product without public code");
	if (!Object.hasOwn(families, product.family_key))
		throw new Error(`${code}: unknown family ${product.family_key}`);
	if (Object.hasOwn(products, code)) throw new Error(`${code} twice`);
	products[code] = { family: product.family_key, size: product.label ?? null };
}

const sortKeys = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1)));
const body = {
	schema: "maky.tyre-families/1",
	id: "snehove-retaze-20261105",
	origin: {
		batch: batch.batch_id,
		batch_file_sha256: sha(raw),
		batch_self_sha256: batch.self_sha256,
		producer: "scripts/ops/build-tyre-families.mjs",
	},
	families: sortKeys(families),
	products: sortKeys(products),
	self_sha256: "",
};
// The seal is the hash of the file with this field empty, so anyone can recompute it.
body.self_sha256 = sha(`${JSON.stringify(body, null, "\t")}\n`);
writeFileSync(out, `${JSON.stringify(body, null, "\t")}\n`);
console.log(`${out}: ${Object.keys(products).length} products, ${Object.keys(families).length} families`);
