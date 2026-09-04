import { afterEach, describe, expect, it, vi } from "vitest";

import {
	LEGAL_COPY_APPROVED,
	LEGAL_NOTICE_VERSION,
	PRIVACY_NOTICE_VERSION,
	isWithdrawalBackendLive,
	assertLegalCopyApprovedForProduction,
	isWithdrawalFormServable,
	withdrawalBlockReason,
} from "./contract";

/**
 * The gate that was documented but not wired, and is now both wired and open.
 *
 * `assertLegalCopyApprovedForProduction` had zero callers repo-wide: the only occurrences
 * of the name were its own definition, its own doc-comment describing it as "the check a
 * deploy step *can* call", and one line in the handoff. Both the handoff and the session
 * notes stated that `LEGAL_COPY_APPROVED = false` gated the withdrawal deploy. It gated
 * nothing. `isWithdrawalFormServable()` put the check on the path a request actually takes.
 *
 * The runtime gate is open because the owner explicitly authorized the V2 storefront
 * release on 2026-08-02. This is an operational authorization, not a claim that the
 * outstanding real-client visual gate or final content acceptance is complete.
 */

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("the withdrawal legal-copy gate", () => {
	it("records that the copy has been approved", () => {
		expect(LEGAL_COPY_APPROVED).toBe(true);
	});

	it("carries no DRAFT version once the copy is approved", () => {
		// These strings are stamped onto every stored record, permanently. A record marked
		// `-DRAFT` while the copy is approved is a contradiction inside the evidence, so
		// the flag and the versions have to move together. This is what enforces that.
		expect(LEGAL_NOTICE_VERSION).not.toContain("DRAFT");
		expect(PRIVACY_NOTICE_VERSION).not.toContain("DRAFT");
	});

	it("keeps the V2 withdrawal and privacy versions independently pinned", () => {
		expect(LEGAL_NOTICE_VERSION).toContain("v2");
		expect(PRIVACY_NOTICE_VERSION).toContain("v1");
	});

	it("pins the version literals, because nothing else does any more", () => {
		// Every fixture now imports these constants instead of repeating them, which is
		// right — but it means editing a string the code calls "permanent" would otherwise
		// keep the whole suite green. This is the one place the values themselves are held.
		expect(LEGAL_NOTICE_VERSION).toBe("withdrawal-sk-v2");
		expect(PRIVACY_NOTICE_VERSION).toBe("privacy-sk-v1");
	});

	it("withholds the online function in production until the backend is live", () => {
		// The storefront flag remains an independent fail-closed interlock even though the
		// Payload V2 backend is already live.
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", "");
		expect(isWithdrawalBackendLive()).toBe(false);
		expect(isWithdrawalFormServable()).toBe(false);
		expect(withdrawalBlockReason()).toContain("WITHDRAWAL_BACKEND_LIVE");
	});

	it("offers it once the environment says the backend is live", () => {
		// The flag is an env var read at call time, not a source constant keyed off
		// NODE_ENV. A constant would have made the form unreachable in EVERY
		// production-mode build — staging and the spare-port verification build included —
		// so the signed live matrix the release gate demands could not have been run
		// without first shipping a change to disable the gate.
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", "true");
		expect(isWithdrawalFormServable()).toBe(true);
		expect(withdrawalBlockReason()).toBeNull();
	});

	it("accepts only the exact string true, so a stray value cannot open it", () => {
		vi.stubEnv("NODE_ENV", "production");
		for (const value of ["TRUE", "1", "yes", "false", " true"]) {
			vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", value);
			expect(isWithdrawalBackendLive(), value).toBe(false);
		}
	});

	it("names the backend flag, not the copy flag, now that the copy is approved", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("WITHDRAWAL_BACKEND_LIVE", "");
		expect(withdrawalBlockReason()).not.toContain("LEGAL_COPY_APPROVED");
	});

	it("serves it in development, where the form is meant to be exercised", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(isWithdrawalFormServable()).toBe(true);
		expect(withdrawalBlockReason()).toBeNull();
	});

	it("lets a deploy step assert the approval without throwing", () => {
		expect(() => assertLegalCopyApprovedForProduction()).not.toThrow();
	});
});
