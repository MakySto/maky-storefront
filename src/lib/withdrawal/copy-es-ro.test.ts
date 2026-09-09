import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { legalLocaleFor } from "@/lib/legal/locale";
import { isWithdrawalFormServable, WITHDRAWAL_LOCALE, WITHDRAWAL_MARKET } from "./contract";
import { type WithdrawalCopy } from "./copy-de";
import { WITHDRAWAL_COPY_ES } from "./copy-es";
import { WITHDRAWAL_COPY_RO } from "./copy-ro";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * Spanish and Romanian withdrawal copy is PREPARED, not wired. This file holds that line.
 *
 * Same risk as `copy-de.test.ts`, `copy-pl-hu.test.ts` and `copy-it-fr.test.ts`: not a
 * typo, but somebody wiring the form before Returns V2 accepts the market — handing a
 * customer a button that produces no legal record, or one that files their notice under
 * `market: "SK"`.
 */
describe("Spanish and Romanian withdrawal copy is complete", () => {
	const ALL: ReadonlyArray<[string, WithdrawalCopy]> = [
		["es", WITHDRAWAL_COPY_ES],
		["ro", WITHDRAWAL_COPY_RO],
	];

	for (const [name, copy] of ALL) {
		it(`${name} has no empty string and no leftover slot marker`, () => {
			const walk = (value: unknown, path: string): void => {
				if (typeof value === "string") {
					expect(value.trim(), `${name}.${path} is empty`).not.toBe("");
					expect(value, `${name}.${path} still carries a slot marker`).not.toMatch(/\[\[|\{\{/);
					return;
				}
				for (const [k, v] of Object.entries(value as object)) walk(v, `${path}.${k}`);
			};
			walk(copy, "");
		});

		it(`${name} is a distinct language, not a copy of another market's strings`, () => {
			// The cheapest way this could go wrong is a paste that never got translated.
			expect(copy.submitButton).not.toBe("Widerruf bestätigen");
			expect(copy.submitButton).not.toBe("Potvrdiť odstúpenie od zmluvy");
			expect(copy.submitButton).not.toBe("Conferma recesso");
			expect(copy.submitButton).not.toBe("Confirmer la rétractation");
		});
	}

	it("writes Romanian with comma-below s and t, never cedilla", () => {
		// `ș`/`ț` (U+0219/U+021B) are the correct Romanian letters; `ş`/`ţ` (U+015F/U+0163)
		// are the Turkish cedilla forms that legacy encodings leave behind. They render
		// similarly enough to survive proofreading, and nothing in the toolchain would
		// object — no compiler, no linter, no build step.
		//
		// This reads the exported object rather than the file, deliberately: `copy-ro.ts`
		// NAMES both pairs in its doc comment to explain the difference, so a whole-file
		// scan would fail on the very comment that documents the rule.
		const strings = JSON.stringify(WITHDRAWAL_COPY_RO);
		expect(strings).not.toMatch(/[şţŞŢ]/);
		expect(strings).toMatch(/[șț]/);
	});

	it("keeps the printable Romanian form free of cedillas too", () => {
		// The model form is a separate surface with its own copy of the language, and it is
		// the one a customer prints and posts.
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/vzorovy-formular/page.tsx");
		const romanian = page.slice(page.indexOf("const ROMANIAN_TEXT"), page.indexOf("const TEXT:"));
		expect(romanian, "ROMANIAN_TEXT not found").not.toBe("");
		expect(romanian).not.toMatch(/[şţŞŢ]/);
	});

	it("does not promise a second time the contract cannot evidence", () => {
		// The acknowledgement can name the time of SENDING. It cannot name a time of
		// RECEIPT, because no such event exists in this storefront: Payload generates
		// `submittedAt` when it writes the record, which is a third thing again.
		//
		// This is the exact defect that had to be corrected in the Polish and Hungarian
		// files, so it is guarded here before either of these is ever wired.
		// `receivedTimeLabel` stays as a dormant label, so this guards the SENTENCE the
		// customer reads, not the field.
		expect(WITHDRAWAL_COPY_ES.acceptedBody).toContain("la fecha y hora de su envío");
		expect(WITHDRAWAL_COPY_ES.acceptedBody).not.toMatch(/recepción|recibida/i);
		expect(WITHDRAWAL_COPY_RO.acceptedBody).toContain("data și ora transmiterii");
		expect(WITHDRAWAL_COPY_RO.acceptedBody).not.toMatch(/primirii|recepți/i);
	});

	it("does not send the customer to a case-status view that does not exist", () => {
		// There is no customer-facing status page in this storefront. The approved wording
		// keeps the three things that ARE true: check your mail, a retry reuses the same
		// identifier so no duplicate record is created, and e-mail works. The Polish and
		// Hungarian drafts pointed at a portal that does not exist; these must not.
		expect(WITHDRAWAL_COPY_ES.unknownBody).not.toMatch(/estado del (?:caso|expediente)/i);
		expect(WITHDRAWAL_COPY_RO.unknownBody).not.toMatch(/stadiul (?:cazului|dosarului)/i);
		expect(WITHDRAWAL_COPY_ES.unknownBody).toMatch(/identificador/i);
		expect(WITHDRAWAL_COPY_RO.unknownBody).toMatch(/identificator/i);
		for (const [name, copy] of ALL) {
			expect(copy.unknownBody, `${name} drops the e-mail fallback`).toContain("info@maky.store");
		}
	});

	it("keeps the strings identical to the delivered editorial export", () => {
		// `copy-es.ts` and `copy-ro.ts` are `data/ui.{es-ES,ro-RO}.json` verbatim, not a
		// paraphrase. Pinning a few load-bearing values here means a future "small wording
		// improvement" has to be a deliberate decision to diverge from the approved export.
		expect(WITHDRAWAL_COPY_ES.formTitle).toBe("Desistimiento online");
		expect(WITHDRAWAL_COPY_ES.entryLabel).toBe("Desistir del contrato aquí");
		expect(WITHDRAWAL_COPY_ES.submitButton).toBe("Confirmar desistimiento");
		expect(WITHDRAWAL_COPY_RO.formTitle).toBe("Retragere online");
		expect(WITHDRAWAL_COPY_RO.entryLabel).toBe("Retrage-te din contract aici");
		expect(WITHDRAWAL_COPY_RO.submitButton).toBe("Confirmă retragerea");
	});

	it("carries a receipt-time label as well as a submission-time one", () => {
		// The backend has only `submittedAt` today, which is close to receipt but is not the
		// same event. Both labels exist so the distinction is not lost when Returns V2 grows
		// a real `receivedAt`. See `copy-de.ts` for the full note.
		for (const [, copy] of ALL) {
			expect(copy.receivedTimeLabel).not.toBe(copy.submissionTimeLabel);
		}
	});
});

describe("the Spanish and Romanian form stays unwired while the contract rejects those markets", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("still pins the contract to the Slovak market", () => {
		// If this fails, Returns V2 has been extended — which is the trigger to wire the
		// copy above, not to relax this test.
		expect(WITHDRAWAL_MARKET).toBe("SK");
		expect(WITHDRAWAL_LOCALE).toBe("sk");
	});

	it("keeps the form off es and ro whichever way the backend flag is set", () => {
		// The point of this assertion is the word "whichever". `isWithdrawalFormServable()`
		// is the operational interlock and it moves; the market check does not. Because the
		// gate ANDs the two, a market whose legal locale is not `sk` stays closed even in a
		// process where the backend is fully live — so turning the flag on for Slovakia can
		// never quietly open Spain or Romania as a side effect.
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		expect(page).toContain('isWithdrawalFormServable() && legalLocaleFor(channel) === "sk"');

		for (const backendLive of ["true", "false"]) {
			vi.stubEnv("NODE_ENV", "production");
			vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", backendLive);
			expect(isWithdrawalFormServable(), `interlock with the flag ${backendLive}`).toBe(
				backendLive === "true",
			);
			// …and the second operand of the gate, which the flag cannot influence.
			for (const channel of ["es-eur", "ro-ron"]) {
				expect(legalLocaleFor(channel), `${channel} with the flag ${backendLive}`).not.toBe("sk");
			}
		}
	});

	it("does not resolve es or ro to some other market's copy", () => {
		// A gate that reads the wrong channel would be worse than one that is simply shut:
		// it would submit a Spanish customer's notice under another market's locale. These
		// two markets must resolve to their own legal language and to nothing else.
		//
		// `ro-ron` is also the one market in `CHANNEL_MAP` whose Saleor slug does not end in
		// its own currency-free form, so a lookup written against a guessed slug would fail
		// here and nowhere else.
		expect(legalLocaleFor("es-eur")).toBe("es");
		expect(legalLocaleFor("ro-ron")).toBe("ro");
		expect(legalLocaleFor("es-eur")).not.toBe(legalLocaleFor("ro-ron"));
	});

	it("is not imported by any component yet", () => {
		// A deliberate tripwire: the moment something imports these, the reviewer has to
		// come back here and confirm the backend really does accept the market.
		const importers = ["src/ui/components/withdrawal/withdrawal-form.tsx", "src/lib/withdrawal/submit.ts"];
		for (const rel of importers) {
			const src = source(rel);
			expect(src, `${rel} imports Spanish copy before the backend accepts it`).not.toContain("copy-es");
			expect(src, `${rel} imports Romanian copy before the backend accepts it`).not.toContain("copy-ro");
		}
	});
});
