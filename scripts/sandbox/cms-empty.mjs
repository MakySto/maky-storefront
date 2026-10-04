#!/usr/bin/env node
// An empty stand-in for the Payload CMS, for a sandbox build of the storefront.
//
//   node scripts/sandbox/cms-empty.mjs [--port 8100]
//
// A production build (`next build`) prerenders the home page and the advice pages, and they ask the
// CMS for their content. Without a CMS they fail on purpose ("cms not configured" is an error, not an
// empty page), so a sandbox build needs something that answers. This answers every request with an
// empty collection, which the storefront reads as "no published document", and so the pages take the
// fallbacks they have in code. It serves no content, holds no data and needs no credentials; the
// storefront is pointed at it with obvious fakes:
//
//   PAYLOAD_CMS_URL=http://127.0.0.1:8100
//   PAYLOAD_CF_ACCESS_CLIENT_ID=sandbox-not-a-secret
//   PAYLOAD_CF_ACCESS_CLIENT_SECRET=sandbox-not-a-secret
//
// It binds to 127.0.0.1 only. It is not the CMS: what a real editor entry looks like on the page
// is not tested by it.
import http from "node:http";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8100;
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
	console.error("--port must be an integer between 1024 and 65535");
	process.exit(2);
}

const empty = JSON.stringify({
	docs: [],
	totalDocs: 0,
	limit: 100,
	page: 1,
	totalPages: 0,
	hasNextPage: false,
	hasPrevPage: false,
});

let served = 0;
const server = http.createServer((request, response) => {
	served += 1;
	response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
	response.end(request.method === "HEAD" ? undefined : empty);
});
server.listen(port, "127.0.0.1", () => {
	console.log(`empty CMS on http://127.0.0.1:${port} (every request answers an empty collection)`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		console.log(`stopped after ${served} requests`);
		server.close(() => process.exit(0));
	});
}
