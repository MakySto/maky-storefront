import "server-only";

import { type FitmentDataset } from "@/lib/fitment/contract";

/**
 * Which products the compatibility programme covered in the last dataset this process loaded.
 *
 * For the moment the data does NOT come — past the deadline of `withinDeadline`, or with the
 * provider down: the product page and the cart must then still tell a vehicle-specific product
 * from a fridge, to say "Kompatibilitu teraz nevieme overiť" on the first and nothing on the
 * second (owner, 2026-09-25: a failure must not read as "nothing to say"). Nothing here ever
 * answers WHETHER a product fits — only whether the programme speaks about it at all.
 *
 * Per process and in memory: empty after a restart until the first successful load, and then
 * the answer is "unknown" (`null`), which callers treat as silence, as before.
 */
let known: { readonly hash: string; readonly ids: ReadonlySet<string> } | null = null;

export function rememberProgramme(dataset: FitmentDataset): void {
	if (known?.hash === dataset.datasetHash) return;
	const ids = new Set<string>();
	for (const application of dataset.applications) {
		for (const product of application.products) ids.add(product.saleorProductId);
	}
	known = { hash: dataset.datasetHash, ids };
}

/** `true`/`false` from the last dataset this process loaded; `null` when it has loaded none. */
export function programmeCovered(saleorProductId: string): boolean | null {
	return known ? known.ids.has(saleorProductId) : null;
}

/** Tests only. */
export function __forgetProgramme(): void {
	known = null;
}
