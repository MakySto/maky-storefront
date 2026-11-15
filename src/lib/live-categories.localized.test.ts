import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryUrl } from "@/config/categories";
import {
	baseSlugForCategoryId,
	categoryBaseSlug,
	categoryRootServes,
	categoryUrlFor,
	isLocalizedRootSegment,
} from "@/config/category-routes";
import { proxy } from "@/proxy";
import { liveCategoriesStats, refreshLiveCategories, resetLiveCategoriesForTests } from "./live-categories";
import { installFakeSaleor } from "./live-categories.testkit";

/**
 * Owner, 2026-11-15: no category address carries `/categories/`, in any market, for every category to come.
 *
 * A category created in Saleor with translations CFM writes gets its address in each foreign market from the
 * translated slug, with no row in `config/category-routes.ts` and no release. Every test runs against the fake
 * Saleor of `live-categories.testkit.ts`, so what is under test is the question the server asks and how it reads
 * the answer, and then what the proxy does with it.
 */

const NEW = "a-future-category";
const ID = `Category:${NEW}`;
const T0 = new Date("2026-11-15T12:00:00Z").getTime();

/** The translations CFM writes for a new category: nine languages and Austria's own record, no English. */
const TRANSLATIONS = {
	CS: "budouci-kategorie",
	DE: "zukuenftige-kategorie",
	DE_AT: "kuenftige-kategorie",
	PL: "przyszla-kategoria",
	HU: "jovobeli-kategoria",
	IT: "categoria-futura",
	FR: "categorie-future",
	ES: "categoria-futura-es",
	RO: "categorie-viitoare",
};

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const where = (response: Response) => new URL(response.headers.get("location") ?? "http://none").pathname;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(T0);
	resetLiveCategoriesForTests();
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetLiveCategoriesForTests();
});

