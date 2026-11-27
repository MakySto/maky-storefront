import { describe, expect, it } from "vitest";
import { sampleShelf } from "./__fixtures__/shelf-sample";
import { buildShelfIndex, nameCarries, searchShelf, sortShelfHits } from "./shelf-index";

/**
 * Ranked on a sample of the live shelf (`__fixtures__/shelf-sample.ts`). Each case is a search
 * that answered wrongly on the live shop on 2026-11-27, or one of the prototype's own mistakes
 * found on the live products the same day.
 */
const sk = buildShelfIndex(sampleShelf("sk"), "sk");
const de = buildShelfIndex(sampleShelf("de"), "de");
const cs = buildShelfIndex(sampleShelf("cs"), "cs");

const names = (index: typeof sk, query: string, options?: Parameters<typeof searchShelf>[2]) =>
	searchShelf(index, query, options).hits.map((hit) => hit.doc.name);

describe("the Slovak shelf", () => {
	it("answers 'strešný box' with roof boxes, then what belongs to one, and nothing else", () => {
		const found = names(sk, "strešný box", { preferRoots: new Set(["stresne-boxy"]) });
		expect(found.slice(0, 6).every((name) => name.startsWith("Strešný box"))).toBe(true);
		expect(found.slice(6)).toEqual(
			expect.arrayContaining(["U- Profil Menabo 80 mm pre strešný box MANIA/MARATHON"]),
		);
		// It was 22 642 results with the rubber profile first; and no kit or bar, which carry
		// "strešných" and not "box", comes in through the two words written as one.
		expect(found.some((name) => name.startsWith("Montážny kit"))).toBe(false);
		expect(found.some((name) => name.startsWith("Priečnik"))).toBe(false);
	});

	it("narrows by a maker, a model and a number", () => {
		expect(names(sk, "stresny box thule").slice(0, 2)).toEqual([
			"Strešný box Thule Force 3 XXL Sport",
			"Strešný box Thule Motion 3 - XL low - Black Glossy",
		]);
		expect(names(sk, "menabo mania 400")).toEqual(["Strešný box Menabo Mania 400 Black, 400 l, čierny"]);
		expect(names(sk, "box 440")).toEqual(["Strešný box Junior Strike 440 Black, 440 l, čierny lesklý"]);
		expect(names(sk, "autochladnička 19 l")).toEqual(["Kompresorová autochladnička PRO-USER CoolZ 19 l"]);
	});

	it("puts the carriers before their accessories and spare parts", () => {
		const found = names(sk, "nosič bicyklov", { preferRoots: new Set(["nosice-bicyklov"]) });
		const firstAccessory = found.findIndex((name) =>
			/adaptér|Súprava kolies|rampa|náhradný diel/i.test(name),
		);
		const lastCarrier = found.map((name) => name.startsWith("Nosič bicyk")).lastIndexOf(true);
		expect(lastCarrier).toBeGreaterThanOrEqual(5);
		expect(firstAccessory).toBeGreaterThan(lastCarrier);
	});

	it("lists a product named by the words asked before one that only holds them", () => {
		// Live, 2026-11-27: "nosič lyží" was led by an add-on for a bike carrier, by the alphabet.
		const found = names(sk, "nosič lyží", { preferRoots: new Set(["nosice-lyzi"]) });
		const addOn = found.indexOf("GP nosič lyží pre nosiče bicyklov Peruzzo");
		const magnetic = found.indexOf("Magnetický nosič lyží Menabo Himalaya na 2 páry lyží");
		const named = found.map((name) => name.startsWith("Nosič lyží")).lastIndexOf(true);
		expect(named).toBe(2);
		expect(addOn).toBeGreaterThan(named);
		expect(magnetic).toBeGreaterThan(named);
		// One word is read the same way, and in its other endings.
		expect(names(sk, "nosič")[0]).toMatch(/^Nosič /);
		expect(names(sk, "nosiče lyží")[0]).toMatch(/^Nosič lyží/);
	});

	it("lists the shelf's own kind of product first among those the words fit alike", () => {
		// No name begins with "strešný nosič na lyže"; the shelf's own name decides.
		const found = names(sk, "strešný nosič na lyže", { preferRoots: new Set(["nosice-lyzi"]) });
		const addOn = found.indexOf("GP nosič lyží pre nosiče bicyklov Peruzzo");
		const named = found.map((name) => name.startsWith("Nosič lyží")).lastIndexOf(true);
		expect(found.slice(0, 3).every((name) => name.startsWith("Nosič lyží"))).toBe(true);
		expect(addOn).toBeGreaterThan(named);
	});

	it("passes over a count in the name: a carrier for two bikes is a bike carrier", () => {
		// After PR 160 "nosič" listed the carriers named "Nosič bicykla…" before every "Nosič 2 bicyklov…".
		expect(names(sk, "nosič")[0]).toBe("Nosič 2 bicyklov Spinder SX2");
		const found = names(sk, "nosič bicyklov", { preferRoots: new Set(["nosice-bicyklov"]) });
		expect(found[0]).toBe("Nosič 2 bicyklov Spinder SX2");
		// A number that was asked for is read as it stands.
		expect(names(sk, "nosič 2 bicyklov")[0]).toBe("Nosič 2 bicyklov Spinder SX2");
	});

	it("does not read a maker alone as what the product is", () => {
		// "Thule Allax S" is a dog crate; its name begins with the maker as every Thule accessory's does.
		expect(names(sk, "thule")[0]).toBe("Nosič bicyklov Thule Epos 2 - 978");
	});

	it("finds a compound by its part, and two words by the one word they are written as", () => {
		// "chladnička" found the stand and the battery first; now the fridges.
		expect(names(sk, "chladnička").slice(0, 2)).toEqual([
			"Kompresorová autochladnička PRO-USER CoolZ 19 l",
			"Kompresorová autochladnička PRO-USER CoolZ 65 l",
		]);
		expect(names(sk, "auto chladnička").slice(0, 2)).toEqual(names(sk, "chladnička").slice(0, 2));
	});

	it("knows a shelf by the other words for it", () => {
		expect(names(sk, "rakva").every((name) => /box/i.test(name))).toBe(true);
		expect(names(sk, "klietka pre psa")[0]).toBe("Thule Allax S - prepravná klietka pre psov");
		expect(names(sk, "retaze na kolesa")).toHaveLength(4);
	});

	it("finds a product by its code, its EAN and a code typed with its punctuation", () => {
		expect(names(sk, "M0001628")).toEqual(["Strešný stan Carcamp ALBA 2"]);
		expect(names(sk, "8717809204097")).toEqual(["Kompresorová autochladnička PRO-USER CoolZ 19 l"]);
		expect(names(sk, "pz-859")).toEqual([
			"Adaptér Peruzzo PZ-859 pre nosič bicykla PureInstinct 711 na štvorhranné tyče",
		]);
		// One kit's code is not its neighbour's: "N21041" used to answer N21050 and N21058 too.
		expect(names(sk, "N21041")).toEqual(["Montážny kit Nordrive C041 pre Škoda Octavia 1Z - (N21041)"]);
	});

	it("says nothing when a word is missing, and offers the closest only when asked to", () => {
		// No 30 l fridge exists. As typed: nothing, so that Saleor is asked before a guess is made.
		expect(names(sk, "autochladnicka 30l")).toEqual([]);
		const closest = searchShelf(sk, "autochladnicka 30l", { match: "closest" });
		expect(closest.mode).toBe("most");
		expect(closest.hits.slice(0, 2).map((hit) => hit.doc.name)).toEqual([
			"Kompresorová autochladnička PRO-USER CoolZ 19 l",
			"Kompresorová autochladnička PRO-USER CoolZ 65 l",
		]);
	});

	it("forgives a spelling mistake only as the closest answer", () => {
		expect(names(sk, "tule")).toEqual([]);
		const corrected = searchShelf(sk, "tule", { match: "closest" });
		expect(corrected.mode).toBe("corrected");
		expect(corrected.hits.every((hit) => /thule/i.test(hit.doc.name))).toBe(true);
	});

	it("lists the named shelf first even when another product carries the words in its name", () => {
		const plain = names(sk, "strešný nosič");
		expect(plain[0]).toBe("Nosič bicykla na strešný nosič Peruzzo PureInstinct 710");
		const preferred = names(sk, "strešný nosič", { preferRoots: new Set(["stresne-nosice"]) });
		// The feet and the bars, which are chosen by the customer, before the kits, which are made
		// for one car each (the live shelf listed 239 kits ahead of its 78 bars by the alphabet).
		expect(preferred[0]).toMatch(/^(Pätky|Priečnik)/);
		const firstKit = preferred.findIndex((name) => name.startsWith("Montážny kit"));
		const lastBar = preferred.findLastIndex((name) => /^(Pätky|Priečnik)/.test(name));
		expect(firstKit).toBeGreaterThan(lastBar);
		expect(preferred).toContain("Nosič bicykla na strešný nosič Peruzzo PureInstinct 710");
	});

	it("offers only the named shelf when only most of the words can be met", () => {
		// The German sample holds no roof box: Nordrive's bars are not "the closest roof box".
		expect(searchShelf(de, "Dachbox Nordrive", { match: "closest" }).hits.length).toBeGreaterThan(0);
		const named = searchShelf(de, "Dachbox Nordrive", {
			match: "closest",
			preferRoots: new Set(["stresne-boxy"]),
		});
		expect(named.hits).toEqual([]);
	});

	it("tells a product named by the words from one found by its category", () => {
		const kit = sk.docs.find((doc) => doc.name.startsWith("Montážny kit Nordrive C041"))!;
		// Found by "nosič" through its category (parts of roof racks), but not called one.
		expect(searchShelf(sk, "nosič octavia").hits.map((hit) => hit.doc.id)).toContain(kit.id);
		expect(nameCarries(kit, ["nosic"], "sk")).toBe(false);
		expect(nameCarries(kit, ["kit"], "sk")).toBe(true);
		expect(nameCarries(kit, ["montazne", "kity"], "sk")).toBe(true);
		// By its code, with or without the brackets the name prints it in.
		expect(nameCarries(kit, ["n21041"], "sk")).toBe(true);
		expect(nameCarries(kit, ["n21050"], "sk")).toBe(false);
	});

	it("orders by price, name and date when the shopper asks", () => {
		const hits = searchShelf(sk, "strešný box thule").hits;
		expect(sortShelfHits(hits, "price-asc", "sk")[0]!.doc.price).toBe(212.18);
		expect(sortShelfHits(hits, "price-desc", "sk")[0]!.doc.price).toBe(899);
		expect(sortShelfHits(hits, "relevance", "sk")).toEqual(hits);
	});
});

