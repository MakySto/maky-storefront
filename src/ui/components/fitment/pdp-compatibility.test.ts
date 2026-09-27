import { readFileSync } from "node:fs";
import path from "node:path";
import {
	cloneElement,
	createElement,
	Fragment,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type VehicleSelection } from "@/lib/fitment/contract";
import {
	A4_AVANT_B8,
	AUDI_2012,
	AUDI_OFFER,
	NAMES,
	PASSAT_2025,
	PASSAT_OFFER,
	n15060Dataset,
} from "@/lib/fitment/fixtures/n15060";

/**
 * The product page's compatibility box, rendered, on the two real N15060 offers.
 *
 * The owner's screenshot (2026-09-27): the Audi A4 Avant B8 set, a 2025 Passat Variant B9 saved,
 * and a large amber "Kompatibilitu zatiaľ nevieme potvrdiť — Neznamená to, že produkt nepasuje".
 * It now says what the set is for and links to the offers for the Passat; the green answer on the
 * Passat's own set, and every question and warning, stay as they were.
 */

const load = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

const { loadFitmentDataset, readGarage, vehiclePageHref, cookieJar } = vi.hoisted(() => ({
	loadFitmentDataset: vi.fn(),
	readGarage: vi.fn(),
	vehiclePageHref: vi.fn(),
	cookieJar: { hasGarage: true },
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/headers", () => ({
	cookies: async () => ({ has: (name: string) => name === "maky-garage" && cookieJar.hasGarage }),
}));
vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));
vi.mock("next/link", () => ({
	default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) =>
		createElement("a", { href, className }, children),
}));
vi.mock("@/ui/atoms/link-with-channel", () => ({
	LinkWithChannel: ({ href, children }: { href: string; children: ReactNode }) =>
		createElement("a", { href: `/sk${href}` }, children),
}));
vi.mock("@/ui/components/vehicle/vehicle-selector-launcher", () => ({
	VehicleSelectorLauncher: ({ label, variant }: { label?: string; variant: string }) =>
		createElement("button", { type: "button", "data-launcher": variant }, label ?? "launcher"),
}));
vi.mock("@/lib/fitment/provider", () => ({ loadFitmentDataset }));
vi.mock("@/lib/garage/state", () => ({ readGarage }));
vi.mock("@/lib/catalog-content/vehicle-href", () => ({ vehiclePageHref }));

import { __forgetProgramme } from "./programme-memory";
import { PdpCompatibility } from "./pdp-compatibility";

function garageWith(selection: VehicleSelection | null) {
	const vehicle = selection && {
		stored: { k: selection.makeId, m: selection.modelId, g: selection.generationId, y: selection.year },
		selection,
		...NAMES[selection.generationId as keyof typeof NAMES],
		unresolved: false,
	};
	return {
		status: vehicle ? "ok" : "absent",
		vehicles: vehicle ? [vehicle] : [],
		activeIndex: 0,
		active: vehicle ?? null,
		repaired: false,
		signed: true,
	};
}

/** Await every async server component in the tree, so react-dom can render the rest. */
async function resolveTree(node: ReactNode): Promise<ReactNode> {
	if (Array.isArray(node)) return Promise.all((node as ReactNode[]).map((child) => resolveTree(child)));
	if (!isValidElement(node)) return node;
	const element = node as ReactElement<Record<string, unknown>>;
	if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
		return resolveTree(await (element.type as (p: unknown) => Promise<ReactNode>)(element.props));
	}
	const { children, ...props } = element.props;
	if (props.action !== undefined) props.action = await resolveTree(props.action as ReactNode);
	if (children === undefined) return cloneElement(element, props);
	const resolved = await resolveTree(children as ReactNode);
	// As varargs, like JSX children: a static list needs no keys.
	return Array.isArray(resolved)
		? cloneElement(element, props, ...(resolved as ReactNode[]))
		: cloneElement(element, props, resolved);
}

async function render(channel: string, offer: { productId: string; variantId: string }) {
	const tree = await PdpCompatibility({
		channel,
		saleorProductId: offer.productId,
		saleorVariantId: offer.variantId,
	});
	const markup = renderToStaticMarkup(createElement(Fragment, null, await resolveTree(tree)));
	return {
		markup,
		text: markup
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim(),
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	cookieJar.hasGarage = true;
	__forgetProgramme();
	loadFitmentDataset.mockResolvedValue({ dataset: n15060Dataset() });
	vehiclePageHref.mockImplementation(async (channel: string, vehicleId: string) =>
		vehicleId === A4_AVANT_B8
			? channel === "de-eur"
				? "/de/dachtraeger/audi/a4-avant/b8"
				: "/sk/stresne-nosice/audi/a4-avant/b8"
			: null,
	);
});

