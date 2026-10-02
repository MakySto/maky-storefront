import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { runDetached } from "@/lib/async/detached";
import { type CatalogContentSnapshot, parseContentSnapshot } from "@/lib/catalog-content/contract";
import { catalogLanguageForMarket } from "@/lib/catalog-content/language";
import type { CatalogContentLoad } from "@/lib/catalog-content/snapshot";
import type { FitmentDataset } from "@/lib/fitment/contract";
import { transportChecksum } from "@/lib/fitment/dataset-hash";
import { expectedSaleorInstance } from "@/lib/fitment/saleor-instance";
import { validateFitmentDataset } from "@/lib/fitment/validate";

import { type ReleaseConfig, type ReleaseSetting, describePointer, releaseSetting } from "./config";
import {
	type ContentEntry,
	type FitmentEntry,
	MANIFEST_MAX_BYTES,
	ReleaseFailure,
	type ReleaseFault,
	type ReleaseManifest,
	fileUrl,
	parseManifest,
} from "./manifest";

/**
 * The storefront's half of the CFM release contract: follow the manifest, verify, activate, report.
 *
 * Contract: `backend/docs/contracts/MAKY_RELEASE_MANIFEST_CONTRACT.md` in CarFitManager-4. What follows
 * is how this process keeps its promises, in the order the contract states them.
 *
 * ## What it does, and what it never does
 *
 * A background loop (`startReleaseSync`, called from `register()`) asks the pointer for the current
 * manifest at boot and every ~30 s after, conditionally, so an unchanged pointer costs a 304. For each
 * target the manifest names it downloads the file, verifies it — size, SHA-256, JSON, contract, language,
 * page count — and only then swaps it in. A render never waits for any of this: it reads whatever slot is
 * active, in memory, and a failed download changes nothing it can see.
 *
 *   - ACTIVATION IS PER TARGET. A German file that fails verification leaves Germany on what it already
 *     served and does not hold Austria, Slovakia or the fitment dataset back.
 *   - IDENTICAL BYTES ARE FETCHED, VERIFIED AND PARSED ONCE. DE and AT usually point at one file and then
 *     share one parsed snapshot (~16 MB). They are still two targets with two statuses: this process
 *     adopting DE says nothing about AT.
 *   - STALE-IF-ERROR, IN BOTH DIRECTIONS. A failed refresh keeps the verified slot. And once a market has
 *     had a verified slot it never falls back to `MAKY_CATALOG_CONTENT_*`, which may be older than what
 *     the page already shows. Those settings answer for a market only until its first verified file.
 *   - CONTENT AND FITMENT ARE INDEPENDENT. They are joined on `vehicleId` at render time; neither waits
 *     for the other and neither's failure touches the other.
 *
 * Nothing here is shared with a request but the slots, and nothing here reads a clock a render could see:
 * the loop runs detached from any render (`runDetached`), and timestamps come from `performance`, for the
 * reason `expiring-memo.ts` explains at length.
 *
 * State is on `globalThis`. The page bundles, the route handlers and the instrumentation bundle are
 * separate module graphs, and all of them must find the same slots and the same `bootId`.
 */

const STATE = Symbol.for("maky.catalog-release.state.v1");

/** Hard ceiling on retries after a failure. Long enough not to hammer CFM, short enough to recover. */
const MAX_BACKOFF_MS = 300_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_REDIRECTS = 3;

type Check = { at: number; outcome: "new" | "unchanged" | "failed"; reason: string | null };

type ContentSlot = {
	readonly entry: ContentEntry;
	readonly load: CatalogContentLoad & { readonly snapshot: CatalogContentSnapshot };
	readonly activatedAt: number;
};

type TargetState = {
	/** The last file that verified. Never cleared by a failure. */
	active: ContentSlot | null;
	/** What the current manifest wants. */
	desired: ContentEntry | null;
	fault: ReleaseFault | null;
	failures: number;
	/** Wall-clock ms before which a failed target is not tried again. */
	retryAt: number;
};

