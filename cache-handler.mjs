// The page cache of the RUNNING storefront: Next's own, with one change to what it writes to disk.
//
// ## What the stock cache does, and why that filled the disk
//
// `next start` keeps every page it renders, and every `fetch` it caches, in memory AND writes it to
// `.next`: `server/app/<path>.html`, `.meta`, `.rsc` and `.segments/**` for a page (about seven files,
// 200 to 270 KB), `cache/fetch-cache/<hash>` for a fetch. Nothing ever deletes them.
//
// The build prerenders one market only: `generateStaticParams` in `src/app/[channel]/layout.tsx` lists
// the default channel, `sk-eur`, and adds the others only when it has `SALEOR_APP_TOKEN`, which the
// production build does not. Every URL of the other eleven markets is therefore a page the build never
// made. Each one that is visited is rendered at run time and written once, and the sitemap names some
// 238 000 of them. On the box (2026-10-12) the live `.next` grew 5 to 8 GB a day, and every deploy
// moved that growth into a snapshot as well.
//
// ## What this one does
//
// The same class (`FileSystemCache`), the same in-memory LRU (`cacheMaxMemorySize`): seeds the build
// wrote are read from disk, tags and revalidation work as before. `set` differs, and so does `get` for a
// Server Action request and for nothing else (the section after next). A file is written to disk when
//
//   - the build is running (`NEXT_PHASE`): that is how the build leaves its pages behind, or
//   - the file is already there: a page or a fetch the build made is refreshed in place, so a restart
//     picks up the regenerated version exactly as before, and the set of files never grows.
//
// Anything else is kept in the memory LRU and nowhere else. So the files under `.next` are the build's
// own and stay the build's own; a market page the build never made lives as long as the process and
// the LRU keep it. After a restart or an eviction it is rendered again, which is what its first visit
// cost anyway.
//
// Any doubt means memory only (an unknown kind, no file system, a path that cannot be built): this
// class can write less than the stock one, never more.
//
// ## A Server Action on a page whose copy is stale (the `get` below)
//
// With Cache Components, Next looks the page up in this cache for a Server Action too, to resume the
// re-render after the action from the page's stored state. If the copy it finds is stale it schedules a
// background re-render of the page "so the next request gets a fresh one", and it does that with the
// request it is already handling: the same `req` and `res`, `next-action` header and body included. That
// second render enters the action handler again and reads the same body, which the first pass is reading:
// two parsers on one stream, one of them fails with "Unexpected end of form" and sets the status of the
// shared response to 500, while the other runs the action and renders the page. The customer sees a 500
// with a normal body; the cart line was added (and added again, if they press the button again), and the
// page keeps failing until a plain visit has refreshed its copy. Reproduced on Next 16.3.6 in a minimal
// app (every action on a page with a stale copy answered 500 and ran once, with a fresh copy 200) and
// seen on the storefront on 2026-11-04 (two body parsers on one request; one customer's 8 attempts in 37
// seconds). The same app on Next 16.4.5 answers 200; the block is still in 16.3.8.
//
// The background render has no use for an action: the lookup is made for the resumable state, and the
// copy is refreshed by the next plain visit as it is for every other page. So to a request that can be a
// Server Action this handler hands the page copy back dated a little ahead of now, which Next counts as
// fresh. Nothing is stored or changed (the entry is a copy), the resumable state it reads is the same,
// and every other request, every other kind of entry, and every write are untouched.
//
// The handler is made per request and is given that request's headers (`_requestHeaders`), which is how it
// knows. It is not told the method, so a header or a form content type decides; a GET that carries one
// is served its page copy as fresh, which changes nothing for anyone else and costs nothing.
//
// The images Next optimises are NOT here. They have their own disk cache, bounded by
// `images.maximumDiskCacheSize` in `next.config.js`. They would come through this class only with
// `images.customCacheHandler` (off); this class keeps what it does not know in memory, so that switch
// would take every optimised image off the disk. Leave it off.
//
// ## Dependence on Next
//
// The base class is an internal of Next (pinned at 16.3.6). If an upgrade moves it, the build and
// `next start` fail on this import, which is loud, and `src/config/cache-handler.test.ts` fails first.
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import FileSystemCacheModule from "next/dist/server/lib/incremental-cache/file-system-cache.js";

const FileSystemCache = FileSystemCacheModule.default ?? FileSystemCacheModule;

if (typeof FileSystemCache !== "function" || typeof FileSystemCache.prototype.getFilePath !== "function") {
	throw new Error(
		"cache-handler.mjs: Next's FileSystemCache is not what this handler extends. " +
			"Next was upgraded: read file-system-cache.js in the new version before changing this file.",
	);
}

/**
 * How far ahead of now a page copy is dated for a Server Action request. Next calls an entry stale when
 * its stamp plus the page's revalidate time is behind the clock, so any positive time is enough; a minute
 * keeps a page with a revalidate time of one second from going stale between the lookup and its check.
 */
const ACTION_COPY_FRESH_FOR_MS = 60_000;

/** The content types of a form post, with or without parameters (`multipart/form-data; boundary=...`). */
const FORM_CONTENT_TYPE = /^(?:multipart\/form-data|application\/x-www-form-urlencoded)(?:[;\s]|$)/i;

/**
 * Whether the request this handler was made for can be a Server Action. Next's own test is a POST that
 * carries a `next-action` header or has a form content type (`getIsPossibleServerAction`); the second
 * covers a form posted without JavaScript. Node lowercases header names.
 *
 * @param {Record<string, string | string[] | undefined> | undefined} headers
 */
export function isPossibleServerAction(headers) {
	if (!headers || typeof headers !== "object") return false;
	const action = headers["next-action"];
	if (typeof action === "string" && action !== "") return true;
	const contentType = headers["content-type"];
	return typeof contentType === "string" && FORM_CONTENT_TYPE.test(contentType.trim());
}

export default class BuildFilesOnDiskCache extends FileSystemCache {
	#building;
	#memoryOnly;
	#possibleServerAction;

	constructor(ctx) {
		super(ctx);
		this.#building = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
		// The same memory LRU (it is static on the class), without the disk.
		this.#memoryOnly = new FileSystemCache({ ...ctx, flushToDisk: false });
		this.#possibleServerAction = isPossibleServerAction(ctx?._requestHeaders);
	}

	/**
	 * The stock `get`; but for a request that can be a Server Action, a page copy is returned dated ahead of
	 * now, so Next does not count it stale and does not re-render the page in the background with the
	 * action's own request (see the header comment). A copy of the entry is returned, never the stored one.
	 */
	async get(...args) {
		const entry = await super.get(...args);
		if (!entry || !this.#possibleServerAction || args[1]?.kind !== "APP_PAGE") return entry;
		return { ...entry, lastModified: Date.now() + ACTION_COPY_FRESH_FOR_MS };
	}

	async set(key, data, ctx) {
		if (this.#building || !data || (await this.#hasFileOnDisk(key, data))) {
			return super.set(key, data, ctx);
		}
		return this.#memoryOnly.set(key, data, ctx);
	}

	/** Whether the file the stock cache would write for this entry first is already there. */
	async #hasFileOnDisk(key, data) {
		try {
			let file;
			switch (data.kind) {
				case "APP_PAGE":
				case "PAGES":
					file = this.getFilePath(`${key}.html`, data.kind);
					break;
				case "APP_ROUTE":
					file = this.getFilePath(`${key}.body`, data.kind);
					break;
				case "FETCH":
					file = this.getFilePath(key, data.kind);
					break;
				default:
					return false;
			}
			await this.fs.stat(file);
			return true;
		} catch {
			return false;
		}
	}
}
