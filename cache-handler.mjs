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
// The same class (`FileSystemCache`), the same in-memory LRU (`cacheMaxMemorySize`), the same `get`:
// seeds the build wrote are read from disk, tags and revalidation work as before. Only `set` differs.
// A file is written to disk when
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

export default class BuildFilesOnDiskCache extends FileSystemCache {
	#building;
	#memoryOnly;

	constructor(ctx) {
		super(ctx);
		this.#building = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
		// The same memory LRU (it is static on the class), without the disk.
		this.#memoryOnly = new FileSystemCache({ ...ctx, flushToDisk: false });
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