type FitmentSlot = {
	readonly entry: FitmentEntry;
	readonly dataset: FitmentDataset;
	readonly bytes: number;
	readonly loadMs: number;
	readonly activatedAt: number;
};

type FitmentState = {
	active: FitmentSlot | null;
	desired: FitmentEntry | null;
	fault: ReleaseFault | null;
	failures: number;
	retryAt: number;
};

type ManifestState = {
	held: { readonly manifest: ReleaseManifest; readonly sha256: string } | null;
	etag: string | null;
	lastModified: string | null;
	checkedAt: number | null;
	outcome: "new" | "unchanged" | "failed" | null;
	fault: ReleaseFault | null;
	failures: number;
};

type ReleaseState = {
	readonly bootId: string;
	readonly startedAt: number;
	readonly manifest: ManifestState;
	readonly targets: Map<string, TargetState>;
	readonly fitment: FitmentState;
	timer: ReturnType<typeof setTimeout> | null;
	running: Promise<void> | null;
	started: boolean;
	/** The last line logged per subject, so a persistent failure is one line and not one per poll. */
	readonly logged: Map<string, string>;
};

type WithState = typeof globalThis & { [STATE]?: ReleaseState };

function shared(): ReleaseState {
	const scope = globalThis as WithState;
	return (scope[STATE] ??= {
		bootId: randomUUID(),
		startedAt: wallClockMs(),
		manifest: {
			held: null,
			etag: null,
			lastModified: null,
			checkedAt: null,
			outcome: null,
			fault: null,
			failures: 0,
		},
		targets: new Map(),
		fitment: { active: null, desired: null, fault: null, failures: 0, retryAt: 0 },
		timer: null,
		running: null,
		started: false,
		logged: new Map(),
	});
}

/** Exported for tests only — a process-wide state cannot be observed or reset any other way. */
export function __resetReleaseState(): void {
	const scope = globalThis as WithState;
	if (scope[STATE]?.timer) clearTimeout(scope[STATE].timer);
	delete scope[STATE];
}

/** Exported for tests only: resolves when the pass in flight, if any, has settled. */
export async function __settleReleaseSync(): Promise<void> {
	await (globalThis as WithState)[STATE]?.running;
}

const systemClock = (): number => Math.round(performance.timeOrigin + performance.now());
let clock = systemClock;

/** Exported for tests only: a retry that waits half a minute cannot be observed on a real clock. */
export function __setReleaseClock(next: (() => number) | null): void {
	clock = next ?? systemClock;
}

/**
 * Wall-clock milliseconds, read without `Date`. See `provider.ts` for why a clock read on a path a
 * render can reach is a 500 under `cacheComponents`; here it is also the status document's timestamp.
 */
function wallClockMs(): number {
	return clock();
}

function describe(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.slice(0, 300);
}

/** Once per distinct message per subject: a broken upstream is one line, not one line per poll. */
function logOnce(
	state: ReleaseState,
	subject: string,
	message: string,
	level: "log" | "warn" | "error",
): void {
	if (state.logged.get(subject) === message) return;
	state.logged.set(subject, message);
	console[level](`[release] ${message}`);
}

function backoff(failures: number): number {
	return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, failures - 1));
}

// ── transport ────────────────────────────────────────────────────────────────

/**
 * One GET that never leaves its origin.
 *
 * Redirects are followed by hand, and only to the same https origin: a pointer or a file that answers
 * with a redirect to somewhere else is refused, not followed, because the whole point of the configured
 * address is that bytes come from there and from nowhere else.
 */
async function fetchSameOrigin(
	url: string,
	headers: Record<string, string>,
	timeoutMs: number,
): Promise<Response> {
	const origin = new URL(url).origin;
	let current = url;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const response = await fetch(current, {
			headers,
			redirect: "manual",
			// Explicit, so a prerender cannot hand this fetch a promise that never settles; see `snapshot.ts`.
			cache: "no-store",
			signal: AbortSignal.timeout(timeoutMs),
		});
		const redirected = response.status >= 300 && response.status < 400 && response.status !== 304;
		const location = redirected ? response.headers.get("location") : null;
		if (!location) return response;
		const next = new URL(location, current);
		if (next.protocol !== "https:" || next.origin !== origin) {
			throw new ReleaseFailure("manifest_origin", `redirected to ${next.origin}, which is not ${origin}`);
		}
		current = next.toString();
	}
	throw new ReleaseFailure("file_unreachable", `more than ${MAX_REDIRECTS} redirects`);
}

