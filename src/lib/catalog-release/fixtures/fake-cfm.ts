import { createHash } from "node:crypto";

import { vi } from "vitest";

import { datasetHashFromText, transportChecksum } from "@/lib/fitment/dataset-hash";
import fixtureDataset from "@/lib/fitment/fixtures/dataset-v1.json";

import { manifestSelfSha256 } from "../manifest";
import { __resetReleaseState, __setReleaseClock } from "../sync";

/**
 * A stand-in for CFM, for tests of the release loader.
 *
 * It serves a manifest and the files the manifest names from one https origin, answers conditional GETs the
 * way nginx does, records every request, and lets a test break one URL at a time. Nothing here is a mock of
 * the loader's own code: the loader runs unchanged against `fetch`, which is the only seam it has.
 *
 * Files are content-addressed exactly as CFM names them (`…-<first 16 hex of sha256>.json`), so a test that
 * wants "the same bytes under two markets" or "new bytes for one" gets that by construction.
 */

export const BASE = "https://cfm.example/media/fitment/releases/";
export const POINTER = `${BASE}MANIFEST.json`;
export const SALEOR_HOST = "api.maky.store";

const encoder = new TextEncoder();

/** A manifest as a test edits it: untyped on purpose, because the point is to be able to break any field. */
export type Doc = Record<string, any>;

export type ContentFile = {
	readonly name: string;
	readonly bytes: Uint8Array;
	readonly sha256: string;
	readonly language: string;
	readonly pages: number;
};

/**
 * A content snapshot as CFM's exporter writes it, small enough to build in a test. `edition` changes the
 * bytes, and therefore the name and the hash, without changing anything else.
 */
export function contentFile(language: string, edition = "a", pages = 3): ContentFile {
	const snapshot = {
		artifact: "CATALOG_CONTENT_SNAPSHOT",
		schemaVersion: "1.0.0",
		generatedAt: "2026-10-05T09:00:00.000000+00:00",
		language,
		assortment: "roof_racks",
		pages: Array.from({ length: pages }, (_, i) => ({
			publicId: `pg:${language}:${i}`,
			vehicleId: `veh:${i}`,
			kind: "vehicle_make",
			urlPath: `/stresne-nosice/make-${i}`,
			hasEditorialText: true,
			state: "published",
			indexable: true,
			intro: { blocks: [{ type: "paragraph", data: { text: `${language}/${edition}/${i}` } }] },
			top: [],
			body: [],
		})),
	};
	const bytes = encoder.encode(JSON.stringify(snapshot));
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	return {
		name: `maky_catalog_content_1.0.0-${language}-${sha256.slice(0, 16)}.json`,
		bytes,
		sha256,
		language,
		pages,
	};
}

/** Any bytes at all, named and hashed the way CFM would name them: for a file that is wrong in a way the loader must catch. */
export function rawContentFile(language: string, text: string): ContentFile {
	const bytes = encoder.encode(text);
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	return {
		name: `maky_catalog_content_1.0.0-${language}-${sha256.slice(0, 16)}.json`,
		bytes,
		sha256,
		language,
		pages: 0,
	};
}

export type FitmentFile = {
	readonly name: string;
	readonly bytes: Uint8Array;
	/** SHA-256 of the exact bytes. */
	readonly sha256: string;
	/** The semantic hash, as CFM states it. */
	readonly datasetHash: string;
	readonly datasetVersion: string;
	readonly schemaVersion: string;
};

/** A payload shaped like a real delivery: no demo catalogue, the real instance, a hash that matches. */
export function fitmentFile(
	datasetVersion = "3.0.0-test.1",
	overrides: Record<string, unknown> = {},
): FitmentFile {
	const dataset = JSON.parse(JSON.stringify(fixtureDataset)) as Doc;
	delete dataset.demoCatalogue;
	dataset.source = { system: "cfm" };
	dataset.saleorInstance = SALEOR_HOST;
	dataset.datasetVersion = datasetVersion;
	Object.assign(dataset, overrides);
	delete dataset.datasetHash;
	const datasetHash = datasetHashFromText(JSON.stringify(dataset));
	dataset.datasetHash = datasetHash;
	const bytes = encoder.encode(JSON.stringify(dataset));
	const sha256 = transportChecksum(bytes);
	return {
		name: `maky_fitment_${dataset.datasetVersion}-${sha256.slice(0, 16)}.json`,
		bytes,
		sha256,
		datasetHash,
		datasetVersion: String(dataset.datasetVersion),
		schemaVersion: String(dataset.schemaVersion),
	};
}

