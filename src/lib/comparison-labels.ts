import { getTranslations } from "next-intl/server";
import { type ComparisonLabels } from "@/lib/editorjs";

/**
 * The words a comparison table speaks in, for one market's locale.
 *
 * The locale is passed in, as `ProductSpecs` does for its own labels: this runs on the dynamic
 * render path, where the request locale is not guaranteed to be the page's.
 */
export async function getComparisonLabels(locale: string): Promise<ComparisonLabels> {
	const t = await getTranslations({ locale, namespace: "product" });
	return {
		thisModel: t("comparison.thisModel"),
		models: (count) => t("comparison.modelCount", { count }),
		parameter: t("comparison.parameter"),
		sameForAll: t("comparison.sameForAll"),
		scrollRegion: t("comparison.scrollRegion"),
		yes: t("yes"),
		no: t("no"),
	};
}
