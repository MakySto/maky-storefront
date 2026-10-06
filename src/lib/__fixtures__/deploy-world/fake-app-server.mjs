// A small web server that behaves like a healthy storefront build to the deploy script's gate:
// pages that reference the stylesheet and script chunks of the build in --cwd, those chunks, the
// files under public/, a sitemap index with one shard, 404 for junk, text/x-component for RSC.
// What it serves comes from the tree it was started in, so a build moved to another directory
// is judged where it now lives. Behaviour switches are read from <cwd>/.next/FAKE_BEHAVIOR.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].slice(2)] = process.argv[i + 1];
const port = Number(args.port);
const cwd = args.cwd;

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
const SHARD = "/sitemaps/sk-products-1.xml";

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

	if (p.startsWith("/_next/static/")) {
		const file = path.join(cwd, ".next", p.slice("/_next/".length));
		if (p.endsWith(".css") && b.css404in && cwd.endsWith(b.css404in)) return send(404, "text/plain", "gone");
		if (fs.existsSync(file) && fs.statSync(file).isFile()) {
			return send(200, p.endsWith(".css") ? "text/css" : "application/javascript", fs.readFileSync(file));
		}
		return send(404, "text/plain", "no such chunk");
	}
	if (p === "/sitemap.xml") {
		return send(
			200,
			"application/xml",
			`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://maky.store${SHARD}</loc></sitemap></sitemapindex>`,
		);
	}
	if (p === SHARD) {
		const urls = Array.from(
			{ length: 8 },
			(_, i) => `<url><loc>https://maky.store/sk/produkt-${i + 1}</loc></url>`,
		).join("");
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
	if (PAGES.has(p) || /^\/sk\/produkt-\d+$/.test(p)) {
		if (p === "/sk" && b.failhome) return send(500, "text/plain", "boom");
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
			if (args.log) {
				fs.appendFileSync(
					args.log,
					"[market-state] live=sk preview= unknown=\n[route-existence] gate=on markets=sk families=x\n",
				);
			}
		});
	},
	Number(args["boot-ms"] || 0),
);
