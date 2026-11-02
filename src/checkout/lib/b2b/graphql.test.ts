import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { buildSchema, extendSchema, graphql, parse, validate, type GraphQLSchema } from "graphql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphQLResult } from "@/lib/graphql";

import { deriveExtension } from "../../../../scripts/b2b-schema-extension.mjs";
import { B2B_PAYMENT_LOCK_RELEASE_STATUSES } from "./contract";
import { B2B_DOCUMENTS, MAKY_B2B_READINESS_OPERATION } from "./graphql";
import { checkB2bReadiness, resetB2bReadinessCache } from "./server/b2b-readiness";
import { setB2bAppExecutorForTests } from "./server/b2b-saleor-client";

/**
 * The B2B documents against the schema they will meet: Saleor 3.23.31 (the pinned schema `generate:offline` uses)
 * PLUS `maky-b2b-v1.graphql`, which `scripts/b2b-schema-extension.mjs` derives from the backend's own
 * `saleor/graphql/schema.graphql` (MakySto/maky-saleor, the commit named in the file's header). The readiness probe is
 * not only validated but EXECUTED here, through `checkB2bReadiness`, the way Saleor runs it: the whole document is
 * validated, then only the named operation runs.
 *
 * The pinned schema is a download cache (`node_modules/.cache/saleor-schema`). A tree built against the live API
 * (the production box) may not have it; there this part is skipped and says so, and the source checks below still run.
 */

const root = process.cwd();
const pinned = path.join(root, "node_modules/.cache/saleor-schema/schema-3.23.31.graphql");
const extensionSdl = readFileSync(path.join(root, "src/checkout/lib/b2b/maky-b2b-v1.graphql"), "utf8");
const havePinned = existsSync(pinned);

function filesUnder(dir: string, suffix: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? filesUnder(full, suffix) : full.endsWith(suffix) ? [full] : [];
	});
}

const APP = {
	id: "QXBwOjQy",
	name: "MAKY B2B checkout - production",
	isActive: true,
	permissions: [{ code: "MANAGE_TAXES" }, { code: "HANDLE_TAXES" }],
};

/**
 * A Saleor stand-in for one schema: like `SaleorGraphQLBackend`, it validates the WHOLE document and answers an
 * invalid one with HTTP 400 and the errors (handed over as the transport does: status and response text); a valid
 * one runs the operation named by `operationName` only. The mutation's resolver records a call, so a probe that
 * executed the write would be seen.
 */
function saleorFor(schema: GraphQLSchema) {
	const calls: Array<{ operationName?: string }> = [];
	let mutationExecuted = false;
	const rootValue = {
		app: () => APP,
		checkout: () => null,
		checkoutB2bTaxAttestationUpdate: () => {
			mutationExecuted = true;
			return { errors: [], checkout: null };
		},
		checkoutB2bPaymentLockRelease: () => {
			mutationExecuted = true;
			return { errors: [], checkout: null, status: "RELEASED" };
		},
	};
	const executor = async (
		document: unknown,
		options: { variables: unknown; operationName?: string },
	): Promise<GraphQLResult<unknown>> => {
		calls.push({ operationName: options.operationName });
		const source = String(document);
		const errors = validate(schema, parse(source));
		if (errors.length) {
			const body = JSON.stringify({ errors: errors.map((error) => ({ message: error.message })) });
			return {
				ok: false,
				error: {
					type: "http",
					statusCode: 400,
					message: `HTTP 400: Bad Request\n${body}`,
					isRetryable: false,
				},
			} as GraphQLResult<unknown>;
		}
		const result = await graphql({
			schema,
			source,
			rootValue,
			operationName: options.operationName,
			variableValues: options.variables as Record<string, unknown>,
		});
		if (result.errors?.length) {
			return {
				ok: false,
				error: {
					type: "graphql",
					message: result.errors.map((e) => e.message).join(", "),
					isRetryable: false,
				},
			} as GraphQLResult<unknown>;
		}
		return { ok: true, data: result.data } as GraphQLResult<unknown>;
	};
	return { executor, calls, mutationExecuted: () => mutationExecuted };
}

