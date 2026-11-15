#!/usr/bin/env node
// Write the product feeds Google Merchant Center fetches: one file per market.
//
//   node scripts/ops/merchant-feed.mjs                          # dry run: Slovakia, the first two steps, writes nothing
//   node scripts/ops/merchant-feed.mjs --markets sk --write     # the Slovak feed, into /var/lib/maky-feeds
//   node scripts/ops/merchant-feed.mjs --markets sk,cz --write
//
// What it is. The shop itself says what a feed item is: `/api/internal/merchant-feed` answers one step of
// a market's catalogue as finished items, made by the functions the product page builds its structured
// data from (src/lib/merchant-feed/item.ts). This program only walks those steps, slowly, writes the items
// as an RSS 2.0 file with Google's `g:` fields, and puts the file where `/feeds/google-<market>.xml.gz`
// serves it from. It holds no rule about price, availability, code or URL, and it must not get one:
// Google compares each item with its page, and two programs with two sets of rules disagree sooner or later.
//
// Rules this file enforces rather than documents:
//
//   1. Dry run by default. `--write` is the only way a feed file changes.
//   2. A feed is whole or it is not replaced. A step that cannot be read after its retries ends that
//      market; the file of yesterday stays. `--max-pages` is for looking and is refused with `--write`.
//   3. An empty feed is never written, and a feed that lost more than half of its items since the last
//      run is not written without `--force`: to Merchant Center a missing item is a product withdrawn.
//      A catalogue does not halve overnight; a failed read does that.
//   4. The file is written beside its final name and renamed, so a fetch never meets half a file.
//   5. The secret of the internal route is read from the shop's own `.env` (one variable, by name), sent
//      only to this machine (a loopback address, or the run is refused) and never printed.
//
// One thing it adds to an item: `availability_date`. An item the shop makes to order says `backorder`,
// and Google asks for a date with that. The item carries the working days the page states as the longest
// wait ("dodanie 5–10 pracovných dní" → 10), and the date is counted from the day of the run.
//
// Beside each feed it writes `offers-<market>.json`: the price(s) and the availability the feed stated
// for every item. `merchant-api.mjs` compares the shop of each hour with that record and tells Google
// only what changed since. The record is not served: `/feeds/` answers the feed files and nothing else.
//
// Run it on the web server, as the timer in scripts/ops/systemd does. It touches neither PM2, nginx nor
// the build, and writes only into its own directory.
//
// Exit 0 = dry run printed, or every market written. 1 = a market could not be read. 2 = refused.
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { once } from "node:events";
import { join } from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createGzip } from "node:zlib";

export const DEFAULT_ORIGIN = "http://127.0.0.1:3000";
export const DEFAULT_SITE = "https://maky.store";
export const DEFAULT_OUT = "/var/lib/maky-feeds";
export const DEFAULT_SECRET_FILE = ".env";
export const SECRET_NAME = "REVALIDATE_SECRET";
export const ROUTE = "/api/internal/merchant-feed";
/** Products per step; the route allows up to 100. */
export const DEFAULT_PAGE_SIZE = 50;
/** A breath between two steps: the walk shares Saleor with the shop. */
export const DEFAULT_PAUSE_MS = 300;
/** How many steps a dry run reads when nobody says. */
export const DRY_RUN_PAGES = 2;
/** A new feed with fewer items than this share of the last one is a failed read until someone says otherwise. */
export const DEFAULT_MIN_SHARE = 0.5;
/** One step may take this long; then it is tried again. */
export const STEP_TIMEOUT_MS = 60_000;
/** The waits before the second, third and fourth attempt at a step. */
export const RETRY_WAITS_MS = [2_000, 10_000, 30_000];

const MARKET = /^[a-z]{2}$/;

