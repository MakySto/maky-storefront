import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CmsBlockLink } from "@/lib/cms/blocks";
import { CmsLink } from "./cms-link";

afterEach(() => vi.unstubAllEnvs());

const external = (url: string): CmsBlockLink => ({
	label: "Vybrať strešný nosič",
	target: { kind: "external", url },
	newTab: false,
	appearance: "primary",
	id: null,
});

const render = (link: CmsBlockLink) =>
	renderToStaticMarkup(createElement(CmsLink, { link, channel: "sk-eur" }));

/** The advice guide's button, as the CMS holds it. */
describe("CmsLink — a block link to a category of the shop", () => {
	it("is shown at the category's address, not in the retired /categories/ form (owner, 2026-11-15)", () => {
		vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
		const html = render(external("https://maky.store/sk/categories/stresne-nosice"));
		expect(html).toContain('href="https://maky.store/sk/stresne-nosice"');
		expect(html).not.toContain("/categories/");
	});

	it("leaves a link to another site as the editor wrote it", () => {
		vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
		const html = render(external("https://example.com/sk/categories/stresne-nosice"));
		expect(html).toContain('href="https://example.com/sk/categories/stresne-nosice"');
	});
});
