// A small web server that behaves like a healthy storefront build to the deploy script's gate:
// pages that reference the stylesheet and script chunks of the build in --cwd, those chunks, the
// files under public/, a sitemap index with three shards, 404 for junk, text/x-component for RSC.
// Every sitemap request is written to <world>/sitemap-requests.log as `<port> <path>`, so a case can see which
// process read which shard. At boot it prints its Saleor queue as src/instrumentation.ts does, from
// SALEOR_MAX_CONCURRENT_REQUESTS in the environment it was started with (6 when there is none, as in src/lib/graphql.ts).
// What it serves comes from the tree it was started in, so a build moved to another directory
// is judged where it now lives. Behaviour switches are read from <cwd>/.next/FAKE_BEHAVIOR:
//   css404in, failhome                         faults the gate must catch
//   homestatus=<code>, homelocation=<url>      the market page answers that code (with that Location) instead of 200
//   cut=<path>[,<path>]                        those paths send a 200 with a body promised longer than it comes, then
//                                              the connection drops: a stream that died after its shell
//   categories=yes|refused|no|noendpoint       the [live-categories] line it prints at boot; with `no`, the
//                                              retry that logs "Saleor answered again" once `categoriesrecoverms`
//                                              have passed and a market page is asked for
//   release=on                                 the [release] line a process following the manifest prints
//   statuslagin=<app|build>, statusafterms=N  what /api/catalog/status serves, below
//   shard500in=<app|build>                     /sitemaps/cz-products-1.xml answers 500 in that tree: a shard only a
//                                              reading of every shard finds broken
// `--title <t>` is the process title (a next-server of another version: maky-smtp-app, Next 15).
// And one property of how the process was started, `--hostname <h>` (what `-H <h>` gives next start): an explicit
// loopback address reproduces what Next 16.3.6 did on the box when the bridge was started with -H 127.0.0.1
// (rehearsal of 2026-10-06): every market page answers a 301 to itself, with the rewrite as an absolute URL in
// x-middleware-rewrite; the static files, robots.txt and the API answer as usual.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].slice(2)] = process.argv[i + 1];
const port = Number(args.port);
const cwd = args.cwd;
// Next titles its server process like this, which is what /proc/<pid>/comm starts with on the box. The deploy script
// finds the live process by that and by its working directory, because maky-smtp-app runs a next-server too.
process.title = args.title ?? "next-server (v16.0.0-fixture)";
// Next turns 127.x.x.x and ::1 into `localhost` for the proxy but builds the origin it compares with from -H as given.
const rewriteLeavesOrigin = /^(127(\.\d{1,3}){3}|\[?::1\]?)$/.test(args.hostname ?? "");
const startedAt = Date.now();
let recovered = false;
// The box: this file is <world>/fake/fake-app-server.mjs.
const world = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function behaviour() {
	try {
		const lines = fs
			.readFileSync(path.join(cwd, ".next", "FAKE_BEHAVIOR"), "utf8")
			.split("\n")
			.filter(Boolean);
		return Object.fromEntries(lines.map((line) => line.split("=")));
	} catch {
		return {};
	}
}

// /api/catalog/status: the document in the tree (FAKE_CATALOG_STATUS.json), 404 when there is none, as in a
// build that does not have the route. The process running in the directory called `statuslagin` (app or build)
// serves FAKE_CATALOG_STATUS_LAG.json instead, and from `statusafterms` after that process started,
// FAKE_CATALOG_STATUS_LATER.json replaces either: a process that takes the release some time after it booted.
function catalogStatus(b) {
	const read = (name) => {
		try {
			return fs.readFileSync(path.join(cwd, ".next", name), "utf8");
		} catch {
			return null;
		}
	};
	let doc =
		b.statuslagin && path.basename(cwd) === b.statuslagin ? read("FAKE_CATALOG_STATUS_LAG.json") : null;
	doc ??= read("FAKE_CATALOG_STATUS.json");
	if (b.statusafterms && Date.now() - startedAt >= Number(b.statusafterms)) {
		doc = read("FAKE_CATALOG_STATUS_LATER.json") ?? doc;
	}
	return doc;
}

function bootLines() {
	const b = behaviour();
	const lines = [
		"[market-state] live=sk preview= unknown=",
		"[route-existence] gate=on markets=sk families=x",
		`[saleor-queue] max_concurrent=${process.env.SALEOR_MAX_CONCURRENT_REQUESTS || 6} min_delay_ms=0`,
	];
	if (b.release === "on") {
		lines.push(
			"[release] mode=manifest source=cfm.example/MANIFEST.json poll=30s boot=0f3a9c21 older-content-setting=path cache=/var/cache/fixture",
		);
	}
	if (b.categories === "yes") lines.push("[live-categories] floor=30 live=0 refused=0 loaded=yes");
	if (b.categories === "refused") lines.push("[live-categories] floor=30 live=1 refused=2 loaded=yes");
	if (b.categories === "no") {
		lines.push(
			"[live-categories] could not read the category list from Saleor; keeping 30 known categories, trying again in 15 s",
			"[live-categories] floor=30 live=0 refused=0 loaded=no",
		);
	}
	if (b.categories === "noendpoint") {
		lines.push(
			"[live-categories] no Saleor endpoint configured: the 30 categories of the build are all there is",
		);
	}
	return `${lines.join("\n")}\n`;
}

