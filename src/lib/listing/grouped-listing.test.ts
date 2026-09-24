import { describe, expect, it } from "vitest";

import {
	encodeGroupCursor,
	isGroupCursor,
	loadGroupedPage,
	parseGroupPosition,
	type GroupConnection,
	type GroupedRequest,
	type ListingWindow,
} from "./grouped-listing";

/**
 * A fake Saleor with real keyset semantics: `first/after` and `last/before` over two ordered
 * lists, a cursor per edge, `hasNextPage`/`hasPreviousPage` as Saleor reports them (checked
 * against api.maky.store on 2026-09-24, including `last` without `before` = the tail).
 */
function fakeSaleor(mainCount: number, accessoryCount: number, all = mainCount + accessoryCount) {
	const main = Array.from({ length: mainCount }, (_, i) => `box-${String(i + 1).padStart(3, "0")}`);
	const accessories = Array.from(
		{ length: accessoryCount },
		(_, i) => `bag-${String(i + 1).padStart(3, "0")}`,
	);
	const requests: GroupedRequest[] = [];

	const window = (list: string[], w: ListingWindow): GroupConnection<string> => {
		let start = 0;
		let end = list.length;
		if (w.after) start = list.indexOf(w.after) + 1;
		if (w.before) end = list.indexOf(w.before);
		let slice = list.slice(start, end);
		let from = start;
		if (w.first !== undefined) slice = slice.slice(0, w.first);
		if (w.last !== undefined) {
			from = Math.max(start, end - w.last);
			slice = list.slice(from, end);
		}
		const to = from + slice.length;
		return {
			edges: slice.map((node) => ({ node, cursor: node })),
			pageInfo: { hasNextPage: to < list.length, hasPreviousPage: from > 0 },
			totalCount: list.length,
		};
	};

	const fetch = async (request: GroupedRequest) => {
		requests.push(request);
		return {
			category: "stresne-boxy",
			main: window(main, request.main),
			accessories: window(accessories, request.accessories),
			all,
		};
	};
	return { main, accessories, requests, fetch };
}

async function walk(mainCount: number, accessoryCount: number, size = 12) {
	const saleor = fakeSaleor(mainCount, accessoryCount);
	const forward: string[][] = [];
	const starts: (string | null)[] = [];
	let position = parseGroupPosition({});
	for (let guard = 0; guard < 100; guard++) {
		const outcome = await loadGroupedPage(position, size, saleor.fetch);
		if (outcome.status !== "ok") throw new Error(outcome.status);
		forward.push(outcome.page.items.map((item) => item.node));
		starts.push(outcome.page.pageInfo.startCursor);
		expect(outcome.page.pageInfo.hasPreviousPage).toBe(forward.length > 1);
		if (!outcome.page.pageInfo.hasNextPage) break;
		position = parseGroupPosition({ cursor: outcome.page.pageInfo.endCursor, direction: "next" });
	}

	// …and back from the last page, following each page's start cursor.
	const backward: string[][] = [];
	for (let i = forward.length - 1; i > 0; i--) {
		const outcome = await loadGroupedPage(
			parseGroupPosition({ cursor: starts[i], direction: "prev" }),
			size,
			saleor.fetch,
		);
		if (outcome.status !== "ok") throw new Error(outcome.status);
		backward.unshift(outcome.page.items.map((item) => item.node));
		expect(outcome.page.pageInfo.hasNextPage).toBe(true);
		expect(outcome.page.pageInfo.hasPreviousPage).toBe(i - 1 > 0);
	}
	return { saleor, forward, backward };
}

