import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { localizedPhotoAlt } from "./index";

/**
 * The dictionary is CFM's real file (copied byte for byte, see data/PROVENANCE.json). The Slovak alts and product
 * names below are FIXTURES: they show the rule, not what Saleor holds today.
 */
const DATA = join(__dirname, "data");
const raw = readFileSync(join(DATA, "photo_alt_dictionary.json"), "utf8");
const dictionary = JSON.parse(raw) as {
	separator: string;
	languages: Record<string, { photo_word: string; tails: Record<string, string> }>;
	self_sha256: string;
};
const NAME = "Dachträger Thule WingBar Evo Škoda Octavia IV Combi (2020–)";
const SK = (tail: string) => `Strešný nosič Thule WingBar Evo Škoda Octavia IV Combi (2020–) – ${tail}`;

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([a], [b]) => (a < b ? -1 : 1))
				.map(([k, v]) => [k, sortKeys(v)]),
		);
	}
	return value;
}

describe("the copied dictionary", () => {
	it("keeps CFM's seal and the hashes recorded next to it", () => {
		const { self_sha256, ...rest } = dictionary;
		expect(
			createHash("sha256")
				.update(JSON.stringify(sortKeys(rest), null, 1))
				.digest("hex"),
		).toBe(self_sha256);
		const provenance = JSON.parse(readFileSync(join(DATA, "PROVENANCE.json"), "utf8")) as {
			file: Record<string, { sha256: string; self_sha256: string; bytes: number }>;
		};
		const recorded = provenance.file["photo_alt_dictionary.json"];
		expect(recorded.self_sha256).toBe(self_sha256);
		expect(recorded.sha256).toBe(createHash("sha256").update(raw).digest("hex"));
		expect(recorded.bytes).toBe(Buffer.byteLength(raw));
	});

	it("covers the 9 languages with the same 411 tails", () => {
		expect(Object.keys(dictionary.languages).sort()).toEqual([
			"cs",
			"de",
			"en",
			"es",
			"fr",
			"hu",
			"it",
			"pl",
			"ro",
		]);
		for (const language of Object.values(dictionary.languages))
			expect(Object.keys(language.tails)).toHaveLength(411);
	});
});

describe("localizedPhotoAlt", () => {
	it("gives the main photo the translated name, as before", () => {
		expect(localizedPhotoAlt(SK("rozmery"), NAME, 0, "de-DE")).toBe(NAME);
		expect(localizedPhotoAlt("", NAME, 0, "de-DE")).toBe(NAME);
	});

	it("translates the tail of the Slovak alt", () => {
		expect(localizedPhotoAlt(SK("čierne tyče na lyžinách auta (ilustračná fotka)"), NAME, 1, "de-DE")).toBe(
			`${NAME} – schwarze Querträger auf der Dachreling eines Autos (Symbolbild)`,
		);
		expect(localizedPhotoAlt(SK("rozmery"), NAME, 2, "de-DE")).toBe(`${NAME} – Abmessungen`);
	});

	it("translates numbered tails", () => {
		expect(localizedPhotoAlt(SK("fotka 4"), NAME, 3, "de-DE")).toBe(`${NAME} – Foto 4`);
		expect(localizedPhotoAlt(SK("rozmery 2"), NAME, 4, "de-DE")).toBe(`${NAME} – Abmessungen 2`);
	});

	it("never shows a hand-written, annotated, empty or unknown Slovak alt", () => {
		expect(localizedPhotoAlt("ručne písaný alt", NAME, 5, "de-DE")).toBe(`${NAME} – Foto 6`);
		expect(localizedPhotoAlt(SK("text, ktorý slovník nepozná"), NAME, 5, "de-DE")).toBe(`${NAME} – Foto 6`);
		expect(localizedPhotoAlt("", NAME, 6, "de-DE")).toBe(`${NAME} – Foto 7`);
		expect(localizedPhotoAlt(null, NAME, 6, "de-DE")).toBe(`${NAME} – Foto 7`);
		expect(localizedPhotoAlt(SK(""), NAME, 6, "de-DE")).toBe(`${NAME} – Foto 7`);
		expect(localizedPhotoAlt(SK("rozmery 2 x"), NAME, 6, "de-DE")).toBe(`${NAME} – Foto 7`);
	});

	it("does not mistake a tail for a property of Object.prototype", () => {
		for (const tail of ["constructor", "toString", "__proto__", "constructor 2"]) {
			expect(localizedPhotoAlt(SK(tail), NAME, 1, "de-DE")).toBe(`${NAME} – Foto 2`);
		}
	});

	it("reads the language from the first part of the market's locale", () => {
		const alt = SK("rozmery");
		expect(localizedPhotoAlt(alt, NAME, 1, "de-AT")).toBe(`${NAME} – Abmessungen`);
		expect(localizedPhotoAlt(alt, NAME, 1, "DE_AT")).toBe(`${NAME} – Abmessungen`);
		expect(localizedPhotoAlt(alt, NAME, 1, "en-CA")).toBe(`${NAME} – dimensions`);
		expect(localizedPhotoAlt(alt, NAME, 1, "EN_US")).toBe(`${NAME} – dimensions`);
		expect(localizedPhotoAlt(alt, NAME, 1, "pl-PL")).toBe(`${NAME} – wymiary`);
	});

	it("leaves a language the dictionary does not have to the old behaviour (no alt)", () => {
		expect(localizedPhotoAlt(SK("rozmery"), NAME, 1, "sk-SK")).toBeNull();
		expect(localizedPhotoAlt(SK("rozmery"), NAME, 1, "xx-XX")).toBeNull();
		expect(localizedPhotoAlt(SK("rozmery"), NAME, 1, "")).toBeNull();
		expect(localizedPhotoAlt(SK("rozmery"), NAME, 1, "constructor")).toBeNull();
	});

	it("shows no Slovak tail in any language, for every tail CFM writes", () => {
		for (const [code, language] of Object.entries(dictionary.languages)) {
			const locale = `${code}-XX`;
			Object.entries(language.tails).forEach(([sk, translated], i) => {
				const alt = localizedPhotoAlt(SK(sk), NAME, i + 1, locale);
				expect(alt).toBe(`${NAME} – ${translated}`);
				if (sk !== translated) expect(alt).not.toContain(sk);
			});
		}
	});

	it("gives two photos of one gallery different alts", () => {
		// What CFM writes for one gallery: a description, the same description numbered, a photo number, a type.
		const gallery = [
			SK("fotka výrobku"),
			SK("rozmery"),
			SK("rozmery 2"),
			SK("fotka 4"),
			SK("fotka 5"),
			"ručne písaný alt",
			"",
		];
		for (const locale of [
			"cs-CZ",
			"de-DE",
			"de-AT",
			"pl-PL",
			"hu-HU",
			"it-IT",
			"fr-FR",
			"es-ES",
			"ro-RO",
			"en-CA",
		]) {
			const alts = gallery.map((alt, index) => localizedPhotoAlt(alt, NAME, index, locale));
			expect(new Set(alts).size).toBe(gallery.length);
		}
	});
});
