import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { datasetHashFromText, datasetHashFromValue, transportChecksum } from "./dataset-hash";
import { validateFitmentDataset } from "./validate";

/**
 * The FULL CFM snapshot, checked as an artefact — the same job
 * `pilot-conformance.test.ts` does for the 60 KB pilot, for the 8 MB real thing.
 *
 * ## Why this one is not committed
 *
 * The pilot is in the tree byte for byte. The full export is 7.9 MB and this repository
 * is a public fork (CLAUDE.md §10.1), so committing it would put the whole compatibility
 * dataset in a place it can never be removed from, and would carry it into every clone
 * and every build. The provider reaches it over HTTP instead, and validates it on every
 * load — so the artefact does not need to live here for production to be safe.
 *
 * What DOES need to live here is the set of numbers we accepted, so that "the file CFM is
 * serving today is the file we verified" is a question a command can answer:
 *
 *     pnpm check:fitment
 *
 * The test is skipped when no dataset is provided, which is deliberate — `pnpm test` must
 * not depend on the network or on a 8 MB download. The constants below are what make the
 * skip harmless: they are committed, so running the check later re-proves the same claim
 * rather than whatever CFM happens to be serving.
 */
const PATH = process.env.MAKY_FITMENT_DATASET_PATH?.trim();
const available = Boolean(PATH && existsSync(PATH));

/** Verified 2026-09-07 against https://carfitmanager.com/media/fitment/ */
const DELIVERED = {
	datasetVersion: "3.0.0-full-20260907.2",
	bytes: 7_977_643,
	transport: "2939f0b23afea4010355a03d61ef762a6a670f12634ea8bf7fbfdd68b32af37c",
	semantic: "347eef5024fc528860ce38590bee14619fd3242c060eb8c1ef716f5da5053bbe",
	makes: 62,
	models: 557,
	generations: 856,
	applications: 1102,
	/** `accounting.products_exported`, and the number of distinct products the applications name. */
	products: 9163,
} as const;

type Snapshot = {
	datasetVersion: string;
	datasetHash: string;
	saleorInstance: string;
	makes: unknown[];
	models: unknown[];
	generations: unknown[];
	applications: { products?: { saleorProductId?: string }[] }[];
	accounting: { products_exported: number; manifest_rows: number; products_held: number };
};

/**
 * Read lazily and once.
 *
 * `describe.skipIf` skips the TESTS; it still runs the describe callback, so reading the
 * file at the top of one throws `path must be of type string` when no dataset is given —
 * a failed suite where a skipped one was intended. Memoized because the alternative is
 * parsing 8 MB nine times.
 */
let cached: { raw: Buffer; text: string; snapshot: Snapshot } | null = null;
function dataset() {
	if (!cached) {
		const raw = readFileSync(PATH as string);
		const text = raw.toString("utf8");
		cached = { raw, text, snapshot: JSON.parse(text) as Snapshot };
	}
	return cached;
}

describe.skipIf(!available)("the full CFM snapshot arrived intact", () => {
	it("is the exact byte count CFM served", () => {
		const d = dataset();
		expect(d.raw.length).toBe(DELIVERED.bytes);
	});

	it("has the transport checksum CFM reported", () => {
		const d = dataset();
		expect(transportChecksum(d.raw)).toBe(DELIVERED.transport);
	});

	it("declares the semantic hash this build recomputes for it", () => {
		const d = dataset();
		// Recomputed, not trusted. Both are asserted so that a file swapped for one with
		// a self-consistent hash of its own still fails.
		expect(datasetHashFromText(d.text)).toBe(DELIVERED.semantic);
		expect(d.snapshot.datasetHash).toBe(DELIVERED.semantic);
	});

	it("hashes the same from its text and from its parsed value", () => {
		const d = dataset();
		// The provider hashes the parsed value. That only matches Python while no number
		// in the document is written as a whole-valued float — `1.0` vs `1`. CFM dropped
		// `evidence.confidence` from this export, which removes the field most likely to
		// carry one, but the guard is on the property, not on the field.
		expect(datasetHashFromValue(d.snapshot)).toBe(datasetHashFromText(d.text));
	});

	it("is the version we accepted", () => {
		const d = dataset();
		expect(d.snapshot.datasetVersion).toBe(DELIVERED.datasetVersion);
	});

	it("carries the shape CFM reported", () => {
		const d = dataset();
		expect(d.snapshot.makes).toHaveLength(DELIVERED.makes);
		expect(d.snapshot.models).toHaveLength(DELIVERED.models);
		expect(d.snapshot.generations).toHaveLength(DELIVERED.generations);
		expect(d.snapshot.applications).toHaveLength(DELIVERED.applications);

		const products = new Set<string>();
		for (const application of d.snapshot.applications) {
			for (const product of application.products ?? []) {
				if (product.saleorProductId) products.add(product.saleorProductId);
			}
		}
		expect(products.size).toBe(DELIVERED.products);
	});

	it("accounts for every row it did not export", () => {
		const d = dataset();
		// CFM's own arithmetic, asserted rather than read: 9,192 rows in the manifest,
		// 29 products deactivated in CFM and withheld, 9,163 exported. The gap is the
		// interesting part — an export that silently drops rows is the failure this
		// catches, and it is the one CFM found in its own exporter on 2026-09-07
		// (`ProductRoofFit.is_active` was checked, `Product.is_active` was not).
		const { manifest_rows, products_exported, products_held } = d.snapshot.accounting;
		expect(products_exported).toBe(DELIVERED.products);
		expect(manifest_rows - products_exported).toBe(29);
		expect(products_held).toBe(26);
	});
});

describe.skipIf(!available)("the full snapshot passes this build's own gate", () => {
	it("validates against the Saleor instance it names", () => {
		const d = dataset();
		const result = validateFitmentDataset(d.snapshot, {
			expectedSaleorInstance: "api.maky.store",
			rawText: d.text,
		});
		expect(result.ok ? [] : result.errors).toEqual([]);
		expect(result.ok).toBe(true);
	});

	it("names the production Saleor, not a staging one", () => {
		const d = dataset();
		expect(d.snapshot.saleorInstance).toBe("api.maky.store");
	});
});
