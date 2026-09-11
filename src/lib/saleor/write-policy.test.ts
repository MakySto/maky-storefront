import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CheckoutAddLineDocument, ProductDetailsDocument, LanguageCodeEnum } from "@/gql/graphql";
import { executePublicGraphQL, executeRawGraphQL } from "@/lib/graphql";
import {
	SALEOR_WRITES_ENV,
	decideSaleorWrites,
	isProductionSaleorEndpoint,
	resetDeployedArtifactProbe,
	saleorWriteDecision,
} from "./write-policy";

/**
 * The guard that exists because a walkthrough wrote to the real shop.
 *
 * On 2026-09-11 an M3 session clicked add-to-cart against a local `next start`
 * carrying the production `NEXT_PUBLIC_SALEOR_API_URL`, and `checkoutCreate`
 * created real draft checkouts. The test that matters here is therefore not
 * "does the policy return false" but "does the mutation reach `fetch`" — the
 * wire is where the damage happens.
 */

const PROD = "https://api.maky.store/graphql/";
const SANDBOX = "https://api.example.test/graphql/";

const never = () => false;
const always = () => true;

describe("isProductionSaleorEndpoint", () => {
	it("recognises the customer-facing host", () => {
		expect(isProductionSaleorEndpoint(PROD)).toBe(true);
		expect(isProductionSaleorEndpoint("https://api.maky.store/graphql/")).toBe(true);
		expect(isProductionSaleorEndpoint("https://API.MAKY.STORE/graphql/")).toBe(true);
	});

	it("is not fooled by a port or a path", () => {
		expect(isProductionSaleorEndpoint("https://api.maky.store:8443/graphql/")).toBe(true);
		expect(isProductionSaleorEndpoint("https://api.maky.store/anything/else")).toBe(true);
	});

	it("does not match a look-alike host", () => {
		// A substring match would have called all three of these production.
		expect(isProductionSaleorEndpoint("https://api.maky.store.evil.test/graphql/")).toBe(false);
		expect(isProductionSaleorEndpoint("https://staging-api.maky.store/graphql/")).toBe(false);
		expect(isProductionSaleorEndpoint("https://example.test/?x=api.maky.store")).toBe(false);
	});

	it("treats an absent or unparseable endpoint as not production", () => {
		expect(isProductionSaleorEndpoint(undefined)).toBe(false);
		expect(isProductionSaleorEndpoint("")).toBe(false);
		expect(isProductionSaleorEndpoint("not a url")).toBe(false);
	});
});

describe("decideSaleorWrites", () => {
	it("refuses a production write from a process that is not the deployed artifact", () => {
		const decision = decideSaleorWrites({ endpoint: PROD, setting: undefined, isDeployedArtifact: never });
		expect(decision.allowed).toBe(false);
	});

	it("allows the deployed artifact to write to production, with no configuration", () => {
		// This is what keeps the guard free of deployment risk: production does not
		// have to opt in, so a forgotten .env line cannot kill add-to-cart.
		const decision = decideSaleorWrites({ endpoint: PROD, setting: undefined, isDeployedArtifact: always });
		expect(decision).toEqual({ allowed: true, because: "deployed-artifact" });
	});

	it("allows writes to a non-production endpoint", () => {
		const decision = decideSaleorWrites({ endpoint: SANDBOX, setting: undefined, isDeployedArtifact: never });
		expect(decision).toEqual({ allowed: true, because: "non-production-endpoint" });
	});

	it("honours an explicit allow", () => {
		const decision = decideSaleorWrites({ endpoint: PROD, setting: "allow", isDeployedArtifact: never });
		expect(decision).toEqual({ allowed: true, because: "explicit-allow" });
	});

	it("honours an explicit block even on the deployed artifact", () => {
		const decision = decideSaleorWrites({ endpoint: PROD, setting: "block", isDeployedArtifact: always });
		expect(decision.allowed).toBe(false);
	});

	it("blocks a sandbox write too when told to block", () => {
		const decision = decideSaleorWrites({ endpoint: SANDBOX, setting: "BLOCK", isDeployedArtifact: never });
		expect(decision.allowed).toBe(false);
	});

	it("does not read an unrecognised value as permission", () => {
		// A typo must fall through to the inference, which refuses production.
		for (const setting of ["yes-please", "true", "1", "allowed", " "]) {
			const decision = decideSaleorWrites({ endpoint: PROD, setting, isDeployedArtifact: never });
			expect(decision.allowed, `setting=${JSON.stringify(setting)}`).toBe(false);
		}
	});

	it("accepts surrounding whitespace and case on the real values", () => {
		expect(
			decideSaleorWrites({ endpoint: PROD, setting: "  ALLOW ", isDeployedArtifact: never }).allowed,
		).toBe(true);
	});

	it("does not probe the filesystem when the endpoint already settles it", () => {
		const probe = vi.fn(() => false);
		decideSaleorWrites({ endpoint: SANDBOX, setting: undefined, isDeployedArtifact: probe });
		expect(probe).not.toHaveBeenCalled();
	});
});

describe("saleorWriteDecision reads the live environment", () => {
	const ORIGINAL_URL = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	const ORIGINAL_SETTING = process.env[SALEOR_WRITES_ENV];

	afterEach(() => {
		if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
		else process.env.NEXT_PUBLIC_SALEOR_API_URL = ORIGINAL_URL;
		if (ORIGINAL_SETTING === undefined) delete process.env[SALEOR_WRITES_ENV];
		else process.env[SALEOR_WRITES_ENV] = ORIGINAL_SETTING;
		resetDeployedArtifactProbe();
	});

	it("refuses production from this test process, which is not a deployed artifact", () => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = PROD;
		delete process.env[SALEOR_WRITES_ENV];
		resetDeployedArtifactProbe();
		expect(saleorWriteDecision().allowed).toBe(false);
	});
});

/**
 * The falsification: a blocked mutation must not reach `fetch`.
 *
 * A policy object that says `allowed: false` proves nothing on its own — the
 * damage in September was a request on the wire, so that is what is asserted.
 */
describe("a blocked write never reaches the wire", () => {
	const ORIGINAL_URL = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	const ORIGINAL_SETTING = process.env[SALEOR_WRITES_ENV];
	const originalFetch = globalThis.fetch;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = PROD;
		delete process.env[SALEOR_WRITES_ENV];
		resetDeployedArtifactProbe();
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

	it("refuses checkoutLinesAdd against production and sends nothing", async () => {
		const result = await executePublicGraphQL(CheckoutAddLineDocument, {
			variables: { id: "chk_1", productVariantId: "var_1", quantity: 1 },
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.type).toBe("blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a raw mutation against production and sends nothing", async () => {
		const result = await executeRawGraphQL({
			query:
				"mutation Register($input: AccountRegisterInput!) { accountRegister(input: $input) { errors { field } } }",
			variables: { input: {} },
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.type).toBe("blocked");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("still lets a READ through to production — the guard is about writes only", async () => {
		await executePublicGraphQL(ProductDetailsDocument, {
			variables: { slug: "x", channel: "sk-eur", lang: LanguageCodeEnum.Sk },
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("lets the write through once the process declares authority", async () => {
		process.env[SALEOR_WRITES_ENV] = "allow";

		await executePublicGraphQL(CheckoutAddLineDocument, {
			variables: { id: "chk_1", productVariantId: "var_1", quantity: 1 },
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