describe("abroad, in the market's own words", () => {
	it("finds what 'Fahrradträger', 'Schneeketten' and 'Kühlbox' answered 0 for", () => {
		expect(names(de, "Fahrradträger").length).toBeGreaterThanOrEqual(5);
		expect(names(de, "Fahrradträger Anhängerkupplung")).toHaveLength(5);
		expect(names(de, "Schneeketten")).toHaveLength(4);
		expect(names(de, "Kühlbox")).toEqual([
			"Kompressor-Kühlbox PRO-USER CoolZ 19 l",
			"Kompressor-Kühlbox PRO-USER CoolZ 65 l",
		]);
	});

	it("meets a typed-out umlaut, two words for one, and the trade's other word", () => {
		expect(names(de, "kuehlbox")).toEqual(names(de, "Kühlbox"));
		expect(names(de, "kühl box")).toEqual(names(de, "Kühlbox"));
		expect(names(de, "Fahrradtraeger fuer 4 Fahrraeder")).toEqual([
			"Fahrradträger Peruzzo Pure Instinct 4 für die Anhängerkupplung für 4 Fahrräder",
		]);
		expect(names(de, "Grundträger").length).toBeGreaterThan(0);
		expect(names(de, "Grundträger").every((name) => /Montagekit|Fußsatz|Querträger/.test(name))).toBe(true);
	});

	it("does not invent a shelf the market does not sell", () => {
		// Germany sells no roof boxes; "Dach" is not "Dachbox", so the bike carriers "für das Dach" stay out.
		expect(names(de, "Dachbox")).toEqual([]);
	});

	it("answers in Czech as well", () => {
		expect(names(cs, "sněhové řetězy")).toHaveLength(4);
		expect(names(cs, "nosič kol na tažné")).toHaveLength(5);
		expect(names(cs, "autolednice")).toHaveLength(2);
		expect(names(cs, "příčníky")[0]).toBe("Příčníky Nordrive Quadra 120 cm, sada 2 ks - (N15020)");
	});
});
