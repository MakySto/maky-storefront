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
				const successorPath = [...newIndex].find(([, vehicleId]) => vehicleId === fate.to)?.[0];
				const ok = successorPath === to || (successorPath ? successorPath.startsWith(`${to}/`) : false);
				rows.push(`${from} -> ${to}: map -> ${successorPath ?? fate.to} ${ok ? "ok" : "DIFFERENT"}`);
				if (!ok && successorPath)
					problems.push(`${from}: redirect goes to ${to}, the map to ${successorPath}`);
			} else {
				rows.push(`${from} -> ${to}: split into ${fate.candidates.length} candidates`);
			}
		}
		console.log(rows.join("\n"));
		console.log("addresses no live vehicle has:", neverPublished.length, "new ids known:", newIds.size);
		expect(problems).toEqual([]);
	});
});