/** The same, for a dataset: bytes that are not a delivery, with a hash that says they are the delivery. */
export function rawFitmentFile(text: string): FitmentFile {
	const bytes = encoder.encode(text);
	const sha256 = transportChecksum(bytes);
	return {
		name: `maky_fitment_raw-${sha256.slice(0, 16)}.json`,
		bytes,
		sha256,
		datasetHash: "a".repeat(64),
		datasetVersion: "3.0.0-raw",
		schemaVersion: "3.0.0",
	};
}

export type TargetSpec = {
	readonly file: ContentFile;
	readonly release: number;
	/** Only to state something the file does not say, so that a test can make them disagree. */
	readonly language?: string;
	readonly pages?: number | null;
};

export type ManifestSpec = {
	readonly version: number;
	readonly targets: Readonly<Record<string, TargetSpec>>;
	readonly fitment?: { readonly file: FitmentFile; readonly release: number } | null;
	/** Change the document before it is sealed, to build the one wrong thing a test is about. */
	readonly edit?: (document: Doc) => void;
};

/** The manifest as CFM writes it: same keys, same order, sealed with the digest of its own body. */
export function manifestDocument(spec: ManifestSpec): Doc {
	const targets: Doc = {};
	for (const [market, target] of Object.entries(spec.targets)) {
		targets[market] = {
			market,
			language: target.language ?? target.file.language,
			file: target.file.name,
			sha256: target.file.sha256,
			bytes: target.file.bytes.byteLength,
			release: target.release,
			pages: target.pages === undefined ? target.file.pages : target.pages,
		};
	}
	const { fitment } = spec;
	const document: Doc = {
		artifact: "MAKY_RELEASE_MANIFEST",
		schemaVersion: "1.0.0",
		manifestVersion: spec.version,
		generatedAt: "2026-10-05T09:30:12.481230+00:00",
		publisher: "carfitmanager",
		base: BASE,
		rules: {
			activation: "per-target",
			contentSelection: "by-target",
			contentAndFitment: "independent",
			sharedFiles: "identical-bytes-share-one-file",
		},
		content: { contract: { artifact: "CATALOG_CONTENT_SNAPSHOT", schemaVersion: "1.0.0" }, targets },
		fitment: fitment
			? {
					file: fitment.file.name,
					sha256: fitment.file.sha256,
					bytes: fitment.file.bytes.byteLength,
					release: fitment.release,
					contract: { schemaVersion: fitment.file.schemaVersion },
					datasetVersion: fitment.file.datasetVersion,
					datasetHash: fitment.file.datasetHash,
				}
			: null,
	};
	spec.edit?.(document);
	document.selfSha256 = manifestSelfSha256(document);
	return document;
}

export type Hit = { readonly url: string; readonly headers: Readonly<Record<string, string>> };
export type Handler = (hit: Hit) => Response | Promise<Response>;

export function respond(bytes: Uint8Array | string, headers: Record<string, string> = {}): Response {
	const body = typeof bytes === "string" ? encoder.encode(bytes) : bytes;
	return new Response(body, {
		status: 200,
		headers: { "content-length": String(body.byteLength), ...headers },
	});
}

export function status(code: number): Response {
	return new Response(code === 304 ? null : `HTTP ${code}`, { status: code });
}

export function redirect(location: string, code = 302): Response {
	return new Response(null, { status: code, headers: { location } });
}

export class FakeCfm {
	readonly hits: Hit[] = [];
	private readonly files = new Map<string, Uint8Array>();
	private pointer: Uint8Array | null = null;
	private readonly overrides = new Map<string, Handler>();

