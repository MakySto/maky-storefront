import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
	executeAuthenticatedGraphQL,
	executePublicGraphQL,
	findOrCreate,
	lookup,
	getIdFromCookies,
	saveIdToCookie,
	revalidatePath,
} = vi.hoisted(() => ({
	executeAuthenticatedGraphQL: vi.fn(),
	executePublicGraphQL: vi.fn(),
	findOrCreate: vi.fn(),
	lookup: vi.fn(),
	getIdFromCookies: vi.fn(),
	saveIdToCookie: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/graphql", () => ({ executeAuthenticatedGraphQL, executePublicGraphQL }));
vi.mock("@/lib/checkout", () => ({ findOrCreate, lookup, getIdFromCookies, saveIdToCookie }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
	CheckoutAddLineDocument,
	CheckoutAddSizedLineDocument,
	CheckoutLinesUpdateDocument,
} from "@/gql/graphql";
import { TYRE_META } from "@/lib/tyre-size/line-metadata";
import { tyreSizeProduct } from "@/lib/tyre-size/size-index";
import { addListingItemToCartWithResult, addVariantToCart } from "./actions";

/**
 * Snow chains and socks are added WITH the tyre size the customer chose. Saleor is mocked entirely: this asserts
 * which mutation the action picks, what it writes on the line, and that nothing is sent when the choice is wrong.
 */
const VARIANT = "UHJvZHVjdFZhcmlhbnQ6MQ==";
const CHECKOUT_ID = "Q2hlY2tvdXQ6MQ==";
const input = { channel: "sk-eur", variantId: VARIANT, quantity: 1 };

const purchasable = (name: string | undefined) => ({
	ok: true,
	data: { productVariant: { id: VARIANT, name, product: { id: "p1", isAvailableForPurchase: true } } },
});
const ready = (lines: unknown[] = [], created = false) => ({
	status: "ready" as const,
	checkout: { id: CHECKOUT_ID, lines },
	created,
});
const added = {
	ok: true as const,
	data: { checkoutLinesAdd: { checkout: { id: CHECKOUT_ID }, errors: [] } },
};
const updated = {
	ok: true as const,
	data: { checkoutLinesUpdate: { checkout: { id: CHECKOUT_ID }, errors: [] } },
};

const sizeLine = (
	id: string,
	quantity: number,
	size: string,
	extra: { key: string; value: string }[] = [],
) => ({
	id,
	quantity,
	variant: { id: VARIANT },
	metadata: [{ key: TYRE_META.mode, value: "size" }, { key: TYRE_META.size, value: size }, ...extra],
});
/** Two different sizes of N16061, both on its list. */
const SIZE_A = "145/70 R12";
const SIZE_B = tyreSizeProduct("N16061")!
	.sizes.map(([label]) => label)
	.find((label) => label !== SIZE_A)!;
const size = (value: string, conditionKey = "") => ({ mode: "size" as const, size: value, conditionKey });

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	executePublicGraphQL.mockResolvedValue(purchasable("N16061"));
	getIdFromCookies.mockResolvedValue(null);
	findOrCreate.mockResolvedValue(ready());
	lookup.mockResolvedValue({ status: "not-found" });
	saveIdToCookie.mockResolvedValue(undefined);
	executeAuthenticatedGraphQL.mockResolvedValue(added);
});

afterEach(() => vi.useRealTimers());

const settle = async <T>(promise: Promise<T>): Promise<T> => {
	await vi.runAllTimersAsync();
	return promise;
};

const nothingSent = () => {
	expect(findOrCreate).not.toHaveBeenCalled();
	expect(getIdFromCookies).not.toHaveBeenCalled();
	expect(saveIdToCookie).not.toHaveBeenCalled();
	expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
};

describe("a snow chain without a valid tyre choice is never added", () => {
	it("refuses a chain sent with no size at all, before any checkout is touched", async () => {
		await expect(addVariantToCart(input)).resolves.toMatchObject({
			status: "rejected",
			reason: "size-required",
		});
		nothingSent();
	});

	it("refuses it whatever else the form carries (quantity, max, the variant)", async () => {
		await expect(
			addVariantToCart({ ...input, quantity: 3, maxQuantity: 50, tyre: null }),
		).resolves.toMatchObject({
			reason: "size-required",
		});
		nothingSent();
	});

	it("refuses the combination the review invented: 145/70 R13 on N16061", async () => {
		await expect(addVariantToCart({ ...input, tyre: size("145/70 R13") })).resolves.toMatchObject({
			status: "rejected",
			reason: "size-invalid",
		});
		nothingSent();
	});

	it("refuses a size that is only almost written like a listed one", async () => {
		for (const wrong of ["145/70R12", "145/70 r12", " 145/70 R12", "145/70 R12 "]) {
			await expect(addVariantToCart({ ...input, tyre: size(wrong) }), wrong).resolves.toMatchObject({
				reason: "size-invalid",
			});
		}
		nothingSent();
	});

	it("asks for the condition on a size that carries one, and refuses a different condition", async () => {
		executePublicGraphQL.mockResolvedValue(purchasable("N16128"));
		await expect(addVariantToCart({ ...input, tyre: size("215/60 R16") })).resolves.toMatchObject({
			status: "rejected",
			reason: "size-condition",
		});
		await expect(addVariantToCart({ ...input, tyre: size("215/60 R16", "c10") })).resolves.toMatchObject({
			status: "rejected",
			reason: "size-condition",
		});
		nothingSent();
	});

	it("decides by the variant's own code as Saleor answers it, not by anything the form says", async () => {
		// The form claims a size of N17144; the variant is N16061. The size is checked against N16061's list.
		const foreign = "225/70 R17.5";
		await expect(addVariantToCart({ ...input, tyre: size(foreign) })).resolves.toMatchObject({
			reason: "size-invalid",
		});
		nothingSent();
	});

	it("goes through the listing card's form too: a card that sends no tyre fields cannot add a chain", async () => {
		const form = new FormData();
		form.set("channel", "sk-eur");
		form.set("variantId", VARIANT);
		form.set("quantity", "1");
		await expect(addListingItemToCartWithResult(form)).resolves.toMatchObject({
			status: "rejected",
			reason: "size-required",
		});
		nothingSent();
	});

	it("still checks purchasability first: an unavailable chain is unavailable, not a size problem", async () => {
		executePublicGraphQL.mockResolvedValue({
			ok: true,
			data: {
				productVariant: { id: VARIANT, name: "N16061", product: { id: "p1", isAvailableForPurchase: false } },
			},
		});
		await expect(addVariantToCart(input)).resolves.toMatchObject({ reason: "unavailable" });
		nothingSent();
	});
});

describe("a chain with a valid size", () => {
	it("is added as a NEW line with the size, the list and its basis on the line's metadata", async () => {
		await expect(addVariantToCart({ ...input, quantity: 2, tyre: size("145/70 R12") })).resolves.toEqual({
			status: "added",
		});

		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
		const [document, options] = executeAuthenticatedGraphQL.mock.calls[0];
		expect(document).toBe(CheckoutAddSizedLineDocument);
		expect(options.variables).toEqual({
			id: CHECKOUT_ID,
			productVariantId: VARIANT,
			quantity: 2,
			metadata: [
				{ key: TYRE_META.mode, value: "size" },
				{ key: TYRE_META.list, value: "snehove-retaze-20261105" },
				{ key: TYRE_META.size, value: "145/70 R12" },
				{ key: TYRE_META.basis, value: "manufacturer_list_2026_10" },
			],
		});
	});

	it("is added with forceNewLine, so a second size cannot overwrite the first line's metadata", () => {
		const query = String(CheckoutAddSizedLineDocument);
		expect(query).toContain("forceNewLine: true");
		expect(query).toContain("metadata: $metadata");
	});

	it("writes the condition the customer acknowledged", async () => {
		executePublicGraphQL.mockResolvedValue(purchasable("N16128"));
		await expect(addVariantToCart({ ...input, tyre: size("195/75 R16", "c10") })).resolves.toEqual({
			status: "added",
		});
		const { metadata } = executeAuthenticatedGraphQL.mock.calls[0][1].variables;
		expect(
			Object.fromEntries(metadata.map((m: { key: string; value: string }) => [m.key, m.value])),
		).toMatchObject({
			[TYRE_META.size]: "195/75 R16",
			[TYRE_META.conditionMode]: "not",
			[TYRE_META.conditionTyres]: "Kleber / Michelin / Continental",
		});
	});

	it("raises the quantity of the line that already holds that size, and adds no second line", async () => {
		findOrCreate.mockResolvedValue(ready([sizeLine("line-a", 2, "145/70 R12")]));
		executeAuthenticatedGraphQL.mockResolvedValue(updated);

		await expect(addVariantToCart({ ...input, quantity: 1, tyre: size("145/70 R12") })).resolves.toEqual({
			status: "added",
		});

		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
		const [document, options] = executeAuthenticatedGraphQL.mock.calls[0];
		expect(document).toBe(CheckoutLinesUpdateDocument);
		expect(options.variables).toEqual({
			checkoutId: CHECKOUT_ID,
			lines: [{ lineId: "line-a", quantity: 3 }],
		});
	});

	it("adds a SECOND line for a different size of the same code", async () => {
		findOrCreate.mockResolvedValue(ready([sizeLine("line-a", 2, "145/70 R12")]));

		await expect(addVariantToCart({ ...input, tyre: size(SIZE_B) })).resolves.toEqual({
			status: "added",
		});

		const [document, options] = executeAuthenticatedGraphQL.mock.calls[0];
		expect(document).toBe(CheckoutAddSizedLineDocument);
		expect(options.variables.metadata).toContainEqual({ key: TYRE_META.size, value: SIZE_B });
	});

	it("does not merge into a line of the same code that holds no tyre choice", async () => {
		findOrCreate.mockResolvedValue(
			ready([{ id: "line-x", quantity: 4, variant: { id: VARIANT }, metadata: [] }]),
		);

		await expect(addVariantToCart({ ...input, tyre: size("145/70 R12") })).resolves.toEqual({
			status: "added",
		});
		expect(executeAuthenticatedGraphQL.mock.calls[0][0]).toBe(CheckoutAddSizedLineDocument);
	});

	it("does not merge a size with the same size under another condition", async () => {
		executePublicGraphQL.mockResolvedValue(purchasable("N16128"));
		findOrCreate.mockResolvedValue(
			ready([
				sizeLine("line-a", 1, "195/75 R16", [
					{ key: TYRE_META.conditionMode, value: "only" },
					{ key: TYRE_META.conditionTyres, value: "Somebody Else" },
				]),
			]),
		);
		await expect(addVariantToCart({ ...input, tyre: size("195/75 R16", "c10") })).resolves.toEqual({
			status: "added",
		});
		expect(executeAuthenticatedGraphQL.mock.calls[0][0]).toBe(CheckoutAddSizedLineDocument);
	});

	it("passes a payment lock through, as every add does", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: {
				checkoutLinesAdd: {
					checkout: null,
					errors: [{ code: "B2B_CHECKOUT_LOCKED", field: "lines", message: "locked" }],
				},
			},
		});
		await expect(addVariantToCart({ ...input, tyre: size("145/70 R12") })).resolves.toMatchObject({
			status: "rejected",
			reason: "payment-locked",
			paymentLock: { checkoutId: CHECKOUT_ID, channelSlug: "sk-eur" },
		});
	});

	it("reports Saleor's refusal of the line, not success", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: {
				checkoutLinesAdd: {
					checkout: null,
					errors: [{ code: "INSUFFICIENT_STOCK", message: "only 1 left" }],
				},
			},
		});
		await expect(addVariantToCart({ ...input, tyre: size("145/70 R12") })).resolves.toMatchObject({
			status: "rejected",
			reason: "unavailable",
		});
	});
});

