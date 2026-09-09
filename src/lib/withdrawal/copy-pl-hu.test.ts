import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { legalLocaleFor } from "@/lib/legal/locale";
import { isWithdrawalFormServable, WITHDRAWAL_LOCALE, WITHDRAWAL_MARKET } from "./contract";
import { type WithdrawalCopy } from "./copy-de";
import { WITHDRAWAL_COPY_HU } from "./copy-hu";
import { WITHDRAWAL_COPY_PL } from "./copy-pl";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * Polish and Hungarian withdrawal copy is PREPARED, not wired. This file holds that line.
 *
 * Same risk as `copy-de.test.ts`: not a typo, but somebody wiring the form before Returns
 * V2 accepts the market — handing a customer a button that produces no legal record, or
 * one that files their notice under `market: "SK"`.
 */
describe("Polish and Hungarian withdrawal copy is complete", () => {
	const ALL: ReadonlyArray<[string, WithdrawalCopy]> = [
		["pl", WITHDRAWAL_COPY_PL],
		["hu", WITHDRAWAL_COPY_HU],
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

		it(`${name} is a distinct language, not a copy of the German or Slovak strings`, () => {
			// The cheapest way this could go wrong is a paste that never got translated.
			expect(copy.submitButton).not.toBe("Widerruf bestätigen");
			expect(copy.submitButton).not.toBe("Potvrdiť odstúpenie od zmluvy");
		});
	}

	it("uses the two control labels Hungarian law prescribes", () => {
		// 45/2014. (II. 26.) Korm. rendelet § 22 governs how the entry and confirming
		// controls of an online withdrawal function must be labelled. These strings are a
		// compliance artefact, not a translation choice — do not reword them for fluency.
		expect(WITHDRAWAL_COPY_HU.entryLabel).toBe("Elállás a szerződéstől");
		expect(WITHDRAWAL_COPY_HU.submitButton).toBe("Elállás megerősítése");
	});

	it("does not promise a second time the contract cannot evidence", () => {
		// The first draft of both files told the customer the acknowledgement would carry
		// the time of SENDING *and* the time of RECEIPT. Only one of those exists: Payload
		// generates `submittedAt` when it writes the record. Hungarian law asks for the
		// sending time specifically — 45/2014 § 22(1c), "a megküldés napját és időpontját"
		// — and the delivered Polish export names sending alone too.
		//
		// `receivedTimeLabel` stays as a dormant label, so this guards the SENTENCE the
		// customer reads, not the field. If R ever mints a real receipt event, this test
		// is the place to record that it became true.
		expect(WITHDRAWAL_COPY_PL.acceptedBody).toContain("godziną jego wysłania");
		expect(WITHDRAWAL_COPY_PL.acceptedBody).not.toMatch(/otrzymani|odbioru|doręczeni/i);
		expect(WITHDRAWAL_COPY_HU.acceptedBody).toContain("elküldés napjával és időpontjával");
		expect(WITHDRAWAL_COPY_HU.acceptedBody).not.toMatch(/beérkezés|átvétel/i);
	});

	it("does not send the customer to a case-status view that does not exist", () => {
		// The first draft said to check "stan sprawy" / "az ügy állapotát". There is no
		// customer-facing status page in this storefront, so that pointed at nothing. The
		// approved wording keeps the three things that ARE true: check your mail, a retry
		// reuses the same identifier so no duplicate record is created, and e-mail works.
		for (const [name, copy] of [
			["pl", WITHDRAWAL_COPY_PL],
			["hu", WITHDRAWAL_COPY_HU],
		] as const) {
			expect(copy.unknownBody, `${name} points at a case-status view`).not.toMatch(
				/stan sprawy|stanu sprawy|ügy állapot/i,
			);
			expect(copy.unknownBody, `${name} drops the idempotency reassurance`).toMatch(
				/identyfikatora|azonosítót/,
			);
			expect(copy.unknownBody, `${name} drops the e-mail fallback`).toContain("info@maky.store");
		}
	});

	it("keeps the Polish strings identical to the delivered editorial export", () => {
		// `copy-pl.ts` is `data/ui.pl-PL.json` verbatim, not a paraphrase of it. Pinning a
		// few load-bearing values here means a future "small wording improvement" has to
		// be a deliberate decision to diverge from the approved export.
		expect(WITHDRAWAL_COPY_PL.submitButton).toBe("Potwierdź odstąpienie od umowy");
		expect(WITHDRAWAL_COPY_PL.entryLabel).toBe("Odstąp od umowy");
		expect(WITHDRAWAL_COPY_PL.formTitle).toBe("Odstąpienie od umowy online");
		expect(WITHDRAWAL_COPY_PL.acceptedTitle).toBe("Otrzymaliśmy oświadczenie o odstąpieniu");
		expect(WITHDRAWAL_COPY_PL.receiptNumberLabel).toBe("Numer zgłoszenia");
	});

	it("carries a receipt-time label as well as a submission-time one", () => {
		// The backend has only `submittedAt` today, which is close to receipt but is not
		// the same event. Both labels exist so the distinction is not lost when Returns V2
		// grows a real `receivedAt`. See `copy-de.ts` for the full note.
		for (const copy of [WITHDRAWAL_COPY_PL, WITHDRAWAL_COPY_HU]) {
			expect(copy.receivedTimeLabel).not.toBe(copy.submissionTimeLabel);
		}
	});
});

