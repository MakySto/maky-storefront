import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { FitmentDataset, RoofType } from "@/lib/fitment/contract";
import { validateFitmentDataset } from "@/lib/fitment/validate";
import { parseContentSnapshot, type CatalogContentPage } from "./contract";
import { indexabilityOf, isPubliclyVisible } from "./publication";
import { splitContent, stripTags } from "./text";
import { buildCatalogTree } from "./tree";

/**
 * What switching the dataset does to the vehicle PAGES — the tree, the tiles, the sitemap and the
 * intros that describe a car's roofs — measured with this build's own modules.
 *
 *   M_TREE_SNAPSHOT=<catalog content, one language>.json M_TREE_OLD=<live dataset>.json \
 *   M_TREE_NEW=<new dataset>.json M_TREE_OUT=<report>.json \
 *     npx vitest run src/lib/catalog-content/new-dataset.check.test.ts
 *
 * Skipped without all four paths: it reads ~35 MB and `pnpm test` must not.
 *
 * ## Why this exists
 *
 * The vehicle tree is built from the FITMENT dataset (`tree.ts`): every make, model and generation
 * in it becomes a node, and a node gets a page only if the content snapshot has one. The new
 * dataset adds 383 vehicles the snapshot has never heard of. Whether that leaves a dead tile, a
 * dead link, a sitemap entry or a 404 is a property of the code, so it is measured here, not
 * argued from it.
 *
 * ## The intros
 *
 * CFM counted 160 of 856 Slovak generation intros that claim every set is for one roof type
 * ("Všetky zostavy v ponuke sú určené pre integrované lyžiny"). Once Thule's sets are on a page,
 * the claim is false wherever Thule adds another roof. The detection below is deliberately blunt —
 * an exclusivity word, a word for the offer, and a roof word in one sentence — and its output is a
 * LIST OF SENTENCES to be read by a person, with the page and the roofs the dataset really holds.
 */
const SNAPSHOT = process.env.M_TREE_SNAPSHOT?.trim();
const OLD = process.env.M_TREE_OLD?.trim();
const NEW = process.env.M_TREE_NEW?.trim();
const OUT = process.env.M_TREE_OUT?.trim();
const available = Boolean(SNAPSHOT && OLD && NEW && OUT);

function load(path: string): FitmentDataset {
	const text = readFileSync(path, "utf8");
	const result = validateFitmentDataset(JSON.parse(text), {
		expectedSaleorInstance: "api.maky.store",
		rawText: text,
	});
	if (!result.ok) throw new Error(`${path}: ${result.errors.join("; ")}`);
	return result.dataset;
}

/** Roof words, Slovak, as the intros use them. The selector's labels differ ("pozdĺžniky"). */
const ROOF_WORDS: Record<RoofType, RegExp> = {
	"flush-rails": /integrovan\p{L}*\s+(lyžin|lyžín|pozdĺžnik)/iu,
	"raised-rails": /(klasick\p{L}*\s+(lyžin|lyžín|pozdĺžnik)|pozdĺžnik\p{L}*\s+nad\s+strechou)/iu,
	"naked-roof": /(hladk\p{L}*\s+streh|hol\p{L}*\s+streh|bez\s+(lyžín|lyžin))/iu,
	fixpoint: /(fixačn\p{L}*\s+bod|pevn\p{L}*\s+bod)/iu,
	"t-track": /T-dráž/iu,
	"rain-gutter": /odkvap/iu,
};
/** The sentence speaks about THE OFFER, not about how a roof looks. */
const ABOUT_THE_OFFER = /(zostav|ponuk|produkt|riešen|nosič|priečnik)/iu;
/** And says the offer is only for one thing. */
const EXCLUSIVE =
	/(všetk\p{L}*|výhradne|vyhradne|\biba\b|\blen\b|presne\s+(pre|na)|určen\p{L}*\s+(priamo\s+)?(na|pre)|pripraven\p{L}*\s+(na|pre)|navrhnut\p{L}*|prispôsoben\p{L}*|počítaj\p{L}*\s+s)/iu;