describe("a new category with translations", () => {
	it("asks Saleor for the translated slug in every language a foreign market reads, and for the id", async () => {
		const { world } = installFakeSaleor();
		await refreshLiveCategories();

		const query = world.listQueries[0]!;
		expect(query).toContain("node{id slug");
		for (const code of ["CS", "DE", "DE_AT", "PL", "HU", "IT", "FR", "ES", "RO", "EN", "EN_CA"]) {
			expect(query, code).toContain(`t_${code}:translation(languageCode:${code}){slug}`);
		}
		// Slovakia reads the base row: there is nothing to ask for.
		expect(query).not.toContain("languageCode:SK");
	});

	it("gets its address in each market from its translation: Austria from DE_AT, the English markets on the base slug", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();

		const spelled = (market: string) => categoryUrlFor(market, NEW);
		expect(spelled("sk")).toBe(`/${NEW}`);
		expect(spelled("cz")).toBe("/budouci-kategorie");
		expect(spelled("de")).toBe("/zukuenftige-kategorie");
		expect(spelled("at")).toBe("/kuenftige-kategorie");
		expect(spelled("pl")).toBe("/przyszla-kategoria");
		expect(spelled("hu")).toBe("/jovobeli-kategoria");
		expect(spelled("it")).toBe("/categoria-futura");
		expect(spelled("fr")).toBe("/categorie-future");
		expect(spelled("es")).toBe("/categoria-futura-es");
		expect(spelled("ro")).toBe("/categorie-viitoare");
		// No English translation yet: the base slug is the address, still at the root.
		expect(spelled("us")).toBe(`/${NEW}`);
		expect(spelled("ca")).toBe(`/${NEW}`);
		// Never the retired form, anywhere.
		for (const market of ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			expect(spelled(market), market).not.toContain("/categories/");
		}
		expect(liveCategoriesStats().localized[`${NEW}|de`]).toBe("zukuenftige-kategorie");
	});

	it("is resolved from the translated slug, from the id, and through the base slug", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();

		expect(categoryBaseSlug("de", "zukuenftige-kategorie")).toBe(NEW);
		expect(categoryBaseSlug("de-eur", "zukuenftige-kategorie")).toBe(NEW);
		expect(baseSlugForCategoryId(ID)).toBe(NEW);
		expect(isLocalizedRootSegment("de", "zukuenftige-kategorie")).toBe(true);
		// Only the market's own spelling: Austria's is not Germany's.
		expect(isLocalizedRootSegment("de", "kuenftige-kategorie")).toBe(false);
		expect(isLocalizedRootSegment("at", "kuenftige-kategorie")).toBe(true);
		expect(categoryRootServes("de", NEW)).toBe(true);
	});

	it("is served by the proxy at the market's address, and the other spellings answer a permanent redirect to it", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();

		const own = await proxy(req("/de/zukuenftige-kategorie"));
		expect(own.headers.get("location")).toBeNull();
		expect(own.headers.get("x-middleware-rewrite")).toContain("/de-eur/categories/zukuenftige-kategorie");

		const retired = await proxy(req("/de/categories/zukuenftige-kategorie?page=2"));
		expect(retired.status).toBe(308);
		expect(where(retired)).toBe("/de/zukuenftige-kategorie");
		expect(new URL(retired.headers.get("location")!).search).toBe("?page=2");

		const retiredBase = await proxy(req(`/de/categories/${NEW}`));
		expect(retiredBase.status).toBe(308);
		expect(where(retiredBase)).toBe("/de/zukuenftige-kategorie");

		const slovakWord = await proxy(req(`/de/${NEW}`));
		expect(slovakWord.status).toBe(301);
		expect(where(slovakWord)).toBe("/de/zukuenftige-kategorie");

		const austria = await proxy(req("/at/categories/kuenftige-kategorie"));
		expect(where(austria)).toBe("/at/kuenftige-kategorie");
	});

	it("keeps Slovakia on the base slug, with the retired form redirected to it", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();

		expect(categoryUrl(NEW)).toBe(`/${NEW}`);
		const retired = await proxy(req(`/sk/categories/${NEW}`));
		expect(retired.status).toBe(308);
		expect(where(retired)).toBe(`/sk/${NEW}`);
	});

	it("is dropped with its translation: a later load without it no longer routes the spelling", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();
		expect(categoryUrlFor("de", NEW)).toBe("/zukuenftige-kategorie");

		delete world.translations[NEW]!.DE;
		vi.setSystemTime(T0 + 10_000);
		await refreshLiveCategories({ force: true });
		expect(categoryUrlFor("de", NEW)).toBe(`/${NEW}`);
		expect(isLocalizedRootSegment("de", "zukuenftige-kategorie")).toBe(false);
	});

	it("is not asked about again while Saleor still holds the same translations", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();
		const asked = world.spellingProbeQueries.length;
		expect(asked).toBeGreaterThan(0);

		vi.setSystemTime(T0 + 10_000);
		await refreshLiveCategories({ force: true });
		expect(world.spellingProbeQueries).toHaveLength(asked);
		expect(categoryUrlFor("de", NEW)).toBe("/zukuenftige-kategorie");
	});

	it("asks the products of the market in both spellings, base and translated, in one request per batch", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		await refreshLiveCategories();

		expect(world.spellingProbeQueries).toHaveLength(1);
		const query = world.spellingProbeQueries[0]!;
		expect(query).toContain('product(slug:"zukuenftige-kategorie",channel:"de-eur")');
		expect(query).toContain('product(slug:"zukuenftige-kategorie",channel:"de-eur",slugLanguageCode:DE)');
		expect(query).toContain('product(slug:"kuenftige-kategorie",channel:"at-eur",slugLanguageCode:DE_AT)');
	});
});

