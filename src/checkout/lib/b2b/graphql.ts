import "server-only";

import { TypedDocumentString } from "@/gql/graphql";

import type { B2bPaymentLockReleaseStatus, B2bVatVerificationStatus } from "./contract";

/**
 * The B2B documents, as strings with hand-written result types.
 *
 * Why not `.graphql` files under `src/checkout/graphql/`: `pnpm generate:checkout` runs against the LIVE Saleor in
 * `prebuild`, and a Saleor without the MAKY-B2B-V1 patch does not know `b2bTaxState` or
 * `checkoutB2bTaxAttestationUpdate`, so such a file would fail every production build while the backend is not
 * deployed, and again after a backend rollback. These strings are sent only on the B2B path (UI flag on, a company
 * input on the checkout), so the ordinary checkout never sends them.
 *
 * `graphql.test.ts` validates every document here against the pinned 3.23.31 schema PLUS `maky-b2b-v1.graphql`,
 * which `scripts/b2b-schema-extension.mjs` generates from the backend's own `schema.graphql` (MakySto/maky-saleor),
 * and runs the readiness probe on that schema. A typo, or a backend that renames something, fails a test, not a
 * customer.
 */

export type MoneyAmount = { amount: number; currency: string };

export type B2bTaxStateFields = {
	contextVersion: string;
	decision: string;
	effectiveTaxExemption: boolean;
	checkedAt: string | null;
	expiresAt: string | null;
	/**
	 * A payment attempt of the checkout holds money or may still take it (contract revision 2, §8). Time alone never
	 * ends it, and neither does a failed card (`*_FAILURE`): a Stripe PaymentIntent can be confirmed again. Only a
	 * confirmed cancelation (`CANCEL_SUCCESS`), a full refund, or proof that the attempt never came to exist ends it.
	 * While it is true no attestation is accepted; on a checkout with a B2B payment snapshot the company input,
	 * addresses, delivery, lines and promo codes are refused too (`B2B_CHECKOUT_LOCKED`). The same offer can always be
	 * paid again; to change anything the customer first ends the attempt (`MakyB2bReleasePaymentLockDocument`), and a
	 * change is offered only once this reads `false`.
	 */
	paymentLocked: boolean;
};

export type B2bCheckoutTotals = {
	net: MoneyAmount | null;
	tax: MoneyAmount | null;
	gross: MoneyAmount | null;
} | null;

const B2B_STATE_SELECTION = `
		id
		b2bTaxState {
			contextVersion
			decision
			effectiveTaxExemption
			checkedAt
			expiresAt
			paymentLocked
		}
		totalPrice {
			net {
				amount
				currency
			}
			tax {
				amount
				currency
			}
			gross {
				amount
				currency
			}
		}`;

export type MakyB2bCheckoutStateQuery = {
	checkout: {
		id: string;
		b2bTaxState: B2bTaxStateFields | null;
		totalPrice: B2bCheckoutTotals;
	} | null;
};
export type MakyB2bCheckoutStateQueryVariables = { id: string };

const STATE_QUERY = `query MakyB2bCheckoutState($id: ID!) {
	checkout(id: $id) {${B2B_STATE_SELECTION}
	}
}`;

/** Public, like every other field of the checkout: the checkout id is the credential, no token is sent. */
export const MakyB2bCheckoutStateDocument = new TypedDocumentString<
	MakyB2bCheckoutStateQuery,
	MakyB2bCheckoutStateQueryVariables
>(STATE_QUERY);

export type CheckoutB2bVatVerificationInput = {
	vatId: string;
	status: B2bVatVerificationStatus;
	checkedAt: string;
	requestIdentifier?: string | null;
	name?: string | null;
	address?: string | null;
};

export type CheckoutB2bTaxAttestationInput = {
	expectedContextVersion: string;
	/** `null` revokes the previous approval. */
	verification: CheckoutB2bVatVerificationInput | null;
};

export type MakyB2bApplyVerificationMutation = {
	checkoutB2bTaxAttestationUpdate: {
		errors: ReadonlyArray<{ field: string | null; code: string; message: string | null }>;
		checkout: NonNullable<MakyB2bCheckoutStateQuery["checkout"]> | null;
	} | null;
};
export type MakyB2bApplyVerificationMutationVariables = {
	id: string;
	input: CheckoutB2bTaxAttestationInput;
};

const APPLY_MUTATION = `mutation MakyB2bApplyVerification($id: ID!, $input: CheckoutB2bTaxAttestationInput!) {
	checkoutB2bTaxAttestationUpdate(id: $id, input: $input) {
		errors {
			field
			code
			message
		}
		checkout {${B2B_STATE_SELECTION}
		}
	}
}`;

/** The privileged write of the contract — one backend transaction: check context, store, decide, invalidate. */
export const MakyB2bApplyVerificationDocument = new TypedDocumentString<
	MakyB2bApplyVerificationMutation,
	MakyB2bApplyVerificationMutationVariables
>(APPLY_MUTATION);

