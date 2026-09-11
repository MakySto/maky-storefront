/**
 * The CFM catalogue-content snapshot, as the exporter actually writes it.
 *
 * Source of truth is `catalog-content-1.0.0.json` in `MakySto/CarFitManager-4`
 * (read at `794c431`). Measured against the real 9.68 MB artifact
 * `maky_catalog_content_1.0.0-sk-20260911.json` on 2026-09-11, not transcribed
 * from the handoff — two things in the prose did not survive that check and are
 * recorded where they matter: `top`/`body` are NOT materialised in this export
 * (see `text.ts`), and roof types live on the APPLICATION, not the product (see
 * the offer code).
 *
 * Identity, stated once because it is the thing most easily got wrong:
 *
 *   publicId   identifies the PAGE
 *   vehicleId  identifies the VEHICLE, and is the only key that may join this
 *              snapshot to the fitment snapshot
 *
 * Joining on `urlPath` would appear to work today — measured, 0 mismatches — and
 * would come apart silently the first time a slug is renamed, which is precisely
 * why CFM keeps a URL history at all.
 */

/** `intro`, `top` and `body` are all EditorJS-shaped block documents. */
export interface BlockDocument {
	readonly blocks: readonly ContentBlock[];
}

export type ContentBlock =
	| { readonly type: "paragraph"; readonly data: { readonly text: string } }
	/** The schema permits levels 2 and 3. This export uses only 2; handle both. */
	| { readonly type: "header"; readonly data: { readonly text: string; readonly level: 2 | 3 } }
	| {
			readonly type: "list";
			readonly data: { readonly style: "unordered" | "ordered"; readonly items: readonly string[] };
	  };

export type PageKind = "vehicle_make" | "vehicle_model" | "vehicle_generation";
export type PageState = "draft" | "published" | "retired";

/**
 * One catalogue page.
 *
 * `state`, `indexable` and `vehicleId` are typed optional ON PURPOSE: the schema's
 * `required` list is `publicId, kind, urlPath, intro, top, body, hasEditorialText`
 * and nothing more. A missing decision field must never be read as "published" or
 * "indexable" — see `publication.ts`.
 */
export interface CatalogContentPage {
	readonly publicId: string;
	readonly vehicleId?: string | null;
	readonly kind: PageKind;
	readonly assortment?: string;
	readonly state?: PageState;
	readonly indexable?: boolean;
	readonly slug?: string;
	/** Language-agnostic path, no market prefix: `/stresne-nosice/bmw`. */
	readonly urlPath: string;
	readonly navName?: string;
	readonly h1?: string;
	readonly metaTitle?: string;
	readonly metaDescription?: string;
	readonly hasEditorialText: boolean;
	readonly intro?: BlockDocument | null;
	readonly top?: BlockDocument | null;
	readonly body?: BlockDocument | null;
}

export interface CatalogContentSnapshot {
	readonly artifact: "CATALOG_CONTENT_SNAPSHOT";
	readonly schemaVersion: string;
	readonly generatedAt: string;
	readonly language: string;
	readonly assortment?: string;
	readonly counts?: Record<string, unknown>;
	readonly pages: readonly CatalogContentPage[];
	readonly selfSha256?: string;
}

/** The snapshot this consumer understands. A different major is not a warning. */
export const SUPPORTED_CONTENT_SCHEMA_MAJOR = "1";

export function isSupportedContentSchema(schemaVersion: string): boolean {
	return schemaVersion.split(".")[0] === SUPPORTED_CONTENT_SCHEMA_MAJOR;
}

/**
 * Structural check at the boundary, on data that crosses a network.
 *
 * Deliberately shallow: it proves the shape the consumer indexes on, and leaves
 * per-page editorial questions to the publication gate. A snapshot that fails
 * here must not replace a good one.
 */
export function parseContentSnapshot(value: unknown): CatalogContentSnapshot {
	if (typeof value !== "object" || value === null) throw new Error("content snapshot is not an object");
	const snapshot = value as Partial<CatalogContentSnapshot>;

	if (snapshot.artifact !== "CATALOG_CONTENT_SNAPSHOT") {
		throw new Error(`unexpected artifact ${JSON.stringify(snapshot.artifact)}`);
	}
	if (typeof snapshot.schemaVersion !== "string" || !isSupportedContentSchema(snapshot.schemaVersion)) {
		throw new Error(`unsupported content schemaVersion ${JSON.stringify(snapshot.schemaVersion)}`);
	}
	if (typeof snapshot.language !== "string" || snapshot.language.length === 0) {
		throw new Error("content snapshot carries no language");
	}
	if (!Array.isArray(snapshot.pages) || snapshot.pages.length === 0) {
		throw new Error("content snapshot carries no pages");
	}
	for (const page of snapshot.pages) {
		if (typeof page?.publicId !== "string" || typeof page?.urlPath !== "string") {
			throw new Error("a page is missing publicId or urlPath");
		}
		if (!page.urlPath.startsWith("/")) {
			throw new Error(`urlPath is not an absolute path: ${page.urlPath}`);
		}
	}
	return snapshot as CatalogContentSnapshot;
}
