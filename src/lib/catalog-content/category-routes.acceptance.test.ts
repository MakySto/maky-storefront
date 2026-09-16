import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isCategorySlug } from "@/config/categories";
import { categorySegment, isLocalizedRootSegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { type FitmentDataset } from "@/lib/fitment/contract";
import { BORROWED_ROUTES } from "./borrowed-routes";
import { categoryAliasTarget } from "./category-aliases";
import { parseContentSnapshot } from "./contract";
import { catalogLanguageForMarket } from "./language";
import { isPubliclyVisible } from "./publication";
import { catalogRedirectTarget } from "./redirects";
import { buildCatalogTree } from "./tree";

/**
 * The localized-root map and the borrowed-page list, checked against the delivery (COMMERCE-2 M1).
 *
 * `category-routes.test.ts` and `proxy.test.ts` prove the routing agrees with the map. Only the
 * artifacts can prove the map agrees with the catalogue: that each language publishes its pages
 * under the root this storefront routes, that the only exceptions are the ones listed, and that
 * every page stays reachable — under its own URL, and from the Slovak spelling in one hop.
 *
 * Same inputs as the other acceptance tests, skipped without them:
 *
 *     MAKY_CATALOG_CONTENT_PATH=…/maky_catalog_content_1.0.0-{lang}-<date>.json \
 *     MAKY_FITMENT_DATASET_PATH=…/maky_roof_fitment_<version>.json pnpm check:catalog
 */
const TEMPLATE = process.env.MAKY_CATALOG_CONTENT_PATH?.trim();
const FITMENT_PATH = process.env.MAKY_FITMENT_DATASET_PATH?.trim();
const ROOT = "stresne-nosice";

const MARKET_FOR = new Map<string, string>();
for (const market of Object.keys(CHANNEL_MAP)) {
	const language = catalogLanguageForMarket(market);
	if (language && !MARKET_FOR.has(language)) MARKET_FOR.set(language, market);
}

const contentPath = (language: string) => TEMPLATE!.split("{lang}").join(language);
const available = Boolean(
	TEMPLATE?.includes("{lang}") &&
		FITMENT_PATH &&
		existsSync(FITMENT_PATH) &&
		[...MARKET_FOR.keys()].every((language) => existsSync(contentPath(language))),
);

type View = {
	snapshot: ReturnType<typeof parseContentSnapshot>;
	tree: ReturnType<typeof buildCatalogTree>;
};

let dataset: FitmentDataset | null = null;
const views = new Map<string, View>();

function view(language: string): View {
	let loaded = views.get(language);
	if (!loaded) {
		dataset ??= JSON.parse(readFileSync(FITMENT_PATH!, "utf8")) as FitmentDataset;
		const snapshot = parseContentSnapshot(JSON.parse(readFileSync(contentPath(language), "utf8")));
		loaded = { snapshot, tree: buildCatalogTree(snapshot, dataset) };
		views.set(language, loaded);
	}
	return loaded;
}

function renders(language: string, path: string): boolean {
	const node = view(language).tree.byUrlPath.get(path);
	return Boolean(node?.page && isPubliclyVisible(node.page));
}

describe.skipIf(!available)("localized category roots, against the delivered catalogue", () => {
	it("publishes each language under the root the map names, apart from the listed borrowed pages", () => {
		const strays: string[] = [];
		for (const [language, market] of MARKET_FOR) {
			const segment = categorySegment(market, ROOT);
			const borrowed = new Set(BORROWED_ROUTES.paths[language] ?? []);
			for (const page of view(language).snapshot.pages) {
				const first = page.urlPath.split("/")[1];
				if (first === segment) continue;
				if (first === ROOT && borrowed.has(page.urlPath)) continue;
				strays.push(`${language}: ${page.urlPath}`);
			}
		}
		expect(strays).toEqual([]);
	});

	it("lists exactly the pages a foreign catalogue still publishes under the Slovak root", () => {
		for (const [language] of MARKET_FOR) {
			if (language === "sk") continue;
			const actual = view(language)
				.snapshot.pages.map((page) => page.urlPath)
				.filter((path) => path.startsWith(`/${ROOT}/`))
				.sort();
			expect(BORROWED_ROUTES.paths[language] ?? [], language).toEqual(actual);
		}
		expect(Object.keys(BORROWED_ROUTES.paths).sort()).toEqual(
			[...MARKET_FOR.keys()].filter((language) => language !== "sk").sort(),
		);
	});

	it("routes every page that renders — the proxy recognises its first segment in its market", () => {
		const unrouted: string[] = [];
		for (const [language, market] of MARKET_FOR) {
			for (const path of view(language).tree.byUrlPath.keys()) {
				if (!renders(language, path)) continue;
				const first = path.split("/")[1]!;
				if (!isCategorySlug(first) && !isLocalizedRootSegment(market, first)) {
					unrouted.push(`${language}: ${path}`);
				}
			}
		}
		expect(unrouted).toEqual([]);
	});

	it("never aliases a page that renders at its own URL", () => {
		const aliased: string[] = [];
		for (const [language, market] of MARKET_FOR) {
			for (const path of view(language).tree.byUrlPath.keys()) {
				if (!renders(language, path)) continue;
				const target = categoryAliasTarget(market, path.split("/").filter(Boolean));
				if (target) aliased.push(`${language}: ${path} -> ${target}`);
			}
		}
		expect(aliased).toEqual([]);
	});

	it("takes the other spelling of every page that renders to that page, in one hop", () => {
		const broken: string[] = [];
		let checked = 0;
		for (const [language, market] of MARKET_FOR) {
			if (language === "sk") continue;
			const segment = categorySegment(market, ROOT);
			for (const path of view(language).tree.byUrlPath.keys()) {
				if (!renders(language, path)) continue;
				const [first, ...tail] = path.split("/").filter(Boolean);
				const other = first === ROOT ? [segment, ...tail] : [ROOT, ...tail];
				const target = categoryAliasTarget(market, other);
				checked += 1;
				if (target !== path) broken.push(`${language}: /${other.join("/")} -> ${target} (want ${path})`);
				else if (catalogRedirectTarget(market, target))
					broken.push(`${language}: ${target} is itself retired`);
			}
		}
		expect(broken).toEqual([]);
		expect(checked).toBeGreaterThan(9 * 1400);
	});
});
