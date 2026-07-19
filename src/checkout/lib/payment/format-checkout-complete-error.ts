/**
 * Maps Saleor checkoutComplete errors to shopper-friendly copy.
 *
 * Saleor completes checkout when authorizeStatus is FULL (authorized + charged
 * amounts cover the total). Capture at fulfillment is separate.
 */
export function formatCheckoutCompleteError(error: string): string {
	if (error.includes("CHECKOUT_NOT_FULLY_PAID")) {
		return "Platba zatiaľ nepokrýva celú sumu objednávky. Obnovte stránku — ak boli prostriedky autorizované, použite tlačidlo „Objednať s povinnosťou platby“. Neplaťte znova, kým sa stav nepotvrdí.";
	}

	if (error.includes("CHECKOUT_ALREADY_COMPLETED")) {
		return "Táto objednávka už bola odoslaná. Potvrdenie nájdete vo svojom e-maile.";
	}

	return error;
}
