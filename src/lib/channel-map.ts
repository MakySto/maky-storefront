import { requestKeyed } from "./request-keyed";

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

export const CHANNEL_MAP: Record<string, ChannelConfig> = requestKeyed({
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
});

export const FRIENDLY_SLUGS = new Set(Object.keys(CHANNEL_MAP));

export const SALEOR_SLUGS = new Set(Object.values(CHANNEL_MAP).map((c) => c.saleorSlug));

export const REVERSE_MAP: Record<string, string> = requestKeyed(
	Object.fromEntries(Object.entries(CHANNEL_MAP).map(([friendly, config]) => [config.saleorSlug, friendly])),
);

export const COUNTRY_TO_MARKET: Record<string, string> = requestKeyed({
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
});

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
export const CART_SEGMENT_BY_MARKET: Readonly<Record<string, string>> = requestKeyed({
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
});

/** The canonical public cart segment for a friendly market or Saleor channel. */
export function cartSegment(channelOrMarket: string): string {
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return CART_SEGMENT_BY_MARKET[market] || "cart";
}

/**
 * The market's own word for every route whose directory name is not a word of that market.
 *
 * The App Router directories are Slovak (`kontakt`, `doprava-a-platba`, `znacky`, `oblubene`) because
 * Slovakia was the first market, and until 2026-11-27 the eleven other markets showed those words in
 * the address: `/de/doprava-a-platba`, `/us/obchodne-podmienky`, `/at/oblubene`, next to categories and
 * products that had been in the market's language for months (audit of the live store, S5; owner:
 * "jednoznačne opraviť"). The directories stay where they are. This table is the one place that says
 * what a market calls each of them, and both directions read it: `localizeMarketPath` for every link,
 * canonical, hreflang entry and sitemap line, the proxy for the request (the market's word is served,
 * the Slovak one is redirected to it).
 *
 * Keyed by the directory name. A market that is not listed for a route keeps the directory name
 * (Slovakia everywhere; `kontakt` in Czech, German and Polish, where it is the same word).
 *
 * What a word may be: lower-case ASCII, hyphens, the wording of that market's own page title or footer
 * link, and never a word that is a route directory, a category root of that market or another route's
 * word in the same market. `channel-map.routes.test.ts` holds all of that, and `live-categories`
 * refuses a Saleor category whose slug is one of them.
 *
 * NOT here, on purpose: `konfigurator` and `garage` (the same word in most of these languages, and the
 * vehicle selector compares the address with them), `account`, `login`, `signup`, `orders`, `search`
 * (English in every market, Slovakia included) and the two CMS pages, which only Slovakia has.
 */