describe.skipIf(!havePinned)(
	"B2B documents vs Saleor 3.23.31 + the backend's MAKY-B2B-V1 (pinned schema)",
	() => {
		const base = havePinned ? buildSchema(readFileSync(pinned, "utf8")) : null;
		const backend = base ? extendSchema(base, parse(extensionSdl)) : null;

		const ENV_KEYS = [
			"SALEOR_B2B_APP_TOKEN",
			"MAKY_VAT_ID",
			"NEXT_PUBLIC_SALEOR_API_URL",
			"MAKY_SALEOR_WRITES",
		];
		let saved: Record<string, string | undefined> = {};
		beforeEach(() => {
			saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
			process.env.SALEOR_B2B_APP_TOKEN = "fake-b2b-app-token-for-tests";
			process.env.MAKY_VAT_ID = "SK2122890660";
			process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://saleor.invalid/graphql/";
			delete process.env.MAKY_SALEOR_WRITES;
			resetB2bReadinessCache();
		});
		afterEach(() => {
			for (const key of ENV_KEYS) {
				if (saved[key] === undefined) delete process.env[key];
				else process.env[key] = saved[key];
			}
			setB2bAppExecutorForTests(null);
			resetB2bReadinessCache();
		});

		it.each(Object.entries(B2B_DOCUMENTS))("%s is valid against the backend's schema", (_name, document) => {
			expect(validate(backend!, parse(String(document))).map((error) => error.message)).toEqual([]);
		});

		it("none of them is valid against plain 3.23.31: each needs the contract", () => {
			for (const document of Object.values(B2B_DOCUMENTS)) {
				expect(validate(base!, parse(String(document))).length).toBeGreaterThan(0);
			}
		});

		it("the state the storefront reads is the backend's `B2bTaxState`, `paymentLocked` included", () => {
			const field = backend!.getType("Checkout") as unknown as {
				getFields: () => Record<string, { type: unknown }>;
			};
			expect(String(field.getFields().b2bTaxState?.type)).toBe("B2bTaxState!");
			expect(String(B2B_DOCUMENTS.MakyB2bCheckoutStateDocument)).toMatch(/\bpaymentLocked\b/);
			expect(String(B2B_DOCUMENTS.MakyB2bApplyVerificationDocument)).toMatch(/\bpaymentLocked\b/);
		});

		it("the lock release asks for the backend's status and for `paymentLocked` in the same answer", () => {
			const release = String(B2B_DOCUMENTS.MakyB2bReleasePaymentLockDocument);
			expect(release).toMatch(/checkoutB2bPaymentLockRelease\(id: \$id\)/);
			expect(release).toMatch(/\bstatus\b/);
			expect(release).toMatch(/errors \{\s*field\s*code\s*message\s*\}/);
			expect(release).toMatch(/b2bTaxState \{[^}]*\bpaymentLocked\b/);
			// The statuses and error codes the storefront maps are exactly the backend's.
			const values = (name: string) =>
				(backend!.getType(name) as unknown as { getValues: () => Array<{ name: string }> })
					.getValues()
					.map((value) => value.name);
			expect(values("B2bPaymentLockReleaseStatus")).toEqual([...B2B_PAYMENT_LOCK_RELEASE_STATUSES]);
			expect(values("CheckoutB2bPaymentLockReleaseErrorCode")).toEqual(["GRAPHQL_ERROR", "NOT_FOUND"]);
		});

		it("the readiness probe, executed on the backend's schema: ready, and the write is only validated", async () => {
			const saleor = saleorFor(backend!);
			setB2bAppExecutorForTests(saleor.executor as never);
			const readiness = await checkB2bReadiness({ fresh: true });
			expect(readiness.failures).toEqual([]);
			expect(readiness).toMatchObject({
				ok: true,
				schema: { contract: "valid", errors: [] },
				app: { id: APP.id, name: APP.name, isActive: true },
				permissions: { required: { MANAGE_TAXES: true, HANDLE_TAXES: true }, other: [] },
			});
			expect(saleor.calls).toEqual([{ operationName: MAKY_B2B_READINESS_OPERATION }]);
			expect(saleor.mutationExecuted()).toBe(false);
		});

		it("the same probe on plain 3.23.31: not ready, and Saleor's validation says what is missing", async () => {
			setB2bAppExecutorForTests(saleorFor(base!).executor as never);
			const readiness = await checkB2bReadiness({ fresh: true });
			expect(readiness.ok).toBe(false);
			expect(readiness.failures).toContain("schema-contract-invalid");
			expect(readiness.schema.contract).toBe("invalid");
			const said = readiness.schema.errors.join("\n");
			expect(said).toMatch(/b2bTaxState/);
			expect(said).toMatch(/checkoutB2bTaxAttestationUpdate|CheckoutB2bTaxAttestationInput/);
			expect(readiness.app).toBeNull();
		});

		it("a backend without a field the storefront reads is not ready, and the field is named", async () => {
			const withoutLock = extensionSdl.replace(
				/\n\s*"""(?:(?!""")[\s\S])*"""\s*\n\s*paymentLocked: Boolean!\n/,
				"\n",
			);
			expect(withoutLock).not.toMatch(/^\s*paymentLocked: Boolean!/m);
			setB2bAppExecutorForTests(saleorFor(extendSchema(base!, parse(withoutLock))).executor as never);
			const readiness = await checkB2bReadiness({ fresh: true });
			expect(readiness.failures).toContain("schema-contract-invalid");
			expect(readiness.schema.errors.join("\n")).toMatch(/paymentLocked/);
		});

		it("a backend with revision 1 of the contract (no lock release) is not ready, and the mutation is named", async () => {
			const revision1 = extensionSdl.replace(
				/\n\s*"""(?:(?!""")[\s\S])*"""\s*\n\s*checkoutB2bPaymentLockRelease\([\s\S]*?\): CheckoutB2bPaymentLockRelease\n/,
				"\n",
			);
			expect(revision1).not.toMatch(/^\s*checkoutB2bPaymentLockRelease\(/m);
			const saleor = saleorFor(extendSchema(base!, parse(revision1)));
			setB2bAppExecutorForTests(saleor.executor as never);
			const readiness = await checkB2bReadiness({ fresh: true });
			expect(readiness.ok).toBe(false);
			expect(readiness.failures).toContain("schema-contract-invalid");
			expect(readiness.schema.errors.join("\n")).toMatch(/checkoutB2bPaymentLockRelease/);
			expect(saleor.mutationExecuted()).toBe(false);
		});

		it("a type name the documents do not spell cannot make the check wrong (the old probe asked for one)", async () => {
			// PR #84 at first asked introspection for `CheckoutB2bTaxState`, the proposal's name; the backend calls it
			// `B2bTaxState`. The probe now validates what is sent, which names fields only, so either spelling is ready.
			const renamed = extensionSdl.replace(/\bB2bTaxState\b/g, "CheckoutB2bTaxState");
			setB2bAppExecutorForTests(saleorFor(extendSchema(base!, parse(renamed))).executor as never);
			expect(await checkB2bReadiness({ fresh: true })).toMatchObject({
				ok: true,
				schema: { contract: "valid" },
			});
		});
	},
);

describe("the extension is the backend's, generated", () => {
	it("names the backend commit and the hash of the schema it came from", () => {
		expect(extensionSdl).toMatch(/^# GENERATED, do not edit: node scripts\/b2b-schema-extension\.mjs/m);
		expect(extensionSdl).toMatch(
			/^# Source: MakySto\/maky-saleor [0-9a-f]{40}, saleor\/graphql\/schema\.graphql$/m,
		);
		expect(extensionSdl).toMatch(/^#\s+sha256 [0-9a-f]{64}$/m);
	});

	it("the script takes additions only, and refuses anything else", () => {
		const baseSdl = "type Query { a: String, b(x: Int): Int }\ntype Checkout { id: ID! }\nenum Code { ONE }";
		const ok = deriveExtension(
			baseSdl,
			"type Query { a: String, b(x: Int): Int }\ntype Checkout { id: ID!, state: State! }\ntype State { v: String! }\nenum Code { ONE TWO }",
		);
		expect(ok.problems).toEqual([]);
		expect(ok.sdl).toMatch(/^type State \{/m);
		expect(ok.sdl).toMatch(/^extend type Checkout \{\n {2}state: State!\n\}/m);
		expect(ok.sdl).toMatch(/^extend enum Code \{\n {2}TWO\n\}/m);

		for (const changed of [
			"type Query { a: String }\ntype Checkout { id: ID! }\nenum Code { ONE }",
			"type Query { a: Int, b(x: Int): Int }\ntype Checkout { id: ID! }\nenum Code { ONE }",
			"type Query { a: String, b(x: Int, y: Int!): Int }\ntype Checkout { id: ID! }\nenum Code { ONE }",
			"type Query { a: String, b(x: Int): Int }\ntype Checkout { id: ID! }\nenum Code { TWO }",
		]) {
			expect(deriveExtension(baseSdl, changed).problems.length, changed).toBeGreaterThan(0);
		}
	});
});

describe("the live-generated documents stay buildable before the backend ships", () => {
	it("no document that prebuild sends to the LIVE Saleor names a B2B contract field", () => {
		const live = [
			...filesUnder(path.join(root, "src/graphql"), ".graphql"),
			...filesUnder(path.join(root, "src/checkout/graphql"), ".graphql"),
		];
		expect(live.length).toBeGreaterThan(10);
		for (const file of live) {
			expect(readFileSync(file, "utf8"), file).not.toMatch(/b2bTaxState|checkoutB2bTaxAttestationUpdate/);
		}
	});

	it("the public checkout reads the company input as a public metafield", () => {
		const checkout = readFileSync(path.join(root, "src/checkout/graphql/checkout.graphql"), "utf8");
		expect(checkout).toMatch(/b2bInput: metafield\(key: "maky\.b2b\.input\.v1"\)/);
		expect(checkout).not.toMatch(/privateMetafield|privateMetadata/);
	});
});
