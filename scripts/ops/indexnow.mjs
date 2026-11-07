#!/usr/bin/env node
// Tell Bing (and the other IndexNow engines: Yandex, Naver, Seznam, Yep) which of our URLs exist or
// have changed, so they come and read them instead of waiting for their own schedule.
//
//   node scripts/ops/indexnow.mjs                                   # dry run: reads the sitemaps, prints the plan, sends nothing
//   node scripts/ops/indexnow.mjs --kinds pages --fire              # the "pages" shards of every market
//   node scripts/ops/indexnow.mjs --urls /cz/autochladnicky,/sk/autochladnicky --fire
//
// The two timers on the web server run it in one of two modes, never in both at once:
//
//   --mode changes   what happened to the site since the last look: URLs that appeared, URLs that are
//                    gone (a product that was removed, the old address of a renamed one) and products whose
//                    `lastmod` moved. Every hour. Products included.
//   --mode backlog   the URLs of the sitemap that were never sent, a limited number a day, pages and
//                    vehicle pages first. It sends nothing that "changes" would have.
//
//   node scripts/ops/indexnow.mjs --mode changes --state /var/lib/maky-indexnow/state.json \
//        --seen /var/lib/maky-indexnow/seen.json --fire
//   node scripts/ops/indexnow.mjs --mode backlog --state /var/lib/maky-indexnow/state.json --fire
//
// Why it exists. On 2026-10-08 Bing Webmaster Tools showed https://maky.store/cz/autochladnicky as
// "Not indexed due to NOINDEX directive". The page had been served `noindex` at the one moment Bing
// visited, because the Czech fridge category held no products yet; it is indexable now (see
// docs/design/seo-indexing-bing.md). Bing does not come back to a URL it has read as noindex for a
// long time, and nothing on our side can tell it to. IndexNow can: one POST names the URLs, and the
// engine fetches them soon after.
//
// What it sends: the host, the key, where the key file lives, and a list of URLs. The key is NOT a
// secret. It is the name and the content of a public file, `public/<key>.txt`, served at the site
// root; the engine reads that file to see that whoever submits for maky.store controls maky.store.
//
// Rules this file enforces rather than documents:
//
//   1. Dry run by default. `--fire` is the only way anything leaves the machine.
//   2. It refuses to fire unless the key file is really being served by the public site and says
//      the key. Before the deploy that carries the file this is what stops a pointless 403.
//   3. Only URLs of the site's own host go out. A sitemap that lists anything else is a bug, and
//      the run stops before sending anything.
//   4. A cap per run (`--max`, default 10 000, never above 50 000) and batches of 5 000. IndexNow is
//      for URLs that are new or changed, not for telling an engine the same thing every hour; the
//      state file (`--state`) is what makes a second run send only what the first did not. With it a
//      run sends, in this order, the URLs it has never sent (kind by kind in the order `--kinds`
//      names them, and inside a kind in the order the sitemaps list them, so a backlog drains market
//      by market) and then those whose sitemap `lastmod` is later than the time they were sent, none
//      of them more than once per `--resend-after-days` (default 7).
//      Products and vehicles go out only with a state file: without one every run would send the
//      same first `--max` URLs again.
//   5. Only a 200 counts as sent. A 202 means "received, the key file has not been checked yet", and
//      that is not an acceptance: on 2026-10-08 the 177 URLs of the first run got a 202, were written
//      to the state file as sent, and Bing Webmaster Tools never listed them. A 202 now stops the run,
//      records nothing and exits 3, so the next run sends those URLs again. Any other answer stops
//      the run too; 429 in particular means the engine finds us too chatty: wait, then run again,
//      the state file has kept the progress.
//   6. `--mode changes` tells the engine about a real change and nothing else. It keeps a snapshot of
//      the sitemaps (`--seen`) and each run compares the sitemaps with it: a URL that is not in the
//      snapshot is new, one that is no longer in the sitemap is gone (a removed product, the old
//      address of a renamed one), a product whose `lastmod` is later than the snapshot's has changed.
//      The first run only takes the snapshot and announces nothing: what existed before it is the
//      backlog's business. A new market or a new kind is taken the same way. Five things keep it from
//      announcing what is not a change:
//        - a group of shards (a market's pages, products or vehicle pages, however many parts it has)
//          that cannot be read in full is left alone, and a group that comes back empty where it held
//          URLs is a failed read, not a removal of all of them;
//        - a URL already in the state file as sent is recorded and not announced as new;
//        - when more than a quarter of a group's `lastmod` dates move at once, that is a rewrite of the
//          dates (on 2026-10-29 Saleor dated 96 % of the Slovak products the same day), not a quarter of
//          the catalogue changing: the dates are recorded and nothing is announced;
//        - a changed URL is announced at most once per `--resend-after-days` (one day in this mode): a
//          product touched again within the day is held back, its snapshot date stays old, and the next
//          run after the day finds it again and tells the engine once;
//        - at most `--max` a run (1 000 by default); what does not fit is found again by the next run.
//      Pages and vehicle pages carry no `lastmod` on purpose (src/lib/seo/sitemap.ts), so for them it
//      sees a page appear and disappear, not a text change; a text change is announced by naming the
//      URLs (`--urls`).
//   7. `--mode backlog` is the earlier daily run reduced to its first half: the URLs never sent, in the
//      order of `--kinds`, `--max` a run. It never re-announces a changed URL; `changes` does that.
//
// Run it where the public site and api.indexnow.org are both reachable (the web server). It reads
// nothing from .env, touches neither PM2 nor nginx nor the build, and writes only the state file.
// `scripts/ops/systemd/` holds the timer that runs it once a day.
//
// Exit 0 = dry run printed, or everything sent. 1 = a read or a submission failed. 2 = refused.
// 3 = the engine answered 202: received, not confirmed, nothing from that request recorded.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const DEFAULT_SITE = "https://maky.store";
export const DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow";
/** What one POST carries. The protocol allows 10 000; half of that keeps the body small. */
export const BATCH_SIZE = 5_000;
export const DEFAULT_MAX = 10_000;
export const HARD_MAX = 50_000;
/** A URL that changed after it was sent is told again only when the last telling is this old. */
export const DEFAULT_RESEND_DAYS = 7;
export const KINDS = ["pages", "products", "vehicles"];
export const MODES = ["sweep", "changes", "backlog"];
/**
 * What each mode does when `--kinds` and `--max` are not given. `sweep` is the tool as it was before
 * the modes: the pages shards, 10 000 a run.
 */
