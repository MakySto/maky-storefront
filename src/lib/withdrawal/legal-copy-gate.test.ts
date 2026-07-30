import { afterEach, describe, expect, it, vi } from "vitest";

import { LEGAL_COPY_APPROVED, isWithdrawalFormServable } from "./contract";

/**
 * The gate that was documented but not wired.
 *
 * `assertLegalCopyApprovedForProduction` had zero callers repo-wide: the only occurrences
 * of the name were its own definition, its own doc-comment describing it as "the check a
 * deploy step *can* call", and one line in the handoff. Both the handoff and the session
 * notes stated that `LEGAL_COPY_APPROVED = false` gated the withdrawal deploy. It gated
 * nothing, and deploying the branch would have put a legally mandated form live with
 * unreviewed Slovak copy.
 *
 * These tests exist so the same thing cannot be true twice. They fail if the flag is
 * flipped without the wording being signed off, and they fail if the check is removed
 * from the path a request takes.
 */

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("the withdrawal legal-copy gate", () => {
	it("still declares the copy unapproved", () => {
		// A deliberate tripwire. Flipping this to `true` is the intended way to ship, and
		// this line is where somebody has to acknowledge that a human read the wording.
		// If you are here because this test failed: that is the review, do not delete it.
		expect(LEGAL_COPY_APPROVED).toBe(false);
	});

	it("refuses to serve the form in a production build while the copy is a draft", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(isWithdrawalFormServable()).toBe(false);
	});

	it("serves it everywhere else, because that is where it is meant to be exercised", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(isWithdrawalFormServable()).toBe(true);

		vi.stubEnv("NODE_ENV", "test");
		expect(isWithdrawalFormServable()).toBe(true);
	});
});
