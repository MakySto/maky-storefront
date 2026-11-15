import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * Where the finished feeds are, and what they are called.
 *
 * The writer (`scripts/ops/merchant-feed.mjs`, a timer on the web server) puts one file per market into
 * this directory, and `/feeds/<name>` serves exactly those names and nothing else from it. The directory
 * is systemd's state directory of the timer's unit; `MAKY_FEED_DIR` moves it (a sandbox, a test).
 */
export const DEFAULT_FEED_DIR = "/var/lib/maky-feeds";

export function feedDirectory(): string {
	return process.env.MAKY_FEED_DIR?.trim() || DEFAULT_FEED_DIR;
}

const FEED_FILE = /^google-([a-z]{2})\.xml\.gz$/;

/** The market a public feed name belongs to, or `null` for anything that is not a feed of a known market. */
export function marketOfFeedFile(name: string): string | null {
	const market = FEED_FILE.exec(name)?.[1];
	return market && CHANNEL_MAP[market] ? market : null;
}

export function feedFileName(market: string): string {
	return `google-${market}.xml.gz`;
}
