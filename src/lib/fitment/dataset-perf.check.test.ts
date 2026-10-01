import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { canonicalJson, datasetHashFromText } from "./dataset-hash";
import { resolveVehicleOutcome } from "./resolve";
import { validateFitmentDataset } from "./validate";
import type { FitmentDataset, VehicleSelection } from "./contract";

/**
 * What a 16 MB fitment dataset costs this build — measured, not estimated.
 *
 * Skipped unless `M_PERF_DATASET` names a file, because it reads 16 MB and times things:
 * `pnpm test` must not depend on either. Output goes to `M_PERF_OUT` (JSON) so that the
 * numbers in a hand-over are a file somebody can re-run, not a sentence.
 *
 * It times the phases a cold load pays for on the process's event loop, one by one — plain
 * parse, the hash's own parse (it re-reads the numbers' source tokens), canonicalisation,
 * SHA-256, the structural validation — and then what a SHOPPER pays: one vehicle resolved
 * against the whole dataset, over every generation that has an application. The time CFM's
 * export takes, and the time a batch check takes there, are a different question.
 */
const PATH = process.env.M_PERF_DATASET?.trim();
const OUT = process.env.M_PERF_OUT?.trim();

const ms = (from: bigint) => Number(process.hrtime.bigint() - from) / 1e6;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const p = (values: number[], q: number) =>
	[...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;

describe.skipIf(!PATH)("the cost of the full dataset on this build", () => {
	it("measures each phase of a cold load, and one vehicle's resolution", () => {
		const metrics: Record<string, unknown> = {};
		const heap0 = process.memoryUsage();

		let t = process.hrtime.bigint();
		const raw = readFileSync(PATH as string);
		metrics.readMs = ms(t);
		metrics.bytes = raw.length;

		t = process.hrtime.bigint();
		const text = raw.toString("utf8");
		metrics.decodeMs = ms(t);

		t = process.hrtime.bigint();
		const transport = createHash("sha256").update(raw).digest("hex");
		metrics.transportSha256Ms = ms(t);
		metrics.transportSha256 = transport;

		t = process.hrtime.bigint();
		const parsed = JSON.parse(text) as FitmentDataset;
		metrics.plainParseMs = ms(t);

		// The hash, in its steps, so the slow one is named.
		t = process.hrtime.bigint();
		const hash = datasetHashFromText(text);
		metrics.datasetHashWholeMs = ms(t);
		metrics.datasetHash = hash;

		t = process.hrtime.bigint();
		const canonical = canonicalJson(parsed);
		metrics.canonicalJsonMs = ms(t);
		metrics.canonicalChars = canonical.length;

		t = process.hrtime.bigint();
		const validation = validateFitmentDataset(parsed, {
			expectedSaleorInstance: "api.maky.store",
			rawText: text,
		});
		metrics.validateWholeMs = ms(t);
		expect(validation.ok).toBe(true);
		if (!validation.ok) return;
		metrics.warnings = validation.warnings.length;
		if (OUT) writeFileSync(`${OUT}.warnings.json`, JSON.stringify(validation.warnings, null, 1));

		const heap1 = process.memoryUsage();
		metrics.heapUsedDeltaMB = Math.round((heap1.heapUsed - heap0.heapUsed) / 1048576);
		metrics.rssDeltaMB = Math.round((heap1.rss - heap0.rss) / 1048576);

		const dataset = validation.dataset;

		// ---- one vehicle, whole dataset -------------------------------------------------
		// Every (generation, year, roof) a shopper could confirm: the first year of each
		// application's window and each roof the application names. That is the set of
		// selections the selector can actually produce, and it is large enough to show a
		// tail.
		const selections: VehicleSelection[] = [];
		const generationById = new Map(dataset.generations.map((g) => [g.id, g]));
		const modelById = new Map(dataset.models.map((m) => [m.id, m]));
		const seen = new Set<string>();
		for (const application of dataset.applications) {
			const generation = generationById.get(application.generationId);
			if (!generation) continue;
			const model = modelById.get(generation.modelId);
			if (!model) continue;
			const roofs = application.qualifiers.roofTypes ?? [undefined];
			for (const roofType of roofs) {
				const key = `${generation.id}|${application.window.from.year}|${roofType ?? ""}`;
				if (seen.has(key)) continue;
				seen.add(key);
				selections.push({
					makeId: model.makeId,
					modelId: model.id,
					generationId: generation.id,
					year: application.window.from.year,
					roofType,
					bodyType: application.qualifiers.bodyTypes?.[0],
				});
			}
		}
		metrics.selections = selections.length;

		// Warm the JIT the way a running server is warm, then time.
		for (const s of selections.slice(0, 200)) resolveVehicleOutcome(dataset, s);
		const samples: number[] = [];
		let worst = { ms: 0, candidates: 0, generationId: "" };
		for (const s of selections) {
			const start = process.hrtime.bigint();
			const outcome = resolveVehicleOutcome(dataset, s);
			const took = ms(start);
			samples.push(took);
			if (took > worst.ms) {
				worst = {
					ms: took,
					candidates: outcome.verified.length + outcome.unconfirmed.length + outcome.rejected.length,
					generationId: s.generationId,
				};
			}
		}
		metrics.resolveVehicleOutcomeMs = {
			n: samples.length,
			median: median(samples),
			p95: p(samples, 0.95),
			p99: p(samples, 0.99),
			max: worst.ms,
			worstCandidates: worst.candidates,
		};

		const summary = JSON.stringify(metrics, null, 2);
		if (OUT) writeFileSync(OUT, summary);
		console.log(summary);
	}, 120_000);
});
