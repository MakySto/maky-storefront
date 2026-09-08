import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { legalLocaleFor } from "@/lib/legal/locale";
import { WITHDRAWAL_LOCALE, WITHDRAWAL_MARKET } from "./contract";
import { WITHDRAWAL_COPY_DE, WITHDRAWAL_COPY_DE_AT, type WithdrawalCopy } from "./copy-de";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * German withdrawal copy is PREPARED, not wired. These assertions hold that line.
 *
 * The risk this file guards is not a typo. It is somebody wiring the German form before
 * Returns V2 accepts the market, which would hand a German customer a button that
 * produces no legal record — or worse, one that files their notice under `market: "SK"`.
 */
describe("German withdrawal copy is complete", () => {
	const ALL: ReadonlyArray<[string, WithdrawalCopy]> = [
		["de", WITHDRAWAL_COPY_DE],
		["deAt", WITHDRAWAL_COPY_DE_AT],
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
	}

	it("keeps both control labels bound to the contract, not to local vocabulary", () => {
		// Austrian law calls the right a Rücktritt, but these two controls must read the
		// same in both markets: they are the entry point and the confirming action of one
		// Returns V2 submission, and the Austrian page reconciles the wording in prose.
		expect(WITHDRAWAL_COPY_DE.entryLabel).toBe("Vertrag widerrufen");
		expect(WITHDRAWAL_COPY_DE.submitButton).toBe("Widerruf bestätigen");
		expect(WITHDRAWAL_COPY_DE_AT.entryLabel).toBe(WITHDRAWAL_COPY_DE.entryLabel);
		expect(WITHDRAWAL_COPY_DE_AT.submitButton).toBe(WITHDRAWAL_COPY_DE.submitButton);
	});

	it("carries a receipt-time label as well as a submission-time one", () => {
		// § 356a(4) BGB requires the acknowledgement to state the time of RECEIPT; the
		// Slovak § 20a(5) notice correctly states the time of SENDING. Two markets, two
		// events. The backend has only `submittedAt` today — see the module doc.
		expect(WITHDRAWAL_COPY_DE.submissionTimeLabel).toContain("Versands");
		expect(WITHDRAWAL_COPY_DE.receivedTimeLabel).toContain("Eingangs");
		expect(WITHDRAWAL_COPY_DE.receivedTimeLabel).not.toBe(WITHDRAWAL_COPY_DE.submissionTimeLabel);
	});
});

describe("the German form stays unwired while the contract rejects its markets", () => {
	it("still pins the contract to the Slovak market", () => {
		// If this fails, Returns V2 has been extended — which is the trigger to wire the
		// copy above, not to relax this test.
		expect(WITHDRAWAL_MARKET).toBe("SK");
		expect(WITHDRAWAL_LOCALE).toBe("sk");
	});

	it("does not render the form on a German-speaking market", () => {
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		// The gate is `legalLocaleFor(channel) === "sk"`, so adding German legal copy —
		// which this thread did — must not have opened the form to it.
		expect(page).toContain('legalLocaleFor(channel) === "sk"');
		expect(legalLocaleFor("de-eur")).not.toBe("sk");
		expect(legalLocaleFor("at-eur")).not.toBe("sk");
	});

	it("is not imported by any component yet", () => {
		// A deliberate tripwire: the moment something imports this, the reviewer has to
		// come back here and confirm the backend really does accept the market.
		const importers = ["src/ui/components/withdrawal/withdrawal-form.tsx", "src/lib/withdrawal/submit.ts"];
		for (const rel of importers) {
			expect(source(rel), `${rel} imports German copy before the backend accepts it`).not.toContain(
				"copy-de",
			);
		}
	});
});