describe("a customer who knows the code", () => {
	it("is added, recorded as exactly that, and never as a size", async () => {
		await expect(addVariantToCart({ ...input, tyre: { mode: "code" } })).resolves.toEqual({
			status: "added",
		});
		const [document, options] = executeAuthenticatedGraphQL.mock.calls[0];
		expect(document).toBe(CheckoutAddSizedLineDocument);
		expect(options.variables.metadata).toEqual([
			{ key: TYRE_META.mode, value: "code" },
			{ key: TYRE_META.list, value: "snehove-retaze-20261105" },
		]);
	});

	it("raises the quantity of the line already added the same way", async () => {
		findOrCreate.mockResolvedValue(
			ready([
				{
					id: "line-k",
					quantity: 1,
					variant: { id: VARIANT },
					metadata: [{ key: TYRE_META.mode, value: "code" }],
				},
			]),
		);
		executeAuthenticatedGraphQL.mockResolvedValue(updated);
		await expect(addVariantToCart({ ...input, tyre: { mode: "code" } })).resolves.toEqual({
			status: "added",
		});
		expect(executeAuthenticatedGraphQL.mock.calls[0][0]).toBe(CheckoutLinesUpdateDocument);
	});

	it("is a separate line from a size of the same code", async () => {
		findOrCreate.mockResolvedValue(ready([sizeLine("line-a", 1, "145/70 R12")]));
		await expect(addVariantToCart({ ...input, tyre: { mode: "code" } })).resolves.toEqual({
			status: "added",
		});
		expect(executeAuthenticatedGraphQL.mock.calls[0][0]).toBe(CheckoutAddSizedLineDocument);
	});
});