export const ROUTE_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = requestKeyed({
	cart: CART_SEGMENT_BY_MARKET,
	kontakt: requestKeyed({
		hu: "kapcsolat",
		it: "contatti",
		fr: "contact",
		es: "contacto",
		ro: "contact",
		us: "contact",
		ca: "contact",
	}),
	"doprava-a-platba": requestKeyed({
		de: "versand-und-zahlung",
		at: "versand-und-zahlung",
		pl: "dostawa-i-platnosci",
		hu: "szallitas-es-fizetes",
		it: "spedizione-e-pagamento",
		fr: "livraison-et-paiement",
		es: "envios-y-pagos",
		ro: "livrare-si-plata",
		us: "shipping-and-payment",
		ca: "shipping-and-payment",
	}),
	"reklamacie-a-vratenie": requestKeyed({
		cz: "reklamace-a-vraceni",
		de: "reklamation-und-ruecksendung",
		at: "reklamation-und-ruecksendung",
		pl: "reklamacje-i-zwroty",
		hu: "reklamacio-es-visszakuldes",
		it: "resi-e-reclami",
		fr: "retours-et-reclamations",
		es: "devoluciones-y-reclamaciones",
		ro: "retururi-si-reclamatii",
		us: "returns",
		ca: "returns",
	}),
	"odstupenie-od-zmluvy": requestKeyed({
		cz: "odstoupeni-od-smlouvy",
		de: "widerrufsrecht",
		at: "ruecktrittsrecht",
		pl: "odstapienie-od-umowy",
		hu: "elallasi-jog",
		it: "diritto-di-recesso",
		fr: "droit-de-retractation",
		es: "derecho-de-desistimiento",
		ro: "dreptul-de-retragere",
		us: "withdrawal",
		ca: "withdrawal",
	}),
	"obchodne-podmienky": requestKeyed({
		cz: "obchodni-podminky",
		de: "agb",
		at: "agb",
		pl: "regulamin",
		hu: "aszf",
		it: "condizioni-di-vendita",
		fr: "conditions-generales-de-vente",
		es: "condiciones-de-venta",
		ro: "termeni-si-conditii",
		us: "terms-of-sale",
		ca: "terms-of-sale",
	}),
	"ochrana-osobnych-udajov": requestKeyed({
		cz: "ochrana-osobnich-udaju",
		de: "datenschutz",
		at: "datenschutz",
		pl: "polityka-prywatnosci",
		hu: "adatvedelem",
		it: "privacy",
		fr: "politique-de-confidentialite",
		es: "politica-de-privacidad",
		ro: "politica-de-confidentialitate",
		us: "privacy-policy",
		ca: "privacy-policy",
	}),
	znacky: requestKeyed({
		de: "marken",
		at: "marken",
		pl: "marki",
		hu: "markak",
		it: "marchi",
		fr: "marques",
		es: "marcas",
		ro: "marci",
		us: "brands",
		ca: "brands",
	}),
	oblubene: requestKeyed({
		cz: "oblibene",
		de: "wunschliste",
		at: "wunschliste",
		pl: "ulubione",
		hu: "kedvencek",
		it: "preferiti",
		fr: "favoris",
		es: "favoritos",
		ro: "favorite",
		us: "wishlist",
		ca: "wishlist",
	}),
});

/**
 * The same for a page one level below a route: `<route directory>/<page directory>` to the market's
 * word for the PAGE. Today that is the model withdrawal form, the only static page that is not a
 * route of its own.
 */
export const ROUTE_CHILD_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = requestKeyed({
	"odstupenie-od-zmluvy/vzorovy-formular": requestKeyed({
		de: "musterformular",
		at: "musterformular",
		pl: "wzor-formularza",
		hu: "nyilatkozatminta",
		it: "modulo",
		fr: "formulaire",
		es: "modelo-de-formulario",
		ro: "formular-tip",
		us: "form",
		ca: "form",
	}),
});

/** Public word to directory name, per market, for the two tables above. Built once. */
function reversed(
	table: Readonly<Record<string, Readonly<Record<string, string>>>>,
	keyOf: (internal: string) => { scope: string; name: string },
): Record<string, Record<string, string>> {
	const byMarket: Record<string, Record<string, string>> = requestKeyed({});
	for (const internal of Object.keys(table)) {
		const { scope, name } = keyOf(internal);
		for (const [market, word] of Object.entries(table[internal]!)) {
			if (word === name) continue;
			const key = `${market}\u0000${scope}`;
			(byMarket[key] ??= requestKeyed({}))[word] = name;
		}
	}
	return byMarket;
}

const ROUTE_BY_WORD = reversed(ROUTE_WORDS, (internal) => ({ scope: "", name: internal }));
const CHILD_BY_WORD = reversed(ROUTE_CHILD_WORDS, (internal) => {
	const [route, page] = internal.split("/") as [string, string];
	return { scope: route, name: page };
});

/** The market's public word for a route directory; the directory name where the market has no other. */
export function routeWord(channelOrMarket: string, internal: string): string {
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return ROUTE_WORDS[internal]?.[market] ?? internal;
}

/** The route directory a market's public word stands for, or `undefined` when it is not one of its words. */
export function routeForWord(channelOrMarket: string, word: string): string | undefined {
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return ROUTE_BY_WORD[`${market}\u0000`]?.[word];
}

/** Every public word a market has for a route that is not the directory name. For the guards on category slugs. */
export function routeWordsOf(channelOrMarket: string): readonly string[] {
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return Object.keys(ROUTE_BY_WORD[`${market}\u0000`] ?? {});
}