describe("a translated slug that already means something else", () => {
	it("is not taken while a product of that market holds it, as a base slug or as its translated one", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		world.products["budouci-kategorie"] = ["cz-czk"];
		world.translatedProducts["zukuenftige-kategorie"] = ["de-eur:DE"];
		await refreshLiveCategories();

		// Those two stay on the base slug, which is what answers there; every other market is unaffected.
		expect(categoryUrlFor("cz", NEW)).toBe(`/${NEW}`);
		expect(categoryUrlFor("de", NEW)).toBe(`/${NEW}`);
		expect(categoryUrlFor("pl", NEW)).toBe("/przyszla-kategoria");
		expect(liveCategoriesStats().localizedRefused[`${NEW}|de`]).toContain(
			"a product holds this slug in de-eur",
		);
		expect(liveCategoriesStats().localizedRefused[`${NEW}|cz`]).toContain(
			"a product holds this slug in cz-czk",
		);
	});

	it("is not taken when it names a route, a market, the cart word or another category", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW, "another-category");
		world.translations[NEW] = {
			DE: "warenkorb",
			PL: "de",
			CS: "another-category",
			HU: "poradna",
			IT: "UPPER-case",
			FR: "stresne-nosice",
		};
		await refreshLiveCategories();

		const refused = liveCategoriesStats().localizedRefused;
		expect(refused[`${NEW}|de`]).toContain("cart");
		expect(refused[`${NEW}|pl`]).toContain("market");
		expect(refused[`${NEW}|cz`]).toContain("another category");
		expect(refused[`${NEW}|hu`]).toContain("route");
		expect(refused[`${NEW}|it`]).toContain("plain lower-case");
		expect(refused[`${NEW}|fr`]).toContain("another category");
		for (const market of ["de", "pl", "cz", "hu", "it", "fr"]) {
			expect(categoryUrlFor(market, NEW), market).toBe(`/${NEW}`);
		}
	});

	it("is not taken by two categories at once in one market: neither gets it", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW, "its-twin");
		world.translations[NEW] = { DE: "gleiches-wort" };
		world.translations["its-twin"] = { DE: "gleiches-wort" };
		await refreshLiveCategories();

		expect(categoryUrlFor("de", NEW)).toBe(`/${NEW}`);
		expect(categoryUrlFor("de", "its-twin")).toBe("/its-twin");
		expect(liveCategoriesStats().localizedRefused[`${NEW}|de`]).toContain("more than one category");
	});

	it("is not taken while Saleor cannot say whether a product holds it, and is asked again at the next load", async () => {
		const { world } = installFakeSaleor();
		// A category of the build's floor, so only its spellings are in question.
		world.translations["opravne-sady"] = { DE: "reparatursaetze" };
		world.probeErrors = true;
		await refreshLiveCategories();
		expect(categoryUrlFor("de", "opravne-sady")).toBe("/opravne-sady");

		world.probeErrors = false;
		vi.setSystemTime(T0 + 10_000);
		await refreshLiveCategories({ force: true });
		expect(categoryUrlFor("de", "opravne-sady")).toBe("/reparatursaetze");
	});
});

/**
 * A page that names a category holds the slug Saleor hands it: the translated one of its market. When that slug did
 * not become the address, the link built from it must still not be `/{market}/categories/{slug}` (owner, 2026-11-15).
 */
