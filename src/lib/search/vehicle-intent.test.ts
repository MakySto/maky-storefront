import { describe, expect, it } from "vitest";
import { type VehicleNames, productWordsOf, readVehicleIntent } from "./vehicle-intent";

/** A few cars of the live dataset (3.0.0-full-20261022.2), by the names it gives them. */
const names: VehicleNames = {
	makes: [
		{ id: "mk:skoda", name: "Škoda" },
		{ id: "mk:ford", name: "Ford" },
		{ id: "mk:vw", name: "Volkswagen" },
		{ id: "mk:bmw", name: "BMW" },
		{ id: "mk:audi", name: "Audi" },
		{ id: "mk:chevrolet", name: "Chevrolet" },
		{ id: "mk:mini", name: "MINI" },
		{ id: "mk:mazda", name: "Mazda" },
		{ id: "mk:landrover", name: "Land Rover" },
		{ id: "mk:mercedes", name: "Mercedes-Benz" },
	],
	models: [
		{ id: "md:octavia", makeId: "mk:skoda", name: "Octavia" },
		{ id: "md:octavia-combi", makeId: "mk:skoda", name: "Octavia Combi" },
		{ id: "md:kamiq", makeId: "mk:skoda", name: "Kamiq" },
		{ id: "md:kuga", makeId: "mk:ford", name: "Kuga" },
		{ id: "md:golf", makeId: "mk:vw", name: "Golf" },
		{ id: "md:x5", makeId: "mk:bmw", name: "X5" },
		{ id: "md:3", makeId: "mk:bmw", name: "Rad 3", altNames: ["3 Series"] },
		{ id: "md:a3", makeId: "mk:audi", name: "A3" },
		{ id: "md:a3-sportback", makeId: "mk:audi", name: "A3 Sportback" },
		{ id: "md:spark", makeId: "mk:chevrolet", name: "Spark" },
		{ id: "md:countryman", makeId: "mk:mini", name: "Countryman" },
		{ id: "md:cx5", makeId: "mk:mazda", name: "CX-5" },
		{ id: "md:discovery", makeId: "mk:landrover", name: "Discovery" },
		{ id: "md:discovery-sport", makeId: "mk:landrover", name: "Discovery Sport" },
		{ id: "md:e", makeId: "mk:mercedes", name: "Trieda E", altNames: ["E-Class"] },
	],
	generations: [
		{ id: "gn:octavia-5e", modelId: "md:octavia", name: "5E", yearFrom: 2013, yearTo: 2020 },
		{ id: "gn:octavia-nx", modelId: "md:octavia", name: "NX", yearFrom: 2019, yearTo: null },
		{ id: "gn:combi-5e", modelId: "md:octavia-combi", name: "5E", yearFrom: 2013, yearTo: 2020 },
		{ id: "gn:combi-nx", modelId: "md:octavia-combi", name: "NX", yearFrom: 2019, yearTo: null },
		{ id: "gn:kamiq-nw", modelId: "md:kamiq", name: "NW", yearFrom: 2019, yearTo: null },
		{ id: "gn:kamiq-nw4", modelId: "md:kamiq", name: "NW4", yearFrom: 2019, yearTo: null },
		{ id: "gn:golf-7", modelId: "md:golf", name: "VII", yearFrom: 2012, yearTo: 2020 },
		{ id: "gn:golf-8", modelId: "md:golf", name: "VIII", yearFrom: 2019, yearTo: null },
		{ id: "gn:x5-f15", modelId: "md:x5", name: "F15", yearFrom: 2013, yearTo: 2018 },
		{ id: "gn:x5-g05", modelId: "md:x5", name: "G05", yearFrom: 2018, yearTo: null },
	],
};

/** The shop's own product words, as a shelf with a "Spark" roof box and a "Discovery" bike carrier gives them. */
const productWords = new Set(["spark", "discovery", "mini", "kompresor", "strike", "force"]);

const read = (query: string, language = "sk") =>
	readVehicleIntent(query, names, language, { productWords, currentYear: 2026 });
const models = (query: string, language?: string) =>
	read(query, language).models.map((model) => model.modelId);

