import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The feed walk's step is for the writer on this server and nobody else: without the secret it is the
 * 404 an unknown path gets, and it reads nothing.
 */

const SECRET = "an-obviously-fake-secret-for-this-test-only";

const readFeedPage = vi.fn();
vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	connection: async () => undefined,
}));
vi.mock("@/lib/merchant-feed/page", () => ({
	readFeedPage: (...args: unknown[]) => readFeedPage(...args),
}));

vi.stubEnv("REVALIDATE_SECRET", SECRET);
const { GET } = await import("./route");

const call = (query: string, secret: string | null = SECRET) =>
	GET(
		new NextRequest(new URL(`http://127.0.0.1:3000/api/internal/merchant-feed?${query}`), {
			headers: secret === null ? {} : { authorization: `Bearer ${secret}` },
		}),
	);

beforeEach(() => {
	readFeedPage.mockReset();
});

describe("/api/internal/merchant-feed", () => {
	it("is a plain 404 without the secret or with a wrong one, and reads nothing", async () => {
		expect((await call("market=sk", null)).status).toBe(404);
		expect((await call("market=sk", "x".repeat(SECRET.length))).status).toBe(404);
		expect(readFeedPage).not.toHaveBeenCalled();
	});

	it("wants a market", async () => {
		expect((await call("first=10")).status).toBe(400);
		expect(readFeedPage).not.toHaveBeenCalled();
	});

	it("hands the step over as it was read, never cached", async () => {
		const page = {
			market: "sk",
			read: 1,
			items: [{ id: "V1" }],
			skipped: {},
			pageInfo: { hasNextPage: false, endCursor: null },
		};
		readFeedPage.mockResolvedValue({ ok: true, page });

		const res = await call("market=sk&after=abc&first=25");
		expect(readFeedPage).toHaveBeenCalledWith("sk", "abc", 25);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("private, no-store");
		expect(await res.json()).toEqual(page);
	});

	it("starts at the beginning and leaves the step size to the reader when nothing is said", async () => {
		readFeedPage.mockResolvedValue({ ok: false, status: 502, error: "the catalogue could not be read" });
		const res = await call("market=sk");
		expect(readFeedPage).toHaveBeenCalledWith("sk", null, undefined);
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: "the catalogue could not be read" });
	});

	it("answers 404 for a market that has no feed", async () => {
		readFeedPage.mockResolvedValue({
			ok: false,
			status: 404,
			error: "no such market, or the market is not indexable",
		});
		expect((await call("market=xx")).status).toBe(404);
	});
});
