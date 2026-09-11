import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the contact action does NOT trust the browser for.
 *
 * The form posts fields; it does not get to say which market's mailbox they land in,
 * and it does not get to see anything the provider returned beyond a reference number.
 */

vi.mock("server-only", () => ({}));

const submitContactToPayload = vi.fn();
vi.mock("@/lib/forms/payload-forms-client", () => ({
	submitContactToPayload: (...args: unknown[]) => submitContactToPayload(...args),
}));
vi.mock("@/lib/auth/has-auth-session", () => ({ hasAuthSession: async () => false }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }) }));

const accepted = (overrides: Record<string, unknown> = {}) => ({
	status: "ok",
	value: {
		id: "018f1000-0000-7000-8000-000000000002",
		submissionId: "018f0000-0000-7000-8000-000000000002",
		submissionNumber: "KON-2026-000001",
		submittedAt: "2026-09-11T12:00:00.000Z",
		emailDelivery: {
			customerStatus: "pending",
			customerSentAt: null,
			customerAttemptCount: 0,
			customerLastAttemptAt: null,
			internalStatus: "pending",
			internalSentAt: null,
			internalAttemptCount: 0,
			internalLastAttemptAt: null,
		},
		duplicate: false,
		...overrides,
	},
});

const form = (overrides: Record<string, string> = {}) => {
	const data = new FormData();
	const fields: Record<string, string> = {
		channel: "sk-eur",
		submissionId: "018f0000-0000-7000-8000-000000000002",
		name: "Meno Priezvisko",
		email: "customer@example.com",
		phone: "",
		topic: "productAdvice",
		order: "",
		message: "Text správy.",
		...overrides,
	};
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

async function submit(data: FormData) {
	const { submitContactAction } = await import("./actions");
	return submitContactAction({ status: "idle" }, data);
}

beforeEach(() => {
	vi.resetModules();
	submitContactToPayload.mockReset();
	submitContactToPayload.mockResolvedValue(accepted());
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("the market is derived, never accepted from the form", () => {
	it("uses the channel's own market and locale", async () => {
		await submit(form({ channel: "at-eur" }));
		const sent = submitContactToPayload.mock.calls[0][0];
		expect(sent.market).toBe("AT");
		expect(sent.locale).toBe("de"); // AT and DE share a Payload locale
	});

	it("ignores a market or locale smuggled in through the form", async () => {
		await submit(form({ channel: "sk-eur", market: "DE", locale: "de" } as never));
		const sent = submitContactToPayload.mock.calls[0][0];
		expect(sent.market).toBe("SK");
		expect(sent.locale).toBe("sk");
	});

	it("files nothing at all for an unknown channel", async () => {
		const state = await submit(form({ channel: "zz-zzz" }));
		expect(state.status).toBe("failed");
		expect(submitContactToPayload).not.toHaveBeenCalled();
	});
});

describe("the submission id is the idempotency key", () => {
	it("passes the form's id through unchanged, so a retry replays", async () => {
		await submit(form());
		expect(submitContactToPayload.mock.calls[0][0].submissionId).toBe("018f0000-0000-7000-8000-000000000002");
	});

	it("refuses to file without a well-formed one rather than risk a duplicate", async () => {
		for (const bad of ["", "not-a-uuid", "../../etc/passwd"]) {
			submitContactToPayload.mockClear();
			const state = await submit(form({ submissionId: bad }));
			expect(state.status).toBe("failed");
			expect(submitContactToPayload).not.toHaveBeenCalled();
		}
	});
});

describe("what the browser is told", () => {
	it("gets the reference and the duplicate flag, and nothing else", async () => {
		const state = await submit(form());
		expect(state.status).toBe("received");
		if (state.status !== "received") return;
		expect(Object.keys(state.acknowledgement).sort()).toEqual(["duplicate", "submissionNumber"]);
		// No provider id, no timestamps, no per-channel delivery state.
		expect(JSON.stringify(state)).not.toContain("018f1000");
		expect(JSON.stringify(state)).not.toContain("customerStatus");
	});

	it("reports a replay as a replay", async () => {
		submitContactToPayload.mockResolvedValue(accepted({ duplicate: true }));
		const state = await submit(form());
		expect(state.status === "received" && state.acknowledgement.duplicate).toBe(true);
	});
});

describe("failures are classified, not guessed", () => {
	it.each([
		["SUBMISSION_ID_CONFLICT", 409, "conflict"],
		["BODY_TOO_LARGE", 413, "tooLarge"],
		["INVALID_REQUEST", 400, "unavailable"],
	])("%s becomes %s", async (code, httpStatus, kind) => {
		submitContactToPayload.mockResolvedValue({ status: "rejected", httpStatus, code });
		const state = await submit(form());
		expect(state.status).toBe("failed");
		expect(state.status === "failed" && state.kind).toBe(kind);
	});

	// A timeout says the answer did not arrive. It does not say nothing was stored, so
	// the UI must not tell the customer to start again — the retry reuses the same id.
	it("a timeout is unavailable, not a confirmed non-delivery", async () => {
		submitContactToPayload.mockResolvedValue({ status: "unavailable", reason: "timeout after 8000ms" });
		const state = await submit(form());
		expect(state.status === "failed" && state.kind).toBe("unavailable");
	});

	it("missing settings are distinct from a transient failure", async () => {
		submitContactToPayload.mockResolvedValue({
			status: "notConfigured",
			missing: ["MAKY_FORMS_HMAC_SECRET"],
		});
		const state = await submit(form());
		expect(state.status === "failed" && state.kind).toBe("notConfigured");
		// The missing variable NAMES must not reach the browser.
		expect(JSON.stringify(state)).not.toContain("HMAC");
	});
});

describe("invalid input never reaches the provider", () => {
	it("returns field errors and files nothing", async () => {
		const state = await submit(form({ email: "nope", message: "" }));
		expect(state.status).toBe("invalid");
		expect(submitContactToPayload).not.toHaveBeenCalled();
	});
});
