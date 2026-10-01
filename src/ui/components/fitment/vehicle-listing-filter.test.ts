import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The listing's vehicle control, rendered — one assertion per state, in the shopper's own words.
 *
 * What these pin is not styling but WHICH TRUE THING each state says. The Thule opening put ~9 150
 * vehicle-specific sets on one shelf, and the control became a two-way switch whose current side must
 * be unmistakable; and a car whose sets are all hidden must be told so, not shown an empty grid under
 * a headline that reads "overené pre …".
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
vi.mock("@/lib/fitment/selector-actions", () => ({
	loadSelectorStep: async () => ({ makes: [{ id: "m1", name: "Škoda" }], unavailable: false }),
}));
vi.mock("@/ui/components/vehicle/vehicle-selector-launcher", () => ({
	VehicleSelectorLauncher: (props: { label?: string }) =>
		createElement("button", { "data-testid": "change-vehicle" }, props.label),
}));
vi.mock("@/ui/components/vehicle/vehicle-quick-select", () => ({
	VehicleQuickSelect: (props: { afterConfirmPath?: string | null }) =>
		createElement("div", { "data-testid": "quick-select", "data-after": props.afterConfirmPath }),
}));

import type { VehicleListingFilter as FilterState } from "@/lib/fitment/plp-vehicle-filter";
import { VehicleListingFilter } from "./vehicle-listing-filter";

const CAR = "BMW X5 E70 · 2012";

async function render(filter: FilterState, searchParams: Record<string, string> = {}) {
	const element = await VehicleListingFilter({
		channel: "sk-eur",
		filter,
		basePath: "/thule-stresne-nosice",
		searchParams,
	});
	return element === null ? null : renderToStaticMarkup(element);
}

const active: FilterState = { state: "active", vehicleLabel: CAR, productIds: ["x"], isDemo: false };

describe("the two-way switch", () => {
	it("marks 'Pre moje auto' as the current side while the list is narrowed to the car", async () => {
		const html = (await render(active))!;
		expect(html).toContain("Zobrazujeme iba produkty overené pre BMW X5 E70 · 2012.");
		// Both sides are links; only the current one is `aria-current`.
		expect(html).toMatch(/aria-current="true"[^>]*>(?:<svg.*?<\/svg>)?Pre moje auto/);
		expect(html).not.toMatch(/aria-current="true"[^>]*>Všetky vozidlá/);
		expect(html).toContain('data-testid="vehicle-mode-switch"');
		expect(html).toContain('aria-label="Zobrazenie ponuky"');
	});

	it("links the other side to an EXPLICIT all-vehicles URL, never to a bare path", async () => {
		const html = (await render(active, { brand: "thule", sort: "price_asc", cursor: "abc" }))!;
		// `?vehicle=0` — the absence of the parameter means "for my car" on a shelf — with the maker and
		// the sort kept and the cursor dropped.
		expect(html).toContain("/sk/thule-stresne-nosice?brand=thule&amp;sort=price_asc&amp;vehicle=0");
		expect(html).toContain("/sk/thule-stresne-nosice?brand=thule&amp;sort=price_asc&amp;vehicle=1");
		expect(html).not.toContain("cursor=");
	});

	it("says all vehicles when the shopper chose all vehicles, and names the car it is not matched to", async () => {
		const html = (await render({ state: "offered", vehicleLabel: CAR, reason: "all" }))!;
		expect(html).toContain(
			"Zobrazujete ponuku pre všetky vozidlá — nie je vybraná podľa vášho auta (BMW X5 E70 · 2012).",
		);
		expect(html).toMatch(/aria-current="true"[^>]*>Všetky vozidlá/);
		expect(html).not.toMatch(/aria-current="true"[^>]*>(?:<svg.*?<\/svg>)?Pre moje auto/);
		// The two modes are different colours, so one glance says which list this is.
		expect(html).toContain("bg-brand");
		expect(html).not.toContain("bg-cta text-cta-text");
	});

	it("keeps the way to change the car in both modes", async () => {
		for (const filter of [active, { state: "offered", vehicleLabel: CAR, reason: "all" } as const]) {
			expect(await render(filter)).toContain('data-testid="change-vehicle"');
		}
	});
});

describe("when the car's own list is not what the shopper sees", () => {
	it("says the car has nothing verified and that the shelf is whole — not a dead end", async () => {
		const html = (await render({ state: "offered", vehicleLabel: CAR, reason: "none-fit" }))!;
		expect(html).toContain(
			"Pre BMW X5 E70 · 2012 zatiaľ nemáme overenú zostavu, preto vidíte ponuku pre všetky vozidlá.",
		);
		// Still the switch, so "for my car" stays one click away and explicit.
		expect(html).toContain("vehicle=1");
	});

	it("says it could not judge when the dataset cannot answer, and that the list was not narrowed", async () => {
		const html = (await render({ state: "unanswerable", vehicleLabel: CAR, verdict: "STALE" }))!;
		expect(html).toContain("teraz nevieme overiť, preto sme ponuku nezúžili — vidíte ju celú");
	});
});

describe("every verified set is hidden in the shop", () => {
	const notOnSale: FilterState = { state: "not-on-sale", vehicleLabel: CAR, isDemo: false };

	it("says the sets exist and are not on sale — neither 'nothing fits' nor 'here is everything'", async () => {
		const html = (await render(notOnSale))!;
		expect(html).toContain('data-testid="vehicle-not-on-sale"');
		expect(html).toContain(
			"Pre BMW X5 E70 · 2012 existujú kompatibilné zostavy, ktoré momentálne nie sú v predaji",
		);
		expect(html).toContain("Neznamená to, že nič nepasuje.");
		// The honest wording, not the "nothing found" one.
		expect(html).not.toContain("zatiaľ nemáme overený produkt");
	});

	it("offers all vehicles as an EXPLICIT choice rather than switching to it silently", async () => {
		const html = (await render(notOnSale))!;
		expect(html).toContain("/sk/thule-stresne-nosice?vehicle=0");
		expect(html).toContain("Všetky vozidlá");
		expect(html).toContain('data-testid="change-vehicle"');
	});
});

describe("the states that already existed keep what they said", () => {
	it("asks for a car when there is none, in the full-width bar", async () => {
		const html = (await render({ state: "no-vehicle", requested: false }))!;
		expect(html).toContain("Vyberte svoje auto");
		expect(html).toContain('data-testid="quick-select"');
		// A car confirmed here lands on this listing with the filter ON, explicitly (channel-relative).
		expect(html).toContain('data-after="/thule-stresne-nosice?vehicle=1"');
	});

	it("tells a shopper who asked for their car and has none that the list was not narrowed", async () => {
		const html = (await render({ state: "no-vehicle", requested: true }))!;
		expect(html).toContain("Najprv vyberte vozidlo. Ponuku sme nezúžili — vidíte ju celú.");
	});

	it("keeps the panel for an EXPLICIT request that found nothing, and 'Zrušiť filter' now says all vehicles", async () => {
		const html = (await render({ state: "empty", vehicleLabel: CAR, isDemo: false }))!;
		expect(html).toContain("Pre BMW X5 E70 · 2012 zatiaľ nemáme overený produkt");
		expect(html).toContain("Zrušiť filter");
		expect(html).toContain("/sk/thule-stresne-nosice?vehicle=0");
	});

	it("says nothing on a shelf the programme never assessed, or with no dataset", async () => {
		expect(await render({ state: "out-of-scope" })).toBeNull();
		expect(await render({ state: "unavailable" })).toBeNull();
	});
});
