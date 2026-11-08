import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/market-assortment", () => ({
	getMarketAssortment: async () => ({ known: false }),
	offersFullRange: () => true,
}));

import { HeaderSearch } from "./header-search";

/**
 * The header search is a plain GET form to the market's search page. It was a server action until
 * 2026-11-07, so every page of every market carried a form that is a POST to an opaque action id.
 */
const render = async (channel: string) => renderToStaticMarkup(await HeaderSearch({ channel }));

describe("the header search", () => {
	it("is a GET form to the market's search page, with the query in the parameter the page reads", async () => {
		const html = await render("sk-eur");

		expect(html).toMatch(/<form[^>]*\saction="\/sk\/search"/);
		expect(html).toMatch(/<form[^>]*\smethod="get"/i);
		expect(html).toMatch(/<form[^>]*\srole="search"/);
		expect(html).toMatch(/<input[^>]*\sname="query"/);
	});

	it("carries no server action: no action id, no POST, no encrypted closure", async () => {
		const html = await render("sk-eur");

		expect(html).not.toMatch(/\$ACTION|javascript:|method="post"/i);
		expect(html).not.toMatch(/name="search"/);
	});

	it("refuses an empty or whitespace-only query in the browser, without JavaScript", async () => {
		const html = await render("sk-eur");

		expect(html).toMatch(/<input[^>]*\srequired=""/);
		expect(html).toContain('pattern=".*\\S.*"');
	});

	it("goes to the search page of the market the visitor is in", async () => {
		expect(await render("cz-czk")).toMatch(/<form[^>]*\saction="\/cz\/search"/);
		expect(await render("de-eur")).toMatch(/<form[^>]*\saction="\/de\/search"/);
	});
});