	/** Route the process's `fetch` here. Undone by `vi.unstubAllGlobals()`. */
	install(): void {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL, init?: RequestInit) => this.handle(String(input), init)),
		);
	}

	/** Seal and serve a manifest, and make every file it names fetchable. Returns the document. */
	publish(spec: ManifestSpec): Doc {
		const document = manifestDocument(spec);
		for (const target of Object.values(spec.targets)) this.add(target.file);
		if (spec.fitment) this.add(spec.fitment.file);
		this.serve(encoder.encode(JSON.stringify(document, null, 1)));
		return document;
	}

	/** Serve these exact bytes at the pointer. */
	serve(bytes: Uint8Array | string): void {
		this.pointer = typeof bytes === "string" ? encoder.encode(bytes) : bytes;
	}

	add(file: { readonly name: string; readonly bytes: Uint8Array }): void {
		this.files.set(file.name, file.bytes);
	}

	/** Answer a path under the base (`MANIFEST.json`, a file name) or a full URL differently from here on. */
	override(path: string, handler: Handler): void {
		this.overrides.set(path, handler);
	}

	restore(path: string): void {
		this.overrides.delete(path);
	}

	/** How many times a file, or the pointer (`MANIFEST.json`), was asked for. */
	count(path: string): number {
		return this.hits.filter((hit) => this.pathOf(hit.url) === path).length;
	}

	/** Forget what was asked so far, so a test can assert on what the NEXT pass does and nothing else. */
	forget(): void {
		this.hits.length = 0;
	}

	private pathOf(url: string): string {
		return url.startsWith(BASE) ? url.slice(BASE.length) : url;
	}

	private async handle(url: string, init?: RequestInit): Promise<Response> {
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
			headers[key.toLowerCase()] = value;
		}
		const hit: Hit = { url, headers };
		this.hits.push(hit);

		const path = this.pathOf(url);
		const override = this.overrides.get(path);
		if (override) return override(hit);

		if (path === "MANIFEST.json") {
			if (!this.pointer) return status(404);
			const etag = `"${createHash("sha256").update(this.pointer).digest("hex").slice(0, 16)}"`;
			if (headers["if-none-match"] === etag) return new Response(null, { status: 304, headers: { etag } });
			return respond(this.pointer, { etag, "content-type": "application/json" });
		}
		const file = this.files.get(path);
		return file ? respond(file, { "content-type": "application/json" }) : status(404);
	}
}

const ENV = [
	"MAKY_RELEASE_MANIFEST_URL",
	"MAKY_RELEASE_POLL_SECONDS",
	"MAKY_RELEASE_MANIFEST_TIMEOUT_MS",
	"MAKY_RELEASE_FILE_TIMEOUT_MS",
	"MAKY_CATALOG_CONTENT_PATH",
	"MAKY_CATALOG_CONTENT_URL",
	"MAKY_CATALOG_CONTENT_SHA256",
	"MAKY_CATALOG_CONTENT_SHA256SUMS",
	"MAKY_FITMENT_PROVIDER",
	"MAKY_FITMENT_URL",
	"NEXT_PUBLIC_SALEOR_API_URL",
] as const;

export type Harness = {
	readonly cfm: FakeCfm;
	/** The loader's clock in milliseconds. Assign to move time. */
	readonly clock: { now: number };
	/** Put the environment, the clock and `fetch` back. Call it from `afterEach`. */
	restore(): void;
};

/**
 * The world every loader test starts from: release mode on and pointed at the stand-in, the Saleor host
 * the fixtures were built for, no older content or fitment setting, a clean process-wide state, and a
 * clock the test moves by hand. Call it from `beforeEach`, and `restore()` from `afterEach`.
 */
export function arrangeRelease(): Harness {
	const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
	for (const key of ENV) delete process.env[key];
	process.env.MAKY_RELEASE_MANIFEST_URL = POINTER;
	process.env.NEXT_PUBLIC_SALEOR_API_URL = `https://${SALEOR_HOST}/graphql/`;
	__resetReleaseState();
	const clock = { now: 1_800_000_000_000 };
	__setReleaseClock(() => clock.now);
	const cfm = new FakeCfm();
	cfm.install();
	return {
		cfm,
		clock,
		restore() {
			__resetReleaseState();
			__setReleaseClock(null);
			vi.unstubAllGlobals();
			for (const key of ENV) {
				if (saved[key] === undefined) delete process.env[key];
				else process.env[key] = saved[key];
			}
		},
	};
}
