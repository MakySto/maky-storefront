import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isMarketCode, payloadLocaleForMarket } from "./markets";

/**
 * Integrity of the vendored v3 provider pack (thread 2), and the contract facts it pins.
 *
 * The pack is copied verbatim from `MakySto/maky-cms` — see `PROVENANCE.md` beside it. Every
 * digest the manifest records is recomputed on each run, plus the manifest's own, so a
 * vendored file edited to make a test pass fails the run instead.
 *
 * The second half pins the parts of the contract the implementation reads. A re-vendoring
 * that quietly changes one of them is a red test here rather than a storefront that starts
 * answering the CMS in a shape it no longer expects.
 */

const PACK = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/provider-v3");

/** Recorded when the pack was vendored from `feat/v2-editorial-workspace` @ `b74eb9e2`. */
const MANIFEST_SHA256 = "3f7a46273c87e6866930b594dd5903da7e8d31d63c7fcb3fea94ea1d7e3e5293";
const PROVIDER_COMMIT = "b74eb9e2d1a2a0b2c43a59d2d14c0253839426c5";

interface ManifestV3 {
	id: string;
	version: number;
	status: string;
	payloadVersion: string;
	parts: {
		revalidationEvent: { schemaVersion: number; contract: string };
		preview: {
			version: number;
			contract: string;
			collections: string[];
			tokenTtlSeconds: number;
			storefrontRoute: string;
			exitRoute: string;
			cookie: string;
			resolveEndpoint: string;
			identity: string;
		};
		pages: {
			version: number;
			contract: string;
			unsupportedBlock: string;
			focalPoint: string;
			revisionMeta: string;
		};
	};
	supportedBlocks: string[];
	marketLocales: Record<string, string>;
	files: Record<string, string>;
}

const manifestV3 = JSON.parse(readFileSync(join(PACK, "manifest.json"), "utf8")) as ManifestV3;

function sha256(absolutePath: string): string {
	return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

describe("provider pack v3 — integrity", () => {
	it("is the manifest thread 2 was built against", () => {
		expect(sha256(join(PACK, "manifest.json"))).toBe(MANIFEST_SHA256);
	});

	it("carries the identity recorded in PROVENANCE.md", () => {
		expect(manifestV3.id).toBe("storefront-cms");
		expect(manifestV3.version).toBe(3);
		expect(manifestV3.status).toBe("candidate");
		expect(manifestV3.payloadVersion).toBe("3.90.2");

		const provenance = readFileSync(join(PACK, "PROVENANCE.md"), "utf8");
		expect(provenance).toContain(PROVIDER_COMMIT);
		expect(provenance).toContain(MANIFEST_SHA256);
	});

	it("lists twenty-three files", () => {
		expect(Object.keys(manifestV3.files)).toHaveLength(23);
	});

	it.each(Object.entries(manifestV3.files))("%s matches its recorded digest", (path, expected) => {
		expect(sha256(join(PACK, path))).toBe(expected);
	});

	it("has no vendored file the manifest does not account for", () => {
		// The manifest cannot list itself, and PROVENANCE.md is the one storefront-authored
		// file; anything else unaccounted for should fail.
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(PACK, join(dir, entry.name))],
			);
		const accounted = new Set([...Object.keys(manifestV3.files), "manifest.json", "PROVENANCE.md"]);
		expect(walk(PACK).filter((file) => !accounted.has(file))).toEqual([]);
	});
});

describe("provider pack v3 — the contract the storefront implements", () => {
	it("revalidation events are schemaVersion 2", () => {
		expect(manifestV3.parts.revalidationEvent.schemaVersion).toBe(2);
	});

	it("preview v1 names the routes, cookie and endpoint the storefront uses", () => {
		const { preview } = manifestV3.parts;
		expect(preview.version).toBe(1);
		expect(preview.collections).toEqual(["pages"]);
		expect(preview.storefrontRoute).toBe("/api/cms/preview");
		expect(preview.exitRoute).toBe("/api/cms/preview/exit");
		expect(preview.cookie).toBe("maky-cms-preview");
		expect(preview.resolveEndpoint).toBe("/api/pages/preview-resolve");
		// Thirty minutes at most, which is what bounds the cookie's Max-Age.
		expect(preview.tokenTtlSeconds).toBe(1800);
	});

	it("pages v3 skips an unsupported block, except on a legal page", () => {
		// The rule that supersedes `reject-complete-candidate` of the v1 and v2 packs for
		// editorial pages — see pages-content.md §1.
		expect(manifestV3.parts.pages.unsupportedBlock).toBe(
			"skip-with-diagnostics (legal pages: reject document)",
		);
		expect(manifestV3.parts.pages.focalPoint).toBe("object-position focalX% focalY%");
		expect(manifestV3.parts.pages.revisionMeta).toBe("maky-cms-revision");
	});

	it("keeps the seven blocks of v2", () => {
		expect(manifestV3.supportedBlocks).toEqual([
			"hero",
			"richText",
			"image",
			"gallery",
			"cta",
			"faq",
			"mediaText",
		]);
	});

	it("maps twelve markets onto ten Payload locales, exactly as the storefront does", () => {
		expect(Object.keys(manifestV3.marketLocales)).toHaveLength(12);
		expect(new Set(Object.values(manifestV3.marketLocales)).size).toBe(10);
		for (const [market, locale] of Object.entries(manifestV3.marketLocales)) {
			expect(isMarketCode(market), market).toBe(true);
			if (isMarketCode(market)) expect(payloadLocaleForMarket(market), market).toBe(locale);
		}
	});
});
