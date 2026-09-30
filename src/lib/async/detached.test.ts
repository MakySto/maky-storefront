import { AsyncLocalStorage } from "node:async_hooks";

import { afterEach, describe, expect, it } from "vitest";

import { __forgetRootContext, captureRootContext, hasRootContext, runDetached } from "./detached";

/**
 * `runDetached` exists for one property: work started from inside a render must not be able
 * to see that render. Next's patched `fetch`, `Date` and `Math.random` all find the render
 * through `AsyncLocalStorage`, so "cannot see the store" is the whole contract — and it has
 * to hold after an `await` and inside a timer, because that is where background work lives.
 */

afterEach(() => {
	__forgetRootContext();
});

describe("runDetached", () => {
	it("leaves every store of the caller behind, including across awaits and timers", async () => {
		const work = new AsyncLocalStorage<string>(); // stands in for Next's work store
		const unit = new AsyncLocalStorage<string>(); // and for its work-unit store
		captureRootContext(); // at boot, with no request in flight

		const seen: Record<string, [string | undefined, string | undefined]> = {};
		await work.run("route /[channel]", () =>
			unit.run("prerender", async () => {
				seen.caller = [work.getStore(), unit.getStore()];
				await runDetached(async () => {
					seen.detached = [work.getStore(), unit.getStore()];
					await new Promise((resolve) => setTimeout(resolve, 1));
					seen.afterTimer = [work.getStore(), unit.getStore()];
				});
				seen.callerAgain = [work.getStore(), unit.getStore()];
			}),
		);

		expect(seen.caller).toEqual(["route /[channel]", "prerender"]);
		expect(seen.detached).toEqual([undefined, undefined]);
		expect(seen.afterTimer).toEqual([undefined, undefined]);
		// The caller's own context is untouched by having detached something.
		expect(seen.callerAgain).toEqual(["route /[channel]", "prerender"]);
	});

	it("reaches stores created after the capture too", () => {
		captureRootContext();
		const late = new AsyncLocalStorage<string>();
		const inside = late.run("render", () => runDetached(() => late.getStore()));
		expect(inside).toBeUndefined();
	});

	it("keeps the first capture: a later call from inside a request cannot replace it", () => {
		const render = new AsyncLocalStorage<string>();
		captureRootContext();
		render.run("a request", () => captureRootContext());

		const seen = render.run("another request", () => runDetached(() => render.getStore()));
		expect(seen).toBeUndefined();
	});

	it("runs in place when nothing was captured — tests and scripts have no render to leave", () => {
		const render = new AsyncLocalStorage<string>();
		expect(hasRootContext()).toBe(false);
		const seen = render.run("render", () => runDetached(() => render.getStore()));
		expect(seen).toBe("render");
	});

	it("returns what the function returns", async () => {
		captureRootContext();
		expect(runDetached(() => 42)).toBe(42);
		await expect(runDetached(async () => "later")).resolves.toBe("later");
	});
});
