import { readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// The window the row opens is mounted closed in these renders; it asks the router and the server actions for nothing.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
	usePathname: () => "/sk/snehove-retaze/produkt",
	useParams: () => ({ channel: "sk-eur" }),
}));
vi.mock("@/lib/tyre-size/actions", () => ({
	loadTyreStep: vi.fn(),
	rememberTyreSize: vi.fn(),
	rememberTyreAnswer: vi.fn(),
	forgetTyreSize: vi.fn(),
}));
vi.mock("@/lib/fitment/selector-actions", () => ({ loadSelectorStep: vi.fn() }));
vi.mock("@/lib/garage/actions", () => ({ chooseVehicle: vi.fn() }));

import { tyreViewOf } from "@/lib/tyre-size/choice";
import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import { tyreFitState } from "@/lib/tyre-size/fit-state";
import type { TyreFitView } from "@/lib/tyre-size/types";
import { tyreSizeIndex } from "@/lib/tyre-size/size-index";

import { StickyBar } from "./sticky-bar";
import {
	GATE_BUTTON_KEYS,
	GateIcon,
	gateButtonKey,
	gateButtonLook,
	HELD_BACK_LABEL,
	TyreFitRow,
	TyreKnowsCode,
	TyreSizeGate,
	useTyreSizeGate,
	viewKey,
} from "./tyre-fit-box";

