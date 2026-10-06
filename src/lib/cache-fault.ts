import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";

/**
 * Handing an upstream fault out of a `"use cache"` function: as a value, never as a throw.
 *
 * ## What a throw costs
 *
 * Every cached reader here used to THROW on a fault, for a sound reason: Next stores a value and
 * does not store a rejection, so an outage was never remembered as "no photos", "no brands" or
 * "this product does not exist". Every caller caught the error and rendered the page without that
 * part.
 *
 * What the pattern missed is what Next does with a throw while it PRERENDERS a page. The error is
 * reported the moment the cache function throws (it is the `⨯ Error: …` line in the log) and goes on
 * a list that Next reads again once the page is rendered: anything on it fails the prerender, whether
 * or not the caller caught it (`renderToHTMLOrFlight`, the check on `digestErrorsMap`). A page is
 * prerendered when it is built, when it is requested and has no stored shell yet (every product URL
 * in a market nobody has visited), when its shell is past its `expire`, and when `/api/revalidate`
 * has expired one of its tags. In all four the visitor is waiting for the result, so ONE optional
 * reader failing — the scenery photos, the brand strip, a price filter — was a 500 for them, on a
 * page that could have been shown without it. Reproduced on a production build with a fake Saleor
 * and a fake CMS, one failing operation at a time.
 *
 * ## What a reader does instead
 *
 * The cached function returns what it found as a `CachedRead`: `answered(value)`, or
 * `faulted(message)` for a fault. The exported reader wraps it in `valueOrThrow`, OUTSIDE the cache,
 * so its callers keep exactly the contract they had — it resolves, or it throws and they catch —
 * and an error thrown there never crosses the cache boundary, so Next never sees it.
 *
 *     async function readThing(id: string): Promise<CachedRead<Thing>> {
 *       "use cache";
 *       cacheLife("hours");
 *       const result = await fetchThing(id);
 *       if (!result.ok) return faulted(`[Thing] unavailable: ${result.error.message}`);
 *       return answered(result.data);
 *     }
 *
 *     export async function getThing(id: string): Promise<Thing> {
 *       return valueOrThrow(await readThing(id));
 *     }
 *
 * ## A fault is remembered for seconds, not for the entry's life
 *
 * The entry would otherwise keep the lifetime of the reader (`hours`), and an outage would be shown
 * for hours. `faulted` gives it `FAULT_CACHE_LIFE` instead: fresh for 5 seconds, so a prerender
 * that comes after them asks again (a stale entry is a miss when Next prerenders), and the page's
 * shell, which lives as long as its shortest entry, is regenerated with it. That is as close to
 * "never remembered" as a value can be: the page is what it was with a throw, minus the 500, and it
 * is whole again on the first view after the upstream is.
 *
 * The profile cannot be shorter. Next keeps an entry out of the static shell when its `expire` is
 * under 300 s (`MIN_PRERENDERABLE_EXPIRE`) or its `revalidate` is 0; the entry is then a dynamic
 * hole, and a hole outside `<Suspense>` fails the prerender just as a throw does. `stale` has the
 * same 300 s floor (`MIN_SHELL_STALE`). So 300 s it is for both, and `revalidate` carries the
 * brevity.
 *
 * Nothing inside a `"use cache"` function may `throw`: `cache-fault.guard.test.ts` reads the source
 * and fails on it.
 */
export type CachedRead<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly message: string };

/**
 * How long a cached fault is remembered. `revalidate` is the point: 5 s, then a prerender asks
 * again. `stale` and `expire` are Next's floors for an entry that may sit in a static shell (300 s
 * each); anything lower makes the entry dynamic. `cacheLife` keeps the lowest value of each field
 * over all its calls, so a reader that asked for `hours` and meets a fault ends up with these.
 */
export const FAULT_CACHE_LIFE = { stale: 300, revalidate: 5, expire: 300 } as const;

export function answered<T>(value: T): CachedRead<T> {
	return { ok: true, value };
}

/**
 * Shortens the entry being filled to the fault lifetime. Only inside a `"use cache"` function.
 * `faulted` does it for you; call it directly when the fault travels in the reader's own result
 * type, as the `upstream-error` outcome of `@/lib/saleor/resource-outcome` does.
 */
export function rememberBriefly(): void {
	cacheLife(FAULT_CACHE_LIFE);
}

/** An upstream fault as a value, remembered for seconds. Only inside a `"use cache"` function. */
export function faulted(message: string): CachedRead<never> {
	rememberBriefly();
	return { ok: false, message };
}

/** Outside the cache: the value, or the fault thrown the way the reader always threw it. */
export function valueOrThrow<T>(read: CachedRead<T>): T {
	if (!read.ok) throw new Error(read.message);
	return read.value;
}

/**
 * For a reader whose body throws deep inside, in code that is not worth rewriting into returns:
 * run it here, inside the cache function, and take what it threw as the fault. Next's own control
 * flow — `notFound()`, a redirect, a prerender being interrupted — is not a fault and passes through.
 */
export async function settle<T>(read: () => Promise<T>): Promise<CachedRead<T>> {
	try {
		return answered(await read());
	} catch (error) {
		unstable_rethrow(error);
		return faulted(error instanceof Error ? error.message : String(error));
	}
}
