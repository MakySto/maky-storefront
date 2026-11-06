import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The snow-chain listing's tyre control, rendered: one assertion per state, in the shopper's own words.
 *
 * What these pin is which TRUE THING each state says. The shelf holds ~145 products and a size fits only a handful of
 * them, so for a shopper who has given a size the narrowed list is the default, and the switch must say which of the
 * two lists is on; a size nothing fits must say so and keep the whole shelf one click away, not leave an empty grid.
 */

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../../../i18n/messages");
// Loosely typed on purpose: the files are the fixture, and next-intl is not type-augmented.
const load = (locale: string): Record<string, any> =>
	JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), "utf8")) as Record<string, any>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ channel: "sk-eur" }) }));
vi.mock("@/ui/components/vehicle/tyre-size-launcher", () => ({
	TyreSizeLauncher: (props: { label?: string; variant?: string }) =>
		createElement(
			"button",
			{ "data-testid": props.variant === "primary" ? "enter-size" : "change-size" },
			props.label,
		),
}));

import type { TyreListingFilter as FilterState } from "@/lib/tyre-size/plp-tyre-filter";
import { TyreListingFilter } from "./tyre-listing-filter";

const SIZE = "205/55 R16";

async function render(
	filter: FilterState,
	searchParams: Record<string, string> = {},
	channel = "sk-eur",
): Promise<string | null> {
	const element = await TyreListingFilter({ channel, filter, basePath: "/snehove-retaze", searchParams });
	return element === null ? null : renderToStaticMarkup(element);
}

const active: FilterState = { state: "active", size: SIZE, productIds: ["x"] };

describe("the control says nothing where it has nothing true to say", () => {
	it("renders nothing off the snow-chain shelf, and nothing when the shop's products could not be read", async () => {
		expect(await render({ state: "out-of-scope" })).toBeNull();
		expect(await render({ state: "unavailable", size: SIZE })).toBeNull();
	});
});

describe("before a size is known", () => {
	it("asks for it, once, with the one button that answers", async () => {
		const html = (await render({ state: "no-size", requested: false }))!;
		expect(html).toContain('data-testid="tyre-listing-ask"');
		expect(html).toContain("Aký rozmer pneumatík máte?");
		expect(html).toContain("Zadáte ho raz a obchod si ho zapamätá.");
		expect(html).toContain('data-testid="enter-size"');
		expect(html).toContain("Zadať rozmer pneumatík");
		// It offers no switch: there is nothing yet to switch between.
		expect(html).not.toContain("tyre-mode-switch");
	});
});

describe("the two-way switch", () => {
	it("marks 'Pre moje pneumatiky' as the current side while the list is narrowed", async () => {
		const html = (await render(active))!;
		expect(html).toContain("Zobrazujeme len produkty pre rozmer 205/55 R16.");
		expect(html).toMatch(/aria-current="true"[^>]*>(?:<svg.*?<\/svg>)?Pre moje pneumatiky/);
		expect(html).not.toMatch(/aria-current="true"[^>]*>Všetky reťaze/);
		expect(html).toContain('data-testid="tyre-mode-switch"');
		expect(html).toContain('aria-label="Zobrazenie ponuky"');
		expect(html).toContain('data-testid="change-size"');
	});

	it("links the other side to an EXPLICIT all-chains URL, never to a bare path", async () => {
		const html = (await render(active, { brand: "nordrive", sort: "price_asc", cursor: "abc" }))!;
		// `?tyres=0`: the absence of the parameter means "for my tyres" on this shelf. The maker and the sort are kept
		// and the cursor, which belonged to the narrowed list, is dropped.
		expect(html).toContain("/sk/snehove-retaze?brand=nordrive&amp;sort=price_asc&amp;tyres=0");
		expect(html).toContain("/sk/snehove-retaze?brand=nordrive&amp;sort=price_asc&amp;tyres=1");
		expect(html).not.toContain("cursor=");
	});

	it("says all chains when the shopper chose all, and names the size it is not matched to", async () => {
		const html = (await render({ state: "offered", size: SIZE, reason: "all" }))!;
		expect(html).toContain("Zobrazujete všetky produkty, nie sú vybrané podľa vášho rozmeru (205/55 R16).");
		expect(html).toMatch(/aria-current="true"[^>]*>Všetky reťaze/);
		expect(html).not.toMatch(/aria-current="true"[^>]*>(?:<svg.*?<\/svg>)?Pre moje pneumatiky/);
		// The two modes are different colours, so one glance says which list this is.
		expect(html).toContain("bg-brand");
		expect(html).not.toContain("bg-cta text-cta-text");
		expect(html).toContain('data-testid="change-size"');
	});
});

describe("when the size's own list is not what the shopper sees", () => {
	it("says nothing fits and that the shelf is whole, not a dead end", async () => {
		const html = (await render({ state: "offered", size: SIZE, reason: "none-fit" }))!;
		expect(html).toContain(
			"Pre rozmer 205/55 R16 teraz nemáme v ponuke nič, čo by naň sedelo, preto vidíte všetky produkty.",
		);
		expect(html).toContain('data-reason="none-fit"');
		// Still the switch, so the narrowed list stays one explicit click away.
		expect(html).toContain("tyres=1");
	});

	it("gives an explicit request for such a size its own panel with the three ways on", async () => {
		const html = (await render({ state: "empty", size: SIZE }))!;
		expect(html).toContain('data-testid="tyre-listing-empty"');
		expect(html).toContain("Pre rozmer 205/55 R16 teraz nemáme v ponuke nič, čo by naň sedelo");
		// Everything, another size, a person.
		expect(html).toContain("tyres=0");
		expect(html).toContain('data-testid="change-size"');
		expect(html).toContain('href="/sk/kontakt"');
	});
});

describe("in every language", () => {
	const LOCALE_OF_CHANNEL: Record<string, string> = { "sk-eur": "sk-SK", "cz-czk": "cs-CZ" };

	it("reads the listing's texts from the market's own file, with the size filled in", async () => {
		for (const [channel, locale] of Object.entries(LOCALE_OF_CHANNEL)) {
			const html = (await render(active, {}, channel))!;
			const expected = (load(locale).tyreSize.listingActive as string).replace("{size}", SIZE);
			expect(html, locale).toContain(expected);
			expect(html, locale).not.toContain("{size}");
		}
	});
});
