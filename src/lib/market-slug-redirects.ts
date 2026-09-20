import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { MARKET_LANGUAGE_CODE } from "@/config/market-language";

/**
 * The market slugs CFM owns, and the old URL each one replaced.
 *
 * PUBLIC_MARKET_URL_V2: a foreign market's product URL is authored and stored in CFM, the
 * same way the Slovak one is. The storefront never generates, derives or normalizes a slug —
 * it reads what Saleor serves and, for a URL that has been replaced, it reads this map. The
 * map is CFM's `cfm.commerce2.market-slug-redirects/1` file, delivered whole:
 *
 *     { "schema": "cfm.commerce2.market-slug-redirects/1",
 *       "entries": [ { "cfm_product_id": "CFMP-B-NOR-…", "language_code": "DE_AT",
 *                      "old_slug": "dachtrager-…-cfmp-b-nor-…", "new_slug": "dachtrager-…" } ] }
 *
 * `language_code` is the market's exact-locale code (contract v2), so one entry belongs to
 * exactly one market: `DE` to `de`, `DE_AT` to `at`, `EN` to `us`, `EN_CA` to `ca`. An entry
 * for a code no market reads — `SK`, `EN_US`, a typo — is dropped and counted, never guessed.
 *
 * ## Where it comes from, and what happens when it is wrong
 *
 * `MAKY_MARKET_SLUG_REDIRECTS_PATH` names the delivered file and
 * `MAKY_MARKET_SLUG_REDIRECTS_SHA256` pins its bytes, exactly as the catalogue content
 * artifact is pinned. Read once per process, so a new delivery is a restart, not a rebuild.
 * Every failure — no path, unreadable, wrong checksum, wrong schema, malformed entry — ends
 * in the same place: NO redirects. That is the safe direction, because the URL the visitor
 * typed is the one Saleor still serves until the swap.
 */

export const MARKET_SLUG_REDIRECTS_SCHEMA = "cfm.commerce2.market-slug-redirects/1";

export interface MarketSlugRedirect {
	/** CFM's identity for the product that must own the target, e.g. `CFMP-B-NOR-a51bec20924e7e-000000`. */
	readonly cfmProductId: string;
	readonly newSlug: string;
}

export interface MarketSlugRedirectIndex {
	/** market → old slug → target. */
	readonly byMarket: ReadonlyMap<string, ReadonlyMap<string, MarketSlugRedirect>>;
	readonly entries: number;
	readonly markets: number;
	/** Entries the storefront refused, by reason. Diagnostics only — never a silent drop. */
	readonly skipped: Readonly<Record<string, number>>;
}

const EMPTY: MarketSlugRedirectIndex = { byMarket: new Map(), entries: 0, markets: 0, skipped: {} };

/**
 * Exact-locale code → market, inverted from the one table the contract test pins.
 * `config/market-language.ts` says why the proxy reads it there and not from `LOCALE_MAP`.
 */
const MARKET_BY_LANGUAGE = new Map(
	Object.entries(MARKET_LANGUAGE_CODE).map(([market, code]) => [code, market]),
);

/** A slug the storefront is willing to put in a URL — the contract's own product slug form. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `cfm:product:CFMP-…` (Saleor's externalReference) and `CFMP-…` (the map) are the same identity. */
export function sameCfmProduct(externalReference: string | null | undefined, cfmProductId: string): boolean {
	if (!externalReference) return false;
	const strip = (value: string) =>
		value
			.trim()
			.toLowerCase()
			.replace(/^cfm:product:/, "");
	return strip(externalReference) === strip(cfmProductId) && strip(cfmProductId).length > 0;
}

/**
 * Parse one delivered file into the lookup the proxy uses.
 *
 * Chains are flattened here, once, rather than followed per request: if `a → b` and `b → c`
 * both appear, `a` resolves to `c` and the visitor gets ONE permanent redirect. A cycle, or a
 * chain longer than the catalogue could honestly produce, drops the entries that form it.
 */
export function parseMarketSlugRedirects(text: string): MarketSlugRedirectIndex {
	const skipped: Record<string, number> = {};
	const skip = (reason: string) => {
		skipped[reason] = (skipped[reason] ?? 0) + 1;
	};

	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		return { ...EMPTY, skipped: { "unparsable-json": 1 } };
	}

	const document = payload as { schema?: unknown; entries?: unknown };
	if (document?.schema !== MARKET_SLUG_REDIRECTS_SCHEMA) {
		return { ...EMPTY, skipped: { "wrong-schema": 1 } };
	}
	if (!Array.isArray(document.entries)) {
		return { ...EMPTY, skipped: { "entries-not-an-array": 1 } };
	}

	const byMarket = new Map<string, Map<string, MarketSlugRedirect>>();

	for (const raw of document.entries) {
		const entry = raw as Record<string, unknown>;
		const market = MARKET_BY_LANGUAGE.get(String(entry?.language_code ?? "").toUpperCase());
		if (!market) {
			skip("language-no-market-reads");
			continue;
		}
		const cfmProductId = typeof entry.cfm_product_id === "string" ? entry.cfm_product_id.trim() : "";
		const oldSlug = typeof entry.old_slug === "string" ? entry.old_slug.trim() : "";
		const newSlug = typeof entry.new_slug === "string" ? entry.new_slug.trim() : "";
		if (!cfmProductId || !oldSlug || !newSlug) {
			skip("incomplete-entry");
			continue;
		}
		// The target is a URL this application will build. The source is whatever CFM
		// published before, so it is checked only for being a single usable segment.
		if (!SLUG.test(newSlug) || oldSlug.includes("/") || newSlug.length > 255) {
			skip("unusable-slug");
			continue;
		}
		if (oldSlug === newSlug) {
			skip("same-slug");
			continue;
		}

		const market_map = byMarket.get(market) ?? new Map<string, MarketSlugRedirect>();
		const existing = market_map.get(oldSlug);
		if (existing && existing.newSlug !== newSlug) {
			// Two products claiming one old URL. Sending the visitor to either is a guess,
			// and a guess here is the "foreign product" the contract forbids.
			market_map.delete(oldSlug);
			skip("ambiguous-old-slug");
			byMarket.set(market, market_map);
			continue;
		}
		market_map.set(oldSlug, { cfmProductId, newSlug });
		byMarket.set(market, market_map);
	}

	for (const [market, market_map] of byMarket) {
		flattenChains(market_map, skip);
		if (market_map.size === 0) byMarket.delete(market);
	}

	let entries = 0;
	for (const market_map of byMarket.values()) entries += market_map.size;
	return { byMarket, entries, markets: byMarket.size, skipped };
}

