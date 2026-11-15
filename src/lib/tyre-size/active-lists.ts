import "server-only";

import rawFamilies from "./data/rodiny_20261105.json";
import rawIndex from "./data/velkosti_20261105.json";
import {
	parseTyreFamiliesFor,
	tyreFamiliesSeal,
	type TyreFamiliesData,
	type TyreFamiliesFile,
} from "./families-file";
import { parseTyreSizeIndex, tyreSizeIndexSeal } from "./size-index-file";
import type { TyreSizeIndex } from "./types";

/**
 * Which tyre-size list and which model families the shop is serving right now.
 *
 * The two files in `data/` used to BE the answer: imported once, for the life of the build. A size the owner
 * switched off in CFM then stayed on the shop until somebody copied the new file in, opened a pull request and
 * deployed (`650/17 R17` on D0245, 2026-11-15). The owner's rule is the opposite: what is switched off in CFM goes
 * off on the shop by itself.
 *
 * So the pair is a slot. A process starts on the copy it was built with, and `activateTyreLists` puts a newer pair
 * in its place. Everything that reads the list (the selector, the verdict on a card, the server's check when a line
 * is added, the size and model pages, the sitemap) asks `activeTyreLists()` each time, so a swap is seen by the next
 * request and by nothing halfway through one: a reader takes the pair once and works on that object.
 *
 * ## The pair is one thing
 *
 * The families file names the codes of one list. A families file beside another list would offer "the same model
 * in the size that fits" from a list that no longer says so. They are therefore checked together and swapped
 * together, or not at all: both files parse, both seals are their content's, the ids are equal, every code of the
 * list has a family and every code of the families is in the list. A pair that fails any of it changes nothing, and
 * the reason goes back to the caller, which reports it.
 *
 * ## What this module does not do
 *
 * It reads no network and no disk. Who brings a pair, and how its bytes were verified on the way (size, SHA-256,
 * origin), is the release sync's business; this is the last gate, and it is the same gate the build's own copy
 * passes at start.
 *
 * State is on `globalThis`: the page bundles, the route handlers and the instrumentation bundle are separate module
 * graphs, and all of them must see the same pair.
 */

export interface TyreLists {
	readonly index: TyreSizeIndex;
	readonly families: TyreFamiliesData;
	/** Where the pair came from: the build's own copy, or a release CFM published (its counter). */
	readonly source: { readonly kind: "build" } | { readonly kind: "release"; readonly release: number };
	/** The seals of the two files, which is how a status report says which pair is being served. */
	readonly seals: { readonly index: string; readonly families: string };
}

export type TyreListsActivation =
	| { readonly ok: true; readonly lists: TyreLists; readonly changed: boolean }
	| { readonly ok: false; readonly reason: string };

const STATE = Symbol.for("maky.tyre-size.active-lists.v1");

type Holder = { active: TyreLists | null };

function holder(): Holder {
	const scope = globalThis as typeof globalThis & { [STATE]?: Holder };
	scope[STATE] ??= { active: null };
	return scope[STATE];
}

/** Both files through every check, as one pair. Throws with the reason; nothing is kept from a pair that fails. */
function checkedPair(index: unknown, families: unknown, source: TyreLists["source"]): TyreLists {
	const parsedIndex = parseTyreSizeIndex(index);
	const indexSeal = tyreSizeIndexSeal(index);
	if (indexSeal !== parsedIndex.self_sha256) {
		throw new Error("tyre-size index: the seal is not the hash of the content");
	}
	const file = families as TyreFamiliesFile & { self_sha256?: unknown };
	const parsedFamilies = parseTyreFamiliesFor(file, parsedIndex);
	const familiesSeal = tyreFamiliesSeal(file);
	if (familiesSeal !== file.self_sha256) {
		throw new Error("tyre-size families: the seal is not the hash of the content");
	}
	return {
		index: parsedIndex,
		families: parsedFamilies,
		source,
		seals: { index: indexSeal, families: familiesSeal },
	};
}

/** The pair being served. The build's own copy until a release has been activated. */
export function activeTyreLists(): TyreLists {
	const state = holder();
	// The build's copy is checked like any other pair, once: a build whose two files do not belong together must
	// fail loudly on its first read rather than offer a neighbour that is not one.
	state.active ??= checkedPair(rawIndex, rawFamilies, { kind: "build" });
	return state.active;
}

/**
 * Put a pair CFM published in the place of the one being served, if it passes every check.
 *
 * `release` is CFM's counter for the pair. A lower one than the release already served is refused: an older
 * manifest answered late must not bring back a size that was switched off. The same release with the same two
 * seals is not a change, and says so, so a caller can activate on every pass without churning what readers
 * computed from the pair.
 */
export function activateTyreLists(index: unknown, families: unknown, release: number): TyreListsActivation {
	if (!Number.isSafeInteger(release) || release < 1) {
		return { ok: false, reason: `release ${String(release)} is not a positive whole number` };
	}
	const current = activeTyreLists();
	if (current.source.kind === "release" && release < current.source.release) {
		return {
			ok: false,
			reason: `release ${release} is older than the release ${current.source.release} being served`,
		};
	}
	let next: TyreLists;
	try {
		next = checkedPair(index, families, { kind: "release", release });
	} catch (error) {
		return { ok: false, reason: error instanceof Error ? error.message : String(error) };
	}
	if (
		current.source.kind === "release" &&
		current.source.release === release &&
		current.seals.index === next.seals.index &&
		current.seals.families === next.seals.families
	) {
		return { ok: true, lists: current, changed: false };
	}
	holder().active = next;
	return { ok: true, lists: next, changed: true };
}

/** Back to the build's own copy. For tests, which must leave the process as they found it. */
export function resetTyreListsToBuild(): void {
	holder().active = null;
}

/**
 * Something computed from the pair, computed once per pair.
 *
 * The lookups built over 5 000 rows are too costly to build per request and must not outlive the pair they were
 * built from. Keyed on the pair object itself, so a swap needs no invalidation: the next read finds no entry for
 * the new pair and builds it, and the old pair's entry goes with the old pair.
 */
export function perTyreLists<T extends object>(build: (lists: TyreLists) => T): () => T {
	const built = new WeakMap<TyreLists, T>();
	return () => {
		const lists = activeTyreLists();
		let value = built.get(lists);
		if (value === undefined) {
			value = build(lists);
			built.set(lists, value);
		}
		return value;
	};
}
