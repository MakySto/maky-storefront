import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

// Imported after the mock so the route handler binds to it.
const { POST } = await import("./route");

const SECRET = "s3cr3t-payload-revalidate-token";
const ENDPOINT = "https://maky.store/api/revalidate/payload";

const publishEvent = {
	source: "maky-cms",
	entityType: "collection",
	entitySlug: "pages",
	entityId: "019fb008-504b-779e-ad3f-1ff353267c88",
	event: "publish",
	locale: "sk",
	slug: "o-nas",
	previousSlug: null,
};

function post(options: { headers?: Record<string, string>; url?: string; body?: unknown } = {}) {
	const request = new Request(options.url ?? ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json", ...options.headers },
		body: JSON.stringify(options.body ?? publishEvent),
	});
	return POST(request as unknown as NextRequest);
}

const authorized = { authorization: `Bearer ${SECRET}` };

describe("POST /api/revalidate/payload — the auth matrix", () => {
	const original = process.env.PAYLOAD_REVALIDATE_SECRET;

	beforeEach(() => {
		process.env.PAYLOAD_REVALIDATE_SECRET = SECRET;
		revalidateTag.mockClear();
	});

	afterEach(() => {
		if (original === undefined) delete process.env.PAYLOAD_REVALIDATE_SECRET;
		else process.env.PAYLOAD_REVALIDATE_SECRET = original;
	});

	it("accepts a valid Bearer token and invalidates the derived tags", async () => {
		const response = await post({ headers: authorized });
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ success: true });
		expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual(["cms:collection:pages", "cms:page:o-nas"]);
		// The profile argument is mandatory in this version of Next.
		expect(revalidateTag).toHaveBeenCalledWith(expect.any(String), "max");
	});

	it("returns 401 for a VALID secret supplied only in the query string", async () => {
		const response = await post({ url: `${ENDPOINT}?secret=${SECRET}` });
		expect(response.status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("returns 401 for a valid secret in a custom header", async () => {
		const response = await post({ headers: { "x-revalidate-secret": SECRET } });
		expect(response.status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("returns 401 for a missing, malformed or wrong Authorization header", async () => {
		for (const headers of [
			undefined,
			{ authorization: SECRET },
			{ authorization: "Bearer" },
			{ authorization: `Basic ${SECRET}` },
			{ authorization: "Bearer wrong-token-of-other-length" },
		]) {
			const response = await post(headers ? { headers } : {});
			expect(response.status).toBe(401);
		}
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("rejects everyone when no secret is configured", async () => {
		delete process.env.PAYLOAD_REVALIDATE_SECRET;
		expect((await post({ headers: authorized })).status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("authenticates before parsing the body — an unauthenticated caller does no work", async () => {
		const request = new Request(ENDPOINT, { method: "POST", body: "not json" });
		expect((await POST(request as unknown as NextRequest)).status).toBe(401);
	});

	it("exports only POST, so every other method is a 405 from Next itself", async () => {
		const route = await import("./route");
		expect(Object.keys(route)).toEqual(["POST"]);
	});
});

describe("POST /api/revalidate/payload — the body contract", () => {
	const original = process.env.PAYLOAD_REVALIDATE_SECRET;

	beforeEach(() => {
		process.env.PAYLOAD_REVALIDATE_SECRET = SECRET;
		revalidateTag.mockClear();
	});

	afterEach(() => {
		if (original === undefined) delete process.env.PAYLOAD_REVALIDATE_SECRET;
		else process.env.PAYLOAD_REVALIDATE_SECRET = original;
	});

	it("rejects malformed JSON with 400", async () => {
		const request = new Request(ENDPOINT, { method: "POST", headers: authorized, body: "{" });
		expect((await POST(request as unknown as NextRequest)).status).toBe(400);
	});

	it("rejects an event from another producer", async () => {
		const response = await post({ headers: authorized, body: { ...publishEvent, source: "somebody-else" } });
		expect(response.status).toBe(400);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("rejects an unknown event name", async () => {
		const response = await post({ headers: authorized, body: { ...publishEvent, event: "archive" } });
		expect(response.status).toBe(400);
	});

	it("never invalidates a path or tag named by the caller", async () => {
		// The body is a description of what changed, not an instruction. A caller able
		// to name its own tag could purge the entire storefront.
		await post({
			headers: authorized,
			body: { ...publishEvent, tag: "cms:page:everything", path: "/", tags: ["*"] },
		});
		expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual(["cms:collection:pages", "cms:page:o-nas"]);
	});

	it("invalidates both slugs on a rename, so the old URL stops serving", async () => {
		await post({
			headers: authorized,
			body: { ...publishEvent, event: "update", slug: "o-spolocnosti", previousSlug: "o-nas" },
		});
		expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual([
			"cms:collection:pages",
			"cms:page:o-spolocnosti",
			"cms:page:o-nas",
		]);
	});
});
