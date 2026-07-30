import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Integrity of the vendored Payload Forms contract pack.
 *
 * The pack under `__fixtures__/forms-backend-v1/` is authored by `MakySto/maky-cms` and
 * copied in verbatim — see `PROVENANCE.md` beside it. This file is what makes the copy
 * trustworthy: it recomputes the SHA-256 of every artifact the manifest lists, and of the
 * manifest itself, on every run.
 *
 * The failure it exists to prevent is not a corrupted transfer — that was checked once, on
 * vendoring. It is the later one: somebody edits a vendored fixture to make a test pass,
 * and the storefront quietly stops testing what Payload actually accepts. That is how this
 * feature reached "367 tests green" while every real request would have failed.
 *
 * The manifest's own digest is pinned separately, because a manifest that can be edited to
 * match the files it describes checks nothing at all.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/forms-backend-v1");

/**
 * Recorded when the pack was vendored from `MakySto/maky-cms @ 459146a`.
 *
 * Changing this constant is how a contract upgrade is declared. Changing it to silence a
 * failure is how one is hidden, so it appears in `PROVENANCE.md` too, where the provider
 * commit that produced it is written down next to it.
 */
const MANIFEST_SHA256 = "0ed6e45be585cb4ad27950befd4a8eba7b5f83004767f05bcf0962b90b901632";

const CONTRACT_REVISION = "1.1.0";
const PROVIDER_COMMIT = "459146a894e344b8261921e5c4c39879a0407839";

interface Manifest {
	id: string;
	version: number;
	revision: string;
	status: string;
	payloadVersion: string;
	hashAlgorithm: string;
	schema: string;
	endpoints: Record<string, string>;
	canonical: Record<string, string>;
	phoneScenarios: Record<string, string>;
	operationalFixtures: Record<string, string>;
	deliveryContract: {
		statuses: string[];
		unknownRequiresReconciliation: boolean;
		publicAcknowledgementFields: string[];
	};
	artifacts: Record<string, string>;
}

function sha256(absolutePath: string): string {
	return `sha256:${createHash("sha256").update(readFileSync(absolutePath)).digest("hex")}`;
}

export const manifest = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8")) as Manifest;

describe("forms contract pack — integrity", () => {
	it("is the manifest the storefront was built against", () => {
		expect(
			createHash("sha256")
				.update(readFileSync(join(PACK, "manifest.json")))
				.digest("hex"),
		).toBe(MANIFEST_SHA256);
	});

	it("carries the contract identity recorded in PROVENANCE.md", () => {
		expect(manifest.id).toBe("forms-backend-v1");
		expect(manifest.version).toBe(1);
		expect(manifest.revision).toBe(CONTRACT_REVISION);
		expect(manifest.status).toBe("candidate");
		expect(manifest.payloadVersion).toBe("3.86.0");
		expect(manifest.hashAlgorithm).toBe("sha256");
		expect(manifest.schema).toBe("withdrawal.schema.json");

		// The provenance file is the human-readable half of the same record. If the two
		// disagree, one of them was edited alone.
		const provenance = readFileSync(join(PACK, "PROVENANCE.md"), "utf8");
		expect(provenance).toContain(PROVIDER_COMMIT);
		expect(provenance).toContain(MANIFEST_SHA256);
		expect(provenance).toContain(CONTRACT_REVISION);
	});

	it("lists twenty artifacts", () => {
		expect(Object.keys(manifest.artifacts)).toHaveLength(20);
	});

	it.each(Object.entries(manifest.artifacts))("%s matches its recorded digest", (relativePath, expected) => {
		expect(sha256(join(PACK, relativePath))).toBe(expected);
	});

	it("has no vendored file the manifest does not account for", () => {
		// The CMS pack's integrity test is manifest-driven only, so an extra file dropped
		// into it passes in silence. A directory walk closes that: the only file here that
		// the provider did not author is the storefront's own PROVENANCE.md.
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(PACK, join(dir, entry.name))],
			);

		const accounted = new Set([...Object.keys(manifest.artifacts), "manifest.json", "PROVENANCE.md"]);
		expect(walk(PACK).filter((file) => !accounted.has(file))).toEqual([]);
	});
});

describe("forms contract pack — the parts the storefront depends on", () => {
	it("names the withdrawal endpoint the client posts to", () => {
		expect(manifest.endpoints.withdrawalCreate).toBe("POST /api/forms/withdrawal");
	});

	it("ships a canonical request for phone-null and for phone-with-a-value", () => {
		// Both are needed. A contract that only demonstrated one of them would let the
		// storefront implement half the field and still look conformant.
		expect(manifest.canonical.withdrawalRequestPhoneNull).toBeTruthy();
		expect(manifest.canonical.withdrawalRequestPhoneValue).toBeTruthy();
		expect(manifest.canonical.withdrawalRequestAccountPhoneValue).toBeTruthy();
	});

	it("covers all eight phone normalization scenarios", () => {
		expect(Object.keys(manifest.phoneScenarios).sort()).toEqual([
			"controlCharacterIsRejected",
			"emptyNormalizesToNull",
			"missingNormalizesToNull",
			"nonAsciiIsAccepted",
			"nullNormalizesToNull",
			"surroundingWhitespaceAtNormalizedMaximumIsAccepted",
			"surroundingWhitespaceIsTrimmed",
			"thirtyThreeCharactersAreRejected",
		]);
	});

	it("declares four delivery statuses, including the one the storefront types omitted", () => {
		// `unknown` is new in 1.1.0 and is NOT a failure — it means an SMTP attempt had an
		// ambiguous outcome and needs operator reconciliation. Rendering it as "failed"
		// would tell a customer their confirmation did not arrive when nobody knows yet.
		expect(manifest.deliveryContract.statuses).toEqual(["pending", "sent", "failed", "unknown"]);
		expect(manifest.deliveryContract.unknownRequiresReconciliation).toBe(true);
	});

	it("declares the eight public acknowledgement fields", () => {
		expect(manifest.deliveryContract.publicAcknowledgementFields).toEqual([
			"customerStatus",
			"customerSentAt",
			"customerAttemptCount",
			"customerLastAttemptAt",
			"internalStatus",
			"internalSentAt",
			"internalAttemptCount",
			"internalLastAttemptAt",
		]);
	});
});
