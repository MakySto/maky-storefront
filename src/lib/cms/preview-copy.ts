/**
 * The words of the CMS preview, in Slovak only.
 *
 * Preview is an editor's tool, not a shopper's page: the editors work in the CMS admin, which
 * is Slovak, and a German market preview is still read by a Slovak editor. So this copy is
 * deliberately not in the twelve market catalogues — putting it there would ask eleven
 * translations for a sentence no customer ever sees.
 */
export const CMS_PREVIEW_COPY = {
	/** The strip above a previewed page. */
	banner: "Náhľad konceptu — nie je verejný",
	exit: "Ukončiť náhľad",
	/** Title of every preview status page. */
	title: "Náhľad",
	/** A token the CMS refused, an expired one, or one for another market. */
	invalid: "Náhľad nie je platný alebo vypršal.",
	notConfigured: "Náhľad nie je nastavený.",
	reopen: "Otvorte náhľad znova z administrácie.",
	/** The CMS could not be asked — a network fault, not a verdict on the token. */
	unavailable: "Náhľad sa teraz nedá načítať. Skúste to o chvíľu znova.",
	/** The draft's markets exclude this market: the published page would be a 404 here. */
	notInMarket: "Tento koncept sa v tomto trhu nezobrazí — trh nie je v zozname trhov stránky.",
	/** The draft has no body for this market: the published page would be a 404 here. */
	notReady: "Tento koncept nemá pre tento trh žiadny obsah na zobrazenie.",
	/** The draft breaks the page contract: the published page would show its fallback. */
	unrenderable:
		"Tento koncept obsahuje obsah, ktorý web nevie zobraziť. Po zverejnení by sa zobrazila náhradná verzia stránky.",
} as const;
