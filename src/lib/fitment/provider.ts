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

import { validateFitmentDataset } from "./validate";
import { type FitmentDataset } from "./contract";
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
		isFixture: mode === "fixture" || dataset?.source.system === "fixture",
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
			// The dataset is versioned upstream; caching is handled by the caller's
			// "use cache" boundary so that a request cannot be made per page view.
			cache: "no-store",
		});
		if (!response.ok) {
			return { dataset: null, status: statusFor("http", null, `http-${response.status}`) };
		}
		const body: unknown = await response.json();
		const validation = validateFitmentDataset(body, {
			expectedSaleorInstance: expectedSaleorInstance(),
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

/**
 * Load the active dataset. Never throws: a failure here must degrade the compatibility
 * UI, not take down a product page that is otherwise perfectly able to sell something.
 */
export async function loadFitmentDataset(): Promise<FitmentLoad> {
	const mode = resolveProviderMode();
	if (mode === "disabled") {
		return { dataset: null, status: statusFor("disabled", null, "provider-disabled") };
	}
	if (mode === "fixture") return loadFixture();
	return loadHttp();
}
