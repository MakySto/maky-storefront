import "server-only";

import { catalogLanguageForMarket } from "@/lib/catalog-content/language";

import type { ReleaseFault, TyreFileEntry } from "./manifest";
import type { ReleaseView, TargetView } from "./sync";

/**
 * What this ONE process reports to CFM about the catalogue it is serving.
 *
 * Contract: `MAKY_RELEASE_MANIFEST_CONTRACT.md` section 6, with its JSON Schema
 * (`maky-storefront-catalog-status-1.0.0.schema.json`) in CarFitManager-4. CFM reads this over plain GETs,
 * several in a row because behind a balancer each answers from a different process, and confirms a target
 * as adopted only when every live process reports the file CFM delivered as `active`.
 *
 * Built from a copy of the process's state and from read-only peeks at the older settings. Nothing here
 * loads, fetches or writes, so asking can never cause what is being asked about.
 *
 * What `state` and `sha256` mean is the part that matters, because CFM trusts it:
 *
 *   active   the process is serving exactly the file the manifest names for the target, verified
 *   stale    it is serving something older that was verified (an earlier manifest file, or the older
 *            settings' file), because the file the manifest names did not verify or is not here yet
 *   missing  it is serving nothing for the target
 *
 * `sha256` is always the file in USE, never the one being fetched; `source` says where it came from, and
 * only `manifest` + `active` confirms an adoption. A hash is not a status: a process that holds the right
 * bytes through the older settings has not adopted the release.
 */

export const STATUS_ARTIFACT = "MAKY_STOREFRONT_CATALOG_STATUS";
export const STATUS_SCHEMA_VERSION = "1.0.0";

type State = "active" | "stale" | "missing";
type Source = "manifest" | "legacy" | "none";
type StatusError = { readonly code: string; readonly message: string } | null;

export type TargetStatus = {
	readonly file: string | null;
	readonly sha256: string | null;
	readonly release: number | null;
	readonly language: string | null;
	readonly pages: number | null;
	readonly state: State;
	readonly source: Source;
	readonly activatedAt: string | null;
	readonly error: StatusError;
};

export type FitmentStatus = {
	readonly file: string | null;
	readonly sha256: string | null;
	/** The semantic hash this process recomputed from the text itself, not the one the manifest states. */
	readonly datasetHash: string | null;
	readonly datasetVersion: string | null;
	readonly release: number | null;
	readonly state: State;
	readonly source: Source;
	readonly activatedAt: string | null;
	readonly error: StatusError;
};

type TyreFileStatus = {
	readonly file: string | null;
	readonly sha256: string | null;
	/** The seal of the file in use, recomputed from its content by this process. */
	readonly selfSha256: string | null;
};

/**
 * The snow-chain tyre-size list and its model families: one pair, one status.
 *
 * `source` is `manifest` for a pair this process verified from a manifest file, and `build` for the copy the
 * build carries, which answers until the first pair has verified. Only `manifest` + `active` confirms that a
 * published pair was adopted: a build that happens to carry the same list has not taken the release.
 */
export type TyreSizesStatus = {
	readonly id: string | null;
	readonly release: number | null;
	readonly index: TyreFileStatus;
	readonly families: TyreFileStatus;
	readonly state: State;
	readonly source: "manifest" | "build" | "none";
	readonly activatedAt: string | null;
	readonly error: StatusError;
};

export type CatalogStatusDocument = {
	readonly artifact: typeof STATUS_ARTIFACT;
	readonly schemaVersion: typeof STATUS_SCHEMA_VERSION;
	readonly process: { readonly bootId: string; readonly pid?: number; readonly startedAt?: string };
	readonly capabilities: { readonly contentByTarget: boolean };
	readonly manifest: {
		readonly version: number | null;
		readonly sha256: string | null;
		readonly checkedAt: string | null;
		readonly outcome: "new" | "unchanged" | "failed" | null;
		readonly error: StatusError;
	};
	readonly content: { readonly targets: Readonly<Record<string, TargetStatus>> };
	readonly fitment: FitmentStatus | null;
	/**
	 * Present once a manifest has named a pair (or a `tyreSizes` section this build could not read), absent
	 * before: a process that was never asked for one has nothing to confirm, and the document then is exactly
	 * the 1.0.0 one.
	 */
	readonly tyreSizes?: TyreSizesStatus;
};

/** What the older settings hold right now. Peeks only: they never trigger a load. */
export type LegacyPeek = {
	readonly content: (
		language: string,
	) => { readonly sha256: string | null; readonly pageCount: number } | null;
	readonly fitment: () => {
		readonly sha256: string | null;
		readonly datasetHash: string | null;
		readonly datasetVersion: string | null;
	} | null;
	/** The pair the build carries, which is what answers while no manifest pair is active. */
	readonly tyreSizes?: () => {
		readonly id: string;
		readonly indexSeal: string;
		readonly familiesSeal: string;
	} | null;
};

/** An ISO string from a stored timestamp. `new Date(ms)` is not a clock read; `new Date()` would be. */
function iso(ms: number | null): string | null {
	return ms === null ? null : new Date(ms).toISOString();
}

