import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import { datasetHashFromText, datasetHashFromValue, transportChecksum } from "./dataset-hash";
import { validateFitmentDataset } from "./validate";
import { isDatasetStale, resolveFitment, resolveVehicleOutcome, type VehicleOutcome } from "./resolve";
import {
	monthDecidesFor,
	resolveGenerationForYear,
	resolveSingleValued,
	roofChoicesFor,
	yearsForModel,
} from "./selector-plan";
import { type FitmentDataset, type VehicleSelection } from "./contract";

/**
 * M's acceptance of a new CFM dataset against the one production serves — run with this
 * build's own modules, so the answer is what the running code would say.
 *
 *   M_DELTA_OLD=<live.json> M_DELTA_NEW=<new.json> M_DELTA_OUT=<report.json> \
 *     npx vitest run src/lib/fitment/dataset-delta.check.test.ts
 *
 * Skipped without the three paths.
 */
const OLD_PATH = process.env.M_DELTA_OLD?.trim();
const NEW_PATH = process.env.M_DELTA_NEW?.trim();
const OUT_PATH = process.env.M_DELTA_OUT?.trim();
const SALEOR = "api.maky.store";
const available = Boolean(OLD_PATH && NEW_PATH && OUT_PATH);
const NOW = Date.now();

type Loaded = {
	bytes: number;
	transport: string;
	declared: string;
	fromText: string;
	fromValue: string;
	ok: boolean;
	errors: string[];
	warnings: string[];
	parseMs: number;
	validateMs: number;
	dataset: FitmentDataset;
	raw: any;
};

function load(path: string): Loaded {
	const buf = readFileSync(path);
	const t0 = performance.now();
	const text = buf.toString("utf8");
	const raw: any = JSON.parse(text);
	const t1 = performance.now();
	const v = validateFitmentDataset(raw, { expectedSaleorInstance: SALEOR, rawText: text });
	const t2 = performance.now();
	return {
		bytes: buf.length,
		transport: transportChecksum(buf),
		declared: raw.datasetHash,
		fromText: datasetHashFromText(text),
		fromValue: datasetHashFromValue(raw),
		ok: v.ok,
		errors: v.ok ? [] : v.errors,
		warnings: v.ok ? v.warnings : [],
		parseMs: Math.round(t1 - t0),
		validateMs: Math.round(t2 - t1),
		dataset: (v.ok ? v.dataset : raw) as FitmentDataset,
		raw,
	};
}

let cache: { old: Loaded; neu: Loaded } | null = null;
function both() {
	if (!cache) cache = { old: load(OLD_PATH as string), neu: load(NEW_PATH as string) };
	return cache;
}

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));
const json = (v: unknown) => JSON.stringify(v);

function diffEntities<T extends { id: string }>(oldItems: T[], newItems: T[]) {
	const o = byId(oldItems);
	const n = byId(newItems);
	const added = [...n.keys()].filter((k) => !o.has(k));
	const removed = [...o.keys()].filter((k) => !n.has(k));
	const changed: { id: string; fields: Record<string, { old: unknown; new: unknown }> }[] = [];
	for (const [id, before] of o) {
		const after = n.get(id);
		if (!after || json(before) === json(after)) continue;
		const fields: Record<string, { old: unknown; new: unknown }> = {};
		for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
			const a = (before as Record<string, unknown>)[key];
			const b = (after as Record<string, unknown>)[key];
			if (json(a) !== json(b)) fields[key] = { old: a, new: b };
		}
		changed.push({ id, fields });
	}
	return { added, removed, changed };
}

function sliceByGeneration(ds: FitmentDataset) {
	const map = new Map<string, FitmentDataset>();
	const apps = new Map<string, FitmentDataset["applications"]>();
	for (const a of ds.applications) {
		const list = apps.get(a.generationId) ?? [];
		list.push(a);
		apps.set(a.generationId, list);
	}
	for (const g of ds.generations) map.set(g.id, { ...ds, applications: apps.get(g.id) ?? [] });
	return (generationId: string) => map.get(generationId) ?? { ...ds, applications: [] };
}

function outcomeKey(o: VehicleOutcome) {
	return {
		unanswerable: o.unanswerable,
		verdict: o.unanswerableVerdict,
		verified: o.verified.map((x) => x.ref.saleorProductId).sort(),
		unconfirmed: o.unconfirmed.map((x) => `${x.ref.saleorProductId}:${x.result.verdict}`).sort(),
		rejected: o.rejected.map((x) => x.ref.saleorProductId).sort(),
	};
}

