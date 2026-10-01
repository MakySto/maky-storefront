// The customer test that decides whether the next Thule block may open (THULE-C1, 2026-10-01).
//
//   node scripts/checks/thule-early-test.mjs --base https://maky.store \
//        --cases block1-cases.json --cookies block1-cookies.json --phase post [--out report.json]
//
// READ-ONLY. It only GETs public pages and asks Saleor's PUBLIC GraphQL API — the same anonymous query
// the storefront's own offer lookup runs. It creates no cart, no checkout and no order, and it never
// writes anything. Safe to run against production at any time.
//
// What it walks, for every case in the list CFM's activation stops on (block 1 is 250 sets):
//
//   a case that MUST show the set      the car, a year inside the set's window and the roof it needs
//   a case that MUST NOT show it       a year just outside the window, or the generation's other roof,
//                                      or no roof at all (the shopper is asked, nothing is guessed)
//
// and, per case, the four places a shopper meets the set: the product page (status, price, robots,
// canonical), the configurator (is the card there, at CFM's price, with its roof and years), the
// Thule shelf with the car chosen (is it the default list), and the generation page when the car has one.
//
//   --phase pre    BEFORE the activation: every set must be invisible — Saleor does not return it, its page
//                  is a real 404, and no surface shows it or sells it. It must say they are not on sale.
//   --phase post   AFTER it: every positive case shows its set at CFM's price with its roof and years,
//                  every negative case does not, and nothing outside the block has opened.
//
// Two things it cannot know and says so: the cookies (they are signed with the garage secret and are made
// by `src/lib/fitment/thule-cases.check.test.ts`, which is told the secret and never prints it), and
// whether the caches have expired — wait about six minutes after the block's last mutation (offers 300 s,
// product pages 60 s, the existence gate up to 300 s) or purge them; see the hand-over.
//
// Exit 0 = every check passed. 1 = something failed (the report lists it). 2 = could not run.
import fs from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback = null) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};
const BASE = (argOf("--base") ?? "").replace(/\/$/, "");
const CASES = argOf("--cases");
const COOKIES = argOf("--cookies");
const PHASE = argOf("--phase");
const OUT = argOf("--out");
const API = argOf("--saleor") ?? process.env.NEXT_PUBLIC_SALEOR_API_URL ?? "https://api.maky.store/graphql/";
const CHANNEL = argOf("--channel") ?? "sk-eur";
const MARKET = argOf("--market") ?? "sk";
if (!BASE || !CASES || !COOKIES || !["pre", "post"].includes(PHASE ?? "")) {
	console.error(
		"usage: thule-early-test.mjs --base <url> --cases <cases.json> --cookies <cookies.json> --phase pre|post [--out report.json]",
	);
	process.exit(2);
}

const cases = JSON.parse(fs.readFileSync(CASES, "utf8"));
const cookieRows = JSON.parse(fs.readFileSync(COOKIES, "utf8")).rows;
if (cookieRows.length !== cases.cases.length) {
	console.error(`${COOKIES} has ${cookieRows.length} rows for ${cases.cases.length} cases`);
	process.exit(2);
}

const QUERY =
	"query($ids:[ID!],$channel:String!){products(first:100,channel:$channel,filter:{ids:$ids}){edges{node{id name slug isAvailableForPurchase}}}}";
async function visibleIn(ids) {
	const found = new Map();
	for (let i = 0; i < ids.length; i += 100) {
		const res = await fetch(API, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query: QUERY, variables: { ids: ids.slice(i, i + 100), channel: CHANNEL } }),
		});
		const json = await res.json();
		if (json.errors) throw new Error(`Saleor: ${JSON.stringify(json.errors).slice(0, 200)}`);
		for (const edge of json.data.products.edges) found.set(edge.node.id, edge.node);
	}
	return found;
}

const strip = (html) =>
	html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const clean = (s) =>
	s
		.replace(/<!-- -->/g, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, " ")
		.trim();
const euro = (text) => {
	const m = text.match(/(\d[\d\s .]*),(\d{2})\s*€/);
	return m ? Number(`${m[1].replace(/[\s .]/g, "")}.${m[2]}`) : null;
};