export type MakyB2bReleasePaymentLockMutation = {
	checkoutB2bPaymentLockRelease: {
		status: B2bPaymentLockReleaseStatus | null;
		errors: ReadonlyArray<{ field: string | null; code: string; message: string | null }>;
		checkout: {
			id: string;
			b2bTaxState: Pick<B2bTaxStateFields, "contextVersion" | "decision" | "paymentLocked"> | null;
		} | null;
	} | null;
};
export type MakyB2bReleasePaymentLockMutationVariables = { id: string };

const RELEASE_MUTATION = `mutation MakyB2bReleasePaymentLock($id: ID!) {
	checkoutB2bPaymentLockRelease(id: $id) {
		status
		errors {
			field
			code
			message
		}
		checkout {
			id
			b2bTaxState {
				contextVersion
				decision
				paymentLocked
			}
		}
	}
}`;

/**
 * Recovery from a started payment the customer wants to leave (contract revision 2, §5): attempts without money are
 * asked to cancel through their payment app, attempts with money are left alone (no refund, no cancelation of
 * authorized money). Made as the B2B app (MANAGE_TAXES + HANDLE_TAXES), from the server only; idempotent, and the
 * backend ignores a repeated cancel request for the same attempt within 60 s.
 */
export const MakyB2bReleasePaymentLockDocument = new TypedDocumentString<
	MakyB2bReleasePaymentLockMutation,
	MakyB2bReleasePaymentLockMutationVariables
>(RELEASE_MUTATION);

export type MakyB2bReadinessQuery = {
	app: {
		id: string;
		name: string | null;
		isActive: boolean | null;
		permissions: ReadonlyArray<{ code: string }> | null;
	} | null;
};
/** The operation of `MakyB2bReadinessDocument` that is executed; the other three are only validated. */
export const MAKY_B2B_READINESS_OPERATION = "MakyB2bReadiness";

/**
 * Values for the variables of the three operations that are only validated (`$id`, `$input`).
 *
 * Saleor checks the cost of a request before it runs anything (`CostValidator`, `saleor/graphql/core/validators/
 * query_cost.py`), and that check walks EVERY operation of the document, not only the one `operationName` names: it
 * reads each field's arguments through graphql-core's `get_argument_values`, which refuses a required argument whose
 * variable has no value. Without these values the live Saleor answered the probe with HTTP 400 ("Argument "id" of
 * required type ID!" provided the variable "$id" which was not provided"), and readiness said
 * `schema-contract-invalid` although the backend had the whole contract (server of the shop, 3. 11. 2026: with both
 * values the same document is answered 200).
 *
 * Execution reads only the variables `MakyB2bReadiness` declares, which are none, so these are never used: no
 * checkout is read and neither mutation runs. The id names no checkout (the nil UUID), and the input has the shape of
 * `CheckoutB2bTaxAttestationInput`, so a Saleor that also coerced them would accept them. A required variable added to
 * any operation of the document needs a value here; `graphql.test.ts` fails until it has one.
 */
export const MAKY_B2B_READINESS_PROBE_VARIABLES = {
	/** `Checkout:00000000-0000-0000-0000-000000000000`, as a Saleor global id. */
	id: "Q2hlY2tvdXQ6MDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAw",
	input: { expectedContextVersion: "readiness-probe", verification: null },
} as const satisfies MakyB2bApplyVerificationMutationVariables;

export type MakyB2bReadinessQueryVariables = typeof MAKY_B2B_READINESS_PROBE_VARIABLES;

/**
 * Read-only readiness probe with the B2B app token.
 *
 * Executed: `app` (without an id: the app the token authenticates as; the token itself is never selected), its
 * activity and permissions.
 *
 * Only validated: the very state query, attestation mutation and lock release the storefront sends. A GraphQL server
 * validates the WHOLE document before it executes the one operation named by `operationName` (graphql-core's
 * `validate` over the document in Saleor's `SaleorGraphQLBackend`), so an endpoint without the contract (or with
 * revision 1 of it, which has no `checkoutB2bPaymentLockRelease`), or with any name, field, argument or input type
 * spelled differently, answers HTTP 400 with the validation errors and runs nothing. No schema type name is spelled
 * out here: what is checked is exactly what is sent. The mutations are never executed: neither is the named
 * operation. Their variables still get values (`MAKY_B2B_READINESS_PROBE_VARIABLES`), because Saleor's cost check
 * reads the arguments of every operation and refuses a required one without a value.
 */
export const MakyB2bReadinessDocument = new TypedDocumentString<
	MakyB2bReadinessQuery,
	MakyB2bReadinessQueryVariables
>(`query ${MAKY_B2B_READINESS_OPERATION} {
	app {
		id
		name
		isActive
		permissions {
			code
		}
	}
}

${STATE_QUERY}

${APPLY_MUTATION}

${RELEASE_MUTATION}`);

/** Every B2B document, for the schema test. */
export const B2B_DOCUMENTS = {
	MakyB2bCheckoutStateDocument,
	MakyB2bApplyVerificationDocument,
	MakyB2bReleasePaymentLockDocument,
	MakyB2bReadinessDocument,
} as const;
