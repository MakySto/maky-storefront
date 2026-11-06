import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GATE_BUTTON_KEY } from "@/ui/components/pdp/tyre-fit-box";

/**
 * Every `tyreSize` key the components ask for exists in every language.
 *
 * next-intl is not type-augmented, so a key that is missing, or misspelled in the code, fails nowhere at build: the
 * page prints the key's own path. The locale-parity script catches a key missing from SOME files; this catches a key
 * the code asks for that NO file has, which parity cannot see.
 */

const LOCALES = [
	"cs-CZ",
	"de-AT",
	"de-DE",
	"en-CA",
	"en-US",
	"es-ES",
	"fr-FR",
	"hu-HU",
	"it-IT",
	"pl-PL",
	"ro-RO",
	"sk-SK",
] as const;

const FILES = [
	"src/ui/components/pdp/tyre-fit-box.tsx",
	"src/ui/components/pdp/add-to-cart.tsx",
	"src/ui/components/pdp/sticky-bar.tsx",
	"src/ui/components/vehicle/tyre-size-tab.tsx",
	"src/ui/components/vehicle/vehicle-selector-sheet.tsx",
	"src/ui/components/vehicle/vehicle-selector-launcher.tsx",
	"src/ui/components/plp/cart-form.tsx",
	"src/ui/components/cart/tyre-choice-line.tsx",
];

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const tyreMessages = (locale: string) =>
	(JSON.parse(read(`src/i18n/messages/${locale}.json`)) as { tyreSize: Record<string, string> }).tyreSize;

/**
 * The text of the first argument of every call `name(...)` in a source, string literals kept whole. A small scanner
 * rather than a regular expression: the argument may itself hold parentheses, a ternary, or a comparison with a string.
 */
function firstArguments(source: string, name: string): string[] {
	const found: string[] = [];
	for (const start of source.matchAll(new RegExp(`\\b${name}\\(`, "g"))) {
		let depth = 0;
		let text = "";
		for (let i = start.index! + start[0].length; i < source.length; i++) {
			const ch = source[i];
			if (ch === '"' || ch === "'" || ch === "`") {
				const end = source.indexOf(ch, i + 1);
				text += source.slice(i, end + 1);
				i = end;
				continue;
			}
			if (ch === "(" || ch === "[" || ch === "{") depth++;
			if (ch === ")" || ch === "]" || ch === "}") {
				if (depth === 0) break;
				depth--;
			}
			if (ch === "," && depth === 0) break;
			text += ch;
		}
		found.push(text);
	}
	return found;
}

/** The keys a file asks of the `tyreSize` namespace: through every translator it binds to it, including `cond ? "a" : "b"`. */
function keysUsedIn(file: string): string[] {
	const source = read(file);
	const names = [...source.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*"tyreSize"\s*\)/g)].map(
		(m) => m[1],
	);
	const keys = new Set<string>();
	for (const name of names) {
		for (const argument of firstArguments(source, name)) {
			// In `mode === "only" ? "conditionOnly" : "conditionNot"` the keys are what follows the single "?".
			const branches = argument.split(/(?<!\?)\?(?!\?)/);
			const texts = branches.length > 1 ? branches.slice(1).join("?") : argument;
			for (const literal of texts.matchAll(/"([A-Za-z]+)"/g)) keys.add(literal[1]);
		}
	}
	return [...keys];
}

describe("the tyre-size texts the components ask for", () => {
	it("finds the translators and keys it is meant to check", () => {
		// A scan that matches nothing would pass for ever.
		const found = Object.fromEntries(FILES.map((file) => [file, keysUsedIn(file)]));
		expect(found["src/ui/components/pdp/tyre-fit-box.tsx"]).toEqual(
			expect.arrayContaining(["fitNoSizeTitle", "fitEnter", "conditionOnly", "conditionNot", "fitHowToFind"]),
		);
		expect(found["src/ui/components/vehicle/tyre-size-tab.tsx"]).toEqual(
			expect.arrayContaining(["tabHeading", "inputLabel", "useSize", "forget", "errorSave"]),
		);
		expect(found["src/ui/components/vehicle/vehicle-selector-sheet.tsx"]).toEqual(
			expect.arrayContaining(["selectorTitle", "tabsLabel", "tabVehicle", "tabTyres"]),
		);
		expect(found["src/ui/components/vehicle/vehicle-selector-launcher.tsx"]).toEqual(
			expect.arrayContaining(["headerTyres", "headerHint", "changeShort"]),
		);
		expect(found["src/ui/components/plp/cart-form.tsx"]).toEqual(
			expect.arrayContaining(["errorRequired", "errorInvalid", "errorCondition"]),
		);
	});

	it.each(LOCALES)("%s has every one of them", (locale) => {
		const messages = tyreMessages(locale);
		const missing: string[] = [];
		for (const file of FILES) {
			for (const key of keysUsedIn(file)) if (!messages[key]) missing.push(`${file}: ${key}`);
		}
		for (const key of Object.values(GATE_BUTTON_KEY))
			if (!messages[key]) missing.push(`GATE_BUTTON_KEY: ${key}`);
		expect(missing).toEqual([]);
	});

	it.each(LOCALES)("%s keeps no text that nothing asks for any more", (locale) => {
		const asked = new Set<string>(Object.values(GATE_BUTTON_KEY));
		for (const file of FILES) for (const key of keysUsedIn(file)) asked.add(key);
		// The cart line shows what was chosen with keys built from the line's metadata, not written out at the call.
		for (const key of ["lineSize", "lineOnly", "lineNot", "lineCode"]) asked.add(key);
		const unused = Object.keys(tyreMessages(locale)).filter((key) => !asked.has(key));
		expect(unused).toEqual([]);
	});
});
