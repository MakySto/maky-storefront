import { foldedTokens } from "./words";

/**
 * Reading a car out of a search: "nosič Kuga", "Dachträger VW Golf 7", "octavia combi 2019".
 *
 * Most of this shop's catalogue is roof-rack sets, one product per car, roof and bar, and those
 * are not found by typing: "kuga" answered 127 sets of every generation, roof and maker in no
 * order (live shop, 2026-11-27), while the Kuga has a page that asks the two questions which
 * decide a set and shows the ones that fit. So a search that names a car is answered with that
 * page first. This module only RECOGNISES the car; the page turns the ids into links through the
 * catalogue tree, and nothing here says that anything fits.
 *
 * PURE: it is given the names (from the fitment dataset, in the market's language) and the words.
 *
 * ## What counts as naming a car
 *
 *   - a make: its name, or what people call it ("vw", "mercedes");
 *   - a model: every word of its name ("Octavia Combi" needs both, and then wins over "Octavia").
 *     A model whose name is distinctive is enough alone ("kuga", "octavia", "rav4"). One that is a
 *     number or two characters ("308", "A3", "5") needs its make beside it, and so does one that
 *     is also a word of the shop's own products ("Spark" is a roof box, "Discovery" a bike
 *     carrier): the caller passes those as `productWords`;
 *   - a generation of a model that was named: its code ("5E", "MK2", "VIII", or "7" for "VII"), or
 *     a year it was built in.
 *
 * Slovak, Czech and Polish decline names ("na Octaviu", "do Golfa"), so a word of four letters or
 * more may carry a short ending.
 */

export interface VehicleNameMake {
	readonly id: string;
	readonly name: string;
	/** The same make under another name: the source's own beside the market's. */
	readonly altNames?: readonly string[];
}

export interface VehicleNameModel {
	readonly id: string;
	readonly makeId: string;
	readonly name: string;
	/** "3 Series" beside the market's "Rad 3". */
	readonly altNames?: readonly string[];
}

export interface VehicleNameGeneration {
	readonly id: string;
	readonly modelId: string;
	readonly name: string;
	readonly yearFrom?: number | null;
	readonly yearTo?: number | null;
}

export interface VehicleNames {
	readonly makes: readonly VehicleNameMake[];
	readonly models: readonly VehicleNameModel[];
	readonly generations: readonly VehicleNameGeneration[];
}

export interface VehicleModelMatch {
	readonly modelId: string;
	readonly makeId: string;
	/** The make was said too ("škoda octavia"), not the model alone. */
	readonly makeNamed: boolean;
	/** The generations the words narrow it to (a code or a year). Empty: the model as a whole. */
	readonly generationIds: readonly string[];
}

export interface VehicleIntent {
	/** Models named, the most specific reading only. */
	readonly models: readonly VehicleModelMatch[];
	/** Makes named WITHOUT one of their models. */
	readonly makeIds: readonly string[];
	/** Other models of a named model's make whose name begins with it ("Octavia Combi" for "octavia"). */
	readonly relatedModelIds: readonly string[];
	readonly year: number | null;
	/** The words of the query that were read as the car, folded as `searchWords` folds them. */
	readonly words: ReadonlySet<string>;
}

export const NO_VEHICLE: VehicleIntent = {
	models: [],
	makeIds: [],
	relatedModelIds: [],
	year: null,
	words: new Set(),
};

/** What people type for a make, by the make's folded name. */
const MAKE_ALIASES: Readonly<Record<string, readonly string[]>> = {
	volkswagen: ["vw"],
	"mercedes benz": ["mercedes", "merc", "mb"],
	"alfa romeo": ["alfa"],
	"land rover": ["landrover"],
	chevrolet: ["chevy"],
	skoda: ["skodovka"],
};

/** Words of model names that are no evidence of a car on their own. */
const GENERIC_MODEL_WORDS: ReadonlySet<string> = new Set(
	(
		"sport sportback sportbrake sportage sports space spacetourer tourer touring tour active cross country " +
		"combi kombi sedan limousine hatchback avant variant estate wagon coupe cabrio grand gran van city " +
		"plus life max maxi mini long class klasse trieda trida rad rada series serie new line allroad alltrack " +
		"scout electric hybrid first style shooting brake break caravan wagon sw box"
	).split(" "),
);

const ROMAN: Readonly<Record<string, number>> = {
	i: 1,
	ii: 2,
	iii: 3,
	iv: 4,
	v: 5,
	vi: 6,
	vii: 7,
	viii: 8,
	ix: 9,
	x: 10,
};

const IS_YEAR = /^(?:19[89]\d|20[0-3]\d)$/;

const tokens = foldedTokens;

/** A word of a name as the customer may have declined it: "octaviu", "golfa", "kugy". */
function saysWord(asked: string, named: string): boolean {
	if (asked === named) return true;
	if (named.length < 4 || /\d/.test(named) || /\d/.test(asked)) return false;
	if (asked.startsWith(named)) return asked.length - named.length <= 2;
	// The last vowel replaced: octavia → octaviu / octavie / octavii, kuga → kugu / kugy.
	return (
		named.length >= 4 &&
		Math.abs(asked.length - named.length) <= 1 &&
		asked.slice(0, named.length - 1) === named.slice(0, -1) &&
		/[aeiouy]$/.test(named)
	);
}

