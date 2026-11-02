import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductDetailsDocument, LanguageCodeEnum } from "@/gql/graphql";

import { executePublicGraphQL } from "./graphql";

/**
 * `operationName` is sent only when a caller names the operation (the B2B readiness probe, whose document carries
 * the documents it validates). Every other request goes on the wire exactly as before.
 */

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example.test/graphql/";
	fetchMock = vi.fn(
		async () =>
			new Response(JSON.stringify({ data: { product: null } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const sentBody = () =>
	JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as Record<string, unknown>;

const variables = { slug: "x", channel: "sk-eur", languageCode: LanguageCodeEnum.SkSk };

describe("operationName on the wire", () => {
	it("is absent unless a caller names the operation", async () => {
		await executePublicGraphQL(ProductDetailsDocument, { variables: variables as never });
		expect(Object.keys(sentBody()).sort()).toEqual(["query", "variables"]);
	});

	it("is the named operation when one is given", async () => {
		await executePublicGraphQL(ProductDetailsDocument, {
			variables: variables as never,
			operationName: "ProductDetails",
		});
		expect(sentBody()).toMatchObject({ operationName: "ProductDetails" });
	});
});
