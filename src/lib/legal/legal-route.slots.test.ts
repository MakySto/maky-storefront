import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { legalRoute, type LegalCopy } from "./legal-route";
import { LEGAL_LOCALES } from "./locale";

/**
 * The two slots around an approved body: `Before` and `After`.
 *
 * `After` held `/kontakt`'s form from the start. `Before` is for what has to be seen first and is not part of
 * the disclosure, the note on the product a visitor asked a quote for (2026-10-08). Both stay outside the body,
 * which is approved copy, and a page that gives neither renders exactly what it rendered before.
 */

/** A stand-in for a slot or a body: a paragraph that says which one it is and for which channel. */
function slot(name: string) {
	function Slot({ channel }: { channel: string }): ReactElement {
		return createElement("p", { "data-slot": name }, `${name}:${channel}`);
	}
	return Slot;
}

const copy = Object.fromEntries(
	LEGAL_LOCALES.map((locale) => [
		locale,
		{ title: `Title ${locale}`, description: "d", Body: slot("body") } satisfies LegalCopy,
	]),
) as Record<(typeof LEGAL_LOCALES)[number], LegalCopy>;

const SK = CHANNEL_MAP.sk.saleorSlug;

const render = async (route: ReturnType<typeof legalRoute>, channel: string): Promise<string> =>
	renderToStaticMarkup(await route.Page({ params: Promise.resolve({ channel }) }));

describe("legalRoute slots", () => {
	it("renders Before, then the body, then After, in the prose column under the title", async () => {
		const html = await render(
			legalRoute({ path: "/x", copy, Before: slot("before"), After: slot("after") }),
			SK,
		);
		const at = ["<h1", "before:", "body:", "after:"].map((marker) => html.indexOf(marker));
		expect(at.every((index) => index >= 0)).toBe(true);
		expect(at).toEqual([...at].sort((a, b) => a - b));
		// Inside the prose column, not above it.
		expect(html.indexOf("prose")).toBeLessThan(html.indexOf("before:"));
	});

	it("hands each slot the channel of the market", async () => {
		const html = await render(
			legalRoute({ path: "/x", copy, Before: slot("before"), After: slot("after") }),
			SK,
		);
		expect(html).toContain(`before:${SK}`);
		expect(html).toContain(`after:${SK}`);
	});

	it("renders the page exactly as before where a route gives no Before", async () => {
		const withAfter = await render(legalRoute({ path: "/x", copy, After: slot("after") }), SK);
		expect(withAfter).not.toContain("before:");
		const plain = await render(legalRoute({ path: "/x", copy }), SK);
		expect(plain).not.toContain("before:");
		expect(plain).not.toContain("after:");
		expect(plain).toContain("body:");
	});
});
