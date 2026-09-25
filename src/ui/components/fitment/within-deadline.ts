/**
 * The promise's value, or `undefined` once `ms` have passed — whichever comes first.
 *
 * For the places where a compatibility answer must arrive WITH the part of the page it sits in,
 * or not at all: the product page's box above the price, and the cart's line badges. Streaming
 * them in late moved the price and the "Do košíka" button under the shopper's thumb (measured
 * 2026-09-25: after the fitment memo expires, the price arrived at ~60 ms and the box ~280 ms
 * later). Waiting without a limit would tie the purchase to the fitment provider instead. So the
 * page waits a little, and past the limit it says nothing this time.
 *
 * The promise is not cancelled: a load that misses the deadline still lands in the provider's
 * memo, and the next page view has its answer.
 */
export function withinDeadline<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => resolve(undefined), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}
