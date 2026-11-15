/**
 * What this process asks Saleor, one line a minute, in the PM2 out log.
 *
 * It exists because of 2026-11-15: Saleor's own log showed 300 to 400 requests a minute from the storefront
 * and up to 1 329 in a burst, while the storefront's own nginx saw 80 to 115 requests a minute, 800 to 1 150
 * per ten minutes. Three to ten Saleor requests behind every page view, and no way to say WHICH, because
 * Saleor's nginx logs one path (`/graphql/`) and the storefront logged nothing about the requests it sent.
 * The line says which operation, how many, and how long each took, so the next burst is a measurement.
 *
 * Counted per wire attempt (a retry is a request too), by the operation's name, in numbers only: nothing
 * here reads a variable, a slug, a token or a response. State lives on `globalThis`, because the pages and
 * the route handlers are separate module graphs (`@/lib/async/detached`) and each sends requests of its own.
 */

interface Entry {
	count: number;
	failed: number;
	slow: number;
	totalMs: number;
}

const TRAFFIC = Symbol.for("maky.saleor-traffic");
const scope = globalThis as typeof globalThis & { [TRAFFIC]?: Map<string, Entry> };
const table = (): Map<string, Entry> => (scope[TRAFFIC] ??= new Map());

/** A request slower than this counts as slow in the line. */
const SLOW_MS = 2_000;
/** Operations listed in a line, most requested first; the rest are summed. */
const LISTED = 12;

/** One request that went to Saleor and came back (or did not). Cheap, and it never throws. */
export function recordSaleorWire(operation: string, ms: number, ok: boolean): void {
	try {
		const map = table();
		let entry = map.get(operation);
		if (!entry) {
			// Bounded: an operation name is a literal in a document, never a visitor's input, but a bug must not grow this.
			if (map.size >= 200) return;
			entry = { count: 0, failed: 0, slow: 0, totalMs: 0 };
			map.set(operation, entry);
		}
		entry.count += 1;
		entry.totalMs += ms;
		if (!ok) entry.failed += 1;
		if (ms >= SLOW_MS) entry.slow += 1;
	} catch {
		// A counter must never break a request.
	}
}

/** What was recorded since the last call, and the table emptied. */
export function takeSaleorTraffic(): Map<string, Entry> {
	const taken = new Map(table());
	table().clear();
	return taken;
}

export function formatTrafficLine(taken: Map<string, Entry>, at: Date, seconds: number): string | null {
	let total = 0;
	let failed = 0;
	let slow = 0;
	for (const entry of taken.values()) {
		total += entry.count;
		failed += entry.failed;
		slow += entry.slow;
	}
	if (total === 0) return null;
	const ranked = [...taken.entries()].sort((a, b) => b[1].count - a[1].count);
	const listed = ranked
		.slice(0, LISTED)
		.map(
			([name, e]) =>
				`${name}=${e.count}(avg ${Math.round(e.totalMs / e.count)}ms${e.slow ? `, ${e.slow} slow` : ""}${
					e.failed ? `, ${e.failed} failed` : ""
				})`,
		);
	const rest = ranked.slice(LISTED).reduce((sum, [, e]) => sum + e.count, 0);
	return (
		`[saleor-traffic] t=${at.toISOString()} window=${seconds}s total=${total} failed=${failed} slow=${slow}` +
		` | ${listed.join(" ")}${rest ? ` | other=${rest}` : ""}`
	);
}

let stopRunning: (() => void) | undefined;

/** One line every `seconds` while there was traffic; one timer however often it is started. */
export function startSaleorTrafficLog(
	seconds: number,
	log: (line: string) => void = (line) => console.log(line),
): () => void {
	if (stopRunning) return stopRunning;
	const emit = (): void => {
		try {
			const line = formatTrafficLine(takeSaleorTraffic(), new Date(), seconds);
			if (line) log(line);
		} catch {
			// Nothing to do about it here, and nothing it may break.
		}
	};
	const timer = setInterval(emit, seconds * 1000);
	timer.unref();
	stopRunning = () => {
		clearInterval(timer);
		stopRunning = undefined;
	};
	return stopRunning;
}
