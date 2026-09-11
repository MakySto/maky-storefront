import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasMarketBody, isContentReady, requiresMarketBody } from "./content-readiness";
import { parsePagesResponse } from "./page-schema";
import type { MarketCode } from "./markets";

/**
 * The content-not-ready case, against the provider's own fixtures.
 *
 * `parsePagesResponse` filters `layout[]` by market and then reports `ok` whatever is
 * left — including nothing — and `fetchCmsPage` turned that into `found`. The route
 * then rendered an `<h1>` plus the company block and called it a page: a finished
 * page with no content, a navigation target, a sitemap entry and an hreflang alternate.
 *
 * It is reachable through the two shared-locale pairs. DE and AT both read Payload
 * locale `de`, so a document carrying only the Austrian paragraph answers a German
 * request with a page-level "yes" and no German text. Same for US/CA on `en`.
 *
 * These four fixtures are P's, vendored from the provider handoff. They are
 * SYNTHETIC — hand-built REST envelopes, not HTTP captures, and not provider E2E.
 * The provider labels them `synthetic-not-http-capture` and this test does not
 * upgrade that claim.
 */

const DIR = path.join(process.cwd(), "src/lib/cms/__fixtures__/provider-handoff-20260910");

type NegativeFixture = {
	readonly path: string;
	readonly sha256: string;
	readonly classification: string;
	readonly requestMarket: MarketCode;
	readonly payloadLocale: string;
	readonly onlyBodyMarket: MarketCode;
	readonly pageAllowed: boolean;
	readonly expectedFilteredLayoutLength: number;
	readonly expectedReadiness: string;
	readonly slovakFallbackAllowed: boolean;
};

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8")) as {
	negativeFixtures: readonly NegativeFixture[];
	contentReadiness: Record<string, unknown>;
	document: { slug: string; id: string };
};

const readFixture = (name: string) => fs.readFileSync(path.join(DIR, "negative", name));

describe("provider handoff fixtures are the provider's, unmodified", () => {
	it("carries the four negative fixtures the manifest names", () => {
		expect(manifest.negativeFixtures).toHaveLength(4);
	});

	// Prettier in the pre-commit hook rewrites staged JSON, which changes the bytes and
	// breaks the checksum. The directory is in `.prettierignore` for this reason; this
	// test is what notices if that ever stops being true.
	it.each(manifest.negativeFixtures.map((f) => [f.path.split("/").pop()!, f] as const))(
		"%s matches its recorded SHA-256",
		(name, fixture) => {
			expect(createHash("sha256").update(readFixture(name)).digest("hex")).toBe(fixture.sha256);
		},
	);

	it("does not claim the fixtures are HTTP captures", () => {
		for (const fixture of manifest.negativeFixtures) {
			expect(fixture.classification).toBe("synthetic-not-http-capture");
		}
	});
});

describe("content-not-ready — a published page with no body for this market", () => {
	it.each(manifest.negativeFixtures.map((f) => [f.path.split("/").pop()!, f] as const))(
		"%s: page-level yes, no body for the requested market",
		(name, fixture) => {
			const body = JSON.parse(readFixture(name).toString("utf8")) as unknown;
			const parsed = parsePagesResponse(body, fixture.requestMarket);

			// The page IS allowed here — this is not a market-mismatch, and mistaking the
			// two is how the bug hid.
			expect(parsed.status, `${name} should parse, not be excluded`).toBe("ok");
			if (parsed.status !== "ok") return;

			expect(parsed.page.layout).toHaveLength(fixture.expectedFilteredLayoutLength);
			expect(hasMarketBody(parsed.page.layout)).toBe(false);
			expect(isContentReady(manifest.document.slug, parsed.page.layout)).toBe(false);
		},
	);

	it("the other market of the pair does get its body", () => {
		// The same document is ready for whichever market it was written for. Without
		// this, a check that simply returned false everywhere would pass the cases above.
		for (const fixture of manifest.negativeFixtures) {
			const name = fixture.path.split("/").pop()!;
			const body = JSON.parse(readFixture(name).toString("utf8")) as unknown;
			const parsed = parsePagesResponse(body, fixture.onlyBodyMarket);
			expect(parsed.status).toBe("ok");
			if (parsed.status !== "ok") continue;
			expect(
				isContentReady(manifest.document.slug, parsed.page.layout),
				`${name} should be ready for ${fixture.onlyBodyMarket}`,
			).toBe(true);
		}
	});
});

describe("the rule is narrow on purpose", () => {
	it("applies to o-nas, which has a body contract", () => {
		expect(requiresMarketBody("o-nas")).toBe(true);
	});

	it("does not apply to poradna, whose contract says nothing about a body", () => {
		expect(requiresMarketBody("poradna")).toBe(false);
		// …so an empty layout there is not treated as a failure.
		expect(isContentReady("poradna", [])).toBe(true);
	});

	it("chrome is not a body: an image or CTA alone does not make a page ready", () => {
		const image = {
			blockType: "image" as const,
			id: "b1",
			blockName: null,
			markets: null,
			media: { url: "https://cms-media.maky.store/media/x.png", alt: "x", width: 1, height: 1 },
			caption: null,
		};
		expect(hasMarketBody([image as never])).toBe(false);
	});

	it("an empty rich-text body does not count as a body", () => {
		const blank = {
			blockType: "richText" as const,
			id: "b2",
			blockName: null,
			markets: null,
			content: { root: { type: "root", children: [{ type: "paragraph", children: [] }] } },
		};
		expect(hasMarketBody([blank as never])).toBe(false);
	});
});
