import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { legalLocaleFor } from "@/lib/legal/locale";
import { isWithdrawalFormServable, WITHDRAWAL_LOCALE, WITHDRAWAL_MARKET } from "./contract";
import { type WithdrawalCopy } from "./copy-de";
import { WITHDRAWAL_COPY_FR } from "./copy-fr";
import { WITHDRAWAL_COPY_IT } from "./copy-it";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * Italian and French withdrawal copy is PREPARED, not wired. This file holds that line.
 *
 * Same risk as `copy-de.test.ts` and `copy-pl-hu.test.ts`: not a typo, but somebody
 * wiring the form before Returns V2 accepts the market — handing a customer a button that
 * produces no legal record, or one that files their notice under `market: "SK"`.
 */
describe("Italian and French withdrawal copy is complete", () => {
	const ALL: ReadonlyArray<[string, WithdrawalCopy]> = [
		["it", WITHDRAWAL_COPY_IT],
		["fr", WITHDRAWAL_COPY_FR],
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
			expect(copy.submitButton).not.toBe("Potwierdź odstąpienie od umowy");
		});
	}

	it("uses the control labels the two 2026 transpositions require", () => {
		// Italy: art. 54-bis Codice del consumo, inserted by D.lgs. 209/2025 and applicable
		// from 19 June 2026. France: art. D221-5 code de la consommation, added by décret
		// 2026-3 and applicable from the same date. Both require the entry and confirming
		// controls of an online withdrawal function to be unambiguously labelled. These
		// strings are a compliance artefact, not a translation choice — do not reword them
		// for fluency.
		expect(WITHDRAWAL_COPY_IT.entryLabel).toBe("Recedere dal contratto qui");
		expect(WITHDRAWAL_COPY_IT.submitButton).toBe("Conferma recesso");
		expect(WITHDRAWAL_COPY_FR.entryLabel).toBe("Renoncer au contrat ici");
		expect(WITHDRAWAL_COPY_FR.submitButton).toBe("Confirmer la rétractation");
	});

	it("does not confuse rétractation with résolution or résiliation", () => {
		// Three different French concepts: withdrawing without a reason, the remedy for a
		// non-conforming product, and terminating a continuing contract. Using one for
		// another would misdescribe the right the customer is exercising. `résolution` is
		// legitimate on the complaints page; it has no business in this flow.
		const strings = JSON.stringify(WITHDRAWAL_COPY_FR);
		expect(strings).not.toMatch(/résiliation|résilier/i);
		expect(strings).not.toMatch(/résolution du contrat/i);
		expect(strings).toMatch(/rétractation/i);
	});

	it("does not promise a second time the contract cannot evidence", () => {
		// The acknowledgement can name the time of SENDING. It cannot name a time of
		// RECEIPT, because no such event exists: Payload generates `submittedAt` when it
		// writes the record, which is a third thing again. Both transpositions ask for the
		// sending time specifically.
		//
		// This is the exact defect that had to be corrected in the Polish and Hungarian
		// files, so it is guarded here before either of these is ever wired.
		// `receivedTimeLabel` stays as a dormant label, so this guards the SENTENCE the
		// customer reads, not the field.
		expect(WITHDRAWAL_COPY_IT.acceptedBody).toContain("l’ora del suo invio");
		expect(WITHDRAWAL_COPY_IT.acceptedBody).not.toMatch(/ricezione|ricevimento/i);
		expect(WITHDRAWAL_COPY_FR.acceptedBody).toContain("l’heure de son envoi");
		expect(WITHDRAWAL_COPY_FR.acceptedBody).not.toMatch(/réception|reçue/i);
	});

	it("does not send the customer to a case-status view that does not exist", () => {
		// There is no customer-facing status page in this storefront. The approved wording
		// keeps the three things that ARE true: check your mail, a retry reuses the same
		// identifier so no duplicate record is created, and e-mail works. The Polish and
		// Hungarian drafts pointed at a portal that does not exist; these must not.
		expect(WITHDRAWAL_COPY_IT.unknownBody).not.toMatch(/stato della pratica|stato del caso/i);
		expect(WITHDRAWAL_COPY_FR.unknownBody).not.toMatch(/état du dossier|suivi du dossier/i);
		expect(WITHDRAWAL_COPY_IT.unknownBody).toMatch(/identificativo/i);
		expect(WITHDRAWAL_COPY_FR.unknownBody).toMatch(/identifiant/i);
		for (const [name, copy] of ALL) {
			expect(copy.unknownBody, `${name} drops the e-mail fallback`).toContain("info@maky.store");
		}
	});

	it("keeps the strings identical to the delivered editorial export", () => {
		// `copy-it.ts` and `copy-fr.ts` are `data/ui.{it-IT,fr-FR}.json` verbatim, not a
		// paraphrase. Pinning a few load-bearing values here means a future "small wording
		// improvement" has to be a deliberate decision to diverge from the approved export.
		expect(WITHDRAWAL_COPY_IT.formTitle).toBe("Recesso online");
		expect(WITHDRAWAL_COPY_IT.acceptedTitle).toBe("Abbiamo ricevuto la dichiarazione di recesso");
		expect(WITHDRAWAL_COPY_IT.receiptNumberLabel).toBe("Numero della pratica");
		expect(WITHDRAWAL_COPY_FR.formTitle).toBe("Rétractation en ligne");
		expect(WITHDRAWAL_COPY_FR.submissionTimeLabel).toBe("Date et heure d’envoi");
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

describe("the Italian and French form stays unwired while the contract rejects those markets", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("still pins the contract to the Slovak market", () => {
		// If this fails, Returns V2 has been extended — which is the trigger to wire the
		// copy above, not to relax this test.
		expect(WITHDRAWAL_MARKET).toBe("SK");
		expect(WITHDRAWAL_LOCALE).toBe("sk");
	});

	it("keeps the form off it and fr whichever way the backend flag is set", () => {
		// The point of this assertion is the word "whichever". `isWithdrawalFormServable()`
		// is the operational interlock and it moves; the market check does not. Because the
		// gate ANDs the two, a market whose legal locale is not `sk` stays closed even in a
		// process where the backend is fully live — so turning the flag on for Slovakia can
		// never quietly open Italy or France as a side effect.
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		expect(page).toContain('isWithdrawalFormServable() && legalLocaleFor(channel) === "sk"');

		for (const backendLive of ["true", "false"]) {
			vi.stubEnv("NODE_ENV", "production");
			vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", backendLive);
			expect(isWithdrawalFormServable(), `interlock with the flag ${backendLive}`).toBe(
				backendLive === "true",
			);
			// …and the second operand of the gate, which the flag cannot influence.
			for (const channel of ["it-eur", "fr-eur"]) {
				expect(legalLocaleFor(channel), `${channel} with the flag ${backendLive}`).not.toBe("sk");
			}
		}
	});

	it("does not resolve it or fr to some other market's copy", () => {
		// A gate that reads the wrong channel would be worse than one that is simply shut:
		// it would submit an Italian customer's notice under another market's locale. These
		// two markets must resolve to their own legal language and to nothing else.
		expect(legalLocaleFor("it-eur")).toBe("it");
		expect(legalLocaleFor("fr-eur")).toBe("fr");
		expect(legalLocaleFor("it-eur")).not.toBe(legalLocaleFor("fr-eur"));
	});

	it("is not imported by any component yet", () => {
		// A deliberate tripwire: the moment something imports these, the reviewer has to
		// come back here and confirm the backend really does accept the market.
		const importers = ["src/ui/components/withdrawal/withdrawal-form.tsx", "src/lib/withdrawal/submit.ts"];
		for (const rel of importers) {
			const src = source(rel);
			expect(src, `${rel} imports Italian copy before the backend accepts it`).not.toContain("copy-it");
			expect(src, `${rel} imports French copy before the backend accepts it`).not.toContain("copy-fr");
		}
	});
});
