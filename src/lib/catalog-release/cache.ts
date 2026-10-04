import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { type ContentEntry, type FitmentEntry, parseContentEntry, parseFitmentEntry } from "./manifest";

/**
 * What this process had verified and in use the last time that changed, so that a restart begins from it.
 *
 * Without it a restart forgets the release. Until the first pass has downloaded and verified a market's file
 * again, the market is answered by the older `MAKY_CATALOG_CONTENT_*` and `MAKY_FITMENT_*` settings, which
 * point at files that get older with every approval. Most of the time that window is a few seconds. It is
 * also exactly when CFM is unreachable that nobody wants it, and a dataset CFM has since replaced is the one
 * thing that must not come back. So, when `MAKY_RELEASE_CACHE_DIR` is set, the files a process has
 * verified are kept on disk, and the first pass of a boot restores them, through the same checks and
 * from local disk, before the network is asked anything.
 *
 * ## What is kept, and what that does not mean
 *
 *   `ACTIVE.json`   the entries that were IN USE (not the ones a manifest wanted), in the manifest's own shape
 *   `<file name>`   each verified file, under the content-addressed name CFM gave it
 *
 * Nothing in here is believed because it is here. A restore re-checks size, SHA-256, JSON, contract, language
 * and page count (and, for the dataset, the semantic hash and the Saleor instance) exactly as a download is
 * checked, so a file that was corrupted, truncated or swapped on disk is simply not restored. What cannot be
 * restored is answered by the older settings, as it is today; what is restored is replaced by the first
 * manifest that names something else.
 *
 * ## Where, and how it is written
 *
 * Everything lives in one subdirectory this module creates (`maky-release-cache`) inside the configured
 * one, and pruning is confined to it, so pointing the setting at a directory that holds other files cannot
 * make this delete them. Files are written mode 600 and replaced atomically (written beside the target, then
 * renamed over it), so no reader and no crash ever sees half a file. A file nothing references is removed
 * only once it is an hour old: another process of the same app may have just stored it and not yet recorded it.
 *
 * Several processes of one app share the directory. Each records what it holds when that changes; they follow
 * one manifest, so the last write is the converged set, and a prune never removes a file the recorded set names.
 */

const ROOT = "maky-release-cache";
export const ACTIVE_FILE = "ACTIVE.json";
const ARTIFACT = "MAKY_RELEASE_CACHE";
const SCHEMA_VERSION = 1;

/** Unreferenced files are kept this long before they are removed. */
export const PRUNE_GRACE_MS = 60 * 60 * 1000;

const TEMP_SUFFIX = /\.tmp-[0-9a-f]{8}$/;

export type CacheDocument = {
	/** The manifest this set was taken under. Informational: it is for the boot line and for whoever looks. */
	readonly manifestVersion: number | null;
	readonly content: Readonly<Record<string, ContentEntry>>;
	readonly fitment: FitmentEntry | null;
};

function root(dir: string): string {
	return join(dir, ROOT);
}

/**
 * Names this module will write or read for a verified file. Manifest file names are already one plain path
 * segment; this is the part of the rule that is the cache's own: it must end in `.json`, so that a prune can
 * tell its own files from anything else, and it must be neither the index nor a temporary file.
 */
function assertCacheable(name: string): void {
	if (!name.endsWith(".json") || name === ACTIVE_FILE || TEMP_SUFFIX.test(name) || /[\\/]/.test(name)) {
		throw new Error(`${JSON.stringify(name)} is not a name the cache keeps`);
	}
}

async function writeAtomically(dir: string, name: string, bytes: Uint8Array | string): Promise<void> {
	const folder = root(dir);
	await mkdir(folder, { recursive: true, mode: 0o700 });
	const temp = join(folder, `${name}.tmp-${randomBytes(4).toString("hex")}`);
	try {
		await writeFile(temp, bytes, { mode: 0o600 });
		await rename(temp, join(folder, name));
	} catch (error) {
		await rm(temp, { force: true });
		throw error;
	}
}

/**
 * One verified file, kept under the name CFM gave it. Always written, never skipped for "it is already
 * there": a file that is there may be the damaged one a restore just refused, and a write is the repair.
 */
export async function storeFile(dir: string, name: string, bytes: Uint8Array): Promise<void> {
	assertCacheable(name);
	await writeAtomically(dir, name, bytes);
}

