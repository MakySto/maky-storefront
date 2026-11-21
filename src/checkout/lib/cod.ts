/**
 * Cash on delivery (dobierka): the customer pays the courier when the parcel arrives.
 *
 * Saleor has no fee for a way of paying, so cash on delivery is carried by the delivery: beside a delivery
 * method stands a second one that costs the fee more and says, in its public metadata, which method it is the
 * cash-on-delivery version of. Everything the storefront knows about cash on delivery it reads from there:
 *
 *   maky_cod_for   the id of the delivery method this one is the cash-on-delivery version of
 *   maky_cod_max   the highest order total it may be used for, in the channel's currency (optional)
 *
 * The fee is the difference of the two prices. Where no such method is offered there is no cash on delivery:
 * the shop owner switches it on, off, or changes the fee and the limit in Saleor, without a deploy.
 *
 * The customer never picks the second method as a delivery: it is left out of the delivery step, and choosing
 * "cash on delivery" in the payment step moves the checkout onto it. An order whose delivery method carries
 * `maky_cod_for` is a cash-on-delivery order; nothing else is written anywhere to say so.
 */

export const COD_FOR_KEY = "maky_cod_for";
export const COD_MAX_KEY = "maky_cod_max";

type MetadataItem = { key: string; value: string };

export type CodMethodLike = {
	id: string;
	price?: { amount: number; currency?: string | null } | null;
	metadata?: ReadonlyArray<MetadataItem> | null;
};

function metadataValue(method: Pick<CodMethodLike, "metadata"> | null | undefined, key: string) {
	const value = method?.metadata?.find((item) => item.key === key)?.value?.trim();
	return value ? value : null;
}

/** The id of the delivery method this one is the cash-on-delivery version of, or null for an ordinary method. */
export function codBaseId(method: Pick<CodMethodLike, "metadata"> | null | undefined): string | null {
	return metadataValue(method, COD_FOR_KEY);
}

export function isCodMethod(method: Pick<CodMethodLike, "metadata"> | null | undefined): boolean {
	return codBaseId(method) !== null;
}

/**
 * Whether an order is paid on delivery, told from the delivery method the order query returns. That query does
 * not select `__typename` on `deliveryMethod`, so the name of the type is absent at runtime and must not be
 * asked for: the metadata says it, and a pickup point carries none.
 */
export function isCodDelivery(deliveryMethod: object | null | undefined): boolean {
	if (!deliveryMethod || !("metadata" in deliveryMethod)) return false;
	return isCodMethod(deliveryMethod as Pick<CodMethodLike, "metadata">);
}

/** The methods a customer chooses a delivery from: the cash-on-delivery versions are not deliveries of their own. */
export function customerDeliveryMethods<M extends CodMethodLike>(methods: ReadonlyArray<M>): M[] {
	return methods.filter((method) => !isCodMethod(method));
}

/**
 * The delivery the customer chose, as the delivery step shows it: with cash on delivery chosen that is the method
 * it belongs to, so going back to the delivery step neither loses the choice nor shows a method that is not listed.
 */
export function customerDeliveryMethodId(
	deliveryMethodId: string | null | undefined,
	methods: ReadonlyArray<CodMethodLike>,
): string | undefined {
	if (!deliveryMethodId) return undefined;
	const chosen = methods.find((method) => method.id === deliveryMethodId);
	if (!chosen) return undefined;
	const baseId = codBaseId(chosen);
	if (!baseId) return chosen.id;
	return methods.some((method) => method.id === baseId && !isCodMethod(method)) ? baseId : undefined;
}

export type CodOffer<M extends CodMethodLike = CodMethodLike> = {
	/** The delivery the customer chose. */
	base: M;
	/** Its cash-on-delivery version. */
	cod: M;
	/** What cash on delivery costs on top of the delivery. */
	fee: number;
	/** The highest order total cash on delivery may be used for; null when Saleor names none. */
	max: number | null;
	/** Whether the checkout is on the cash-on-delivery version now. */
	selected: boolean;
};

function parseMax(method: CodMethodLike): number | null {
	const raw = metadataValue(method, COD_MAX_KEY);
	if (raw === null) return null;
	const value = Number(raw.replace(",", "."));
	return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Cash on delivery for this checkout, or null when it is not on offer: no delivery chosen yet, no
 * cash-on-delivery version of the chosen delivery, or prices that do not make sense as a fee.
 */
export function codOffer<M extends CodMethodLike>(checkout: {
	deliveryMethod?: { id?: string | null } | null;
	shippingMethods?: ReadonlyArray<M> | null;
}): CodOffer<M> | null {
	const methods = checkout.shippingMethods ?? [];
	const chosen = methods.find((method) => method.id === checkout.deliveryMethod?.id);
	if (!chosen) return null;

	const chosenBaseId = codBaseId(chosen);
	const base = chosenBaseId
		? methods.find((method) => method.id === chosenBaseId && !isCodMethod(method))
		: chosen;
	const cod = chosenBaseId ? chosen : methods.find((method) => codBaseId(method) === chosen.id);
	if (!base || !cod) return null;

	const basePrice = base.price?.amount;
	const codPrice = cod.price?.amount;
	if (typeof basePrice !== "number" || typeof codPrice !== "number") return null;
	const fee = Math.round((codPrice - basePrice) * 100) / 100;
	if (!Number.isFinite(fee) || fee < 0) return null;

	return { base, cod, fee, max: parseMax(cod), selected: Boolean(chosenBaseId) };
}

/**
 * Whether an order of this total may be paid on delivery. `total` is the total the customer would pay: with cash
 * on delivery already chosen the checkout's own total, otherwise that total plus the fee (`codTotal`).
 */
export function isWithinCodMax(offer: Pick<CodOffer, "max">, total: number | null | undefined): boolean {
	if (typeof total !== "number" || !Number.isFinite(total)) return false;
	return offer.max === null || total <= offer.max + 0.005;
}

/** The order total with cash on delivery, whichever of the two methods the checkout is on now. */
export function codTotal(
	offer: Pick<CodOffer, "fee" | "selected">,
	checkoutTotal: number | null | undefined,
): number | null {
	if (typeof checkoutTotal !== "number" || !Number.isFinite(checkoutTotal)) return null;
	return offer.selected ? checkoutTotal : Math.round((checkoutTotal + offer.fee) * 100) / 100;
}

/** The fee inside the delivery price of a checkout that is on cash on delivery; 0 otherwise. */
export function codFeeInDelivery(checkout: Parameters<typeof codOffer>[0]): number {
	const offer = codOffer(checkout);
	return offer?.selected ? offer.fee : 0;
}