/**
 * The body, read with a ceiling. A response larger than it is cut off as soon as it is known to be too
 * large: a wrong or hostile `Content-Length` must not be able to take the process's memory.
 */
async function readBody(response: Response, limit: number, tooLarge: ReleaseFault): Promise<Uint8Array> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > limit) {
		await response.body?.cancel();
		throw new ReleaseFailure(tooLarge.code, tooLarge.message);
	}
	if (!response.body) {
		const whole = new Uint8Array(await response.arrayBuffer());
		if (whole.byteLength > limit) throw new ReleaseFailure(tooLarge.code, tooLarge.message);
		return whole;
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			throw new ReleaseFailure(tooLarge.code, tooLarge.message);
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.byteLength;
	}
	return out;
}

/** A file of exactly `expected` bytes from `url`, or the contract code that says why not. */
async function downloadFile(url: string, expected: number, timeoutMs: number): Promise<Uint8Array> {
	let response: Response;
	try {
		response = await fetchSameOrigin(url, { accept: "application/json" }, timeoutMs);
	} catch (error) {
		if (error instanceof ReleaseFailure) throw error;
		throw new ReleaseFailure("file_unreachable", describe(error));
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new ReleaseFailure("file_unreachable", `HTTP ${response.status}`);
	}
	let bytes: Uint8Array;
	try {
		bytes = await readBody(response, expected, {
			code: "file_size_mismatch",
			message: `the file is larger than the ${expected} bytes the manifest declares`,
		});
	} catch (error) {
		if (error instanceof ReleaseFailure) throw error;
		throw new ReleaseFailure("file_unreachable", describe(error));
	}
	if (bytes.byteLength !== expected) {
		throw new ReleaseFailure(
			"file_size_mismatch",
			`the file is ${bytes.byteLength} bytes, the manifest declares ${expected}`,
		);
	}
	return bytes;
}

// ── verification ─────────────────────────────────────────────────────────────

/** Bytes → a snapshot that is, on every point the contract names, the file the manifest described. */
function verifyContent(bytes: Uint8Array, entry: ContentEntry): CatalogContentSnapshot {
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	if (sha256 !== entry.sha256) {
		throw new ReleaseFailure(
			"file_hash_mismatch",
			`${entry.file}: sha256 ${sha256.slice(0, 12)}… but the manifest says ${entry.sha256.slice(0, 12)}…`,
		);
	}
	let snapshot: CatalogContentSnapshot;
	try {
		snapshot = parseContentSnapshot(JSON.parse(new TextDecoder().decode(bytes)));
	} catch (error) {
		throw new ReleaseFailure("file_invalid", `${entry.file}: ${describe(error)}`);
	}
	return snapshot;
}

/** What is wrong with giving this snapshot to this one target, if anything. Checked per target, not per file. */
function entryProblem(entry: ContentEntry, snapshot: CatalogContentSnapshot): ReleaseFault | null {
	if (snapshot.language !== entry.language) {
		return {
			code: "file_language_mismatch",
			message: `${entry.file} is ${JSON.stringify(snapshot.language)}, the manifest says ${JSON.stringify(
				entry.language,
			)}`,
		};
	}
	const read = catalogLanguageForMarket(entry.market);
	if (read !== entry.language) {
		return {
			code: "file_language_mismatch",
			message: `the manifest gives ${entry.market} ${JSON.stringify(
				entry.language,
			)}, but this storefront reads ${JSON.stringify(read)} there`,
		};
	}
	if (entry.pages !== null && entry.pages !== snapshot.pages.length) {
		return {
			code: "file_invalid",
			message: `${entry.file} holds ${snapshot.pages.length} pages, the manifest says ${entry.pages}`,
		};
	}
	return null;
}

