import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import pilot from "./fixtures/pilot-3.0.0-20260906.2.json";
import { datasetHashFromText, datasetHashFromValue, transportChecksum } from "./dataset-hash";
import { validateFitmentDataset } from "./validate";

/**
 * The delivered artefact, checked as an artefact.
 *
 * `pilot-3.0.0-20260906.2.json` is CFM's export, committed byte for byte as it was served
 * from https://carfitmanager.com/media/fitment/. It is here so that the numbers CFM
 * reports and the numbers this build computes are compared by a test rather than by two
 * people reading each other's messages.
 *
 * Both hashes are pinned, and they are DIFFERENT NUMBERS doing different jobs:
 *
 *   - the SEMANTIC `datasetHash` is taken over the canonical form with `datasetHash` and
 *     `generatedAt` removed, so it survives reformatting and a rebuild from unchanged
 *     data reproduces it;
 *   - the TRANSPORT checksum is the SHA-256 of these exact bytes, so it does NOT survive
 *     reformatting — which is the point, and why `src/lib/fitment/fixtures/` is in
 *     `.prettierignore`. Measured: running prettier over this file on an unignored path
 *     rewrites it and moves the transport checksum to ad3d24ed…, with every other gate
 *     still green.
 *
 * If CFM ships a new pilot, these constants change in the same commit as the file. A
 * failure here means the two have drifted apart, which is exactly what it should mean.
 */
const PATH = "src/lib/fitment/fixtures/pilot-3.0.0-20260906.2.json";

const DELIVERED = {
	datasetVersion: "3.0.0-pilot-20260906.2",
	bytes: 60_591,
	transport: "28b87e3f3672b779c81b53e4b19f422822867ad4376207f4d63d629b683c6088",
	semantic: "5ab7b2d447afda3d1528408e95896191c251539414f805fbac54937baad27fb5",
} as const;

const raw = readFileSync(PATH);
const text = raw.toString("utf8");

describe("the pilot arrived intact", () => {
	it("is the exact byte count CFM served", () => {
		expect(raw.length).toBe(DELIVERED.bytes);
	});

	it("has the transport checksum CFM reported", () => {
		expect(transportChecksum(raw)).toBe(DELIVERED.transport);
	});

	it("declares the semantic hash this build recomputes for it", () => {
		// The whole point of B0.1: the declared value is not taken on trust, it is
		// reproduced. Both are asserted so that a file swapped for one with a
		// self-consistent hash still fails.
		expect(datasetHashFromText(text)).toBe(DELIVERED.semantic);
		expect((pilot as { datasetHash: string }).datasetHash).toBe(DELIVERED.semantic);
	});

	it("contains no whole-valued float, so value and text hashing agree on it", () => {
		// Guards the JSON-module import path: `provider.ts` would hash the parsed value,
		// which only matches Python while no number is written as `1.0`.
		expect(datasetHashFromValue(pilot)).toBe(datasetHashFromText(text));
	});

	it("is the version we accepted, not the superseded one", () => {
		expect((pilot as { datasetVersion: string }).datasetVersion).toBe(DELIVERED.datasetVersion);
		// The first pilot's applicationIds stood on CFM's local primary keys, so their
		// exporter can no longer reproduce it. It is frozen upstream and must not come back.
		expect((pilot as { datasetHash: string }).datasetHash).not.toBe(
			"bca2997617ae0cf9a594fae8bf6539a504069e66ac4a310761d91519e34ee5e4",
		);
	});
});

describe("the pilot passes this build's own gate", () => {
	it("validates against the Saleor instance it names", () => {
		const result = validateFitmentDataset(pilot, {
			expectedSaleorInstance: "api.maky.store",
			rawText: text,
		});
		expect(result.ok).toBe(true);
	});

	it("is refused against any other instance — ids are instance-bound", () => {
		const result = validateFitmentDataset(pilot, {
			expectedSaleorInstance: "staging.example.test",
			rawText: text,
		});
		expect(result.ok).toBe(false);
	});

	it("reports exactly one window that outruns its generation", () => {
		// B0.5's check, which was dead code until this branch. Its first contact with real
		// data found this: BMW X5 E53 was built 1999-2006, but the application window runs
		// 05/2000 to 02/2007. A shopper with a 2007 X5 cannot pick that year — the selector
		// bounds years by production — so the 12 products on that row are unreachable for
		// them. Reported to CFM; pinned here so a silent change is visible.
		const result = validateFitmentDataset(pilot, {
			expectedSaleorInstance: "api.maky.store",
			rawText: text,
		});
		expect(result.ok).toBe(true);
		expect(result.ok && result.warnings).toHaveLength(1);
		expect(result.ok && result.warnings[0]).toContain("app:6b10c028d262a78c3609fb19");
		expect(result.ok && result.warnings[0]).toContain("exceeds generation production end 2006");
	});
});

describe("the accounting reconciles against the rows themselves", () => {
	const d = pilot as unknown as {
		makes: unknown[];
		models: unknown[];
		generations: unknown[];
		applications: { products: { saleorProductId: string; eligibility: { sellable: boolean } }[] }[];
		accounting: Record<string, number | boolean>;
		coverage: { completeForMakeIds: string[] };
	};
	const refs = d.applications.flatMap((a) => a.products);
	const unique = new Set(refs.map((p) => p.saleorProductId));

	it("counts what the file actually contains", () => {
		expect(d.makes).toHaveLength(6);
		expect(d.models).toHaveLength(7);
		expect(d.generations).toHaveLength(7);
		expect(d.applications).toHaveLength(8);
		expect(unique.size).toBe(67);
	});

	it("agrees with its own accounting block", () => {
		expect(d.accounting.products_exported).toBe(unique.size);
		expect(d.accounting.product_application_references).toBe(refs.length);
		expect(d.accounting.products_exported_sellable).toBe(refs.filter((p) => p.eligibility.sellable).length);
		expect(d.accounting.products_held).toBe(refs.filter((p) => !p.eligibility.sellable).length);
		expect(d.accounting.fits_refused_total).toBe(0);
	});

	it("claims no complete coverage, so a missing row can never become NO_FIT", () => {
		expect(d.coverage.completeForMakeIds).toEqual([]);
	});
});
