import "server-only";

import { runDetached, hasRootContext } from "@/lib/async/detached";
import { createExpiringMemo, type ExpiringMemo } from "@/lib/cache/expiring-memo";

/**
 * Fitment provider resolution — where the dataset comes from, and what happens when
 * it does not come at all.
 *
 * THE DEFAULT IS OFF. With no configuration the provider is `disabled`, every lookup
 * answers PROVIDER_UNAVAILABLE, and no surface can state that anything fits anything.
 * That is the correct production posture until CFM ships a real dataset: a feature that
 * cannot answer is honest, a feature that answers from invented data is not.
 *
 * Modes, via MAKY_FITMENT_PROVIDER:
 *   unset / "off"  — disabled. The only safe default.
 *   "fixture"      — the committed hand-written dataset. Development and tests only.
 *                    Every surface renders a visible test-data notice; see isFixture().
 *   "http"         — a real CFM endpoint from MAKY_FITMENT_URL, validated at the
 *                    boundary like any other untrusted input.
 *
 * Credentials never leave the server: this module is `server-only` and no dataset field
 * is designed to carry one. The whole dataset is deliberately NOT shipped to the client
 * either — surfaces receive resolved answers and the slice of the tree they render.
 */

import { cache } from "react";

import { transportChecksum } from "./dataset-hash";
import { validateFitmentDataset } from "./validate";
import { isSimulatedDataset, type FitmentDataset } from "./contract";
import fixtureDataset from "./fixtures/dataset-v1.json";

export type FitmentProviderMode = "disabled" | "fixture" | "http";

export type FitmentProviderStatus = {
	mode: FitmentProviderMode;
	/** True when the answer came from committed test data rather than CFM. */
	isFixture: boolean;
	/** Why there is no dataset, when there is none. Diagnostics only, never customer copy. */
	unavailableReason: string | null;
	datasetVersion: string | null;
	generatedAt: string | null;
};

export type FitmentLoad = {
	dataset: FitmentDataset | null;
	status: FitmentProviderStatus;
};

const DEFAULT_TIMEOUT_MS = 5000;

/** Read at call time, not at module scope — the deploy can change it with a restart. */
export function resolveProviderMode(): FitmentProviderMode {
	const raw = process.env.MAKY_FITMENT_PROVIDER?.trim().toLowerCase();
	if (raw === "fixture") return "fixture";
	if (raw === "http") return "http";
	return "disabled";
}

function statusFor(
	mode: FitmentProviderMode,
	dataset: FitmentDataset | null,
	unavailableReason: string | null,
): FitmentProviderStatus {
	return {
		mode,
		// Demo-ness is a property of the DATA, not only of the mode. A dataset served over
		// HTTP that declares itself a fixture, or that carries its own demo catalogue, is
		// still demo data and must never be reported as REAL_DATA.
		isFixture: mode === "fixture" || isSimulatedDataset(dataset),
		unavailableReason,
		datasetVersion: dataset?.datasetVersion ?? null,
		generatedAt: dataset?.generatedAt ?? null,
	};
}

function expectedSaleorInstance(): string | undefined {
	const url = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!url) return undefined;
	try {
		return new URL(url).host;
	} catch {
		return undefined;
	}
}

function loadFixture(): FitmentLoad {
	const validation = validateFitmentDataset(fixtureDataset, {
		expectedSaleorInstance: expectedSaleorInstance(),
		// The committed demo is the one dataset that may carry the explicit non-hash
		// sentinel, because it is a code artefact rather than a delivery: swapping it
		// requires a commit, not a response body.
		allowUnhashedFixture: true,
	});
	if (!validation.ok) {
		// A broken committed fixture is a build-time mistake, but it must still not be
		// able to produce a fit claim — so it degrades exactly like a provider outage.
		console.error("[fitment] committed fixture failed validation:", validation.errors);
		return { dataset: null, status: statusFor("fixture", null, "fixture-invalid") };
	}
	return { dataset: validation.dataset, status: statusFor("fixture", validation.dataset, null) };
}

