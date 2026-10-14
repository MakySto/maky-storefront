/**
 * Vehicle identities CFM has retired, read the careful way.
 *
 * ## Why this exists
 *
 * CFM found the same car under several generations (a supplier's own code, a window of years used
 * as a name, a facelift, a summary label such as "2008-2019" beside the real generations) and
 * merges them. A merged row's public id (`veh:gn:…`) leaves the dataset — and every shopper who
 * chose that car before still holds it: in the garage cookie, in a bookmark of the vehicle page.
 * Without help the garage shows "choose again" and the page answers not-found.
 *
 * CFM ships the way out inside the dataset itself (`retiredVehicleIds`), under the dataset's own
 * `datasetHash`, so the ids and the map that explains them arrive at one instant and can never
 * disagree: a dataset that no longer holds an id and the map that says where it went are one file.
 *
 * ## What an entry is allowed to do
 *
 * It is source data about the PAST. It may lead a shopper from a retired id to a live one; it may
 * never override a live one, and it is believed only as far as the dataset in hand confirms it:
 *
 *   - an entry whose key is live in this dataset is ignored — a live vehicle is not retired;
 *   - a target that is not live here is not a target, so the entry is dropped, and the shopper is
 *     asked again exactly as before the map existed;
 *   - a chain (A → B, B → C after a second merge) is followed to a live id, at most a few hops, and
 *     a cycle is dropped;
 *   - a dissolved label needs two or more live candidates that belong to ONE model. It leads to a
 *     choice, never to a pick: which of them a car is, is decided by the car's year or by the
 *     shopper — never by a name, never by position in a list.
 *
 * Nothing here is a fallback value. A missing, malformed or partly wrong map costs the shopper one
 * extra choice, and never a wrong car.
 *
 * PURE: no I/O, no server-only imports.
 */

import { type FitmentDataset } from "./contract";

/** Hops followed before an entry is called a loop. Two merges in a row is already unusual. */
const MAX_HOPS = 6;

/** What happened to a vehicle id, as far as this dataset can tell. */
export type VehicleIdFate =
	| { kind: "live" }
	/** Merged into `to`, which is live in this dataset. */
	| { kind: "moved"; to: string }
	/** A dissolved summary label: its cars are now spread over these live generations (2 or more, one model). */
	| { kind: "split"; candidates: readonly string[] }
	/** Not in the dataset and not explained by it. */
	| { kind: "gone" };

type Index = {
	readonly liveGenerations: ReadonlySet<string>;
	readonly liveModels: ReadonlySet<string>;
	readonly generations: ReadonlyMap<string, VehicleIdFate>;
	readonly models: ReadonlyMap<string, VehicleIdFate>;
	readonly entries: {
		readonly moved: number;
		readonly split: number;
		readonly models: number;
		readonly dropped: number;
	};
};

const cache = new WeakMap<object, Index>();

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
	return typeof value === "string" && value !== "";
}

/** Follow `from` through `map` to a live id; `null` for a dead end, a loop or too many hops. */
function followToLive(
	from: string,
	map: Readonly<Record<string, unknown>>,
	live: ReadonlySet<string>,
): string | null {
	let current = from;
	const seen = new Set<string>();
	for (let hop = 0; hop < MAX_HOPS; hop += 1) {
		if (live.has(current)) return current;
		if (seen.has(current)) return null;
		seen.add(current);
		const next = map[current];
		if (!isId(next)) return null;
		current = next;
	}
	return live.has(current) ? current : null;
}

