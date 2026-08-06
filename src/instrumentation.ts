/**
 * Runs once when the server process starts.
 *
 * Its only job today is to make the market configuration visible. `MAKY_LIVE_MARKETS`
 * decides which markets Google may index, and a silent misreading of it is the kind
 * of thing nobody notices until a market is either missing from search results or in
 * them too early. So the resolved split is printed at boot, in a single line the
 * deploy script reads back to check that what is running is what was asked for.
 *
 * An unknown token is reported as an error rather than a warning, but it does not
 * abort the boot: `liveMarkets()` already degrades safely (unknown names dropped, an
 * empty result falling back to the default), and a typo in an env var should not be
 * able to take the site down. Making it visible is the deploy script's job, and it
 * treats this line as a post-deploy check — exit 75, not a rollback.
 */
export async function register(): Promise<void> {
	// Guard the runtime: `register` also runs in the edge runtime, where this is
	// neither useful nor guaranteed to see the same env.
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	const { describeMarketState } = await import("./lib/market-state");
	const { live, preview, unknown } = describeMarketState();

	console.log(
		`[market-state] live=${live.join(",")} preview=${preview.join(",")} unknown=${unknown.join(",")}`,
	);

	// The 404 gate decides HTTP statuses from an upstream lookup, so which markets
	// and families it is armed for has to be visible at a glance rather than
	// reconstructed from three env vars during an incident.
	const { describeGate } = await import("./lib/route-existence");
	const gate = describeGate();
	console.log(
		`[route-existence] gate=${gate.enabled ? "on" : "off"} markets=${gate.markets.join(",")} ` +
			`families=${gate.families.join(",")}`,
	);

	if (unknown.length > 0) {
		console.error(
			`[market-state] MAKY_LIVE_MARKETS contains ${unknown.length} name(s) that are not markets: ` +
				`${unknown.join(", ")}. They were ignored. Fix the env var — the live set in use is ` +
				`${live.join(",")}.`,
		);
	}
}
