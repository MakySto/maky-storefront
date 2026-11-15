import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { connection } from "next/server";

import { feedDirectory, feedFileName, marketOfFeedFile } from "@/lib/merchant-feed/files";

/**
 * `/feeds/google-<market>.xml.gz`: the product feed Google Merchant Center fetches, one per market.
 *
 * The file is written by the timer on the web server (`scripts/ops/merchant-feed.mjs`); this route only
 * hands it out. It serves the names of known markets and nothing else, built here and never taken from
 * the URL, so no path can leave the feed directory. A market whose feed has not been written is a real
 * 404, never an empty feed: an empty feed tells Merchant Center that every product is gone.
 *
 * `noindex`: a feed is for Merchant Center, not a page for a search result.
 */
const NOT_FOUND = { status: 404, headers: { "x-robots-tag": "noindex" } } as const;

export async function GET(
	_request: Request,
	context: { params: Promise<{ file: string }> },
): Promise<Response> {
	await connection();
	const { file } = await context.params;
	const market = marketOfFeedFile(file);
	if (!market) return new Response("Not Found", NOT_FOUND);

	const path = join(feedDirectory(), feedFileName(market));
	let size: number;
	let modified: Date;
	try {
		const info = await stat(path);
		if (!info.isFile() || info.size === 0) return new Response("Not Found", NOT_FOUND);
		size = info.size;
		modified = info.mtime;
	} catch {
		return new Response("Not Found", NOT_FOUND);
	}

	return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
		headers: {
			"content-type": "application/gzip",
			"content-length": String(size),
			"last-modified": modified.toUTCString(),
			// The file changes once a night; an hour is short enough for a fetch after the run to see it.
			"cache-control": "public, max-age=3600",
			"x-robots-tag": "noindex",
		},
	});
}
