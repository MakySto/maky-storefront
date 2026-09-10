import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_BODY_NAMES, legalLocaleFor, type LegalLocale } from "@/lib/legal/locale";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * The cookies page tells the reader to go back to a named control in the footer.
 * That name is written in prose here and rendered from `footer.privacySettings`
 * there, so the two can drift — and did: Italian, Spanish and Romanian each named
 * a control their footer does not render, which is an instruction the reader
 * cannot follow.
 *
 * The English bodies avoid this by taking the label as a prop read from the
 * catalogue. The others quote it literally, so this test is what keeps them
 * honest. It reads the source rather than rendering because these are async
 * server components and the suite runs in `node` with no DOM.
 *
 * Note the whitespace normalisation: `piè di pagina` and `pie de página` wrap
 * across source lines under Prettier, and a scan that forgets this reports a
 * clean bill of health for exactly the files that are broken.
 */

const SOURCE = fs.readFileSync(path.join(process.cwd(), "src/ui/content/legal/cookies.tsx"), "utf8");

/** Words for "footer" in each of the languages whose body names the control. */
const FOOTER_WORD =
	/pie de p[aá]gina|subsolul|p[aä]ti[cč]k|z[aá]pat[ií]|Fu[sß]zeile|stopce|l[aá]bl[eé]c|pied de page|pi[eè] di pagina|footer/i;

/** `footer.privacySettings` as each market's catalogue actually renders it. */
function footerLabelFor(locale: string): string {
	const file = path.join(process.cwd(), "src/i18n/messages", `${locale}.json`);
	const messages = JSON.parse(fs.readFileSync(file, "utf8")) as {
		footer: { privacySettings: string };
	};
	return messages.footer.privacySettings;
}

/** The exported body for one legal locale, with all whitespace collapsed. */
function bodyOf(legalLocale: LegalLocale): string {
	const name = LEGAL_BODY_NAMES[legalLocale];
	const start = SOURCE.indexOf(`export function ${name}(`);
	expect(start, `cookies.tsx has no exported body ${name}`).toBeGreaterThan(-1);
	const next = SOURCE.slice(start + 1).search(/export function \w+\(/);
	const end = next === -1 ? SOURCE.length : start + 1 + next;
	return SOURCE.slice(start, end).replace(/\s+/g, " ");
}

/** The control name quoted in the sentence that points at the footer, if any. */
function quotedControlName(body: string): string | null {
	if (!FOOTER_WORD.test(body)) return null;
	for (const sentence of body.split(/(?<=\.)\s/)) {
		if (!FOOTER_WORD.test(sentence)) continue;
		const quoted = sentence.match(/<strong>[«„“"”]?\s*([^<{]*?)\s*[»„“"”]?<\/strong>/);
		if (quoted) return quoted[1].replace(/^[«„“"”]|[»„“"”]$/g, "").trim();
	}
	return null;
}

const MARKETS = Object.entries(CHANNEL_MAP).map(([market, cfg]) => ({
	market,
	locale: cfg.locale,
	channel: cfg.saleorSlug,
}));

describe("cookies page names the control the footer really renders", () => {
	it("reads a body for all twelve markets", () => {
		expect(MARKETS).toHaveLength(12);
	});

	it.each(MARKETS)("$market", ({ market, locale, channel }) => {
		const legal = legalLocaleFor(channel);
		expect(legal, `${market} has no approved legal copy`).not.toBeNull();

		const named = quotedControlName(bodyOf(legal as LegalLocale));
		if (named === null) return; // this language does not point at the footer control

		expect(
			named,
			`the ${market} cookies page sends the reader to "${named}", but its footer renders "${footerLabelFor(
				locale,
			)}"`,
		).toBe(footerLabelFor(locale));
	});
});