/** A kept file, but only if it is exactly the size the entry says: the cheap check, before the expensive ones. */
export async function loadFile(dir: string, name: string, expectedBytes: number): Promise<Uint8Array> {
	assertCacheable(name);
	const path = join(root(dir), name);
	const info = await stat(path);
	if (info.size !== expectedBytes) {
		throw new Error(`the kept file is ${info.size} bytes, the entry says ${expectedBytes}`);
	}
	return new Uint8Array(await readFile(path));
}

/** The fitment entry as the manifest writes it, so that the manifest's own parser can read it back. */
function fitmentDocument(entry: FitmentEntry): Record<string, unknown> {
	return {
		file: entry.file,
		sha256: entry.sha256,
		bytes: entry.bytes,
		release: entry.release,
		contract: { schemaVersion: entry.schemaVersion },
		datasetVersion: entry.datasetVersion,
		datasetHash: entry.datasetHash,
	};
}

export async function writeActive(dir: string, held: CacheDocument): Promise<void> {
	const document = {
		artifact: ARTIFACT,
		schemaVersion: SCHEMA_VERSION,
		manifestVersion: held.manifestVersion,
		content: held.content,
		fitment: held.fitment ? fitmentDocument(held.fitment) : null,
	};
	await writeAtomically(dir, ACTIVE_FILE, JSON.stringify(document, null, 1));
}

/** `null` when nothing has been kept yet; a thrown error when what is there cannot be read as a cache. */
export async function readActive(dir: string): Promise<CacheDocument | null> {
	let text: string;
	try {
		text = await readFile(join(root(dir), ACTIVE_FILE), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error(`${ACTIVE_FILE} is not JSON`);
	}
	if (typeof raw !== "object" || raw === null) throw new Error(`${ACTIVE_FILE} is not an object`);
	const document = raw as Record<string, unknown>;
	if (document.artifact !== ARTIFACT || document.schemaVersion !== SCHEMA_VERSION) {
		throw new Error(`${ACTIVE_FILE} is not a release cache this build reads`);
	}
	const entries = document.content;
	if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
		throw new Error(`${ACTIVE_FILE} has no content entries`);
	}
	const content: Record<string, ContentEntry> = {};
	for (const [market, entry] of Object.entries(entries)) content[market] = parseContentEntry(market, entry);
	return {
		manifestVersion: Number.isSafeInteger(document.manifestVersion)
			? (document.manifestVersion as number)
			: null,
		content,
		fitment: document.fitment == null ? null : parseFitmentEntry(document.fitment),
	};
}

/** Every file a recorded set names. */
export function filesOf(held: CacheDocument): string[] {
	return [
		...Object.values(held.content).map((entry) => entry.file),
		...(held.fitment ? [held.fitment.file] : []),
	];
}

/**
 * The files the record on disk names right now. Typed as read-only on purpose: this project's type resets give
 * a mutable `Set` a `has` that narrows the tested value to `never` when it is false, which is not what a
 * membership test in an `if` means here.
 */
async function recordedFiles(dir: string): Promise<ReadonlySet<string>> {
	try {
		const held = await readActive(dir);
		return new Set(held ? filesOf(held) : []);
	} catch {
		// A record that cannot be read protects nothing; `keep` still does.
		return new Set();
	}
}

/**
 * Remove what is no longer in use: a `.json` file, or a leftover temporary file, in the cache's own
 * subdirectory that is not in `keep`, is not named by the set recorded on disk right now, and has not been
 * touched for `PRUNE_GRACE_MS`. Returns the names removed.
 */
export async function prune(dir: string, keep: ReadonlySet<string>, now: number): Promise<string[]> {
	const folder = root(dir);
	let names: string[];
	try {
		names = await readdir(folder);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	// Another process may have recorded a set this one has not seen. Whatever it names stays.
	const recorded = await recordedFiles(dir);
	const removed: string[] = [];
	for (const name of names) {
		if (name === ACTIVE_FILE || keep.has(name) || recorded.has(name)) continue;
		if (!name.endsWith(".json") && !TEMP_SUFFIX.test(name)) continue;
		const info = await stat(join(folder, name)).catch(() => null);
		if (!info?.isFile() || now - info.mtimeMs < PRUNE_GRACE_MS) continue;
		await rm(join(folder, name), { force: true });
		removed.push(name);
	}
	return removed;
}
