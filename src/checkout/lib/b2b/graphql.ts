import "server-only";

import { TypedDocumentString } from "@/gql/graphql";

import type { B2bVatVerificationStatus } from "./contract";

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
	 * A started payment froze the tax context: the backend rejects every company, VAT, address and delivery change and
	 * every attestation until the payment ends (failure, cancel or the lock's 20 minutes without money).
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

export type MakyB2bReadinessQuery = {
	app: {
		id: string;
		name: string | null;
		isActive: boolean | null;
		permissions: ReadonlyArray<{ code: string }> | null;
	} | null;
};
export type MakyB2bReadinessQueryVariables = Record<string, never>;

/** The operation of `MakyB2bReadinessDocument` that is executed; the other two are only validated. */
export const MAKY_B2B_READINESS_OPERATION = "MakyB2bReadiness";

/**
 * Read-only readiness probe with the B2B app token.
 *
 * Executed: `app` (without an id: the app the token authenticates as; the token itself is never selected), its
 * activity and permissions.
 *
 * Only validated: the very state query and attestation mutation the storefront sends. A GraphQL server validates the
 * WHOLE document before it executes the one operation named by `operationName` (graphql-core's `validate` over the
 * document in Saleor's `SaleorGraphQLBackend`), so an endpoint without the contract, or with any name, field,
 * argument or input type spelled differently, answers HTTP 400 with the validation errors and runs nothing. No
 * schema type name is spelled out here: what is checked is exactly what is sent. The mutation is never executed: it
 * is not the named operation, and its required variables are not supplied.
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

${APPLY_MUTATION}`);

/** Every B2B document, for the schema test. */
export const B2B_DOCUMENTS = {
	MakyB2bCheckoutStateDocument,
	MakyB2bApplyVerificationDocument,
	MakyB2bReadinessDocument,
} as const;
