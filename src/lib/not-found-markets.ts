/**
 * What the static 404 page says in each market.
 *
 * The proxy answers a missing product, category or page with a rewrite to `/_not-found`, because
 * that is the only fully static route and so the only one that keeps the rewrite's `status: 404`
 * (a market-aware target under `[channel]` is partially prerendered and answered 200; measured,
 * see `src/proxy.ts`). The price was the body: `/de/gibt-es-nicht` and `/sk/neexistuje` both showed
 * an English "Page Not Found" with no logo and a "Go Home" link to `/`, in all twelve markets
 * (audit of the live store, 2026-11-27).
 *
 * A static page cannot read the request, so it cannot know the market while it renders. It can
 * carry all twelve answers, though, and let the address decide which one is shown: the page
 * renders one block per market plus the English one for an address with no market in it, all
 * hidden but the last, and `NOT_FOUND_MARKET_SCRIPT` (inline, before the first paint) reads the
 * first path segment and marks `<html>` with the market. The stylesheet does the rest. Without
 * JavaScript the English block stays, which is what the page was before.
 *
 * The copy is the copy the in-app 404 already uses (`MarketNotFound`), read from the same message
 * files, so the two pages cannot drift apart. Links stay inside the market: its home page, its
 * product listing and its search. No category links, on purpose: which categories a market stocks
 * is read from Saleor at request time (`lib/market-assortment.ts`) and a static page that guessed
 * would link a market to a shelf it does not have.
 */
import csCZ from "@/i18n/messages/cs-CZ.json";
import deAT from "@/i18n/messages/de-AT.json";
import deDE from "@/i18n/messages/de-DE.json";
import enCA from "@/i18n/messages/en-CA.json";
import enUS from "@/i18n/messages/en-US.json";
import esES from "@/i18n/messages/es-ES.json";
import frFR from "@/i18n/messages/fr-FR.json";
import huHU from "@/i18n/messages/hu-HU.json";
import itIT from "@/i18n/messages/it-IT.json";
import plPL from "@/i18n/messages/pl-PL.json";
import roRO from "@/i18n/messages/ro-RO.json";
import skSK from "@/i18n/messages/sk-SK.json";
import { CHANNEL_MAP, marketHref } from "@/lib/channel-map";

interface NotFoundMessages {
	readonly pages: {
		readonly notFound: string;
		readonly notFoundDescription: string;
		readonly backToHome: string;
	};
	readonly product: { readonly browseProducts: string };
	readonly common: { readonly search: string; readonly searchPlaceholder: string };
	readonly nav: { readonly searchAriaLabel: string };
}

const MESSAGES_BY_LOCALE: Readonly<Record<string, NotFoundMessages>> = {
	"cs-CZ": csCZ,
	"de-AT": deAT,
	"de-DE": deDE,
	"en-CA": enCA,
	"en-US": enUS,
	"es-ES": esES,
	"fr-FR": frFR,
	"hu-HU": huHU,
	"it-IT": itIT,
	"pl-PL": plPL,
	"ro-RO": roRO,
	"sk-SK": skSK,
};

export interface NotFoundMarket {
	/** The first path segment: `sk`, `de`, `at`. */
	readonly market: string;
	/** BCP 47 tag of the market's language, for `lang`. */
	readonly locale: string;
	readonly title: string;
	readonly description: string;
	readonly homeLabel: string;
	readonly homeHref: string;
	readonly productsLabel: string;
	readonly productsHref: string;
	readonly searchLabel: string;
	readonly searchPlaceholder: string;
	readonly searchAriaLabel: string;
	/** Where the search form sends its `query`. */
	readonly searchAction: string;
}

/** One row per market, in `CHANNEL_MAP` order. */
export const NOT_FOUND_MARKETS: readonly NotFoundMarket[] = Object.entries(CHANNEL_MAP).map(
	([market, { locale }]) => {
		const messages = MESSAGES_BY_LOCALE[locale];
		if (!messages) throw new Error(`not-found: no message file for ${market} (${locale})`);
		return {
			market,
			locale,
			title: messages.pages.notFound,
			description: messages.pages.notFoundDescription,
			homeLabel: messages.pages.backToHome,
			homeHref: marketHref(market),
			productsLabel: messages.product.browseProducts,
			productsHref: marketHref(market, "/products"),
			searchLabel: messages.common.search,
			searchPlaceholder: messages.common.searchPlaceholder,
			searchAriaLabel: messages.nav.searchAriaLabel,
			searchAction: marketHref(market, "/search"),
		};
	},
);

/** Attribute on `<html>` that names the market whose block is shown. */
export const NOT_FOUND_MARKET_ATTRIBUTE = "data-maky-404-market";

/** Attribute on each block: a market, or `NOT_FOUND_DEFAULT_BLOCK` for the one with no market. */
export const NOT_FOUND_BLOCK_ATTRIBUTE = "data-maky-404";

export const NOT_FOUND_DEFAULT_BLOCK = "default";

/**
 * Shows exactly one block: the market's when `<html>` names one, the English one otherwise.
 *
 * Written out per market and not as a single attribute comparison because CSS cannot compare two
 * attributes with each other.
 */
export const NOT_FOUND_MARKET_CSS = [
	`[${NOT_FOUND_BLOCK_ATTRIBUTE}]{display:none}`,
	`html:not([${NOT_FOUND_MARKET_ATTRIBUTE}]) [${NOT_FOUND_BLOCK_ATTRIBUTE}="${NOT_FOUND_DEFAULT_BLOCK}"]{display:block}`,
	...NOT_FOUND_MARKETS.map(
		({ market }) =>
			`html[${NOT_FOUND_MARKET_ATTRIBUTE}="${market}"] [${NOT_FOUND_BLOCK_ATTRIBUTE}="${market}"]{display:block}`,
	),
].join("");

/**
 * Reads the market from the address and marks `<html>` with it and with its language.
 *
 * Runs inline, before the blocks are painted, so nobody sees the English one flash first. It
 * reads `location.pathname`, which after the proxy's rewrite is still the address the customer
 * asked for. Anything that is not one of the twelve markets leaves the page as it is.
 */
export const NOT_FOUND_MARKET_SCRIPT = `(function(){try{var l=${JSON.stringify(
	Object.fromEntries(NOT_FOUND_MARKETS.map(({ market, locale }) => [market, locale])),
)};var m=location.pathname.split("/")[1];if(Object.prototype.hasOwnProperty.call(l,m)){var d=document.documentElement;d.setAttribute(${JSON.stringify(
	NOT_FOUND_MARKET_ATTRIBUTE,
)},m);d.lang=l[m]}}catch(e){}})();`;
