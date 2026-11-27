import "server-only";

import { isPubliclyVisible } from "@/lib/catalog-content/publication";
import { REVERSE_MAP } from "@/lib/channel-map";
import { catalogLanguageForChannel, loadCatalogView } from "@/lib/catalog-content/resolve";
import type { CatalogNode, CatalogTree } from "@/lib/catalog-content/tree";
import { vehiclePageHref } from "@/lib/catalog-content/vehicle-href";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import type { VehicleIntent, VehicleNames } from "./vehicle-intent";

/**
 * The cars a search can name in one market, and the pages a named car is answered with.
 *
 * The names are the catalogue tree's (the vehicle pages' own, in the market's language) beside the
 * fitment dataset's, so "3 Series" and "Rad 3" both name the car. Only a car the tree holds is
 * listed: a search must not recognise a car it has no page to send the customer to.
 */

export interface VehicleCatalog {
	readonly names: VehicleNames;
	readonly tree: CatalogTree;
}

/** By the dataset this process holds: the names are cut into words once per dataset, not per search. */
const KEPT = new WeakMap<object, Map<string, VehicleNames>>();

export async function readVehicleCatalog(channel: string): Promise<VehicleCatalog | null> {
	const language = catalogLanguageForChannel(channel);
	if (!language) return null;
	const [view, fitment] = await Promise.all([loadCatalogView(language, REVERSE_MAP[channel] ?? channel), loadFitmentDataset()]);
	const dataset = fitment.dataset;
	if (!view.ready || !dataset) return null;
	const { tree } = view;

	let byLanguage = KEPT.get(dataset);
	if (!byLanguage) {
		byLanguage = new Map();
		KEPT.set(dataset, byLanguage);
	}
	let names = byLanguage.get(language);
	if (!names) {
		const alt = (node: { name: string; displayNames?: Partial<Record<string, string>> }, shown: string) =>
			[node.name, node.displayNames?.[language]].filter(
				(name): name is string => typeof name === "string" && name.length > 0 && name !== shown,
			);
		names = {
			makes: dataset.makes.flatMap((make) => {
				const node = tree.byVehicleId.get(make.id);
				return node ? [{ id: make.id, name: node.name, altNames: alt(make, node.name) }] : [];
			}),
			models: dataset.models.flatMap((model) => {
				const node = tree.byVehicleId.get(model.id);
				return node
					? [{ id: model.id, makeId: model.makeId, name: node.name, altNames: alt(model, node.name) }]
					: [];
			}),
			generations: dataset.generations.flatMap((generation) => {
				const node = tree.byVehicleId.get(generation.id);
				return node
					? [
							{
								id: generation.id,
								modelId: generation.modelId,
								name: generation.name,
								yearFrom: generation.productionYearFrom ?? null,
								yearTo: generation.productionYearTo ?? null,
							},
						]
					: [];
			}),
		};
		byLanguage.set(language, names);
	}
	return { names, tree };
}

export interface VehicleLink {
	readonly id: string;
	readonly label: string;
	readonly href: string;
	/** "2013–2020", "2019+": a generation's years of production. */
	readonly years?: string;
}

export interface VehicleShortcut {
	readonly id: string;
	readonly kind: "model" | "make";
	/** "Škoda Octavia", "Škoda". */
	readonly title: string;
	/** The car's own page, where its sets are chosen. */
	readonly href: string;
	/** The generations the words narrowed it to, or all of the model's; newest first. */
	readonly generations: readonly VehicleLink[];
	/** Sister models the words also fit ("Octavia Combi" for "octavia"). */
	readonly related: readonly VehicleLink[];
}

const MAX_SHORTCUTS = 2;
const MAX_GENERATIONS = 8;
const MAX_RELATED = 6;

function yearsOf(node: CatalogNode): string | undefined {
	if (!node.productionYearFrom) return undefined;
	return `${node.productionYearFrom}${node.productionYearTo ? `–${node.productionYearTo}` : "+"}`;
}

/**
 * The pages a recognised car is answered with. Every link is one the vehicle pages would render
 * themselves (`vehiclePageHref`): a car whose page this market does not serve gives no shortcut.
 */
export async function vehicleShortcuts(
	channel: string,
	intent: VehicleIntent,
	tree: CatalogTree,
): Promise<VehicleShortcut[]> {
	const out: VehicleShortcut[] = [];
	const linkTo = async (node: CatalogNode, label: string): Promise<VehicleLink | null> => {
		if (!node.page || !isPubliclyVisible(node.page)) return null;
		const href = await vehiclePageHref(channel, node.vehicleId);
		return href ? { id: node.vehicleId, label, href, years: yearsOf(node) } : null;
	};
	const titleOf = (model: CatalogNode): string => {
		const make = model.parentId ? tree.byVehicleId.get(model.parentId) : undefined;
		// A model's name that already begins with its make is not said twice.
		return make && !model.name.toLowerCase().startsWith(make.name.toLowerCase())
			? `${make.name} ${model.name}`
			: model.name;
	};

	for (const match of intent.models.slice(0, MAX_SHORTCUTS)) {
		const model = tree.byVehicleId.get(match.modelId);
		if (!model) continue;
		const own = await linkTo(model, titleOf(model));
		const wanted = new Set(match.generationIds);
		const candidates = (tree.childrenOf.get(model.vehicleId) ?? [])
			.filter((node) => node.kind === "generation" && (wanted.size === 0 || wanted.has(node.vehicleId)))
			.sort((a, b) => (b.productionYearFrom ?? 0) - (a.productionYearFrom ?? 0));
		const generations = (
			await Promise.all(candidates.slice(0, MAX_GENERATIONS).map((node) => linkTo(node, node.name)))
		).filter((link): link is VehicleLink => link !== null);
		const href = own?.href ?? generations[0]?.href;
		if (!href) continue;

		const related =
			out.length === 0
				? (
						await Promise.all(
							intent.relatedModelIds.slice(0, MAX_RELATED).map((id) => {
								const node = tree.byVehicleId.get(id);
								return node ? linkTo(node, titleOf(node)) : null;
							}),
						)
					).filter((link): link is VehicleLink => link !== null)
				: [];
		out.push({ id: model.vehicleId, kind: "model", title: titleOf(model), href, generations, related });
	}

	for (const makeId of intent.makeIds.slice(0, MAX_SHORTCUTS - out.length)) {
		const make = tree.byVehicleId.get(makeId);
		const own = make ? await linkTo(make, make.name) : null;
		if (make && own) {
			out.push({ id: makeId, kind: "make", title: make.name, href: own.href, generations: [], related: [] });
		}
	}
	return out;
}
