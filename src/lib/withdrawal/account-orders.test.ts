import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatOrderNumber } from "@/lib/order-number";

const executeAuthenticatedGraphQL = vi.hoisted(() => vi.fn());
vi.mock("@/lib/graphql", () => ({ executeAuthenticatedGraphQL }));
vi.mock("@/gql/graphql", () => ({ OrderByNumberDocument: {} }));

const { loadOwnedOrders, verifyOrderSelection } = await import("./account-orders");

/** Two orders that belong to the session, shaped like Saleor's `me.orders`. */
function meOrders() {
	return {
		ok: true,
		data: {
			me: {
				orders: {
					edges: [
						{
							node: {
								id: "T3JkZXI6MQ==",
								number: "1042",
								created: "2026-07-01T10:00:00.000Z",
								lines: [
									{
										id: "line-a",
										quantity: 2,
										variant: { name: "Čierny", product: { name: "Strešný box" } },
									},
									{ id: "line-b", quantity: 1, variant: { name: "", product: { name: "Nosič bicyklov" } } },
								],
							},
						},
						{
							node: {
								id: "T3JkZXI6Mg==",
								number: "1099",
								created: "2026-07-20T10:00:00.000Z",
								lines: [
									{ id: "line-c", quantity: 3, variant: { name: "", product: { name: "Snehové reťaze" } } },
								],
							},
						},
					],
				},
			},
		},
	};
}

beforeEach(() => {
	executeAuthenticatedGraphQL.mockReset();
	// loadOwnedOrders is React-cached per request; each test needs its own module state.
	vi.resetModules();
});

describe("loadOwnedOrders", () => {
	it("maps the session's own orders", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(meOrders());
		const orders = await loadOwnedOrders();
		expect(orders).toHaveLength(2);
		expect(orders[0]).toMatchObject({ id: "T3JkZXI6MQ==", number: "1042" });
		expect(orders[0]?.lines.map((line) => line.productName)).toEqual(["Strešný box", "Nosič bicyklov"]);
	});

	it("returns nothing when there is no session, rather than throwing", async () => {
		// The form must still render for a guest; an empty list is a normal outcome.
		executeAuthenticatedGraphQL.mockResolvedValue({ ok: true, data: { me: null } });
		expect(await loadOwnedOrders()).toEqual([]);

		executeAuthenticatedGraphQL.mockResolvedValue({ ok: false, error: "unauthenticated" });
		expect(await loadOwnedOrders()).toEqual([]);
	});

	it("keeps a line whose variant was deleted, under a fallback name", async () => {
		// The customer may well be withdrawing from exactly that line.
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: {
				me: {
					orders: {
						edges: [
							{
								node: {
									id: "o1",
									number: "1",
									created: "2026-07-01T00:00:00.000Z",
									lines: [{ id: "l1", quantity: 1, variant: null }],
								},
							},
						],
					},
				},
			},
		});
		const orders = await loadOwnedOrders();
		expect(orders[0]?.lines[0]?.productName).toBe("Položka objednávky");
	});
});

describe("verifyOrderSelection — the client's claim is worthless", () => {
	beforeEach(() => {
		executeAuthenticatedGraphQL.mockResolvedValue(meOrders());
	});

	it("accepts an order that really belongs to the session", async () => {
		const verified = await verifyOrderSelection({
			claimedOrderId: "T3JkZXI6MQ==",
			claimedLines: [{ orderLineId: "line-a", quantity: 1 }],
		});
		expect(verified).toEqual({
			saleorOrderId: "T3JkZXI6MQ==",
			orderNumber: "ORD-1042",
			lines: [{ id: "line-a", productName: "Strešný box", quantity: 1 }],
		});
	});

	it("refuses another customer's order", async () => {
		// Saleor's me.orders cannot return somebody else's order, so an id that is not
		// in the list is by definition not theirs.
		expect(
			await verifyOrderSelection({
				claimedOrderId: "T3JkZXI6OTk5OQ==",
				claimedLines: [{ orderLineId: "line-a", quantity: 1 }],
			}),
		).toBeNull();
	});

	it("drops a line that belongs to a different order of the same customer", async () => {
		const verified = await verifyOrderSelection({
			claimedOrderId: "T3JkZXI6MQ==",
			claimedLines: [
				{ orderLineId: "line-a", quantity: 1 },
				{ orderLineId: "line-c", quantity: 1 },
			],
		});
		expect(verified?.lines.map((line) => line.id)).toEqual(["line-a"]);
	});

	it("drops a line id that exists nowhere, without saying which one it dropped", async () => {
		const verified = await verifyOrderSelection({
			claimedOrderId: "T3JkZXI6MQ==",
			claimedLines: [{ orderLineId: "line-does-not-exist", quantity: 1 }],
		});
		expect(verified?.lines).toEqual([]);
	});

	it("clamps a quantity to what was actually bought", async () => {
		const verified = await verifyOrderSelection({
			claimedOrderId: "T3JkZXI6MQ==",
			claimedLines: [{ orderLineId: "line-a", quantity: 9_999 }],
		});
		expect(verified?.lines[0]?.quantity).toBe(2);
	});

	it("clamps a zero, a negative and a fractional quantity to at least one", async () => {
		for (const quantity of [0, -5, 0.4]) {
			const verified = await verifyOrderSelection({
				claimedOrderId: "T3JkZXI6MQ==",
				claimedLines: [{ orderLineId: "line-a", quantity }],
			});
			expect(verified?.lines[0]?.quantity, String(quantity)).toBe(1);
		}
	});

	it("returns null when no order was claimed at all", async () => {
		expect(await verifyOrderSelection({ claimedOrderId: null, claimedLines: [] })).toBeNull();
		expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
	});

	it("takes the order number from the server, not from the caller", async () => {
		const verified = await verifyOrderSelection({
			claimedOrderId: "T3JkZXI6Mg==",
			claimedLines: [],
		});
		expect(verified?.orderNumber).toBe("ORD-1099");
	});

	it("returns the number in the form the customer was shown, not Saleor's bare integer", async () => {
		// This value becomes `contract.orderNumber` in the stored notice and is printed on
		// the receipt and in both e-mails. It used to be "1099" — an identifier the
		// customer had never seen, on the document the feature exists to produce. The
		// machine handle travels separately as `saleorOrderId`.
		const verified = await verifyOrderSelection({
			claimedOrderId: "T3JkZXI6Mg==",
			claimedLines: [],
		});
		expect(verified?.orderNumber).toBe(formatOrderNumber("1099"));
		expect(verified?.orderNumber).not.toBe("1099");
		expect(verified?.saleorOrderId).toBe("T3JkZXI6Mg==");
	});
});
