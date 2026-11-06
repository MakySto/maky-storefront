import { readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// The window the box opens is mounted closed in these renders; it asks the router and the server actions for nothing.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
	usePathname: () => "/sk/snehove-retaze/produkt",
	useParams: () => ({ channel: "sk-eur" }),
}));
vi.mock("@/lib/tyre-size/actions", () => ({
	loadTyreStep: vi.fn(),
	rememberTyreSize: vi.fn(),
	forgetTyreSize: vi.fn(),
}));
vi.mock("@/lib/fitment/selector-actions", () => ({ loadSelectorStep: vi.fn() }));
vi.mock("@/lib/garage/actions", () => ({ chooseVehicle: vi.fn() }));

import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import type { TyreFitView } from "@/lib/tyre-size/types";
import { tyreSizeIndex } from "@/lib/tyre-size/size-index";
import { tyreFit, tyreFitViewOf } from "@/lib/tyre-size/size-lookup";

import { StickyBar } from "./sticky-bar";
import {
	GATE_BUTTON_KEY,
	gateButtonLook,
	HELD_BACK_LABEL,
	TyreSizeGate,
	useTyreSizeGate,
} from "./tyre-fit-box";

/**
 * What a customer meets on a snow chain's page before any JavaScript runs, and what the buy buttons are told.
 *
 * The behaviour (when a choice is complete, what the form carries) is `lib/tyre-size/fit-state`, which has its own
 * tests against the server's check. This pins what the box DRAWS from it, in every language, and that the gate the
 * buy buttons read says the same. A real browser run of the same page, on a desktop and on a phone, is in the pull
 * request.
 */

const LOCALES = [
	"cs-CZ",
	"de-AT",
	"de-DE",
	"en-CA",
	"en-US",
	"es-ES",
	"fr-FR",
	"hu-HU",
	"it-IT",
	"pl-PL",
	"ro-RO",
	"sk-SK",
] as const;

const messages = (locale: string) =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as {
		tyreSize: Record<string, string>;
	};

/** What the buy buttons see: null outside a gate, then whether the choice is complete and why not. */
function Probe() {
	const gate = useTyreSizeGate();
	return createElement("span", {
		"data-gate": gate === null ? "none" : gate.complete ? "complete" : `incomplete:${gate.reason}`,
	});
}

const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
	children?: ReactNode;
}>;
const Gate = TyreSizeGate as unknown as ComponentType<{
	view: TyreFitView;
	fittingHref?: string | null;
	children?: ReactNode;
}>;

const render = (view: TyreFitView, locale = "sk-SK", fittingHref?: string) =>
	renderToStaticMarkup(
		createElement(
			Provider,
			{ locale, timeZone: "UTC", messages: messages(locale) },
			createElement(Gate, { view, fittingHref }, createElement(Probe)),
		),
	);

/** React escapes text in markup: "won't" is written "won&#x27;t". */
const escaped = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("'", "&#x27;")
		.replaceAll('"', "&quot;");

const field = (html: string, name: string) =>
	html.match(new RegExp(`<input type="hidden" name="${name}" value="([^"]*)"`))?.[1];

const NO_SIZE: TyreFitView = { kind: "no-size" };
const FITS = tyreFitViewOf("N16061", "145/70 R12")!;
const CONDITION = tyreFitViewOf("N16128", "215/60 R16")!;
const NO_FIT = tyreFitViewOf("N16061", "205/55 R22")!;
const SUPPLIER = (() => {
	const [code, product] = Object.entries(tyreSizeIndex().products).find(
		([, one]) => !/^manufacturer_list/.test(one.source),
	)!;
	return tyreFitViewOf(code, product.sizes.find(([, , key]) => key === "")![0])!;
})();

describe("the verdict, as the page draws it", () => {
	it("is what the tests think it is", () => {
		expect(FITS).toMatchObject({ kind: "fits", condition: null, fromManufacturerList: true });
		expect(CONDITION).toMatchObject({ kind: "fits", condition: { key: "c01" } });
		expect(NO_FIT).toEqual({ kind: "no-fit", size: "205/55 R22" });
		expect(SUPPLIER).toMatchObject({ kind: "fits", condition: null, fromManufacturerList: false });
		expect(tyreFit("N16061", "145/70 R12")).toEqual(FITS);
	});
});

