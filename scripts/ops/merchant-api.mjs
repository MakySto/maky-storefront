#!/usr/bin/env node
// Tell Google Merchant Center, between two fetches of the feed, that a price or an availability changed.
//
//   node scripts/ops/merchant-api.mjs                      # dry run: Slovakia, compares and prints the plan, sends nothing
//   node scripts/ops/merchant-api.mjs --check              # reads the Merchant Center account: is everything linked?
//   node scripts/ops/merchant-api.mjs --show <offer id>    # what Google holds for one product now
//   node scripts/ops/merchant-api.mjs --market sk --fire   # sends the changes
//
// What it is, and what it is not. The feed (`merchant-feed.mjs`, `/feeds/google-<market>.xml.gz`) is the
// source of the products: Google fetches it once a day, and a product exists in Merchant Center because
// the feed names it (owner, 2026-11-15). The Merchant API cannot change a product that came from a file
// ("Only API data sources are supported"), so this program writes into a second, SUPPLEMENTAL data source
// of type API that Merchant Center joins onto the feed's: for a product it holds, its price and
// availability stand in front of the feed's; everything else, and every product it does not hold, is the
// feed's. It never adds a product and never removes one.
//
// The shop says what an offer is, here as in the feed: this program walks the same internal route
// (`/api/internal/merchant-feed`), so the price and the availability it sends are the ones the product
// page states. It holds no rule of its own about either.
//
// What is sent. For each product of the last written feed (`offers-<market>.json`, written by
// `merchant-feed.mjs` beside the feed), the offer the shop states now is compared with what Google was
// last told: by this program if it ever sent that product, otherwise by the feed. Only a difference is
// sent, as one `productInputs:insert` with the id, the feed label, the language, the price(s) and the
// availability. A product the supplemental source holds is kept true from then on, because there its
// value wins over the feed's.
//
// Rules this file enforces rather than documents:
//
//   1. Dry run by default. `--fire` is the only way anything leaves the machine. `--check` and `--show`
//      read from Google and change nothing.
//   2. A walk that did not reach the end of the catalogue sends nothing: "not seen" must never be taken
//      for "gone".
//   3. A product the walk no longer finds (withdrawn from sale, or it lost its price, picture or brand) is
//      told `out_of_stock`, and only when two runs in a row missed it. A product that is new since the
//      last feed is left to the next feed.
//   4. When more than a quarter of the feed's products differ at once, nothing is sent without `--force`:
//      that is a failed read, a currency or tax switch, or a rewrite, and the next feed carries it anyway.
//      A run sends at most `--max` changes; the rest wait for the next run.
//   5. Before anything is sent the account is read: the feed's data source must exist, and exactly one
//      supplemental API source must be linked in its default rule AHEAD of the feed itself. Linked after
//      it, or not at all, every request would be accepted by Google and change nothing.
//   6. The key of the Google service account is read at run time from AWS SSM (a SecureString, by name)
//      or from a file named on the command line. It is never written to disk by this program, never
//      printed, and the signed request for a token goes to Google's token address only. The shop's
//      process never holds it.
//   7. Only what Google accepted (HTTP 200) is recorded as told.
//
// Not verified on the account when this was written (2026-11-15), and to be looked at with `--show` on the
// first real cases: that a product whose sale ended is shown at its full price when the supplemental
// source ends the sale with a `salePriceEffectiveDate` that lies in the past (the feed of that morning
// still states the sale price), and how long Google takes to show an accepted change ("several minutes").
//
// Run it on the web server, as the timer in scripts/ops/systemd does. It touches neither PM2, nginx nor
// the build, and writes only `api-<market>.json` in the feed directory.
//
// Exit 0 = plan printed, or everything due was sent. 1 = the shop or Google could not be read, or Google
// refused. 2 = refused before anything was sent.
import { execFile } from "node:child_process";
import { createSign } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import {
	DEFAULT_ORIGIN,
	DEFAULT_OUT,
	DEFAULT_PAGE_SIZE,
	DEFAULT_PAUSE_MS,
	DEFAULT_SECRET_FILE,
	SECRET_NAME,
	StepError,
	addWorkingDays,
	isLoopback,
	offerKey,
	offerOf,
	offersFileName,
	readSecret,
	stepReader,
	walkMarket,
} from "./merchant-feed.mjs";