// ── the manifest ─────────────────────────────────────────────────────────────

function target(state: ReleaseState, market: string): TargetState {
	let found = state.targets.get(market);
	if (!found) {
		found = { active: null, desired: null, fault: null, failures: 0, retryAt: 0 };
		state.targets.set(market, found);
	}
	return found;
}

function failManifest(state: ReleaseState, fault: ReleaseFault): void {
	const m = state.manifest;
	m.checkedAt = wallClockMs();
	m.outcome = "failed";
	m.fault = fault;
	m.failures += 1;
	logOnce(
		state,
		"manifest",
		`manifest refused (${fault.code}): ${fault.message}; keeping what is active`,
		"error",
	);
}

/** What the manifest now wants: new work for every target whose file changed, nothing for the rest. */
function applyManifest(state: ReleaseState, manifest: ReleaseManifest): void {
	const named = new Set(Object.keys(manifest.content));
	for (const [market, entry] of Object.entries(manifest.content)) {
		const slot = target(state, market);
		if (catalogLanguageForMarket(market) === null) {
			slot.desired = entry;
			slot.fault = { code: "target_unknown", message: `market ${market} is not served by this storefront` };
			slot.retryAt = Number.POSITIVE_INFINITY;
			continue;
		}
		if (slot.desired?.sha256 !== entry.sha256 || slot.fault?.code === "target_unknown") {
			slot.failures = 0;
			slot.retryAt = 0;
			slot.fault = null;
		}
		slot.desired = entry;
		// Same bytes under a new release number: nothing to fetch, but the status must say which release it is.
		if (
			slot.active &&
			slot.active.entry.sha256 === entry.sha256 &&
			slot.active.entry.release !== entry.release
		) {
			slot.active = { ...slot.active, entry };
		}
	}
	// A market that left the manifest keeps what it serves. Taking live content away is a withdrawal, which
	// CFM sends as a new file, never as a missing line.
	for (const [market, slot] of state.targets) {
		if (named.has(market)) continue;
		slot.desired = null;
		slot.fault = null;
	}

	const fitment = state.fitment;
	const wanted = manifest.fitment;
	if (wanted === null) {
		fitment.desired = null;
		fitment.fault = null;
		return;
	}
	if (fitment.desired?.sha256 !== wanted.sha256) {
		fitment.failures = 0;
		fitment.retryAt = 0;
		fitment.fault = null;
	}
	fitment.desired = wanted;
	if (
		fitment.active &&
		fitment.active.entry.sha256 === wanted.sha256 &&
		fitment.active.entry.release !== wanted.release
	) {
		fitment.active = { ...fitment.active, entry: wanted };
	}
}

