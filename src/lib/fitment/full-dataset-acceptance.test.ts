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

/**
 * Verified 2026-10-01 against https://carfitmanager.com/media/fitment/ — the downloaded bytes
 * checked with `sha256sum -c` against `SHA256SUMS_FULL_20261001.2`, then by this build's own hash
 * and validator.
 *
 * THULE-C1, the full opening (measured with `dataset-delta.check.test.ts` on the build's own
 * code, old = 3.0.0-full-20261001, new = this one):
 *   + 9 140 Thule sets, one application each — 18 314 products now, 9 163 Nordrive and 9 151 Thule
 *     (the 9 140, the 10 pilots that were already on sale, and 71743 with its glass-roof condition);
 *   + 7 makes, +130 models, +246 generations, +1 453 applications (1 108 generations, 2 566
 *     applications in all); 10 existing pilot applications gained more sets with the same window
 *     and roof;
 *   0 products removed, 0 Nordrive applications changed, 0 saved selections left unresolved: of
 *     55 840 selections a shopper can have saved, 19 720 resolve exactly as before and 36 120 gain
 *     Thule sets alongside the same Nordrive ones, and none resolves differently;
 *   82 generations changed their qualifiers: 75 gained a roof option (the selector asks about the roof
 *     every time and never fills it in) and 9 gained a body type (so the selector now asks which
 *     body, where it used to fill the single one in); 2 gained both. A saved selection keeps the
 *     roof and body it was saved with;
 *   `displayNames` (language-keyed, `sk`, `cs`, `de`…) on 57 makes, 38 models and 10 generations;
 *   153 provider warnings, all of the two kinds the previous file already had (a window ending past
 *     the generation's last production year, or starting before its first): 96 before, 57 more.
 * What it costs this build, measured on the production box: read 4 ms, plain parse 37 ms,
 * `datasetHash` 420 ms (of which canonical JSON 165 ms), validation 380–420 ms in all — one event-loop
 * block of ~0.5 s per dataset taken into use, 0.4 ms median and 4.6 ms at worst to resolve one
 * vehicle across all 2 192 selections the selector can produce.
 *
 * Earlier files, for the history: 20261001 (30. 9., pilot, 7 993 764 B, semantic fd3507de…,
 * 63/561/862/1113, 9 174 products) and 20260915.2 (7 977 173 B, semantic af9e6750…, 62/557/857/1102,
 * 9 163 products).
 */
const DELIVERED = {
	datasetVersion: "3.0.0-full-20261001.2",
	bytes: 15_915_111,
	transport: "befb1cb5792a3cff2fdb9eb2215cbe27285450f363d5d297460b54e8b0f5e9f1",
	semantic: "394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9",
	makes: 70,
	models: 691,
	generations: 1108,
	applications: 2566,
	/** `accounting.products_exported`, and the number of distinct products the applications name. */
	products: 18314,
	/** `manifest_rows − products_exported`: products deactivated in CFM and not exported. */
	withdrawn: 29,
	/** `accounting.products_held`: exported, but `qaStatus: hold` and not sellable. */
	held: 6,
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
		expect(manifest_rows - products_exported).toBe(DELIVERED.withdrawn);
		expect(products_held).toBe(DELIVERED.held);
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