export const API_BASE = "https://merchantapi.googleapis.com";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const SCOPE = "https://www.googleapis.com/auth/content";
export const DEFAULT_KEY_SSM = "/maky/storefront/google/merchant-api-key";
export const DEFAULT_REGION = "eu-central-1";
/** Changes one run sends at most. */
export const DEFAULT_MAX = 500;
/** More than this share of the feed's products differing at once is not a set of changes. */
export const DEFAULT_MAX_SHARE = 0.25;
/** Below this many changes the share is not asked: a feed of forty products may well change ten. */
export const SHARE_FLOOR = 20;
/** A breath between two requests to Google. */
export const DEFAULT_SEND_PAUSE_MS = 100;
/** Requests Google refuses for the item's own sake before the run stops. */
export const MAX_ITEM_FAILURES = 5;
/** The waits before a request that met a 429 or a 5xx is tried again. */
export const SEND_RETRY_WAITS_MS = [2_000, 10_000];
const REQUEST_TIMEOUT_MS = 30_000;
const SAVE_EVERY = 50;

const MARKET = /^[a-z]{2}$/;
const AVAILABILITY = { in_stock: "IN_STOCK", out_of_stock: "OUT_OF_STOCK", backorder: "BACKORDER" };

export const stateFileName = (market) => `api-${market}.json`;

export function readOptions(argv) {
	const { values } = parseArgs({
		args: argv,
		options: {
			market: { type: "string", default: "sk" },
			origin: { type: "string", default: DEFAULT_ORIGIN },
			out: { type: "string", default: DEFAULT_OUT },
			"secret-file": { type: "string", default: DEFAULT_SECRET_FILE },
			"page-size": { type: "string", default: String(DEFAULT_PAGE_SIZE) },
			"pause-ms": { type: "string", default: String(DEFAULT_PAUSE_MS) },
			"key-ssm": { type: "string", default: DEFAULT_KEY_SSM },
			"key-file": { type: "string" },
			region: { type: "string", default: process.env.AWS_REGION || DEFAULT_REGION },
			account: { type: "string" },
			"data-source": { type: "string" },
			max: { type: "string", default: String(DEFAULT_MAX) },
			"max-share": { type: "string", default: String(DEFAULT_MAX_SHARE) },
			"send-pause-ms": { type: "string", default: String(DEFAULT_SEND_PAUSE_MS) },
			check: { type: "boolean", default: false },
			show: { type: "string" },
			fire: { type: "boolean", default: false },
			force: { type: "boolean", default: false },
		},
		strict: true,
	});
	if (!MARKET.test(values.market))
		throw new Error(`--market takes one market code like sk (got "${values.market}")`);
	const number = (name, { min, max, integer = true }) => {
		const value = Number(values[name]);
		if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
			throw new Error(`--${name} must be ${integer ? "a whole number" : "a number"} from ${min} to ${max}`);
		}
		return value;
	};
	if (values.account !== undefined && !/^\d{1,20}$/.test(values.account)) {
		throw new Error("--account takes the number of the Merchant Center account");
	}
	if (values["data-source"] !== undefined && !/^\d{1,20}$/.test(values["data-source"])) {
		throw new Error("--data-source takes the number of the supplemental data source");
	}
	if (!/^\/[A-Za-z0-9_.\-/]{1,500}$/.test(values["key-ssm"])) {
		throw new Error(
			"--key-ssm takes the name of an SSM parameter, like /maky/storefront/google/merchant-api-key",
		);
	}
	const modes = [values.check, values.show !== undefined, values.fire].filter(Boolean).length;
	if (modes > 1) throw new Error("--check, --show and --fire are three different runs: name one");
	return {
		market: values.market,
		origin: values.origin.replace(/\/+$/, ""),
		out: values.out,
		secretFile: values["secret-file"],
		pageSize: number("page-size", { min: 1, max: 100 }),
		pauseMs: number("pause-ms", { min: 0, max: 60_000 }),
		keySsm: values["key-ssm"],
		keyFile: values["key-file"] ?? null,
		region: values.region,
		account: values.account ?? null,
		dataSource: values["data-source"] ?? null,
		max: number("max", { min: 1, max: 50_000 }),
		maxShare: number("max-share", { min: 0, max: 1, integer: false }),
		sendPauseMs: number("send-pause-ms", { min: 0, max: 60_000 }),
		check: values.check,
		show: values.show ?? null,
		fire: values.fire,
		force: values.force,
	};
}

