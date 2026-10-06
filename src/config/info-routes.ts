/** Public URL spellings for the existing informational pages; their internal routes stay stable. */
export type InfoMarket = "sk" | "cz" | "de" | "at" | "pl" | "hu" | "it" | "fr" | "es" | "ro" | "us" | "ca";

export interface InfoRoute {
	readonly internalPath: string;
	readonly paths: Readonly<Record<InfoMarket, string>>;
}

/** Market-relative paths, based on the existing pages' localized headings. */
export const INFO_ROUTES: readonly InfoRoute[] = [
	{
		internalPath: "/cookies",
		paths: {
			sk: "/cookies",
			cz: "/cookies",
			de: "/cookies",
			at: "/cookies",
			pl: "/pliki-cookies",
			hu: "/sutik",
			it: "/cookie",
			fr: "/cookies",
			es: "/cookies",
			ro: "/cookie-uri",
			us: "/cookies",
			ca: "/cookies",
		},
	},
	{
		internalPath: "/doprava-a-platba",
		paths: {
			sk: "/doprava-a-platba",
			cz: "/doprava-a-platba",
			de: "/versand-und-zahlung",
			at: "/versand-und-zahlung",
			pl: "/dostawa-i-platnosci",
			hu: "/szallitas-es-fizetes",
			it: "/spedizione-e-pagamento",
			fr: "/livraison-et-paiement",
			es: "/envios-y-pagos",
			ro: "/livrare-si-plata",
			us: "/shipping-and-payment",
			ca: "/shipping-and-payment",
		},
	},
	{
		internalPath: "/kontakt",
		paths: {
			sk: "/kontakt",
			cz: "/kontakt",
			de: "/kontakt",
			at: "/kontakt",
			pl: "/kontakt",
			hu: "/kapcsolat",
			it: "/contatti",
			fr: "/contact",
			es: "/contacto",
			ro: "/contact",
			us: "/contact",
			ca: "/contact",
		},
	},
	{
		internalPath: "/obchodne-podmienky",
		paths: {
			sk: "/obchodne-podmienky",
			cz: "/obchodni-podminky",
			de: "/agb",
			at: "/agb",
			pl: "/regulamin-sklepu",
			hu: "/altalanos-szerzodesi-feltetelek",
			it: "/condizioni-generali-di-vendita",
			fr: "/conditions-generales-de-vente",
			es: "/condiciones-de-venta",
			ro: "/termeni-si-conditii",
			us: "/terms-and-conditions",
			ca: "/terms-and-conditions",
		},
	},
	{
		internalPath: "/ochrana-osobnych-udajov",
		paths: {
			sk: "/ochrana-osobnych-udajov",
			cz: "/ochrana-osobnich-udaju",
			de: "/datenschutz",
			at: "/datenschutz",
			pl: "/polityka-prywatnosci",
			hu: "/adatkezelesi-tajekoztato",
			it: "/informativa-sulla-privacy",
			fr: "/politique-de-confidentialite",
			es: "/politica-de-privacidad",
			ro: "/politica-de-confidentialitate",
			us: "/privacy-policy",
			ca: "/privacy-policy",
		},
	},
	{
		internalPath: "/odstupenie-od-zmluvy",
		paths: {
			sk: "/odstupenie-od-zmluvy",
			cz: "/odstoupeni-od-smlouvy",
			de: "/widerruf",
			at: "/ruecktritt",
			pl: "/odstapienie-od-umowy",
			hu: "/elallasi-jog",
			it: "/diritto-di-recesso",
			fr: "/droit-de-retractation",
			es: "/derecho-de-desistimiento",
			ro: "/dreptul-de-retragere",
			us: "/cancellations-and-returns",
			ca: "/cancellations-and-returns",
		},
	},
	{
		internalPath: "/odstupenie-od-zmluvy/vzorovy-formular",
		paths: {
			sk: "/odstupenie-od-zmluvy/vzorovy-formular",
			cz: "/odstoupeni-od-smlouvy/vzorovy-formular",
			de: "/widerruf/musterformular",
			at: "/ruecktritt/musterformular",
			pl: "/odstapienie-od-umowy/wzor-formularza",
			hu: "/elallasi-jog/nyilatkozatminta",
			it: "/diritto-di-recesso/modulo",
			fr: "/droit-de-retractation/formulaire",
			es: "/derecho-de-desistimiento/formulario",
			ro: "/dreptul-de-retragere/formular",
			us: "/cancellations-and-returns/form",
			ca: "/cancellations-and-returns/form",
		},
	},
	{
		internalPath: "/reklamacie-a-vratenie",
		paths: {
			sk: "/reklamacie-a-vratenie",
			cz: "/reklamace-a-vraceni",
			de: "/reklamationen-und-ruecksendungen",
			at: "/reklamationen-und-ruecksendungen",
			pl: "/reklamacje-i-zwroty",
			hu: "/reklamacio-es-visszakuldes",
			it: "/reclami-e-resi",
			fr: "/reclamations-et-retours",
			es: "/reclamaciones-y-devoluciones",
			ro: "/reclamatii-si-retururi",
			us: "/returns-and-complaints",
			ca: "/returns-and-complaints",
		},
	},
];

interface InfoRouteMatch {
	readonly internalPath: string;
	readonly publicPath: string;
}

// A leaf lookup: channel resolution and market availability belong to the callers.
const ROUTES_BY_MARKET = new Map<string, Map<string, InfoRouteMatch>>();
for (const route of INFO_ROUTES) {
	for (const market of Object.keys(route.paths) as InfoMarket[]) {
		const paths = ROUTES_BY_MARKET.get(market) ?? new Map<string, InfoRouteMatch>();
		const match = { internalPath: route.internalPath, publicPath: route.paths[market] };
		paths.set(route.internalPath, match);
		paths.set(match.publicPath, match);
		ROUTES_BY_MARKET.set(market, paths);
	}
}

/** Accept only an exact internal path or this market's own public spelling. */
export function infoRouteFor(market: string, pathname: string): InfoRouteMatch | null {
	return ROUTES_BY_MARKET.get(market)?.get(pathname) ?? null;
}

function mapInfoPath(market: string, path: string, target: keyof InfoRouteMatch): string {
	const tailAt = path.search(/[?#]/);
	const pathname = tailAt === -1 ? path : path.slice(0, tailAt);
	const tail = tailAt === -1 ? "" : path.slice(tailAt);
	// Next transport suffixes and a trailing slash decorate an exact page, never a subtree.
	const parts = pathname.match(/^(.*?)(\/(?:_segments|segments)\/.+\.segment\.rsc|\.rsc|\.json)?(\/?)$/);
	if (!parts) return path;
	const [, pagePath, transport = "", trailingSlash = ""] = parts;
	const route = infoRouteFor(market, pagePath);
	return route ? `${route[target]}${transport}${trailingSlash}${tail}` : path;
}

/** Localize a market-relative page path, preserving its transport suffix, query and fragment. */
export function localizeInfoPath(market: string, path: string): string {
	return mapInfoPath(market, path, "publicPath");
}

/** Resolve a public path to its existing internal route with the same suffix, query and fragment. */
export function internalizeInfoPath(market: string, path: string): string {
	return mapInfoPath(market, path, "internalPath");
}
