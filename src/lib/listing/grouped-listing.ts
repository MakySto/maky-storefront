/**
 * A category listing in its recommended order: the category's own products first, its
 * accessories and spare parts after — ordered, counted and paged over the WHOLE result.
 *
 * Why a listing needs this: Saleor's default order is by slug, so "Strešné boxy" opened on
 * fourteen Kjust bags ("cestovna-taska-…" sorts before "stresny-box-…") and "Nosiče bicyklov"
 * on adapters. Re-sorting the twelve rows of one page would only hide that on page one and
 * show it again on page two. So each group is its own Saleor query — the same filters plus
 * `productTypes` (see `product-groups.ts`) — and the pages run through the first group and
 * then into the second as one list. Within a group the order stays Saleor's.
 *
 * Saleor pages with keyset cursors (`first/after`, `last/before`). A page cursor here names
 * the group as well — `m~<cursor>` or `a~<cursor>` — so "next" and "previous" know which
 * query to continue. A page that straddles the boundary takes the rest of one group and the
 * start of the other, so every forward page is full and "previous" lands on the same pages.
 *
 * Only for Saleor's default order. When a shopper sorts by price or date, that order is
 * theirs and it applies to everything at once; this module is not involved.
 */

export type ListingGroup = "main" | "accessories";

export interface ListingWindow {
	readonly first?: number;
	readonly after?: string | null;
	readonly last?: number;
	readonly before?: string | null;
}

export interface GroupedRequest {
	readonly main: ListingWindow;
	readonly accessories: ListingWindow;
}

export interface GroupPosition {
	readonly group: ListingGroup;
	readonly cursor: string | null;
	readonly direction: "next" | "prev";
}

interface PageInfo {
	readonly hasNextPage: boolean;
	readonly hasPreviousPage: boolean;
}

export interface GroupConnection<N> {
	readonly edges: ReadonlyArray<{ readonly node: N; readonly cursor: string }>;
	readonly pageInfo: PageInfo;
	readonly totalCount?: number | null;
}

export interface GroupedResponse<C, N> {
	readonly category: C;
	readonly main: GroupConnection<N>;
	readonly accessories: GroupConnection<N>;
	/** The same filter without the split: what the two groups must add up to. */
	readonly all: number;
}

export interface GroupedPage<N> {
	readonly items: ReadonlyArray<{ readonly node: N; readonly group: ListingGroup }>;
	readonly pageInfo: {
		readonly hasNextPage: boolean;
		readonly hasPreviousPage: boolean;
		readonly startCursor: string | null;
		readonly endCursor: string | null;
	};
	readonly totals: { readonly main: number; readonly accessories: number };
}

export type GroupedOutcome<C, N> =
	| { readonly status: "ok"; readonly category: C; readonly page: GroupedPage<N> }
	| { readonly status: "not-found" }
	/** The groups do not add up to the whole: a product type the split does not know. */
	| {
			readonly status: "incomplete";
			readonly main: number;
			readonly accessories: number;
			readonly all: number;
	  };

const PREFIX: Record<ListingGroup, string> = { main: "m~", accessories: "a~" };

/** Enough to learn a group's size; the one row it returns is not used. */
const COUNT_ONLY: ListingWindow = { first: 1 };

export function encodeGroupCursor(group: ListingGroup, cursor: string | null): string {
	return PREFIX[group] + (cursor ?? "");
}

/** Does this `?cursor=` belong to the grouped order? Saleor's own cursors are base64: no `~`. */
export function isGroupCursor(raw: string | null | undefined): boolean {
	return typeof raw === "string" && /^[ma]~/.test(raw);
}

/**
 * Where the requested page starts. A cursor from Saleor's own order — a link from before this
 * order existed — is read as a position in the main group: Saleor's cursors carry the sort key
 * itself (slug and id), so it still means "after this product".
 */
export function parseGroupPosition(params: { cursor?: unknown; direction?: unknown }): GroupPosition {
	const raw = typeof params.cursor === "string" ? params.cursor : "";
	const direction = params.direction === "prev" ? "prev" : "next";

	let group: ListingGroup = "main";
	let cursor: string | null = raw || null;
	if (isGroupCursor(raw)) {
		group = raw.startsWith(PREFIX.accessories) ? "accessories" : "main";
		cursor = raw.slice(2) || null;
	}
	// "Before nothing" in the main group is the first page, however it was asked for.
	if (direction === "prev" && group === "main" && !cursor) return { group, cursor: null, direction: "next" };
	return { group, cursor, direction };
}

/** The windows of the first request for a page. */
export function planFirstRequest(position: GroupPosition, size: number): GroupedRequest {
	const { group, cursor, direction } = position;
	if (direction === "next") {
		return group === "main"
			? { main: { first: size, after: cursor }, accessories: COUNT_ONLY }
			: { main: COUNT_ONLY, accessories: { first: size, after: cursor } };
	}
	if (group === "main") return { main: { last: size, before: cursor }, accessories: COUNT_ONLY };
	// Before the first accessory is the tail of the main group.
	return cursor
		? { main: COUNT_ONLY, accessories: { last: size, before: cursor } }
		: { main: { last: size }, accessories: COUNT_ONLY };
}

const count = (connection: GroupConnection<unknown>) => connection.totalCount ?? 0;
const tag = <N>(edges: GroupConnection<N>["edges"], group: ListingGroup) =>
	edges.map((edge) => ({ node: edge.node, group }));

/**
 * One page of the grouped listing: one Saleor request, or two when the page straddles the
 * boundary between the groups. `fetch` answers `null` when the category does not exist and
 * throws on a fault — a fault is the caller's to report, never a page to assemble.
 */
