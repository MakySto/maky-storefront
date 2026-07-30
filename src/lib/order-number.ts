/**
 * The order number as a customer sees it.
 *
 * Saleor's `order.number` is a bare integer string — `"23"`. `ORD-` is the ACCOUNT-AREA
 * convention: the order list, the order detail heading and the withdrawal form's order
 * picker all render `ORD-23`. It is not universal, and an earlier version of this comment
 * wrongly said it was — the transactional order-confirmation e-mail ("Prijali sme
 * objednávku č. 23") and the checkout confirmation screen both show the bare number, and
 * the withdrawal form's own guest hint points customers at that e-mail.
 *
 * The defect this exists to prevent is narrower than "the customer never saw it", and
 * real regardless: inside the account flow the customer picks an order labelled `ORD-23`
 * and the server action overwrote their submission with the raw number, so the stored
 * notice, the receipt and both confirmation e-mails said:
 *
 *     Identifikácia zmluvy (číslo objednávky): 23
 *
 * — not the label they had just clicked, on the one document the whole feature exists to
 * produce. A guest who types what the e-mail showed them stores the bare number, and that
 * is fine: it is their identification of the contract. The account path should likewise
 * store what IT showed them.
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
