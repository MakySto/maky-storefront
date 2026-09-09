import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { legalLocaleFor } from "@/lib/legal/locale";
import { isWithdrawalFormServable, WITHDRAWAL_LOCALE, WITHDRAWAL_MARKET } from "./contract";
import { type WithdrawalCopy } from "./copy-de";
import { WITHDRAWAL_COPY_EN_CA } from "./copy-en-ca";
import { WITHDRAWAL_COPY_EN_US } from "./copy-en-us";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * US and Canadian withdrawal copy is PREPARED, not wired. This file holds that line.
 *
 * Same risk as `copy-de.test.ts`, `copy-pl-hu.test.ts`, `copy-it-fr.test.ts` and
 * `copy-es-ro.test.ts`: not a typo, but somebody wiring the form before Returns V2
 * accepts the market — handing a customer a button that produces no legal record, or one
 * that files their notice under `market: "SK"`.
 *
 * English brings one risk the other five did not. These two markets share 36 of the 38
 * `WithdrawalCopy` strings word for word, and that is CORRECT — they are the same
 * language and the package says shared English sentences are legitimate. So nothing here
 * demands that the two differ. What it does demand is that the two places they genuinely
 * do differ survive, because "identical is fine" is exactly the assumption under which a
 * real difference gets flattened by a well-meaning de-duplication.
 */