describe("no size yet", () => {
	const html = render(NO_SIZE);

	it("asks for the size, offers the window, and tells the buy buttons to take the shopper to it", () => {
		expect(html).toContain('data-fit="no-size"');
		expect(html).toContain("Overte, či sedí na vaše pneumatiky");
		expect(html).toContain("Zadať rozmer pneumatík");
		expect(html).toContain("Neviete rozmer? Ako ho nájdete na pneumatike");
		expect(html).toContain('data-gate="incomplete:choose"');
	});

	it("carries 'nothing chosen' in the form, in the three fields the server reads", () => {
		expect(field(html, TYRE_FIELDS.mode)).toBe("size");
		expect(field(html, TYRE_FIELDS.size)).toBe("");
		expect(field(html, TYRE_FIELDS.condition)).toBe("");
	});

	it("keeps the way out for a shopper who knows the code, as a checkbox with no name of its own", () => {
		expect(html).toContain("Kód produktu poznám a rozmer teraz nevyberám");
		const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? "";
		expect(checkbox).not.toBe("");
		expect(checkbox).not.toMatch(/\sname=/);
	});

	it("puts only buttons of type button into the form it sits in, so none of them can add to the cart", () => {
		for (const tag of html.match(/<button\b[^>]*>/g) ?? []) expect(tag, tag).toMatch(/type="button"/);
	});
});

describe("a size that fits", () => {
	const html = render(FITS);

	it("says so, with the size and whose list it is from, and lets the buy buttons through", () => {
		expect(html).toContain('data-fit="fits"');
		expect(html).toContain("Sedí na vaše pneumatiky");
		expect(html).toContain("145/70 R12 · podľa zoznamu výrobcu");
		expect(html).toContain("Zmeniť rozmer");
		expect(html).toContain('data-gate="complete"');
	});

	it("carries that very size in the form", () => {
		expect(field(html, TYRE_FIELDS.mode)).toBe("size");
		expect(field(html, TYRE_FIELDS.size)).toBe("145/70 R12");
		expect(field(html, TYRE_FIELDS.condition)).toBe("");
	});

	it("does not ask what the shopper already told it", () => {
		expect(html).not.toContain("Neviete rozmer?");
		expect(html).not.toContain("Kód produktu poznám");
	});
});

describe("a size that fits under a condition", () => {
	const html = render(CONDITION);

	it("names the condition, asks for the tick, and holds the buy buttons until it is given", () => {
		expect(html).toContain('data-fit="fits-with-condition"');
		expect(html).toContain("Sedí, ale s jednou podmienkou");
		expect(html).toContain(
			"Pre rozmer 215/60 R16 sedí tento produkt iba na pneumatiky: Bridgestone Duravis Rxxx.",
		);
		expect(html).toContain("Potvrdzujem, že moje pneumatiky sú: Bridgestone Duravis Rxxx.");
		expect(html).toContain("Tlačidlo sa odomkne po potvrdení podmienky.");
		expect(html).toContain('data-gate="incomplete:confirm"');
	});

	it("does not send the condition before it is ticked", () => {
		expect(field(html, TYRE_FIELDS.size)).toBe("215/60 R16");
		expect(field(html, TYRE_FIELDS.condition)).toBe("");
	});
});

describe("a size from the supplier's data, not the maker's list", () => {
	it("says so, in the colour of 'not confirmed', and keeps the caution in front of the shopper", () => {
		const html = render(SUPPLIER);
		expect(html).toContain('data-fit="fits-supplier"');
		expect(html).toContain("Podľa dodávateľa sedí na váš rozmer");
		expect(html).toContain("podľa údajov dodávateľa");
		expect(html).toContain(escaped(messages("sk-SK").tyreSize.sourceSupplier));
		expect(html).toContain("bg-fitment-unconfirmed-bg");
		expect(html).toContain('data-gate="complete"');
	});
});