describe("a car named in a search", () => {
	it("is read from a model alone when its name is distinctive", () => {
		expect(models("nosič Kuga")).toEqual(["md:kuga"]);
		expect(models("kuga")).toEqual(["md:kuga"]);
		expect([...read("nosič Kuga").words]).toEqual(["kuga"]);
	});

	it("takes the plain model before its sister, and offers the sister beside it", () => {
		const octavia = read("škoda octavia");
		expect(octavia.models.map((model) => model.modelId)).toEqual(["md:octavia"]);
		expect(octavia.models[0]!.makeNamed).toBe(true);
		expect(octavia.relatedModelIds).toEqual(["md:octavia-combi"]);
		expect(models("land rover discovery")).toEqual(["md:discovery"]);
	});

	it("takes the most specific model the words say", () => {
		expect(models("octavia combi")).toEqual(["md:octavia-combi"]);
		expect(models("discovery sport land rover")).toEqual(["md:discovery-sport"]);
	});

	it("narrows to a generation by its code or by a year of production", () => {
		expect(read("kamiq nw4").models[0]!.generationIds).toEqual(["gn:kamiq-nw4"]);
		expect(read("bmw x5 2015").models[0]!.generationIds).toEqual(["gn:x5-f15"]);
		// Two generations were built in 2019: both are offered, the customer knows which one is theirs.
		expect(read("octavia combi 2019").models[0]!.generationIds).toEqual(["gn:combi-5e", "gn:combi-nx"]);
		expect(read("Dachträger VW Golf 7", "de").models[0]!.generationIds).toEqual(["gn:golf-7"]);
		expect(read("octavia").models[0]!.generationIds).toEqual([]);
	});

	it("needs the make beside a model that is a number, two characters or a product of the shop", () => {
		expect(models("a3")).toEqual([]);
		expect(models("audi a3")).toEqual(["md:a3"]);
		expect(models("spark")).toEqual([]);
		expect(models("chevrolet spark")).toEqual(["md:spark"]);
		expect(models("bmw 3")).toEqual(["md:3"]);
		expect(models("mercedes e")).toEqual(["md:e"]);
	});

	it("knows what people call a make, and a model written apart or together", () => {
		expect(models("vw golf")).toEqual(["md:golf"]);
		expect(models("cx 5")).toEqual(["md:cx5"]);
		expect(models("mazda cx5")).toEqual(["md:cx5"]);
		expect(models("cx-5")).toEqual(["md:cx5"]);
	});

	it("reads a declined name", () => {
		expect(models("nosič na octaviu")).toEqual(["md:octavia"]);
		expect(models("do golfa")).toEqual(["md:golf"]);
	});

	it("does not take a product's word for a make", () => {
		expect(read("mini kompresor")).toMatchObject({ models: [], makeIds: [] });
		expect(models("mini countryman")).toEqual(["md:countryman"]);
		expect(read("strešný box thule")).toMatchObject({ models: [], makeIds: [] });
	});

	it("reads a make alone as a make", () => {
		expect(read("škoda")).toMatchObject({ models: [], makeIds: ["mk:skoda"] });
		expect(read("nosic ford")).toMatchObject({ models: [], makeIds: ["mk:ford"] });
	});
});

describe("the shop's own product words", () => {
	it("are the words of its products, except the products that name a car", () => {
		const words = productWordsOf(
			[
				{ name: "Strešný box G3 Spark 420 Black", brand: "G3" },
				{ name: "Nosič bicyklov Green Valley Discovery 3", brand: "Green Valley" },
				{ name: "Montážny kit Nordrive C041 pre Škoda Octavia 1Z - (N21041)" },
				{ name: "Mini kompresor 12 V" },
			],
			names,
			"sk",
		);
		expect(words.has("spark")).toBe(true);
		expect(words.has("discovery")).toBe(true);
		expect(words.has("mini")).toBe(true);
		// A kit is found by its car; it must not stop "octavia" from being read as one.
		expect(words.has("octavia")).toBe(false);
		expect(words.has("nordrive")).toBe(false);
	});
});
