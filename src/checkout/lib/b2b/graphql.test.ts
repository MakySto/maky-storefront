import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { buildSchema, extendSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";

import { B2B_DOCUMENTS } from "./graphql";

/**
 * The B2B documents against the schema they will meet: Saleor 3.23.31 (the pinned schema `generate:offline` uses)
 * PLUS the PROPOSED MAKY-B2B-V1 extension (`maky-b2b-v1.graphql`). When the backend session hands over its real
 * schema, the extension file is replaced by that schema's B2B part and this test runs against it unchanged.
 *
 * The pinned schema is a download cache (`node_modules/.cache/saleor-schema`). A tree built against the live API
 * (the production box) may not have it; there this part is skipped and says so, and the source checks below still run.
 */

const root = process.cwd();
const pinned = path.join(root, "node_modules/.cache/saleor-schema/schema-3.23.31.graphql");
const extension = readFileSync(path.join(root, "src/checkout/lib/b2b/maky-b2b-v1.graphql"), "utf8");
const havePinned = existsSync(pinned);

function filesUnder(dir: string, suffix: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? filesUnder(full, suffix) : full.endsWith(suffix) ? [full] : [];
	});
}

describe.skipIf(!havePinned)("B2B documents vs Saleor 3.23.31 + proposed MAKY-B2B-V1 (pinned schema)", () => {
	const base = havePinned ? buildSchema(readFileSync(pinned, "utf8")) : null;
	const extended = base ? extendSchema(base, parse(extension)) : null;

	it.each(Object.entries(B2B_DOCUMENTS))("%s is valid against the extended schema", (_name, document) => {
		expect(validate(extended!, parse(String(document))).map((error) => error.message)).toEqual([]);
	});

	it("the privileged documents need the extension: they are not valid against plain 3.23.31", () => {
		for (const document of [
			B2B_DOCUMENTS.MakyB2bCheckoutStateDocument,
			B2B_DOCUMENTS.MakyB2bApplyVerificationDocument,
		]) {
			expect(validate(base!, parse(String(document))).length).toBeGreaterThan(0);
		}
		// The readiness probe must run against a backend WITHOUT the contract too, to say that it is missing.
		expect(validate(base!, parse(String(B2B_DOCUMENTS.MakyB2bReadinessDocument)))).toEqual([]);
	});

	it("the extension's names are the ones the storefront reads", () => {
		const state = extended!.getType("CheckoutB2bTaxState");
		expect(
			Object.keys((state as unknown as { getFields: () => Record<string, unknown> }).getFields()),
		).toEqual(["contextVersion", "decision", "effectiveTaxExemption", "checkedAt", "expiresAt"]);
		expect(extended!.getMutationType()?.getFields().checkoutB2bTaxAttestationUpdate).toBeDefined();
	});
});

describe("the live-generated documents stay buildable before the backend ships", () => {
	it("no document that prebuild sends to the LIVE Saleor names a B2B contract field", () => {
		const live = [
			...filesUnder(path.join(root, "src/graphql"), ".graphql"),
			...filesUnder(path.join(root, "src/checkout/graphql"), ".graphql"),
		];
		expect(live.length).toBeGreaterThan(10);
		for (const file of live) {
			expect(readFileSync(file, "utf8"), file).not.toMatch(/b2bTaxState|checkoutB2bTaxAttestationUpdate/);
		}
	});

	it("the public checkout reads the company input as a public metafield", () => {
		const checkout = readFileSync(path.join(root, "src/checkout/graphql/checkout.graphql"), "utf8");
		expect(checkout).toMatch(/b2bInput: metafield\(key: "maky\.b2b\.input\.v1"\)/);
		expect(checkout).not.toMatch(/privateMetafield|privateMetadata/);
	});
});
