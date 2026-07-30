import "server-only";
import { cache } from "react";
import { OrderByNumberDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";

/**
 * The signed-in customer's own orders, for the account mode of the withdrawal form.
 *
 * Ownership is not something this module checks — it is something Saleor's `me.orders`
 * guarantees, because the query is scoped to the session and cannot return anybody
 * else's order. That is exactly why every ownership decision goes through here rather
 * than through an id supplied by the browser: an id in a form field is a claim, and a
 * claim about whose order it is has no value at all.
 *
 * It reuses `OrderByNumberDocument` deliberately. Adding a leaner GraphQL document
 * would be a change to the Saleor query structure, which needs sign-off (CLAUDE.md
 * §10), and this reuse costs one already-existing round trip.
 *
 * Consequence worth knowing: the document pages the first 100 orders, so a customer
 * with more than that would not see the oldest ones listed. The manual fallback covers
 * it — the form never depends on the list being complete.
 */

export interface OwnedOrderLine {
	readonly id: string;
	readonly productName: string;
	readonly quantity: number;
}

export interface OwnedOrder {
	readonly id: string;
	readonly number: string;
	readonly createdAt: string;
	readonly lines: readonly OwnedOrderLine[];
}

const ORDER_PAGE_SIZE = 100;

/** Memoised per request: the page and the action both want it. */
export const loadOwnedOrders = cache(async (): Promise<OwnedOrder[]> => {
	const result = await executeAuthenticatedGraphQL(OrderByNumberDocument, {
		variables: { first: ORDER_PAGE_SIZE },
		cache: "no-cache",
	});

	if (!result.ok || !result.data.me) return [];

	return (result.data.me.orders?.edges ?? []).map(({ node }) => ({
		id: node.id,
		number: node.number,
		createdAt: node.created,
		lines: node.lines
			.map((line) => ({
				id: line.id,
				// `variant` is nullable once a product is deleted; the line still exists
				// and the customer may still be withdrawing from it, so it keeps a name.
				productName: line.variant?.product.name ?? line.variant?.name ?? "Položka objednávky",
				quantity: line.quantity,
			}))
			.filter((line) => line.quantity > 0),
	}));
});

export interface VerifiedOrderSelection {
	readonly saleorOrderId: string;
	readonly orderNumber: string;
	/** Only the lines that really belong to that order, with clamped quantities. */
	readonly lines: readonly OwnedOrderLine[];
}

/**
 * Re-derive an order selection from the session, discarding whatever the client sent.
 *
 * The browser proposes an order id and some line ids and quantities; none of it is
 * trusted. The order must be in the session's own list, each line must belong to that
 * order, and each quantity is clamped to what was actually bought. Anything else is
 * dropped silently rather than reported, because telling a caller *which* part of a
 * forged selection was rejected is a way of exploring somebody else's order.
 *
 * Returns `null` when the claimed order is not the customer's — the caller then treats
 * the submission as a manual one rather than refusing it, because a wrong id is not a
 * reason to destroy a legal notice.
 */
export async function verifyOrderSelection(input: {
	claimedOrderId: string | null;
	claimedLines: readonly { orderLineId: string | null; quantity: number }[];
}): Promise<VerifiedOrderSelection | null> {
	if (!input.claimedOrderId) return null;

	const orders = await loadOwnedOrders();
	const order = orders.find((candidate) => candidate.id === input.claimedOrderId);
	if (!order) return null;

	const byId = new Map(order.lines.map((line) => [line.id, line]));

	const lines: OwnedOrderLine[] = [];
	for (const claimed of input.claimedLines) {
		if (!claimed.orderLineId) continue;
		const line = byId.get(claimed.orderLineId);
		if (!line) continue;
		const quantity = Math.min(Math.max(1, Math.trunc(claimed.quantity)), line.quantity);
		lines.push({ id: line.id, productName: line.productName, quantity });
	}

	return { saleorOrderId: order.id, orderNumber: order.number, lines };
}
