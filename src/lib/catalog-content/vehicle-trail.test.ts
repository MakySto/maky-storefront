import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { type CatalogContentSnapshot } from "./contract";
import { buildCatalogTree, nodeLabel } from "./tree";
import {
	commonVehicleNode,
	vehiclePageAddress,
	vehiclePageLinkable,
	vehicleTrailSteps,
} from "./vehicle-trail";

/**
 * The trail from the roof-racks shelf to one car, shared by the car's own page and by the products made
 * for it. The names are the ones measured on the 2026-10-22 export for BMW 5 Touring: the page's
 * navigation name says "5-Rad Touring" where the export states "Rad 5 Touring" for Slovak.
 */

const dataset = {
	makes: [
		{ id: "mk-bmw", name: "BMW", displayNames: { sk: "BMW" }, urlPath: "/stresne-nosice/bmw" },
		{
			id: "mk-renault",
			name: "RENAULT",
			displayNames: { sk: "Renault" },
			urlPath: "/stresne-nosice/renault",
		},
	],
	models: [
		{
			id: "md-5t",
			makeId: "mk-bmw",
			name: "5 Series Touring",
			displayNames: { sk: "Rad 5 Touring", de: "5er Touring" },
			urlPath: "/stresne-nosice/bmw/5-rad-touring",
		},
		{ id: "md-x1", makeId: "mk-bmw", name: "X1", urlPath: "/stresne-nosice/bmw/x1" },
		{
			id: "md-laguna",
			makeId: "mk-renault",
			name: "Renault Laguna",
			urlPath: "/stresne-nosice/renault/laguna",
		},
	],
	generations: [
		gen("gn-g61", "md-5t", "G61", 2024, null, "/stresne-nosice/bmw/5-rad-touring/g61"),
		gen("gn-g31", "md-5t", "G31", 2017, 2023, "/stresne-nosice/bmw/5-rad-touring/g31"),
		gen("gn-jy", "md-x1", "JY (2013 – 2021)", 2013, 2021, "/stresne-nosice/bmw/x1/jy"),
		gen("gn-l3", "md-laguna", "III", 2007, 2015, "/stresne-nosice/renault/laguna/iii"),
	],
	applications: [],
} as unknown as FitmentDataset;

function gen(id: string, modelId: string, name: string, from: number, to: number | null, urlPath: string) {
	return { id, modelId, name, productionYearFrom: from, productionYearTo: to, qualifiers: {}, urlPath };
}

const page = (vehicleId: string, urlPath: string, navName: string, state = "published") => ({
	publicId: `pg:${vehicleId}`,
	vehicleId,
	kind: "vehicle_generation",
	urlPath,
	navName,
	state,
	indexable: true,
	hasEditorialText: true,
});

const snapshot = {
	artifact: "CATALOG_CONTENT_SNAPSHOT",
	schemaVersion: "1.0.0",
	generatedAt: "2026-11-27T00:00:00Z",
	language: "sk",
	pages: [
		page("mk-bmw", "/stresne-nosice/bmw", "BMW"),
		page("md-5t", "/stresne-nosice/bmw/5-rad-touring", "5-Rad Touring"),
		page("gn-g61", "/stresne-nosice/bmw/5-rad-touring/g61", "G61"),
		// Withheld: its step has to keep its place and lose its link.
		page("gn-g31", "/stresne-nosice/bmw/5-rad-touring/g31", "G31", "draft"),
	],
} as unknown as CatalogContentSnapshot;

const tree = buildCatalogTree(snapshot, dataset);
const years = (from: number, to: number | null) => (to === null ? `od ${from}` : `${from} – ${to}`);
const options = {
	hrefOf: (node: { urlPath: string }) => `/sk${node.urlPath}`,
	linkable: () => true,
	years,
};
const at = (id: string) => tree.byVehicleId.get(id)!;