interface AskedWords {
	readonly list: readonly string[];
	/** Each word, and each pair of neighbours written together ("cx 5" is also "cx5"). */
	readonly joined: ReadonlySet<string>;
}

function ask(query: string, language: string): AskedWords {
	const list = tokens(query, language);
	const joined = new Set(list);
	for (let i = 0; i + 1 < list.length; i++) joined.add(list[i]! + list[i + 1]!);
	return { list, joined };
}

/** The asked words that say every word of `name`, or `null` when one is missing. */
function wordsSaying(asked: AskedWords, nameWords: readonly string[]): string[] | null {
	const used: string[] = [];
	for (const named of nameWords) {
		const hit = asked.list.find((word) => saysWord(word, named));
		if (!hit) return null;
		used.push(hit);
	}
	return used;
}

/** The names cut into words once: a search reads two thousand of them. */
interface Compiled {
	readonly makes: readonly { readonly make: VehicleNameMake; readonly names: readonly string[][] }[];
	readonly models: readonly {
		readonly model: VehicleNameModel;
		readonly names: readonly { readonly words: readonly string[]; readonly key: string }[];
		/** The model's own name, for "begins with". */
		readonly own: readonly string[];
	}[];
	readonly generations: ReadonlyMap<
		string,
		readonly { readonly generation: VehicleNameGeneration; readonly words: readonly string[] }[]
	>;
}

const COMPILED = new WeakMap<VehicleNames, Map<string, Compiled>>();

function compile(names: VehicleNames, language: string): Compiled {
	let byLanguage = COMPILED.get(names);
	if (!byLanguage) {
		byLanguage = new Map();
		COMPILED.set(names, byLanguage);
	}
	const kept = byLanguage.get(language);
	if (kept) return kept;

	const generations = new Map<string, { generation: VehicleNameGeneration; words: string[] }[]>();
	for (const generation of names.generations) {
		const entry = { generation, words: tokens(generation.name, language) };
		const list = generations.get(generation.modelId);
		if (list) list.push(entry);
		else generations.set(generation.modelId, [entry]);
	}
	const compiled: Compiled = {
		makes: names.makes.map((make) => ({
			make,
			names: [make.name, ...(make.altNames ?? [])]
				.map((name) => tokens(name, language))
				.filter((words) => words.length > 0),
		})),
		models: names.models.map((model) => ({
			model,
			names: [model.name, ...(model.altNames ?? [])]
				.map((name) => tokens(name, language))
				.filter((words) => words.length > 0)
				.map((words) => ({ words, key: words.join("") })),
			own: tokens(model.name, language),
		})),
		generations,
	};
	byLanguage.set(language, compiled);
	return compiled;
}

function isDistinctive(
	nameWords: readonly string[],
	key: string,
	productWords: ReadonlySet<string>,
): boolean {
	// "rav4", "cx5", "i30", "xc60": letters and digits together, three characters or more.
	if (nameWords.length <= 2 && key.length >= 3 && /[a-z]/.test(key) && /\d/.test(key)) {
		return !productWords.has(key);
	}
	return nameWords.some(
		(word) =>
			word.length >= 4 && /^[a-z]+$/.test(word) && !GENERIC_MODEL_WORDS.has(word) && !productWords.has(word),
	);
}