export function readOptions(argv) {
	const { values } = parseArgs({
		args: argv,
		options: {
			markets: { type: "string", default: "sk" },
			origin: { type: "string", default: DEFAULT_ORIGIN },
			site: { type: "string", default: DEFAULT_SITE },
			out: { type: "string", default: DEFAULT_OUT },
			"secret-file": { type: "string", default: DEFAULT_SECRET_FILE },
			"page-size": { type: "string", default: String(DEFAULT_PAGE_SIZE) },
			"pause-ms": { type: "string", default: String(DEFAULT_PAUSE_MS) },
			"max-pages": { type: "string" },
			"min-share": { type: "string", default: String(DEFAULT_MIN_SHARE) },
			write: { type: "boolean", default: false },
			force: { type: "boolean", default: false },
		},
		strict: true,
	});
	const markets = [
		...new Set(
			values.markets
				.split(",")
				.map((market) => market.trim())
				.filter(Boolean),
		),
	];
	const bad = markets.find((market) => !MARKET.test(market));
	if (markets.length === 0 || bad !== undefined) {
		throw new Error(`--markets takes market codes like sk,cz${bad === undefined ? "" : ` (got "${bad}")`}`);
	}
	const number = (name, { min, max, integer = true }) => {
		const value = Number(values[name]);
		if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
			throw new Error(`--${name} must be ${integer ? "a whole number" : "a number"} from ${min} to ${max}`);
		}
		return value;
	};
	const options = {
		markets,
		origin: values.origin.replace(/\/+$/, ""),
		site: values.site.replace(/\/+$/, ""),
		out: values.out,
		secretFile: values["secret-file"],
		pageSize: number("page-size", { min: 1, max: 100 }),
		pauseMs: number("pause-ms", { min: 0, max: 60_000 }),
		maxPages: values["max-pages"] === undefined ? null : number("max-pages", { min: 1, max: 100_000 }),
		minShare: number("min-share", { min: 0, max: 1, integer: false }),
		write: values.write,
		force: values.force,
	};
	if (options.write && options.maxPages !== null) {
		throw new Error("--max-pages is for a dry run: a feed that stops early is never written");
	}
	return options;
}