async function checkManifest(state: ReleaseState, config: ReleaseConfig): Promise<void> {
	const m = state.manifest;
	const headers: Record<string, string> = { accept: "application/json" };
	// Asked conditionally only while a manifest is held: "not modified" is an answer only if there is
	// something it refers to.
	if (m.held && m.etag) headers["if-none-match"] = m.etag;
	if (m.held && m.lastModified) headers["if-modified-since"] = m.lastModified;

	let response: Response;
	try {
		response = await fetchSameOrigin(config.manifestUrl, headers, config.manifestTimeoutMs);
	} catch (error) {
		return failManifest(
			state,
			error instanceof ReleaseFailure
				? error.fault
				: { code: "manifest_unreachable", message: describe(error) },
		);
	}

	if (response.status === 304 && m.held) {
		m.checkedAt = wallClockMs();
		m.outcome = "unchanged";
		m.fault = null;
		m.failures = 0;
		return;
	}
	if (!response.ok) {
		await response.body?.cancel();
		return failManifest(state, { code: "manifest_unreachable", message: `HTTP ${response.status}` });
	}

	let bytes: Uint8Array;
	try {
		bytes = await readBody(response, MANIFEST_MAX_BYTES, {
			code: "manifest_invalid",
			message: `the pointer is larger than ${MANIFEST_MAX_BYTES} bytes`,
		});
	} catch (error) {
		return failManifest(
			state,
			error instanceof ReleaseFailure
				? error.fault
				: { code: "manifest_unreachable", message: describe(error) },
		);
	}

	const parsed = parseManifest(bytes, config.manifestUrl);
	if (!parsed.ok) return failManifest(state, parsed.fault);

	const incoming = parsed.manifest;
	const held = m.held;
	if (held) {
		if (incoming.manifestVersion < held.manifest.manifestVersion) {
			return failManifest(state, {
				code: "manifest_downgrade",
				message: `manifest v${incoming.manifestVersion} is older than the v${held.manifest.manifestVersion} this process holds`,
			});
		}
		if (
			incoming.manifestVersion === held.manifest.manifestVersion &&
			incoming.selfSha256 !== held.manifest.selfSha256
		) {
			return failManifest(state, {
				code: "manifest_conflict",
				message: `two different manifests claim version ${incoming.manifestVersion}`,
			});
		}
	}

	m.etag = response.headers.get("etag") ?? m.etag;
	m.lastModified = response.headers.get("last-modified") ?? m.lastModified;
	m.checkedAt = wallClockMs();
	m.fault = null;
	m.failures = 0;
	if (held && incoming.manifestVersion === held.manifest.manifestVersion) {
		m.outcome = "unchanged";
		return;
	}
	m.held = { manifest: incoming, sha256: parsed.sha256 };
	m.outcome = "new";
	state.logged.delete("manifest");
	console.log(
		`[release] manifest v${incoming.manifestVersion} taken (${
			Object.keys(incoming.content).length
		} targets, ` + `fitment ${incoming.fitment ? incoming.fitment.datasetVersion : "none"})`,
	);
	applyManifest(state, incoming);
}

// ── the files ────────────────────────────────────────────────────────────────

function failTarget(state: ReleaseState, market: string, slot: TargetState, fault: ReleaseFault): void {
	slot.fault = fault;
	slot.failures += 1;
	slot.retryAt = wallClockMs() + backoff(slot.failures);
	const keeping = slot.active ? `keeping release ${slot.active.entry.release}` : "nothing active yet";
	logOnce(state, `target:${market}`, `${market}: ${fault.code}: ${fault.message}; ${keeping}`, "error");
}

/** A verified snapshot some other target already holds for these exact bytes, if any. */
function alreadyVerified(state: ReleaseState, sha256: string): CatalogContentSnapshot | null {
	for (const slot of state.targets.values()) {
		if (slot.active?.entry.sha256 === sha256) return slot.active.load.snapshot;
	}
	return null;
}

/** One file, however many targets point at it: fetched once, verified once, parsed once. */
async function activateContent(state: ReleaseState, config: ReleaseConfig, markets: string[]): Promise<void> {
	const manifest = state.manifest.held?.manifest;
	const first = state.targets.get(markets[0])?.desired;
	if (!manifest || !first) return;

	let snapshot = alreadyVerified(state, first.sha256);
	if (!snapshot) {
		try {
			const bytes = await downloadFile(fileUrl(manifest.base, first.file), first.bytes, config.fileTimeoutMs);
			snapshot = verifyContent(bytes, first);
		} catch (error) {
			const fault =
				error instanceof ReleaseFailure
					? error.fault
					: { code: "file_unreachable" as const, message: describe(error) };
			for (const market of markets) failTarget(state, market, target(state, market), fault);
			return;
		}
	}

	const taken: string[] = [];
	for (const market of markets) {
		const slot = target(state, market);
		const entry = slot.desired;
		// The manifest can have moved on while the file was downloading; a newer pass owns that.
		if (!entry || entry.sha256 !== first.sha256) continue;
		const problem = entryProblem(entry, snapshot);
		if (problem) {
			failTarget(state, market, slot, problem);
			continue;
		}
		slot.active = {
			entry,
			activatedAt: wallClockMs(),
			load: {
				snapshot,
				status: {
					mode: "release",
					unavailableReason: null,
					language: snapshot.language,
					generatedAt: snapshot.generatedAt,
					pageCount: snapshot.pages.length,
					sha256: entry.sha256,
				},
			},
		};
		slot.fault = null;
		slot.failures = 0;
		slot.retryAt = 0;
		state.logged.delete(`target:${market}`);
		taken.push(`${market}@${entry.release}`);
	}
	if (taken.length > 0) {
		console.log(
			`[release] content ${taken.join(",")} active: ${first.file} (${
				first.bytes
			} B, sha256 ${first.sha256.slice(0, 12)}…)`,
		);
	}
}

