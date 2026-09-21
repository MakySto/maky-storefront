// What production actually answers, captured before a change and compared after it.
//
//   node scripts/checks/url-snapshot.mjs --out before.json
//   …deploy…
//   node scripts/checks/url-snapshot.mjs --out after.json
//   node scripts/checks/url-snapshot.mjs --diff before.json after.json
//
// An inert commit — a metadata fix, a gate that ships switched off — is supposed to change
// nothing. A checklist cannot prove that: it proves the things someone thought to list. A
// capture of what the site answered before, compared field by field against what it answers
// after, proves it for every field on every URL, and surfaces the ones nobody was looking at.
//
// That is not hypothetical here. Diffing production against itself across the `07a5673`
// deploy is how `/checkout` was caught declaring `index, follow`: the field was identical
// before and after, which is exactly what made it a pre-existing defect rather than a
// regression. No checklist had that line on it.
//
// Ten fields per URL. `--follow` is off by default because a redirect's own status and
// Location are usually the thing being checked; with it on, the fields describe the
// destination instead. Body size is recorded because a page can keep every field and still
// lose its body.
//
// Every URL is fetched twice and only the second answer is recorded. A cold render and a
// cached one differ in size for the same content — measured on `/sk/stresne-nosice`, 271,993
// bytes cold against 276,795 warm and stable, same fifteen products — and after a deploy
// every page is cold. Without the warm-up the tool reports a size difference on the one
// comparison it exists for.
//
// Exit 0 = capture written, or diff found nothing. Exit 1 = diff found a difference.
// Exit 2 = the check could not run.
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};
const has = (flag) => args.includes(flag);

const BASE = (argOf("--base", "http://127.0.0.1:3000") || "").replace(/\/$/, "");
const FOLLOW = has("--follow");
const CONCURRENCY = 4;

/**
 * The default list: one URL per thing that can break independently.
 *
 * Every market's home page (server-rendered `<html lang>` and both noindex layers),
 * Slovakia's own surfaces, the routes that live outside `[channel]` and therefore miss the
 * market layout's metadata, a known-absent slug (which answers 200 while the existence gate
 * is off and a real 404 once it is armed), and the metadata routes.
 */
const MARKETS = ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"];
const DEFAULT_URLS = [
	...MARKETS.map((m) => `/${m}`),
	"/sk/kontakt",
	"/sk/obchodne-podmienky",
	"/sk/products",
	"/sk/stresne-nosice",
	"/sk/kosik",
	"/checkout",
	"/checkout/complete",
	"/sk/tento-produkt-neexistuje-abc123",
	"/robots.txt",
	"/sitemap.xml",
	"/_not-found",
];

const urlsFrom = (path) =>
	readFileSync(path, "utf8")
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#"));

const first = (re, text) => {
	const m = re.exec(text);
	return m ? m[1] : null;
};

/** The ten fields. Anything a deploy is allowed to change is not in here. */
async function capture(url) {
	const res = await fetch(BASE + url, { redirect: FOLLOW ? "follow" : "manual" });
	const body = await res.text();
	const ct = res.headers.get("content-type") ?? "";
	const html = ct.includes("html");
	let jsonld = null;
	if (html) {
		for (const m of body.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
			try {
				const d = JSON.parse(m[1]);
				if (d["@type"] === "Product") {
					jsonld = {
						sku: d.sku ?? null,
						price: d.offers?.price ?? null,
						currency: d.offers?.priceCurrency ?? null,
						availability: d.offers?.availability ?? null,
					};
					break;
				}
			} catch {
				// A malformed block is itself a difference worth seeing — record it as absent
				// rather than throwing away the whole URL.
			}
		}
	}
	return {
		url,
		status: res.status,
		location: res.headers.get("location"),
		xRobotsTag: res.headers.get("x-robots-tag"),
		metaRobots: html ? first(/<meta name="robots" content="([^"]*)"/i, body) : null,
		htmlLang: html ? first(/<html lang="([^"]*)"/i, body) : null,
		canonical: html ? first(/<link rel="canonical" href="([^"]*)"/i, body) : null,
		title: html ? first(/<title>([^<]*)<\/title>/i, body) : null,
		jsonldProduct: jsonld,
		bytes: Buffer.byteLength(body),
	};
}

async function captureAll(urls) {
	const out = new Array(urls.length);
	let next = 0;
	const worker = async () => {
		while (next < urls.length) {
			const i = next++;
			try {
				// Warm first, record second — see the note at the top of this file.
				await capture(urls[i]).catch(() => {});
				out[i] = await capture(urls[i]);
			} catch (err) {
				out[i] = { url: urls[i], error: String(err?.message ?? err) };
			}
		}
	};
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));
	return out;
}

function diff(beforePath, afterPath) {
	const index = (rows) => new Map(rows.map((r) => [r.url, r]));
	const a = index(JSON.parse(readFileSync(beforePath, "utf8")).rows);
	const b = index(JSON.parse(readFileSync(afterPath, "utf8")).rows);
	const urls = [...new Set([...a.keys(), ...b.keys()])].sort();
	const differences = [];
	for (const url of urls) {
		const x = a.get(url);
		const y = b.get(url);
		if (!x || !y) {
			differences.push({ url, field: !x ? "(absent before)" : "(absent after)" });
			continue;
		}
		for (const field of Object.keys(x)) {
			if (field === "url") continue;
			const l = JSON.stringify(x[field] ?? null);
			const r = JSON.stringify(y[field] ?? null);
			if (l !== r) differences.push({ url, field, before: x[field] ?? null, after: y[field] ?? null });
		}
	}
	if (differences.length === 0) {
		console.log(`${urls.length}/${urls.length} identical on every field — the change is inert.`);
		return 0;
	}
	console.log(`${differences.length} difference(s) across ${urls.length} URLs:\n`);
	for (const d of differences) {
		console.log(`  ${d.url}  ${d.field}`);
		if ("before" in d) {
			console.log(`    before: ${JSON.stringify(d.before)}`);
			console.log(`    after : ${JSON.stringify(d.after)}`);
		}
	}
	return 1;
}

async function main() {
	if (has("--diff")) {
		const i = args.indexOf("--diff");
		const [beforePath, afterPath] = [args[i + 1], args[i + 2]];
		if (!beforePath || !afterPath) {
			console.error("usage: --diff <before.json> <after.json>");
			process.exit(2);
		}
		process.exit(diff(beforePath, afterPath));
	}

	const urlsFile = argOf("--urls", null);
	const urls = urlsFile ? urlsFrom(urlsFile) : DEFAULT_URLS;
	if (urls.length === 0) {
		console.error("no URLs to capture");
		process.exit(2);
	}
	const rows = await captureAll(urls);
	const failed = rows.filter((r) => r.error);
	const snapshot = { base: BASE, follow: FOLLOW, capturedAt: new Date().toISOString(), rows };
	const out = argOf("--out", null);
	if (out) {
		writeFileSync(out, JSON.stringify(snapshot, null, "\t") + "\n");
		console.log(`captured ${rows.length} URLs from ${BASE} → ${out}`);
	} else {
		console.log(JSON.stringify(snapshot, null, "\t"));
	}
	if (failed.length) {
		console.error(`\n${failed.length} URL(s) could not be captured:`);
		for (const f of failed) console.error(`  ${f.url}: ${f.error}`);
		process.exit(2);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(2);
});
