import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Integrity of the vendored v2 provider pack, and the contract facts M.2 is built on.
 *
 * The pack is copied verbatim from `MakySto/maky-cms` main — see `PROVENANCE.md` beside
 * it. This file makes the copy trustworthy: every fixture digest and the manifest's own
 * digest are recomputed on each run, so a vendored file edited to make a test pass fails
 * the run instead.
 *
 * The second half pins the parts of the contract the implementation reads. Those
 * assertions are not decoration — each one is a rule that changes what the storefront must
 * do, and several of them CONTRADICT the v1 behaviour that is live today. Pinning them
 * here means a future re-vendoring that quietly relaxes one is a red test rather than a
 * page that starts rendering something it should have refused.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/provider-v2");

/** Recorded when the pack was vendored from `MakySto/maky-cms` main @ `ddccac74`. */
const MANIFEST_SHA256 = "c8449df0231dfaeaf47eaab3c3426c09bdc5b34b55d27c96d31fade402558009";
const PROVIDER_MAIN = "ddccac744bc1720bd9cdf67585aa99350cd4940e";

interface ManifestV2 {
	id: string;
	version: number;
	status: string;
	payloadVersion: string;
	depth: number;
	source: string;
	routeTemplate: string;
	previewSupported: boolean;
	supportedBlocks: string[];
	supportedMarkets: string[];
	mediaSizes: string[];
	scenarios: Record<string, string>;
	expectations: Record<string, unknown>;
	fixtures: Record<string, string>;
}

export const manifestV2 = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8")) as ManifestV2;

function digest(absolutePath: string): string {
	return `sha256:${createHash("sha256").update(readFileSync(absolutePath)).digest("hex")}`;
}

describe("provider pack v2 — integrity", () => {
	it("is the manifest M.2 was built against", () => {
		expect(
			createHash("sha256")
				.update(readFileSync(join(PACK, "manifest.json")))
				.digest("hex"),
		).toBe(MANIFEST_SHA256);
	});

	it("carries the identity recorded in PROVENANCE.md", () => {
		expect(manifestV2.id).toBe("storefront-cms-pages");
		expect(manifestV2.version).toBe(2);
		expect(manifestV2.status).toBe("candidate");
		expect(manifestV2.payloadVersion).toBe("3.86.0");
		expect(manifestV2.depth).toBe(1);

		const provenance = readFileSync(join(PACK, "PROVENANCE.md"), "utf8");
		expect(provenance).toContain(PROVIDER_MAIN);
		expect(provenance).toContain(MANIFEST_SHA256);
	});

	it("lists fourteen fixtures", () => {
		expect(Object.keys(manifestV2.fixtures)).toHaveLength(14);
	});

	it.each(Object.entries(manifestV2.fixtures))("%s matches its recorded digest", (path, expected) => {
		expect(digest(join(PACK, path))).toBe(expected);
	});

	it("has no vendored file the manifest does not account for", () => {
		// The prose contracts are vendored too and are not in `fixtures`, so they are listed
		// here explicitly rather than waved through — an unexpected file should still fail.
		const prose = [
			"README.md",
			"manifest.json",
			"page-rest-contract.md",
			"depth-and-relationships.md",
			"lexical-richtext-contract.md",
			"unsupported-content-policy.md",
			"PROVENANCE.md",
		];
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(PACK, join(dir, entry.name))],
			);
		const accounted = new Set([...Object.keys(manifestV2.fixtures), ...prose]);
		expect(walk(PACK).filter((file) => !accounted.has(file))).toEqual([]);
	});
});

describe("provider pack v2 — the contract M.2 implements", () => {
	it("names exactly the seven blocks M.2 is scoped to", () => {
		expect(manifestV2.supportedBlocks).toEqual([
			"hero",
			"richText",
			"image",
			"gallery",
			"cta",
			"faq",
			"mediaText",
		]);
	});

	it("ships a scenario fixture for every supported block", () => {
		// A block with no fixture would be implemented against a guess, which is how the
		// three withdrawal contract mismatches happened.
		for (const block of manifestV2.supportedBlocks) {
			expect(manifestV2.scenarios[block], block).toBeTruthy();
		}
	});

	it("keeps the fail-closed rule from v1, for blocks and for Lexical nodes", () => {
		expect(manifestV2.expectations.unsupportedBlock).toBe("reject-complete-candidate");
		expect(manifestV2.expectations.unsupportedLexicalNode).toBe("reject-complete-candidate");
	});

	it("rejects a page whose markets exclude the one being served", () => {
		expect(manifestV2.expectations.pageMarketMismatch).toBe("reject-candidate-for-SK");
	});

	it("says a missing or null relationship must not produce a route", () => {
		// Not a rejection and not a crash: the consumer degrades rather than inventing a
		// destination. Pinned because "link with no target" is the easy thing to get wrong.
		expect(manifestV2.expectations.missingOrNullRelationship).toBe("do-not-derive-route");
	});

	it("names the per-block market filtering the fixture expects", () => {
		expect(manifestV2.expectations.marketSKVisibleBlockIds).toHaveLength(4);
		expect(manifestV2.expectations.marketSKExcludedBlockIds).toEqual(["b00000000000000000000094"]);
	});

	it("still does not support preview", () => {
		expect(manifestV2.previewSupported).toBe(false);
	});

	it("declares the five media sizes an upload can carry", () => {
		expect(manifestV2.mediaSizes).toEqual(["thumbnail", "card", "content", "hero", "og"]);
	});

	it("is synthetic, and says so — it is evidence about shape, not about live content", () => {
		// Worth pinning. The v1 pack was mistaken for a snapshot of the live document once
		// already; this one states its own provenance and the storefront should not repeat
		// that confusion.
		expect(manifestV2.source).toBe("sanitized-synthetic-from-provider-schema");
	});
});