async function activateFitment(state: ReleaseState, config: ReleaseConfig): Promise<void> {
	const f = state.fitment;
	const entry = f.desired;
	const manifest = state.manifest.held?.manifest;
	if (!entry || !manifest || f.active?.entry.sha256 === entry.sha256 || f.retryAt > wallClockMs()) return;

	const started = performance.now();
	try {
		const bytes = await downloadFile(fileUrl(manifest.base, entry.file), entry.bytes, config.fileTimeoutMs);
		const sha256 = transportChecksum(bytes);
		if (sha256 !== entry.sha256) {
			throw new ReleaseFailure(
				"file_hash_mismatch",
				`${entry.file}: sha256 ${sha256.slice(0, 12)}… but the manifest says ${entry.sha256.slice(0, 12)}…`,
			);
		}
		// The exact bytes as text: the semantic hash is only reproducible against CFM's Python when every
		// number is re-emitted from its source token (`dataset-hash.ts`).
		const text = new TextDecoder().decode(bytes);
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			throw new ReleaseFailure("fitment_invalid", `${entry.file} is not JSON`);
		}
		const validation = validateFitmentDataset(body, {
			expectedSaleorInstance: expectedSaleorInstance(),
			rawText: text,
		});
		if (!validation.ok) {
			throw new ReleaseFailure(
				"fitment_invalid",
				`${entry.file}: ${validation.errors[0] ?? "failed validation"}`,
			);
		}
		const dataset = validation.dataset;
		// `validateFitmentDataset` recomputed the hash and found it equal to the one in the file. It still has
		// to be the one in the MANIFEST: a perfectly valid dataset that is not the approved one is not the
		// delivery.
		if (dataset.datasetHash !== entry.datasetHash) {
			throw new ReleaseFailure(
				"fitment_hash_mismatch",
				`recomputed datasetHash ${dataset.datasetHash.slice(
					0,
					12,
				)}… but the manifest says ${entry.datasetHash.slice(0, 12)}…`,
			);
		}
		if (dataset.datasetVersion !== entry.datasetVersion || dataset.schemaVersion !== entry.schemaVersion) {
			throw new ReleaseFailure(
				"fitment_invalid",
				`the dataset is ${dataset.datasetVersion} (${dataset.schemaVersion}), the manifest says ${entry.datasetVersion} (${entry.schemaVersion})`,
			);
		}
		if (validation.warnings.length > 0)
			console.warn("[release] fitment payload warnings:", validation.warnings);
		const ms = Math.round(performance.now() - started);
		f.active = { entry, dataset, bytes: bytes.byteLength, loadMs: ms, activatedAt: wallClockMs() };
		f.fault = null;
		f.failures = 0;
		f.retryAt = 0;
		state.logged.delete("fitment");
		console.log(
			`[release] fitment active: ${dataset.datasetVersion} ${dataset.datasetHash} (${bytes.byteLength} B, ${ms} ms)`,
		);
	} catch (error) {
		const fault =
			error instanceof ReleaseFailure
				? error.fault
				: { code: "file_unreachable" as const, message: describe(error) };
		f.fault = fault;
		f.failures += 1;
		f.retryAt = wallClockMs() + backoff(f.failures);
		const keeping = f.active ? `keeping ${f.active.dataset.datasetVersion}` : "nothing active yet";
		logOnce(state, "fitment", `fitment: ${fault.code}: ${fault.message}; ${keeping}`, "error");
	}
}

