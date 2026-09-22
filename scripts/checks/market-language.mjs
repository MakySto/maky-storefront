// Does a foreign market ever answer in Slovak? Asked the way a real visitor asks.
//
//   node scripts/checks/market-language.mjs
//   node scripts/checks/market-language.mjs --base http://127.0.0.1:3000 --markets de,us
//   MAKY_SMOKE_GARAGE_COOKIE=<value> node scripts/checks/market-language.mjs
//
// Every locale bug this shop has shipped was found by the owner in his browser and missed by
// a check here. Four times. The reason was always the same: the checks fetched pages the way
// a robot does — no cookies, no Accept-Language, no client-side navigation — and the faults
// only showed up for a visitor who had been browsing the Slovak shop first. So this one
// carries what he carries:
//
//   - a cookie jar built by visiting /sk, exactly as arriving from the Slovak shop does;
//   - `Accept-Language: sk-SK`, because that is what his browser sends;
//   - the RSC flight payload as well as the HTML, because clicking a link downloads the
//     former and never the latter;
//   - a saved vehicle when one is supplied, because the compatibility box does not render
//     without it and a check that never sees it cannot fail on it.
//
// What it compares is not a word list. For each message key it reads the Slovak value and the
// market's own value from `src/i18n/messages/`, and only checks keys where the two DIFFER —
// so `product.description` is "Popis" in Czech too and drops out of the Czech run by itself,
// with nothing to maintain. Same for money: the price is formatted with `Intl` in both
// locales, and only a market whose format differs from Slovakia's is checked.
//
// Exit 0 = no market answered in Slovak. 1 = at least one did. 2 = the check could not run,
// which is not a pass.
import { readFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};

const BASE = (argOf("--base", "http://127.0.0.1:3000") || "").replace(/\/$/, "");
const API =
	process.env.NEXT_PUBLIC_SALEOR_API_URL || process.env.SALEOR_API_URL || "https://api.maky.store/graphql/";
const GARAGE = process.env.MAKY_SMOKE_GARAGE_COOKIE || null;

/**
 * The market tables are READ from the code, never restated here.
 *
 * The first version of this file kept its own copy and spelled the Spanish cart `cesta`; the
 * real segment is `carrito`, so the check reported a 404 as if the site were broken. A check
 * that carries its own facts eventually disagrees with the thing it is checking. These three
 * tables are plain object literals, so they parse with a regex — and every read asserts the
 * count it expects, so a change in shape fails loudly instead of yielding an empty map.
 */
function literalBody(file, name) {
	const source = readFileSync(file, "utf8");
	// `export const NAME`, not the first mention of NAME — a doc comment above it would win.
	const start = source.indexOf(`export const ${name}`);
	if (start === -1) throw new Error(`export const ${name} not found in ${file}`);
	const open = source.indexOf("{", start);
	const close = source.indexOf("\n};", open);
	if (open === -1 || close === -1) throw new Error(`${name} in ${file} is not the object literal expected`);
	return source.slice(open, close);
}

/** `market: "value"` — the cart segments and the language codes. */
function stringTable(file, name, expected) {
	const table = {};
	for (const [, key, value] of literalBody(file, name).matchAll(/^\t(\w+):\s*"([^"]+)",/gm)) {
		table[key] = value;
	}
	const found = Object.keys(table).length;
	if (found !== expected) throw new Error(`${name}: expected ${expected} entries, parsed ${found}`);
	return table;
}

/** `market: { saleorSlug, currency, locale, country }` — the channel map. */
function channelTable(file, name, expected) {
	const table = {};
	for (const match of literalBody(file, name).matchAll(
		/^\t(\w+):\s*\{\s*saleorSlug:\s*"([^"]+)",\s*currency:\s*"([^"]*)",\s*locale:\s*"([^"]+)"/gm,
	)) {
		table[match[1]] = { saleorSlug: match[2], currency: match[3], locale: match[4] };
	}
	const found = Object.keys(table).length;
	if (found !== expected) throw new Error(`${name}: expected ${expected} entries, parsed ${found}`);
	return table;
}

const CHANNEL_MAP = channelTable("src/lib/channel-map.ts", "CHANNEL_MAP", 12);
const CART_SEGMENT = stringTable("src/lib/channel-map.ts", "CART_SEGMENT_BY_MARKET", 12);
const LANGUAGE_CODE = stringTable("src/config/market-language.ts", "MARKET_LANGUAGE_CODE", 11);

/** Every market but Slovakia — Slovakia answering in Slovak is the correct answer. */
const MARKETS = Object.fromEntries(
	Object.keys(LANGUAGE_CODE).map((market) => [
		market,
		[CHANNEL_MAP[market].saleorSlug, LANGUAGE_CODE[market], CHANNEL_MAP[market].locale, CART_SEGMENT[market]],
	]),
);

/**
 * The keys worth checking, and where each one renders. A key is checked on a market only when
 * its Slovak value differs from that market's — otherwise there is nothing to tell apart.
 */
const KEYS = [
	{ key: "common.home", pages: ["pdp"] },
	{ key: "common.onDemand", pages: ["pdp"] },
	{ key: "common.addToCart", pages: ["pdp"] },
	{ key: "product.description", pages: ["pdp"] },
	{ key: "product.priceWithVat", pages: ["pdp"] },
	{ key: "nav.allCategories", pages: ["home", "pdp"] },
	{ key: "fitment.selectVehicle", pages: ["pdp"] },
];

