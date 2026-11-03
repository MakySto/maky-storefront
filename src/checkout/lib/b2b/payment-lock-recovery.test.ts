import { describe, expect, it } from "vitest";

import type { B2bPaymentLockResult } from "./b2b-view";
import {
	afterPaymentLockRead,
	afterPaymentLockRelease,
	ATTEMPT_RETRY_DELAYS_MS,
	ATTEMPT_WAIT_MS,
	CANCEL_POLL_DELAYS_MS,
	CANCEL_WAIT_MS,
	INITIAL_PAYMENT_LOCK_STATE,
	isPaymentLockBusy,
	startPaymentLockRelease,
	type PaymentLockRecoveryState,
	type PaymentLockStep,
} from "./payment-lock-recovery";

/**
 * Contract MAKY-B2B-V1 revision 2, §5 "Obnova po začatej platbe", and Marek's points for the storefront: a change only
 * after the backend's `paymentLocked: false`, `PAYMENT_HAS_FUNDS` never offers one, the waits are bounded and end in
 * the next steps, nothing refunds or starts anything by itself.
 */

const release = (
	status: "RELEASED" | "CANCELATION_REQUESTED" | "ATTEMPT_BEING_CREATED" | "PAYMENT_HAS_FUNDS",
	paymentLocked: boolean | null,
): B2bPaymentLockResult => ({ kind: "release", status, paymentLocked, cause: `release-${status}` });
const read = (paymentLocked: boolean): B2bPaymentLockResult => ({
	kind: "state",
	paymentLocked,
	cause: paymentLocked ? "still-locked" : "unlocked",
});
const failed: B2bPaymentLockResult = { kind: "failed", cause: "release-network" };
const unavailable: B2bPaymentLockResult = { kind: "unavailable", cause: "not-ready" };

/** Feeds one answer per effect, the way the component runs the machine; returns the steps it went through. */
function drive(answers: B2bPaymentLockResult[]): PaymentLockStep[] {
	const steps: PaymentLockStep[] = [startPaymentLockRelease()];
	for (const answer of answers) {
		const last = steps[steps.length - 1]!;
		if (last.effect.kind === "none") throw new Error(`an answer after the end (${last.state.phase})`);
		steps.push(
			last.effect.kind === "release"
				? afterPaymentLockRelease(last.state, answer)
				: afterPaymentLockRead(last.state, answer),
		);
	}
	return steps;
}

const phases = (steps: PaymentLockStep[]) => steps.map((step) => step.state.phase);
const end = (steps: PaymentLockStep[]) => steps[steps.length - 1]!;

