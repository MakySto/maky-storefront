import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract the crawler preflight rests on: for one product URL, the proxy's preflight, the
 * internal route and the page all end up asking the SAME resolver with the SAME arguments.
 *
 * If they ever diverge — the page starts passing a normalised slug, the proxy an encoded one,
 * the route a different channel — nothing breaks visibly: the preflight simply stops sharing the
 * page's `"use cache"` entry, the page reads Saleor a second time, and the "first read OK, second
 * read fails" window the preflight exists to close is open again. This test is the tripwire.
 */

const resolver = vi.fn();
vi.mock("@/lib/saleor/product-outcome", () => ({
	getProductOutcome: (...args: unknown[]) => resolver(...args),
}));

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

beforeEach(() => {
	resolver.mockReset();
	resolver.mockResolvedValue({ status: "upstream-error", type: "network", retryable: true, message: "x" });
	vi.stubEnv("PORT", "3031");
	vi.stubEnv("ROUTE_EXISTENCE_GATE", "off");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** What the proxy's preflight asks the route for, for this public URL. */
async function preflightQuery(path: string): Promise<{ slug: string; channel: string }> {
	let asked: URL | null = null;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: URL | string) => {
			asked = new URL(String(input));
			return new Response(JSON.stringify({ status: "found" }), { status: 200 });
		}),
	);
	const { proxy } = await import("@/proxy");
	await proxy(
		new NextRequest(new URL(`https://maky.store${path}`), { headers: { "user-agent": GOOGLEBOT } }),
	);
	expect(asked).not.toBeNull();
	return { slug: asked!.searchParams.get("slug")!, channel: asked!.searchParams.get("channel")! };
}

describe("one resolver, one set of arguments", () => {
	const cases: [path: string, params: { productSlug: string; channel: string }][] = [
		[
			"/sk/stresny-nosic-nordrive-helio-black",
			{ productSlug: "stresny-nosic-nordrive-helio-black", channel: "sk-eur" },
		],
		[
			"/cz/stresni-nosic-nordrive-helio-black",
			{ productSlug: "stresni-nosic-nordrive-helio-black", channel: "cz-czk" },
		],
		// Next's route matcher decodes params, so the page is handed the decoded segment.
		["/sk/nosic-100%25-bavlna", { productSlug: "nosic-100%-bavlna", channel: "sk-eur" }],
	];

	for (const [path, params] of cases) {
		it(`${path}: proxy → route → resolver asks what the page asks`, async () => {
			const query = await preflightQuery(path);

			const { GET } = await import("@/app/api/internal/product-outcome/route");
			const { internalLoopbackToken, INTERNAL_TOKEN_HEADER } = await import("@/lib/internal-token");
			const url = new URL("http://127.0.0.1:3031/api/internal/product-outcome");
			url.searchParams.set("slug", query.slug);
			url.searchParams.set("channel", query.channel);
			await GET(new NextRequest(url, { headers: { [INTERNAL_TOKEN_HEADER]: internalLoopbackToken() } }));

			const { generateMetadata } = await import("@/app/[channel]/(main)/[productSlug]/page");
			await generateMetadata({ params: Promise.resolve(params) });

			expect(resolver).toHaveBeenCalledTimes(2);
			const [fromRoute, fromPage] = resolver.mock.calls;
			expect(fromRoute).toEqual(fromPage);
			expect(fromPage).toEqual([params.productSlug, params.channel]);
		});
	}
});
