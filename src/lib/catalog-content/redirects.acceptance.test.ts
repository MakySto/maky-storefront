import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";
import { type FitmentDataset } from "@/lib/fitment/contract";
import { parseContentSnapshot } from "./contract";
import { catalogLanguageForMarket } from "./language";
import { isPubliclyVisible } from "./publication";
import { CATALOG_REDIRECTS, catalogRedirectTarget } from "./redirects";
import { buildCatalogTree } from "./tree";

/**
 * The retired-page table, checked against the delivery it was written for — in every language.
 *
 * `redirects.test.ts` proves the table agrees with itself. Only the artifacts can prove it agrees
 * with the catalogue: that every target is a page that renders, that no source is a page that
 * still renders, and that no published page has lost its car without gaining a redirect.
 *
 * Needs the `{lang}` family, the way production is configured, and the fitment dataset beside
 * it; skipped otherwise, like the other acceptance tests, because the artifacts are not committed.
 *
 *     MAKY_CATALOG_CONTENT_PATH=…/maky_catalog_content_1.0.0-{lang}-<date>.json \
 *     MAKY_FITMENT_DATASET_PATH=…/maky_roof_fitment_<version>.json pnpm check:catalog
 *
 * "Renders" is the vehicle route's own test: a node in the tree whose page is published. For a
 * foreign language that is the catalogue's answer and not yet the proxy's — the localized roots
 * (`/stresni-nosice`, `/roof-racks`, …) are not routed, so a correct target still 404s there.
 */
const TEMPLATE = process.env.MAKY_CATALOG_CONTENT_PATH?.trim();
const FITMENT_PATH = process.env.MAKY_FITMENT_DATASET_PATH?.trim();

/** One market per language: the table is keyed by language, and so is every artifact. */
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

/** Per language, lazily: `describe.skipIf` still evaluates the describe body. */
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

describe.skipIf(!available)("the retired-page redirects, against the delivered catalogue", () => {
	it("sends every retired path to a page that renders in its language", () => {
		const broken: string[] = [];
		for (const [language, table] of Object.entries(CATALOG_REDIRECTS.exact)) {
			for (const [from, to] of Object.entries(table)) {
				if (!renders(language, to)) broken.push(`${language}: ${from} -> ${to}`);
			}
		}
		expect(broken).toEqual([]);
	});

	it("never redirects a page that still renders", () => {
		const shadowed: string[] = [];
		for (const [language, table] of Object.entries(CATALOG_REDIRECTS.exact)) {
			for (const from of Object.keys(table)) {
				if (renders(language, from)) shadowed.push(`${language}: ${from}`);
			}
		}
		for (const [language, roots] of Object.entries(CATALOG_REDIRECTS.roots)) {
			for (const root of Object.keys(roots)) {
				for (const path of view(language).tree.byUrlPath.keys()) {
					if ((path === root || path.startsWith(`${root}/`)) && renders(language, path)) {
						shadowed.push(`${language}: ${path}`);
					}
				}
			}
		}
		expect(shadowed).toEqual([]);
	});

	it("gives every published page that lost its car a redirect", () => {
		const stranded: string[] = [];
		for (const [language, market] of MARKET_FOR) {
			const { snapshot, tree } = view(language);
			for (const page of snapshot.pages) {
				if (!isPubliclyVisible(page)) continue;
				if (page.vehicleId && tree.byVehicleId.has(page.vehicleId)) continue;
				if (!catalogRedirectTarget(market, page.urlPath)) stranded.push(`${language}: ${page.urlPath}`);
			}
		}
		expect(stranded).toEqual([]);
	});

	it("moves each retired root onto a root the catalogue actually uses", () => {
		for (const [language, roots] of Object.entries(CATALOG_REDIRECTS.roots)) {
			const paths = [...view(language).tree.byUrlPath.keys()];
			for (const [from, to] of Object.entries(roots)) {
				expect(
					paths.some((path) => path.startsWith(`${to}/`)),
					`${language}: nothing lives under ${to}`,
				).toBe(true);
				expect(
					paths.some((path) => path === from || path.startsWith(`${from}/`)),
					`${language}: ${from} is still in use`,
				).toBe(false);
			}
		}
	});
});