describe("grouped listing — the whole result, main group first", () => {
	for (const [mainCount, accessoryCount] of [
		[60, 41], // stresne-boxy on 2026-09-24
		[24, 12], // the boundary falls exactly between two pages
		[25, 30], // one main product on the boundary page
		[5, 3], // everything on one page
		[0, 41], // an accessory category: nothing in front
		[22, 0], // a category with no accessories at all
		[12, 1],
	]) {
		it(`${mainCount} products + ${accessoryCount} accessories: every row once, in order, in full pages`, async () => {
			const { saleor, forward, backward } = await walk(mainCount, accessoryCount);

			expect(forward.flat()).toEqual([...saleor.main, ...saleor.accessories]);
			// Every page but the last is full, so no page is shorter because it hit the boundary.
			for (const rows of forward.slice(0, -1)) expect(rows).toHaveLength(12);
			// "Previous" lands on exactly the pages "next" produced.
			expect(backward).toEqual(forward.slice(0, -1));
		});
	}

	it("stays one request per page except where a page crosses from one group into the other", async () => {
		const saleor = fakeSaleor(25, 30);
		let position = parseGroupPosition({});
		const perPage: number[] = [];
		for (;;) {
			const before = saleor.requests.length;
			const outcome = await loadGroupedPage(position, 12, saleor.fetch);
			if (outcome.status !== "ok") throw new Error(outcome.status);
			perPage.push(saleor.requests.length - before);
			if (!outcome.page.pageInfo.hasNextPage) break;
			position = parseGroupPosition({ cursor: outcome.page.pageInfo.endCursor, direction: "next" });
		}
		// 12 + 12 main, then 1 main + 11 accessories (two requests), then accessories.
		expect(perPage).toEqual([1, 1, 2, 1, 1]);
	});

	it("marks which rows are accessories, so the page can say where they start", async () => {
		const saleor = fakeSaleor(25, 30);
		const third = await loadGroupedPage(
			parseGroupPosition({ cursor: encodeGroupCursor("main", "box-024"), direction: "next" }),
			12,
			saleor.fetch,
		);
		if (third.status !== "ok") throw new Error(third.status);
		expect(third.page.items.map((item) => item.group)).toEqual(["main", ...Array(11).fill("accessories")]);
		expect(third.page.totals).toEqual({ main: 25, accessories: 30 });
	});

	it("refuses the split when the groups do not add up to the whole listing", async () => {
		// A product whose type is in neither group — created after the type list was read.
		const saleor = fakeSaleor(60, 41, 102);
		const outcome = await loadGroupedPage(parseGroupPosition({}), 12, saleor.fetch);
		expect(outcome).toEqual({ status: "incomplete", main: 60, accessories: 41, all: 102 });
	});

	it("reports a category Saleor does not have", async () => {
		const outcome = await loadGroupedPage(parseGroupPosition({}), 12, async () => null);
		expect(outcome).toEqual({ status: "not-found" });
	});
});

describe("grouped cursors", () => {
	it("round-trip through the URL and name their group", () => {
		expect(
			parseGroupPosition({ cursor: encodeGroupCursor("accessories", "WyJhIiwiMSJd"), direction: "next" }),
		).toEqual({ group: "accessories", cursor: "WyJhIiwiMSJd", direction: "next" });
		expect(parseGroupPosition({ cursor: "a~", direction: "next" })).toEqual({
			group: "accessories",
			cursor: null,
			direction: "next",
		});
	});

	it("read a cursor from Saleor's own order as a position in the main group", () => {
		// Saleor's cursors are base64 keysets: they never contain "~".
		expect(isGroupCursor("WyJzdHJlc255LWJveCIsIjc0Il0=")).toBe(false);
		expect(parseGroupPosition({ cursor: "WyJzdHJlc255LWJveCIsIjc0Il0=", direction: "next" })).toEqual({
			group: "main",
			cursor: "WyJzdHJlc255LWJveCIsIjc0Il0=",
			direction: "next",
		});
	});

	it("treat anything malformed as the first page", () => {
		expect(parseGroupPosition({ cursor: ["x"], direction: "sideways" })).toEqual({
			group: "main",
			cursor: null,
			direction: "next",
		});
		expect(parseGroupPosition({ direction: "prev" })).toEqual({
			group: "main",
			cursor: null,
			direction: "next",
		});
	});
});
