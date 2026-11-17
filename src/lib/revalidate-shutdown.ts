import { flushStatsOnShutdown } from "@/lib/revalidate-stats";
import { pendingThrottledKeys } from "@/lib/revalidate-throttle";

/**
 * What `/api/revalidate` can still do when the process is told to stop (PM2 stops it at every deploy and
 * restart): write down what it counted, and say what it is leaving undone.
 *
 * Saleor's condition for the revalidation to be switched on is that every notice answered 200 is also
 * processed. The market-wide work of a notice (lists, categories, offers, homepage, sitemap data) is held
 * by the throttle for up to five minutes in a batch, so at a stop some of it is owed. It is NOT run here:
 * `revalidateTag` and `revalidatePath` work only inside a request's store (called from a signal handler
 * they throw), and almost everything they would expire (Next's in-memory page and `"use cache"` stores, its
 * tag manifest, what the process keeps under `kept-read`, the sitemap snapshots) is held in THIS process's
 * memory and goes with it. The next process starts without any of it and renders those entries fresh on
 * their first visit, which is what the owed work would have asked for. The one thing on disk is the build's
 * own prerendered pages (`cache-handler.mjs` writes nothing else): after a DEPLOY they are the new build's,
 * after a plain restart of the same build they are the ones the old process left, and live to their own
 * lifetime, exactly as they would have had the owed work never been submitted (a tag manifest that is
 * empty after a restart expires nothing on disk either). What is lost for certain is the count, so this
 * writes the window in progress (the minute timer would take it with the process: 81 requests between 16
 * and 17 November) and names how many keys were owed.
 *
 * Not covered: SIGKILL (PM2 sends it after `kill_timeout`, 1.6 s by default, to a process that has not
 * left) and a crash, which lose the minute in progress and the log of the owed keys.
 */
export function onRevalidateShutdown(now: number = Date.now()): void {
	flushStatsOnShutdown(now);
	const owed = pendingThrottledKeys();
	if (owed.length > 0) {
		console.log(
			`[revalidate-events] stopping with throttled work owed for ${owed.length} key(s); not run: ` +
				`what it would expire is held in this process's memory and goes with it`,
		);
	}
}

const INSTALLED = Symbol.for("maky.revalidate-shutdown");

/**
 * Hooks the signals Next itself ends the process on. Next's own handler (`start-server`) exits after it has
 * closed the server, so this one is synchronous and does not exit. Where Next's handlers are switched off
 * (`NEXT_MANUAL_SIG_HANDLE`) nothing would end the process after ours, so it stays out. And whenever ours turns
 * out to be the only listener (a test worker, a process that is not `next start`), a listener has taken away
 * the default of dying on the signal, so it gives the default back and sends the signal again.
 */
export function installRevalidateShutdown(target: NodeJS.Process = process): boolean {
	const holder = target as unknown as Record<symbol, boolean | undefined>;
	if (holder[INSTALLED] || target.env.NEXT_MANUAL_SIG_HANDLE) return false;
	holder[INSTALLED] = true;
	for (const signal of ["SIGTERM", "SIGINT"] as const) {
		const handler = () => {
			try {
				onRevalidateShutdown();
			} catch (error) {
				console.error("[revalidate-events] could not write the window at stop:", error);
			}
			if (target.listenerCount(signal) === 1) {
				target.removeListener(signal, handler);
				target.kill(target.pid, signal);
			}
		};
		target.on(signal, handler);
	}
	return true;
}