describe("PDP compatibility on the N15060 offers", () => {
	it("Audi set, Passat saved: what the set is for, and the way to the Passat's offers — in Slovak", async () => {
		readGarage.mockResolvedValue(garageWith(PASSAT_2025));
		const { markup, text } = await render("sk-eur", AUDI_OFFER);

		expect(text).toContain("Určené pre: AUDI A4 Avant B8");
		expect(text).toContain("05/2008 – 10/2015 · Kombi · Integrované pozdĺžniky");
		expect(text).toContain("Pozrieť nosiče pre Passat Variant B9");
		expect(markup).toContain('href="/sk/stresne-nosice/audi/a4-avant/b8"');
		expect(markup).toContain('href="/sk/konfigurator"');
		// The old box, and any claim either way, are gone.
		expect(text).not.toMatch(/nevieme potvrdiť|Neznamená to|Nepasuje|Kompatibilné/);
		// Nothing here can submit the add-to-cart form.
		expect(markup).not.toMatch(/<button(?![^>]*type="button")/);
	});

	it("says the same in German on the German market", async () => {
		readGarage.mockResolvedValue(garageWith(PASSAT_2025));
		const { markup, text } = await render("de-eur", AUDI_OFFER);

		expect(text).toContain("Bestimmt für: AUDI A4 Avant B8");
		expect(text).toContain("05/2008 – 10/2015 · Kombi");
		expect(text).toContain("Dachträger für Passat Variant B9 ansehen");
		expect(markup).toContain('href="/de/dachtraeger/audi/a4-avant/b8"');
		expect(text).not.toMatch(/Určené|Pozrieť|nosiče/);
	});

	it("the Passat's own set keeps its green answer, once", async () => {
		readGarage.mockResolvedValue(garageWith(PASSAT_2025));
		const { markup, text } = await render("sk-eur", PASSAT_OFFER);

		expect(text).toContain("Kompatibilné podľa údajov výrobcu");
		expect(text).toContain("VOLKSWAGEN Passat Variant B9 · 2025");
		expect(markup).not.toContain("fitment-intended-for");
	});

	it("with the Audi saved, the Audi set is green and the Passat set says what it is for", async () => {
		readGarage.mockResolvedValue(garageWith(AUDI_2012));
		expect((await render("sk-eur", AUDI_OFFER)).text).toContain("Kompatibilné podľa údajov výrobcu");

		const passat = await render("sk-eur", PASSAT_OFFER);
		expect(passat.text).toContain("Určené pre: VOLKSWAGEN Passat Variant B9");
		expect(passat.text).toContain("od 2024 · Kombi · Integrované pozdĺžniky");
		expect(passat.text).toContain("Pozrieť nosiče pre A4 Avant B8");
		// No vehicle page for the Passat in this fixture: the name stands, unlinked.
		expect(passat.markup).not.toContain('href="/sk/stresne-nosice/volkswagen');
	});

	it("no car saved: what the set is for, then 'Overiť kompatibilitu' — no alternative for nobody's car", async () => {
		readGarage.mockResolvedValue(garageWith(null));
		const { markup, text } = await render("sk-eur", AUDI_OFFER);

		expect(text).toContain("Určené pre: AUDI A4 Avant B8");
		expect(markup).toContain('data-launcher="inline"');
		expect(text).toContain("Overiť kompatibilitu");
		expect(markup).not.toContain("/konfigurator");
	});

	it("an unanswered roof still asks for it", async () => {
		readGarage.mockResolvedValue(garageWith({ ...AUDI_2012, roofType: undefined }));
		const { text } = await render("sk-eur", AUDI_OFFER);
		expect(text).toContain("Doplňte údaje o vozidle");
		expect(text).not.toContain("Určené pre");
	});

	it("a boundary year still asks for the month", async () => {
		readGarage.mockResolvedValue(garageWith({ ...AUDI_2012, year: 2008 }));
		const { text } = await render("sk-eur", AUDI_OFFER);
		expect(text).toContain("Potrebujeme ešte jeden údaj");
	});

	it("a vehicle page that does not answer in time leaves the name unlinked, never missing", async () => {
		readGarage.mockResolvedValue(garageWith(PASSAT_2025));
		vehiclePageHref.mockReturnValue(new Promise(() => {}));
		const { markup, text } = await render("sk-eur", AUDI_OFFER);
		expect(text).toContain("Určené pre: AUDI A4 Avant B8");
		expect(markup).not.toContain("stresne-nosice");
	});

	it("expired data with no car saved says 'Vyberte vozidlo', as before — never 'Určené pre'", async () => {
		const DAY = 24 * 60 * 60 * 1000;
		readGarage.mockResolvedValue(garageWith(null));
		for (const dataset of [
			n15060Dataset({
				validity: { validUntil: new Date(Date.now() - DAY).toISOString(), staleAfterDays: 30 },
			}),
			n15060Dataset({ generatedAt: new Date(Date.now() - 31 * DAY).toISOString() }),
		]) {
			loadFitmentDataset.mockResolvedValue({ dataset });
			const { text } = await render("sk-eur", AUDI_OFFER);
			expect(text).toContain("Vyberte vozidlo");
			expect(text).not.toContain("Určené pre");
		}
	});

	it("simulated data keeps its box and its test-data notice — never a bare 'Určené pre'", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: n15060Dataset({ source: { system: "fixture" } }) });
		for (const car of [PASSAT_2025, null]) {
			readGarage.mockResolvedValue(garageWith(car));
			const { text } = await render("sk-eur", AUDI_OFFER);
			expect(text).toContain("Testovacia ukážka");
			expect(text).not.toContain("Určené pre");
		}
	});

	it("an outage after a good load says it cannot check now — never 'made for' from stale memory", async () => {
		readGarage.mockResolvedValue(garageWith(PASSAT_2025));
		await render("sk-eur", AUDI_OFFER);
		loadFitmentDataset.mockResolvedValue({ dataset: null });
		const { text } = await render("sk-eur", AUDI_OFFER);
		expect(text).toContain("Kompatibilitu teraz nevieme overiť");
		expect(text).not.toContain("Určené pre");
	});
});