describe("a size the product does not fit", () => {
	const html = render(NO_FIT);

	it("says it does not, holds the buy buttons for good and sends no size", () => {
		expect(html).toContain('data-fit="no-fit"');
		expect(html).toContain("Na 205/55 R22 tento produkt nesedí");
		expect(html).toContain("bg-fitment-no-fit-bg");
		expect(html).toContain('data-gate="incomplete:no-fit"');
		expect(field(html, TYRE_FIELDS.size)).toBe("");
	});

	it("offers the shop's other chains only when the page can name where they are", () => {
		expect(html).not.toContain("Zobraziť reťaze, ktoré sedia");
		const withLink = render(NO_FIT, "sk-SK", "/sk/snehove-retaze?tyres=1");
		expect(withLink).toContain("Zobraziť reťaze, ktoré sedia");
		expect(withLink).toContain('href="/sk/snehove-retaze?tyres=1"');
	});

	it("does not let 'I know the code' argue with the list", () => {
		expect(html).not.toContain("Kód produktu poznám");
	});
});

describe("the text of the buy buttons that hold back", () => {
	it("has a key in every language for every reason", () => {
		for (const locale of LOCALES) {
			const t = messages(locale).tyreSize;
			for (const [reason, key] of Object.entries(GATE_BUTTON_KEY)) {
				expect(t[key], `${locale} ${reason}`).toBeTruthy();
			}
		}
	});
});

describe("how a buy button that holds back looks", () => {
	it("keeps the purchase colour for a missing size and an unconfirmed condition, which are steps toward buying", () => {
		for (const reason of ["choose", "confirm"] as const) {
			const look = gateButtonLook({ reason });
			expect(look.variant, reason).toBe("default");
			expect(look["aria-disabled"], reason).toBeUndefined();
		}
	});

	it("turns a size that does not fit into a quiet button that says it is unavailable, and leaves it pressable", () => {
		const look = gateButtonLook({ reason: "no-fit" });
		expect(look.variant).toBe("secondary");
		expect(look["aria-disabled"]).toBe(true);
		expect(look.className).toContain("shadow-none");
		// `aria-disabled`, never the `disabled` attribute: pressing it still takes the shopper to the size, and on a
		// phone the sticky bar has no other way out (the box has scrolled away).
		expect(look).not.toHaveProperty("disabled");
	});

	it("lets every held-back label wrap instead of being cut off, and leaves a button that is not held back alone", () => {
		expect(gateButtonLook(null)).toEqual({
			variant: "default",
			className: undefined,
			"aria-disabled": undefined,
		});
		for (const reason of ["choose", "confirm", "no-fit"] as const) {
			expect(gateButtonLook({ reason }).className, reason).toContain("whitespace-normal");
		}
		expect(HELD_BACK_LABEL).toContain("line-clamp-2");
	});
});

describe("the fixed buy bar inside the gate", () => {
	const html = renderToStaticMarkup(
		createElement(
			Provider,
			{ locale: "sk-SK", timeZone: "UTC", messages: messages("sk-SK") },
			createElement(
				Gate,
				{ view: NO_SIZE },
				createElement(StickyBar, { productName: "Snehové reťaze", price: "99,00 €", show: true }),
			),
		),
	);

	it("is followed by the 'how do I find the size' link, which is why the bar must not take the form's spacing", () => {
		expect(html.indexOf("Neviete rozmer?")).toBeGreaterThan(html.indexOf("Snehové reťaze"));
	});

	it("takes none of it: the form's `space-y-6` margin would lift a fixed bar 24px off the screen edge, so 24px of it showed while it was hidden", () => {
		const bar = html.match(/<div class="([^"]*\bfixed\b[^"]*)"/)?.[1] ?? "";
		expect(bar).toContain("bottom-0");
		expect(bar).toMatch(/(^|\s)mb-0!(\s|$)/);
	});
});

describe("in every language", () => {
	const views: [string, TyreFitView][] = [
		["no size", NO_SIZE],
		["fits", FITS],
		["fits under a condition", CONDITION],
		["supplier data", SUPPLIER],
		["does not fit", NO_FIT],
	];

	it.each(LOCALES)("%s: every state is words, never a raw key or an unfilled placeholder", (locale) => {
		for (const [name, view] of views) {
			const html = render(view, locale, "/x?tyres=1");
			expect(html, `${locale} ${name}`).not.toMatch(/tyreSize\.[A-Za-z]+/);
			expect(html, `${locale} ${name}`).not.toMatch(/\{(size|tyres)\}/);
		}
	});
});
