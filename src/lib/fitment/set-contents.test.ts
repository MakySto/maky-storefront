import { describe, expect, it } from "vitest";

import { AUDI_OFFER, n15060Dataset } from "./fixtures/n15060";
import { documentedSetContents } from "./set-contents";

// A test owns its clock: the fixture's own date plus a day, never the real one.
const at = (dataset: ReturnType<typeof n15060Dataset>, days = 1) =>
	Date.parse(dataset.generatedAt) + days * 86_400_000;

const withContents = (...documents: (string[] | undefined)[]) => {
	const dataset = n15060Dataset();
	const [application] = dataset.applications.filter((a) =>
		a.products.some((p) => p.saleorProductId === AUDI_OFFER.productId),
	);
	const ref = application!.products.find((p) => p.saleorProductId === AUDI_OFFER.productId)!;
	// One copy of the application per document: a product documented through several rows.
	const copies = documents.map((includes, index) => ({
		...application!,
		applicationId: `${application!.applicationId}-${index}`,
		products: [{ ...ref, completeSet: includes ? { includes } : undefined }],
	}));
	dataset.applications = [...dataset.applications.filter((a) => a !== application), ...copies];
	return dataset;
};

describe("documentedSetContents", () => {
	it("gives what the export documents the set to contain", () => {
		const dataset = withContents(["bars", "feet", "fitting-kit"]);
		expect(documentedSetContents(dataset, AUDI_OFFER.productId, AUDI_OFFER.variantId, at(dataset))).toEqual([
			"bars",
			"feet",
			"fitting-kit",
		]);
	});

	it("takes one statement made twice as one", () => {
		const dataset = withContents(["bars", "fitting-kit"], ["fitting-kit", "bars"]);
		expect(documentedSetContents(dataset, AUDI_OFFER.productId, undefined, at(dataset))).toEqual([
			"bars",
			"fitting-kit",
		]);
	});

	it("says nothing where the documents disagree — it never picks one of two statements", () => {
		const dataset = withContents(["bars", "fitting-kit"], ["bars"]);
		expect(documentedSetContents(dataset, AUDI_OFFER.productId, undefined, at(dataset))).toBeNull();
	});

	it("says nothing where the export does not say, and does not call that an empty box", () => {
		const none = withContents(undefined);
		const empty = withContents([]);
		expect(documentedSetContents(none, AUDI_OFFER.productId, undefined, at(none))).toBeNull();
		expect(documentedSetContents(empty, AUDI_OFFER.productId, undefined, at(empty))).toBeNull();
	});

	it("ignores a row the source will not stand behind, and a variant that is not the page's", () => {
		const held = withContents(["bars", "fitting-kit"]);
		for (const application of held.applications) {
			for (const ref of application.products) ref.qaStatus = "hold";
		}
		expect(documentedSetContents(held, AUDI_OFFER.productId, undefined, at(held))).toBeNull();

		const dataset = withContents(["bars", "fitting-kit"]);
		expect(
			documentedSetContents(dataset, AUDI_OFFER.productId, "UHJvZHVjdFZhcmlhbnQ6OTk5", at(dataset)),
		).toBeNull();
	});

	it("says nothing from a dataset past its date, or from none", () => {
		const dataset = withContents(["bars", "fitting-kit"]);
		expect(documentedSetContents(dataset, AUDI_OFFER.productId, undefined, at(dataset, 31))).toBeNull();
		expect(documentedSetContents(null, AUDI_OFFER.productId)).toBeNull();
	});
});
