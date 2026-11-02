import { describe, expect, it, vi } from "vitest";

import { checkVatNumber, parseRequesterVatId, VIES_TIMEOUT_MS } from "./vies-client";

/**
 * MOCKS: the responses below are fixtures shaped after the official VIES REST API (`/check-vat-number`,
 * CommonResponse with `errorWrappers`), not answers recorded from VIES. Nothing here calls the network.
 */

const NOW = new Date("2026-11-02T12:00:00.000Z");
const requester = parseRequesterVatId("SK2122890660");

function json(body: unknown, status = 200) {
	return vi.fn(
		async () =>
			new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
	);
}

const valid = {
	countryCode: "DE",
	vatNumber: "123456789",
	requestDate: "2026-11-02T12:00:00.000Z",
	valid: true,
	requestIdentifier: "WAPIAAAAZ1x2y3",
	name: "Muster GmbH",
	address: "Musterstr. 1, 10115 Berlin",
	traderName: "---",
	userError: "VALID",
};

describe("parseRequesterVatId", () => {
	it("splits the seller's VAT ID for VIES", () => {
		expect(requester).toEqual({ memberStateCode: "SK", number: "2122890660" });
		expect(parseRequesterVatId(" sk 2122890660 ")).toEqual({ memberStateCode: "SK", number: "2122890660" });
		expect(parseRequesterVatId("")).toBeNull();
		expect(parseRequesterVatId("XX123")).toBeNull();
	});
});

describe("checkVatNumber (mocked VIES)", () => {
	it("VALID: sends the requester, keeps the request id, name and address as VIES gave them", async () => {
		const fetchImpl = json(valid);
		const result = await checkVatNumber({ vatId: "DE123456789", requester, fetchImpl, now: () => NOW });
		expect(result).toEqual({
			status: "VALID",
			vatId: "DE123456789",
			checkedAt: NOW.toISOString(),
			requestIdentifier: "WAPIAAAAZ1x2y3",
			name: "Muster GmbH",
			address: "Musterstr. 1, 10115 Berlin",
			detail: "valid",
		});
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number");
		expect(JSON.parse(String(init.body))).toEqual({
			countryCode: "DE",
			vatNumber: "123456789",
			requesterMemberStateCode: "SK",
			requesterNumber: "2122890660",
		});
	});

	it("an undisclosed name ('---') is null, never invented", async () => {
		const result = await checkVatNumber({
			vatId: "DE123456789",
			requester,
			fetchImpl: json({ ...valid, name: "---", address: "" }),
			now: () => NOW,
		});
		expect(result).toMatchObject({ status: "VALID", name: null, address: null });
	});

	it("INVALID: valid false with userError INVALID", async () => {
		const result = await checkVatNumber({
			vatId: "DE123456789",
			requester,
			fetchImpl: json({ ...valid, valid: false, userError: "INVALID", name: "---" }),
			now: () => NOW,
		});
		expect(result).toMatchObject({ status: "INVALID", detail: "invalid" });
	});

	it("INVALID_INPUT from VIES is a negative judgement of the number", async () => {
		const result = await checkVatNumber({
			vatId: "DE123456789",
			requester,
			fetchImpl: json({ actionSucceed: false, errorWrappers: [{ error: "INVALID_INPUT" }] }, 400),
			now: () => NOW,
		});
		expect(result).toMatchObject({ status: "INVALID", detail: "INVALID_INPUT" });
	});

	it.each([
		["MS_UNAVAILABLE", { actionSucceed: false, errorWrappers: [{ error: "MS_UNAVAILABLE" }] }, 200],
		[
			"MS_MAX_CONCURRENT_REQ",
			{ actionSucceed: false, errorWrappers: [{ error: "MS_MAX_CONCURRENT_REQ" }] },
			200,
		],
		["SERVICE_UNAVAILABLE", { ...valid, valid: false, userError: "SERVICE_UNAVAILABLE" }, 200],
		["http-503", { something: "else" }, 503],
		["no-valid-flag", { countryCode: "DE", vatNumber: "123456789" }, 200],
		["answer-mismatch", { ...valid, vatNumber: "999999999" }, 200],
	])("an outage is UNAVAILABLE, never INVALID (%s)", async (detail, body, status) => {
		const result = await checkVatNumber({
			vatId: "DE123456789",
			requester,
			fetchImpl: json(body, status),
			now: () => NOW,
		});
		expect(result).toMatchObject({ status: "UNAVAILABLE", detail, requestIdentifier: null });
	});

	it("a body that is not JSON is UNAVAILABLE", async () => {
		const fetchImpl = vi.fn(async () => new Response("<html>maintenance</html>", { status: 502 }));
		const result = await checkVatNumber({ vatId: "DE123456789", requester, fetchImpl, now: () => NOW });
		expect(result).toMatchObject({ status: "UNAVAILABLE", detail: "http-502-not-json" });
	});

	it("a timeout or a network error is UNAVAILABLE; the default timeout is 8 s", async () => {
		expect(VIES_TIMEOUT_MS).toBe(8_000);
		const timeout = vi.fn(async (_url: string, init: RequestInit) => {
			await new Promise((_, reject) => {
				init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
			});
			return new Response("{}");
		});
		const slow = await checkVatNumber({
			vatId: "DE123456789",
			requester,
			fetchImpl: timeout,
			timeoutMs: 20,
			now: () => NOW,
		});
		expect(slow).toMatchObject({ status: "UNAVAILABLE", detail: "timeout" });

		const offline = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});
		const down = await checkVatNumber({
			vatId: "DE123456789",
			requester,
			fetchImpl: offline,
			now: () => NOW,
		});
		expect(down).toMatchObject({ status: "UNAVAILABLE", detail: "network" });
	});

	it("a number VIES does not know is not sent", async () => {
		const fetchImpl = json(valid);
		const result = await checkVatNumber({ vatId: "US123", requester, fetchImpl, now: () => NOW });
		expect(result).toMatchObject({ status: "UNAVAILABLE", detail: "not-a-vies-number" });
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});
