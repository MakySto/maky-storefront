// Strict local Payload mock with a resettable ORIGIN-REQUEST COUNTER.
//
// The point of this file is the counter. `[cms] served` in the storefront is logged after
// every fetchCmsPage() call, whether Next's patched fetch went to the network or answered
// from the Data Cache — so it counts consumer reads, not origin traffic. Only the server
// on the other end of the wire knows how many requests actually arrived.
import { createServer } from "node:http";

const PORT = Number(process.argv[2] || 4055);

let originRequests = 0;
let revision = "A";
const seen = [];

const DOC = (rev) => ({
	docs: [
		{
			id: "019fb008-504b-779e-ad3f-1ff353267c88",
			title: "O nás",
			slug: "o-nas",
			summary: null,
			markets: ["SK"],
			meta: { title: "O nás", description: "Mock popis.", image: null },
			updatedAt: rev === "A" ? "2026-07-30T20:05:32.363Z" : "2026-07-30T21:11:11.111Z",
			createdAt: "2026-07-30T00:39:00.000Z",
			_status: "published",
			layout: [
				{
					id: "6a6a80ddb64969525d329160",
					anchorId: null,
					blockName: null,
					markets: null,
					blockType: "richText",
					content: {
						root: {
							type: "root",
							format: "",
							indent: 0,
							version: 1,
							direction: "ltr",
							children: [
								{
									type: "paragraph",
									format: "",
									indent: 0,
									version: 1,
									direction: "ltr",
									children: [
										{
											type: "text",
											text:
												rev === "A" ? "REVISION-ALPHA marker paragraph." : "REVISION-BRAVO marker paragraph.",
											format: 0,
											detail: 0,
											mode: "normal",
											style: "",
											version: 1,
										},
									],
								},
							],
						},
					},
				},
			],
		},
	],
	hasNextPage: false,
	hasPrevPage: false,
	limit: 1,
	nextPage: null,
	page: 1,
	pagingCounter: 1,
	prevPage: null,
	totalDocs: 1,
	totalPages: 1,
});

createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

	if (url.pathname === "/__stats") {
		res.writeHead(200, { "content-type": "application/json" });
		return res.end(JSON.stringify({ originRequests, revision, seen }));
	}
	if (url.pathname === "/__reset") {
		originRequests = 0;
		seen.length = 0;
		res.writeHead(200, { "content-type": "application/json" });
		return res.end(JSON.stringify({ ok: true, originRequests }));
	}
	if (url.pathname === "/__switch") {
		revision = url.searchParams.get("to") === "B" ? "B" : "A";
		res.writeHead(200, { "content-type": "application/json" });
		return res.end(JSON.stringify({ ok: true, revision }));
	}

	if (url.pathname === "/api/pages") {
		originRequests += 1;
		// Header NAMES only — never the CF secret values.
		seen.push({
			at: new Date().toISOString(),
			method: req.method,
			path: url.pathname + url.search,
			headerNames: Object.keys(req.headers).sort(),
		});
		res.writeHead(200, { "content-type": "application/json" });
		return res.end(JSON.stringify(DOC(revision)));
	}

	res.writeHead(404, { "content-type": "application/json" });
	res.end(JSON.stringify({ error: "not found" }));
}).listen(PORT, "127.0.0.1", () => {
	console.log(`mock payload on http://127.0.0.1:${PORT}`);
});