function chunks() {
	try {
		return fs.readdirSync(path.join(cwd, ".next", "static", "chunks")).sort();
	} catch {
		return [];
	}
}

function html() {
	const links = chunks()
		.map((name) =>
			name.endsWith(".css")
				? `<link rel="stylesheet" href="/_next/static/chunks/${name}">`
				: `<script src="/_next/static/chunks/${name}" async></script>`,
		)
		.join("\n");
	return `<!doctype html><html><head>${links}</head><body>${"<p>storefront</p>".repeat(120)}</body></html>`;
}

const PAGES = new Set(["/sk", "/sk/products", "/sk/stresne-nosice", "/checkout"]);
// In the order the real index names them: a market's pages, then its products; then the next market.
const SHARDS = {
	"/sitemaps/sk-pages-1.xml": ["/sk", "/sk/products", "/sk/stresne-nosice"],
	"/sitemaps/sk-products-1.xml": Array.from({ length: 8 }, (_, i) => `/sk/produkt-${i + 1}`),
	"/sitemaps/cz-products-1.xml": Array.from({ length: 4 }, (_, i) => `/cz/produkt-${i + 1}`),
};

// Like next start, which writes ISR shells and the image cache into the tree it serves: every request
// leaves the working directory of the process that answered it in .next/cache/touched.log.
function touch() {
	try {
		fs.mkdirSync(path.join(cwd, ".next", "cache"), { recursive: true });
		fs.appendFileSync(path.join(cwd, ".next", "cache", "touched.log"), `${cwd}\n`);
	} catch {
		// the tree may be mid-move; the request still gets answered
	}
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url ?? "/", "http://fake");
	const p = url.pathname;
	const b = behaviour();
	touch();
	const send = (code, type, body) => {
		res.writeHead(code, { "content-type": type });
		res.end(body);
	};

	if (b.cut?.split(",").includes(p)) {
		res.writeHead(200, { "content-type": "text/html", "content-length": "100000" });
		res.write("<!doctype html><html>");
		setTimeout(() => res.socket?.destroy(), 20);
		return;
	}

	if (p.startsWith("/_next/static/")) {
		const file = path.join(cwd, ".next", p.slice("/_next/".length));
		if (p.endsWith(".css") && b.css404in && cwd.endsWith(b.css404in)) return send(404, "text/plain", "gone");
		if (fs.existsSync(file) && fs.statSync(file).isFile()) {
			return send(200, p.endsWith(".css") ? "text/css" : "application/javascript", fs.readFileSync(file));
		}
		return send(404, "text/plain", "no such chunk");
	}
	if (p === "/sitemap.xml" || p in SHARDS) {
		try {
			fs.appendFileSync(path.join(world, "sitemap-requests.log"), `${port} ${p}\n`);
		} catch {
			// the log is for the cases; the answer does not depend on it
		}
	}
	if (p === "/sitemap.xml") {
		const shards = Object.keys(SHARDS)
			.map((shard) => `<sitemap><loc>https://maky.store${shard}</loc></sitemap>`)
			.join("");
		return send(
			200,
			"application/xml",
			`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${shards}</sitemapindex>`,
		);
	}
	if (p === "/sitemaps/cz-products-1.xml" && b.shard500in && path.basename(cwd) === b.shard500in) {
		return send(500, "text/plain", "the walk failed");
	}
	if (p in SHARDS) {
		const urls = SHARDS[p].map((loc) => `<url><loc>https://maky.store${loc}</loc></url>`).join("");
		return send(
			200,
			"application/xml",
			`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
		);
	}
	const publicFile = path.join(cwd, "public", p);
	if (p !== "/" && fs.existsSync(publicFile) && fs.statSync(publicFile).isFile()) {
		return send(200, "application/octet-stream", fs.readFileSync(publicFile));
	}
	if (p === "/api/catalog/status") {
		const doc = catalogStatus(b);
		return doc === null ? send(404, "text/plain", "not found") : send(200, "application/json", doc);
	}
	if (PAGES.has(p) || /^\/sk\/produkt-\d+$/.test(p)) {
		if (rewriteLeavesOrigin && p.startsWith("/sk")) {
			res.writeHead(301, { location: p, "x-middleware-rewrite": `http://localhost:${port}/sk-eur` });
			return res.end();
		}
		if (p === "/sk" && b.failhome) return send(500, "text/plain", "boom");
		if (p === "/sk" && b.homestatus) {
			res.writeHead(Number(b.homestatus), {
				"content-type": "text/plain",
				...(b.homelocation ? { location: b.homelocation } : {}),
			});
			return res.end(`answered ${b.homestatus}`);
		}
		if (
			p === "/sk" &&
			b.categories === "no" &&
			!recovered &&
			Date.now() - startedAt >= Number(b.categoriesrecoverms ?? Infinity)
		) {
			recovered = true;
			if (args.log)
				fs.appendFileSync(args.log, "[live-categories] Saleor answered again after 1 failed load(s)\n");
		}
		if (req.headers.rsc === "1") return send(200, "text/x-component", "0:{}");
		return send(200, "text/html", html());
	}
	return send(404, "text/plain", "not found");
});

const stop = () => {
	server.close();
	server.closeAllConnections?.();
	process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

setTimeout(
	() => {
		server.listen(port, "127.0.0.1", () => {
			if (args.log) fs.appendFileSync(args.log, bootLines());
		});
	},
	Number(args["boot-ms"] || 0),
);