/**
 * The HTTP dataset: held in memory, answered at once, refreshed behind the read.
 *
 * ## Memory, because Next's data cache will not hold it
 *
 * The full CFM export is 7.9 MB, and Next refuses to store any data-cache entry over 2 MB:
 *
 *     Failed to set Next.js data cache … items over 2MB can not be cached (10637357 bytes)
 *
 * The fetch still succeeds, so nothing looks broken: the page renders, the resolver
 * answers, the tests pass. What silently stops happening is the caching — measured on a
 * production build against the live CFM URL, three PDP renders were three full downloads.
 * The pilot was 60 KB and cached correctly, which is why this only appeared with the real
 * dataset.
 *
 * ## A render never waits for a refresh
 *
 * The first memo refetched IN FRONT of whichever render found it expired. Every five
 * minutes one page waited for 8 MB, and then for a parse, a full validation and a
 * `datasetHash` recomputation that held the event loop for ~240 ms (measured on a build
 * of 228590b; production's heap is ten times the size). Production's PM2 log holds 45
 * `NEXT_STATIC_GEN_BAILOUT`s — a runtime prerender giving up, its request answered with a
 * bare 500 — and 38 of them are printed on the line straight after a reload's warnings,
 * where about 2 % of the log's other errors are (2026-09-30). None of those pages reads
 * the dataset in its shell, so what they share with the reload is its time on the event
 * loop.
 *
 * So the answer is now whatever is held, fresh or stale, and a stale entry is refreshed in
 * the background. The refresh runs detached from the render that noticed it
 * (`runDetached`): inside the render's context Next would count the download as the page's
 * own work. The only read that ever waits is a process's very first, and `register()`
 * makes that one at boot, before the server takes a request.
 *
 * ## An unchanged file costs almost nothing
 *
 * The URL names a versioned file, so nearly every refresh finds the same bytes. It asks
 * conditionally (`If-None-Match` / `If-Modified-Since` — CFM's server answers 304) and,
 * where a server keeps no validators, compares the transport SHA-256 with the bytes the
 * held dataset was validated from. Either way an unchanged file is neither parsed nor
 * validated again, and its warnings are not printed again. ANY other bytes are validated
 * in full, `datasetHash` recomputation included, before they may replace anything —
 * validation reads no clock, so identical bytes can only get the verdict they already had.
 *
 * ## A failed refresh keeps the dataset it failed to replace
 *
 * Stale-if-error. A timeout, a 404 or 503, a body that is not the dataset it claims to be:
 * none of these may turn a working configurator into an empty one. The held dataset stays,
 * the log says so, and the next attempt waits `NEGATIVE_TTL_MS` — long enough not to hammer
 * a broken upstream, short enough that recovery does not wait out the full TTL. With
 * nothing held, a failure is held for the same window instead.
 *
 * ## One per process, not one per bundle
 *
 * The page bundles and the sitemap route handlers are separate module graphs, each with its
 * own copy of this file, and each copy used to hold — and reload — its own 8 MB dataset.
 * The state lives on `globalThis`, so there is one memo, one refresh and one copy.
 *
 * Expiry is scheduled rather than compared against `Date.now()` on each read. The clock
 * read used to sit on the render path of every vehicle page, and under `cacheComponents`
 * that is refused while a non-prerendered route builds its shell — a 500 on every preview
 * market. See `src/lib/cache/expiring-memo.ts`.
 */
const NEGATIVE_TTL_MS = 30_000;

type Validators = { etag: string | null; lastModified: string | null };

const NO_VALIDATORS: Validators = { etag: null, lastModified: null };

/** A memo entry: the answer, and what it takes to revalidate it without a download. */
type Held = {
	load: FitmentLoad;
	/** SHA-256 of the exact bytes `load.dataset` was validated from; null with no dataset. */
	sha256: string | null;
	validators: Validators;
};

/** An entry that actually holds a dataset — the only kind a refresh may fall back to. */
type HeldDataset = Held & { load: FitmentLoad & { dataset: FitmentDataset } };

function holdsDataset(held: Held | null): held is HeldDataset {
	return held !== null && held.load.dataset !== null;
}

/** What one request to the upstream came back with, before it may touch the memo. */
type Attempt =
	| { kind: "new"; next: HeldDataset; bytes: number; warnings: string[] }
	| { kind: "same"; held: HeldDataset; bytes: number | null; validators: Validators }
	| { kind: "failed"; reason: string };

type ProviderState = {
	memo: ExpiringMemo<Held>;
	inflight: Map<string, Promise<Held>>;
};

const STATE = Symbol.for("maky.fitment.provider.v2");

type WithState = typeof globalThis & { [STATE]?: ProviderState };

function shared(): ProviderState {
	const scope = globalThis as WithState;
	return (scope[STATE] ??= { memo: createExpiringMemo<Held>(), inflight: new Map() });
}

/** Exported for tests only — there is no other way to observe a process-wide memo. */
export function __resetFitmentMemo(): void {
	const scope = globalThis as WithState;
	// A refresh still running writes into the state it started with, which this discards.
	scope[STATE]?.memo.clear();
	delete scope[STATE];
}

/** Exported for tests only: resolves once every refresh in flight has settled. */
export async function __settleFitmentRefreshes(): Promise<void> {
	await Promise.all(shared().inflight.values());
}

