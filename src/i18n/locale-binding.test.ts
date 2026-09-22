import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A market page must never ask for its language and be answered with Slovak.
 *
 * `getTranslations("ns")` and `useTranslations("ns")` read the locale from request-scoped
 * state. Under a market layout that state is set once, in `[channel]/layout.tsx` — but the
 * subtrees below it do not all render inside that scope. A cached segment, a background
 * revalidation, a dynamic branch that reads a cookie: each can render with no request locale
 * at all, and `i18n/request.ts` answers that with DEFAULT_LOCALE, which is `sk-SK`. Nothing
 * fails. The page simply comes out in Slovak, and only on some renders, which is why this was
 * so hard to pin down: a US product page was caught showing "Domov" and "Na objednávku,
 * dodanie 5–10 pracovných dní" while the same URL fetched seconds later was entirely English.
 *
 * So SERVER components under a market must pass the locale explicitly:
 *
 *     getTranslations({ locale, namespace: "product" })
 *
 * Client components are exempt: they take their locale from `NextIntlClientProvider`, which
 * `[channel]/layout.tsx` gives an explicit `locale={locale}`, so `useTranslations("ns")` in a
 * `"use client"` file is already bound to the market.
 *
 * Money has the same failure and a stronger guard: `formatPrice`'s `locale` parameter is
 * required, so a missing one is a type error rather than a test. `sk-SK` renders a dollar
 * price as "196,99 USD" where a US shopper expects "$196.99" — that one was live on every
 * foreign market until 2026-09-22.
 */

const ROOTS = ["src/app/[channel]", "src/ui/components"];
/**
 * Both forms. `useTranslations("ns")` in a SERVER component reads request state exactly as
 * `getTranslations("ns")` does — and checking only the latter is how `availability-badge.tsx`
 * survived the first sweep and went on announcing "Na objednávku, dodanie 5–10 pracovných dní"
 * on a Canadian product page whose every other line was English.
 */
const NAKED = /\b(?:get|use)Translations\(\s*["'`]/;

/** Files that are allowed to keep a bare call, each for a stated reason. */
const EXEMPT = new Set<string>([
	// Renders only inside NextIntlClientProvider, which carries the market locale.
]);

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...walk(full));
		} else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

describe("a market's language is passed, not inferred", () => {
	it("no server component under a market asks for translations without a locale", () => {
		const offenders: string[] = [];

		for (const root of ROOTS) {
			for (const file of walk(root)) {
				const source = readFileSync(file, "utf8");
				if (source.startsWith('"use client"') || source.startsWith("'use client'")) continue;
				if (EXEMPT.has(file)) continue;
				if (!NAKED.test(source)) continue;

				const line = source.split("\n").findIndex((text) => NAKED.test(text)) + 1;
				offenders.push(`${file}:${line}`);
			}
		}

		// The message is the point: a reader who trips this needs to know what to write instead.
		expect(
			offenders,
			`These server components ask for translations without saying which locale, so they render ` +
				`in Slovak whenever the request locale is out of scope. Use ` +
				`getTranslations({ locale, namespace: "…" }) with the market's locale — from a prop, or ` +
				`from getLocaleFromChannel(channel).`,
		).toEqual([]);
	});
});
