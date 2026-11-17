import { describe, expect, it } from "vitest";
import { metadataSeoTitle } from "./seo-title";

const WHOLE =
	"Strešný nosič Thule ProBar EVO Silver pre Alfa Romeo 159 Sportwagon 939 (2006–2008) s klasickými lyžinami";

describe("the whole title CFM keeps in the product's metadata", () => {
	const metadata = [
		{ key: "cfm_source_url", value: "https://example.test/x" },
		{ key: "maky_seo_title:sk", value: WHOLE },
		{
			key: "maky_seo_title:de",
			value: "Thule Dachträger für Alfa Romeo 159 Sportwagon 939 (2006–2008) mit klassischen Reling",
		},
	];

	it("is the key of the market's language: the Slovak one for sk-SK, the German one for de-AT and de-DE", () => {
		expect(metadataSeoTitle(metadata, "sk-SK")).toBe(WHOLE);
		expect(metadataSeoTitle(metadata, "de-AT")).toMatch(/^Thule Dachträger/);
		expect(metadataSeoTitle(metadata, "de-DE")).toMatch(/^Thule Dachträger/);
	});

	it("is none when the key of the language is not there: another language's title is never read", () => {
		expect(metadataSeoTitle(metadata, "pl-PL")).toBeNull();
		expect(metadataSeoTitle(metadata, "en-CA")).toBeNull();
	});

	it("is none for a product without metadata, or with a value that says nothing but the shop's name", () => {
		expect(metadataSeoTitle(null, "sk-SK")).toBeNull();
		expect(metadataSeoTitle(undefined, "sk-SK")).toBeNull();
		expect(metadataSeoTitle([], "sk-SK")).toBeNull();
		expect(metadataSeoTitle([{ key: "maky_seo_title:sk", value: " | MAKY.STORE " }], "sk-SK")).toBeNull();
		expect(metadataSeoTitle([{ key: "maky_seo_title:sk", value: "" }], "sk-SK")).toBeNull();
	});
});
