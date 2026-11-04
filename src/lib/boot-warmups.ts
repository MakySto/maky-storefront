/**
 * The two warm-ups a production server runs in the background after it starts, ONE AFTER THE OTHER:
 * the makers' counts first, then the sitemap's product lists (why they do not run side by side is
 * written at the call in `src/instrumentation.ts`).
 *
 * Its own module, and not a closure in `register()`, so that the chain has a name and a handle: a test
 * that starts it must be able to wait until it has finished, and cannot do that by guessing how many
 * ticks a dynamic import takes. A chain left running at the end of one test calls its mocks in the next.
 */

const running = new Set<Promise<void>>();

/**
 * Starts the chain and returns at once. The chain never rejects: each warm-up is cut off from the other
 * (one failing or switched off does not stop the next), and a warm-up that cannot even load must not
 * stop the start, so the import is inside the chain on purpose.
 */
export function startBootWarmups({
	brands,
	sitemap,
}: {
	readonly brands: boolean;
	readonly sitemap: boolean;
}): void {
	const chain = (async () => {
		if (brands) {
			await import("./brands/catalog")
				.then(({ prewarmBrandMakers }) => prewarmBrandMakers())
				.catch((error: unknown) => {
					console.warn("[brands] warm-up failed:", error instanceof Error ? error.message : error);
				});
		}
		if (sitemap) {
			await import("./seo/product-walk")
				.then(({ prewarmProductWalks }) => prewarmProductWalks())
				.catch((error: unknown) => {
					console.warn("[sitemap] warm-up failed:", error instanceof Error ? error.message : error);
				});
		}
	})();
	running.add(chain);
	void chain.finally(() => running.delete(chain));
}

/** For tests: resolves when every chain started so far has run to its end. */
export async function __bootWarmupsSettled(): Promise<void> {
	await Promise.all([...running]);
}
