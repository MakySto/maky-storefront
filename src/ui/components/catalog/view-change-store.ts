/**
 * How many view changes of a vehicle page are under way, for `offer-view-navigation.tsx`.
 *
 * Kept apart from the components so that it can be tested without a browser: the rule that matters
 * is that the page is busy from the first change that starts until the last one that ends, in
 * whatever order they end, and that everything listening hears both.
 */
let underWay = 0;
const listeners = new Set<() => void>();

function announce(): void {
	for (const listener of listeners) listener();
}

export function subscribeToViewChanges(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function isViewChangeUnderWay(): boolean {
	return underWay > 0;
}

/** Counts one change as under way until the returned function is called. Calling it twice ends it once. */
export function holdViewChange(): () => void {
	let held = true;
	underWay += 1;
	announce();
	return () => {
		if (!held) return;
		held = false;
		underWay -= 1;
		announce();
	};
}
