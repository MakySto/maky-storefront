/**
 * Channel mapping: friendly URL prefix -> Saleor channel slug + metadata.
 * This is the single source of truth for market routing.
 */
type ChannelConfig = {
	saleorSlug: string;
	currency: string;
	locale: string;
	country: string;
};

export const CHANNEL_MAP: Record<string, ChannelConfig> = {
	sk: { saleorSlug: "sk-eur", currency: "EUR", locale: "sk-SK", country: "SK" },
	cz: { saleorSlug: "cz-czk", currency: "CZK", locale: "cs-CZ", country: "CZ" },
	de: { saleorSlug: "de-eur", currency: "EUR", locale: "de-DE", country: "DE" },
	at: { saleorSlug: "at-eur", currency: "EUR", locale: "de-AT", country: "AT" },
	pl: { saleorSlug: "pl-pln", currency: "PLN", locale: "pl-PL", country: "PL" },
	hu: { saleorSlug: "hu-huf", currency: "HUF", locale: "hu-HU", country: "HU" },
	it: { saleorSlug: "it-eur", currency: "EUR", locale: "it-IT", country: "IT" },
	fr: { saleorSlug: "fr-eur", currency: "EUR", locale: "fr-FR", country: "FR" },
	es: { saleorSlug: "es-eur", currency: "EUR", locale: "es-ES", country: "ES" },
	ro: { saleorSlug: "ro-ron", currency: "RON", locale: "ro-RO", country: "RO" },
	us: { saleorSlug: "us-usd", currency: "USD", locale: "en-US", country: "US" },
	ca: { saleorSlug: "ca-cad", currency: "CAD", locale: "en-CA", country: "CA" },
};

export const FRIENDLY_SLUGS = new Set(Object.keys(CHANNEL_MAP));

export const SALEOR_SLUGS = new Set(Object.values(CHANNEL_MAP).map((c) => c.saleorSlug));

export const REVERSE_MAP: Record<string, string> = Object.fromEntries(
	Object.entries(CHANNEL_MAP).map(([friendly, config]) => [config.saleorSlug, friendly]),
);

export const COUNTRY_TO_MARKET: Record<string, string> = {
	SK: "sk",
	CZ: "cz",
	DE: "de",
	AT: "at",
	PL: "pl",
	HU: "hu",
	IT: "it",
	FR: "fr",
	ES: "es",
	RO: "ro",
	US: "us",
	CA: "ca",
};

export const DEFAULT_MARKET = "sk";
export const COOKIE_NAME = "maky-market";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Public, market-localised root segments.
 *
 * The App Router directory remains `cart`, because that is the internal route
 * shared by every Saleor channel. The proxy maps these customer-facing words
 * back to it. Keeping the table beside CHANNEL_MAP makes URL generation and
 * request routing use the same source of truth.
 */
export const CART_SEGMENT_BY_MARKET: Readonly<Record<string, string>> = {
	sk: "kosik",
	cz: "kosik",
	de: "warenkorb",
	at: "warenkorb",
	pl: "koszyk",
	hu: "kosar",
	it: "carrello",
	fr: "panier",
	es: "carrito",
	ro: "cos",
	us: "cart",
	ca: "cart",
};

/** The canonical public cart segment for a friendly market or Saleor channel. */
export function cartSegment(channelOrMarket: string): string {
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return CART_SEGMENT_BY_MARKET[market] || "cart";
}

/**
 * Localise a canonical internal storefront path for one market.
 *
 * Query strings and hashes are deliberately preserved. Only complete root
 * segments are replaced, so a product slug such as `/cart-box` is untouched.
 */
export function localizeMarketPath(channelOrMarket: string, path: string): string {
	if (!path) return "";
	const replacement = cartSegment(channelOrMarket);
	return path.replace(/^\/cart(?=$|[/?#]|\.(?:rsc|json)(?:$|[/?#]))/, `/${replacement}`);
}

/**
 * Convert Saleor channel slug to friendly market URL path.
 * marketHref("sk-eur", "/products") → "/sk/products"
 * marketHref("sk-eur") → "/sk"
 */
export function marketHref(channel: string, path: string = ""): string {
	const friendly = REVERSE_MAP[channel] || channel;
	const normalizedPath = path ? (path.startsWith("/") ? path : "/" + path) : "";
	return `/${friendly}${localizeMarketPath(friendly, normalizedPath)}`;
}
