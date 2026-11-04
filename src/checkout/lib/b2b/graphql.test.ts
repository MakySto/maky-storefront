import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
	buildSchema,
	extendSchema,
	getArgumentValues,
	getVariableValues,
	graphql,
	Kind,
	parse,
	TypeInfo,
	validate,
	visit,
	visitWithTypeInfo,
	type DocumentNode,
	type GraphQLSchema,
} from "graphql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphQLResult } from "@/lib/graphql";

import { deriveExtension } from "../../../../scripts/b2b-schema-extension.mjs";
import { B2B_PAYMENT_LOCK_RELEASE_STATUSES } from "./contract";
import {
	B2B_DOCUMENTS,
	MAKY_B2B_READINESS_OPERATION,
	MAKY_B2B_READINESS_PROBE_VARIABLES,
	MakyB2bReadinessDocument,
} from "./graphql";
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
 * Saleor's cost check (`CostValidator`, `saleor/graphql/core/validators/query_cost.py`) as it treats variables: before
 * anything runs, it reads the arguments of every field of EVERY operation in the document through graphql-core's
 * `get_argument_values`, which refuses a required argument whose variable has no value, whatever `operationName`
 * says. The live Saleor answered the readiness probe sent without `$id` and `$input` with HTTP 400 and exactly this
 * refusal (server of the shop, 3. 11. 2026). graphql-js's `getArgumentValues` applies the same rule.
 */
function costCheckErrors(
	schema: GraphQLSchema,
	document: DocumentNode,
	variables: Record<string, unknown> | undefined,
): string[] {
	const errors: string[] = [];
	const typeInfo = new TypeInfo(schema);
	visit(
		document,
		visitWithTypeInfo(typeInfo, {
			Field(node) {
				const field = typeInfo.getFieldDef();
				if (!field || !node.arguments?.length) return;
				try {
					getArgumentValues(field, node, variables);
				} catch (error) {
					errors.push((error as Error).message);
				}
			},
		}),
	);
	return errors;
}

/** What the transport hands over for Saleor's HTTP 400 with GraphQL errors. */
function http400(messages: string[]): GraphQLResult<unknown> {
	const body = JSON.stringify({ errors: messages.map((message) => ({ message })) });
	return {
		ok: false,
		error: { type: "http", statusCode: 400, message: `HTTP 400: Bad Request\n${body}`, isRetryable: false },
	} as GraphQLResult<unknown>;
}

/**
 * A Saleor stand-in for one schema: like `SaleorGraphQLBackend`, it validates the WHOLE document, then checks its
 * cost over every operation (`costCheckErrors`), and answers a refused one with HTTP 400 and the errors (handed over
 * as the transport does: status and response text); an accepted one runs the operation named by `operationName`
 * only. The resolvers record what ran, so a probe that executed a write or read a checkout would be seen.
 */
