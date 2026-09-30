import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Running work outside whatever request happens to be rendering right now.
 *
 * ## Why this exists
 *
 * Next finds out what a render is doing through `AsyncLocalStorage`: its patched `fetch`,
 * its `Date`, its `Math.random` all ask "which render am I in?" and behave accordingly. That
 * context follows every promise, timer and callback created inside the render — including
 * work the render merely STARTED and never awaited. A background refresh kicked off from a
 * page therefore still counts as that page's work:
 *
 *   - during a prerender its `fetch` holds the prerender's cache signal open and adds its
 *     tags and its `revalidate` to the page's shell; a `fetch` with no cache setting of its
 *     own is handed a promise that never settles;
 *   - reading the clock inside it can abort the prerender outright, which is how
 *     `expiring-memo.ts` came to exist.
 *
 * Verified against next@16.3.6: `server/lib/patch-fetch.js` reads both stores on every call,
 * and `server/node-environment-extensions/io-utils.js` aborts a running prerender on
 * `Date.now()`.
 *
 * `after()` does not help: it binds its callback to the same context on purpose
 * (`AfterContext.addCallback` → `bindSnapshot`), and it throws outside a request scope.
 *
 * ## How
 *
 * `AsyncLocalStorage.snapshot()` captures the context that is active when it is called and
 * returns a runner that executes a function inside THAT context — every store as it was then,
 * for every `AsyncLocalStorage` in the process, Next's included. Captured once at boot, before
 * any request exists, it is a context with no render in it; `runDetached` runs a function
 * there, and everything the function schedules inherits it.
 *
 * `src/instrumentation.ts` captures it, because `next start` finishes `register()` before it
 * serves a single request. The runner lives on `globalThis`: the page bundles, the route
 * handlers and the instrumentation bundle are separate module graphs, and they must all
 * find the same one.
 *
 * Without a captured context — tests, scripts, a server that never ran `register()` —
 * `runDetached` calls the function in place, which is exactly right where there is no render
 * to escape from.
 */

type Runner = <R>(fn: () => R) => R;

const ROOT_RUNNER = Symbol.for("maky.async.root-runner");

type WithRunner = typeof globalThis & { [ROOT_RUNNER]?: Runner };

/**
 * Capture the current context as the one detached work runs in.
 *
 * Call it where no request is being handled — `register()`. The first capture wins, so a
 * later call from inside a request cannot replace a clean context with a dirty one.
 */
export function captureRootContext(): void {
	const scope = globalThis as WithRunner;
	scope[ROOT_RUNNER] ??= AsyncLocalStorage.snapshot() as Runner;
}

/** Whether `runDetached` will actually leave the caller's context. For diagnostics. */
export function hasRootContext(): boolean {
	return (globalThis as WithRunner)[ROOT_RUNNER] !== undefined;
}

/** Run `fn` in the context captured at boot, or in place when none was captured. */
export function runDetached<R>(fn: () => R): R {
	const runner = (globalThis as WithRunner)[ROOT_RUNNER];
	return runner ? runner(fn) : fn();
}

/** For tests only: forget the captured context. */
export function __forgetRootContext(): void {
	delete (globalThis as WithRunner)[ROOT_RUNNER];
}
