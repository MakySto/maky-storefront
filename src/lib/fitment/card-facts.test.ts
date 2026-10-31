import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../../i18n/messages");
vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: JSON.parse(readFileSync(join(MESSAGES, `${options.locale}.json`), "utf8")) as never,
			namespace: options.namespace as never,
		}),
}));

const loadFitmentDataset = vi.hoisted(() => vi.fn());
vi.mock("./provider", () => ({ loadFitmentDataset }));

import type { ProductCardData } from "@/ui/components/plp/product-card";
import { attachSetFacts } from "./card-facts";
import { AUDI_OFFER, n15060Dataset } from "./fixtures/n15060";

const NAME = "Strešný nosič Nordrive Helio Black Audi A4 Avant B8 (2008–2015) — Integrované lyžiny";

const card = (over: Partial<ProductCardData> = {}): ProductCardData => ({
	id: AUDI_OFFER.productId,
	name: NAME,
	slug: "helio-black-audi-a4",
	href: "/sk/helio-black-audi-a4",
	channel: "sk-eur",
	isPurchasable: true,
	brand: "Nordrive",
	price: 99,
	currency: "EUR",
	image: "",
	...over,
});

/** A test owns its clock: the fixture's own date plus a day. */
const dayAfter = (dataset: ReturnType<typeof n15060Dataset>) => Date.parse(dataset.generatedAt) + 86_400_000;

async function attach(
	dataset: ReturnType<typeof n15060Dataset> | null,
	locale = "sk-SK",
	cards: ProductCardData[] = [card()],
	now?: number,
) {
	loadFitmentDataset.mockResolvedValue({ dataset });
	return (await attachSetFacts(cards, locale, now ?? (dataset ? dayAfter(dataset) : 0)))[0]!;
}

const rows = (dataset: ReturnType<typeof n15060Dataset>) =>
	dataset.applications.flatMap((a) => a.products).filter((p) => p.saleorProductId === AUDI_OFFER.productId);

describe("attachSetFacts with a size in the name", () => {
	const KARGO_NAME =
		"Strešný kôš Nordrive Kargo Rack pre Audi A4 Avant B8 (od 2008), 420 × 180 × 12 cm, NKR4444+N30394";

	it("keeps the size the name states, as the first row, where the tail is taken apart", async () => {
		const result = await attach(n15060Dataset(), "sk-SK", [card({ name: KARGO_NAME })]);
		expect(result.setTitle?.model).toBe("Nordrive Kargo Rack");
		expect(result.specs?.[0]).toEqual({ key: "dimensions", label: "Rozmery", value: "420 × 180 × 12 cm" });
		// The set's own facts stay behind it, four rows at most.
		expect(result.specs?.map((s) => s.label)).toContain("Materiál");
		expect(result.specs?.length).toBeLessThanOrEqual(4);
	});

	it("does not add a size to a card that has one from its attributes", async () => {
		const own = { key: "dimensions", label: "", value: "190 × 80 × 40 cm" };
		const dataset = n15060Dataset();
		for (const ref of rows(dataset)) delete ref.facets;
		const result = await attach(dataset, "sk-SK", [card({ name: KARGO_NAME, specs: [own] })]);
		expect(result.specs?.filter((s) => s.key === "dimensions")).toEqual([own]);
	});

	it("says no size for a product the dataset has no row for", async () => {
		const result = await attach(n15060Dataset(), "sk-SK", [
			card({ id: "UHJvZHVjdDo5OTk5", name: KARGO_NAME }),
		]);
		expect(result.specs).toBeUndefined();
	});

	it("says no size where the name states none", async () => {
		const result = await attach(n15060Dataset());
		expect(result.specs?.some((s) => s.key === "dimensions")).toBe(false);
	});
});

describe("attachSetFacts with a van's version", () => {
	const L4 = { code: "van-version", text: { "sk-SK": "Určené len pre verziu: dĺžka L4, vysoká strecha." } };
	const L3 = { code: "van-version", text: { "sk-SK": "Určené len pre verziu: dĺžka L3, vysoká strecha." } };
	const own = (dataset: ReturnType<typeof n15060Dataset>) =>
		dataset.applications.filter((a) => a.products.some((p) => p.saleorProductId === AUDI_OFFER.productId));

	it("says the version the set is made for, in the source's words, when every application agrees", async () => {
		const dataset = n15060Dataset();
		for (const application of own(dataset)) application.conditions = [L4];
		expect((await attach(dataset)).versionNote).toBe("Určené len pre verziu: dĺžka L4, vysoká strecha.");
	});

	it("says nothing for a set made for several versions, and nothing where one application names none", async () => {
		const dataset = n15060Dataset();
		const [first, ...rest] = own(dataset);
		const copy = structuredClone(first!);
		copy.applicationId = "app:other-version";
		first!.conditions = [L4];
		copy.conditions = [L3];
		dataset.applications.push(copy);
		expect((await attach(dataset)).versionNote).toBeUndefined();

		copy.conditions = [];
		expect((await attach(dataset)).versionNote).toBeUndefined();
		void rest;
	});

	it("does not put it in another language's words", async () => {
		const dataset = n15060Dataset();
		for (const application of own(dataset)) application.conditions = [L4];
		expect((await attach(dataset, "en-US")).versionNote).toBeUndefined();
	});

	it("says nothing about a set with no version condition", async () => {
		expect((await attach(n15060Dataset())).versionNote).toBeUndefined();
	});
});

describe("attachSetFacts", () => {
	it("puts the set's own facts on its card", async () => {
		const result = await attach(n15060Dataset());
		expect(result.specs?.map((s) => s.label)).toContain("Materiál");
		expect(result.fit).toEqual({ roof: "Integrované pozdĺžniky", years: "2008 – 2015" });
	});

	it("names the car the way the dataset does, in the market's language, once", async () => {
		const result = await attach(n15060Dataset());
		expect(result.setTitle).toEqual({ model: "Nordrive Helio Black", vehicle: "AUDI A4 Avant B8" });
	});

	it("reads the same rows the product page reads: a held row never speaks for the set", async () => {
		const dataset = n15060Dataset();
		for (const ref of rows(dataset)) {
			ref.qaStatus = "hold";
			ref.eligibility = { sellable: false, reasons: ["held"] };
		}
		const result = await attach(dataset);
		expect(result.specs).toBeUndefined();
		expect(result.includes).toBeUndefined();
	});

	it("says nothing about the contents where the rows document different boxes", async () => {
		const dataset = n15060Dataset();
		const [first] = dataset.applications.filter((a) =>
			a.products.some((p) => p.saleorProductId === AUDI_OFFER.productId),
		);
		const copy = structuredClone(first!);
		copy.applicationId = "app:copy";
		first!.products[0]!.completeSet = { includes: ["bars", "fitting-kit"] };
		copy.products[0]!.completeSet = { includes: ["bars"] };
		dataset.applications.push(copy);
		expect((await attach(dataset)).includes).toBeUndefined();
	});

	it("adds nothing from a dataset past its date, as the product page says nothing from one", async () => {
		const dataset = n15060Dataset();
		const result = await attach(
			dataset,
			"sk-SK",
			[card()],
			Date.parse(dataset.generatedAt) + 31 * 86_400_000,
		);
		expect(result).toEqual(card());
	});

	it("adds nothing when there is no dataset, and leaves a product it has no row for alone", async () => {
		expect(await attach(null)).toEqual(card());
		const unknown = card({ id: "UHJvZHVjdDo5OTk=" });
		expect(await attach(n15060Dataset(), "sk-SK", [unknown])).toEqual(unknown);
	});
});