function saleorFor(schema: GraphQLSchema) {
	const calls: Array<{ operationName?: string }> = [];
	let mutationExecuted = false;
	let checkoutRead = false;
	const rootValue = {
		app: () => APP,
		checkout: () => {
			checkoutRead = true;
			return null;
		},
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
		const ast = parse(source);
		const errors = validate(schema, ast);
		if (errors.length) return http400(errors.map((error) => error.message));
		const costErrors = costCheckErrors(schema, ast, options.variables as Record<string, unknown> | undefined);
		if (costErrors.length) return http400(costErrors);
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
	return { executor, calls, mutationExecuted: () => mutationExecuted, checkoutRead: () => checkoutRead };
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
			// The placeholder id is never used to read a checkout.
			expect(saleor.checkoutRead()).toBe(false);
		});

		it("Saleor's cost check refuses the probe without values for the variables it only validates (3. 11.)", async () => {
			// The same three requests the server of the shop sent to the live Saleor, with the same three answers.
			const saleor = saleorFor(backend!);
			const send = (variables: Record<string, unknown>) =>
				saleor.executor(MakyB2bReadinessDocument, { variables, operationName: MAKY_B2B_READINESS_OPERATION });
			// The messages of an HTTP 400, as Saleor sends them in the body.
			const refused = (result: GraphQLResult<unknown>) => {
				expect(result).toMatchObject({ ok: false, error: { statusCode: 400 } });
				const text = result.ok ? "" : result.error.message;
				const body = JSON.parse(text.slice(text.indexOf("{"))) as { errors: Array<{ message: string }> };
				return body.errors.map((error) => error.message).join("\n");
			};
			const nothing = refused(await send({}));
			expect(nothing).toMatch(/variable "\$id" which was not provided/);
			const idOnly = refused(await send({ id: MAKY_B2B_READINESS_PROBE_VARIABLES.id }));
			expect(idOnly).toMatch(/variable "\$input" which was not provided/);
			expect(idOnly).not.toMatch(/"\$id"/);
			expect(await send({ ...MAKY_B2B_READINESS_PROBE_VARIABLES })).toEqual({ ok: true, data: { app: APP } });
			expect(saleor.mutationExecuted()).toBe(false);
			expect(saleor.checkoutRead()).toBe(false);
		});

		it("the placeholders have the types of the variables they stand for", () => {
			// Not needed by the cost check, which takes the raw value; a Saleor that coerced them would still accept them.
			const ast = parse(String(MakyB2bReadinessDocument));
			const result = validate(backend!, ast);
			expect(result).toEqual([]);
			for (const operation of ast.definitions) {
				if (operation.kind !== Kind.OPERATION_DEFINITION || !operation.variableDefinitions?.length) continue;
				const values = Object.fromEntries(
					operation.variableDefinitions.map((definition) => [
						definition.variable.name.value,
						MAKY_B2B_READINESS_PROBE_VARIABLES[
							definition.variable.name.value as keyof typeof MAKY_B2B_READINESS_PROBE_VARIABLES
						],
					]),
				);
				const coerced = getVariableValues(backend!, operation.variableDefinitions, values);
				expect(coerced.errors ?? []).toEqual([]);
			}
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

/**
 * The variables Saleor's cost check needs a value for: every one that an operation of the document declares as
 * required (non-null, without a default). Needs no schema, so it runs on the production box too.
 */
function requiredVariablesWithoutValue(source: string, values: Record<string, unknown>): string[] {
	const missing = new Set<string>();
	for (const definition of parse(source).definitions) {
		if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
		for (const variable of definition.variableDefinitions ?? []) {
			const name = variable.variable.name.value;
			const required = variable.type.kind === Kind.NON_NULL_TYPE && !variable.defaultValue;
			if (required && values[name] == null) missing.add(name);
		}
	}
	return [...missing].sort();
}

describe("the readiness probe gives every required variable of its document a value", () => {
	const document = String(MakyB2bReadinessDocument);

	it("with the values it sends, none is missing", () => {
		expect(requiredVariablesWithoutValue(document, MAKY_B2B_READINESS_PROBE_VARIABLES)).toEqual([]);
	});

	it("without them, the two the live Saleor asked for are missing (the refusal of 3. 11.)", () => {
		expect(requiredVariablesWithoutValue(document, {})).toEqual(["id", "input"]);
	});

	it("an operation added to the document with a required variable that has no value is caught", () => {
		const added = `${document}\n\nquery MakyB2bSomethingNew($code: String!) {\n\tapp {\n\t\tid\n\t}\n}`;
		expect(requiredVariablesWithoutValue(added, MAKY_B2B_READINESS_PROBE_VARIABLES)).toEqual(["code"]);
	});

	it("the placeholder id names no checkout: the nil UUID as a Saleor global id", () => {
		expect(Buffer.from(MAKY_B2B_READINESS_PROBE_VARIABLES.id, "base64").toString("utf8")).toBe(
			"Checkout:00000000-0000-0000-0000-000000000000",
		);
	});
});

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