export const MODE_DEFAULTS = {
	sweep: { kinds: "pages", max: DEFAULT_MAX, resendAfterDays: DEFAULT_RESEND_DAYS },
	// A product can be touched several times a day; telling the engine about it more than once a day adds noise, not news.
	changes: { kinds: "pages,vehicles,products", max: 1_000, resendAfterDays: 1 },
	backlog: { kinds: "pages,vehicles", max: 2_000, resendAfterDays: DEFAULT_RESEND_DAYS },
};
/** More than this share of a group's `lastmod` dates moving in one run is a rewrite of the dates, not changes. */
export const BULK_CHANGE_SHARE = 0.25;
/** ... but a group has to be bigger than this before the share means anything. */
export const BULK_CHANGE_MIN = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 60_000;
const publicDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "public");

// ============================================================================
// Pure helpers — these are what the tests pin
// ============================================================================

const XML_ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/** The text of every `<loc>` in a sitemap or a sitemap index, entities decoded. */
export function parseLocs(xml) {
	const out = [];
	for (const match of String(xml).matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)) {
		const text = match[1].replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
		if (text) out.push(text);
	}
	return out;
}

/**
 * `{ loc, lastmod }` of every `<url>` of a sitemap shard, entities decoded. An entry without a
 * `<loc>` is skipped. `lastmod` is `null` when the entry has none, which is how pages and vehicles
 * are listed on purpose (docs/design/seo-indexing-bing.md): only products carry one.
 */
export function parseEntries(xml) {
	const out = [];
	for (const match of String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)) {
		const [loc] = parseLocs(match[1]);
		if (!loc) continue;
		const lastmod = /<lastmod>\s*([^<]*?)\s*<\/lastmod>/.exec(match[1])?.[1];
		out.push({ loc, lastmod: lastmod || null });
	}
	return out;
}

/** `https://maky.store/sitemaps/cz-pages-1.xml` -> `{ market: "cz", kind: "pages", part: 1 }`, else null. */
export function classifyShard(url) {
	const match = /\/sitemaps\/([a-z]{2})-(pages|products|vehicles)-([1-9][0-9]*)\.xml$/.exec(String(url));
	return match ? { market: match[1], kind: match[2], part: Number(match[3]) } : null;
}

/**
 * The shards of the index that are of the asked kinds and, when given, the asked markets, in the
 * order the kinds were asked for: `--kinds pages,vehicles,products` reads every market's pages
 * first, then every market's vehicle pages, then the products. Inside a kind the index's own order
 * stays (market by market, part by part).
 *
 * The order is what a capped run cuts at. Until 2026-11-07 the shards went out in the index's order,
 * market by market with a market's products ahead of its vehicle pages, so after three days of
 * 10 000 the run had told Bing about 28 495 products, 52 pages and the vehicle pages of ONE market
 * (1 453 of 17 401), and had not reached the vehicle pages of the other eleven markets at all: the
 * pages with their own editorial text, the ones Bing is most likely to keep, were at the back of
 * the queue.
 */
