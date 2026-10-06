// What nginx does with an upstream group, as far as the deploy cares: every request goes to the first
// server of the group that is not marked backup, and only if that cannot be reached to a backup one.
// The group is read from the configuration nginx last loaded, and X-Maky-Upstream names every server
// that was tried — the same header the real loopback listener adds from $upstream_addr.
import fs from "node:fs";
import http from "node:http";

const [, , listenPort, runningConf] = process.argv;

function group() {
	try {
		const text = fs.readFileSync(runningConf, "utf8");
		const servers = [...text.matchAll(/^\s*server\s+([\d.]+:\d+)(\s+backup)?\s*;/gm)];
		return [...servers.filter((m) => !m[2]), ...servers.filter((m) => m[2])].map((m) => m[1]);
	} catch {
		return [];
	}
}

function forward(req, res, addresses, tried) {
	const address = addresses.shift();
	if (!address) {
		if (!res.headersSent) {
			res.writeHead(502, { "x-maky-upstream": tried.join(", ") || "none" });
			res.end("bad gateway");
		}
		return;
	}
	tried.push(address);
	const [host, upstreamPort] = address.split(":");
	const upstream = http.request(
		{
			host,
			port: Number(upstreamPort),
			method: req.method,
			path: req.url,
			headers: { ...req.headers, connection: "close" },
		},
		(response) => {
			res.writeHead(response.statusCode ?? 502, { ...response.headers, "x-maky-upstream": tried.join(", ") });
			response.pipe(res);
		},
	);
	upstream.on("error", () => {
		if (res.headersSent) return res.destroy();
		forward(req, res, addresses, tried);
	});
	req.pipe(upstream);
}

http.createServer((req, res) => forward(req, res, group(), [])).listen(Number(listenPort), "127.0.0.1");
process.on("SIGTERM", () => process.exit(0));
