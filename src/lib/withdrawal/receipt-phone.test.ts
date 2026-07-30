import { describe, expect, it } from "vitest";

import { PRIVACY_NOTICE_VERSION, LEGAL_NOTICE_VERSION, type PayloadNoticeSnapshot } from "./contract";
import { renderNoticeFromSnapshot } from "./notice";

/**
 * The receipt shows a phone only when Payload stored one.
 *
 * The rule this protects is the reason the snapshot exists at all: the receipt is a
 * projection of the record, not a second copy of the form input. A number rendered from
 * anywhere but the returned snapshot could differ from what was stored, on a document the
 * customer is told to keep as proof.
 */

function snapshot(phone: string | null): PayloadNoticeSnapshot {
	return {
		schemaVersion: 1,
		source: "guest",
		market: "SK",
		locale: "sk",
		customer: { name: "Jana Nováková", email: "jana@example.sk", phone },
		contract: { orderNumber: "ORD-1042" },
		scope: "wholeOrder",
		items: [],
		note: null,
		legalNoticeVersion: LEGAL_NOTICE_VERSION,
		privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
	};
}

describe("renderNoticeFromSnapshot — the phone line", () => {
	it("prints the number Payload stored", () => {
		const text = renderNoticeFromSnapshot(snapshot("+421 901 730 066"));
		expect(text).toContain("Telefón: +421 901 730 066");
	});

	it("omits the line entirely when there is no number", () => {
		// Not an empty "Telefón:" line — on a document offered as proof, a blank label
		// suggests something was lost.
		const text = renderNoticeFromSnapshot(snapshot(null));
		expect(text).not.toContain("Telefón");
	});

	it("keeps the rest of the notice identical either way", () => {
		const withPhone = renderNoticeFromSnapshot(snapshot("+421 901 730 066"));
		const without = renderNoticeFromSnapshot(snapshot(null));
		expect(withPhone.split("\n").filter((l) => !l.startsWith("Telefón"))).toEqual(without.split("\n"));
	});

	it("stays a pure projection — same snapshot in, same text out", () => {
		expect(renderNoticeFromSnapshot(snapshot("+421 901"))).toBe(
			renderNoticeFromSnapshot(snapshot("+421 901")),
		);
	});
});
