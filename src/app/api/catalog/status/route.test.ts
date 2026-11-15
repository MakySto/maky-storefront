import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type Harness,
	arrangeRelease,
	contentFile,
	fitmentFile,
	respond,
	status as httpStatus,
} from "@/lib/catalog-release/fixtures/fake-cfm";
import { releaseSyncOnce } from "@/lib/catalog-release/sync";

const { fitmentRuntimeStatus, peekCatalogContent } = vi.hoisted(() => ({
	fitmentRuntimeStatus: vi.fn(),
	peekCatalogContent: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	connection: async () => undefined,
}));
vi.mock("@/lib/fitment/provider", () => ({ fitmentRuntimeStatus }));
vi.mock("@/lib/catalog-content/snapshot", () => ({ peekCatalogContent }));

/** Obvious fakes: a real secret never belongs in a test (CLAUDE.md §10.1). */
const SECRET = "test-only-not-a-real-secret-0123456789abcdef";

/** Parsed bodies are asserted field by field; their exact shape is the status document's, not this file's. */
type Body = Record<string, any>;

let world: Harness;

beforeEach(() => {
	world = arrangeRelease();
	fitmentRuntimeStatus.mockReset();
	fitmentRuntimeStatus.mockReturnValue({
		loaded: false,
		transportSha256: null,
		datasetHash: null,
		datasetVersion: null,
	});
	peekCatalogContent.mockReset();
	peekCatalogContent.mockReturnValue(null);
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	world.restore();
});

async function call(headers: Record<string, string> = {}): Promise<Response> {
	vi.resetModules();
	process.env.REVALIDATE_SECRET = SECRET;
	const { GET } = await import("./route");
	const { NextRequest } = await import("next/server");
	return GET(new NextRequest("https://maky.store/api/catalog/status", { headers }));
}

async function body(headers: Record<string, string> = {}): Promise<Body> {
	return (await (await call(headers)).json()) as Body;
}

const sk = contentFile("sk");
const de = contentFile("de");
const fit = fitmentFile("3.0.0-test.1");

async function released(): Promise<void> {
	world.cfm.publish({
		version: 7,
		targets: { at: { file: de, release: 2 }, de: { file: de, release: 3 }, sk: { file: sk, release: 5 } },
		fitment: { file: fit, release: 2 },
	});
	await releaseSyncOnce();
}

describe("/api/catalog/status", () => {
	it("tells anyone which file each target is serving and whether the process holds the one CFM published", async () => {
		await released();

		const document = await body();

		expect(document).toMatchObject({
			artifact: "MAKY_STOREFRONT_CATALOG_STATUS",
			schemaVersion: "1.0.0",
			capabilities: { contentByTarget: true },
			manifest: { version: 7, outcome: "new", error: null },
			fitment: { sha256: fit.sha256, datasetHash: fit.datasetHash, state: "active", source: "manifest" },
		});
		expect(document.content.targets.de).toMatchObject({
			sha256: de.sha256,
			release: 3,
			state: "active",
			source: "manifest",
		});
		expect(document.content.targets.at).toMatchObject({
			sha256: de.sha256,
			release: 2,
			state: "active",
			source: "manifest",
		});
		expect(document.content.targets.sk).toMatchObject({ sha256: sk.sha256, release: 5, state: "active" });
	});

	it("reports a process that has seen no manifest yet as empty, not as an error", async () => {
		const response = await call();

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			manifest: { version: null, outcome: null },
			content: { targets: {} },
			fitment: null,
		});
	});

	it("says `stale` and names the reason when the file CFM published did not verify here", async () => {
		const broken = contentFile("sk", "broken");
		world.cfm.override(broken.name, () => respond(new Uint8Array(broken.bytes.byteLength)));
		world.cfm.publish({ version: 7, targets: { sk: { file: broken, release: 5 } } });
		await releaseSyncOnce();
		peekCatalogContent.mockImplementation((language: string) =>
			language === "sk" ? { sha256: "b".repeat(64), pageCount: 12 } : null,
		);

		const document = await body();

		// The older setting holds a file, and it is reported as exactly that: not as the release.
		expect(document.content.targets.sk).toMatchObject({
			state: "stale",
			source: "legacy",
			sha256: "b".repeat(64),
			pages: 12,
			file: null,
			release: null,
			error: { code: "file_hash_mismatch" },
		});
	});

	it("reports the older dataset only when the older setting has actually loaded one", async () => {
		const missing = fitmentFile("3.0.0-missing.1");
		world.cfm.override(missing.name, () => httpStatus(404));
		world.cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: missing, release: 1 },
		});
		await releaseSyncOnce();

		expect((await body()).fitment).toMatchObject({ state: "missing", source: "none", datasetHash: null });

		fitmentRuntimeStatus.mockReturnValue({
			loaded: true,
			transportSha256: "c".repeat(64),
			datasetHash: "d".repeat(64),
			datasetVersion: "3.0.0-older",
		});
		expect((await body()).fitment).toMatchObject({
			state: "stale",
			source: "legacy",
			sha256: "c".repeat(64),
			datasetHash: "d".repeat(64),
			datasetVersion: "3.0.0-older",
		});
	});

	it("keeps what identifies the process for the operator who holds the secret", async () => {
		await released();

		const open = await body();
		expect(open.process).toEqual({ bootId: expect.any(String) });

		const operator = await body({ authorization: `Bearer ${SECRET}` });
		expect(operator.process).toMatchObject({ bootId: open.process.bootId, pid: process.pid });
		expect(typeof operator.process.startedAt).toBe("string");
	});

	it("does not take a wrong secret for the right one", async () => {
		const document = await body({ authorization: "Bearer not-the-secret" });

		expect(document.process).toEqual({ bootId: expect.any(String) });
	});

	it("is never cached and never indexed", async () => {
		const response = await call();

		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-robots-tag")).toBe("noindex");
	});

	it("exposes nothing from the environment", async () => {
		await released();

		const text = JSON.stringify(await body({ authorization: `Bearer ${SECRET}` }));

		for (const name of [
			"REVALIDATE_SECRET",
			"MAKY_RELEASE_MANIFEST_URL",
			"SALEOR",
			"PAYLOAD",
			"TOKEN",
			SECRET,
		]) {
			expect(text).not.toContain(name);
		}
	});

	it("is a read and nothing else: it fetches nothing, loads nothing, and answers with the same boot id every time", async () => {
		await released();
		world.cfm.forget();

		const first = await body();
		const second = await body();

		expect(world.cfm.hits).toEqual([]);
		expect(second.process.bootId).toBe(first.process.bootId);
		expect(second.manifest).toEqual(first.manifest);
	});

	it("answers GET and nothing else, so no other method can reach it", async () => {
		vi.resetModules();
		const route = await import("./route");

		expect(Object.keys(route)).toEqual(["GET"]);
	});
});
