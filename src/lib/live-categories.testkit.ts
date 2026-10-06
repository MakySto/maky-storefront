import { vi } from "vitest";
import { CATEGORY_SLUGS } from "@/config/categories";

/**
 * A Saleor that answers the two questions `live-categories.ts` asks — the category list and
 * "does a product hold this slug, in each channel" — and nothing else, so the live list, the
 * proxy and the revalidate route can be tested against the same world.
 *
 * Deliberately a fake `fetch`, not a mocked module: what is under test is the request the
 * live list makes and how it reads the answer, and both of those live on the wire.
 */
export const SALEOR_URL = "https://saleor.test/graphql/";

export interface FakeSaleor {
	/** Every category slug the list returns, in order. Starts as the build's floor. */
	categories: string[];
	/** Categories per page (the live list asks for 100; a small number exercises the paging). */
	pageSize: number;
	/** Product slug → the channels that hold a product with it. */
	products: Record<string, string[]>;
	/** Every request throws, as a refused connection does. */
	down: boolean;
	/** The list answers, but with a GraphQL `errors` array next to partial data. */
	listErrors: boolean;
	/** The list's second and later pages fail. */
	failAfterFirstPage: boolean;
	/** The product probe answers with `errors`. */
	probeErrors: boolean;
	/** Milliseconds every answer is held back, to test not waiting for it. */
	delayMs: number;
	/** Runs the instant a list page has been read, before it is returned: what happens next, mid-load. */
	afterList?: () => void;
	listCalls: number;
	probeCalls: number;
	/** The probe queries, as sent. */
	probeQueries: string[];
}

export function fakeSaleor(overrides: Partial<FakeSaleor> = {}): {
	world: FakeSaleor;
	fetchMock: ReturnType<typeof vi.fn>;
} {
	const world: FakeSaleor = {
		categories: [...CATEGORY_SLUGS],
		pageSize: 100,
		products: {},
		down: false,
		listErrors: false,
		failAfterFirstPage: false,
		probeErrors: false,
		delayMs: 0,
		listCalls: 0,
		probeCalls: 0,
		probeQueries: [],
		...overrides,
	};

	const answer = (body: unknown) =>
		new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

	const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
		if (world.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, world.delayMs));
		if (world.down) throw new TypeError("fetch failed");

		const { query, variables } = JSON.parse(String(init?.body)) as {
			query: string;
			variables: { after?: string | null; s?: string };
		};

		if (query.includes("categories(")) {
			world.listCalls += 1;
			const start = variables.after ? Number(variables.after.replace("cursor:", "")) : 0;
			if (start > 0 && world.failAfterFirstPage) return new Response("bad gateway", { status: 502 });
			const end = start + world.pageSize;
			const edges = world.categories.slice(start, end).map((slug) => ({ node: { slug } }));
			const more = end < world.categories.length;
			const connection = { edges, pageInfo: { hasNextPage: more, endCursor: more ? `cursor:${end}` : null } };
			const response = answer(
				world.listErrors
					? { data: { categories: connection }, errors: [{ message: "partial" }] }
					: { data: { categories: connection } },
			);
			world.afterList?.();
			return response;
		}

		if (query.includes("product(")) {
			world.probeCalls += 1;
			world.probeQueries.push(query);
			if (world.probeErrors) return answer({ errors: [{ message: "unavailable" }] });
			const held = world.products[variables.s ?? ""] ?? [];
			const data: Record<string, unknown> = {};
			for (const [, alias, channel] of query.matchAll(/(c\d+):product\(slug:\$s,channel:"([a-z-]+)"\)/g)) {
				data[alias!] = held.includes(channel!) ? { id: `Product:${channel}` } : null;
			}
			return answer({ data });
		}

		return new Response("unexpected query", { status: 400 });
	});

	return { world, fetchMock };
}

/** Point `fetch` and the Saleor endpoint at a fake world. Pair with `vi.unstubAllGlobals()` / `vi.unstubAllEnvs()`. */
export function installFakeSaleor(overrides: Partial<FakeSaleor> = {}) {
	const fake = fakeSaleor(overrides);
	vi.stubGlobal("fetch", fake.fetchMock);
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", SALEOR_URL);
	return fake;
}
