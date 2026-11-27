import { describe, expect, it } from "vitest";
import { namedShelves, wordsNaming, type ShelfNames } from "./named-shelves";
import { categorySynonyms } from "./synonyms";

/** The shelves as the page gives them: the menu's label, the address, the customers' other words. */
function shelves(language: string, labels: Record<string, [label: string, segment: string]>): ShelfNames[] {
	return Object.entries(labels).map(([slug, [label, segment]]) => ({
		slug,
		names: [label, segment, ...categorySynonyms(language, slug)],
	}));
}

const sk = shelves("sk", {
	"stresne-nosice": ["Strešné nosiče", "stresne-nosice"],
	"stresne-boxy": ["Strešné boxy", "stresne-boxy"],
	"nosice-bicyklov": ["Nosiče bicyklov", "nosice-bicyklov"],
	"nosice-lyzi": ["Nosiče lyží", "nosice-lyzi"],
	"snehove-retaze": ["Snehové reťaze", "snehove-retaze"],
	autochladnicky: ["Autochladničky", "autochladnicky"],
	"stresne-stany": ["Strešné stany", "stresne-stany"],
});
const de = shelves("de", {
	"stresne-nosice": ["Dachträger", "dachtraeger"],
	"stresne-boxy": ["Dachboxen", "dachboxen"],
	"nosice-bicyklov": ["Fahrradträger", "fahrradtraeger"],
	"snehove-retaze": ["Schneeketten", "schneeketten"],
	autochladnicky: ["Autokühlboxen", "autokuehlboxen"],
});
const cs = shelves("cs", {
	"stresne-nosice": ["Střešní nosiče", "stresni-nosice"],
	"stresne-boxy": ["Střešní boxy", "stresni-boxy"],
	"nosice-bicyklov": ["Nosiče kol", "nosice-kol"],
});
const en = shelves("en", {
	"stresne-nosice": ["Roof racks", "roof-racks"],
	"nosice-bicyklov": ["Bike racks", "bike-racks"],
	autochladnicky: ["Car fridges", "car-fridges"],
});

describe("the shelves a search names", () => {
	// Each of these was wrong on the live shop on 2026-11-27, read by the generous matcher.
	it("a roof box is not a roof rack", () => {
		expect(namedShelves("strešný box", "sk", sk)).toEqual(["stresne-boxy"]);
		expect(namedShelves("stresny box thule", "sk", sk)).toEqual(["stresne-boxy"]);
		expect(namedShelves("střešní box", "cs", cs)).toEqual(["stresne-boxy"]);
	});

	it("a roof rack is not a bike carrier", () => {
		expect(namedShelves("strešný nosič", "sk", sk)).toEqual(["stresne-nosice"]);
		expect(namedShelves("střešní nosič", "cs", cs)).toEqual(["stresne-nosice"]);
		expect(namedShelves("strešný nosič octavia", "sk", sk)).toEqual(["stresne-nosice"]);
	});

	it("a carrier of no kind names no shelf, with a car or without", () => {
		expect(namedShelves("nosič", "sk", sk)).toEqual([]);
		expect(namedShelves("nosič Kuga", "sk", sk)).toEqual([]);
		expect(namedShelves("nosič octavia", "cs", cs)).toEqual([]);
		expect(namedShelves("box", "sk", sk)).toEqual([]);
	});

	it("a ski carrier is not a bike carrier", () => {
		expect(namedShelves("nosič lyží", "sk", sk)).toEqual(["nosice-lyzi"]);
	});

	it("reads the endings and the missing diacritics a customer types", () => {
		expect(namedShelves("nosic bicyklov octavia", "sk", sk)).toEqual(["nosice-bicyklov"]);
		expect(namedShelves("nosiče na bicykle", "sk", sk)).toEqual(["nosice-bicyklov"]);
		expect(namedShelves("snehove retaze 205/55 R16", "sk", sk)).toEqual(["snehove-retaze"]);
		expect(namedShelves("autochladnicka 30l", "sk", sk)).toEqual(["autochladnicky"]);
		expect(namedShelves("Dachtraeger Golf", "de", de)).toEqual(["stresne-nosice"]);
		expect(namedShelves("Fahrradträger für 3 Fahrräder", "de", de)).toEqual(["nosice-bicyklov"]);
	});

	it("knows a shelf by the other words customers use for it", () => {
		expect(namedShelves("Grundträger Skoda Octavia", "de", de)).toEqual(["stresne-nosice"]);
		expect(namedShelves("priečniky 120", "sk", sk)).toEqual(["stresne-nosice"]);
		expect(namedShelves("Kühlbox", "de", de)).toEqual(["autochladnicky"]);
	});

	it("reads two words typed apart as the compound they make", () => {
		expect(namedShelves("dach box", "de", de)).toEqual(["stresne-boxy"]);
		expect(namedShelves("schnee ketten", "de", de)).toEqual(["snehove-retaze"]);
	});

	it("names a shelf the market does not stock, so that nothing else is offered as close to it", () => {
		// The page gives every shelf of the shop, not only the market's own.
		expect(namedShelves("bike rack", "en", en)).toEqual(["nosice-bicyklov"]);
		expect(namedShelves("Dachbox", "de", de)).toEqual(["stresne-boxy"]);
	});

	it("is not named by a part of a compound or by a word that only looks alike", () => {
		expect(namedShelves("Träger", "de", de)).toEqual([]);
		expect(namedShelves("stan", "sk", sk)).toEqual([]);
		expect(namedShelves("strešný", "sk", sk)).toEqual([]);
		expect(namedShelves("thule", "sk", sk)).toEqual([]);
	});
});

describe("the words by which a search names a shelf", () => {
	const roofRacks = (list: readonly ShelfNames[]) => list.find((shelf) => shelf.slug === "stresne-nosice")!;

	it("are the name's own words, as they were folded", () => {
		expect(wordsNaming("Dachträger Thule Golf", "de", roofRacks(de))).toEqual(["dachtrager"]);
		expect(wordsNaming("strešný nosič thule", "sk", roofRacks(sk)).sort()).toEqual(["nosic", "stresny"]);
		expect(wordsNaming("thule priečniky octavia", "sk", roofRacks(sk))).toEqual(["priecniky"]);
	});

	it("are both halves of a compound typed apart", () => {
		expect(wordsNaming("dach träger golf", "de", roofRacks(de)).sort()).toEqual(["dach", "trager"]);
	});

	it("are none when the shelf is not named", () => {
		expect(wordsNaming("nosič kuga", "sk", roofRacks(sk))).toEqual([]);
		expect(wordsNaming("strešný box", "sk", roofRacks(sk))).toEqual([]);
	});
});
