import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TypedDocumentString } from "@/gql/graphql";
import { classifyOperation, isWriteOperation } from "@/lib/graphql-operation";
import { executePublicGraphQL, executeRawGraphQL } from "@/lib/graphql";
import {
	SALEOR_WRITES_ENV,
	setDeployedArtifactOverride,
	resetDeployedArtifactProbe,
} from "@/lib/saleor/write-policy";

/**
 * The classifier replaced `/^\s*mutation\b/m`, which asked whether the WORD
 * `mutation` started a line rather than what the operation's TYPE was. Every case
 * below was reproduced against that regex first; the ones marked were wrong.
 */
describe("classifyOperation", () => {
	it("classifies a plain mutation as a write", () => {
		expect(classifyOperation("mutation Test { __typename }")).toBe("write");
	});

	it("classifies a leading comma mutation as a write (the regex said read)", () => {
		// Commas are ignored tokens in GraphQL, so this is a perfectly valid document.
		expect(classifyOperation(",mutation Test { __typename }")).toBe("write");
	});

	it("classifies a fragment-first mutation as a write (the regex said read)", () => {
		const source = "fragment T on Mutation { __typename } mutation Test { ...T }";
		expect(classifyOperation(source)).toBe("write");
	});

	it("sees through a leading comment", () => {
		expect(classifyOperation("# why this exists\nmutation Test { __typename }")).toBe("write");
	});

	it("classifies a query with a field called mutation as a READ (the regex said write)", () => {
		// The regex cost this query its retries for no reason.
		expect(classifyOperation("query Q {\n  mutation\n}")).toBe("read");
	});

	it("is not fooled by the word appearing in the query body", () => {
		expect(classifyOperation("query Q { mutationCount }")).toBe("read");
	});

	it("classifies an anonymous shorthand query as a read", () => {
		expect(classifyOperation("{ __typename }")).toBe("read");
	});

	it("classifies a multi-operation document containing a mutation as a write", () => {
		expect(classifyOperation("query A { __typename }\nmutation B { __typename }")).toBe("write");
	});

	it("treats an UNPARSEABLE document as a write, never as a read", () => {
		// Assuming read would open the guard and re-enable replay at the same time.
		expect(classifyOperation("mutation {{{")).toBe("write");
		expect(classifyOperation("")).toBe("write");
		expect(classifyOperation("this is not graphql at all")).toBe("write");
	});

	it("treats a document with no executable operation as a write", () => {
		expect(classifyOperation("fragment T on Query { __typename }")).toBe("write");
	});

	it("returns a stable answer when asked repeatedly (the cache does not flip it)", () => {
		const source = ",mutation Test { __typename }";
		expect([0, 1, 2].map(() => classifyOperation(source))).toEqual(["write", "write", "write"]);
	});

	it("isWriteOperation agrees with classifyOperation", () => {
		expect(isWriteOperation(",mutation Test { __typename }")).toBe(true);
		expect(isWriteOperation("query Q { __typename }")).toBe(false);
	});
});

/**
 * The point of the classifier is what the guard does with it, so the awkward
 * documents are pushed through both real transports and the wire is watched.
 */
describe("a document the old regex missed is still refused at the wire", () => {
	const PROD = "https://api.maky.store/graphql/";
	const ORIGINAL_URL = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	const ORIGINAL_SETTING = process.env[SALEOR_WRITES_ENV];
	const originalFetch = globalThis.fetch;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = PROD;
		delete process.env[SALEOR_WRITES_ENV];
		setDeployedArtifactOverride(false); // never depend on the runner's cwd
		fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: {} }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
		else process.env.NEXT_PUBLIC_SALEOR_API_URL = ORIGINAL_URL;
		if (ORIGINAL_SETTING === undefined) delete process.env[SALEOR_WRITES_ENV];
		else process.env[SALEOR_WRITES_ENV] = ORIGINAL_SETTING;
		resetDeployedArtifactProbe();
	});

	it("typed path: a comma-prefixed mutation sends nothing", async () => {
		const doc = new TypedDocumentString<Record<string, never>, Record<string, never>>(
			",mutation SneakyWrite { __typename }",
		);
		const result = await executePublicGraphQL(doc, {});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.type).toBe("blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("typed path: a fragment-first mutation sends nothing", async () => {
		const doc = new TypedDocumentString<Record<string, never>, Record<string, never>>(
			"fragment T on Mutation { __typename } mutation SneakyWrite { ...T }",
		);
		const result = await executePublicGraphQL(doc, {});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.type).toBe("blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("raw path: a comma-prefixed mutation sends nothing", async () => {
		const result = await executeRawGraphQL({ query: ",mutation SneakyWrite { __typename }" });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.type).toBe("blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("raw path: an unparseable document sends nothing", async () => {
		const result = await executeRawGraphQL({ query: "mutation {{{" });

		expect(result.ok).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("a genuine read on the same transports still goes out", async () => {
		const doc = new TypedDocumentString<Record<string, never>, Record<string, never>>(
			"query Q { mutationCount }",
		);
		await executePublicGraphQL(doc, {});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
