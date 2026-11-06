import { describe, expect, it } from "vitest";

import { CATALOG_REDIRECTS } from "./redirects";
import { PRODUCT_REDIRECTS, productRedirectTarget, setProductRedirectsForTests } from "./product-redirects";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("the shipped product redirect table", () => {
	it("holds only single usable slugs, none pointing at itself", () => {
		for (const [market, slugs] of Object.entries(PRODUCT_REDIRECTS.exact)) {
			for (const [from, to] of Object.entries(slugs)) {
				expect(from, `${market} ${from}`).toMatch(SLUG);
				expect(to, `${market} ${from}`).toMatch(SLUG);
				expect(to, `${market} ${from}`).not.toBe(from);
			}
		}
	});

	it("sends nobody through a second hop: no target is itself retired", () => {
		for (const [market, slugs] of Object.entries(PRODUCT_REDIRECTS.exact)) {
			for (const [from, to] of Object.entries(slugs)) {
				expect(slugs[to], `${market} ${from} -> ${to}`).toBeUndefined();
			}
		}
	});

	it("does not overlap the vehicle-page table: a product slug is never a catalogue path", () => {
		for (const slugs of Object.values(PRODUCT_REDIRECTS.exact)) {
			for (const from of Object.keys(slugs)) {
				for (const paths of Object.values(CATALOG_REDIRECTS.exact)) {
					expect(paths[`/${from}`]).toBeUndefined();
				}
			}
		}
	});

	// CFM hid six wrong Kargo sets for the Citroën Berlingo K9 in all ten channels on 2026-11-06 (15:28 to 15:37 UTC) and
	// kept the right ones: the old addresses answered 404 in every market for a day, with the replacement a click away.
	it("sends the six hidden Berlingo K9 Kargo sets to their replacements in Slovakia, as CFM wrote the pairs", () => {
		const pairs: Record<string, string> = {
			"stresny-nosic-nordrive-kargo-pre-citroen-berlingo-k9-od-2022-2-tyce-150-cm-2xn10010-2xn30362":
				"stresny-nosic-nordrive-kargo-pre-citroen-berlingo-k9-2018-2022-2-tyce-150-cm-2xn10010-n30362",
			"stresny-nosic-nordrive-kargo-plus-pre-citroen-berlingo-k9-od-2022-2-tyce-150-cm-2xn10040-2xn30362":
				"stresny-nosic-nordrive-kargo-plus-pre-citroen-berlingo-k9-2018-2022-2-tyce-150-cm-2xn10040-n30362",
			"stresny-nosic-nordrive-kargo-pre-citroen-berlingo-k9-od-2022-3-tyce-150-cm-3xn10010-3xn30363":
				"stresny-nosic-nordrive-kargo-pre-citroen-berlingo-k9-od-2018-3-tyce-150-cm-3xn10010-n30363",
			"stresny-nosic-nordrive-kargo-plus-pre-citroen-berlingo-k9-od-2022-3-tyce-150-cm-3xn10040-3xn30363":
				"stresny-nosic-nordrive-kargo-plus-pre-citroen-berlingo-k9-od-2018-3-tyce-150-cm-3xn10040-n30363",
			"stresny-kos-nordrive-kargo-rack-pre-citroen-berlingo-k9-od-2022-210-x-150-x-12-cm-nkr0403-3xn30363":
				"stresny-kos-nordrive-kargo-rack-pre-citroen-berlingo-k9-2018-2022-210-x-150-x-12-cm-nkr0403-n30363",
			"stresny-kos-nordrive-kargo-rack-pre-citroen-berlingo-k9-od-2022-210-x-150-x-7-cm-nkr0903-3xn30363":
				"stresny-kos-nordrive-kargo-rack-pre-citroen-berlingo-k9-2018-2022-210-x-150-x-7-cm-nkr0903-n30363",
		};
		for (const [from, to] of Object.entries(pairs)) expect(PRODUCT_REDIRECTS.exact.sk?.[from], from).toBe(to);
	});

	it("holds the same six in the nine other markets, under each market's own translated slugs", () => {
		for (const market of ["cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro"]) {
			const own = PRODUCT_REDIRECTS.exact[market] ?? {};
			expect(Object.keys(own), market).toHaveLength(6);
			// the words differ by language ("od", "ab", "dal", "desde" ...), the years do: every old address names 2022,
			// every replacement 2018
			for (const [from, to] of Object.entries(own)) {
				expect(from, `${market} ${from}`).toMatch(/berlingo-k9.*2022/);
				expect(to, `${market} ${from}`).toMatch(/berlingo-k9.*2018/);
			}
		}
	});
});

describe("productRedirectTarget", () => {
	it("answers per market and returns null for what is not retired", () => {
		setProductRedirectsForTests({ sk: { old: "new" } });
		expect(productRedirectTarget("sk", "old")).toBe("new");
		expect(productRedirectTarget("sk", "new")).toBeNull();
		expect(productRedirectTarget("cz", "old")).toBeNull();
		setProductRedirectsForTests(null);
		expect(productRedirectTarget("sk", "old")).toBeNull();
	});
});