export function readVehicleIntent(
	query: string,
	names: VehicleNames,
	language: string,
	options: {
		/** Words that name the shop's own products; a model that is one of them needs its make. */
		readonly productWords?: ReadonlySet<string>;
		/** The year a generation "still in production" is counted up to. */
		readonly currentYear?: number;
	} = {},
): VehicleIntent {
	const asked = ask(query, language);
	if (asked.list.length === 0) return NO_VEHICLE;
	const productWords = options.productWords ?? new Set<string>();
	const used = new Set<string>();
	const compiled = compile(names, language);

	// Makes: the whole name, or an alias.
	const namedMakes = new Map<string, string[]>();
	for (const { make, names: makeNames } of compiled.makes) {
		for (const nameWords of makeNames) {
			const byName = wordsSaying(asked, nameWords);
			const alias = (MAKE_ALIASES[nameWords.join(" ")] ?? []).find((word) => asked.list.includes(word));
			const words = byName ?? (alias ? [alias] : null);
			// A make whose name is a word of the shop's own products ("Smart Rack", "mini", "EVO")
			// is not named by that word; its models still are, by theirs.
			if (words && !words.every((word) => productWords.has(word))) {
				namedMakes.set(make.id, words);
				break;
			}
		}
	}

	// Models: every word of the name, or the name written as one piece ("cx5").
	interface Candidate {
		readonly model: VehicleNameModel;
		readonly words: readonly string[];
		readonly size: number;
	}
	const candidates: Candidate[] = [];
	for (const { model, names: modelNames } of compiled.models) {
		const makeNamed = namedMakes.has(model.makeId);
		let best: Candidate | null = null;
		for (const { words: nameWords, key } of modelNames) {
			let words = wordsSaying(asked, nameWords);
			if (!words && nameWords.length > 1 && key.length >= 3 && asked.joined.has(key)) {
				words = asked.list.filter((word) => word === key || key.includes(word));
			}
			// Beside its make, the words every model line shares may be left out: "bmw 3" is the
			// "Rad 3", "mercedes e" is not asked to say "trieda".
			let said = nameWords.length;
			if (!words && makeNamed) {
				const telling = nameWords.filter((word) => !GENERIC_MODEL_WORDS.has(word));
				if (telling.length > 0 && telling.length < nameWords.length) {
					words = wordsSaying(asked, telling);
					// Counted by the words that were said, and just below a name said in full: "škoda
					// octavia" is the Octavia, with the Combi and the Scout beside it, not instead of it.
					said = telling.length - 0.25;
				}
			}
			if (!words) continue;
			if (!makeNamed && !isDistinctive(nameWords, key, productWords)) continue;
			// A model of a make that was named beats a namesake of another make.
			const size = said + (makeNamed ? 0.5 : 0);
			if (!best || size > best.size) best = { model, words, size };
		}
		if (best) candidates.push(best);
	}
	// The most specific reading: "octavia combi" is the Octavia Combi, not also the Octavia.
	const most = Math.max(0, ...candidates.map((candidate) => candidate.size));
	const chosen = candidates.filter((candidate) => candidate.size === most);

	const year = asked.list.map((word) => (IS_YEAR.test(word) ? Number(word) : 0)).find((value) => value > 0);
	const currentYear = options.currentYear ?? 2100;

	const models: VehicleModelMatch[] = chosen.map(({ model, words }) => {
		for (const word of words) used.add(word);
		const ofModel = compiled.generations.get(model.id) ?? [];
		const generations = ofModel.map((entry) => entry.generation);
		const byCode = ofModel
			.filter(({ words: nameWords }) => {
				// A one-letter code ("Meriva A") is also a word of half the languages here.
				if (nameWords.length === 0 || nameWords.some((named) => /^[a-z]$/.test(named))) return false;
				const says = nameWords.every((named) =>
					asked.list.some((word) => {
						if (words.includes(word)) return false;
						if (word === named) return true;
						return ROMAN[named] !== undefined && String(ROMAN[named]) === word;
					}),
				);
				if (says) {
					for (const named of nameWords) {
						used.add(named);
						if (ROMAN[named] !== undefined) used.add(String(ROMAN[named]));
					}
				}
				return says;
			})
			.map((entry) => entry.generation);
		const byYear =
			byCode.length === 0 && year
				? generations.filter(
						(generation) =>
							typeof generation.yearFrom === "number" &&
							generation.yearFrom <= year &&
							year <= (generation.yearTo ?? currentYear),
					)
				: [];
		return {
			modelId: model.id,
			makeId: model.makeId,
			makeNamed: namedMakes.has(model.makeId),
			generationIds: (byCode.length > 0 ? byCode : byYear).map((generation) => generation.id),
		};
	});
	if (models.length > 0 && year) used.add(String(year));

	const modelMakes = new Set(models.map((match) => match.makeId));
	const makeIds: string[] = [];
	for (const [makeId, words] of namedMakes) {
		if (modelMakes.has(makeId)) {
			for (const word of words) used.add(word);
			continue;
		}
		// A make beside another make's model is not the car that was meant; alone it is.
		if (models.length > 0) continue;
		makeIds.push(makeId);
		for (const word of words) used.add(word);
	}

	const chosenIds = new Set(models.map((match) => match.modelId));
	const relatedModelIds =
		models.length === 0
			? []
			: compiled.models
					.filter(({ model, own }) => {
						if (chosenIds.has(model.id)) return false;
						return chosen.some(
							(candidate) =>
								candidate.model.makeId === model.makeId &&
								tokens(candidate.model.name, language).every((word, i) => own[i] === word),
						);
					})
					.map(({ model }) => model.id);

	if (models.length === 0 && makeIds.length === 0) return NO_VEHICLE;
	return { models, makeIds, relatedModelIds, year: models.length > 0 ? year ?? null : null, words: used };
}

/**
 * The words that name the shop's own products, for `readVehicleIntent`'s `productWords`: the words
 * of every product's name and maker, except the products that themselves name a car.
 *
 * "Strešný box G3 Spark 420" makes "spark" a product word, so "spark" alone is the roof box and
 * "chevrolet spark" the car. "Montážny kit Nordrive C041 pre Škoda Octavia 1Z" names a car, make and
 * model, so it does not make "octavia" a product word: a kit is found by its car, not instead of it.
 */
export function productWordsOf(
	products: Iterable<{ readonly name: string; readonly brand?: string | null }>,
	names: VehicleNames,
	language: string,
): Set<string> {
	const words = new Set<string>();
	for (const product of products) {
		const car = readVehicleIntent(product.name, names, language);
		if (car.models.some((model) => model.makeNamed)) continue;
		for (const word of tokens(`${product.name} ${product.brand ?? ""}`, language)) words.add(word);
	}
	return words;
}