describe("the name a step uses", () => {
	it("is the one the export states for the language, not the page's navigation name", () => {
		expect(at("md-5t").name).toBe("5-Rad Touring");
		expect(nodeLabel(at("md-5t"))).toBe("Rad 5 Touring");
	});

	it("leaves the maker out of a model that carries it, since the step before it says so", () => {
		expect(nodeLabel(at("md-laguna"))).toBe("Laguna");
	});

	it("is the export's name for a node with no page, and the raw name where it states none", () => {
		expect(nodeLabel(at("mk-renault"))).toBe("Renault");
		expect(nodeLabel(at("md-x1"))).toBe("X1");
	});
});

describe("the trail to a vehicle", () => {
	it("walks make, model and generation, the generation with its years", () => {
		expect(vehicleTrailSteps(tree, at("gn-g61"), { ...options, linkLast: false })).toEqual([
			{ label: "BMW", href: "/sk/stresne-nosice/bmw" },
			{ label: "Rad 5 Touring", href: "/sk/stresne-nosice/bmw/5-rad-touring" },
			{ label: "G61 (od 2024)" },
		]);
	});

	it("links the vehicle itself when a product stands below it", () => {
		const steps = vehicleTrailSteps(tree, at("gn-g61"), { ...options, linkLast: true });
		expect(steps.at(-1)).toEqual({
			label: "G61 (od 2024)",
			href: "/sk/stresne-nosice/bmw/5-rad-touring/g61",
		});
	});

	it("does not say the years twice when the export's name already carries them", () => {
		const steps = vehicleTrailSteps(tree, at("gn-jy"), { ...options, linkLast: false });
		expect(steps.at(-1)).toEqual({ label: "JY (2013 – 2021)" });
	});

	it("keeps a step whose page is withheld, as text", () => {
		const steps = vehicleTrailSteps(tree, at("gn-g31"), {
			...options,
			linkable: (node) => node.vehicleId !== "gn-g31",
			linkLast: true,
		});
		expect(steps.at(-1)).toEqual({ label: "G31 (2017 – 2023)" });
		expect(steps).toHaveLength(3);
	});
});

describe("which pages may be linked", () => {
	it("refuses a page that is not published, and accepts one that is", () => {
		expect(vehiclePageLinkable("sk-eur", at("gn-g31"))).toBe(false);
		expect(vehiclePageLinkable("sk-eur", at("gn-g61"))).toBe(true);
	});

	it("addresses the vehicle in the market's own prefix", () => {
		expect(vehiclePageAddress("sk-eur", at("gn-g61"))).toBe("/sk/stresne-nosice/bmw/5-rad-touring/g61");
	});
});

describe("a product made for several vehicles", () => {
	it("stands under the vehicle when it is made for one", () => {
		expect(commonVehicleNode(tree, ["gn-g61"])?.vehicleId).toBe("gn-g61");
	});

	it("stands under the model when its vehicles are generations of one model", () => {
		expect(commonVehicleNode(tree, ["gn-g61", "gn-g31"])?.vehicleId).toBe("md-5t");
	});

	it("stands under the make when its vehicles are models of one make", () => {
		expect(commonVehicleNode(tree, ["gn-g61", "gn-jy"])?.vehicleId).toBe("mk-bmw");
	});

	it("stands under no vehicle when they share no make, rather than under whichever came first", () => {
		expect(commonVehicleNode(tree, ["gn-g61", "gn-l3"])).toBeNull();
	});

	it("is not changed by the order of the export", () => {
		expect(commonVehicleNode(tree, ["gn-g31", "gn-g61"])?.vehicleId).toBe(
			commonVehicleNode(tree, ["gn-g61", "gn-g31"])?.vehicleId,
		);
	});

	it("ignores an id the tree does not hold, and says nothing when none is held", () => {
		expect(commonVehicleNode(tree, ["gn-g61", "gone"])?.vehicleId).toBe("gn-g61");
		expect(commonVehicleNode(tree, ["gone"])).toBeNull();
		expect(commonVehicleNode(tree, [])).toBeNull();
	});
});
