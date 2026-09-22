import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * The baked `noindex` floor for a market no index GO has been given for.
 *
 * This is the SECOND of two gates and the only one that survives the first going
 * missing. The first is the `X-Robots-Tag` header `marketRewrite()` sets in
 * src/proxy.ts, and it covers exactly the responses that function produces; anything
 * reached another way carries whatever the page's own metadata says. Until this landed
 * that was `index, follow` for all twelve markets.
 *
 * Executed rather than grepped: the value is a conditional, and a test that only proves
 * the source mentions `robots` would pass just as happily with the condition inverted.
 */
const metadataFor = async (channel: string, env: Record<string, string | undefined>) => {
	vi.resetModules();
	// The layout's transitive imports reach the Saleor client, which refuses to load
	// without these. They say nothing about robots; they are here so the module can be
	// imported at all.
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) vi.stubEnv(key, "");
		else vi.stubEnv(key, value);
	}
	const { generateMetadata } = await import("./layout");
	return generateMetadata({ params: Promise.resolve({ channel }) });
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

const SK = CHANNEL_MAP.sk.saleorSlug;
const DE = CHANNEL_MAP.de.saleorSlug;

describe("the market layout bakes a noindex floor", () => {
	it("refuses a preview market in the page's own metadata", async () => {
		const meta = await metadataFor(DE, {});
		expect(meta.robots).toEqual({
			index: false,
			follow: false,
			googleBot: { index: false, follow: false },
		});
	});

	it("says nothing for a market that is live and cleared, so pages decide", async () => {
		// Absent, not `index: true`. A layout that asserted indexability would override
		// every page that has its own reason to refuse — a not-found PDP, an empty
		// category, a checkout step.
		//
		// And absent, not `undefined`: Next merges with `for (key in metadata)`, so a key
		// that is present with the value `undefined` still resets the root's `index,
		// follow, max-image-preview:large` to nothing. `toBeUndefined()` cannot tell the
		// two apart, which is how the layout shipped with no robots meta on any page of
		// an indexable market from 2026-09-20.
		const meta = await metadataFor(SK, {});
		expect(meta).not.toHaveProperty("robots");
		expect(Object.keys(meta)).not.toContain("robots");
	});

	it("keeps refusing a market that is merely live", async () => {
		// The property the change exists for: a restart opens a market for business
		// without opening it to a crawler.
		const meta = await metadataFor(DE, { MAKY_LIVE_MARKETS: "sk,de" });
		expect(meta.robots).toMatchObject({ index: false });
	});

	it("lifts only when both gates are open", async () => {
		const meta = await metadataFor(DE, {
			MAKY_LIVE_MARKETS: "sk,de",
			MAKY_INDEXABLE_MARKETS: "sk,de",
		});
		expect(meta).not.toHaveProperty("robots");
	});

	it("lifts for every market once all twelve are cleared — the production state today", async () => {
		const all = Object.keys(CHANNEL_MAP).join(",");
		for (const { saleorSlug } of Object.values(CHANNEL_MAP)) {
			const meta = await metadataFor(saleorSlug, { MAKY_LIVE_MARKETS: all, MAKY_INDEXABLE_MARKETS: all });
			expect(meta, saleorSlug).not.toHaveProperty("robots");
		}
	});

	it("keeps the floor, exactly as before, for every market not cleared", async () => {
		for (const { saleorSlug } of Object.values(CHANNEL_MAP)) {
			if (saleorSlug === SK) continue;
			const meta = await metadataFor(saleorSlug, {});
			expect(meta.robots, saleorSlug).toEqual({
				index: false,
				follow: false,
				googleBot: { index: false, follow: false },
			});
		}
	});

	it("refuses an unrecognised channel rather than defaulting it open", async () => {
		const meta = await metadataFor("not-a-channel", {});
		expect(meta.robots).toMatchObject({ index: false });
	});
});