/** Work through everything the manifest wants that is not yet active and is due. */
async function reconcile(state: ReleaseState, config: ReleaseConfig): Promise<void> {
	const now = wallClockMs();
	const bySha = new Map<string, string[]>();
	for (const [market, slot] of state.targets) {
		const wanted = slot.desired;
		if (!wanted || slot.active?.entry.sha256 === wanted.sha256 || slot.retryAt > now) continue;
		bySha.set(wanted.sha256, [...(bySha.get(wanted.sha256) ?? []), market]);
	}
	for (const markets of bySha.values()) {
		await activateContent(state, config, markets);
		// Parsing ten megabytes holds the event loop for a moment; let a request in between files.
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
	await activateFitment(state, config);
}

async function pass(state: ReleaseState, setting: ReleaseSetting): Promise<void> {
	if (setting.kind !== "on") return;
	try {
		await checkManifest(state, setting.config);
		await reconcile(state, setting.config);
	} catch (error) {
		// Everything anticipated is a status, not a throw. This is for what is not.
		console.error("[release] pass threw:", error);
	}
}

/** One pass, now. Never rejects, and a pass already running is joined rather than doubled. */
export function releaseSyncOnce(): Promise<void> {
	const setting = releaseSetting();
	if (setting.kind !== "on") return Promise.resolve();
	const state = shared();
	state.running ??= pass(state, setting).finally(() => {
		state.running = null;
	});
	return state.running;
}

function delayAfter(state: ReleaseState, config: ReleaseConfig): number {
	const slow = Math.min(MAX_BACKOFF_MS, config.pollMs * 2 ** Math.min(state.manifest.failures, 4));
	return Math.round(slow * (0.8 + Math.random() * 0.4));
}

function schedule(state: ReleaseState, delayMs: number): void {
	if (state.timer) clearTimeout(state.timer);
	state.timer = setTimeout(() => {
		state.timer = null;
		const setting = releaseSetting();
		if (setting.kind !== "on") return;
		void runDetached(() => releaseSyncOnce()).finally(() =>
			schedule(state, delayAfter(state, setting.config)),
		);
	}, delayMs);
	// A pending poll must not be a reason for the process to stay alive.
	state.timer.unref?.();
}

/**
 * Start following the manifest. Idempotent, never throws, never blocks the boot: the first pass runs in
 * the background, and until it has verified a file for a market that market is answered by the older
 * `MAKY_CATALOG_CONTENT_*` settings, so nothing a visitor sees changes while it happens.
 */
export function startReleaseSync(): void {
	const setting = releaseSetting();
	if (setting.kind === "invalid") {
		console.error(`[release] ${setting.reason}; release mode is OFF and the older settings stay in charge`);
		return;
	}
	if (setting.kind !== "on") {
		console.log("[release] mode=off (MAKY_RELEASE_MANIFEST_URL not set)");
		return;
	}
	const state = shared();
	if (state.started) return;
	state.started = true;

	const content = process.env.MAKY_CATALOG_CONTENT_PATH?.trim()
		? "path"
		: process.env.MAKY_CATALOG_CONTENT_URL?.trim()
			? "url"
			: "none";
	console.log(
		`[release] mode=manifest source=${describePointer(setting.config)} poll=${
			setting.config.pollMs / 1000
		}s ` + `boot=${state.bootId.slice(0, 8)} older-content-setting=${content}`,
	);
	if (content !== "none") {
		console.warn(
			`[release] MAKY_CATALOG_CONTENT_${content.toUpperCase()} is set next to the manifest. The manifest wins: ` +
				"the older setting answers for a market only until the manifest has verified a file for it, and never again after.",
		);
	}
	schedule(state, 0);
}

// ── what the rest of the process reads ───────────────────────────────────────

/**
 * The content a market is serving from a verified manifest file, or `null` when it has none yet.
 *
 * Synchronous and in memory on purpose: a render must never wait for a release, and a market that has
 * no verified file is answered by the caller's older source, not by a wait.
 */
export function releasedContent(market: string, language: string): CatalogContentLoad | null {
	const slot = (globalThis as WithState)[STATE]?.targets.get(market)?.active;
	if (!slot) return null;
	// A slot is only ever built for the language this market reads (`entryProblem`), so a mismatch here means
	// the caller asked for a different language than the market's own. Handing over prose in another language is
	// the one mistake the language check exists to prevent.
	return slot.load.status.language === language ? slot.load : null;
}

export type ReleasedFitment = {
	readonly dataset: FitmentDataset;
	readonly file: string;
	/** SHA-256 of the exact bytes the dataset was verified from. */
	readonly sha256: string;
	readonly bytes: number;
	readonly release: number;
	readonly activatedAt: number;
	readonly loadMs: number;
	readonly lastCheck: Check | null;
};

export function releasedFitment(): ReleasedFitment | null {
	const state = (globalThis as WithState)[STATE];
	const f = state?.fitment;
	if (!state || !f?.active) return null;
	const { entry, dataset, bytes, loadMs, activatedAt } = f.active;
	const m = state.manifest;
	// What was last ASKED: the manifest, and the file when the manifest named a newer one that failed.
	const lastCheck: Check | null =
		m.checkedAt === null
			? null
			: {
					at: m.checkedAt,
					outcome: f.fault ? "failed" : m.outcome ?? "unchanged",
					reason: (f.fault ?? m.fault)?.code ?? null,
				};
	return {
		dataset,
		file: entry.file,
		sha256: entry.sha256,
		bytes,
		release: entry.release,
		activatedAt,
		loadMs,
		lastCheck,
	};
}

// ── a read-only view, for the status document ────────────────────────────────

export type TargetView = {
	readonly market: string;
	readonly desired: ContentEntry | null;
	readonly active: {
		readonly entry: ContentEntry;
		readonly pageCount: number;
		readonly activatedAt: number;
	} | null;
	readonly fault: ReleaseFault | null;
};

export type ReleaseView = {
	readonly setting: ReleaseSetting;
	readonly bootId: string;
	readonly startedAt: number;
	readonly manifest: {
		readonly version: number | null;
		readonly sha256: string | null;
		readonly checkedAt: number | null;
		readonly outcome: "new" | "unchanged" | "failed" | null;
		readonly fault: ReleaseFault | null;
	};
	readonly targets: readonly TargetView[];
	readonly fitment: {
		readonly desired: FitmentEntry | null;
		readonly active: {
			readonly entry: FitmentEntry;
			readonly datasetHash: string;
			readonly activatedAt: number;
		} | null;
		readonly fault: ReleaseFault | null;
	};
};

/** A copy of what this process holds. Reading it loads nothing, contacts nothing and changes nothing. */
export function inspectRelease(): ReleaseView {
	const setting = releaseSetting();
	const state = shared();
	const m = state.manifest;
	return {
		setting,
		bootId: state.bootId,
		startedAt: state.startedAt,
		manifest: {
			version: m.held?.manifest.manifestVersion ?? null,
			sha256: m.held?.sha256 ?? null,
			checkedAt: m.checkedAt,
			outcome: m.outcome,
			fault: m.fault,
		},
		targets: [...state.targets].map(([market, slot]) => ({
			market,
			desired: slot.desired,
			fault: slot.fault,
			active: slot.active
				? {
						entry: slot.active.entry,
						pageCount: slot.active.load.status.pageCount,
						activatedAt: slot.active.activatedAt,
					}
				: null,
		})),
		fitment: {
			desired: state.fitment.desired,
			fault: state.fitment.fault,
			active: state.fitment.active
				? {
						entry: state.fitment.active.entry,
						datasetHash: state.fitment.active.dataset.datasetHash,
						activatedAt: state.fitment.active.activatedAt,
					}
				: null,
		},
	};
}