function build(dataset: Pick<FitmentDataset, "generations" | "models" | "retiredVehicleIds">): Index {
	const liveGenerations = new Set(dataset.generations.map((g) => g.id));
	const liveModels = new Set(dataset.models.map((m) => m.id));
	const raw: unknown = dataset.retiredVehicleIds;
	if (!isRecord(raw)) {
		return {
			liveGenerations,
			liveModels,
			generations: new Map(),
			models: new Map(),
			entries: { moved: 0, split: 0, models: 0, dropped: 0 },
		};
	}
	const modelOf = new Map(dataset.generations.map((g) => [g.id, g.modelId]));

	const generations = new Map<string, VehicleIdFate>();
	const models = new Map<string, VehicleIdFate>();
	let moved = 0;
	let split = 0;
	let modelCount = 0;
	let dropped = 0;

	const generationMap = isRecord(raw.generations) ? raw.generations : {};
	for (const key of Object.keys(generationMap)) {
		if (liveGenerations.has(key)) {
			dropped += 1;
			continue;
		}
		const to = followToLive(key, generationMap, liveGenerations);
		if (to === null) {
			dropped += 1;
			continue;
		}
		generations.set(key, { kind: "moved", to });
		moved += 1;
	}

	const splitMap = isRecord(raw.generations_split) ? raw.generations_split : {};
	for (const [key, value] of Object.entries(splitMap)) {
		if (liveGenerations.has(key) || generations.has(key)) {
			dropped += 1;
			continue;
		}
		if (!Array.isArray(value)) {
			dropped += 1;
			continue;
		}
		const resolved = new Set<string>();
		let whole = true;
		for (const candidate of value) {
			const to = isId(candidate) ? followToLive(candidate, generationMap, liveGenerations) : null;
			if (to === null) {
				whole = false;
				break;
			}
			resolved.add(to);
		}
		// All candidates or none: a label whose cars lead partly nowhere cannot be offered as a choice
		// between "the" generations, because the missing one may be the shopper's.
		const candidates = [...resolved];
		const onlyModel = new Set(candidates.map((id) => modelOf.get(id)));
		if (!whole || candidates.length < 2 || onlyModel.size !== 1) {
			dropped += 1;
			continue;
		}
		generations.set(key, { kind: "split", candidates });
		split += 1;
	}

	const modelMap = isRecord(raw.models) ? raw.models : {};
	for (const key of Object.keys(modelMap)) {
		if (liveModels.has(key)) {
			dropped += 1;
			continue;
		}
		const to = followToLive(key, modelMap, liveModels);
		if (to === null) {
			dropped += 1;
			continue;
		}
		models.set(key, { kind: "moved", to });
		modelCount += 1;
	}

	return {
		liveGenerations,
		liveModels,
		generations,
		models,
		entries: { moved, split, models: modelCount, dropped },
	};
}

function indexOf(dataset: Pick<FitmentDataset, "generations" | "models" | "retiredVehicleIds">): Index {
	// Keyed by the dataset object: it is immutable once loaded and replaced as a whole by a new one,
	// so the index never outlives the data it describes.
	const held = cache.get(dataset);
	if (held) return held;
	const built = build(dataset);
	cache.set(dataset, built);
	return built;
}

type Subject = Pick<FitmentDataset, "generations" | "models" | "retiredVehicleIds">;

/** What became of a generation id in this dataset. */
export function generationFate(dataset: Subject, id: string): VehicleIdFate {
	const index = indexOf(dataset);
	if (index.liveGenerations.has(id)) return { kind: "live" };
	return index.generations.get(id) ?? { kind: "gone" };
}

/** What became of a model id in this dataset. A model is never split. */
export function modelFate(dataset: Subject, id: string): VehicleIdFate {
	const index = indexOf(dataset);
	if (index.liveModels.has(id)) return { kind: "live" };
	return index.models.get(id) ?? { kind: "gone" };
}

/**
 * The live vehicle a retired id leads to, for a page rather than a car: a merged generation or
 * model leads to the one that remained, and a dissolved label to the MODEL it sat under, whose page
 * lists the generations — the page can offer the choice that a link cannot make.
 */
export function successorOf(dataset: Subject, id: string): string | null {
	const generation = generationFate(dataset, id);
	if (generation.kind === "moved") return generation.to;
	if (generation.kind === "split") {
		const first = dataset.generations.find((g) => g.id === generation.candidates[0]);
		return first?.modelId ?? null;
	}
	const model = modelFate(dataset, id);
	return model.kind === "moved" ? model.to : null;
}

/** How many entries of the map this dataset believes, for the log and the status endpoint. */
export function retiredIdCounts(dataset: Subject): {
	moved: number;
	split: number;
	models: number;
	dropped: number;
} {
	return { ...indexOf(dataset).entries };
}

/**
 * Structural problems in the map as delivered, as sentences for the validator's warnings. The map
 * is never a reason to refuse a dataset: the entries that fail are simply not believed (above),
 * and the shopper is asked.
 */
export function retiredIdProblems(raw: unknown): string[] {
	if (raw === undefined) return [];
	if (!isRecord(raw)) return ["retiredVehicleIds must be an object; it is ignored"];
	const problems: string[] = [];
	for (const [field, shape] of [
		["generations", "id → id"],
		["generations_split", "id → [id, …]"],
		["models", "id → id"],
	] as const) {
		const value = raw[field];
		if (value !== undefined && !isRecord(value)) {
			problems.push(`retiredVehicleIds.${field} must be an object (${shape}); it is ignored`);
		}
	}
	return problems;
}
