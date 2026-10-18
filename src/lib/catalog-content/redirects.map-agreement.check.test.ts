import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { generationFate, modelFate } from "@/lib/fitment/retired-ids";
import { validateFitmentDataset } from "@/lib/fitment/validate";
import { CATALOG_REDIRECTS } from "./redirects";

/**
 * M's acceptance of the retired-page redirects against the map CFM ships in a NEW dataset.
 *
 *   M_DELTA_OLD=<live.json> M_DELTA_NEW=<new.json> [M_DELTA_CONTENT=<live Slovak content.json>] \
 *     npx vitest run src/lib/catalog-content/redirects.map-agreement.check.test.ts
 *
 * Skipped without the two datasets. For every Slovak entry of `redirects.json` (the other languages
 * spell the same pages in their own root, so the Slovak ones stand for all) it joins the OLD address
 * to a vehicle id of the live dataset, asks what the new dataset says became of that id, and compares
 * the answer with the address the redirect sends the visitor to:
 *
 *   - an old address no live vehicle ever had (its car was never in a published dataset) is reported:
 *     the redirect has nothing to guard and should leave the table;
 *   - an old address whose car is STILL live in the new dataset is a failure: the redirect would hide
 *     a page that works;
 *   - an old address whose car the map sends somewhere other than the redirect target is a failure;
 *   - a target the new dataset has no vehicle at is a failure (a redirect into a 404).
 *
 * The join is the vehicle node's own `urlPath` when the dataset carries one, and otherwise the live
 * content export's page (`urlPath` -> `vehicleId`), which is what `M_DELTA_CONTENT` is for. A target
 * is also accepted one level up (model or brand), which is where the redirects go when the surviving
 * vehicle has no page of its own.
 */
const OLD_PATH = process.env.M_DELTA_OLD?.trim();
const NEW_PATH = process.env.M_DELTA_NEW?.trim();
const CONTENT_PATH = process.env.M_DELTA_CONTENT?.trim();
const available = Boolean(OLD_PATH && NEW_PATH);

function load(path: string): FitmentDataset {
	const text = readFileSync(path, "utf8");
	const raw: unknown = JSON.parse(text);
	const result = validateFitmentDataset(raw, { expectedSaleorInstance: "api.maky.store", rawText: text });
	if (!result.ok) throw new Error(`${path} does not validate: ${result.errors.slice(0, 3).join("; ")}`);
	return result.dataset;
}

type Node = { id: string; urlPath?: string };
const nodesOf = (dataset: FitmentDataset): Node[] => [
	...dataset.makes,
	...dataset.models,
	...dataset.generations,
];

/** Path -> vehicle id, from the dataset's own routing fields and, when given, a content export. */
function pathIndex(dataset: FitmentDataset, contentPath: string | undefined): Map<string, string> {
	const index = new Map<string, string>();
	for (const node of nodesOf(dataset)) if (node.urlPath) index.set(node.urlPath, node.id);
	if (contentPath) {
		const pages = (
			JSON.parse(readFileSync(contentPath, "utf8")) as { pages?: { urlPath?: string; vehicleId?: string }[] }
		).pages;
		for (const page of pages ?? [])
			if (page.urlPath && page.vehicleId) index.set(page.urlPath, page.vehicleId);
	}
	return index;
}

/**
 * Older entries from RELEASE-4 (2026-09-15) that this check is not about. Their cars are still live
 * in the datasets of 2026-10-14 and 2026-10-18, so the "still live" test below would fail on them for
 * a reason that predates the merge of duplicate generations; they are listed in the output instead.
 */
const EARLIER_ENTRIES = new Set([
	"/stresne-nosice/subaru/legacy-kombi/bp",
	"/stresne-nosice/hyundai/h-1-van/tq",
]);

/** The path of a vehicle, or of its nearest ancestor that has one: a surviving car with no page of its own is reached through its model or brand. */
function nearestPath(dataset: FitmentDataset, index: Map<string, string>, id: string): string | undefined {
	const pathOf = new Map<string, string>();
	for (const [path, vehicleId] of index) pathOf.set(vehicleId, path);
	const parent = new Map<string, string>();
	for (const g of dataset.generations) parent.set(g.id, g.modelId);
	for (const m of dataset.models) parent.set(m.id, m.makeId);
	for (
		let current: string | undefined = id, hops = 0;
		current && hops < 4;
		current = parent.get(current), hops += 1
	) {
		const path = pathOf.get(current);
		if (path) return path;
	}
	return undefined;
}

describe.skipIf(!available)("the retired-page redirects against the map of the new dataset", () => {
	const oldDataset = available ? load(OLD_PATH!) : (undefined as never);
	const newDataset = available ? load(NEW_PATH!) : (undefined as never);
	const oldIndex = available ? pathIndex(oldDataset, CONTENT_PATH) : new Map<string, string>();
	const newIndex = available ? pathIndex(newDataset, undefined) : new Map<string, string>();
	const newIds = new Set(nodesOf(newDataset ?? { makes: [], models: [], generations: [] }).map((n) => n.id));

	it("joins to the live dataset, and agrees with the map on where each address goes", () => {
		const rows: string[] = [];
		const problems: string[] = [];
		const neverPublished: string[] = [];
		for (const [from, to] of Object.entries(CATALOG_REDIRECTS.exact.sk ?? {})) {
			if (EARLIER_ENTRIES.has(from)) {
				rows.push(`${from} -> ${to}: earlier entry (RELEASE-4), not checked here`);
				continue;
			}
			const id = oldIndex.get(from);
			if (!id) {
				neverPublished.push(from);
				rows.push(`${from} -> ${to}: no live vehicle has this address`);
				continue;
			}
			const kind = id.startsWith("veh:md:") ? "model" : "generation";
			const fate = kind === "model" ? modelFate(newDataset, id) : generationFate(newDataset, id);
			const targetId = newIndex.get(to);
			if (!targetId) problems.push(`${from} -> ${to}: the new dataset has no vehicle at the target`);
			if (fate.kind === "live") {
				problems.push(
					`${from}: the car is still live in the new dataset, the redirect would hide a working page`,
				);
			} else if (fate.kind === "gone") {
				problems.push(`${from}: the map says nothing about ${id}`);
			} else if (fate.kind === "moved") {
				const successorPath = nearestPath(newDataset, newIndex, fate.to);
				const ok = successorPath === to;
				rows.push(
					`${from} -> ${to}: map -> ${fate.to.slice(-8)} reached at ${successorPath ?? "nothing"} ${
						ok ? "ok" : "DIFFERENT"
					}`,
				);
				if (!ok)
					problems.push(
						`${from}: redirect goes to ${to}, the map leads to ${successorPath ?? "a car with no address"}`,
					);
			} else {
				rows.push(`${from} -> ${to}: split into ${fate.candidates.length} candidates`);
			}
		}
		console.log(rows.join("\n"));
		console.log("addresses no live vehicle has:", neverPublished.length, "new ids known:", newIds.size);
		expect(problems).toEqual([]);
	});
});
