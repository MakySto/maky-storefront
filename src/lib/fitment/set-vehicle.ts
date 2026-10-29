import { vehicleNodeName, type FitmentDataset } from "./contract";

/**
 * The car a roof-rack set is made for, named the way the rest of the shop names it.
 *
 * A set's catalogue name carries its car as prose written at different times by different people —
 * "BMW 5 Series Touring G31", "BMW rad 3 G20", "BMW 3-Rad G20" for the same kind of thing — so a shelf
 * that prints the name's own words prints three spellings of one idea. The dataset names the car once
 * (make, model, generation, and the words CFM states for the reading language), and the product page's
 * "Určené pre" box already reads it from there. This gives a listing card the same words.
 *
 * It is a presentation of the car and nothing else: the identity is the generation in the
 * application, which this never changes, and a generation the tree cannot name is not named at all.
 */
export type SetVehicle = {
	/** The names the maker may be written under in a product name: the dataset's own and the language's. */
	make: readonly string[];
	/** The names the generation may be written under in a product name ("G31"). */
	generation: readonly string[];
	/** "BMW Rad 5 Touring G31" — make, model and generation, joined as the product page joins them. */
	label: string;
};

type Tree = {
	generations: ReadonlyMap<string, FitmentDataset["generations"][number]>;
	models: ReadonlyMap<string, FitmentDataset["models"][number]>;
	makes: ReadonlyMap<string, FitmentDataset["makes"][number]>;
	named: Map<string, Map<string, SetVehicle | null>>;
};

const TREES = new WeakMap<FitmentDataset, Tree>();

function treeOf(dataset: FitmentDataset): Tree {
	let tree = TREES.get(dataset);
	if (!tree) {
		tree = {
			generations: new Map(dataset.generations.map((g) => [g.id, g])),
			models: new Map(dataset.models.map((m) => [m.id, m])),
			makes: new Map(dataset.makes.map((m) => [m.id, m])),
			named: new Map(),
		};
		TREES.set(dataset, tree);
	}
	return tree;
}

/** Does `text` begin with `word` as a whole word, ignoring case? */
function beginsWith(text: string, word: string): boolean {
	if (!text.toLocaleLowerCase().startsWith(word.toLocaleLowerCase())) return false;
	const next = text[word.length];
	return next === undefined || !/[\p{L}\p{N}]/u.test(next);
}

/**
 * The car of one generation, named for `language`, or null when the tree does not name it.
 *
 * A model the dataset already writes with its maker ("Renault Laguna" under RENAULT) is not given the
 * maker twice.
 */
export function setVehicleOf(
	dataset: FitmentDataset,
	generationId: string,
	language?: string | null,
): SetVehicle | null {
	const tree = treeOf(dataset);
	const key = language ?? "";
	let memo = tree.named.get(key);
	if (!memo) {
		memo = new Map();
		tree.named.set(key, memo);
	}
	if (memo.has(generationId)) return memo.get(generationId) ?? null;

	const generation = tree.generations.get(generationId);
	const model = generation ? tree.models.get(generation.modelId) : undefined;
	const make = model ? tree.makes.get(model.makeId) : undefined;
	let vehicle: SetVehicle | null = null;
	if (generation && model && make) {
		const makeName = vehicleNodeName(make, language);
		const modelName = vehicleNodeName(model, language);
		const label = [
			beginsWith(modelName, makeName) ? null : makeName,
			modelName,
			vehicleNodeName(generation, language),
		]
			.filter((part): part is string => Boolean(part && part.trim()))
			.join(" ");
		const aliases = (...names: string[]) => [...new Set(names.map((name) => name.trim()).filter(Boolean))];
		vehicle = label
			? {
					make: aliases(make.name, makeName),
					generation: aliases(generation.name, vehicleNodeName(generation, language)),
					label,
				}
			: null;
	}
	memo.set(generationId, vehicle);
	return vehicle;
}