export function selectShards(locs, { kinds, markets }) {
	const rank = (loc) => kinds.indexOf(classifyShard(loc)?.kind);
	return locs
		.filter((loc) => {
			const shard = classifyShard(loc);
			if (!shard || !kinds.includes(shard.kind)) return false;
			return markets.length === 0 || markets.includes(shard.market);
		})
		.map((loc, position) => ({ loc, position, rank: rank(loc) }))
		.sort((a, b) => a.rank - b.rank || a.position - b.position)
		.map(({ loc }) => loc);
}

/**
 * Absolute, deduplicated URLs of the site's own host, each with the `lastmod` its sitemap entry
 * carried (`null` when it had none). `inputs` are paths (`/cz/x`), full URLs, or `{ loc, lastmod }`
 * entries as `parseEntries` makes them. Anything else — another host, another scheme, something
 * that is not a URL — comes back in `rejected` untouched, because the caller must decide what to do
 * about it, not this function.
 */
export function normaliseEntries(inputs, site) {
	const base = new URL(site);
	const seen = new Set();
	const entries = [];
	const rejected = [];
	for (const input of inputs) {
		const loc = typeof input === "string" ? input : input.loc;
		let url;
		try {
			url = new URL(String(loc).trim(), base);
		} catch {
			rejected.push(loc);
			continue;
		}
		if (url.protocol !== base.protocol || url.host !== base.host) {
			rejected.push(loc);
			continue;
		}
		url.hash = "";
		const href = url.href;
		if (seen.has(href)) continue;
		seen.add(href);
		entries.push({ url: href, lastmod: typeof input === "string" ? null : input.lastmod ?? null });
	}
	return { entries, rejected };
}

/** The same without the `lastmod`: absolute, deduplicated URLs of the site's own host. */
export function normaliseUrls(inputs, site) {
	const { entries, rejected } = normaliseEntries(inputs, site);
	return { urls: entries.map((entry) => entry.url), rejected };
}

/**
 * What still needs telling, in the order it goes out: first the URLs that were never sent, in the
 * order the sitemaps list them, then those that changed since they were sent. A URL has changed when
 * its sitemap `lastmod` is later than the time the state file holds for it, and it is told again
 * only if that time is at least `resendAfterMs` ago. A URL without a `lastmod` (pages, vehicles) is
 * sent once. A recorded time that is not a date is read as "sent": a damaged state file must make a
 * run send less, not more.
 */
export function selectPending(entries, submitted, { now, resendAfterMs }) {
	const fresh = [];
	const changed = [];
	for (const { url, lastmod } of entries) {
		const stamp = submitted[url];
		if (!stamp) {
			fresh.push(url);
			continue;
		}
		const sentAt = Date.parse(stamp);
		const modifiedAt = lastmod ? Date.parse(lastmod) : Number.NaN;
		if (Number.isNaN(sentAt) || Number.isNaN(modifiedAt)) continue;
		if (modifiedAt > sentAt && now - sentAt >= resendAfterMs) changed.push(url);
	}
	return { fresh, changed };
}

export function chunk(list, size) {
	const out = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}

/**
 * The IndexNow key in `public/`: the one file `<key>.txt` whose content is `<key>`. A name that is
 * merely key-shaped (`llms.txt` is not, but `notes-2026.txt` would be) does not count unless the
 * file says so; two such files are ambiguous and refused.
 */
export function findKey(dir = publicDir) {
	const found = [];
	for (const name of readdirSync(dir)) {
		const match = /^([A-Za-z0-9-]{8,128})\.txt$/.exec(name);
		if (!match) continue;
		const content = readFileSync(join(dir, name), "utf8").trim();
		if (content === match[1]) found.push(match[1]);
	}
	if (found.length !== 1) {
		throw new Error(
			found.length === 0
				? `no IndexNow key file in ${dir} (a file <key>.txt whose content is <key>)`
				: `more than one IndexNow key file in ${dir}: ${found.join(", ")}`,
		);
	}
	return found[0];
}

export function buildPayload({ site, key, urlList }) {
	const base = new URL(site);
	return { host: base.host, key, keyLocation: `${base.origin}/${key}.txt`, urlList };
}

/**
 * What a status from the IndexNow endpoint means. Only a 200 lets the run go on, and only a 200 is
 * written to the state file. A 202 is "received, key not checked yet": the engine may drop the
 * URLs, as Bing did with the 177 of 2026-10-08, so it is `unconfirmed`, not accepted.
 */
