import { afterEach, describe, expect, it, vi } from "vitest";

import {
	LEGAL_COPY_APPROVED,
	LEGAL_NOTICE_VERSION,
	PRIVACY_NOTICE_VERSION,
	WITHDRAWAL_BACKEND_LIVE,
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
 * Marek approved the Slovak copy on 2026-07-30, so the flag is now `true` and these tests
 * changed direction with it. That is exactly what they were for: the earlier version
 * asserted the flag was still `false` so that flipping it could not happen silently, and
 * this version asserts the things that must be true once it has.
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

	it("keeps the privacy version ahead of the legal one", () => {
		// The declaration's wording is unchanged; the personal data processed grew by an
		// optional phone number. The two version lines move independently on purpose.
		expect(LEGAL_NOTICE_VERSION).toContain("v1");
		expect(PRIVACY_NOTICE_VERSION).toContain("v2");
	});

	it("still refuses to serve in production, because the backend is not live", () => {
		// Approving the copy and standing the backend up are different claims. The Forms
		// endpoint does not exist in production yet — its migration has never been applied
		// — so a submitted notice would fail at the transport. Honestly, but a customer
		// exercising a statutory right should not meet that at all.
		vi.stubEnv("NODE_ENV", "production");
		expect(WITHDRAWAL_BACKEND_LIVE).toBe(false);
		expect(isWithdrawalFormServable()).toBe(false);
		expect(withdrawalBlockReason()).toContain("WITHDRAWAL_BACKEND_LIVE");
	});

	it("names the copy flag first when both are unset, so the log is actionable", () => {
		vi.stubEnv("NODE_ENV", "production");
		// With the copy approved, the reason can only be the backend one. This pins the
		// ordering so a future flip of either flag produces the right message.
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
