import "server-only";

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

async function loadHttp(): Promise<FitmentLoad> {
	const url = process.env.MAKY_FITMENT_URL?.trim();
	if (!url) {
		return { dataset: null, status: statusFor("http", null, "missing-MAKY_FITMENT_URL") };
	}
	const timeoutMs = Number(process.env.MAKY_FITMENT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
	const token = process.env.MAKY_FITMENT_TOKEN?.trim();

	try {
		const response = await fetch(url, {
			headers: token ? { authorization: `Bearer ${token}` } : undefined,
			signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS),
			// Shared across requests. The dataset is a versioned document, not per-visitor
			// data, and it is large: the selector alone asks for it once per step, so
			// `no-store` here meant re-downloading the whole index on every click.
			//
			// Nothing customer-specific is ever in this response — the vehicle lives in a
			// cookie and is resolved against the dataset afterwards — so it is safe to
			// share. Freshness comes from the upstream `datasetVersion`, not from this TTL.
			next: { revalidate: datasetRevalidateSeconds(), tags: ["fitment-dataset"] },
		});
		if (!response.ok) {
			return { dataset: null, status: statusFor("http", null, `http-${response.status}`) };
		}
		// Text, not `.json()`. The exact bytes are needed twice over: the semantic
		// `datasetHash` is only reproducible against CFM's Python when every number is
		// re-emitted from its original source token, and the transport checksum is by
		// definition a fact about the bytes and cannot be recovered from a parsed object.
		const text = await response.text();
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return { dataset: null, status: statusFor("http", null, "payload-not-json") };
		}
		const validation = validateFitmentDataset(body, {
			expectedSaleorInstance: expectedSaleorInstance(),
			rawText: text,
		});
		if (!validation.ok) {
			console.error("[fitment] provider payload failed validation:", validation.errors);
			return { dataset: null, status: statusFor("http", null, "payload-invalid") };
		}
		if (validation.warnings.length > 0) {
			console.warn("[fitment] provider payload warnings:", validation.warnings);
		}
		return { dataset: validation.dataset, status: statusFor("http", validation.dataset, null) };
	} catch (error) {
		console.error("[fitment] provider fetch failed:", error);
		return { dataset: null, status: statusFor("http", null, "fetch-failed") };
	}
}

function datasetRevalidateSeconds(): number {
	const raw = Number(process.env.MAKY_FITMENT_REVALIDATE_SECONDS ?? 300);
	return Number.isFinite(raw) && raw > 0 ? raw : 300;
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
