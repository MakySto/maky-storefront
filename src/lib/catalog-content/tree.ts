import { type FitmentApplication, type FitmentDataset } from "@/lib/fitment/contract";
import { type CatalogContentPage, type CatalogContentSnapshot } from "./contract";

/**
 * The vehicle tree the category pages navigate, joined to their editorial content.
 *
 * ## The join is `vehicleId`, and only `vehicleId`
 *
 * `publicId` identifies the PAGE; `vehicleId` identifies the VEHICLE. Joining the two
 * artifacts on `urlPath` looks correct today — measured: 0 mismatches across all 1 475 —
 * and comes apart the first time a slug is renamed, silently, which is the whole reason
 * CFM keeps a URL history. Measured on the 2026-09-11 pair: 1 475 fitment nodes, 1 475
 * content pages, 1 475 joined, 0 orphans on either side.
 *
 * ## Parents come from the tree, not from the URL
 *
 * `models[].makeId` and `generations[].modelId` are real identities. Slicing a segment off
 * `urlPath` happens to give the same answer — measured: agrees on 1 413, disagrees on 0 —
 * but it is a guess that a renamed or nested slug would break. The identity is used, and
 * the URL is only ever read from the artifacts, never rebuilt with `slugify(name)`.
 */

export type CatalogNodeKind = "make" | "model" | "generation";

export interface CatalogNode {
	readonly vehicleId: string;
	readonly kind: CatalogNodeKind;
	readonly name: string;
	/** Language-agnostic, no market prefix. Taken from the artifacts, never derived. */
	readonly urlPath: string;
	readonly parentId: string | null;
	/** Absent when the vehicle has a fitment node but no content page. */
	readonly page: CatalogContentPage | null;
	readonly productionYearFrom?: number;
	readonly productionYearTo?: number | null;
}

export interface CatalogTree {
	readonly byUrlPath: ReadonlyMap<string, CatalogNode>;
	readonly byVehicleId: ReadonlyMap<string, CatalogNode>;
	readonly childrenOf: ReadonlyMap<string, readonly CatalogNode[]>;
	readonly applicationsOf: ReadonlyMap<string, readonly FitmentApplication[]>;
	readonly makes: readonly CatalogNode[];
	/** Vehicles the fitment tree knows that have no content page, and the reverse. */
	readonly stats: {
		readonly nodes: number;
		readonly pages: number;
		readonly joined: number;
		readonly nodesWithoutPage: number;
		readonly pagesWithoutNode: number;
	};
}

/** The routing fields 3.0.0 actually carries; the shared type predates them. */
type Routed = { readonly slug?: string; readonly urlPath?: string };

function ancestorSort(a: CatalogNode, b: CatalogNode): number {
	return a.name.localeCompare(b.name, "sk");
}

export function buildCatalogTree(
	snapshot: CatalogContentSnapshot,
	dataset: FitmentDataset | null,
): CatalogTree {
	const pageByVehicleId = new Map<string, CatalogContentPage>();
	for (const page of snapshot.pages) if (page.vehicleId) pageByVehicleId.set(page.vehicleId, page);

	const byVehicleId = new Map<string, CatalogNode>();
	const add = (node: CatalogNode) => {
		// A node with neither its own urlPath nor a page's is unroutable; skipping it is
		// better than inventing a path for it.
		if (node.urlPath) byVehicleId.set(node.vehicleId, node);
	};

	const pathOf = (fitment: Routed, page: CatalogContentPage | null): string =>
		page?.urlPath ?? fitment.urlPath ?? "";

	for (const make of dataset?.makes ?? []) {
		const page = pageByVehicleId.get(make.id) ?? null;
		add({
			vehicleId: make.id,
			kind: "make",
			name: page?.navName ?? make.name,
			urlPath: pathOf(make as Routed, page),
			parentId: null,
			page,
		});
	}
	for (const model of dataset?.models ?? []) {
		const page = pageByVehicleId.get(model.id) ?? null;
		add({
			vehicleId: model.id,
			kind: "model",
			name: page?.navName ?? model.name,
			urlPath: pathOf(model as Routed, page),
			parentId: model.makeId,
			page,
		});
	}
	for (const generation of dataset?.generations ?? []) {
		const page = pageByVehicleId.get(generation.id) ?? null;
		add({
			vehicleId: generation.id,
			kind: "generation",
			name: page?.navName ?? generation.name,
			urlPath: pathOf(generation as Routed, page),
			parentId: generation.modelId,
			page,
			productionYearFrom: generation.productionYearFrom,
			productionYearTo: generation.productionYearTo,
		});
	}

	const byUrlPath = new Map<string, CatalogNode>();
	const childrenOf = new Map<string, CatalogNode[]>();
	for (const node of byVehicleId.values()) {
		byUrlPath.set(node.urlPath, node);
		if (node.parentId) {
			const siblings = childrenOf.get(node.parentId);
			if (siblings) siblings.push(node);
			else childrenOf.set(node.parentId, [node]);
		}
	}
	for (const siblings of childrenOf.values()) siblings.sort(ancestorSort);

	const applicationsOf = new Map<string, FitmentApplication[]>();
	for (const application of dataset?.applications ?? []) {
		const list = applicationsOf.get(application.generationId);
		if (list) list.push(application);
		else applicationsOf.set(application.generationId, [application]);
	}

	const makes = [...byVehicleId.values()].filter((node) => node.kind === "make").sort(ancestorSort);
	const joined = [...byVehicleId.values()].filter((node) => node.page !== null).length;

	return {
		byUrlPath,
		byVehicleId,
		childrenOf,
		applicationsOf,
		makes,
		stats: {
			nodes: byVehicleId.size,
			pages: snapshot.pages.length,
			joined,
			nodesWithoutPage: byVehicleId.size - joined,
			pagesWithoutNode: snapshot.pages.filter((page) => !page.vehicleId || !byVehicleId.has(page.vehicleId))
				.length,
		},
	};
}

/** Make -> model -> generation, nearest last. Used for breadcrumbs. */
export function ancestorsOf(tree: CatalogTree, node: CatalogNode): readonly CatalogNode[] {
	const chain: CatalogNode[] = [];
	let current: CatalogNode | undefined = node;
	const seen = new Set<string>();
	while (current?.parentId && !seen.has(current.parentId)) {
		seen.add(current.parentId);
		current = tree.byVehicleId.get(current.parentId);
		if (current) chain.unshift(current);
	}
	return chain;
}