describe("payment lock recovery", () => {
	it("starts on the lock with nothing asked, and the button asks once, at once", () => {
		expect(INITIAL_PAYMENT_LOCK_STATE).toEqual({ phase: "locked", tries: 0 });
		expect(startPaymentLockRelease()).toEqual({
			state: { phase: "releasing", tries: 0 },
			effect: { kind: "release", afterMs: 0 },
		});
	});

	it("RELEASED with the lock gone: the change is offered, nothing more is asked", () => {
		const steps = drive([release("RELEASED", false)]);
		expect(phases(steps)).toEqual(["releasing", "released"]);
		expect(end(steps).effect).toEqual({ kind: "none" });
	});

	it("RELEASED without the backend saying the lock is gone: the lock is read until it does", () => {
		for (const said of [true, null]) {
			const steps = drive([release("RELEASED", said), read(false)]);
			expect(phases(steps)).toEqual(["releasing", "waitingCancel", "released"]);
		}
	});

	it("CANCELATION_REQUESTED (scenario 6, the declined card): waits for paymentLocked false, then offers the change", () => {
		const steps = drive([release("CANCELATION_REQUESTED", true), read(true), read(true), read(false)]);
		expect(phases(steps)).toEqual([
			"releasing",
			"waitingCancel",
			"waitingCancel",
			"waitingCancel",
			"released",
		]);
		// The first read a second after the request, as the contract suggests.
		expect(steps[1]!.effect).toEqual({ kind: "read", afterMs: 1000 });
	});

	it("CANCELATION_REQUESTED whose own answer already says the lock is gone: released at once", () => {
		expect(phases(drive([release("CANCELATION_REQUESTED", false)]))).toEqual(["releasing", "released"]);
	});

	it("the wait for the cancelation is bounded (about 30 s) and ends in the next steps, not in a change", () => {
		const stillLocked = CANCEL_POLL_DELAYS_MS.map(() => read(true));
		const steps = drive([release("CANCELATION_REQUESTED", true), ...stillLocked]);
		expect(end(steps)).toEqual({ state: { phase: "notConfirmed", tries: 0 }, effect: { kind: "none" } });
		expect(steps.filter((step) => step.effect.kind === "read")).toHaveLength(CANCEL_POLL_DELAYS_MS.length);
		expect(steps.some((step) => step.state.phase === "released")).toBe(false);
		expect(CANCEL_WAIT_MS).toBe(30_000);
	});

	it("a read that gets no answer does not end the wait, nor open the change", () => {
		const steps = drive([release("CANCELATION_REQUESTED", true), failed, failed, read(false)]);
		expect(phases(steps)).toEqual([
			"releasing",
			"waitingCancel",
			"waitingCancel",
			"waitingCancel",
			"released",
		]);
	});

	it("a read the process no longer offers stops asking and offers the next steps", () => {
		expect(phases(drive([release("CANCELATION_REQUESTED", true), unavailable]))).toEqual([
			"releasing",
			"waitingCancel",
			"notConfirmed",
		]);
	});

	it("ATTEMPT_BEING_CREATED: the release is asked again a few seconds later, then follows what it says", () => {
		const steps = drive([
			release("ATTEMPT_BEING_CREATED", true),
			release("ATTEMPT_BEING_CREATED", true),
			release("CANCELATION_REQUESTED", true),
			read(false),
		]);
		expect(phases(steps)).toEqual([
			"releasing",
			"waitingAttempt",
			"waitingAttempt",
			"waitingCancel",
			"released",
		]);
		expect(steps[1]!.effect).toEqual({ kind: "release", afterMs: ATTEMPT_RETRY_DELAYS_MS[0] });
		expect(steps[2]!.effect).toEqual({ kind: "release", afterMs: ATTEMPT_RETRY_DELAYS_MS[1] });
	});

	it("ATTEMPT_BEING_CREATED for good: bounded (about 30 s), then the next steps", () => {
		const steps = drive(
			ATTEMPT_RETRY_DELAYS_MS.map(() => release("ATTEMPT_BEING_CREATED", true)).concat([
				release("ATTEMPT_BEING_CREATED", true),
			]),
		);
		expect(end(steps).state.phase).toBe("notConfirmed");
		expect(steps.filter((step) => step.effect.kind === "release")).toHaveLength(
			ATTEMPT_RETRY_DELAYS_MS.length + 1,
		);
		expect(ATTEMPT_WAIT_MS).toBe(30_000);
	});

	it("ATTEMPT_BEING_CREATED that turns out to hold money: no change is offered", () => {
		expect(
			phases(drive([release("ATTEMPT_BEING_CREATED", true), release("PAYMENT_HAS_FUNDS", true)])),
		).toEqual(["releasing", "waitingAttempt", "funds"]);
	});

	it("a lost answer while a payment is being set up keeps asking within the same window", () => {
		expect(
			phases(drive([release("ATTEMPT_BEING_CREATED", true), failed, release("RELEASED", false)])),
		).toEqual(["releasing", "waitingAttempt", "waitingAttempt", "released"]);
	});

	it("PAYMENT_HAS_FUNDS: the order is finished on the original offer, whatever else the answer says", () => {
		for (const said of [true, false, null]) {
			const steps = drive([release("PAYMENT_HAS_FUNDS", said)]);
			expect(end(steps)).toEqual({ state: { phase: "funds", tries: 0 }, effect: { kind: "none" } });
		}
	});

	it("ATTEMPT_BEING_CREATED never counts as released, even beside paymentLocked false", () => {
		const steps = drive([release("ATTEMPT_BEING_CREATED", false)]);
		expect(end(steps).state.phase).toBe("waitingAttempt");
	});

	it("no usable answer to the first request, or a process that does not offer it: said, nothing more is asked", () => {
		expect(end(drive([failed]))).toEqual({ state: { phase: "failed", tries: 0 }, effect: { kind: "none" } });
		expect(end(drive([unavailable]))).toEqual({
			state: { phase: "unavailable", tries: 0 },
			effect: { kind: "none" },
		});
	});

	it("an answer for a wait that is over changes nothing", () => {
		const released: PaymentLockRecoveryState = { phase: "released", tries: 0 };
		expect(afterPaymentLockRead(released, read(true))).toEqual({ state: released, effect: { kind: "none" } });
	});

	it("the customer waits only while a question is out", () => {
		expect(
			["releasing", "waitingCancel", "waitingAttempt"].every((phase) => isPaymentLockBusy(phase as never)),
		).toBe(true);
		expect(
			["locked", "released", "funds", "notConfirmed", "unavailable", "failed"].some((phase) =>
				isPaymentLockBusy(phase as never),
			),
		).toBe(false);
	});

	it("only a release or a read is ever asked for: nothing refunds, and no new cart or payment is started", () => {
		const effects = new Set<string>();
		const walk = (answers: B2bPaymentLockResult[]) =>
			drive(answers).forEach((step) => effects.add(step.effect.kind));
		walk([release("CANCELATION_REQUESTED", true), read(true), read(false)]);
		walk([release("ATTEMPT_BEING_CREATED", true), release("PAYMENT_HAS_FUNDS", true)]);
		walk([release("RELEASED", false)]);
		walk([failed]);
		expect([...effects].sort()).toEqual(["none", "read", "release"]);
	});
});
