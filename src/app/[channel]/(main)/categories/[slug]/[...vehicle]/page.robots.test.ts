import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A vehicle page Google may index inherits the root robots meta; one it may not says so.
 *
 * The page used to return `robots: indexable ? undefined : {…}`. For an indexable page that
 * is a key PRESENT with the value `undefined`, and Next's metadata merge (`for (key in
 * metadata)`) turns it into "no robots at all" — erasing the root's `index, follow,
 * max-image-preview:large` on exactly the pages that are supposed to rank. The key has to be
 * absent.
 *
 * The catalogue artifacts are replaced by one hand-built node; everything else — the
 * publication rules that decide indexability, the canonical, the hreflang rule — is real.
 */

const VEHICLE_ID = "veh-octavia-nx";
const URL_PATH = "/stresne-nosice/skoda/octavia-combi/nx";

let page: Record<string, unknown>;

vi.mock("@/lib/catalog-content/resolve", () => {
	const node = () => ({
		vehicleId: VEHICLE_ID,
		kind: "generation",
		name: "NX",
		urlPath: URL_PATH,
		parentId: null,
		page,
	});
	const view = () => ({
		ready: true,
		status: {},
		tree: {
			byUrlPath: new Map([[URL_PATH, node()]]),
			byVehicleId: new Map([[VEHICLE_ID, node()]]),
			childrenOf: new Map(),
			applicationsOf: new Map(),
			makes: [],
		},
	});
	return {
		catalogLanguageForChannel: () => "sk",
		catalogLanguageForMarket: () => "sk",
		loadCatalogView: async () => view(),
		resolveVehiclePath: (tree: { byUrlPath: Map<string, unknown> }, slug: string, segments: string[]) =>
			tree.byUrlPath.get(`/${slug}/${segments.join("/")}`) ?? null,
	};
});

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	page = {
		publicId: "p1",
		kind: "generation",
		urlPath: URL_PATH,
		state: "published",
		indexable: true,
		hasEditorialText: true,
		metaTitle: "Strešné nosiče Škoda Octavia Combi NX | MAKY.STORE",
		metaDescription: "Overené strešné nosiče.",
	};
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const metadataFor = async () => {
	const { generateMetadata } = await import("./page");
	return generateMetadata({
		params: Promise.resolve({
			channel: "sk-eur",
			slug: "stresne-nosice",
			vehicle: ["skoda", "octavia-combi", "nx"],
		}),
	});
};

describe("vehicle page robots", () => {
	it("an indexable page carries no robots key, so the root's index,follow survives", async () => {
		const meta = await metadataFor();
		expect(meta).not.toHaveProperty("robots");
		expect(meta.alternates?.canonical).toBe(`https://maky.store/sk${URL_PATH}`);
		expect(meta.openGraph).toMatchObject({
			url: meta.alternates?.canonical,
			locale: "sk_SK",
			siteName: "MAKY.STORE",
		});
	});

	it("a published page without editorial text stays out of the index, and is still followed", async () => {
		page.hasEditorialText = false;
		const meta = await metadataFor();
		expect(meta.robots).toEqual({ index: false, follow: true });
	});

	it("a page CFM marks non-indexable stays out", async () => {
		page.indexable = false;
		expect((await metadataFor()).robots).toEqual({ index: false, follow: true });
	});
});