describe("every other product is added exactly as before", () => {
	it("uses the plain mutation with the same variables, whatever tyre fields a form carried", async () => {
		executePublicGraphQL.mockResolvedValue(purchasable("A7604"));
		await expect(addVariantToCart({ ...input, quantity: 2, tyre: size("205/55 R16") })).resolves.toEqual({
			status: "added",
		});
		const [document, options] = executeAuthenticatedGraphQL.mock.calls[0];
		expect(document).toBe(CheckoutAddLineDocument);
		expect(options.variables).toEqual({ id: CHECKOUT_ID, productVariantId: VARIANT, quantity: 2 });
		expect(String(CheckoutAddLineDocument)).not.toContain("forceNewLine");
	});

	it("treats a variant with no readable code as an ordinary product", async () => {
		executePublicGraphQL.mockResolvedValue(purchasable(undefined));
		await expect(addVariantToCart(input)).resolves.toEqual({ status: "added" });
		expect(executeAuthenticatedGraphQL.mock.calls[0][0]).toBe(CheckoutAddLineDocument);
	});

	it("does not mistake a code the list does not hold, or one that only resembles it", async () => {
		for (const name of ["N16061X", "n16061", "constructor", "Black"]) {
			executeAuthenticatedGraphQL.mockClear();
			executePublicGraphQL.mockResolvedValue(purchasable(name));
			await expect(addVariantToCart(input), name).resolves.toEqual({ status: "added" });
			expect(executeAuthenticatedGraphQL.mock.calls[0][0], name).toBe(CheckoutAddLineDocument);
		}
	});
});