function renderedSentences(page: CatalogContentPage): string[] {
	const { top, body } = splitContent(page);
	const texts: string[] = [];
	for (const block of [...top, ...body]) {
		if (block.type === "list") texts.push(...block.data.items);
		else texts.push(block.data.text);
	}
	return texts
		.flatMap((text) => stripTags(text).split(/(?<=[.!?])\s+/))
		.map((s) => s.trim())
		.filter(Boolean);
}

function claimedRoofs(sentence: string): RoofType[] {
	if (!ABOUT_THE_OFFER.test(sentence) || !EXCLUSIVE.test(sentence)) return [];
	return (Object.keys(ROOF_WORDS) as RoofType[]).filter((roof) => ROOF_WORDS[roof].test(sentence));
}

function roofsOf(dataset: FitmentDataset): Map<string, Set<RoofType>> {
	const roofs = new Map<string, Set<RoofType>>();
	for (const application of dataset.applications) {
		if (application.negative) continue;
		const set = roofs.get(application.generationId) ?? new Set<RoofType>();
		for (const roof of application.qualifiers.roofTypes ?? []) set.add(roof);
		roofs.set(application.generationId, set);
	}
	return roofs;
}

describe.skipIf(!available)("what the new dataset does to the vehicle pages", () => {
	it("measures the tree, the tiles, the sitemap and the intros", () => {
		const snapshot = parseContentSnapshot(JSON.parse(readFileSync(SNAPSHOT as string, "utf8")));
		const oldDataset = load(OLD as string);
		const newDataset = load(NEW as string);
		const oldTree = buildCatalogTree(snapshot, oldDataset);
		const newTree = buildCatalogTree(snapshot, newDataset);

		const kindCounts = (tree: ReturnType<typeof buildCatalogTree>) => {
			const counts: Record<string, { nodes: number; withPage: number; withVisiblePage: number }> = {};
			for (const node of tree.byVehicleId.values()) {
				const row = (counts[node.kind] ??= { nodes: 0, withPage: 0, withVisiblePage: 0 });
				row.nodes += 1;
				if (node.page) row.withPage += 1;
				if (node.page && isPubliclyVisible(node.page)) row.withVisiblePage += 1;
			}
			return counts;
		};

		// A tile `ChildTiles` renders for a child with NO page: it passes `!child.page || visible`, and the
		// page it links to answers not-found (`resolve()` requires `node.page`).
		const deadTiles = (tree: ReturnType<typeof buildCatalogTree>) => {
			const rows: { parent: string; parentUrl: string; child: string; childUrl: string }[] = [];
			for (const parent of tree.byVehicleId.values()) {
				if (!parent.page || !isPubliclyVisible(parent.page)) continue;
				for (const child of tree.childrenOf.get(parent.vehicleId) ?? []) {
					if (child.page) continue;
					rows.push({
						parent: parent.name,
						parentUrl: parent.urlPath,
						child: child.name,
						childUrl: child.urlPath,
					});
				}
			}
			return rows;
		};

		const sitemapUrls = (tree: ReturnType<typeof buildCatalogTree>) =>
			[...tree.byUrlPath.values()]
				.filter((n) => n.page && indexabilityOf(n.page).indexable)
				.map((n) => n.page!.urlPath)
				.sort();
		const makeIndex = (tree: ReturnType<typeof buildCatalogTree>) =>
			tree.makes
				.filter((m) => m.page && isPubliclyVisible(m.page))
				.map((m) => m.urlPath)
				.sort();

		const oldSitemap = sitemapUrls(oldTree);
		const newSitemap = sitemapUrls(newTree);
		const oldIndex = makeIndex(oldTree);
		const newIndex = makeIndex(newTree);

		// ---- the pages of generations: how many sets, and how many roofs, before and after ----
		const oldRoofs = roofsOf(oldDataset);
		const newRoofs = roofsOf(newDataset);
		const countProducts = (dataset: FitmentDataset) => {
			const per = new Map<string, Set<string>>();
			for (const application of dataset.applications) {
				const set = per.get(application.generationId) ?? new Set<string>();
				for (const ref of application.products) set.add(ref.saleorProductId);
				per.set(application.generationId, set);
			}
			return per;
		};
		const oldCounts = countProducts(oldDataset);
		const newCounts = countProducts(newDataset);

		const pages: {
			vehicleId: string;
			urlPath: string;
			name: string;
			setsOld: number;
			setsNew: number;
			roofsOld: string[];
			roofsNew: string[];
			claims: { sentence: string; roofs: RoofType[] }[];
			conflictsNow: boolean;
			conflictIntroducedBySwitch: boolean;
		}[] = [];
		for (const node of newTree.byVehicleId.values()) {
			if (node.kind !== "generation" || !node.page || !isPubliclyVisible(node.page)) continue;
			const claims = renderedSentences(node.page)
				.map((sentence) => ({ sentence, roofs: claimedRoofs(sentence) }))
				.filter((claim) => claim.roofs.length > 0);
			const before = [...(oldRoofs.get(node.vehicleId) ?? [])].sort();
			const after = [...(newRoofs.get(node.vehicleId) ?? [])].sort();
			const claimed = new Set(claims.flatMap((claim) => claim.roofs));
			// A claim of ONE roof is contradicted when the page now carries a roof it does not name.
			const contradicts = (roofs: string[]) =>
				claims.length > 0 && roofs.some((roof) => !claimed.has(roof as RoofType));
			pages.push({
				vehicleId: node.vehicleId,
				urlPath: node.page.urlPath,
				name: node.name,
				setsOld: oldCounts.get(node.vehicleId)?.size ?? 0,
				setsNew: newCounts.get(node.vehicleId)?.size ?? 0,
				roofsOld: before,
				roofsNew: after,
				claims,
				conflictsNow: contradicts(after),
				conflictIntroducedBySwitch: contradicts(after) && !contradicts(before),
			});
		}

		const withClaims = pages.filter((p) => p.claims.length > 0);
		const report = {
			generatedFor: {
				snapshotLanguage: snapshot.language,
				oldVersion: oldDataset.datasetVersion,
				newVersion: newDataset.datasetVersion,
			},
			tree: {
				old: kindCounts(oldTree),
				new: kindCounts(newTree),
				statsOld: oldTree.stats,
				statsNew: newTree.stats,
			},
			deadTiles: {
				old: deadTiles(oldTree).length,
				new: deadTiles(newTree).length,
				newRows: deadTiles(newTree).slice(0, 60),
			},
			sitemapVehicles: {
				old: oldSitemap.length,
				new: newSitemap.length,
				added: newSitemap.filter((u) => !oldSitemap.includes(u)),
				removed: oldSitemap.filter((u) => !newSitemap.includes(u)),
			},
			makeIndex: {
				old: oldIndex.length,
				new: newIndex.length,
				added: newIndex.filter((u) => !oldIndex.includes(u)),
			},
			generationPages: {
				visible: pages.length,
				gainingSets: pages.filter((p) => p.setsNew > p.setsOld).length,
				setsMedianOld: pages.map((p) => p.setsOld).sort((a, b) => a - b)[Math.floor(pages.length / 2)],
				setsMedianNew: pages.map((p) => p.setsNew).sort((a, b) => a - b)[Math.floor(pages.length / 2)],
				mixingRoofsOld: pages.filter((p) => p.roofsOld.length > 1).length,
				mixingRoofsNew: pages.filter((p) => p.roofsNew.length > 1).length,
			},
			intros: {
				pagesWithAnExclusiveRoofClaim: withClaims.length,
				contradictedAfterTheSwitch: withClaims.filter((p) => p.conflictsNow).length,
				contradictedBefore: withClaims.filter((p) => p.conflictsNow && !p.conflictIntroducedBySwitch).length,
				introducedBySwitch: withClaims.filter((p) => p.conflictIntroducedBySwitch).length,
				list: withClaims.filter((p) => p.conflictIntroducedBySwitch),
				listPreExisting: withClaims.filter((p) => p.conflictsNow && !p.conflictIntroducedBySwitch),
			},
		};
		writeFileSync(OUT as string, JSON.stringify(report, null, 1));
		console.log(
			JSON.stringify(
				{
					...report,
					deadTiles: { old: report.deadTiles.old, new: report.deadTiles.new },
					intros: { ...report.intros, list: undefined, listPreExisting: undefined },
				},
				null,
				1,
			),
		);
		expect(report.tree.new).toBeDefined();
	}, 600_000);
});