export async function loadGroupedPage<C, N>(
	position: GroupPosition,
	size: number,
	fetch: (request: GroupedRequest) => Promise<GroupedResponse<C, N> | null>,
): Promise<GroupedOutcome<C, N>> {
	const first = await fetch(planFirstRequest(position, size));
	if (!first) return { status: "not-found" };

	const totals = { main: count(first.main), accessories: count(first.accessories) };
	if (totals.main + totals.accessories !== first.all) {
		return { status: "incomplete", ...totals, all: first.all };
	}

	const page = (
		items: GroupedPage<N>["items"],
		pageInfo: Omit<GroupedPage<N>["pageInfo"], "startCursor" | "endCursor">,
		edges: {
			first?: { group: ListingGroup; cursor: string };
			last?: { group: ListingGroup; cursor: string };
		},
		endOverride?: string,
	): GroupedOutcome<C, N> => ({
		status: "ok",
		category: first.category,
		page: {
			items,
			pageInfo: {
				...pageInfo,
				startCursor: edges.first ? encodeGroupCursor(edges.first.group, edges.first.cursor) : null,
				endCursor:
					endOverride ?? (edges.last ? encodeGroupCursor(edges.last.group, edges.last.cursor) : null),
			},
			totals,
		},
	});
	const ends = <N2>(group: ListingGroup, list: GroupConnection<N2>["edges"]) => ({
		first: list[0] ? { group, cursor: list[0].cursor } : undefined,
		last: list.length ? { group, cursor: list[list.length - 1]!.cursor } : undefined,
	});

	const { group, direction } = position;

	// Forward through the accessories, or backward through the main group: never crosses over.
	if (direction === "next" && group === "accessories") {
		const accessories = first.accessories;
		return page(
			tag(accessories.edges, "accessories"),
			{
				hasNextPage: accessories.pageInfo.hasNextPage,
				hasPreviousPage: accessories.pageInfo.hasPreviousPage || totals.main > 0,
			},
			ends("accessories", accessories.edges),
		);
	}
	if (direction === "prev" && group === "main") {
		const main = first.main;
		return page(
			tag(main.edges, "main"),
			{ hasNextPage: true, hasPreviousPage: main.pageInfo.hasPreviousPage },
			ends("main", main.edges),
		);
	}

	// Backward from the accessories' start marker: the tail of the main group.
	if (direction === "prev" && group === "accessories" && !position.cursor) {
		const main = first.main;
		return page(
			tag(main.edges, "main"),
			{ hasNextPage: totals.accessories > 0, hasPreviousPage: main.pageInfo.hasPreviousPage },
			ends("main", main.edges),
			totals.accessories > 0 ? encodeGroupCursor("accessories", null) : undefined,
		);
	}

	// Forward through the main group — into the accessories when it runs out on this page.
	if (direction === "next") {
		const main = first.main;
		const mainItems = tag(main.edges, "main");
		const mainEnds = ends("main", main.edges);
		const mainHadPrevious = main.edges.length > 0 ? main.pageInfo.hasPreviousPage : totals.main > 0;

		if (main.pageInfo.hasNextPage) {
			return page(mainItems, { hasNextPage: true, hasPreviousPage: main.pageInfo.hasPreviousPage }, mainEnds);
		}
		const room = size - main.edges.length;
		if (totals.accessories === 0 || room === 0) {
			// The main group ends exactly here; the accessories, if any, start on the next page.
			return page(
				mainItems,
				{ hasNextPage: totals.accessories > 0, hasPreviousPage: mainHadPrevious },
				mainEnds,
				totals.accessories > 0 ? encodeGroupCursor("accessories", null) : undefined,
			);
		}

		const rest = await fetch({ main: COUNT_ONLY, accessories: { first: room } });
		if (!rest) return { status: "not-found" };
		const accessories = rest.accessories;
		const accessoryEnds = ends("accessories", accessories.edges);
		return page(
			[...mainItems, ...tag(accessories.edges, "accessories")],
			{
				hasNextPage: accessories.pageInfo.hasNextPage,
				hasPreviousPage: main.edges.length > 0 ? main.pageInfo.hasPreviousPage : totals.main > 0,
			},
			{ first: mainEnds.first ?? accessoryEnds.first, last: accessoryEnds.last ?? mainEnds.last },
		);
	}

	// Backward through the accessories — into the tail of the main group when they run out.
	const accessories = first.accessories;
	const accessoryItems = tag(accessories.edges, "accessories");
	const accessoryEnds = ends("accessories", accessories.edges);
	if (accessories.pageInfo.hasPreviousPage || totals.main === 0) {
		return page(
			accessoryItems,
			{ hasNextPage: true, hasPreviousPage: accessories.pageInfo.hasPreviousPage },
			accessoryEnds,
		);
	}
	const room = size - accessories.edges.length;
	if (room === 0) {
		// This page starts exactly at the first accessory; the one before it is main's tail.
		return page(accessoryItems, { hasNextPage: true, hasPreviousPage: true }, accessoryEnds);
	}

	const rest = await fetch({ main: { last: room }, accessories: COUNT_ONLY });
	if (!rest) return { status: "not-found" };
	const main = rest.main;
	const mainEnds = ends("main", main.edges);
	return page(
		[...tag(main.edges, "main"), ...accessoryItems],
		{ hasNextPage: true, hasPreviousPage: main.pageInfo.hasPreviousPage },
		{ first: mainEnds.first ?? accessoryEnds.first, last: accessoryEnds.last ?? mainEnds.last },
	);
}
