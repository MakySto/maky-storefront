import { beforeEach, describe, expect, it, vi } from "vitest";

const { sitemapShardEntries, sitemapShards } = vi.hoisted(() => ({
	sitemapShardEntries: vi.fn(),
	sitemapShards: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/seo/sitemap", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/seo/sitemap")>()),
	sitemapShardEntries,
	sitemapShards,
}));

import { GET as shard } from "./route";
import { GET as index } from "../../sitemap.xml/route";

const call = (file: string) =>
	shard(new Request(`https://maky.store/sitemaps/${file}`), { params: Promise.resolve({ file }) });

beforeEach(() => {
	process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
	sitemapShardEntries.mockReset();
	sitemapShards.mockReset();
});

describe("/sitemaps/[file]", () => {
	it("serves a shard as XML", async () => {
		sitemapShardEntries.mockResolvedValue([{ url: "https://maky.store/sk/produkt-1", priority: 0.6 }]);
		const response = await call("sk-products-1.xml");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/xml");
		expect(sitemapShardEntries).toHaveBeenCalledWith("sk-products-1");
		expect(await response.text()).toContain("<loc>https://maky.store/sk/produkt-1</loc>");
	});

	it("answers a real 404 for a shard that does not exist, never an empty <urlset>", async () => {
		sitemapShardEntries.mockResolvedValue(null);
		const response = await call("cz-products-1.xml");

		expect(response.status).toBe(404);
		expect(await response.text()).not.toContain("urlset");
	});

	it("does not look anything up for a name without .xml", async () => {
		const response = await call("sk-products-1");

		expect(response.status).toBe(404);
		expect(sitemapShardEntries).not.toHaveBeenCalled();
	});
});

describe("/sitemap.xml", () => {
	it("is an index naming every shard", async () => {
		sitemapShards.mockResolvedValue([
			{ id: "sk-pages-1", market: "sk", kind: "pages", part: 1, urls: 40 },
			{ id: "sk-products-1", market: "sk", kind: "products", part: 1, urls: 9_577 },
		]);
		const response = await index();
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("<sitemapindex");
		expect(body).toContain("<loc>https://maky.store/sitemaps/sk-pages-1.xml</loc>");
		expect(body).toContain("<loc>https://maky.store/sitemaps/sk-products-1.xml</loc>");
	});

	it("fails loudly rather than list shards from a truncated walk", async () => {
		sitemapShards.mockRejectedValue(new Error("sk-eur: product page 4 did not resolve"));
		await expect(index()).rejects.toThrow(/did not resolve/);
	});
});
