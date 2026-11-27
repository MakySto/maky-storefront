import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { canonicalCatalogPath } from "./category-aliases";
import { isPubliclyVisible } from "./publication";
import { catalogRedirectTarget } from "./redirects";
import { type CatalogNode, type CatalogTree, ancestorsOf, nodeLabel } from "./tree";

/**
 * The steps of the trail from the roof-racks shelf down to one vehicle: make, model, generation.
 *
 * One function for the vehicle's own page and for a product made for that vehicle, so the two say the
 * same words and lead to the same pages. Before it, the listing wrote "BMW > 5-Rad Touring > G61" from
 * the page's navigation names while the product under it went "Domov > Nordrive strešné nosiče > <the
 * whole name>": the shopper who opened a set lost the way back to their car.
 *
 * Pure: the caller decides what an address is and which pages may be linked.
 */

export type TrailStep = {
	readonly label: string;
	/** Absent on the page the trail is drawn on, and on a step whose page this application would refuse to serve. */
	readonly href?: string;
};

export type VehicleTrailOptions = {
	/** The address of a vehicle's page in this market. */
	hrefOf: (node: CatalogNode) => string;
	/** False for a page that is withheld or retired: its step keeps its place and loses its link. */
	linkable: (node: CatalogNode) => boolean;
	/** "od 2024" / "2009 – 2015", in the market's words. */
	years: (from: number, to: number | null) => string;
	/** The vehicle itself is a link (a product's trail ends below it) or the current page (its own page's trail). */
	linkLast: boolean;
};

/**
 * The address of a vehicle's page in a market: the market's own spelling of the path, not a 301 to it. A
 * node with no page in this language carries the fitment dataset's Slovak path.
 */
export function vehiclePageAddress(channel: string, node: CatalogNode): string {
	return marketHref(channel, canonicalCatalogPath(REVERSE_MAP[channel] ?? channel, node.urlPath));
}

/**
 * May a step be a link? Not when its page is withheld, and not when CFM retired it into a redirect: the
 * step keeps its place (dropping it would misdescribe where the page sits) and is plain text.
 */
export function vehiclePageLinkable(channel: string, node: CatalogNode): boolean {
	if (node.page && !isPubliclyVisible(node.page)) return false;
	return !catalogRedirectTarget(REVERSE_MAP[channel] ?? channel, node.urlPath);
}

const HAS_YEAR = /\b(?:19|20)\d{2}\b/;

/**
 * A step's words. A generation says when it was made — "G61 (od 2024)" — unless its name already does:
 * the export writes some generations with their years ("JY (2013 – 2021)") and most without ("G61"),
 * and a trail that says it for some cars only would read as if the others had none.
 */
export function vehicleStepLabel(node: CatalogNode, years: VehicleTrailOptions["years"]): string {
	const label = nodeLabel(node);
	if (node.kind !== "generation" || node.productionYearFrom === undefined) return label;
	if (HAS_YEAR.test(label)) return label;
	return `${label} (${years(node.productionYearFrom, node.productionYearTo ?? null)})`;
}

export function vehicleTrailSteps(
	tree: CatalogTree,
	node: CatalogNode,
	options: VehicleTrailOptions,
): TrailStep[] {
	const chain = [...ancestorsOf(tree, node), node];
	return chain.map((step, index) => {
		const label = vehicleStepLabel(step, options.years);
		const isLast = index === chain.length - 1;
		if (isLast && !options.linkLast) return { label };
		return options.linkable(step) ? { label, href: options.hrefOf(step) } : { label };
	});
}

/**
 * The deepest vehicle page that all of these vehicles stand under: the generation itself when there is
 * one, the model when they are generations of one model, the make when they are models of one make.
 * `null` when the ids share no make, or when none of them is in the tree.
 *
 * It is what a product made for several vehicles may truthfully be filed under. Choosing one of them
 * would put the product on a path that is the same for every visitor and still wrong for the others, and
 * which one came first in an export is not a fact about the product.
 */
export function commonVehicleNode(tree: CatalogTree, vehicleIds: readonly string[]): CatalogNode | null {
	const chains: CatalogNode[][] = [];
	for (const id of new Set(vehicleIds)) {
		const node = tree.byVehicleId.get(id);
		if (!node) continue;
		chains.push([...ancestorsOf(tree, node), node]);
	}
	const [first, ...rest] = chains;
	if (!first) return null;

	let common: CatalogNode | null = null;
	for (let depth = 0; depth < first.length; depth += 1) {
		const candidate = first[depth]!;
		if (!rest.every((chain) => chain[depth]?.vehicleId === candidate.vehicleId)) break;
		common = candidate;
	}
	return common;
}