const openEnd = () => new Date().getUTCFullYear() + 1;

function candidateOf(g: FitmentDataset["generations"][number]) {
	return { id: g.id, roofTypes: g.qualifiers?.roofTypes?.length ? g.qualifiers.roofTypes : null };
}

function qualifierVariants<T>(values: T[] | null | undefined): (T | undefined)[] {
	const r = resolveSingleValued(values);
	if (r.ask) return r.ask;
	return [r.fill ?? undefined];
}

describe.skipIf(!available)("M dataset delta", () => {
	it("computes and writes the report", () => {
		const { old, neu } = both();
		const report: Record<string, unknown> = {};

		report.artefact = Object.fromEntries(
			(
				[
					["old", old],
					["new", neu],
				] as const
			).map(([k, l]) => [
				k,
				{
					bytes: l.bytes,
					transport: l.transport,
					datasetVersion: l.raw.datasetVersion,
					schemaVersion: l.raw.schemaVersion,
					saleorInstance: l.raw.saleorInstance,
					generatedAt: l.raw.generatedAt,
					validity: l.raw.validity,
					coverage: l.raw.coverage,
					source: l.raw.source,
					accounting: l.raw.accounting,
					declaredHash: l.declared,
					recomputedFromText: l.fromText,
					recomputedFromValue: l.fromValue,
					validatorOk: l.ok,
					validatorErrors: l.errors,
					warningCount: l.warnings.length,
					parseMs: l.parseMs,
					validateMs: l.validateMs,
					staleNow: l.ok ? isDatasetStale(l.dataset, NOW) : null,
					counts: {
						makes: l.raw.makes.length,
						models: l.raw.models.length,
						generations: l.raw.generations.length,
						applications: l.raw.applications.length,
						distinctProducts: new Set(
							l.raw.applications.flatMap((a: { products: { saleorProductId: string }[] }) =>
								a.products.map((p) => p.saleorProductId),
							),
						).size,
					},
				},
			]),
		);
		const oldWarn = new Set(old.warnings);
		report.warningsOnlyInNew = neu.warnings.filter((w) => !oldWarn.has(w));
		report.warningsOnlyInOld = old.warnings.filter((w) => !new Set(neu.warnings).has(w));

		expect(old.ok).toBe(true);
		expect(neu.ok).toBe(true);

		const O = old.dataset;
		const N = neu.dataset;

		report.makes = diffEntities(O.makes, N.makes);
		report.models = diffEntities(O.models, N.models);
		report.generations = diffEntities(O.generations, N.generations);
		const appDiff = diffEntities(
			O.applications.map((a) => ({ ...a, id: a.applicationId })),
			N.applications.map((a) => ({ ...a, id: a.applicationId })),
		);
		report.applications = {
			added: appDiff.added,
			removed: appDiff.removed,
			changed: appDiff.changed.map((c) => ({ id: c.id, fields: Object.keys(c.fields) })),
		};

		// Product → the applications naming it, old vs new.
		const refIndex = (ds: FitmentDataset) => {
			const m = new Map<string, string[]>();
			for (const a of ds.applications)
				for (const p of a.products)
					m.set(p.saleorProductId, [...(m.get(p.saleorProductId) ?? []), a.applicationId]);
			return m;
		};
		const oRefs = refIndex(O);
		const nRefs = refIndex(N);
		report.productsOnlyInNew = [...nRefs.keys()].filter((k) => !oRefs.has(k));
		report.productsOnlyInOld = [...oRefs.keys()].filter((k) => !nRefs.has(k));
		report.productsWithChangedApplications = [...oRefs.keys()].filter(
			(k) => nRefs.has(k) && json(oRefs.get(k)!.sort()) !== json(nRefs.get(k)!.sort()),
		);

		// --- The selector, for every model the live dataset has. ---
		const oGensByModel = new Map<string, FitmentDataset["generations"]>();
		for (const g of O.generations) oGensByModel.set(g.modelId, [...(oGensByModel.get(g.modelId) ?? []), g]);
		const nGensByModel = new Map<string, FitmentDataset["generations"]>();
		for (const g of N.generations) nGensByModel.set(g.modelId, [...(nGensByModel.get(g.modelId) ?? []), g]);

		const selectorChanges: unknown[] = [];
		for (const model of O.models) {
			const og = oGensByModel.get(model.id) ?? [];
			const ng = nGensByModel.get(model.id) ?? [];
			const oy = yearsForModel(og);
			const ny = yearsForModel(ng);
			if (json(oy) !== json(ny))
				selectorChanges.push({ model: model.id, name: model.name, kind: "years", old: oy, new: ny });
			for (const y of new Set([...oy, ...ny])) {
				const a = resolveGenerationForYear(og, y);
				const b = resolveGenerationForYear(ng, y);
				const ka =
					a.kind === "resolved"
						? [a.generation.id]
						: a.kind === "ambiguous"
							? a.candidates.map((c) => c.id)
							: [];
				const kb =
					b.kind === "resolved"
						? [b.generation.id]
						: b.kind === "ambiguous"
							? b.candidates.map((c) => c.id)
							: [];
				if (a.kind !== b.kind || json(ka) !== json(kb))
					selectorChanges.push({
						model: model.id,
						name: model.name,
						year: y,
						old: { kind: a.kind, ids: ka },
						new: { kind: b.kind, ids: kb },
					});
			}
		}
		report.selectorChangesForLiveModels = selectorChanges;

		const roofChanges: unknown[] = [];
		const qualifierChanges: unknown[] = [];
		const oGen = byId(O.generations);
		const nGen = byId(N.generations);
		for (const [id, g] of oGen) {
			const h = nGen.get(id);
			if (!h) continue;
			const ro = roofChoicesFor(O.applications, candidateOf(g));
			const rn = roofChoicesFor(N.applications, candidateOf(h));
			if (json([...ro].sort()) !== json([...rn].sort()))
				roofChanges.push({ generation: id, name: g.name, old: ro, new: rn });
			if (json(g.qualifiers ?? null) !== json(h.qualifiers ?? null))
				qualifierChanges.push({ generation: id, name: g.name, old: g.qualifiers, new: h.qualifiers });
		}
		report.roofChoiceChangesForLiveGenerations = roofChanges;
		report.generationQualifierChanges = qualifierChanges;

		// --- Every selection a shopper can have saved under the live dataset. ---
		const oSlice = sliceByGeneration(O);
		const nSlice = sliceByGeneration(N);
		const modelById = byId(O.models);
		const thuleIds = new Set(report.productsOnlyInNew as string[]);
		let selections = 0;
		let identical = 0;
		const onlyThuleAdded: unknown[] = [];
		const otherDiffs: unknown[] = [];
		let unresolvedAfterSwitch = 0;
		const garageMissing: string[] = [];
		for (const [id, g] of oGen) {
			const h = nGen.get(id);
			const model = modelById.get(g.modelId)!;
			const makeOk = N.makes.some((m) => m.id === model.makeId);
			const modelOk = N.models.some((m) => m.id === model.id);
			if (!h || !makeOk || !modelOk) {
				unresolvedAfterSwitch += 1;
				garageMissing.push(id);
				continue;
			}
			const spanFrom = Math.min(g.productionYearFrom, h.productionYearFrom);
			const spanTo = Math.max(g.productionYearTo ?? openEnd(), h.productionYearTo ?? openEnd());
			const roofs = new Set([
				...roofChoicesFor(O.applications, candidateOf(g)),
				...roofChoicesFor(N.applications, candidateOf(h)),
			]);
			const roofOptions = [...roofs, undefined];
			const bodies = qualifierVariants(g.qualifiers?.bodyTypes);
			const doorsList = qualifierVariants(g.qualifiers?.doors);
			for (let year = spanFrom; year <= spanTo; year += 1) {
				const months =
					monthDecidesFor(O.applications, id, year) || monthDecidesFor(N.applications, id, year)
						? [undefined, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
						: [undefined];
				for (const manufactureMonth of months)
					for (const roofType of roofOptions)
						for (const bodyType of bodies)
							for (const doors of doorsList) {
								const selection: VehicleSelection = {
									makeId: model.makeId,
									modelId: model.id,
									generationId: id,
									year,
									...(manufactureMonth ? { manufactureMonth } : {}),
									...(roofType ? { roofType } : {}),
									...(bodyType ? { bodyType } : {}),
									...(doors !== undefined ? { doors } : {}),
								};
								selections += 1;
								const a = outcomeKey(resolveVehicleOutcome(oSlice(id), selection, { now: NOW }));
								const b = outcomeKey(resolveVehicleOutcome(nSlice(id), selection, { now: NOW }));
								if (json(a) === json(b)) {
									identical += 1;
									continue;
								}
								const strip = (k: typeof a) => ({
									...k,
									verified: k.verified.filter((p) => !thuleIds.has(p)),
									unconfirmed: k.unconfirmed.filter((p) => !thuleIds.has(p.split(":")[0]!)),
									rejected: k.rejected.filter((p) => !thuleIds.has(p)),
								});
								const entry = { generation: id, name: g.name, selection, old: a, new: b };
								if (json(strip(a)) === json(strip(b))) onlyThuleAdded.push(entry);
								else otherDiffs.push(entry);
							}
			}
		}
		report.savedSelections = {
			selections,
			identical,
			onlyThuleAddedCount: onlyThuleAdded.length,
			onlyThuleAdded: onlyThuleAdded.slice(0, 400),
			otherDiffCount: otherDiffs.length,
			otherDiffs: otherDiffs.slice(0, 400),
			generationsMissingInNew: garageMissing,
			unresolvedAfterSwitch,
		};

		// --- The pilot: every Thule application, and what the resolver says around it. ---
		const nModel = byId(N.models);
		const nMake = byId(N.makes);
		const thuleApps = N.applications.filter((a) => a.products.some((p) => thuleIds.has(p.saleorProductId)));
		report.thule = thuleApps.map((a) => {
			const g = nGen.get(a.generationId)!;
			const model = nModel.get(g.modelId)!;
			const make = nMake.get(model.makeId)!;
			const roofs = roofChoicesFor(N.applications, candidateOf(g));
			const from = Math.min(g.productionYearFrom, a.window.from.year) - 1;
			const to = Math.max(g.productionYearTo ?? openEnd(), a.window.to?.year ?? openEnd()) + 1;
			const matrix: Record<string, Record<string, string>> = {};
			for (const p of a.products) {
				for (let year = from; year <= to; year += 1) {
					for (const roofType of [...roofs, undefined]) {
						const bodies = qualifierVariants(g.qualifiers?.bodyTypes);
						const doorsList = qualifierVariants(g.qualifiers?.doors);
						const selection: VehicleSelection = {
							makeId: make.id,
							modelId: model.id,
							generationId: g.id,
							year,
							...(roofType ? { roofType } : {}),
							...(bodies[0] ? { bodyType: bodies[0] } : {}),
							...(doorsList[0] !== undefined ? { doors: doorsList[0] } : {}),
						};
						const r = resolveFitment(N, selection, { saleorProductId: p.saleorProductId, now: NOW });
						const offered = resolveVehicleOutcome(N, selection, { now: NOW }).verified.some(
							(o) => o.ref.saleorProductId === p.saleorProductId,
						);
						const cell = `${r.verdict}${offered ? " OFFERED" : ""}${
							r.conditions.length ? " +cond:" + r.conditions.map((c) => c.code).join(",") : ""
						}`;
						(matrix[`${p.saleorProductId} ${year}`] ??= {})[roofType ?? "(none)"] = cell;
					}
				}
			}
			return {
				applicationId: a.applicationId,
				make: make.name,
				model: model.name,
				generation: {
					id: g.id,
					name: g.name,
					from: g.productionYearFrom,
					to: g.productionYearTo,
					qualifiers: g.qualifiers,
				},
				isNewGeneration: !oGen.has(g.id),
				window: a.window,
				qualifiers: a.qualifiers,
				conditions: a.conditions,
				negative: a.negative,
				roofChoices: roofs,
				products: a.products.map((p) => ({
					saleorProductId: p.saleorProductId,
					saleorVariantId: p.saleorVariantId,
					externalReference: p.externalReference,
					productKind: p.productKind,
					qaStatus: p.qaStatus,
					verification: p.verification,
					evidence: p.evidence,
					eligibility: p.eligibility,
					otherApplications: (nRefs.get(p.saleorProductId) ?? []).filter((x) => x !== a.applicationId),
				})),
				matrix,
			};
		});

		writeFileSync(OUT_PATH as string, JSON.stringify(report, null, 2));
	}, 600_000);
});