/**
 * What a customer meets on a snow chain's page before any JavaScript runs, and what the buy buttons are told.
 *
 * The behaviour (when a choice is complete, what the form carries) is `lib/tyre-size/fit-state`, which has its own
 * tests against the server's check. This pins what the row DRAWS from it, in every language, and that the gate the
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

/** What the buy buttons see: null outside a gate, then whether the choice is complete, why not, and what they say. */
function Probe() {
	const gate = useTyreSizeGate();
	return createElement("span", {
		"data-gate": gate === null ? "none" : gate.complete ? "complete" : `incomplete:${gate.reason}`,
		"data-button": gate === null || gate.complete ? "" : gateButtonKey(gate),
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
	hrefs: { find: string; contact: string };
	children?: ReactNode;
}>;

const HREFS = { find: "/sk/snehove-retaze?tyres=1&tyreSize=195%2F75+R16", contact: "/sk/kontakt?ref=N16061" };

const render = (view: TyreFitView, locale = "sk-SK") =>
	renderToStaticMarkup(
		createElement(
			Provider,
			{ locale, timeZone: "UTC", messages: messages(locale) },
			createElement(
				Gate,
				{ view, hrefs: HREFS },
				createElement(TyreFitRow),
				createElement(TyreKnowsCode),
				createElement(Probe),
			),
		),
	);

const field = (html: string, name: string) =>
	html.match(new RegExp(`<input type="hidden" name="${name}" value="([^"]*)"`))?.[1];

const DUV = "Bridgestone Duravis Rxxx";
const MAKE_KEY = "Continental|Kleber|Michelin";

const NO_SIZE: TyreFitView = { kind: "no-size" };
const UNLISTED: TyreFitView = { kind: "unlisted", size: "205/40 R21" };
const FITS = tyreViewOf("N16061", "145/70 R12")!;
const ASK_MAKE = tyreViewOf("N16105", "195/75 R16")!;
const ASK_MODEL = tyreViewOf("N16128", "215/60 R16")!;
const FITS_ANSWERED = tyreViewOf("N16128", "215/60 R16", { [DUV]: DUV })!;
const FITS_OTHER_MAKE = tyreViewOf("N16128", "195/75 R16", { [MAKE_KEY]: "other" })!;
const OTHER_NOT_SOLD = tyreViewOf("N16128", "215/60 R16", { [DUV]: "other" })!;
const OTHER_LINKED: TyreFitView = {
	kind: "other",
	size: "215/60 R16",
	alternatives: [{ code: "N16105", sizeLabel: "22,5", href: "/sk/snehove-retaze/s16-22-5" }],
	elsewhere: true,
};
const OTHER_MANY: TyreFitView = {
	kind: "other",
	size: "215/60 R16",
	alternatives: [
		{ code: "N16105", sizeLabel: "22,5", href: null },
		{ code: "N16106", sizeLabel: "23", href: null },
	],
	elsewhere: true,
};
/** The sock the shopper needs is another PRODUCT of the line (its code is its only label), not on sale, nothing else is. */
const OTHER_CODE_NOWHERE: TyreFitView = {
	kind: "other",
	size: "205/55 R16",
	alternatives: [{ code: "N17142", sizeLabel: "N17142", href: null }],
	elsewhere: false,
};
/** The right size is another code of the model, the shop does not sell it, and sells nothing else for the size. */
const OTHER_NOWHERE: TyreFitView = { ...OTHER_NOT_SOLD, elsewhere: false } as TyreFitView;
const NO_FIT_ELSEWHERE = tyreViewOf("N16061", "195/75 R16")!;
const NO_FIT_NOWHERE: TyreFitView = { kind: "no-fit", size: "270/75 R15", elsewhere: false };
const SUPPLIER = (() => {
	const [code, product] = Object.entries(tyreSizeIndex().products).find(
		([, one]) => !/^manufacturer_list/.test(one.source),
	)!;
	return tyreViewOf(code, product.sizes.find(([, , key]) => key === "")![0])!;
})();

const ALL_VIEWS: [string, TyreFitView][] = [
	["no size", NO_SIZE],
	["an unlisted size", UNLISTED],
	["fits", FITS],
	["asks for the make", ASK_MAKE],
	["asks for the model", ASK_MODEL],
	["fits on the tyres they named", FITS_ANSWERED],
	["fits on tyres of another make", FITS_OTHER_MAKE],
	["another size of the model", OTHER_NOT_SOLD],
	["another size, linked", OTHER_LINKED],
	["several other sizes", OTHER_MANY],
	["another size, sold nowhere", OTHER_NOWHERE],
	["another product, sold nowhere", OTHER_CODE_NOWHERE],
	["does not fit, others do", NO_FIT_ELSEWHERE],
	["does not fit, nothing does", NO_FIT_NOWHERE],
	["supplier data", SUPPLIER],
];

describe("the views, as the tests think of them", () => {
	it("are the ones the engine answers", () => {
		expect(FITS).toMatchObject({ kind: "fits", answer: null, question: null, fromManufacturerList: true });
		expect(ASK_MAKE).toMatchObject({ kind: "ask", question: { subject: "make" } });
		expect(ASK_MODEL).toMatchObject({ kind: "ask", question: { subject: "model" } });
		expect(FITS_ANSWERED).toMatchObject({ kind: "fits", answer: DUV });
		expect(FITS_OTHER_MAKE).toMatchObject({ kind: "fits", answer: "other" });
		expect(OTHER_NOT_SOLD).toMatchObject({
			kind: "other",
			alternatives: [{ code: "N16105", sizeLabel: "22,5", href: null }],
			elsewhere: true,
		});
		expect(NO_FIT_ELSEWHERE).toEqual({ kind: "no-fit", size: "195/75 R16", elsewhere: true });
		expect(SUPPLIER).toMatchObject({ kind: "fits", fromManufacturerList: false });
	});
});

describe("no size yet", () => {
	const html = render(NO_SIZE);

	it("asks for the size in one short row, offers the window, and tells the buy buttons to take the shopper to it", () => {
		expect(html).toContain('data-fit="no-size"');
		expect(html).toContain("Pneumatiky");
		expect(html).toContain("Zadajte rozmer a overíme, či to sedí.");
		expect(html).toContain("Vybrať rozmer");
		expect(html).toContain('data-gate="incomplete:choose"');
		expect(html).toContain('data-button="selectSize"');
	});

	it("carries 'nothing chosen' in the form, in the three fields the server reads", () => {
		expect(field(html, TYRE_FIELDS.mode)).toBe("size");
		expect(field(html, TYRE_FIELDS.size)).toBe("");
		expect(field(html, TYRE_FIELDS.answer)).toBe("");
	});

	it("keeps the way out for a shopper who knows the code as one quiet line, not a checkbox", () => {
		expect(html).toContain("Poznám kód, rozmer zadám neskôr");
		expect(html).not.toMatch(/type="checkbox"/);
		expect(html).toContain('data-testid="tyre-knows-code"');
	});

	it("puts only buttons of type button into the form it sits in, so none of them can add to the cart", () => {
		for (const [name, view] of ALL_VIEWS) {
			for (const tag of render(view).match(/<button\b[^>]*>/g) ?? [])
				expect(tag, `${name}: ${tag}`).toMatch(/type="button"/);
		}
	});

	it("is small: the row is one section with a title, a line and one control, no panel of its own", () => {
		expect(html.match(/<section\b/g)).toHaveLength(1);
		expect(html.match(/<p\b/g)?.length ?? 0).toBeLessThanOrEqual(3);
	});
});

describe("a size that fits", () => {
	const html = render(FITS);

	it("says so, with the size and whose list it is from, and lets the buy buttons through", () => {
		expect(html).toContain('data-fit="fits"');
		expect(html).toContain("145/70 R12 · Rozmer vyhovuje");
		expect(html).toContain("Podľa zoznamu výrobcu");
		expect(html).toContain("Zmeniť");
		expect(html).toContain('data-gate="complete"');
	});

	it("carries that very size in the form, and no answer", () => {
		expect(field(html, TYRE_FIELDS.mode)).toBe("size");
		expect(field(html, TYRE_FIELDS.size)).toBe("145/70 R12");
		expect(field(html, TYRE_FIELDS.answer)).toBe("");
	});

	it("does not ask what the shopper already told it", () => {
		expect(html).not.toContain("Poznám kód");
		expect(html).not.toContain('data-testid="tyre-question"');
	});
});

describe("a size that depends on the tyres", () => {
	it("asks its one question with a tap for each answer, and holds the buy buttons until it is answered", () => {
		const html = render(ASK_MAKE);
		expect(html).toContain('data-fit="ask"');
		expect(html).toContain("195/75 R16 · Upresnite pneumatiky");
		expect(html).toContain('data-testid="tyre-question"');
		expect(html).toContain("Akú značku pneumatík máte?");
		for (const make of ["Kleber", "Michelin", "Continental", "Iná značka"])
			expect(html).toContain(`>${make}</button>`);
		expect(html).toContain("Pre 195/75 R16 sa veľkosť reťaze líši podľa pneumatiky, preto sa pýtame.");
		expect(html).toContain('data-gate="incomplete:ask"');
		expect(html).toContain('data-button="buttonAsk"');
	});

	it("asks for the model when the list names models, with its own 'another model'", () => {
		const html = render(ASK_MODEL);
		expect(html).toContain("Aký model pneumatík máte?");
		expect(html).toContain(`>${DUV}</button>`);
		expect(html).toContain(">Iný model</button>");
	});

	it("does not send the size before it is answered: the form says nothing chosen", () => {
		const html = render(ASK_MAKE);
		expect(field(html, TYRE_FIELDS.size)).toBe("");
		expect(field(html, TYRE_FIELDS.answer)).toBe("");
	});

	it("is complete once answered, says which tyres were named, and sends the answer with the size", () => {
		const html = render(FITS_ANSWERED);
		expect(html).toContain("215/60 R16 · Rozmer vyhovuje");
		expect(html).toContain(`Vaše pneumatiky: ${DUV}`);
		expect(html).toContain('data-gate="complete"');
		expect(field(html, TYRE_FIELDS.size)).toBe("215/60 R16");
		expect(field(html, TYRE_FIELDS.answer)).toBe(DUV);
	});

	it("says what 'none of them' means in words the shopper can check", () => {
		const html = render(FITS_OTHER_MAKE);
		expect(html).toContain("Pneumatiky inej značky než Kleber / Michelin / Continental");
		expect(field(html, TYRE_FIELDS.answer)).toBe("other");
	});

	it("does not draw a question for a size that asks none", () => {
		for (const view of [NO_SIZE, FITS, OTHER_NOT_SOLD, NO_FIT_ELSEWHERE, UNLISTED]) {
			expect(render(view)).not.toContain('data-testid="tyre-question"');
		}
	});
});

describe("a size the model has in another code", () => {
	it("names the size that does fit, and says the shop does not sell it when it does not", () => {
		const html = render(OTHER_NOT_SOLD);
		expect(html).toContain('data-fit="other"');
		expect(html).toContain("Pre 215/60 R16 potrebujete veľkosť 22,5");
		expect(html).toContain("Túto veľkosť teraz nepredávame.");
		// What to do about it is the sentence the button carries out: look at what does fit.
		expect(html).toContain("Pozrite si reťaze, ktoré na tento rozmer sedia.");
		expect(html).not.toContain("Zobraziť veľkosť");
		// Nothing to go to, but the shop sells other chains for the size: the button takes the shopper to that list.
		expect(html).toContain('data-gate="incomplete:find"');
		expect(html).toContain('data-button="buttonFind"');
		expect(field(html, TYRE_FIELDS.size)).toBe("");
	});

	it("sends the shopper to the people when the shop sells nothing for the size, not to an empty list", () => {
		const html = render(OTHER_NOWHERE);
		expect(html).toContain("Túto veľkosť teraz nepredávame.");
		expect(html).toContain("Napíšte nám, poradíme.");
		expect(html).not.toContain("Pozrite si reťaze");
		expect(html).toContain('data-gate="incomplete:contact"');
		expect(html).toContain('data-button="buttonContact"');
		expect(field(html, TYRE_FIELDS.size)).toBe("");
	});

	it("links to the size that fits, only when the page can name where it is", () => {
		const html = render(OTHER_LINKED);
		expect(html).toContain('href="/sk/snehove-retaze/s16-22-5"');
		expect(html).toContain("Zobraziť veľkosť 22,5");
		expect(html).not.toContain("Túto veľkosť teraz nepredávame.");
		expect(html).toContain('data-gate="incomplete:other"');
		expect(html).toContain('data-button="buttonOther"');
	});

	it("calls another product a product, not a size, and says the same next step", () => {
		const html = render(OTHER_CODE_NOWHERE);
		expect(html).toContain("Pre 205/55 R16 potrebujete produkt N17142");
		expect(html).toContain("Tento produkt teraz nepredávame. Napíšte nám, poradíme.");
		expect(html).not.toContain("veľkosť");
		expect(html).toContain('data-button="buttonContact"');
	});

	it("says it is not sold when none of several sizes can be linked, and lists them when one can", () => {
		const unsold = render(OTHER_MANY);
		expect(unsold).toContain("22,5 · 23. Túto veľkosť teraz nepredávame.");
		const sold = render({
			...OTHER_MANY,
			alternatives: [
				{ code: "N16105", sizeLabel: "22,5", href: "/sk/snehove-retaze/s16-22-5" },
				{ code: "N16106", sizeLabel: "23", href: null },
			],
		} as TyreFitView);
		expect(sold).toContain("22,5 · 23");
		expect(sold).not.toContain("nepredávame");
	});

	it("lists the sizes when several fit", () => {
		const html = render(OTHER_MANY);
		expect(html).toContain("Pre 215/60 R16 sedia iné veľkosti tohto modelu");
		expect(html).toContain("22,5 · 23");
	});
});

describe("a size from the supplier's data, not the maker's list", () => {
	// Owner, 2026-11-07: a size the shop holds for the product is a green "fits", whichever list holds it. The list is
	// named in small words under the row; the old amber warning ("check the size yourself before ordering") over a
	// buy button told a shopper who had just entered their size to do the shop's work.
	it("is as green as the maker's list, names its source quietly, and does not tell the shopper to check it", () => {
		const html = render(SUPPLIER);
		expect(html).toContain('data-fit="fits"');
		expect(html).toContain("Rozmer vyhovuje");
		expect(html).toContain("Podľa údajov dodávateľa");
		expect(html).toContain("bg-fitment-fits-bg");
		expect(html).not.toContain("bg-fitment-unconfirmed-bg");
		expect(html).not.toContain("lucide-triangle-alert");
		expect(html).not.toContain("overte");
		expect(html).toContain('data-gate="complete"');
	});
});

describe("a size the product does not fit", () => {
	it("says it does not, sends the shopper to the chains that do, and sends no size", () => {
		const html = render(NO_FIT_ELSEWHERE);
		expect(html).toContain('data-fit="no-fit"');
		expect(html).toContain("Na 195/75 R16 tento produkt nesedí");
		expect(html).toContain("Pozrite si reťaze, ktoré na tento rozmer sedia.");
		expect(html).toContain("bg-fitment-no-fit-bg");
		expect(html).toContain('data-gate="incomplete:find"');
		expect(html).toContain('data-button="buttonFind"');
		expect(field(html, TYRE_FIELDS.size)).toBe("");
	});

	it("does not promise other chains when the shop has nothing for the size", () => {
		const html = render(NO_FIT_NOWHERE);
		expect(html).toContain("Na tento rozmer teraz nič nemáme v ponuke. Napíšte nám.");
		expect(html).not.toContain("Pozrite si reťaze");
		expect(html).toContain('data-gate="incomplete:contact"');
		expect(html).toContain('data-button="buttonContact"');
	});

	it("does not let 'I know the code' argue with the list", () => {
		expect(render(NO_FIT_ELSEWHERE)).not.toContain("Poznám kód");
		expect(render(NO_FIT_NOWHERE)).not.toContain("Poznám kód");
	});
});

describe("a size the shop cannot verify", () => {
	const html = render(UNLISTED);

	it("says that it needs to check, not that the product does not fit, and sends the shopper to the people who can", () => {
		expect(html).toContain('data-fit="unlisted"');
		expect(html).toContain("205/40 R21 · Vhodnosť potrebujeme overiť");
		expect(html).toContain("Tento rozmer nemáme v zozname reťazí.");
		expect(html).not.toContain("nesedí");
		expect(html).toContain('data-gate="incomplete:contact"');
		expect(html).toContain('data-button="buttonContact"');
	});

	it("keeps the way out for a shopper who knows the code", () => {
		expect(html).toContain("Poznám kód, rozmer zadám neskôr");
	});
});

describe("what the buy buttons say and where they go", () => {
	it("has a text in every language for every key a held-back button can carry", () => {
		for (const locale of LOCALES) {
			const t = messages(locale).tyreSize;
			for (const key of GATE_BUTTON_KEYS) expect(t[key], `${locale} ${key}`).toBeTruthy();
		}
	});

	it("says what the next step is, view by view", () => {
		const keyOf = (view: TyreFitView, knowsCode = false) => {
			const state = tyreFitState(view, { knowsCode });
			return state.reason;
		};
		expect(keyOf(NO_SIZE)).toBe("choose");
		expect(keyOf(UNLISTED)).toBe("contact");
		expect(keyOf(ASK_MAKE)).toBe("ask");
		expect(keyOf(OTHER_LINKED)).toBe("other");
		expect(keyOf(OTHER_NOT_SOLD)).toBe("find");
		expect(keyOf(OTHER_NOWHERE)).toBe("contact");
		expect(keyOf(NO_FIT_ELSEWHERE)).toBe("find");
		expect(keyOf(NO_FIT_NOWHERE)).toBe("contact");
		expect(keyOf(FITS)).toBeNull();
	});

	it("uses the safe word when asked for the text of a gate that has none", () => {
		expect(gateButtonKey({ buttonKey: null })).toBe("selectSize");
		expect(gateButtonKey({ buttonKey: "buttonAsk" })).toBe("buttonAsk");
	});
});

describe("how a buy button that holds back looks", () => {
	it("keeps the purchase colour for the steps toward buying: a size, an answer, the size that fits", () => {
		for (const reason of ["choose", "ask", "other"] as const) {
			const look = gateButtonLook({ reason });
			expect(look.variant, reason).toBe("default");
			expect(look.className, reason).toContain("whitespace-normal");
		}
	});

	it("turns a way out that does not buy into a quiet button, and leaves it pressable", () => {
		for (const reason of ["find", "contact"] as const) {
			const look = gateButtonLook({ reason });
			expect(look.variant, reason).toBe("secondary");
			expect(look.className, reason).toContain("shadow-none");
			expect(look.className, reason).toContain("whitespace-normal");
			// Never a `disabled` button: pressing it still takes the shopper on, and on a phone the sticky bar has no other way out.
			expect(look).not.toHaveProperty("disabled");
			expect(look).not.toHaveProperty("aria-disabled");
		}
	});

	it("leaves a button that is not held back alone, and lets a held-back label wrap instead of being cut off", () => {
		expect(gateButtonLook(null)).toEqual({ variant: "default", className: undefined });
		expect(HELD_BACK_LABEL).toContain("line-clamp-2");
	});
});

describe("the icon of a buy button", () => {
	const REASONS = ["choose", "ask", "other", "find", "contact"] as const;
	const draw = (gate: { reason: (typeof REASONS)[number] } | null) =>
		renderToStaticMarkup(createElement(GateIcon, { gate, className: "h-4 w-4" }));
	const CART = "lucide-shopping-cart";

	it("is a cart only while pressing the button buys", () => {
		expect(draw(null)).toContain(CART);
		for (const reason of REASONS) expect(draw({ reason }), reason).not.toContain(CART);
	});

	it("tells the held-back ways apart: tyres, the right size, the list, the people", () => {
		const icons = REASONS.map((reason) => draw({ reason }));
		// choosing a size and answering the question are both about the tyres, so they draw the same
		expect(icons[0]).toBe(icons[1]);
		expect(new Set(icons).size).toBe(4);
	});

	it("is hidden from a screen reader: the label beside it says it all", () => {
		for (const gate of [null, ...REASONS.map((reason) => ({ reason }))]) {
			expect(draw(gate)).toContain('aria-hidden="true"');
		}
	});
});

describe("what the verdict is about", () => {
	it("is a different thing for another size, another question or another answer, so nothing ticked carries over", () => {
		const keys = new Set([
			viewKey(NO_SIZE),
			viewKey(UNLISTED),
			viewKey(FITS),
			viewKey(ASK_MAKE),
			viewKey(ASK_MODEL),
			viewKey(FITS_ANSWERED),
			viewKey(FITS_OTHER_MAKE),
			viewKey(OTHER_NOT_SOLD),
			viewKey(NO_FIT_ELSEWHERE),
		]);
		expect(keys.size).toBe(9);
		expect(viewKey(FITS)).toBe(viewKey(tyreViewOf("N16061", "145/70 R12")!));
	});
});

describe("the fixed buy bar inside the gate", () => {
	const html = renderToStaticMarkup(
		createElement(
			Provider,
			{ locale: "sk-SK", timeZone: "UTC", messages: messages("sk-SK") },
			createElement(
				Gate,
				{ view: NO_SIZE, hrefs: HREFS },
				createElement(StickyBar, { productName: "Snehové reťaze", price: "99,00 €", show: true }),
				createElement(TyreKnowsCode),
			),
		),
	);

	it("says what the next step is, like the button beside the price", () => {
		expect(html).toContain("Vybrať rozmer");
	});

	it("takes none of the form's spacing: the `space-y-6` margin would lift a fixed bar 24px off the screen edge, so 24px of it showed while it was hidden", () => {
		const bar = html.match(/<div class="([^"]*\bfixed\b[^"]*)"/)?.[1] ?? "";
		expect(bar).toContain("bottom-0");
		expect(bar).toMatch(/(^|\s)mb-0!(\s|$)/);
	});
});

describe("in every language", () => {
	it.each(LOCALES)("%s: every state is words, never a raw key or an unfilled placeholder", (locale) => {
		for (const [name, view] of ALL_VIEWS) {
			const html = render(view, locale);
			expect(html, `${locale} ${name}`).not.toMatch(/tyreSize\.[A-Za-z]+/);
			expect(html, `${locale} ${name}`).not.toMatch(/\{(size|tyres|answer|label)\}/);
		}
	});
});