describe("the Polish and Hungarian form stays unwired while the contract rejects those markets", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("still pins the contract to the Slovak market", () => {
		// If this fails, Returns V2 has been extended — which is the trigger to wire the
		// copy above, not to relax this test.
		expect(WITHDRAWAL_MARKET).toBe("SK");
		expect(WITHDRAWAL_LOCALE).toBe("sk");
	});

	it("keeps the form off pl and hu whichever way the backend flag is set", () => {
		// The point of this assertion is the word "whichever". `isWithdrawalFormServable()`
		// is the operational interlock and it moves; the market check does not. Because the
		// gate ANDs the two, a market whose legal locale is not `sk` stays closed even in a
		// process where the backend is fully live — so turning the flag on for Slovakia can
		// never quietly open Poland or Hungary as a side effect.
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		expect(page).toContain('isWithdrawalFormServable() && legalLocaleFor(channel) === "sk"');

		for (const backendLive of ["true", "false"]) {
			vi.stubEnv("NODE_ENV", "production");
			vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", backendLive);
			expect(isWithdrawalFormServable(), `interlock with the flag ${backendLive}`).toBe(
				backendLive === "true",
			);
			// …and the second operand of the gate, which the flag cannot influence.
			for (const channel of ["pl-pln", "hu-huf"]) {
				expect(legalLocaleFor(channel), `${channel} with the flag ${backendLive}`).not.toBe("sk");
			}
		}
	});

	it("does not resolve pl or hu to some other market's copy", () => {
		// A gate that reads the wrong channel would be worse than one that is simply shut:
		// it would submit a Polish customer's notice under another market's locale. These
		// two markets must resolve to their own legal language and to nothing else.
		expect(legalLocaleFor("pl-pln")).toBe("pl");
		expect(legalLocaleFor("hu-huf")).toBe("hu");
	});

	it("is not imported by any component yet", () => {
		// A deliberate tripwire: the moment something imports these, the reviewer has to
		// come back here and confirm the backend really does accept the market.
		const importers = ["src/ui/components/withdrawal/withdrawal-form.tsx", "src/lib/withdrawal/submit.ts"];
		for (const rel of importers) {
			const src = source(rel);
			expect(src, `${rel} imports Polish copy before the backend accepts it`).not.toContain("copy-pl");
			expect(src, `${rel} imports Hungarian copy before the backend accepts it`).not.toContain("copy-hu");
		}
	});
});
