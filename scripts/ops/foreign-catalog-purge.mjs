// Channel-scoped cache invalidation after CFM publishes the foreign catalogue.
//
//   node scripts/ops/foreign-catalog-purge.mjs                 # dry run — prints, sends nothing
//   node scripts/ops/foreign-catalog-purge.mjs --fire          # actually sends
//   node scripts/ops/foreign-catalog-purge.mjs --fire --out receipt.json
//
// The slug-migration worklist has 100,727 rows and is NOT the plan for this. It stays where
// it is as the evidence of that migration. What has to be invalidated here is smaller and the
// shape of it comes from the code, not from an estimate:
//
//   - A foreign "no such product" answer carries exactly one tag,
//     `product-miss:{channel}:{locale}` (src/lib/saleor/product-cache-tags.ts). It is per
//     CHANNEL, not per product — a miss has no base slug to be named by — and every product,
//     category and unnamed event in that channel expires it
//     (src/app/api/revalidate/route.ts:191, 206, 227; `collection` deliberately does not).
//   - So one category event per foreign channel clears every cached not-found in it, and in
//     the same request refreshes the category, the listing path and the vehicle-page offers.
//   - Only pages cached as FOUND need naming individually. Abroad that is the 33 canary cells
//     and nothing else: every other foreign product was unpublished and therefore never
//     rendered.
//
// Two rules this file enforces rather than documents:
//
//   1. Every request names its channel. `targetChannels(undefined)` in the route fans out to
//      ALL TWELVE channels, Slovakia included — so one payload with a missing `channel` would
//      purge SK's caches during the exact window where SK must not move. A request without a
//      channel is refused here before it is built.
//   2. `sk-eur` is not a target. Passing --include-sk is the only way to change that, and
//      nothing in the foreign rollout needs it.
//
// Exit 0 = dry run printed, or every request succeeded. 1 = at least one failed. 2 = refused.
import { writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};
const has = (flag) => args.includes(flag);

const BASE = (argOf("--base", "http://127.0.0.1:3000") || "").replace(/\/$/, "");
const FIRE = has("--fire");
const INCLUDE_SK = has("--include-sk");
const SETTLE_MS = Number(argOf("--settle", "2000"));

const SECRET = process.env.REVALIDATE_SECRET;
if (FIRE && !SECRET) {
	console.error("REVALIDATE_SECRET is not set — refusing to fire.");
	console.error("Run with the production env, e.g.  set -a; . /opt/storefront/.env; set +a");
	process.exit(2);
}

/** Saleor channel slugs. Slovakia is excluded on purpose — see rule 2 above. */
const FOREIGN_CHANNELS = [
	"cz-czk",
	"de-eur",
	"at-eur",
	"pl-pln",
	"hu-huf",
	"it-eur",
	"fr-eur",
	"es-eur",
	"ro-ron",
	"us-usd",
	"ca-cad",
];
const CHANNELS = INCLUDE_SK ? ["sk-eur", ...FOREIGN_CHANNELS] : FOREIGN_CHANNELS;

/**
 * Base category slugs, as `src/config/category-routes.ts` spells them. The route resolves
 * either spelling through `categoryBaseSlug()`, but sending the base form keeps the request
 * identical to what Saleor's own webhook would send.
 */
const CATEGORIES = ["stresne-nosice", "nordrive-stresne-nosice"];

/**
 * The three grouped-canary products, by BASE slug — the form every revalidation event uses,
 * translated slugs never appear in a payload. These are the only foreign PDPs that can hold a
 * stale FOUND answer.
 */
const CANARY_BASE_SLUGS = [
	"stresny-nosic-nordrive-helio-silver-audi-80-avant-1991-1995-klasicke-lyziny",
	"stresny-nosic-nordrive-silenzio-cx-black-fiat-multipla-1998-2010-fixacne-body",
	"stresny-nosic-nordrive-snap-alu-silver-bmw-x2-u10-2024-integrovane-lyziny",
];

function buildRequests() {
	const out = [];
	for (const channel of CHANNELS) {
		for (const slug of CATEGORIES) {
			out.push({
				phase: "category+miss",
				channel,
				body: { category: { slug }, channel },
				why: `category ${slug}, listing path, vehicle offers, and every cached not-found in ${channel}`,
			});
		}
	}
	for (const channel of CHANNELS) {
		for (const slug of CANARY_BASE_SLUGS) {
			out.push({
				phase: "canary-found",
				channel,
				body: {
					product: { slug, category: { slug: "nordrive-stresne-nosice" } },
					channel,
				},
				why: `canary PDP cached as FOUND with pre-publication content in ${channel}`,
			});
		}
	}
	for (const r of out) {
		if (!r.body.channel) {
			console.error("refusing: a request without an explicit channel would fan out to all 12");
			process.exit(2);
		}
	}
	return out;
}

async function send(req) {
	const res = await fetch(`${BASE}/api/revalidate`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-revalidate-secret": SECRET },
		body: JSON.stringify(req.body),
	});
	let payload = null;
	try {
		payload = await res.json();
	} catch {
		payload = null;
	}
	return {
		status: res.status,
		ok: res.ok,
		tags: payload?.revalidated?.tags ?? payload?.tags ?? null,
		payload,
	};
}

async function main() {
	const requests = buildRequests();
	console.log(`${requests.length} request(s) against ${BASE}`);
	console.log(`  ${CHANNELS.length} channel(s), SK ${INCLUDE_SK ? "INCLUDED" : "excluded"}`);
	const byPhase = {};
	for (const r of requests) byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1;
	console.log(`  ${JSON.stringify(byPhase)}\n`);

	if (!FIRE) {
		for (const r of requests) console.log(`  DRY  ${r.phase.padEnd(15)} ${JSON.stringify(r.body)}`);
		console.log(`\nDry run — nothing was sent. Add --fire to send.`);
		return 0;
	}

	const results = [];
	let failed = 0;
	// Serial on purpose: this runs while the catalogue has just been written, and a burst of
	// purges followed by a burst of recomputes is the one thing that could make the first
	// foreign page view worse than it needs to be.
	for (const r of requests) {
		const res = await send(r);
		if (!res.ok) failed += 1;
		results.push({ ...r, result: res });
		console.log(`  ${res.ok ? "ok  " : "FAIL"} ${res.status} ${r.phase.padEnd(15)} ${r.channel}`);
	}

	console.log(`\nsettling ${SETTLE_MS} ms — a request issued immediately after the endpoint`);
	console.log(`responds still gets the old entry; measured on the canary, ~2 s is enough.`);
	await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

	const receipt = {
		base: BASE,
		channels: CHANNELS,
		skIncluded: INCLUDE_SK,
		requests: results.length,
		failed,
		settleMs: SETTLE_MS,
		firedAt: new Date().toISOString(),
		results,
	};
	const out = argOf("--out", null);
	if (out) {
		writeFileSync(out, JSON.stringify(receipt, null, "\t") + "\n");
		console.log(`receipt → ${out}`);
	}
	console.log(failed === 0 ? "\nall requests accepted" : `\n${failed} request(s) failed`);
	return failed === 0 ? 0 : 1;
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err);
		process.exit(2);
	},
);
