#!/usr/bin/env node
// Tell Bing (and the other IndexNow engines: Yandex, Naver, Seznam, Yep) which of our URLs exist or
// have changed, so they come and read them instead of waiting for their own schedule.
//
//   node scripts/ops/indexnow.mjs                                   # dry run: reads the sitemaps, prints the plan, sends nothing
//   node scripts/ops/indexnow.mjs --kinds pages --fire              # the "pages" shards of every market
//   node scripts/ops/indexnow.mjs --kinds products,vehicles --state ~/indexnow-state.json --fire
//   node scripts/ops/indexnow.mjs --urls /cz/autochladnicky,/sk/autochladnicky --fire
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
//      state file (`--state`) is what makes a second run send only what the first did not.
//   5. Any answer other than 200 or 202 stops the run. 429 in particular means the engine finds us
//      too chatty: wait, then run again; the state file has kept the progress.
//
// Run it where the public site and api.indexnow.org are both reachable (the web server). It reads
// nothing from .env, touches neither PM2 nor nginx nor the build, and writes only the state file.
//
// Exit 0 = dry run printed, or everything sent. 1 = a read or a submission failed. 2 = refused.
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
export const KINDS = ["pages", "products", "vehicles"];

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

/** `https://maky.store/sitemaps/cz-pages-1.xml` -> `{ market: "cz", kind: "pages", part: 1 }`, else null. */
export function classifyShard(url) {
	const match = /\/sitemaps\/([a-z]{2})-(pages|products|vehicles)-([1-9][0-9]*)\.xml$/.exec(String(url));
	return match ? { market: match[1], kind: match[2], part: Number(match[3]) } : null;
}

/** The shards of the index that are of the asked kinds and, when given, the asked markets. */
export function selectShards(locs, { kinds, markets }) {
	return locs.filter((loc) => {
		const shard = classifyShard(loc);
		if (!shard || !kinds.includes(shard.kind)) return false;
		return markets.length === 0 || markets.includes(shard.market);
	});
}

/**
 * Absolute, deduplicated URLs of the site's own host. `inputs` may be paths (`/cz/x`) or full
 * URLs. Anything else — another host, another scheme, something that is not a URL — comes back in
 * `rejected` untouched, because the caller must decide what to do about it, not this function.
 */
export function normaliseUrls(inputs, site) {
	const base = new URL(site);
	const seen = new Set();
	const urls = [];
	const rejected = [];
	for (const input of inputs) {
		let url;
		try {
			url = new URL(String(input).trim(), base);
		} catch {
			rejected.push(input);
			continue;
		}
		if (url.protocol !== base.protocol || url.host !== base.host) {
			rejected.push(input);
			continue;
		}
		url.hash = "";
		const href = url.href;
		if (seen.has(href)) continue;
		seen.add(href);
		urls.push(href);
	}
	return { urls, rejected };
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

/** What a status from the IndexNow endpoint means. Only 200 and 202 let the run go on. */
export function interpretStatus(status) {
	switch (status) {
		case 200:
			return { ok: true, note: "accepted" };
		case 202:
			return { ok: true, note: "received, the engine has not checked the key file yet" };
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

const OPTIONS = {
	site: { type: "string", default: DEFAULT_SITE },
	endpoint: { type: "string", default: DEFAULT_ENDPOINT },
	kinds: { type: "string", default: "pages" },
	markets: { type: "string", default: "" },
	urls: { type: "string", default: "" },
	max: { type: "string", default: String(DEFAULT_MAX) },
	state: { type: "string", default: "" },
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
	const kinds = csv(values.kinds);
	const unknown = kinds.filter((kind) => !KINDS.includes(kind));
	if (kinds.length === 0 || unknown.length > 0) {
		return { error: `--kinds takes ${KINDS.join(", ")} (got ${values.kinds || "nothing"})` };
	}
	const markets = csv(values.markets);
	if (markets.some((market) => !/^[a-z]{2}$/.test(market))) {
		return { error: `--markets takes two-letter market codes, e.g. sk,cz (got ${values.markets})` };
	}
	const max = Number(values.max);
	if (!Number.isInteger(max) || max < 1 || max > HARD_MAX) {
		return { error: `--max is a whole number from 1 to ${HARD_MAX} (got ${values.max})` };
	}
	const pause = Number(values.pause);
	if (!Number.isInteger(pause) || pause < 0) {
		return { error: `--pause is milliseconds, 0 or more (got ${values.pause})` };
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
		kinds,
		markets,
		urls: csv(values.urls),
		max,
		state: values.state,
		pause,
		fire: values.fire,
	};
}

// ============================================================================
// The run
// ============================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
	const { site, endpoint, kinds, markets, max, pause, fire } = options;

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

	// 1. Which URLs.
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
			let locs;
			try {
				locs = parseLocs(await get(shard));
			} catch (error) {
				log(`failed: could not read a sitemap shard: ${error.message}`);
				return 1;
			}
			log(`  ${shard.replace(site, "")}: ${locs.length} URLs`);
			candidates.push(...locs);
		}
	}

	const { urls, rejected } = normaliseUrls(candidates, site);
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
	const pending = named ? urls : urls.filter((url) => !state.submitted[url]);
	const toSend = pending.slice(0, max);
	const batches = chunk(toSend, BATCH_SIZE);

	log(
		`${urls.length} URLs found, ${urls.length - pending.length} already sent (state), ${
			pending.length
		} pending, ` +
			`${toSend.length} in this run${pending.length > toSend.length ? ` (capped by --max ${max})` : ""}, ` +
			`${batches.length} request(s) of up to ${BATCH_SIZE}.`,
	);
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
			return 1;
		}
		const verdict = interpretStatus(response.status);
		log(
			`request ${index + 1} of ${batches.length}: ${batch.length} URLs -> ${response.status} (${
				verdict.note
			})`,
		);
		if (!verdict.ok) {
			log(`stopped after ${sent} URL(s) sent in this run.`);
			return 1;
		}
		sent += batch.length;
		if (options.state) {
			const stamp = now().toISOString();
			for (const url of batch) state.submitted[url] = stamp;
			writeState(options.state, state);
		}
	}
	log(`done: ${sent} URL(s) sent.`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