/**
 * One path segment from the start of `path`, without Next's `.rsc` / `.json` suffix: `/cart.rsc?x` is
 * `cart` followed by `.rsc?x`. Only a COMPLETE segment, so a product slug such as `/cart-box` is one
 * segment of its own and is never taken for the cart.
 */
const LEADING_SEGMENT = /^\/([^/?#]+?)(?=$|[/?#]|\.(?:rsc|json)(?:$|[/?#]))/;

/** `path` with its first segment, and the page below it when the tables name one, passed through `word`. */
function translatePath(
	path: string,
	rootWord: (segment: string) => { internal: string; shown: string } | undefined,
	childWord: (internalRoot: string, segment: string) => string | undefined,
): string {
	const root = LEADING_SEGMENT.exec(path);
	if (!root) return path;
	const translated = rootWord(root[1]!);
	if (!translated) return path;
	let rest = path.slice(root[0].length);
	const child = LEADING_SEGMENT.exec(rest);
	if (child) {
		const shown = childWord(translated.internal, child[1]!);
		if (shown) rest = `/${shown}${rest.slice(child[0].length)}`;
	}
	return `/${translated.shown}${rest}`;
}

/**
 * Localise a canonical internal storefront path for one market.
 *
 * Query strings and hashes are deliberately preserved. Only complete root
 * segments are replaced, so a product slug such as `/cart-box` is untouched.
 */
export function localizeMarketPath(channelOrMarket: string, path: string): string {
	if (!path) return "";
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return translatePath(
		path,
		(segment) => {
			const word = ROUTE_WORDS[segment]?.[market];
			// A route with no word of its own here still has to be recognised, for the page below it.
			return ROUTE_WORDS[segment] ? { internal: segment, shown: word ?? segment } : undefined;
		},
		(route, segment) => ROUTE_CHILD_WORDS[`${route}/${segment}`]?.[market],
	);
}

/**
 * The other direction: a path as one market shows it, back to the route directories. A path that
 * carries none of this market's words comes back unchanged, so it is safe to ask about any address.
 */
export function internalMarketPath(channelOrMarket: string, path: string): string {
	if (!path) return "";
	const market = REVERSE_MAP[channelOrMarket] || channelOrMarket;
	return translatePath(
		path,
		(segment) => {
			const internal = ROUTE_BY_WORD[`${market}\u0000`]?.[segment];
			if (internal) return { internal, shown: internal };
			// The directory name itself is this market's word where the table gives it no other.
			return ROUTE_WORDS[segment] && !ROUTE_WORDS[segment]![market]
				? { internal: segment, shown: segment }
				: undefined;
		},
		(route, segment) => CHILD_BY_WORD[`${market}\u0000${route}`]?.[segment],
	);
}

/**
 * The same NON-entity page in another market — the market switcher's fallback when the page
 * registered no counterparts (cart, search, account, legal, brands).
 *
 * Only the market-localised words move: each market's proxy accepts its own words and no other, so
 * `/de/warenkorb` switched to Czechia must become `/cz/kosik`, not `/cz/warenkorb` — which the Czech
 * proxy reads as a product slug — and `/de/versand-und-zahlung` must become `/fr/livraison-et-paiement`.
 * Query and hash are kept.
 *
 * `fromMarket` is the market the path was read in. Without it the word is looked up in every market's
 * words, which is what the cart did before there were other routes; a word means one route wherever
 * it appears (`channel-map.routes.test.ts`), so the two agree.
 */
export function marketSwitchHref(targetMarket: string, pathAfterMarket: string, fromMarket?: string): string {
	if (fromMarket) return marketHref(targetMarket, internalMarketPath(fromMarket, pathAfterMarket));
	let internal = pathAfterMarket;
	for (const market of FRIENDLY_SLUGS) {
		internal = internalMarketPath(market, pathAfterMarket);
		if (internal !== pathAfterMarket) break;
	}
	return marketHref(targetMarket, internal);
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
