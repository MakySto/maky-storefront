/**
 * The order number as a customer sees it.
 *
 * Saleor's `order.number` is a bare integer string — `"23"`. Every customer-facing
 * surface in this storefront prefixes it: the account order list, the order detail
 * heading, and the withdrawal form's order picker all render `ORD-23`. Nobody is ever
 * shown the bare number.
 *
 * That made a quiet defect possible, and it is why this function exists rather than a
 * fourth inline template. The withdrawal form displayed `ORD-23` while the server action
 * overwrote the submitted value with Saleor's raw `order.number`, so the stored notice,
 * the receipt and both confirmation e-mails said:
 *
 *     Identifikácia zmluvy (číslo objednávky): 23
 *
 * — an identifier the customer had never seen anywhere, on the one document the whole
 * feature exists to produce. It is the machine's name for the order, not the contract's.
 *
 * Payload does not care either way: it does not match orders against Saleor, and the
 * machine-readable handle travels separately as `saleorOrderId`. So the human field
 * should carry the human string.
 *
 * The account order list and the order detail page still build the same string inline.
 * Left alone deliberately — they are live pages outside this change, and the value is
 * identical. If a fourth surface appears, it should call this.
 */
export function formatOrderNumber(saleorOrderNumber: string): string {
	return `ORD-${saleorOrderNumber}`;
}