describe("the code is read the way the page reads it", () => {
	it("takes a name with stray whitespace for the code it shows, so it cannot slip past the check", async () => {
		executePublicGraphQL.mockResolvedValue(purchasable(" N16061 "));
		await expect(addVariantToCart(input)).resolves.toMatchObject({ reason: "size-required" });
		nothingSent();
	});
});

describe("an unclear result is settled by reading the line of THAT size", () => {
	const transportFailure = { ok: false as const, error: { type: "network", message: "socket hang up" } };

	it("reports success when the line of that size landed", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(transportFailure);
		lookup.mockResolvedValue({
			status: "found",
			checkout: { id: CHECKOUT_ID, lines: [sizeLine("line-a", 1, "145/70 R12")] },
		});
		await expect(settle(addVariantToCart({ ...input, tyre: size("145/70 R12") }))).resolves.toEqual({
			status: "added",
		});
	});

	it("does NOT take another size's line for the one that was asked about", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(transportFailure);
		lookup.mockResolvedValue({
			status: "found",
			checkout: { id: CHECKOUT_ID, lines: [sizeLine("line-a", 1, SIZE_B)] },
		});
		const result = await settle(addVariantToCart({ ...input, tyre: size("145/70 R12") }));
		expect(result.status).toBe("unconfirmed");
	});

	it("never re-sends the mutation while it reads", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(transportFailure);
		lookup.mockResolvedValue({ status: "found", checkout: { id: CHECKOUT_ID, lines: [] } });
		await settle(addVariantToCart({ ...input, tyre: size("145/70 R12") }));
		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
	});
});
