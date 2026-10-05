import { getTranslations } from "next-intl/server";
import { type ContentLabels } from "@/lib/editorjs";

/**
 * The fixed words of the typed content blocks, for one market's locale.
 *
 * The locale is passed in, as `ProductSpecs` does for its own labels: this runs on the dynamic
 * render path, where the request locale is not guaranteed to be the page's.
 */
export async function getContentLabels(locale: string): Promise<ContentLabels> {
	const t = await getTranslations({ locale, namespace: "product" });
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
	};
}