function error(fault: ReleaseFault | null): StatusError {
	return fault ? { code: fault.code, message: fault.message } : null;
}

function targetStatus(view: TargetView, legacy: LegacyPeek): TargetStatus {
	const language =
		view.active?.entry.language ?? view.desired?.language ?? catalogLanguageForMarket(view.market);
	if (view.active) {
		const { entry, pageCount, activatedAt } = view.active;
		const current = view.desired === null || view.desired.sha256 === entry.sha256;
		return {
			file: entry.file,
			sha256: entry.sha256,
			release: entry.release,
			language,
			pages: pageCount,
			state: current ? "active" : "stale",
			source: "manifest",
			activatedAt: iso(activatedAt),
			error: current ? null : error(view.fault),
		};
	}
	const held = language ? legacy.content(language) : null;
	return {
		file: null,
		sha256: held?.sha256 ?? null,
		release: null,
		language,
		pages: held?.pageCount ?? null,
		state: held ? "stale" : "missing",
		source: held ? "legacy" : "none",
		activatedAt: null,
		error: error(view.fault),
	};
}

function fitmentStatus(view: ReleaseView["fitment"], legacy: LegacyPeek): FitmentStatus | null {
	if (view.active) {
		const { entry, datasetHash, activatedAt } = view.active;
		const current = view.desired === null || view.desired.sha256 === entry.sha256;
		return {
			file: entry.file,
			sha256: entry.sha256,
			datasetHash,
			datasetVersion: entry.datasetVersion,
			release: entry.release,
			state: current ? "active" : "stale",
			source: "manifest",
			activatedAt: iso(activatedAt),
			error: current ? null : error(view.fault),
		};
	}
	// The manifest names no fitment: there is nothing for CFM to confirm and nothing to report.
	if (!view.desired) return null;
	const held = legacy.fitment();
	return {
		file: null,
		sha256: held?.sha256 ?? null,
		datasetHash: held?.datasetHash ?? null,
		datasetVersion: held?.datasetVersion ?? null,
		release: null,
		state: held ? "stale" : "missing",
		source: held ? "legacy" : "none",
		activatedAt: null,
		error: error(view.fault),
	};
}

function tyreFile(entry: TyreFileEntry): TyreFileStatus {
	return { file: entry.file, sha256: entry.sha256, selfSha256: entry.selfSha256 };
}

function tyreSizesStatus(view: ReleaseView["tyreSizes"], legacy: LegacyPeek): TyreSizesStatus | undefined {
	if (view.active) {
		const { entry, activatedAt } = view.active;
		const wanted = view.desired;
		const current =
			view.fault === null &&
			(wanted === null ||
				(wanted.release === entry.release &&
					wanted.index.sha256 === entry.index.sha256 &&
					wanted.families.sha256 === entry.families.sha256));
		return {
			id: entry.id,
			release: entry.release,
			index: tyreFile(entry.index),
			families: tyreFile(entry.families),
			state: current ? "active" : "stale",
			source: "manifest",
			activatedAt: iso(activatedAt),
			error: current ? null : error(view.fault),
		};
	}
	// No manifest has asked for a pair: nothing for CFM to confirm, and nothing to report.
	if (!view.desired && !view.fault) return undefined;
	const held = legacy.tyreSizes?.() ?? null;
	return {
		id: held?.id ?? null,
		release: null,
		index: { file: null, sha256: null, selfSha256: held?.indexSeal ?? null },
		families: { file: null, sha256: null, selfSha256: held?.familiesSeal ?? null },
		state: held ? "stale" : "missing",
		source: held ? "build" : "none",
		activatedAt: null,
		error: error(view.fault),
	};
}

/**
 * `operator` adds what identifies the process (its pid and start time) for someone who holds the
 * revalidate secret. Everything else is the same for everyone and carries nothing secret: file names,
 * hashes, counts, and error text that never contains a URL with credentials.
 */
export function buildCatalogStatus(
	view: ReleaseView,
	legacy: LegacyPeek,
	options: { readonly operator: boolean },
): CatalogStatusDocument {
	const targets: Record<string, TargetStatus> = {};
	for (const target of [...view.targets].sort((a, b) => a.market.localeCompare(b.market))) {
		targets[target.market] = targetStatus(target, legacy);
	}
	const tyreSizes = tyreSizesStatus(view.tyreSizes, legacy);
	return {
		artifact: STATUS_ARTIFACT,
		schemaVersion: STATUS_SCHEMA_VERSION,
		process: options.operator
			? { bootId: view.bootId, pid: process.pid, startedAt: iso(view.startedAt) ?? undefined }
			: { bootId: view.bootId },
		// True exactly when this process picks the content file by market. Only release mode does, so a
		// process that is not following a manifest says false and CFM refuses to split DE from AT.
		capabilities: { contentByTarget: view.setting.kind === "on" },
		manifest: {
			version: view.manifest.version,
			sha256: view.manifest.sha256,
			checkedAt: iso(view.manifest.checkedAt),
			outcome: view.manifest.outcome,
			error: error(view.manifest.fault),
		},
		content: { targets },
		fitment: fitmentStatus(view.fitment, legacy),
		...(tyreSizes ? { tyreSizes } : {}),
	};
}
