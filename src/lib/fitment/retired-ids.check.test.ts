import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "./contract";
import { generationFate, modelFate, retiredIdCounts } from "./retired-ids";
import { validateFitmentDataset } from "./validate";

/**
 * M's acceptance of the map of retired vehicle ids in a NEW CFM dataset, against the one production
 * serves — run with this build's own modules, so the answer is what the running code would believe.
 *
 *   M_DELTA_OLD=<live.json> M_DELTA_NEW=<new.json> npx vitest run src/lib/fitment/retired-ids.check.test.ts
 *
 * Skipped without both paths (the default suite does not read 20 MB files). What it proves, and what
 * "ready to approve" means for the merge of duplicate generations:
 *
 *   1. the new dataset is valid and carries the map;
 *   2. the storefront believes every entry of it (nothing dropped as wrong);
 *   3. no vehicle id the live dataset holds disappears unexplained — a shopper's saved car can always
 *      be led to a live generation (or to a choice between them), never to "select again";
 *   4. no set the live dataset offers for a merged-away generation is lost: it is also offered, in the
 *      new dataset, for the generation the map leads to (one the new dataset carries nowhere at all is
 *      reported apart in the log, but fails too: the shopper loses it either way).
 */
const OLD_PATH = process.env.M_DELTA_OLD?.trim();
const NEW_PATH = process.env.M_DELTA_NEW?.trim();
const available = Boolean(OLD_PATH && NEW_PATH);
const SALEOR = "api.maky.store";

function load(path: string): FitmentDataset {
	const text = readFileSync(path, "utf8");
	const raw: unknown = JSON.parse(text);
	const result = validateFitmentDataset(raw, { expectedSaleorInstance: SALEOR, rawText: text });
	if (!result.ok) throw new Error(`${path} does not validate: ${result.errors.slice(0, 3).join("; ")}`);
	return result.dataset;
}

describe.skipIf(!available)("the map of retired vehicle ids in the new dataset", () => {
	const oldDataset = available ? load(OLD_PATH!) : (undefined as never);
	const newDataset = available ? load(NEW_PATH!) : (undefined as never);

	const newGenerations = () => new Set(newDataset.generations.map((g) => g.id));
	const newModels = () => new Set(newDataset.models.map((m) => m.id));

	it("is present, and the storefront believes every entry of it", () => {
		expect(newDataset.retiredVehicleIds).toBeDefined();
		const counts = retiredIdCounts(newDataset);
		console.log("retired ids believed:", counts);
		expect(counts.dropped).toBe(0);
		expect(counts.moved + counts.split + counts.models).toBeGreaterThan(0);
	});

	it("explains every generation the live dataset holds and the new one does not", () => {
		const live = newGenerations();
		const unexplained = oldDataset.generations
			.filter((g) => !live.has(g.id))
			.filter((g) => generationFate(newDataset, g.id).kind === "gone")
			.map((g) => g.id);
		console.log(
			"generations leaving:",
			oldDataset.generations.filter((g) => !live.has(g.id)).length,
			"unexplained:",
			unexplained.length,
		);
		expect(unexplained).toEqual([]);
	});

	it("explains every model the live dataset holds and the new one does not", () => {
		const live = newModels();
		const unexplained = oldDataset.models
			.filter((m) => !live.has(m.id))
			.filter((m) => modelFate(newDataset, m.id).kind === "gone")
			.map((m) => m.id);
		expect(unexplained).toEqual([]);
	});

	it("leads every merged generation to a generation of the same make", () => {
		const makeOf = (dataset: FitmentDataset, generationId: string) => {
			const generation = dataset.generations.find((g) => g.id === generationId);
			return dataset.models.find((m) => m.id === generation?.modelId)?.makeId;
		};
		const wrong: string[] = [];
		for (const old of oldDataset.generations) {
			const fate = generationFate(newDataset, old.id);
			if (fate.kind === "live") continue;
			const targets = fate.kind === "moved" ? [fate.to] : fate.kind === "split" ? fate.candidates : [];
			for (const target of targets) {
				if (makeOf(newDataset, target) !== makeOf(oldDataset, old.id)) wrong.push(`${old.id} -> ${target}`);
			}
		}
		expect(wrong).toEqual([]);
	});

	it("keeps every set that hung on a merged-away generation on the generation it moved to", () => {
		const positive = (dataset: FitmentDataset) => dataset.applications.filter((a) => !a.negative);
		const setsOf = (dataset: FitmentDataset) => {
			const byGeneration = new Map<string, Set<string>>();
			for (const application of positive(dataset)) {
				const sets = byGeneration.get(application.generationId) ?? new Set<string>();
				for (const product of application.products) sets.add(product.saleorProductId);
				byGeneration.set(application.generationId, sets);
			}
			return byGeneration;
		};
		const before = setsOf(oldDataset);
		const after = setsOf(newDataset);
		const offeredAnywhere = new Set(
			positive(newDataset).flatMap((a) => a.products.map((p) => p.saleorProductId)),
		);
		const lost: string[] = [];
		let nowhere = 0;
		for (const old of oldDataset.generations) {
			const fate = generationFate(newDataset, old.id);
			if (fate.kind === "live" || fate.kind === "gone") continue;
			const targets = fate.kind === "moved" ? [fate.to] : fate.candidates;
			for (const product of before.get(old.id) ?? []) {
				if (targets.some((target) => after.get(target)?.has(product))) continue;
				lost.push(`${old.id} ${product}`);
				if (!offeredAnywhere.has(product)) nowhere += 1;
			}
		}
		console.log(
			"sets lost in the merge:",
			lost.length,
			"of which offered nowhere in the new dataset:",
			nowhere,
		);
		expect(lost).toEqual([]);
	});
});