export function interpretStatus(status) {
	switch (status) {
		case 200:
			return { ok: true, note: "accepted" };
		case 202:
			return {
				ok: false,
				unconfirmed: true,
				note: "received, but the engine has not checked the key file yet: not an acceptance, NOT counted as sent",
			};
		case 400:
			return { ok: false, note: "bad request: the payload was not understood" };
		case 403:
			return {
				ok: false,
				note: "key not valid: the key file is not reachable at keyLocation or does not match",
			};
		case 422:
			return { ok: false, note: "URLs do not belong to the host, or the key does not match the host" };
		case 429:
			return {
				ok: false,
				note: "too many requests: wait, then run again; the state file keeps the progress",
			};
		default:
			return { ok: false, note: "unexpected answer" };
	}
}

export function readState(path) {
	if (!path || !existsSync(path)) return { version: 1, submitted: {} };
	const parsed = JSON.parse(readFileSync(path, "utf8"));
	if (parsed?.version !== 1 || typeof parsed.submitted !== "object" || parsed.submitted === null) {
		throw new Error(`${path} is not an IndexNow state file (version 1)`);
	}
	return parsed;
}

/** Atomic: a run that dies halfway through the write must not leave half a file behind. */
export function writeState(path, state) {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}`;
	writeFileSync(tmp, JSON.stringify(state, null, "\t") + "\n");
	renameSync(tmp, path);
}

// ============================================================================
// `--mode changes`: the snapshot and the comparison
// ============================================================================

/**
 * The group a shard belongs to: `https://maky.store/sitemaps/sk-products-2.xml` -> `sk-products`.
 * A market's products are one group however many parts they are cut into, because the cut moves: a
 * product that was the last of part 1 yesterday is the first of part 2 today, and that is not a
 * removal and an addition.
 */
export function groupOf(shardUrl) {
	const shard = classifyShard(shardUrl);
	return shard ? `${shard.market}-${shard.kind}` : null;
}

/** `{ [url]: lastmod }` of normalised entries; an entry without a `lastmod` keeps the empty string. */
export function snapshotOf(entries) {
	const out = {};
	for (const { url, lastmod } of entries) out[url] = lastmod ?? "";
	return out;
}

/**
 * The snapshot of the last look, `{ version: 1, takenAt, groups: { "sk-products": { [url]: lastmod } } }`,
 * or `null` when there is none yet (or no path): a run without a snapshot takes one and announces nothing.
 * A file that is not a snapshot is an error, never an empty one: starting over would announce nothing and
 * hide that the file was damaged.
 */
export function readSeen(path) {
	if (!path || !existsSync(path)) return null;
	const parsed = JSON.parse(readFileSync(path, "utf8"));
	if (parsed?.version !== 1 || typeof parsed.groups !== "object" || parsed.groups === null) {
		throw new Error(`${path} is not an IndexNow snapshot file (version 1)`);
	}
	return parsed;
}

