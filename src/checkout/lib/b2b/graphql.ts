import "server-only";

import { TypedDocumentString } from "@/gql/graphql";

import type { B2bVatVerificationStatus } from "./contract";

/**
 * The B2B documents, as strings with hand-written result types.
 *
 * Why not `.graphql` files under `src/checkout/graphql/`: `pnpm generate:checkout` runs against the LIVE Saleor in
 * `prebuild`, and Saleor 3.23.31 does not know `b2bTaxState` or `checkoutB2bTaxAttestationUpdate` yet — such a file
 * would fail every production build until the backend patch is live. These strings are used only on the B2B path
 * (UI flag on, readiness passed), so the ordinary checkout never sends them.
 *
 * `graphql.test.ts` validates every document here against the pinned 3.23.31 schema PLUS the proposed extension in
 * `maky-b2b-v1.graphql`, so a typo or a drift from the proposal fails a test, not a customer. When the backend
 * hands over its schema, the extension file is replaced and these move into the codegen like any other document.
 */

export type MoneyAmount = { amount: number; currency: string };

export type B2bTaxStateFields = {
	contextVersion: string;
	decision: string;
	effectiveTaxExemption: boolean;
	checkedAt: string | null;
	expiresAt: string | null;
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

export const MakyB2bCheckoutStateDocument = new TypedDocumentString<
	MakyB2bCheckoutStateQuery,
	MakyB2bCheckoutStateQueryVariables
>(`query MakyB2bCheckoutState($id: ID!) {
	checkout(id: $id) {${B2B_STATE_SELECTION}
	}
}`);

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

/** The privileged write of the contract — one backend transaction: check context, store, decide, invalidate. */
export const MakyB2bApplyVerificationDocument = new TypedDocumentString<
	MakyB2bApplyVerificationMutation,
	MakyB2bApplyVerificationMutationVariables
>(`mutation MakyB2bApplyVerification($id: ID!, $input: CheckoutB2bTaxAttestationInput!) {
	checkoutB2bTaxAttestationUpdate(id: $id, input: $input) {
		errors {
			field
			code
			message
		}
		checkout {${B2B_STATE_SELECTION}
		}
	}
}`);

export type MakyB2bReadinessQuery = {
	app: {
		id: string;
		name: string | null;
		isActive: boolean | null;
		permissions: ReadonlyArray<{ code: string }> | null;
	} | null;
	mutationType: { fields: ReadonlyArray<{ name: string }> | null } | null;
	checkoutType: { fields: ReadonlyArray<{ name: string }> | null } | null;
	stateType: { fields: ReadonlyArray<{ name: string }> | null } | null;
};
export type MakyB2bReadinessQueryVariables = Record<string, never>;

/**
 * Read-only readiness probe with the B2B app token: which app the token authenticates as (`app` without an id is
 * the current app; the token itself is never selected), its permissions, and whether the endpoint's schema carries
 * the B2B contract. Introspection is the same mechanism the storefront's own `prebuild` codegen relies on.
 */
export const MakyB2bReadinessDocument = new TypedDocumentString<
	MakyB2bReadinessQuery,
	MakyB2bReadinessQueryVariables
>(`query MakyB2bReadiness {
	app {
		id
		name
		isActive
		permissions {
			code
		}
	}
	mutationType: __type(name: "Mutation") {
		fields {
			name
		}
	}
	checkoutType: __type(name: "Checkout") {
		fields {
			name
		}
	}
	stateType: __type(name: "CheckoutB2bTaxState") {
		fields {
			name
		}
	}
}`);

/** Every B2B document, for the schema test. */
export const B2B_DOCUMENTS = {
	MakyB2bCheckoutStateDocument,
	MakyB2bApplyVerificationDocument,
	MakyB2bReadinessDocument,
} as const;