async function loadHttp(): Promise<FitmentLoad> {
	const url = process.env.MAKY_FITMENT_URL?.trim();
	if (!url) {
		return { dataset: null, status: statusFor("http", null, "missing-MAKY_FITMENT_URL") };
	}

	// Keyed by URL so that swapping MAKY_FITMENT_URL is not served a stale dataset.
	const state = shared();
	const held = state.memo.getStale(url);
	if (held) {
		// Fresh or stale, the answer is what is held. A stale entry is refreshed behind this
		// read, never in front of it.
		if (state.memo.get(url) === undefined) void refresh(state, url, held);
		return held.load;
	}
	// Nothing held: this process has not finished a single attempt for this URL. The one
	// read that waits for the network — and `register()` normally makes it at boot.
	return (await refresh(state, url, null)).load;
}

let warnedInRender = false;

/**
 * One attempt per URL at a time; every caller shares it. Never rejects: whatever happens,
 * it settles into the entry that is held afterwards.
 */
function refresh(state: ProviderState, url: string, held: Held | null): Promise<Held> {
	const running = state.inflight.get(url);
	if (running) return running;

	if (held && !hasRootContext() && process.env.NEXT_RUNTIME === "nodejs" && !warnedInRender) {
		warnedInRender = true;
		console.warn(
			"[fitment] no boot context was captured (register() did not run), so the background " +
				"refresh runs inside the render that noticed the stale entry",
		);
	}

	const promise = runDetached(async (): Promise<Held> => {
		const started = performance.now();
		try {
			const attempt = await attemptLoad(url, held);
			return settle(state, url, held, attempt, Math.round(performance.now() - started));
		} catch (error) {
			// `attemptLoad` catches everything it can anticipate; this is for what it cannot.
			console.error("[fitment] refresh threw:", error);
			return settle(state, url, held, { kind: "failed", reason: "refresh-threw" }, 0);
		} finally {
			state.inflight.delete(url);
		}
	});
	state.inflight.set(url, promise);
	return promise;
}

function describe(dataset: FitmentDataset): string {
	return `${dataset.datasetVersion} ${dataset.datasetHash}`;
}

