import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_MAP } from "@/config/locale";

const SOURCE_LOCALE = "en-US";

/**
 * Deep-merge the English source catalog under the target locale's messages.
 *
 * Between "new keys land in sk-SK + en-US" and "the reviewed 13-locale translation bundle is
 * applied", the other locales are structurally behind — a missing key would render as a raw key
 * path at runtime (next-intl is not type-augmented). The per-key fallback keeps those surfaces
 * readable (English source) without copying English into the catalog files as fake translations.
 * The exact-key parity check reads the FILES, not this runtime merge, so gaps stay detectable.
 */
function mergeWithSource(
	source: Record<string, unknown>,
	target: Record<string, unknown>,
): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...source, ...target };

	for (const key of Object.keys(source)) {
		const sourceValue = source[key];
		const targetValue = target[key];

		if (
			sourceValue &&
			targetValue &&
			typeof sourceValue === "object" &&
			typeof targetValue === "object" &&
			!Array.isArray(sourceValue) &&
			!Array.isArray(targetValue)
		) {
			merged[key] = mergeWithSource(
				sourceValue as Record<string, unknown>,
				targetValue as Record<string, unknown>,
			);
		}
	}

	return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
	const rawLocale = (await requestLocale) || DEFAULT_LOCALE;
	const locale = rawLocale in LOCALE_MAP ? rawLocale : DEFAULT_LOCALE;

	let messages;
	try {
		messages = (await import(`./messages/${locale}.json`)).default;
	} catch {
		messages = (await import(`./messages/${DEFAULT_LOCALE}.json`)).default;
	}

	if (locale !== SOURCE_LOCALE) {
		try {
			const source = (await import(`./messages/${SOURCE_LOCALE}.json`)).default;
			messages = mergeWithSource(source, messages);
		} catch {
			// source catalog unavailable — serve the locale file as-is
		}
	}

	return { locale, messages };
});