describe("a translated slug that did not become the address", () => {
	it("leads to the address the category does have, and the product that holds the slug keeps it", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.translations[NEW] = { ...TRANSLATIONS };
		world.translatedProducts["zukuenftige-kategorie"] = ["de-eur:DE"];
		await refreshLiveCategories();

		expect(categoryBaseSlug("de", "zukuenftige-kategorie")).toBe(NEW);
		expect(categoryUrlFor("de", "zukuenftige-kategorie")).toBe(`/${NEW}`);
		// The category is known by its id as well, which the listing navigation asks first.
		expect(baseSlugForCategoryId(ID)).toBe(NEW);

		// The retired form of the link answers a permanent redirect to the base-slug address, not a listing under it.
		const retired = await proxy(req("/de/categories/zukuenftige-kategorie"));
		expect(retired.status).toBe(308);
		expect(where(retired)).toBe(`/de/${NEW}`);

		// The alias is never routed at the root: the product's slug is not a category there.
		expect(isLocalizedRootSegment("de", "zukuenftige-kategorie")).toBe(false);
		// Every other market took its spelling.
		expect(categoryUrlFor("pl", "przyszla-kategoria")).toBe("/przyszla-kategoria");
	});

	it("leads to the base slug while Saleor cannot say yet, and moves to the spelling once it can", async () => {
		const { world } = installFakeSaleor();
		world.translations["opravne-sady"] = { DE: "reparatursaetze" };
		world.probeErrors = true;
		await refreshLiveCategories();
		expect(categoryUrlFor("de", "reparatursaetze")).toBe("/opravne-sady");

		world.probeErrors = false;
		vi.setSystemTime(T0 + 10_000);
		await refreshLiveCategories({ force: true });
		expect(categoryUrlFor("de", "reparatursaetze")).toBe("/reparatursaetze");
		expect(categoryUrlFor("de", "opravne-sady")).toBe("/reparatursaetze");
	});

	it("names no category when two of them claim it: a link built from it is the one that cannot be placed", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW, "its-twin");
		world.translations[NEW] = { DE: "gleiches-wort" };
		world.translations["its-twin"] = { DE: "gleiches-wort" };
		await refreshLiveCategories();

		expect(categoryBaseSlug("de", "gleiches-wort")).toBe("gleiches-wort");
	});

	it("is the slug Saleor holds for a table category that the table spells otherwise", async () => {
		const { world } = installFakeSaleor();
		world.translations["snehove-retaze"] = { DE: "schneeketten-neu" };
		await refreshLiveCategories();

		// The table's row is the address: nothing is learned and nothing is refused.
		expect(liveCategoriesStats().localized).toEqual({});
		expect(liveCategoriesStats().localizedRefused).toEqual({});
		expect(categoryUrlFor("de", "schneeketten-neu")).toBe("/schneeketten");
		const retired = await proxy(req("/de/categories/schneeketten-neu"));
		expect(retired.status).toBe(308);
		expect(where(retired)).toBe("/de/schneeketten");
	});
});

describe("a category the table already knows", () => {
	it("keeps the table's spelling where it has one, and learns Saleor's only where the table has none", async () => {
		const { world } = installFakeSaleor();
		// Snow chains: the table spells Germany `schneeketten` and has no English spelling.
		world.translations["snehove-retaze"] = {
			DE: "schneeketten-neu",
			EN: "snow-chains",
			EN_CA: "snow-chains-ca",
		};
		await refreshLiveCategories();

		expect(categoryUrlFor("de", "snehove-retaze")).toBe("/schneeketten");
		expect(categoryUrlFor("us", "snehove-retaze")).toBe("/snow-chains");
		expect(categoryUrlFor("ca", "snehove-retaze")).toBe("/snow-chains-ca");
		expect(categoryUrlFor("sk", "snehove-retaze")).toBe("/snehove-retaze");
	});

	it("is not asked about the spelling the table already gives it", async () => {
		const { world } = installFakeSaleor();
		world.translations["snehove-retaze"] = { DE: "schneeketten", CS: "snehove-retezy" };
		await refreshLiveCategories();

		expect(world.spellingProbeQueries).toHaveLength(0);
	});
});

describe("before Saleor has answered", () => {
	it("serves what the table knows, and the base slug of everything else at the root", async () => {
		installFakeSaleor({ down: true });
		await refreshLiveCategories();

		expect(categoryUrlFor("de", "snehove-retaze")).toBe("/schneeketten");
		expect(categoryUrlFor("de", "diely-stresnych-nosicov")).toBe("/einzelteile-fuer-dachtraeger");
		expect(categoryUrlFor("sk", "diely-stresnych-nosicov")).toBe("/diely-stresnych-nosicov");
	});
});
