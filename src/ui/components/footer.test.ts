import { describe, expect, it } from "vitest";
import { footerLegalLinks } from "./footer";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";

/**
 * The footer used to gate every legal link on `REVERSE_MAP[channel] === "sk"`, so
 * eleven of the twelve markets rendered a footer with no route to `/kontakt` or
 * `/obchodne-podmienky` at all — the pages answered 200, but nothing linked them.
 * That is the access path zákon 22/2004 and Directive 2000/31/EC Art. 5 ask for,
 * and it is what these tests hold in place.
 *
 * Nothing here restates which markets have which route: that answer belongs to
 * `route-policy.ts`, and a second copy of it is exactly the drift this replaced.
 */

const CHANNELS = Object.values(CHANNEL_MAP).map((c) => c.saleorSlug);

const hrefsOf = (channel: string) => {
	const { support, company, showPrivacyPolicy, showTerms } = footerLegalLinks(channel);
	return [
		...support.map((l) => l.href),
		...company.map((l) => l.href),
		...(showPrivacyPolicy ? ["/ochrana-osobnych-udajov"] : []),
		...(showTerms ? ["/obchodne-podmienky"] : []),
	];
};

describe("footer legal links", () => {
	it("covers every channel in the map", () => {
		expect(CHANNELS).toHaveLength(12);
	});

	it("never links a route the market does not have", () => {
		for (const channel of CHANNELS) {
			const market = REVERSE_MAP[channel];
			for (const href of hrefsOf(channel)) {
				expect(
					marketHasRoute(market, href.slice(1)),
					`${market} footer links ${href}, which route-policy would 404`,
				).toBe(true);
			}
		}
	});

	it("gives every market its mandatory contact and terms links", () => {
		for (const channel of CHANNELS) {
			const hrefs = hrefsOf(channel);
			expect(hrefs, `${REVERSE_MAP[channel]} must link /kontakt`).toContain("/kontakt");
			expect(hrefs, `${REVERSE_MAP[channel]} must link /obchodne-podmienky`).toContain("/obchodne-podmienky");
		}
	});

	it("renders the seven static legal routes in all twelve markets", () => {
		const statics = [
			"/kontakt",
			"/doprava-a-platba",
			"/reklamacie-a-vratenie",
			"/odstupenie-od-zmluvy",
			"/obchodne-podmienky",
			"/ochrana-osobnych-udajov",
			"/cookies",
		];
		for (const channel of CHANNELS) {
			for (const href of statics) {
				expect(hrefsOf(channel), `${REVERSE_MAP[channel]} is missing ${href}`).toContain(href);
			}
		}
	});

	it("shows /o-nas only where the CMS actually has it", () => {
		for (const channel of CHANNELS) {
			const market = REVERSE_MAP[channel];
			expect(hrefsOf(channel).includes("/o-nas")).toBe(marketHasRoute(market, "o-nas"));
		}
	});

	it("never links /poradna — it is a CMS route the footer does not carry", () => {
		for (const channel of CHANNELS) {
			expect(hrefsOf(channel)).not.toContain("/poradna");
		}
	});

	it("counts 10 links on sk and 9 on every other market", () => {
		for (const channel of CHANNELS) {
			const market = REVERSE_MAP[channel];
			expect(hrefsOf(channel), `${market} link count`).toHaveLength(market === "sk" ? 10 : 9);
		}
	});

	it("renders no legal link at all for an unknown channel", () => {
		expect(hrefsOf("zz-zzz")).toHaveLength(0);
		const { support, company } = footerLegalLinks("zz-zzz");
		expect(support).toHaveLength(0);
		expect(company).toHaveLength(0);
	});
});