/** `899.00 EUR` as the API's price: micros as a string, counted in whole cents so no float is involved. */
export function toMicros(price) {
	const match = /^(\d+)\.(\d{2}) ([A-Z]{3})$/.exec(price);
	if (!match) throw new Error(`not a price: ${price}`);
	return {
		amountMicros: String(BigInt(match[1]) * 1_000_000n + BigInt(match[2]) * 10_000n),
		currencyCode: match[3],
	};
}

/**
 * The product input that states one offer in the supplemental source.
 *
 * `fileOffer` is what the feed of the last write stated. It matters for one case: the feed stated a sale
 * price and the shop has none now. The supplemental source cannot take an attribute away from the
 * feed's product, it can only state another one, so the sale is ended by its dates: an effective period
 * that closed at `now` leaves the feed's sale price without effect.
 */
export function productInputOf({ id, offer, fileOffer, feedLabel, contentLanguage, now }) {
	const availability = AVAILABILITY[offer.a];
	if (!availability) throw new Error(`not an availability: ${offer.a}`);
	const attributes = { price: toMicros(offer.p), availability };
	if (offer.s) {
		attributes.salePrice = toMicros(offer.s);
	} else if (fileOffer?.s) {
		attributes.salePriceEffectiveDate = {
			startTime: "2000-01-01T00:00:00Z",
			endTime: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
		};
	}
	if (offer.a === "backorder" && offer.d) {
		attributes.availabilityDate = `${addWorkingDays(now, offer.d).toISOString().slice(0, 10)}T00:00:00Z`;
	}
	return { offerId: id, contentLanguage, feedLabel, productAttributes: attributes };
}

/**
 * What to send, from what the feed stated, what was sent before and what the shop states now. Pure.
 *
 * @param file     `{ [id]: offer }` of the last written feed.
 * @param pushed   `{ [id]: { o: offer, at } }`: what the supplemental source holds.
 * @param missing  `{ [id]: iso }`: products an earlier run did not find, with the time it first missed them.
 * @param current  `{ [id]: offer }` of a walk that reached the end.
 */
export function planFor({ file, pushed, missing, current, now }) {
	const send = [];
	const missingNext = {};
	let unchanged = 0;
	let waiting = 0;

	for (const id of Object.keys(current)) if (!(id in file)) waiting += 1;

	for (const [id, fileOffer] of Object.entries(file)) {
		const told = pushed[id]?.o ?? fileOffer;
		const offer = current[id];
		if (offer) {
			if (offerKey(offer) === offerKey(told)) unchanged += 1;
			else send.push({ id, offer, told, fileOffer, gone: false });
			continue;
		}
		if (told.a === "out_of_stock") {
			unchanged += 1;
			continue;
		}
		if (missing[id]) {
			// The price it was last told stays; a withdrawn product has none of its own to state.
			send.push({
				id,
				offer: { p: told.p, s: null, a: "out_of_stock", d: null },
				told,
				fileOffer,
				gone: true,
			});
			missingNext[id] = missing[id];
		} else {
			missingNext[id] = now.toISOString();
		}
	}
	return { send, unchanged, waiting, missingNext, total: Object.keys(file).length };
}

