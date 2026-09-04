/**
 * Runs once when the server process starts.
 *
 * Its job is to make the settings that fail SILENTLY visible. Each one below is
 * decided by the environment, changes nothing observable from the outside when it is
 * wrong, and is only noticed once the damage is done — so each prints its resolved
 * state at boot, in a single line the deploy script reads back to check that what is
 * running is what was asked for.
 *
 * `MAKY_LIVE_MARKETS` decides which markets Google may index; a misreading shows up
 * as a market missing from search results, or in them too early. The withdrawal line
 * covers the § 20a online function, where the quiet failure is a form that is offered
 * with no transport behind it.
 *
 * Names, verdicts and counts only. No line here prints a value it read, and the
 * helpers it calls are written to return names rather than settings for that reason.
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

	// Same read-back for the § 20a online function. It has two independent
	// preconditions and each one fails quietly on its own: the interlock decides
	// whether the form is OFFERED, the four transport settings decide whether a
	// submitted notice can be STORED. A build with the interlock on and the
	// transport unconfigured renders a working-looking form that refuses every
	// submission — the one combination nobody would notice from the outside, on
	// the one page where a customer is exercising a statutory right.
	//
	// Names only, never values. `missingFormsSettings()` exists precisely so that
	// nothing here is ever tempted to print the Cloudflare Access pair or the HMAC
	// secret, and `transport=` reports readiness rather than what it read.
	const { isWithdrawalFormServable, withdrawalBlockReason } = await import("./lib/withdrawal/contract");
	const { missingFormsSettings } = await import("./lib/forms/env");

	const servable = isWithdrawalFormServable();
	const missing = missingFormsSettings();
	console.log(
		`[withdrawal] form=${servable ? "on" : "off"} ` +
			`transport=${missing.length === 0 ? "configured" : "incomplete"} ` +
			`missing=${missing.join(",")}`,
	);

	if (!servable) {
		console.warn(`[withdrawal] online-function-off — ${withdrawalBlockReason()}`);
	} else if (missing.length > 0) {
		console.error(
			`[withdrawal] the form is being offered but the forms transport is not configured: ` +
				`${missing.join(", ")} unset. Every submission will fail closed and tell the customer ` +
				`the notice was not recorded. Set them in the runtime environment and restart.`,
		);
	}

	if (unknown.length > 0) {
		console.error(
			`[market-state] MAKY_LIVE_MARKETS contains ${unknown.length} name(s) that are not markets: ` +
				`${unknown.join(", ")}. They were ignored. Fix the env var — the live set in use is ` +
				`${live.join(",")}.`,
		);
	}
}
