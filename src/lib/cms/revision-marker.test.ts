import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({
	getTranslations: async (arg: string | { namespace: string }) => {
		const namespace = typeof arg === "string" ? arg : arg.namespace;
		const file = join(dirname(fileURLToPath(import.meta.url)), "../../i18n/messages/sk-SK.json");
		const messages = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string>>;
		return (key: string) => messages[namespace]?.[key] ?? `${namespace}.${key}`;
	},
}));

import { CMS_REVISION_META_NAME, cmsRevisionMetadata } from "./revision";

/**
 * Pages contract v3 §3 (`__fixtures__/provider-v3/pages-content.md`): a page rendered from a
 * CMS document carries `<meta name="maky-cms-revision" content="pages:<id>@<updatedAt>">`,
 * emitted through `generateMetadata`'s `other`. The CMS reads it back to verify a publish —
 * so it must be there for a rendered document and absent for everything else.
 */

const DOCUMENT_ID = "01928f3e-4b1a-7c3d-9e2f-0123456789ab";
const UPDATED_AT = "2026-09-26T07:59:58.412Z";
const MARKER = `pages:${DOCUMENT_ID}@${UPDATED_AT}`;

const document = (slug: string) => ({
	docs: [
		{
			id: DOCUMENT_ID,
			title: "O nás",
			slug,
			summary: null,
			layout: [
				{
					blockType: "richText",
					markets: null,
					content: {
						root: {
							type: "root",
							children: [{ type: "paragraph", children: [{ type: "text", text: "Obsah z CMS", format: 0 }] }],
						},
					},
				},
			],
			markets: null,
			meta: null,
			updatedAt: UPDATED_AT,
			_status: "published",
		},
	],
});

type Metadata = { other?: Record<string, string>; robots?: unknown };
type RouteModule = {
	generateMetadata: (props: { params: Promise<{ channel: string }> }) => Promise<Metadata>;
};

const route = async (slug: "o-nas" | "poradna") =>
	(slug === "o-nas"
		? await import("@/app/[channel]/(main)/o-nas/page")
		: await import("@/app/[channel]/(main)/poradna/page")) as RouteModule;

async function metadataFor(slug: "o-nas" | "poradna"): Promise<Metadata> {
	const { generateMetadata } = await route(slug);
	return generateMetadata({ params: Promise.resolve({ channel: "sk-eur" }) });
}

function respond(body: unknown) {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
		),
	);
}

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.example.test");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "fake-access-id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "fake-access-secret");
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("cmsRevisionMetadata", () => {
	it("is `pages:<id>@<updatedAt>` under the contract's name", () => {
		expect(CMS_REVISION_META_NAME).toBe("maky-cms-revision");
		expect(cmsRevisionMetadata({ id: DOCUMENT_ID, updatedAt: UPDATED_AT })).toEqual({
			"maky-cms-revision": MARKER,
		});
	});

	it("says nothing rather than something partial when updatedAt is missing", () => {
		expect(cmsRevisionMetadata({ id: DOCUMENT_ID, updatedAt: null })).toBeUndefined();
	});
});

describe("the revision marker on published CMS pages", () => {
	it.each(["o-nas", "poradna"] as const)("%s carries the marker of the document it renders", async (slug) => {
		respond(document(slug));
		expect((await metadataFor(slug)).other).toEqual({ "maky-cms-revision": MARKER });
	});

	it("is absent on the bootstrap served during an outage", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("cms unreachable");
			}),
		);
		expect((await metadataFor("o-nas")).other).toBeUndefined();
	});

	it("is absent when the document is unpublished", async () => {
		respond({ docs: [], totalDocs: 0 });
		expect((await metadataFor("o-nas")).other).toBeUndefined();
	});
});