/** Whether this many changes may go out at once. */
export function mayTell({ changes, total, maxShare, force }) {
	if (force || changes <= SHARE_FLOOR || changes <= total * maxShare) return { ok: true };
	return {
		ok: false,
		why: `${changes} of the feed's ${total} products differ at once (more than ${Math.round(
			maxShare * 100,
		)} %): that is not a set of changes; --force sends them anyway`,
	};
}

const describeOffer = (offer) => `${offer.s ? `${offer.s} (before ${offer.p})` : offer.p} ${offer.a}`;

function readJson(path) {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

function writeJson(path, value) {
	writeFileSync(`${path}.tmp`, `${JSON.stringify(value)}\n`);
	renameSync(`${path}.tmp`, path);
}

const isOffer = (offer) =>
	offer !== null &&
	typeof offer === "object" &&
	typeof offer.p === "string" &&
	typeof offer.a === "string" &&
	(offer.s === null || typeof offer.s === "string");

/** The offers of the last written feed, or `null` when there is none that can be read. */
export function readFileOffers(dir, market) {
	const parsed = readJson(join(dir, offersFileName(market)));
	if (!parsed || parsed.market !== market || !parsed.offers || typeof parsed.offers !== "object") return null;
	const offers = {};
	for (const [id, offer] of Object.entries(parsed.offers)) if (isOffer(offer)) offers[id] = offer;
	return { generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : null, offers };
}

/** What this program has told Google. A state that cannot be read is an empty one: the feed is then the only record. */
export function readState(dir, market) {
	const empty = { version: 1, market, dataSource: null, pushed: {}, missing: {} };
	const parsed = readJson(join(dir, stateFileName(market)));
	if (!parsed || parsed.market !== market) return empty;
	const pushed = {};
	for (const [id, entry] of Object.entries(parsed.pushed ?? {})) {
		if (entry && isOffer(entry.o)) pushed[id] = { o: entry.o, at: String(entry.at ?? "") };
	}
	const missing = {};
	for (const [id, at] of Object.entries(parsed.missing ?? {})) if (typeof at === "string") missing[id] = at;
	return {
		version: 1,
		market,
		dataSource: typeof parsed.dataSource === "string" ? parsed.dataSource : null,
		pushed,
		missing,
	};
}

/**
 * The service account's key, parsed. Nothing of it is ever part of a message.
 *
 * @returns {{ client_email: string, private_key: string, private_key_id?: string }}
 */
export function parseKey(text) {
	/** @type {any} */
	let key;
	try {
		key = JSON.parse(text);
	} catch {
		throw new Error("the key is not JSON (it must be the service account's key file as Google gave it)");
	}
	if (
		!key ||
		key.type !== "service_account" ||
		typeof key.client_email !== "string" ||
		typeof key.private_key !== "string" ||
		!key.private_key.includes("PRIVATE KEY")
	) {
		throw new Error("the key is not a service account key (type, client_email and private_key are expected)");
	}
	return key;
}

async function loadKey(options, deps) {
	if (deps.readKey) return parseKey(await deps.readKey(options));
	if (options.keyFile) return parseKey(readFileSync(options.keyFile, "utf8"));
	const args = [
		"ssm",
		"get-parameter",
		"--region",
		options.region,
		"--name",
		options.keySsm,
		"--with-decryption",
		"--query",
		"Parameter.Value",
		"--output",
		"text",
	];
	// systemd's PATH has no /snap/bin, where the CLI lives on some boxes (sync-secrets.sh looks there too).
	const candidates = [process.env.AWS_CLI, "aws", "/snap/bin/aws"].filter(Boolean);
	let stdout = null;
	for (const aws of candidates) {
		try {
			({ stdout } = await promisify(execFile)(aws, args, { maxBuffer: 1024 * 1024 }));
			break;
		} catch (error) {
			if (error?.code === "ENOENT") continue;
			// The CLI's error names the parameter and the reason, never a value.
			const reason = /ParameterNotFound/.test(String(error?.stderr))
				? "it is not there yet"
				: "it could not be read";
			throw new Error(`the key in SSM (${options.keySsm}, ${options.region}): ${reason}`);
		}
	}
	if (stdout === null)
		throw new Error(
			"the key in SSM: the aws CLI was not found (set AWS_CLI, or name a file with --key-file)",
		);
	return parseKey(stdout);
}

const base64url = (value) => Buffer.from(value).toString("base64url");

/** A client for the Merchant API that signs in as the service account. One token serves the run. */
export function googleClient({ key, fetchImpl, now, apiBase = API_BASE, tokenUrl = TOKEN_URL }) {
	let token = null;

	const signIn = async () => {
		const issued = Math.floor(now().getTime() / 1000);
		const unsigned = `${base64url(
			JSON.stringify({
				alg: "RS256",
				typ: "JWT",
				...(key.private_key_id ? { kid: key.private_key_id } : {}),
			}),
		)}.${base64url(
			JSON.stringify({
				iss: key.client_email,
				scope: SCOPE,
				aud: TOKEN_URL,
				iat: issued,
				exp: issued + 3600,
			}),
		)}`;
		const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");
		const response = await fetchImpl(tokenUrl, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion: `${unsigned}.${signature}`,
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const answer = await response.json().catch(() => null);
		if (response.status !== 200 || typeof answer?.access_token !== "string") {
			throw new GoogleError(
				`Google gave no token (HTTP ${response.status}${
					typeof answer?.error === "string" ? `, ${answer.error}` : ""
				}): the key is not accepted`,
			);
		}
		return answer.access_token;
	};

	return {
		async call(method, path, { query, body } = {}) {
			token ??= await signIn();
			const url = new URL(`${apiBase}/${path}`);
			for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
			const response = await fetchImpl(url, {
				method,
				headers: {
					authorization: `Bearer ${token}`,
					...(body === undefined ? {} : { "content-type": "application/json" }),
				},
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			const json = await response.json().catch(() => null);
			return { status: response.status, json };
		},
	};
}

export class GoogleError extends Error {}

const googleMessage = (answer) => {
	const message = answer?.json?.error?.message;
	return `HTTP ${answer.status}${typeof message === "string" ? `: ${message.slice(0, 300)}` : ""}`;
};

async function listAll(client, path, field) {
	const rows = [];
	let pageToken = null;
	for (let page = 0; page < 50; page += 1) {
		const answer = await client.call("GET", path, {
			query: { pageSize: "250", ...(pageToken ? { pageToken } : {}) },
		});
		if (answer.status !== 200) throw new GoogleError(`${path}: ${googleMessage(answer)}`);
		rows.push(...(Array.isArray(answer.json?.[field]) ? answer.json[field] : []));
		pageToken = answer.json?.nextPageToken || null;
		if (!pageToken) return rows;
	}
	throw new GoogleError(`${path}: the list does not end`);
}

/**
 * Reads the account and finds the two data sources this program needs: the one that fetches the market's
 * feed, and the supplemental API source linked ahead of it. Throws `GoogleError` with what is missing.
 */
export async function discover({ client, market, account, dataSource }) {
	let accountId = account;
	if (!accountId) {
		const accounts = await listAll(client, "accounts/v1/accounts", "accounts");
		const ids = accounts.map((row) =>
			String(
				row.accountId ??
					String(row.name ?? "")
						.split("/")
						.pop(),
			),
		);
		if (ids.length !== 1) {
			throw new GoogleError(
				ids.length === 0
					? "the service account sees no Merchant Center account: add its e-mail as a user there"
					: `the service account sees ${ids.length} accounts (${ids.join(", ")}): name one with --account`,
			);
		}
		accountId = ids[0];
	}

	const sources = await listAll(client, `datasources/v1/accounts/${accountId}/dataSources`, "dataSources");
	const feedPath = `/feeds/google-${market}.xml.gz`;
	const primaries = sources.filter(
		(source) =>
			source.primaryProductDataSource &&
			String(source.fileInput?.fetchSettings?.fetchUri ?? "")
				.split("?")[0]
				.endsWith(feedPath),
	);
	if (primaries.length !== 1) {
		throw new GoogleError(
			primaries.length === 0
				? `no product source in Merchant Center fetches ${feedPath}: add the feed there first`
				: `${primaries.length} product sources fetch ${feedPath}: there must be one`,
		);
	}
	const primary = primaries[0];
	const rule = primary.primaryProductDataSource.defaultRule?.takeFromDataSources ?? [];
	const selfAt = rule.findIndex((reference) => reference.self === true);
	const ahead = (selfAt === -1 ? rule : rule.slice(0, selfAt)).map(
		(reference) => reference.supplementalDataSourceName,
	);
	const behind = (selfAt === -1 ? [] : rule.slice(selfAt + 1)).map(
		(reference) => reference.supplementalDataSourceName,
	);

	const apiSources = sources.filter(
		(source) => source.supplementalProductDataSource && source.input === "API",
	);
	const wanted = dataSource ? `accounts/${accountId}/dataSources/${dataSource}` : null;
	const linked = apiSources.filter(
		(source) => ahead.includes(source.name) && (!wanted || source.name === wanted),
	);
	if (linked.length !== 1) {
		const late = apiSources.filter((source) => behind.includes(source.name));
		throw new GoogleError(
			linked.length > 1
				? `${linked.length} supplemental API sources are linked ahead of the feed: name one with --data-source`
				: late.length > 0
					? `the supplemental API source "${late[0].displayName}" is linked AFTER the feed in the default rule, so the feed's values would win: move it ahead of the feed`
					: apiSources.length > 0
						? `the supplemental API source "${apiSources[0].displayName}" exists and is not linked to the feed's source "${primary.displayName}": link it in the default rule, ahead of the feed`
						: `there is no supplemental data source of type API: create one in Merchant Center and link it to "${primary.displayName}"`,
		);
	}
	const supplemental = linked[0];
	const feedLabel = primary.primaryProductDataSource.feedLabel;
	const contentLanguage = primary.primaryProductDataSource.contentLanguage;
	if (
		typeof feedLabel !== "string" ||
		typeof contentLanguage !== "string" ||
		!feedLabel ||
		!contentLanguage
	) {
		throw new GoogleError(`the feed's source "${primary.displayName}" states no feed label or language`);
	}
	const own = supplemental.supplementalProductDataSource;
	if (
		(own.feedLabel && own.feedLabel !== feedLabel) ||
		(own.contentLanguage && own.contentLanguage !== contentLanguage)
	) {
		throw new GoogleError(
			`the supplemental source is for ${own.contentLanguage}~${own.feedLabel} and the feed is ${contentLanguage}~${feedLabel}`,
		);
	}
	return {
		accountId,
		feedLabel,
		contentLanguage,
		primary: {
			name: primary.name,
			displayName: primary.displayName,
			fetch: primary.fileInput?.fetchSettings ?? null,
		},
		supplemental: { name: supplemental.name, displayName: supplemental.displayName },
	};
}

/** The account's allowance for product inputs, as Google states it today. Never a reason to fail a check. */
async function describeQuota(client, accountId) {
	try {
		const groups = await listAll(client, `quota/v1/accounts/${accountId}/quotas`, "quotaGroups");
		const group = groups.find((row) =>
			(row.methodDetails ?? []).some((method) => /productInputs/.test(`${method.path} ${method.method}`)),
		);
		if (!group) return "quota for product inputs: Google lists none.";
		return `quota for product inputs: ${group.quotaUsage ?? "?"} used of ${group.quotaLimit ?? "?"} a day, ${
			group.quotaMinuteLimit ?? "?"
		} a minute.`;
	} catch (error) {
		return `quota for product inputs: could not be read (${
			error instanceof Error ? error.message : String(error)
		}).`;
	}
}

const describeFetch = (fetch) => {
	if (!fetch) return "no schedule read";
	const hour = fetch.timeOfDay?.hours ?? 0;
	return `${fetch.enabled === false ? "PAUSED, " : ""}${String(fetch.frequency ?? "")
		.replace("FREQUENCY_", "")
		.toLowerCase()} at ${String(hour).padStart(2, "0")}:00 ${fetch.timeZone ?? "UTC"}`;
};

export async function main(argv, deps = {}) {
	const log = deps.log ?? ((line) => console.log(line));
	const fetchImpl = deps.fetch ?? globalThis.fetch;
	const now = deps.now ?? (() => new Date());
	const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const sendRetryWaits = deps.sendRetryWaitsMs ?? SEND_RETRY_WAITS_MS;

	let options;
	try {
		options = readOptions(argv);
	} catch (error) {
		log(`refused: ${error.message}`);
		return 2;
	}
	const { market } = options;

	/** Signs in and reads the account. Only the runs that talk to Google come here. */
	const connect = async () => {
		const key = await loadKey(options, deps);
		const client = googleClient({
			key,
			fetchImpl,
			now,
			apiBase: deps.apiBase ?? API_BASE,
			tokenUrl: deps.tokenUrl ?? TOKEN_URL,
		});
		const found = await discover({
			client,
			market,
			account: options.account,
			dataSource: options.dataSource,
		});
		return { client, found };
	};

	if (options.check || options.show !== null) {
		try {
			const { client, found } = await connect();
			if (options.check) {
				log(
					`account ${found.accountId}: the feed's source "${found.primary.displayName}" (${
						found.contentLanguage
					}~${found.feedLabel}, fetched ${describeFetch(found.primary.fetch)}).`,
				);
				log(
					`supplemental API source "${found.supplemental.displayName}" is linked ahead of the feed: changes sent here will show.`,
				);
				log(await describeQuota(client, found.accountId));
				return 0;
			}
			const name = base64url(`${found.contentLanguage}~${found.feedLabel}~${options.show}`);
			const answer = await client.call("GET", `products/v1/accounts/${found.accountId}/products/${name}`);
			if (answer.status !== 200) {
				log(`failed: ${options.show}: ${googleMessage(answer)}.`);
				return 1;
			}
			const attributes = answer.json?.productAttributes ?? {};
			const money = (price) =>
				price ? `${(Number(price.amountMicros) / 1_000_000).toFixed(2)} ${price.currencyCode}` : "none";
			log(
				`${options.show}: price ${money(attributes.price)}, sale price ${money(attributes.salePrice)}, ${
					attributes.availability ?? "no availability"
				}.`,
			);
			if (attributes.salePriceEffectiveDate) {
				log(
					`  sale price in effect ${attributes.salePriceEffectiveDate.startTime ?? "…"} to ${
						attributes.salePriceEffectiveDate.endTime ?? "…"
					}`,
				);
			}
			if (attributes.availabilityDate) log(`  available from ${attributes.availabilityDate}`);
			return 0;
		} catch (error) {
			log(`failed: ${error instanceof Error ? error.message : String(error)}.`);
			return 1;
		}
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

	const file = readFileOffers(options.out, market);
	if (!file) {
		log(
			`refused: ${market}: no feed has been written yet (${join(
				options.out,
				offersFileName(market),
			)}). The API only changes what a feed has stated.`,
		);
		return 2;
	}

	// Google first when something is to be sent: a missing link is found before Saleor is walked.
	let connection = null;
	if (options.fire) {
		try {
			connection = await connect();
		} catch (error) {
			log(`failed: ${error.message}.`);
			return 1;
		}
	}

	const state = readState(options.out, market);
	if (connection && state.dataSource !== connection.found.supplemental.name) {
		// Another source holds nothing of what was sent to the last one.
		state.pushed = {};
		state.dataSource = connection.found.supplemental.name;
	}

	const current = {};
	let totals;
	try {
		totals = await walkMarket({
			market,
			getStep: stepReader({
				origin: options.origin,
				secret,
				pageSize: options.pageSize,
				fetchImpl,
				sleep,
				...(deps.retryWaitsMs ? { retryWaits: deps.retryWaitsMs } : {}),
			}),
			maxPages: null,
			pauseMs: options.pauseMs,
			sleep,
			onItem: async (item) => {
				current[item.id] = offerOf(item);
			},
		});
	} catch (error) {
		if (!(error instanceof StepError)) throw error;
		log(`failed: ${error.message}. Nothing was sent.`);
		return 1;
	}
	if (!totals.complete) {
		log(`failed: ${market}: the walk did not reach the end. Nothing was sent.`);
		return 1;
	}

	const started = now();
	const plan = planFor({
		file: file.offers,
		pushed: state.pushed,
		missing: state.missing,
		current,
		now: started,
	});
	const gone = plan.send.filter((change) => change.gone).length;
	log(
		`${market}: the feed of ${file.generatedAt ?? "an unknown time"} states ${
			plan.total
		} product(s); the shop states ${totals.items} now. ` +
			`${plan.send.length} to tell Google (${gone} no longer sold), ${plan.unchanged} unchanged, ${plan.waiting} new and waiting for the next feed.`,
	);
	for (const change of plan.send.slice(0, 5)) {
		log(`  ${change.id}: ${describeOffer(change.told)} → ${describeOffer(change.offer)}`);
	}

	const verdict = mayTell({
		changes: plan.send.length,
		total: plan.total,
		maxShare: options.maxShare,
		force: options.force,
	});
	if (!verdict.ok) {
		log(`refused: ${market}: ${verdict.why}.`);
		return 2;
	}

	if (!connection) {
		log("dry run: nothing was sent. Add --fire to send the changes.");
		return 0;
	}

	const { client, found } = connection;
	const save = () =>
		writeJson(join(options.out, stateFileName(market)), { ...state, lastRun: started.toISOString() });
	state.missing = plan.missingNext;

	const due = plan.send.slice(0, options.max);
	let sent = 0;
	let itemFailures = 0;
	let stopped = null;

	for (const change of due) {
		const body = productInputOf({
			id: change.id,
			offer: change.offer,
			fileOffer: change.fileOffer,
			feedLabel: found.feedLabel,
			contentLanguage: found.contentLanguage,
			now: started,
		});
		let answer = null;
		for (let attempt = 0; attempt <= sendRetryWaits.length; attempt += 1) {
			if (attempt > 0) await sleep(sendRetryWaits[attempt - 1]);
			try {
				answer = await client.call("POST", `products/v1/accounts/${found.accountId}/productInputs:insert`, {
					query: { dataSource: found.supplemental.name },
					body,
				});
			} catch (error) {
				answer = {
					status: 0,
					json: { error: { message: error instanceof Error ? error.message : String(error) } },
				};
			}
			if (answer.status !== 429 && answer.status !== 0 && answer.status < 500) break;
		}

		if (answer.status === 200) {
			state.pushed[change.id] = { o: change.offer, at: started.toISOString() };
			sent += 1;
			if (sent % SAVE_EVERY === 0) save();
		} else if (answer.status === 400 || answer.status === 404) {
			itemFailures += 1;
			log(`  not accepted: ${change.id}: ${googleMessage(answer)}`);
			if (itemFailures >= MAX_ITEM_FAILURES) {
				stopped = `${itemFailures} products were not accepted`;
				break;
			}
		} else {
			stopped = googleMessage(answer);
			break;
		}
		if (options.sendPauseMs > 0) await sleep(options.sendPauseMs);
	}
	save();

	const left = plan.send.length - sent - itemFailures;
	log(
		`${market}: ${sent} change(s) told to Google (source "${found.supplemental.displayName}")` +
			(left > 0 ? `, ${left} left for the next run` : "") +
			".",
	);
	if (stopped) {
		log(
			`failed: Google stopped the run (${stopped}). What was accepted is recorded; the rest goes with the next run.`,
		);
		return 1;
	}
	return itemFailures > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
