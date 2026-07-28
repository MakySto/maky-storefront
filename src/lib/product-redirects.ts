/**
 * Old `/products/<slug>` → new root-level slug, for products whose Saleor slug
 * changed when PUBLIC_PRODUCT_URL_V1 moved the SKU from the front to the back.
 *
 * This map is deliberately static. Resolving the old URL by querying Saleor is
 * impossible after the fact: once `Product.slug` has been updated, the old slug
 * matches nothing and the lookup would return null on exactly the requests that
 * need the redirect most.
 *
 * A slug that is not in the map redirects to itself at the root
 * (`/sk/products/foo` → `/sk/foo`), which is correct for every product whose
 * slug never changed and costs no lookup either.
 */
export const LEGACY_PRODUCT_SLUG_REDIRECTS: Readonly<Record<string, string>> = {
	// TAZAR pilot 10, migrated 2026-07-28.
	"598b-nosic-bicykla-na-stresny-nosic-thule-proride-598-black":
		"nosic-bicykla-na-stresny-nosic-thule-proride-598-black-598b",
	"pz-342-peruzzo-nastenny-drziak-bicykla-roda": "peruzzo-nastenny-drziak-bicykla-roda-pz-342",
	"npb2115ccr-stresny-box-northline-tirol-black-on-black-tef-1":
		"stresny-box-northline-tirol-black-on-black-tef-npb2115ccr",
	"639901-stresny-box-thule-motion-3-xxl-titan-glossy": "stresny-box-thule-motion-3-xxl-titan-glossy-639901",
	"60502-hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-2":
		"hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-2-60502",
	"60505-hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-5":
		"hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-5-60505",
	"60509-hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-9":
		"hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-9-60509",
	"pz-693gn-peruzzo-3d-upinacie-rameno-40cm-pre-parmasiena":
		"peruzzo-3d-upinacie-rameno-40cm-pre-parma-siena-pz-693-gn",
	"645300-stresny-box-thule-force-3-xxl-sport": "stresny-box-thule-force-3-xxl-sport-645300",
	"m0001693-stresny-box-menabo-satellite-550-black-duo-crab":
		"stresny-box-menabo-satellite-550-black-duo-crab-m0001693",
};

/** New root-level slug for a retired `/products/` slug. Identity when unmapped. */
export function resolveLegacyProductSlug(slug: string): string {
	return LEGACY_PRODUCT_SLUG_REDIRECTS[slug] ?? slug;
}

const NEW_TO_LEGACY: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(LEGACY_PRODUCT_SLUG_REDIRECTS).map(([from, to]) => [to, from]),
);

/**
 * The pre-migration Saleor slug for a new root-level slug, if there is one.
 *
 * Transitional shim, and deliberately narrow. The storefront deploy and the
 * Saleor slug update are two separate operations on two separate systems, so
 * one of them lands first whichever order they are run in. Without this, the
 * window between them serves a 404 on ten live public products: the redirect
 * sends `/sk/products/<old>` to `/sk/<new>`, and `product(slug: <new>)` does
 * not resolve until the Saleor update has run.
 *
 * Used ONLY as a fallback after the new slug misses, so it costs nothing once
 * both sides have converged — and it is never consulted by the redirect itself,
 * which stays a static map precisely because looking the old slug up in Saleor
 * stops working the moment the slug changes.
 */
export function previousProductSlug(slug: string): string | undefined {
	return NEW_TO_LEGACY[slug];
}