/** Whether an origin is this machine. The secret goes nowhere else. */
export function isLoopback(origin) {
	let url;
	try {
		url = new URL(origin);
	} catch {
		return false;
	}
	return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

/** The value of one variable in the text of an env file, or `null`. Quotes around it are not part of it. */
export function readSecret(text, name = SECRET_NAME) {
	for (const line of text.split(/\r?\n/)) {
		const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (!match || match[1] !== name) continue;
		const raw = match[2].trim();
		const quoted = /^(["'])(.*)\1$/.exec(raw);
		const value = quoted ? quoted[2] : raw.replace(/\s+#.*$/, "");
		return value || null;
	}
	return null;
}

/** Text as XML character data. Characters XML 1.0 does not allow at all are dropped, not escaped. */
export function xmlEscape(value) {
	return String(value)
		.replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** The day `days` working days after `from` (Monday to Friday, UTC). */
export function addWorkingDays(from, days) {
	const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
	let left = days;
	while (left > 0) {
		date.setUTCDate(date.getUTCDate() + 1);
		const weekday = date.getUTCDay();
		if (weekday !== 0 && weekday !== 6) left -= 1;
	}
	return date;
}

/** `availability_date` in the form Google documents: `YYYY-MM-DDThh:mmZ`. */
export function availabilityDate(now, workingDays) {
	return `${addWorkingDays(now, workingDays).toISOString().slice(0, 10)}T00:00Z`;
}

/** `12.5 EUR`: two decimals and the currency, as Google reads a price. */
export function formatPrice(money) {
	return `${Number(money.amount).toFixed(2)} ${money.currency}`;
}

const field = (name, value) => `<g:${name}>${xmlEscape(value)}</g:${name}>`;

/** What makes a route answer an item. Anything else is a broken answer, and the walk stops on it. */
export function isItem(item) {
	return (
		item !== null &&
		typeof item === "object" &&
		typeof item.id === "string" &&
		item.id !== "" &&
		typeof item.title === "string" &&
		typeof item.link === "string" &&
		typeof item.imageLink === "string" &&
		typeof item.brand === "string" &&
		typeof item.availability === "string" &&
		item.price !== null &&
		typeof item.price === "object" &&
		Number.isFinite(item.price.amount) &&
		typeof item.price.currency === "string"
	);
}

/** One `<item>`. `now` dates a made-to-order item. */
export function renderItem(item, { now }) {
	const lines = [
		field("id", item.id),
		...(item.itemGroupId ? [field("item_group_id", item.itemGroupId)] : []),
		field("title", item.title),
		field("description", item.description || item.title),
		field("link", item.link),
		field("image_link", item.imageLink),
		...(item.additionalImageLinks ?? []).map((url) => field("additional_image_link", url)),
		field("availability", item.availability),
		...(item.availability === "backorder" && item.backorderWorkingDays
			? [field("availability_date", availabilityDate(now, item.backorderWorkingDays))]
			: []),
		field("price", formatPrice(item.price)),
		...(item.salePrice ? [field("sale_price", formatPrice(item.salePrice))] : []),
		field("brand", item.brand),
		...(item.gtin ? [field("gtin", item.gtin)] : []),
		...(item.isBundle ? [field("is_bundle", "yes")] : []),
		field("condition", "new"),
		...(item.shippingWeight
			? [field("shipping_weight", `${item.shippingWeight.value} ${item.shippingWeight.unit}`)]
			: []),
		...(item.productType ? [field("product_type", item.productType)] : []),
	];
	return `<item>\n${lines.join("\n")}\n</item>\n`;
}

export function renderHeader(market, site) {
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n` +
		`<title>MAKY.STORE (${xmlEscape(market)})</title>\n` +
		`<link>${xmlEscape(`${site}/${market}`)}</link>\n` +
		`<description>MAKY.STORE product feed, market ${xmlEscape(market)}</description>\n`
	);
}

export const FOOTER = "</channel>\n</rss>\n";

/** Whether the new feed may take the place of the last one. */
export function mayReplace({ previous, items, minShare, force }) {
	if (items === 0) return { ok: false, why: "the feed would be empty" };
	if (force || !previous || previous <= 0) return { ok: true };
	if (items < previous * minShare) {
		return {
			ok: false,
			why: `${items} items where the last feed had ${previous} (less than ${Math.round(
				minShare * 100,
			)} %); --force writes it anyway`,
		};
	}
	return { ok: true };
}

export function readStatus(dir) {
	const path = join(dir, "status.json");
	if (!existsSync(path)) return { markets: {} };
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		return parsed && typeof parsed.markets === "object" && parsed.markets ? parsed : { markets: {} };
	} catch {
		// A status file that cannot be read is no reason to stop writing feeds; it only loses the comparison.
		return { markets: {} };
	}
}

function writeStatus(dir, status) {
	const path = join(dir, "status.json");
	writeFileSync(`${path}.tmp`, `${JSON.stringify(status, null, "\t")}\n`);
	renameSync(`${path}.tmp`, path);
}

export class StepError extends Error {}

/**
 * What an item says about its offer, in the words of the feed: the two prices, the availability, and for
 * a made-to-order item the working days its date is counted from. `merchant-api.mjs` compares the shop
 * of this hour with it, so it is written beside every feed (`offers-<market>.json`).
 */
export function offerOf(item) {
	return {
		p: formatPrice(item.price),
		s: item.salePrice ? formatPrice(item.salePrice) : null,
		a: item.availability,
		d: item.availability === "backorder" && item.backorderWorkingDays ? item.backorderWorkingDays : null,
	};
}

/** Two offers say the same when their keys are equal. The date of a made-to-order item moves every day and is not part of it. */
export function offerKey(offer) {
	return `${offer.p}|${offer.s ?? ""}|${offer.a}`;
}

export const offersFileName = (market) => `offers-${market}.json`;

function writeJson(path, value) {
	writeFileSync(`${path}.tmp`, `${JSON.stringify(value)}\n`);
	renameSync(`${path}.tmp`, path);
}

/**
 * Reads one step of a market from the shop's internal route, with its retries. A 404 is not retried: the
 * route is absent or the secret is not the shop's.
 */
export function stepReader({ origin, secret, pageSize, fetchImpl, sleep, retryWaits = RETRY_WAITS_MS }) {
	return async (market, after) => {
		const url = new URL(ROUTE, origin);
		url.searchParams.set("market", market);
		url.searchParams.set("first", String(pageSize));
		if (after) url.searchParams.set("after", after);

		let last = "";
		for (let attempt = 0; attempt <= retryWaits.length; attempt += 1) {
			if (attempt > 0) await sleep(retryWaits[attempt - 1]);
			try {
				const response = await fetchImpl(url, {
					headers: { authorization: `Bearer ${secret}` },
					signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
				});
				if (response.status === 404) {
					throw new StepError(
						`${market}: the shop answered 404 (the market is not open, the build has no feed route, or the secret is not this shop's)`,
					);
				}
				if (response.status !== 200) {
					last = `HTTP ${response.status}`;
					continue;
				}
				return await response.json();
			} catch (error) {
				if (error instanceof StepError) throw error;
				last = error instanceof Error ? error.message : String(error);
			}
		}
		throw new StepError(`${market}: a step could not be read (${last})`);
	};
}

/**
 * The file a feed is written into before it takes its final name: gzip, opened at once (so there is a
 * file to remove whatever happens next), and removed again by `abandon`.
 */
function openFeedFile(path) {
	const file = createWriteStream(path, { fd: openSync(path, "w") });
	const gzip = createGzip({ level: 6 });
	let failure = null;
	const fail = (error) => {
		failure ??= error;
	};
	gzip.on("error", fail);
	file.on("error", fail);
	gzip.pipe(file);
	return {
		async write(text) {
			if (failure) throw failure;
			if (!gzip.write(text)) await once(gzip, "drain");
		},
		async close() {
			gzip.end();
			await finished(file);
			if (failure) throw failure;
		},
		async abandon() {
			gzip.destroy();
			if (!file.closed) {
				const closed = once(file, "close");
				file.destroy();
				await closed;
			}
			rmSync(path, { force: true });
		},
	};
}

/**
 * Walk one market to its end, handing every item to `onItem`.
 *
 * Throws `StepError` when a step cannot be read: a walk that ends early must never look like a whole one.
 */
export async function walkMarket({ market, getStep, maxPages, pauseMs, sleep, onItem }) {
	const totals = { read: 0, items: 0, duplicates: 0, pages: 0, skipped: {}, complete: false };
	const ids = new Set();
	const cursors = new Set();
	let after = null;

	for (;;) {
		const step = await getStep(market, after);
		if (
			!step ||
			!Array.isArray(step.items) ||
			!step.pageInfo ||
			typeof step.pageInfo.hasNextPage !== "boolean"
		) {
			throw new StepError(`${market}: step ${totals.pages + 1} is not a feed step`);
		}
		totals.pages += 1;
		totals.read += Number(step.read) || 0;
		for (const [reason, count] of Object.entries(step.skipped ?? {})) {
			totals.skipped[reason] = (totals.skipped[reason] ?? 0) + (Number(count) || 0);
		}
		for (const item of step.items) {
			if (!isItem(item))
				throw new StepError(`${market}: step ${totals.pages} holds something that is not an item`);
			if (ids.has(item.id)) {
				totals.duplicates += 1;
				continue;
			}
			ids.add(item.id);
			totals.items += 1;
			await onItem(item);
		}

		if (!step.pageInfo.hasNextPage) {
			totals.complete = true;
			return totals;
		}
		if (maxPages !== null && totals.pages >= maxPages) return totals;

		const next = step.pageInfo.endCursor;
		if (typeof next !== "string" || next === "" || cursors.has(next)) {
			throw new StepError(`${market}: the walk does not advance after step ${totals.pages}`);
		}
		cursors.add(next);
		after = next;
		if (pauseMs > 0) await sleep(pauseMs);
	}
}

const describeSkipped = (skipped) => {
	const rows = Object.entries(skipped).filter(([, count]) => count > 0);
	return rows.length === 0
		? "none left out"
		: `left out: ${rows.map(([reason, count]) => `${reason} ${count}`).join(", ")}`;
};

export async function main(argv, deps = {}) {
	const log = deps.log ?? ((line) => console.log(line));
	const fetchImpl = deps.fetch ?? globalThis.fetch;
	const now = deps.now ?? (() => new Date());
	const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const retryWaits = deps.retryWaitsMs ?? RETRY_WAITS_MS;

	let options;
	try {
		options = readOptions(argv);
	} catch (error) {
		log(`refused: ${error.message}`);
		return 2;
	}
	if (!isLoopback(options.origin)) {
		log(`refused: --origin must be this machine (http://127.0.0.1:<port>), not ${options.origin}`);
		return 2;
	}

	let secret = null;
	try {
		secret = readSecret(readFileSync(options.secretFile, "utf8"));
	} catch {
		secret = null;
	}
	if (!secret) {
		log(`refused: ${SECRET_NAME} was not found in ${options.secretFile}`);
		return 2;
	}

	const getStep = stepReader({
		origin: options.origin,
		secret,
		pageSize: options.pageSize,
		fetchImpl,
		sleep,
		retryWaits,
	});

	const maxPages = options.write ? null : options.maxPages ?? DRY_RUN_PAGES;
	if (options.write) mkdirSync(options.out, { recursive: true });
	const status = options.write ? readStatus(options.out) : { markets: {} };
	let failed = false;
	let refused = false;

	for (const market of options.markets) {
		const started = now();
		const name = `google-${market}.xml.gz`;
		const target = join(options.out, name);
		const temporary = `${target}.tmp-${process.pid}`;
		let feed = null;
		let sample = null;
		const offers = {};

		try {
			if (options.write) {
				feed = openFeedFile(temporary);
				await feed.write(renderHeader(market, options.site));
			}
			const totals = await walkMarket({
				market,
				getStep,
				maxPages,
				pauseMs: options.pauseMs,
				sleep,
				onItem: async (item) => {
					const xml = renderItem(item, { now: started });
					sample ??= xml;
					if (feed) {
						await feed.write(xml);
						offers[item.id] = offerOf(item);
					}
				},
			});

			const summary =
				`${market}: ${totals.read} products read in ${totals.pages} step(s), ${totals.items} feed item(s), ` +
				`${describeSkipped(totals.skipped)}` +
				(totals.duplicates > 0 ? `, ${totals.duplicates} repeated id(s) dropped` : "");

			if (!options.write) {
				log(summary + (totals.complete ? "." : ` (stopped after ${totals.pages} step(s): a dry run).`));
				if (sample) {
					const lines = sample.trimEnd().split("\n");
					// A description runs to 5 000 characters; the plan shows the start of each line.
					log(
						`  the first item:\n${lines
							.map((line) => `    ${line.length > 160 ? `${line.slice(0, 160)}…` : line}`)
							.join("\n")}`,
					);
				}
				continue;
			}

			await feed.write(FOOTER);
			await feed.close();

			const verdict = mayReplace({
				previous: status.markets[market]?.items,
				items: totals.items,
				minShare: options.minShare,
				force: options.force,
			});
			if (!verdict.ok) {
				rmSync(temporary, { force: true });
				log(`${summary}.`);
				log(`refused: ${market}: ${verdict.why}. The feed of the last run stays.`);
				refused = true;
				continue;
			}

			renameSync(temporary, target);
			status.markets[market] = {
				file: name,
				generatedAt: started.toISOString(),
				read: totals.read,
				items: totals.items,
				skipped: totals.skipped,
				bytes: statSync(target).size,
			};
			writeStatus(options.out, status);
			// After the feed, never before it: if this write fails, the record is older than the feed and
			// `merchant-api.mjs` sends a value the feed already has, which costs a request and nothing else.
			writeJson(join(options.out, offersFileName(market)), {
				version: 1,
				market,
				generatedAt: started.toISOString(),
				offers,
			});
			log(`${summary}. Written: ${target} (${status.markets[market].bytes} bytes).`);
		} catch (error) {
			if (feed) await feed.abandon();
			if (!(error instanceof StepError)) throw error;
			log(`failed: ${error.message}.${options.write ? " The feed of the last run stays." : ""}`);
			failed = true;
		}
	}

	if (!options.write) log("dry run: nothing was written. Add --write to write the feed.");
	return failed ? 1 : refused ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
