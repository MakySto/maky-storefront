/**
 * The Saleor host a fitment dataset must name as its own instance.
 *
 * A dataset generated against a different instance is rejected, not merged: its product and variant ids
 * would silently point at other products. Shared by the HTTP provider and the release loader so that both
 * apply the same rule to the same environment variable.
 */
export function expectedSaleorInstance(): string | undefined {
	const url = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!url) return undefined;
	try {
		return new URL(url).host;
	} catch {
		return undefined;
	}
}