/** Atomic, like the state file, and compact: the snapshot holds every URL of the sitemaps. */
export function writeSeen(path, seen) {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}`;
	writeFileSync(tmp, JSON.stringify(seen) + "\n");
	renameSync(tmp, path);
}

/**
 * What happened to one group between the snapshot (`previous`, `{ [url]: lastmod }`) and the sitemaps
 * now (`entries`, as `normaliseEntries` makes them):
 *
 *   added     in the sitemaps, not in the snapshot
 *   removed   in the snapshot, no longer in the sitemaps
 *   changed   in both, and the `lastmod` is later than the snapshot's
 *   absorbed  in both, and the `lastmod` differs in a way that says nothing about the page: it appeared
 *             where there was none, it vanished, it went backwards, it is not a date; or it is one of
 *             `changed` that moved together with so many others that it is a rewrite of the dates
 *             (`bulk`). Recorded in the snapshot, never announced.
 */
export function diffGroup(previous, entries) {
	const current = new Map();
	for (const { url, lastmod } of entries) current.set(url, lastmod ?? "");

	const added = [];
	const changed = [];
	const absorbed = [];
	for (const [url, lastmod] of current) {
		if (!Object.hasOwn(previous, url)) {
			added.push({ url, lastmod });
			continue;
		}
		const before = previous[url];
		if (before === lastmod) continue;
		const was = Date.parse(before);
		const is = Date.parse(lastmod);
		if (Number.isNaN(was) || Number.isNaN(is) || is <= was) absorbed.push({ url, lastmod });
		else changed.push({ url, lastmod });
	}
	const removed = Object.keys(previous).filter((url) => !current.has(url));

	const bulk = changed.length > Math.max(BULK_CHANGE_MIN, Math.floor(BULK_CHANGE_SHARE * current.size));
	return {
		added,
		removed,
		changed: bulk ? [] : changed,
		absorbed: bulk ? [...absorbed, ...changed] : absorbed,
		bulk,
		size: current.size,
	};
}

const OPTIONS = {
	site: { type: "string", default: DEFAULT_SITE },
	endpoint: { type: "string", default: DEFAULT_ENDPOINT },
	mode: { type: "string", default: "sweep" },
	// No default for these three: the mode decides (MODE_DEFAULTS).
	kinds: { type: "string", default: "" },
	markets: { type: "string", default: "" },
	urls: { type: "string", default: "" },
	max: { type: "string", default: "" },
	state: { type: "string", default: "" },
	seen: { type: "string", default: "" },
	"resend-after-days": { type: "string", default: "" },
	pause: { type: "string", default: "1000" },
	fire: { type: "boolean", default: false },
};

const csv = (text) =>
	text
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);

/** Options -> a validated plan input, or `{ error }`. Nothing here touches the network. */
export function readOptions(argv) {
	let values;
	try {
		({ values } = parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: false }));
	} catch (error) {
		return { error: error.message };
	}
	const mode = values.mode;
	if (!MODES.includes(mode)) {
		return { error: `--mode takes ${MODES.join(", ")} (got ${values.mode || "nothing"})` };
	}
	if (mode !== "sweep" && values.urls) {
		return {
			error: `--urls names URLs to send as they are; it belongs to the default mode, not to --mode ${mode}`,
		};
	}
	const defaults = MODE_DEFAULTS[mode];
	const kinds = csv(values.kinds || defaults.kinds);
	const unknown = kinds.filter((kind) => !KINDS.includes(kind));
	if (kinds.length === 0 || unknown.length > 0) {
		return { error: `--kinds takes ${KINDS.join(", ")} (got ${values.kinds || "nothing"})` };
	}
	const markets = csv(values.markets);
	if (markets.some((market) => !/^[a-z]{2}$/.test(market))) {
		return { error: `--markets takes two-letter market codes, e.g. sk,cz (got ${values.markets})` };
	}
	const max = Number(values.max || defaults.max);
	if (!Number.isInteger(max) || max < 1 || max > HARD_MAX) {
		return { error: `--max is a whole number from 1 to ${HARD_MAX} (got ${values.max})` };
	}
	const pause = Number(values.pause);
	if (!Number.isInteger(pause) || pause < 0) {
		return { error: `--pause is milliseconds, 0 or more (got ${values.pause})` };
	}
	const resendAfterDays = Number(values["resend-after-days"] || defaults.resendAfterDays);
	if (!Number.isInteger(resendAfterDays) || resendAfterDays < 0 || resendAfterDays > 3650) {
		return {
			error: `--resend-after-days is a whole number of days from 0 to 3650 (got ${values["resend-after-days"]})`,
		};
	}
	try {
		new URL(values.site);
		new URL(values.endpoint);
	} catch {
		return { error: "--site and --endpoint must be full URLs" };
	}
	return {
		site: values.site.replace(/\/$/, ""),
		endpoint: values.endpoint,
		mode,
		kinds,
		markets,
		urls: csv(values.urls),
		max,
		state: values.state,
		seen: values.seen,
		resendAfterDays,
		pause,
		fire: values.fire,
	};
}

// ============================================================================
// The run
// ============================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends the batches, one request each. `accepted(batch)` runs after every 200, so the caller records
 * exactly what the engine took and nothing else. Returns `{ sent, code }`: `code` is `null` when every
 * batch was accepted, else the exit code the run ends with (1 a refusal or a failure, 3 a 202).
 */
async function sendBatches(batches, run, accepted) {
	const { log, doFetch, wait, site, endpoint, key, keyUrl, pause } = run;
	let sent = 0;
	for (const [index, batch] of batches.entries()) {
		if (index > 0 && pause > 0) await wait(pause);
		const payload = buildPayload({ site, key, urlList: batch });
		let response;
		try {
			response = await doFetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json; charset=utf-8" },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			log(`failed: request ${index + 1} of ${batches.length} did not get an answer: ${error.message}`);
			return { sent, code: 1 };
		}
		const verdict = interpretStatus(response.status);
		log(
			`request ${index + 1} of ${batches.length}: ${batch.length} URLs -> ${response.status} (${
				verdict.note
			})`,
		);
		if (verdict.unconfirmed) {
			log(
				`stopped after ${sent} URL(s) sent in this run; this request is not recorded as sent, so the next run sends it again. ` +
					`If the answer stays 202, look in the web server's nginx log for the engine reading ${keyUrl}.`,
			);
			return { sent, code: 3 };
		}
		if (!verdict.ok) {
			log(`stopped after ${sent} URL(s) sent in this run.`);
			return { sent, code: 1 };
		}
		sent += batch.length;
		accepted(batch);
	}
	return { sent, code: null };
}