const messagesOf = (locale) => JSON.parse(readFileSync(`src/i18n/messages/${locale}.json`, "utf8"));
const valueAt = (messages, key) => key.split(".").reduce((node, part) => node?.[part], messages);

const SK = messagesOf("sk-SK");

async function gql(query, variables) {
	const res = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	const body = await res.json();
	if (body.errors) throw new Error(JSON.stringify(body.errors).slice(0, 300));
	return body.data;
}

/** A product that market actually sells, named the way that market names it. */
async function pickProduct(channel, lang) {
	const data = await gql(
		`query P($c: String!, $l: LanguageCodeEnum!) {
			products(channel: $c, first: 1, filter: { isAvailable: true }) {
				edges { node {
					translation(languageCode: $l) { slug }
					slug
					pricing { priceRange { start { gross { amount currency } } } }
				} }
			}
		}`,
		{ c: channel, l: lang },
	);
	const node = data.products?.edges?.[0]?.node;
	if (!node) return null;
	const gross = node.pricing?.priceRange?.start?.gross;
	return {
		slug: node.translation?.slug ?? node.slug,
		amount: gross?.amount ?? null,
		currency: gross?.currency ?? null,
	};
}

/** Text of one response, fetched as the owner's browser would fetch it. */
async function fetchAs(url, { cookies, rsc }) {
	const headers = {
		// What his browser sends. A check that omits it is checking a different visitor.
		"accept-language": "sk-SK,sk;q=0.9,en;q=0.8",
		"user-agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36",
	};
	if (cookies) headers.cookie = cookies;
	// `RSC: 1` is what a click downloads. The HTML is only ever the first page of a visit.
	if (rsc) headers.rsc = "1";
	const res = await fetch(url, { headers, redirect: "follow" });
	return { status: res.status, body: await res.text(), setCookie: res.headers.getSetCookie?.() ?? [] };
}

/** Arriving from the Slovak shop, which is how he arrives. */
async function slovakVisitorCookies() {
	const { setCookie } = await fetchAs(`${BASE}/sk`, {});
	const jar = setCookie.map((line) => line.split(";")[0]).filter(Boolean);
	if (GARAGE) jar.push(`maky-garage=${GARAGE}`);
	return jar.join("; ");
}

const money = (amount, currency, locale) =>
	new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: currency === "HUF" ? 0 : 2,
		maximumFractionDigits: currency === "HUF" ? 0 : 2,
	}).format(amount);

async function checkMarket(market, cookies) {
	const [channel, lang, locale, cartSegment] = MARKETS[market];
	const local = messagesOf(locale);
	const product = await pickProduct(channel, lang);
	if (!product) return [{ market, where: "saleor", what: "no purchasable product to check" }];

	const pages = {
		home: `${BASE}/${market}`,
		pdp: `${BASE}/${market}/${product.slug}`,
		cart: `${BASE}/${market}/${cartSegment}`,
	};

	const findings = [];
	for (const [page, url] of Object.entries(pages)) {
		for (const mode of ["html", "rsc"]) {
			const { status, body } = await fetchAs(url, { cookies, rsc: mode === "rsc" });
			if (status !== 200) {
				findings.push({ market, where: `${page}/${mode}`, what: `HTTP ${status}` });
				continue;
			}

			// A page that failed to render would otherwise pass every absence check in silence.
			let sawSomething = false;

			for (const { key, pages: on } of KEYS) {
				if (!on.includes(page)) continue;
				const skText = valueAt(SK, key);
				const ownText = valueAt(local, key);
				if (!skText || !ownText || skText === ownText) continue;
				if (body.includes(ownText)) sawSomething = true;
				if (body.includes(skText)) {
					findings.push({ market, where: `${page}/${mode}`, what: `${key} in Slovak: "${skText}"` });
				}
			}

			if (page === "pdp" && product.amount !== null) {
				const own = money(product.amount, product.currency, locale);
				const slovak = money(product.amount, product.currency, "sk-SK");
				if (body.includes(own)) sawSomething = true;
				if (own !== slovak && body.includes(slovak)) {
					findings.push({
						market,
						where: `${page}/${mode}`,
						what: `price in Slovak format: "${slovak}" (should be "${own}")`,
					});
				}
			}

			if (page !== "cart" && !sawSomething) {
				findings.push({
					market,
					where: `${page}/${mode}`,
					what: "none of the market's own strings were present — the check proved nothing",
				});
			}
		}
	}
	return findings;
}

async function main() {
	const only = argOf("--markets", null);
	const markets = only ? only.split(",").map((m) => m.trim()) : Object.keys(MARKETS);
	for (const market of markets) {
		if (!MARKETS[market]) {
			console.error(`unknown market: ${market}`);
			process.exit(2);
		}
	}

	console.log(`${markets.length} market(s) against ${BASE}, as a visitor arriving from /sk`);
	console.log(`  saved vehicle: ${GARAGE ? "yes" : "no (set MAKY_SMOKE_GARAGE_COOKIE to include it)"}\n`);

	const cookies = await slovakVisitorCookies();
	const findings = [];
	for (const market of markets) {
		const found = await checkMarket(market, cookies);
		findings.push(...found);
		console.log(`  ${found.length === 0 ? "ok  " : "FAIL"} ${market}`);
		for (const f of found) console.log(`       ${f.where}: ${f.what}`);
	}

	console.log(
		findings.length === 0
			? `\nno market answered in Slovak`
			: `\n${findings.length} finding(s) — a foreign market is answering in Slovak`,
	);
	return findings.length === 0 ? 0 : 1;
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err);
		process.exit(2);
	},
);