const MAX_CHAIN = 8;

/**
 * Follow every chain to its end, once, so a visitor never gets two redirects.
 *
 * A chain is one product's own history — `a` was replaced by `b`, `b` by `c` — so it is only
 * a chain while the identity stays the same. If the next hop belongs to a DIFFERENT product,
 * the walk is abandoned rather than joined: sending the first product's old URL to the second
 * product's URL is exactly the foreign-product redirect the contract forbids. A cycle, or a
 * chain longer than a real history, drops every entry on the path — leaving one arm of a loop
 * alive would be a redirect whose target is itself retired.
 */
function flattenChains(market_map: Map<string, MarketSlugRedirect>, skip: (reason: string) => void): void {
	const terminals = new Map<string, string>();
	const dropped = new Set<string>();

	for (const start of [...market_map.keys()]) {
		if (terminals.has(start) || dropped.has(start)) continue;

		const path: string[] = [];
		const seen = new Set<string>();
		const identity = market_map.get(start)!.cfmProductId;
		let cursor: string | undefined = start;
		let terminal: string | undefined;
		let reason = "chain-loops-or-too-long";

		while (cursor !== undefined) {
			if (seen.has(cursor) || path.length > MAX_CHAIN || dropped.has(cursor)) break;
			const known = terminals.get(cursor);
			if (known !== undefined) {
				terminal = known;
				break;
			}
			const hop = market_map.get(cursor);
			if (!hop) {
				// Nothing replaced this one: it is where the chain ends.
				terminal = cursor;
				break;
			}
			if (!sameCfmProduct(hop.cfmProductId, identity)) {
				reason = "chain-crosses-products";
				break;
			}
			seen.add(cursor);
			path.push(cursor);
			cursor = hop.newSlug;
		}

		if (terminal === undefined) {
			for (const key of path) {
				if (market_map.delete(key)) skip(reason);
				dropped.add(key);
			}
			continue;
		}

		for (const key of path) {
			terminals.set(key, terminal);
			const hop = market_map.get(key)!;
			if (hop.newSlug !== terminal)
				market_map.set(key, { cfmProductId: hop.cfmProductId, newSlug: terminal });
		}
	}
}

// ---------------------------------------------------------------------------------------
// The delivered file
// ---------------------------------------------------------------------------------------

let loaded: MarketSlugRedirectIndex | null = null;
let loadNote = "not loaded";

/** Test seam: the index is process state by design. */
export function resetMarketSlugRedirectsForTests(): void {
	loaded = null;
	loadNote = "not loaded";
}

export function marketSlugRedirectStatus(): { note: string; entries: number; markets: number } {
	const index = marketSlugRedirects();
	return { note: loadNote, entries: index.entries, markets: index.markets };
}

function marketSlugRedirects(): MarketSlugRedirectIndex {
	if (loaded) return loaded;

	const path = process.env.MAKY_MARKET_SLUG_REDIRECTS_PATH?.trim();
	if (!path) {
		loadNote = "disabled: no MAKY_MARKET_SLUG_REDIRECTS_PATH";
		loaded = EMPTY;
		return loaded;
	}

	let bytes: Buffer;
	try {
		bytes = readFileSync(path);
	} catch (error) {
		loadNote = `unreadable: ${error instanceof Error ? error.message : "unknown"}`;
		console.error(`[market-slug-redirects] ${loadNote}`);
		loaded = EMPTY;
		return loaded;
	}

	const expected = process.env.MAKY_MARKET_SLUG_REDIRECTS_SHA256?.trim().toLowerCase();
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	if (expected && expected !== sha256) {
		loadNote = `sha256 mismatch: expected ${expected.slice(0, 12)}…, got ${sha256.slice(0, 12)}…`;
		console.error(`[market-slug-redirects] ${loadNote} — no redirects`);
		loaded = EMPTY;
		return loaded;
	}

	const index = parseMarketSlugRedirects(bytes.toString("utf8"));
	loadNote = `loaded ${index.entries} entries in ${index.markets} markets from sha256 ${sha256.slice(
		0,
		12,
	)}…${Object.keys(index.skipped).length ? ` (skipped ${JSON.stringify(index.skipped)})` : ""}`;
	console.log(`[market-slug-redirects] ${loadNote}`);
	loaded = index;
	return loaded;
}

/**
 * Where a retired market URL went, or null when this is not one.
 *
 * Answering is not the same as redirecting: the caller must still prove that the target
 * exists AND belongs to `cfmProductId` before it moves anyone, because until CFM swaps the
 * slug in Saleor the OLD url is the one that works.
 */
export function marketSlugRedirect(market: string, slug: string): MarketSlugRedirect | null {
	return marketSlugRedirects().byMarket.get(market)?.get(slug) ?? null;
}
