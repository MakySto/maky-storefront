import { getTranslations } from "next-intl/server";
import { marketHref } from "@/lib/channel-map";
import { type ContentLabels } from "@/lib/editorjs";

/**
 * What a description calls the shop's configurator, by the language it is written in. Only a language
 * whose descriptions say it is listed: the sets' warning is Slovak today ("… overiť kompatibilitu v
 * našom konfigurátore."), and a translation adds its own line when one exists, so no wording is guessed.
 */
const CONFIGURATOR_PHRASE: Record<string, string> = { sk: "našom konfigurátore" };

/**
 * The fixed words of the typed content blocks, for one market's locale.
 *
 * The locale is passed in, as `ProductSpecs` does for its own labels: this runs on the dynamic
 * render path, where the request locale is not guaranteed to be the page's. The channel is the
 * market the page is served in, which is whose configurator the description's words lead to.
 */
export async function getContentLabels(locale: string, channel: string): Promise<ContentLabels> {
	const t = await getTranslations({ locale, namespace: "product" });
	const phrase = CONFIGURATOR_PHRASE[locale.split("-")[0].toLowerCase()];
	return {
		callout: {
			tip: t("content.kind.tip"),
			info: t("content.kind.info"),
			warn: t("content.kind.warn"),
		},
		video: {
			play: t("content.video.play"),
			note: t("content.video.note"),
		},
		...(phrase ? { configurator: { phrase, href: marketHref(channel, "/konfigurator") } } : {}),
	};
}
