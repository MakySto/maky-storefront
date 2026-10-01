import { beforeEach, describe, expect, it, vi } from "vitest";

const { fitmentRuntimeStatus } = vi.hoisted(() => ({ fitmentRuntimeStatus: vi.fn() }));

vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	connection: async () => undefined,
}));
vi.mock("@/lib/fitment/provider", () => ({ fitmentRuntimeStatus }));

/** Obvious fakes — a real secret never belongs in a test (CLAUDE.md §10.1). */
const SECRET = "test-only-not-a-real-secret-0123456789abcdef";

const HASH = "394346c97009832300cd407159117a42c99cf23541202117bc986d3da7d333c9";
const status = {
	mode: "http",
	source: "carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20261001.2.json",
	loaded: true,
	datasetVersion: "3.0.0-full-20261001.2",
	datasetHash: HASH,
	transportSha256: "b".repeat(64),
	schemaVersion: "3.0.0",
	generatedAt: "2026-10-01T17:48:14+00:00",
	staleAfter: "2026-10-31T17:48:14.000Z",
	stale: false,
	counts: { makes: 70, models: 691, generations: 1108, applications: 2566 },
	takenIntoUseAt: "2026-10-01T20:00:00.000Z",
	bytes: 15915111,
	loadMs: 526,
	lastCheck: { at: "2026-10-01T20:05:00.000Z", outcome: "unchanged", reason: null },
	unavailableReason: null,
};

async function call(headers: Record<string, string> = {}) {
	vi.resetModules();
	process.env.REVALIDATE_SECRET = SECRET;
	const { GET } = await import("./route");
	const { NextRequest } = await import("next/server");
	return GET(new NextRequest("https://maky.store/api/fitment/status", { headers }));
}

beforeEach(() => {
	fitmentRuntimeStatus.mockReset();
	fitmentRuntimeStatus.mockReturnValue(status);
});

describe("/api/fitment/status", () => {
	it("tells anyone which dataset the process holds — the file is public and so is its hash", async () => {
		const response = await call();
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.dataset.datasetHash).toBe(HASH);
		expect(body.dataset.datasetVersion).toBe("3.0.0-full-20261001.2");
		expect(body.dataset.loaded).toBe(true);
	});

	it("keeps what identifies the process for the operator who holds the secret", async () => {
		const open = await (await call()).json();
		expect(open.process).toBeUndefined();
		expect(open.build).toBeUndefined();

		const operator = await (await call({ authorization: `Bearer ${SECRET}` })).json();
		expect(operator.process).toMatchObject({ pid: process.pid, node: process.version });
		expect(operator.process.rssMB).toBeGreaterThan(0);
		expect(operator.build).toHaveProperty("buildId");
		expect(operator.build).toHaveProperty("gitSha");
	});

	it("does not take a wrong secret for the right one", async () => {
		const body = await (await call({ authorization: "Bearer not-the-secret" })).json();
		expect(body.process).toBeUndefined();
	});

	it("is never cached and never indexed", async () => {
		const response = await call();
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-robots-tag")).toBe("noindex");
	});

	it("reports an empty process as empty, not as an error", async () => {
		fitmentRuntimeStatus.mockReturnValue({
			...status,
			loaded: false,
			datasetHash: null,
			datasetVersion: null,
			unavailableReason: "not-loaded-yet",
		});
		const response = await call();
		expect(response.status).toBe(200);
		expect((await response.json()).dataset).toMatchObject({ loaded: false, datasetHash: null });
	});

	it("exposes nothing from the environment", async () => {
		const text = JSON.stringify(await (await call({ authorization: `Bearer ${SECRET}` })).json());
		for (const name of ["REVALIDATE_SECRET", "MAKY_FITMENT_URL", "SALEOR", "PAYLOAD", "TOKEN", SECRET]) {
			expect(text).not.toContain(name);
		}
	});
});