describe("US and Canadian withdrawal copy is complete", () => {
	const ALL: ReadonlyArray<[string, WithdrawalCopy]> = [
		["en-US", WITHDRAWAL_COPY_EN_US],
		["en-CA", WITHDRAWAL_COPY_EN_CA],
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

		it(`${name} is English, not a paste from another market`, () => {
			// The cheapest way this could go wrong is a paste that never got translated.
			expect(copy.submitButton).not.toBe("Widerruf bestätigen");
			expect(copy.submitButton).not.toBe("Potvrdiť odstúpenie od zmluvy");
			expect(copy.submitButton).not.toBe("Conferma recesso");
			expect(copy.submitButton).not.toBe("Confirmer la rétractation");
			expect(copy.submitButton).not.toBe("Confirmar desistimiento");
			expect(copy.submitButton).not.toBe("Confirmă retragerea");
		});
	}

	it("keeps American and Canadian spelling apart", () => {
		// The ONLY two `WithdrawalCopy` strings that differ between these markets, and both
		// differ by one letter. A refactor that noticed "these two objects are 95% the same"
		// and collapsed them would lose exactly this, silently, and the loss would read as
		// correct English to most reviewers.
		expect(WITHDRAWAL_COPY_EN_US.fullName.help).toContain("canceling");
		expect(WITHDRAWAL_COPY_EN_CA.fullName.help).toContain("cancelling");
		expect(WITHDRAWAL_COPY_EN_US.itemsRequiredError).toContain("canceling");
		expect(WITHDRAWAL_COPY_EN_CA.itemsRequiredError).toContain("cancelling");

		// Stated as a positive too, so this fails if either file is replaced by the other.
		expect(WITHDRAWAL_COPY_EN_US.fullName.help).not.toBe(WITHDRAWAL_COPY_EN_CA.fullName.help);
		expect(WITHDRAWAL_COPY_EN_US.itemsRequiredError).not.toBe(WITHDRAWAL_COPY_EN_CA.itemsRequiredError);
	});

	it("allows the other 36 strings to be identical, because they are the same language", () => {
		// The inverse assertion, written down on purpose. An earlier market pair's test
		// could have been read as "every string must differ"; applied to English that would
		// be a demand to invent a second wording for sentences that are already correct,
		// which is how approved copy gets paraphrased into something nobody reviewed.
		//
		// So this pins the shared set as shared. If a future edit makes one of them differ,
		// this fails and the difference has to be a decision rather than a slip.
		const flat = (c: WithdrawalCopy) =>
			Object.entries(c).flatMap(([k, v]) =>
				typeof v === "string"
					? [[k, v] as const]
					: Object.entries(v as object).map(([sk, sv]) => [`${k}.${sk}`, sv as string] as const),
			);
		const us = new Map(flat(WITHDRAWAL_COPY_EN_US));
		const ca = new Map(flat(WITHDRAWAL_COPY_EN_CA));
		const differing = [...us.keys()].filter((k) => us.get(k) !== ca.get(k)).sort();
		expect(differing).toEqual(["fullName.help", "itemsRequiredError"]);
	});

	it("does not offer a return pickup that this market does not have", () => {
		// `data/form-capabilities.en-{US,CA}.json` set `showPickupInterest: false`. The key
		// is kept so the object stays structurally like the other nine languages, but the
		// help text must say plainly that routine pickup is not offered — otherwise the
		// prepared copy contains a standing offer of a service that does not exist.
		//
		// This checks the SENTENCE, not the flag, because the flag is editorial input for R
		// and never reaches runtime. The sentence is what a customer would read if the
		// field were ever rendered.
		for (const [name, copy] of ALL) {
			expect(copy.pickupHelp, `${name} implies routine pickup is available`).toMatch(
				/not offered for this market/i,
			);
			expect(copy.pickupHelp, `${name} should say the field is unavailable`).toMatch(/not available/i);
		}
	});

	it("does not promise a second time the contract cannot evidence", () => {
		// The acknowledgement can name the time of SENDING. It cannot name a time of
		// RECEIPT, because no such event exists in this storefront: Payload generates
		// `submittedAt` when it writes the record, which is a third thing again.
		//
		// This is the exact defect that had to be corrected in the Polish and Hungarian
		// files. `receivedTimeLabel` stays as a dormant label, so this guards the SENTENCE
		// the customer reads, not the field.
		for (const [name, copy] of ALL) {
			expect(copy.acceptedBody, name).toContain("the date and time it was sent");
			expect(copy.acceptedBody, `${name} claims a time of receipt`).not.toMatch(/received|receipt/i);
		}
	});

	it("does not send the customer to a case-status view that does not exist", () => {
		// There is no customer-facing status page in this storefront. The approved wording
		// keeps the three things that ARE true: check your mail, a retry reuses the same
		// identifier so no duplicate record is created, and e-mail works.
		for (const [name, copy] of ALL) {
			expect(copy.unknownBody, `${name} points at a status portal`).not.toMatch(
				/(case|order) status (page|portal)/i,
			);
			expect(copy.unknownBody, `${name} drops the idempotency promise`).toMatch(/identifier/i);
			expect(copy.unknownBody, `${name} drops the e-mail fallback`).toContain("info@maky.store");
		}
	});

	it("keeps the strings identical to the delivered editorial export", () => {
		// `copy-en-us.ts` and `copy-en-ca.ts` are `data/ui.en-{US,CA}.json` verbatim, not a
		// paraphrase. Pinning a few load-bearing values means a future "small wording
		// improvement" has to be a deliberate decision to diverge from the approved export.
		for (const [name, copy] of ALL) {
			expect(copy.formTitle, name).toBe("Online cancellation");
			expect(copy.entryLabel, name).toBe("Cancel a purchase");
			expect(copy.submitButton, name).toBe("Confirm cancellation");
		}
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

describe("the English form stays unwired while the contract rejects those markets", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("still pins the contract to the Slovak market", () => {
		// If this fails, Returns V2 has been extended — which is the trigger to wire the
		// copy above, not to relax this test.
		expect(WITHDRAWAL_MARKET).toBe("SK");
		expect(WITHDRAWAL_LOCALE).toBe("sk");
	});

	it("keeps the form off us and ca whichever way the backend flag is set", () => {
		// The point of this assertion is the word "whichever". `isWithdrawalFormServable()`
		// is the operational interlock and it moves; the market check does not. Because the
		// gate ANDs the two, a market whose legal locale is not `sk` stays closed even in a
		// process where the backend is fully live — so turning the flag on for Slovakia can
		// never quietly open the United States or Canada as a side effect.
		//
		// That matters more here than anywhere else: English is the last pair, so after this
		// registration EVERY market in `CHANNEL_MAP` has approved legal copy. "Has copy" and
		// "may submit a notice" have to stay two different questions, and this is where the
		// difference is enforced.
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		expect(page).toContain('isWithdrawalFormServable() && legalLocaleFor(channel) === "sk"');

		for (const backendLive of ["true", "false"]) {
			vi.stubEnv("NODE_ENV", "production");
			vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", backendLive);
			expect(isWithdrawalFormServable(), `interlock with the flag ${backendLive}`).toBe(
				backendLive === "true",
			);
			// …and the second operand of the gate, which the flag cannot influence.
			for (const channel of ["us-usd", "ca-cad"]) {
				expect(legalLocaleFor(channel), `${channel} with the flag ${backendLive}`).not.toBe("sk");
			}
		}
	});

	it("does not resolve us or ca to some other market's copy", () => {
		// A gate that reads the wrong channel would be worse than one that is simply shut:
		// it would submit an American customer's notice under another market's locale. The
		// two must resolve to their own legal language and to nothing else — and they must
		// not resolve to EACH OTHER, which is the new failure mode for a market pair that
		// shares a language.
		expect(legalLocaleFor("us-usd")).toBe("enUs");
		expect(legalLocaleFor("ca-cad")).toBe("enCa");
		expect(legalLocaleFor("us-usd")).not.toBe(legalLocaleFor("ca-cad"));
	});

	it("is not imported by any component yet", () => {
		// A deliberate tripwire: the moment something imports these, the reviewer has to
		// come back here and confirm the backend really does accept the market.
		const importers = ["src/ui/components/withdrawal/withdrawal-form.tsx", "src/lib/withdrawal/submit.ts"];
		for (const rel of importers) {
			const src = source(rel);
			expect(src, `${rel} imports US copy before the backend accepts it`).not.toContain("copy-en-us");
			expect(src, `${rel} imports Canadian copy before the backend accepts it`).not.toContain("copy-en-ca");
		}
	});
});