/** Where a load came from, for the log: no credentials, no query string. */
function where(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.host}${parsed.pathname}`;
	} catch {
		return "MAKY_FITMENT_URL";
	}
}

function settle(state: ProviderState, url: string, held: Held | null, attempt: Attempt, ms: number): Held {
	const ttlMs = datasetRevalidateSeconds() * 1000;

	if (attempt.kind === "new") {
		if (attempt.warnings.length > 0) {
			console.warn("[fitment] provider payload warnings:", attempt.warnings);
		}
		state.memo.set(url, attempt.next, ttlMs);
		// One line per dataset taken into use: which one this process is answering from, and
		// what it cost. CFM asks exactly this before every publication batch.
		console.log(`[fitment] loaded ${describe(attempt.next.load.dataset)} (${attempt.bytes} B, ${ms} ms)`);
		return attempt.next;
	}

	if (attempt.kind === "same") {
		const next: HeldDataset = { ...attempt.held, validators: attempt.validators };
		state.memo.set(url, next, ttlMs);
		const how = attempt.bytes === null ? "304 not modified" : `${attempt.bytes} B, same bytes`;
		console.log(`[fitment] unchanged ${describe(next.load.dataset)} (${how}, ${ms} ms)`);
		return next;
	}

	if (holdsDataset(held)) {
		// Stale-if-error: the dataset that was working keeps working.
		state.memo.set(url, held, NEGATIVE_TTL_MS);
		const kept = describe(held.load.dataset);
		console.error(
			`[fitment] refresh failed (${attempt.reason}) from ${where(url)}; keeping ${kept}, ` +
				`next attempt in ${NEGATIVE_TTL_MS / 1000} s`,
		);
		return held;
	}

	const failed: Held = {
		load: { dataset: null, status: statusFor("http", null, attempt.reason) },
		sha256: null,
		validators: NO_VALIDATORS,
	};
	state.memo.set(url, failed, NEGATIVE_TTL_MS);
	console.error(
		`[fitment] load failed (${attempt.reason}) from ${where(url)}; no dataset to serve, ` +
			`next attempt in ${NEGATIVE_TTL_MS / 1000} s`,
	);
	return failed;
}

function validatorsOf(response: Response, fallback: Validators): Validators {
	return {
		etag: response.headers.get("etag") ?? fallback.etag,
		lastModified: response.headers.get("last-modified") ?? fallback.lastModified,
	};
}

async function attemptLoad(url: string, held: Held | null): Promise<Attempt> {
	const timeoutMs = Number(process.env.MAKY_FITMENT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
	const token = process.env.MAKY_FITMENT_TOKEN?.trim();

	// Asked conditionally only while a dataset is held: "not modified" is an answer only if
	// there is something it refers to.
	const good = holdsDataset(held) ? held : null;
	const headers: Record<string, string> = {};
	if (token) headers.authorization = `Bearer ${token}`;
	if (good?.validators.etag) headers["if-none-match"] = good.validators.etag;
	if (good?.validators.lastModified) headers["if-modified-since"] = good.validators.lastModified;

	let response: Response;
	try {
		response = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS),
			// Detached from any render (see `refresh`), Next's patched fetch passes this call
			// straight through and the hint below is never read. It stays for the one path that
			// is not detached — a server that skipped `register()` — where an explicit cache
			// setting keeps a prerender from handing this fetch a promise that never settles.
			next: { revalidate: datasetRevalidateSeconds(), tags: ["fitment-dataset"] },
		});
	} catch (error) {
		console.error("[fitment] provider fetch failed:", error);
		return { kind: "failed", reason: "fetch-failed" };
	}

	if (response.status === 304 && good) {
		return { kind: "same", held: good, bytes: null, validators: validatorsOf(response, good.validators) };
	}
	if (!response.ok) {
		// A 404 or 503 used to leave no trace at all: the configurator emptied and the log was
		// silent about why.
		console.error(`[fitment] provider answered HTTP ${response.status} for ${where(url)}`);
		return { kind: "failed", reason: `http-${response.status}` };
	}

	let bytes: Uint8Array;
	try {
		bytes = new Uint8Array(await response.arrayBuffer());
	} catch (error) {
		// The headers arrived and the body did not: a timeout or a reset mid-transfer.
		console.error("[fitment] provider fetch failed:", error);
		return { kind: "failed", reason: "fetch-failed" };
	}
	const validators = validatorsOf(response, NO_VALIDATORS);
	const sha256 = transportChecksum(bytes);
	if (good && good.sha256 === sha256) {
		return { kind: "same", held: good, bytes: bytes.byteLength, validators };
	}

	// The exact bytes as text, not `.json()`. They are needed twice over: the semantic
	// `datasetHash` is only reproducible against CFM's Python when every number is
	// re-emitted from its original source token, and the transport checksum is by
	// definition a fact about the bytes and cannot be recovered from a parsed object.
	// `TextDecoder` drops a leading BOM exactly as `response.text()` did.
	const text = new TextDecoder().decode(bytes);
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		console.error(`[fitment] provider payload is not JSON (${bytes.byteLength} B from ${where(url)})`);
		return { kind: "failed", reason: "payload-not-json" };
	}
	const validation = validateFitmentDataset(body, {
		expectedSaleorInstance: expectedSaleorInstance(),
		rawText: text,
	});
	if (!validation.ok) {
		console.error("[fitment] provider payload failed validation:", validation.errors);
		return { kind: "failed", reason: "payload-invalid" };
	}
	return {
		kind: "new",
		next: {
			load: { dataset: validation.dataset, status: statusFor("http", validation.dataset, null) },
			sha256,
			validators,
		},
		bytes: bytes.byteLength,
		warnings: validation.warnings,
	};
}

function datasetRevalidateSeconds(): number {
	const raw = Number(process.env.MAKY_FITMENT_REVALIDATE_SECONDS ?? 300);
	return Number.isFinite(raw) && raw > 0 ? raw : 300;
}

/**
 * Load the HTTP dataset once at boot, so that no render ever waits for the first download.
 *
 * Called from `register()`, which `next start` finishes before it serves a request. Never
 * throws: a boot during a CFM outage holds the failure for `NEGATIVE_TTL_MS` and retries in
 * the background, exactly like a failure at any other time.
 */
export async function prewarmFitmentDataset(): Promise<void> {
	if (resolveProviderMode() !== "http") return;
	await loadHttp();
}

/**
 * Load the active dataset. Never throws: a failure here must degrade the compatibility
 * UI, not take down a product page that is otherwise perfectly able to sell something.
 *
 * Wrapped in React `cache()` so that the several places which need it during one render
 * — the page, the compatibility box, the selector — share a single load instead of
 * validating the whole index once each.
 */
export const loadFitmentDataset = cache(async function loadFitmentDataset(): Promise<FitmentLoad> {
	const mode = resolveProviderMode();
	if (mode === "disabled") {
		return { dataset: null, status: statusFor("disabled", null, "provider-disabled") };
	}
	if (mode === "fixture") return loadFixture();
	return loadHttp();
});