/**
 * `--mode changes`: compare the sitemaps with the snapshot of the last look and announce what is new,
 * gone or changed. See rule 6 at the top for what counts and what does not.
 *
 * Order of a run: removed URLs first (an address the index still holds and the site no longer
 * serves is the one that is wrong right now), then new ones, then changed ones; inside each, the
 * kinds in the order of `--kinds`. The snapshot and the state file are written after every request
 * the engine answered with a 200, and only for the URLs of that request.
 */
async function runChanges(run) {
	const { options, log, get, now, key, keyUrl } = run;
	const { site, kinds, markets, max, fire } = options;
	const resendAfterMs = options.resendAfterDays * DAY_MS;

	let state;
	let seen;
	try {
		state = readState(options.state);
		seen = readSeen(options.seen);
	} catch (error) {
		log(`refused: ${error.message}`);
		return 2;
	}
	const firstLook = seen === null;
	seen ??= { version: 1, takenAt: null, groups: {} };

	let shards;
	try {
		shards = selectShards(parseLocs(await get(`${site}/sitemap.xml`)), { kinds, markets });
	} catch (error) {
		log(`failed: could not read the sitemap index: ${error.message}`);
		return 1;
	}
	if (shards.length === 0) {
		log(
			`refused: the sitemap index lists no ${kinds.join("/")} shard${
				markets.length ? ` for ${markets.join(",")}` : ""
			}.`,
		);
		return 2;
	}
	/** A market's kind -> its shards, in the order `selectShards` put them. */
	const groups = new Map();
	for (const shard of shards) {
		const group = groupOf(shard);
		groups.set(group, [...(groups.get(group) ?? []), shard]);
	}

	const removed = [];
	const added = [];
	const changed = [];
	/** Recorded in the snapshot, never announced. */
	const quiet = [];
	/** Changed, but told less than `--resend-after-days` ago: not announced, not recorded, found again next run. */
	const held = [];
	/** Groups seen for the first time, whole. */
	const taken = new Map();
	/** Groups that could not be read in full this time. */
	const unread = [];

	for (const [group, parts] of groups) {
		const raw = [];
		try {
			for (const part of parts) {
				for (const entry of parseEntries(await get(part))) raw.push(entry); // not push(...): a shard can hold tens of thousands
			}
		} catch (error) {
			unread.push(group);
			log(`failed: ${group} could not be read (${error.message}); its snapshot stays as it was.`);
			continue;
		}
		const { entries, rejected } = normaliseEntries(raw, site);
		if (rejected.length > 0) {
			log(`refused: ${rejected.length} URL(s) are not on ${new URL(site).host}, for example ${rejected[0]}`);
			return 2;
		}

		const before = seen.groups[group];
		if (!before) {
			taken.set(group, snapshotOf(entries));
			log(`  ${group}: ${entries.length} URLs, seen for the first time: recorded, not announced`);
			continue;
		}
		const known = Object.keys(before).length;
		if (entries.length === 0 && known > 0) {
			unread.push(group);
			log(
				`failed: ${group} came back empty where the snapshot holds ${known} URLs. That is a failed read, ` +
					`not ${known} removals; its snapshot stays as it was.`,
			);
			continue;
		}

		const diff = diffGroup(before, entries);
		for (const url of diff.removed) removed.push({ group, url, lastmod: null });
		// Sent already, by the backlog or by hand: part of the snapshot from now on, no second message.
		for (const entry of diff.added) (state.submitted[entry.url] ? quiet : added).push({ group, ...entry });
		for (const entry of diff.changed) {
			const sentAt = Date.parse(state.submitted[entry.url] ?? "");
			const recently = !Number.isNaN(sentAt) && now().getTime() - sentAt < resendAfterMs;
			(recently ? held : changed).push({ group, ...entry });
		}
		for (const entry of diff.absorbed) quiet.push({ group, ...entry });
		log(
			`  ${group}: ${diff.size} URLs, ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed`,
		);
		if (diff.bulk) {
			log(
				`  ${group}: ${diff.absorbed.length} dates moved in one run, more than ${Math.round(
					BULK_CHANGE_SHARE * 100,
				)} % of the group. That is a rewrite of the dates, not that many changes: recorded, not announced.`,
			);
		}
	}

	const plan = [
		...removed.map((op) => ({ ...op, change: "removed" })),
		...added.map((op) => ({ ...op, change: "added" })),
		...changed.map((op) => ({ ...op, change: "changed" })),
	];
	const toSend = plan.slice(0, max);
	const batches = chunk(
		toSend.map((op) => op.url),
		BATCH_SIZE,
	);
	log(
		`${firstLook ? "first look" : "since the last look"}: ${removed.length} removed, ${
			added.length
		} added, ` +
			`${changed.length} changed; ${quiet.length} recorded without a message; ` +
			`${held.length} held back (told less than ${options.resendAfterDays} day(s) ago); ${toSend.length} in this run` +
			`${
				plan.length > toSend.length
					? ` (capped by --max ${max}; the rest is found again by the next run)`
					: ""
			}, ` +
			`${batches.length} request(s) of up to ${BATCH_SIZE}.`,
	);
	for (const op of toSend.slice(0, 5)) log(`  e.g. ${op.change}: ${op.url}`);
	const exitCode = unread.length > 0 ? 1 : 0;
	if (unread.length > 0) log(`${unread.length} group(s) could not be read: ${unread.join(", ")}.`);

	if (!fire) {
		log(
			firstLook
				? "dry run: nothing was sent and nothing was written. The first run with --fire takes the snapshot and announces nothing."
				: "dry run: nothing was sent and nothing was written. Add --fire to send.",
		);
		return exitCode;
	}

	// What needs no message is written down first, so a run that then fails does not look at it again.
	for (const [group, snapshot] of taken) seen.groups[group] = snapshot;
	for (const { group, url, lastmod } of quiet) (seen.groups[group] ??= {})[url] = lastmod ?? "";
	if (taken.size > 0 || quiet.length > 0) {
		seen.takenAt = now().toISOString();
		writeSeen(options.seen, seen);
	}

	if (toSend.length === 0) {
		log("nothing to send.");
		return exitCode;
	}
	let keyServed = false;
	try {
		keyServed = (await get(keyUrl)).trim() === key;
	} catch {
		keyServed = false;
	}
	if (!keyServed) {
		log(`key file: ${keyUrl} does NOT serve the key (is the build with public/${key}.txt deployed?).`);
		log("refused: the engine would reject the submission (403) until the key file is served.");
		return 2;
	}

	const byUrl = new Map(toSend.map((op) => [op.url, op]));
	const counts = { removed: 0, added: 0, changed: 0 };
	const { sent, code } = await sendBatches(batches, run, (batch) => {
		const stamp = now().toISOString();
		for (const url of batch) {
			const op = byUrl.get(url);
			counts[op.change] += 1;
			const snapshot = (seen.groups[op.group] ??= {});
			if (op.change === "removed") {
				delete snapshot[url];
				delete state.submitted[url];
			} else {
				snapshot[url] = op.lastmod ?? "";
				state.submitted[url] = stamp;
			}
		}
		seen.takenAt = stamp;
		writeState(options.state, state);
		writeSeen(options.seen, seen);
	});
	if (code !== null) return code;
	log(
		`done: ${sent} URL(s) sent (${counts.removed} removed, ${counts.added} added, ${counts.changed} changed)` +
			`${plan.length > sent ? `; ${plan.length - sent} more wait for the next run` : ""}.`,
	);
	return exitCode;
}

