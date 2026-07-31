import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The reader must serve the document it asked for.
 *
 * Until M.2 this was never checked. Correctness rested entirely on Payload honouring
 * `where[slug][equals]`, which was safe only because the pilot had one CMS page: a wrong
 * document could only have been the same document.
 *
 * With a second page it stops being safe, and the failure mode is the bad kind. Nothing
 * throws, nothing looks broken, and the page renders — the wrong content under the right
 * URL, carrying a canonical that confidently points at the URL the visitor is already on.
 * That is an indexable, shareable, entirely convincing wrong page.
 */

const DOC = (slug: string) => ({
	docs: [
		{
			id: "019fb008-504b-779e-ad3f-1ff353267c88",
			title: "O nás",
			slug,
			summary: null,
			markets: ["SK"],
			meta: { title: "O nás", description: "…", image: null },
			updatedAt: "2026-07-30T21:02:27.541Z",
			_status: "published",
			layout: [
				{
					id: "b1",
					anchorId: null,
					blockName: null,
					markets: null,
					blockType: "richText",
					content: {
						root: {
							type: "root",
							children: [{ type: "paragraph", children: [{ type: "text", text: "Ahoj", format: 0 }] }],
						},
					},
				},
			],
		},
	],
});

function stubCms(body: unknown) {
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.test");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "secret");
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
}

describe("fetchCmsPage — the document must be the one requested", () => {
	it("serves a document whose slug matches", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stubCms(DOC("o-nas"));
		const { fetchCmsPage } = await import("./client");
		const outcome = await fetchCmsPage("o-nas", "sk");
		expect(outcome.status).toBe("found");
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("refuses a document that answers with a different slug", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		stubCms(DOC("poradna"));

		const { fetchCmsPage } = await import("./client");
		const outcome = await fetchCmsPage("o-nas", "sk");

		// An upstream fault, so the route falls back rather than rendering someone else's
		// page. Not `not-found`: the CMS did not say "no such page", it answered wrongly.
		expect(outcome.status).toBe("error");
		if (outcome.status !== "error") return;
		expect(outcome.reason).toContain("slug mismatch");

		expect(consoleError).toHaveBeenCalledWith("[cms] contract-violation", expect.stringContaining("poradna"));

		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("serves the body without an unusable optional meta image and logs the omission", async () => {
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		const body = DOC("o-nas") as unknown as {
			docs: [{ meta: { image: unknown } }];
		};
		body.docs[0].meta.image = "unpopulated-depth-1-id";
		stubCms(body);

		const { fetchCmsPage } = await import("./client");
		const outcome = await fetchCmsPage("o-nas", "sk");

		expect(outcome.status).toBe("found");
		if (outcome.status === "found") expect(outcome.page.meta.image).toBeNull();
		expect(consoleWarn).toHaveBeenCalledWith(
			"[cms] content-degraded",
			expect.stringContaining('"code":"meta-image-omitted"'),
		);

		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});
});