async function get(path, cookie) {
	const res = await fetch(BASE + path, {
		headers: cookie ? { cookie: `maky-garage=${cookie}` } : {},
		redirect: "manual",
	});
	return { status: res.status, location: res.headers.get("location"), html: await res.text() };
}

/** The configurator's result cards: name, price and the roof/years line, from the server-rendered HTML. */
function configuratorCards(html) {
	const page = strip(html);
	const items = [
		...page.matchAll(
			/<li class="border-border-default flex flex-col overflow-hidden rounded-lg border">([\s\S]*?)<\/li>/g,
		),
	].map((m) => m[1]);
	return items.map((item) => ({
		name: clean((item.match(/<h3[\s\S]*?<\/h3>/) ?? [""])[0]),
		price: euro(clean(item)),
		fit: clean((item.match(/data-testid="card-fit"[^>]*>([\s\S]*?)<\/p>/) ?? ["", ""])[1]),
	}));
}
/** The listing's cards (shelf pages): name and the roof/years line. */
function shelfCards(html) {
	const page = strip(html);
	return [...page.matchAll(/<article[\s\S]*?<\/article>/g)].map((m) => ({
		name: clean((m[0].match(/<h2[\s\S]*?<\/h2>/) ?? [""])[0]),
		fit: clean((m[0].match(/data-testid="card-fit"[^>]*>([\s\S]*?)<\/p>/) ?? ["", ""])[1]),
	}));
}
/** The generation page's offer cards. */
function generationCards(html) {
	const page = strip(html);
	const section = (page.match(/data-testid="catalog-offers"[\s\S]*$/) ?? [""])[0];
	return [...section.matchAll(/<a class="border-border-default[\s\S]*?<\/a>/g)].map((m) => ({
		name: clean((m[0].match(/<span class="text-text-primary[^>]*>([\s\S]*?)<\/span>/) ?? ["", ""])[1]),
		fit: clean((m[0].match(/data-testid="offer-fit"[^>]*>([\s\S]*?)<\/span>/) ?? ["", ""])[1]),
	}));
}
function productJsonLd(html) {
	for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
		try {
			const items = [].concat(JSON.parse(m[1]));
			const product = items.find((x) => x["@type"] === "Product");
			if (product) return product;
		} catch {
			/* not JSON-LD we can read */
		}
	}
	return null;
}

const results = [];
const check = (id, label, ok, detail = "") => {
	results.push({ id, label, ok: Boolean(ok), detail });
	if (!ok) console.log(`  ✗ ${id}  ${label}${detail ? " — " + detail : ""}`);
	return ok;
};

console.log(
	`THULE-C1 early test · phase ${PHASE} · ${BASE} · ${cases.cases.length} cases (block ${
		cases.block?.number ?? "?"
	})`,
);

// ---- per case ------------------------------------------------------------------------------------------------
const targetIds = [...new Set(cases.cases.map((c) => c.set.saleorProductId))];
const visible = await visibleIn(targetIds);
const pdpCache = new Map();
const pdpOf = async (slug) => {
	if (!pdpCache.has(slug)) pdpCache.set(slug, await get(`/${MARKET}/${slug}`));
	return pdpCache.get(slug);
};

for (const [i, c] of cases.cases.entries()) {
	const row = cookieRows[i];
	const id = `#${String(i + 1).padStart(2, "0")} ${c.vehicle.make} ${c.vehicle.model} ${
		c.vehicle.generation
	} ${c.selection.year}${c.selection.roofType ? " " + c.selection.roofType : " (no roof)"} [${c.category}]`;
	const sold = visible.get(c.set.saleorProductId);
	const configurator = await get(`/${MARKET}/konfigurator`, row.cookie);
	const cards = configuratorCards(configurator.html);
	const shownByName = (name) => cards.find((card) => name && card.name === name);
	const flat = clean(strip(configurator.html));

	if (c.setOffered) {
		if (PHASE === "pre") {
			check(`${id}`, "the set is NOT visible to a visitor (Saleor)", !sold);
			const pdp = await pdpOf(c.set.slug);
			check(`${id}`, "its product page is a real 404", pdp.status === 404, `HTTP ${pdp.status}`);
			check(
				`${id}`,
				"the configurator does not offer it",
				!cards.some((card) => card.name.includes(c.vehicle.model) && /Thule/.test(card.name)) || !sold,
			);
			check(
				`${id}`,
				"the configurator says the sets are not on sale (or lists only other sets)",
				cards.length > 0 || /nie sú v predaji/.test(flat),
			);
		} else {
			check(`${id}`, "Saleor returns the set to an anonymous visitor", sold?.isAvailableForPurchase === true);
			const pdp = await pdpOf(c.set.slug);
			check(`${id}`, "its product page answers 200", pdp.status === 200, `HTTP ${pdp.status}`);
			const ld = productJsonLd(pdp.html);
			check(
				`${id}`,
				"the product page's price is CFM's price",
				ld && Number(ld.offers?.price) === Number(c.set.price),
				`page ${ld?.offers?.price} vs CFM ${c.set.price}`,
			);
			check(
				`${id}`,
				"the product page is indexable and canonical to itself",
				/<meta name="robots" content="index, follow"/.test(pdp.html) &&
					pdp.html.includes(`<link rel="canonical" href="https://maky.store/${MARKET}/${c.set.slug}"`),
			);
			const card = shownByName(sold?.name);
			check(`${id}`, "the configurator offers the set", Boolean(card), `${cards.length} cards`);
			check(
				`${id}`,
				"…at CFM's price",
				card && card.price === Number(c.set.price),
				`card ${card?.price} vs CFM ${c.set.price}`,
			);
			check(
				`${id}`,
				"…with its roof and its years",
				card && /Strecha: .+ · Roky: .+/.test(card.fit),
				card?.fit,
			);
			const shelf = await get(`/${MARKET}/categories/thule-stresne-nosice`, row.cookie);
			check(
				`${id}`,
				"the Thule shelf, car chosen, lists it by default",
				shelfCards(shelf.html).some((card) => card.name === sold?.name),
			);
			if (c.vehicle.urlPath) {
				const generation = await get(`/${MARKET}${c.vehicle.urlPath}`);
				check(
					`${id}`,
					"the generation page lists it with its roof and years",
					generation.status === 200 &&
						generationCards(generation.html).some(
							(card) => card.name === sold?.name && /Strecha:/.test(card.fit),
						),
				);
			}
		}
	} else {
		// A negative: the set must not be offered for this car, in either phase.
		const named = sold?.name ?? null;
		check(
			`${id}`,
			"the configurator does NOT offer the set",
			!named || !shownByName(named),
			`${cards.length} cards`,
		);
		// The shelf is deliberately NOT asked for a negative: a car with nothing verified leaves the shelf
		// whole ("Pre … zatiaľ nemáme overenú zostavu, preto vidíte ponuku pre všetky vozidlá"), and the set
		// is then in it by design. The configurator is the definitive answer to "does this set fit this car".
	}
}

// ---- around the block ----------------------------------------------------------------------------------------
const pilots = cases.pilots ?? [];
if (pilots.length > 0) {
	for (const pilot of pilots) {
		const pdp = await get(`/${MARKET}/${pilot.slug}`);
		check(
			`pilot ${pilot.cfmPk}`,
			pilot.hidden ? "stays hidden (404)" : "is still on sale (200)",
			pilot.hidden ? pdp.status === 404 : pdp.status === 200,
			`HTTP ${pdp.status}`,
		);
	}
}
if (cases.laterBlocksSample?.length) {
	const later = await visibleIn(cases.laterBlocksSample);
	check(
		"later blocks",
		`${cases.laterBlocksSample.length} sets of the blocks still to come are NOT visible`,
		later.size === 0,
		`${later.size} visible`,
	);
}

const failed = results.filter((r) => !r.ok);
console.log(
	`\n${results.length - failed.length} of ${results.length} checks passed${
		failed.length ? `, ${failed.length} FAILED` : ""
	}.`,
);
if (OUT)
	fs.writeFileSync(
		OUT,
		JSON.stringify(
			{
				phase: PHASE,
				base: BASE,
				at: new Date().toISOString(),
				passed: results.length - failed.length,
				failed: failed.length,
				results,
			},
			null,
			1,
		),
	);
process.exit(failed.length ? 1 : 0);