/**
 * `deps` exists for the tests: `fetch`, `log`, `now`, `sleep` and the directory the key is read
 * from. A real run passes nothing.
 */
export async function main(argv, deps = {}) {
	const log = deps.log ?? ((line) => console.log(line));
	const doFetch = deps.fetch ?? globalThis.fetch;
	const now = deps.now ?? (() => new Date());
	const wait = deps.sleep ?? sleep;

	const options = readOptions(argv);
	if (options.error) {
		log(`refused: ${options.error}`);
		log("usage: see the top of scripts/ops/indexnow.mjs");
		return 2;
	}
	const { site, endpoint, mode, kinds, markets, max, pause, fire } = options;
	if (fire && mode === "changes" && (!options.state || !options.seen)) {
		log(
			"refused: --mode changes needs --state (what was sent) and --seen (the snapshot of the sitemaps) to send; " +
				"without them every run would announce the same things again.",
		);
		return 2;
	}
	if (fire && mode === "backlog" && !options.state) {
		log("refused: --mode backlog needs --state; without it every run would send the same first URLs again.");
		return 2;
	}
	if (fire && options.urls.length === 0 && !options.state && kinds.some((kind) => kind !== "pages")) {
		log(
			"refused: products and vehicles are sent only with --state; without it every run would send the same first URLs again.",
		);
		return 2;
	}

	let key;
	try {
		key = findKey(deps.publicDir ?? publicDir);
	} catch (error) {
		log(`refused: ${error.message}`);
		return 2;
	}
	const keyUrl = `${site}/${key}.txt`;

	const get = async (url) => {
		const response = await doFetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		if (!response.ok) throw new Error(`${url} answered ${response.status}`);
		return response.text();
	};
	const run = { options, log, get, doFetch, now, wait, site, endpoint, key, keyUrl, pause };

	if (mode === "changes") return runChanges(run);

	// 1. Which URLs. Each candidate is a string (named) or `{ loc, lastmod }` (read from a shard).
	let candidates;
	if (options.urls.length > 0) {
		candidates = options.urls;
		log(`${candidates.length} URL(s) named on the command line; the sitemaps are not read.`);
	} else {
		let shards;
		try {
			shards = selectShards(parseLocs(await get(`${site}/sitemap.xml`)), { kinds, markets });
		} catch (error) {
			log(`failed: could not read the sitemap index: ${error.message}`);
			return 1;
		}
		if (shards.length === 0) {
			log(
				`refused: the sitemap index lists no ${kinds.join("/")} shard${
					markets.length ? ` for ${markets.join(",")}` : ""
				}.`,
			);
			return 2;
		}
		candidates = [];
		for (const shard of shards) {
			let shardEntries;
			try {
				shardEntries = parseEntries(await get(shard));
			} catch (error) {
				log(`failed: could not read a sitemap shard: ${error.message}`);
				return 1;
			}
			log(`  ${shard.replace(site, "")}: ${shardEntries.length} URLs`);
			for (const entry of shardEntries) candidates.push(entry); // not push(...): a shard can hold tens of thousands
		}
	}

	const { entries, rejected } = normaliseEntries(candidates, site);
	if (rejected.length > 0) {
		log(`refused: ${rejected.length} URL(s) are not on ${new URL(site).host}, for example ${rejected[0]}`);
		return 2;
	}

	// 2. Which of them still need telling. Named URLs are always sent: someone names a URL because
	// it has just changed, and "already sent" is exactly what is no longer true of it.
	let state;
	try {
		state = readState(options.state);
	} catch (error) {
		log(`refused: ${error.message}`);
		return 2;
	}
	const named = options.urls.length > 0;
	const resendAfterMs = options.resendAfterDays * DAY_MS;
	const { fresh, changed } = named
		? { fresh: entries.map((entry) => entry.url), changed: [] }
		: selectPending(entries, state.submitted, { now: now().getTime(), resendAfterMs });
	// The backlog is what was never sent. What changed after it was sent is `--mode changes`' business,
	// and an old `lastmod` is no reason for the backlog to go back over its own tracks.
	const pending = mode === "backlog" ? [...fresh] : [...fresh, ...changed];
	const toSend = pending.slice(0, max);
	const batches = chunk(toSend, BATCH_SIZE);

	log(
		`${entries.length} URLs found, ${entries.length - pending.length} already sent (state), ${
			pending.length
		} pending, ` +
			`${toSend.length} in this run${pending.length > toSend.length ? ` (capped by --max ${max})` : ""}, ` +
			`${batches.length} request(s) of up to ${BATCH_SIZE}.`,
	);
	if (!named && mode === "sweep" && changed.length > 0) {
		log(
			`  of the pending: ${fresh.length} never sent, ${changed.length} changed since they were sent ` +
				`(told again at most every ${options.resendAfterDays} day(s)).`,
		);
	}
	for (const url of toSend.slice(0, 5)) log(`  e.g. ${url}`);

	// 3. Is the key file really being served?
	let keyServed = false;
	try {
		keyServed = (await get(keyUrl)).trim() === key;
	} catch {
		keyServed = false;
	}
	log(
		keyServed
			? `key file: ${keyUrl} serves the key.`
			: `key file: ${keyUrl} does NOT serve the key (is the build with public/${key}.txt deployed?).`,
	);

	if (!fire) {
		log("dry run: nothing was sent. Add --fire to send.");
		return 0;
	}
	if (!keyServed) {
		log("refused: the engine would reject the submission (403) until the key file is served.");
		return 2;
	}
	if (toSend.length === 0) {
		log("nothing to send.");
		return 0;
	}

	// 4. Send.
	const { sent, code } = await sendBatches(batches, run, (batch) => {
		if (!options.state) return;
		const stamp = now().toISOString();
		for (const url of batch) state.submitted[url] = stamp;
		writeState(options.state, state);
	});
	if (code !== null) return code;
	log(`done: ${sent} URL(s) sent.`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
