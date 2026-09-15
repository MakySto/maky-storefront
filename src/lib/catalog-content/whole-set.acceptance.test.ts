import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { type FitmentDataset } from "@/lib/fitment/contract";
import { parseContentSnapshot } from "./contract";
import { parseInline, safeInternalPath } from "./inline";
import { indexabilityOf, visibilityOf } from "./publication";
import { hasReadableText, splitContent } from "./text";
import { ancestorsOf, buildCatalogTree } from "./tree";

/**
 * The WHOLE set, checked with the real consumer code — not three hand-picked pages.
 *
 * Three pages prove a layout. They cannot prove 1 473, and the failures that matter at
 * this size are the uniform ones: a join that silently misses a branch, a link that
 * points at a page nobody published, a block type the renderer drops. So this walks
 * every page through the same functions the routes use.
 *
 * Skipped when the artifacts are absent, exactly like `full-dataset-acceptance.test.ts`:
 * `pnpm test` must not depend on an 18 MB download, and this repository is a public fork
 * (CLAUDE.md §10.1) so the artifacts are not committed. The committed constants are what
 * make the skip harmless — running it later re-proves the same claim rather than whatever
 * CFM happens to be serving.
 *
 *     MAKY_CATALOG_CONTENT_PATH=…-{lang}-….json MAKY_FITMENT_DATASET_PATH=… pnpm check:catalog
 *
 * A `{lang}` family — how production is configured — is read here for its Slovak member.
 */
const CONTENT_PATH = process.env.MAKY_CATALOG_CONTENT_PATH?.trim().split("{lang}").join("sk");
const FITMENT_PATH = process.env.MAKY_FITMENT_DATASET_PATH?.trim();
const available = Boolean(
	CONTENT_PATH && existsSync(CONTENT_PATH) && FITMENT_PATH && existsSync(FITMENT_PATH),
);

/**
 * The 2026-09-15 delivery. Verified 2026-09-15 by downloading all thirteen files with
 * `SHA256SUMS_FULL_20260915` and `SHA256SUMS_CONTENT_20260915` from
 * https://carfitmanager.com/media/fitment/ and checking the DOWNLOADED BYTES against the
 * published manifests — `sha256sum -c`, all OK. Every number below was measured here, not
 * transcribed from a handoff.
 *
 * What changed from 2026-09-12: VOZIDLA-2 moved 20 products onto the right cars, which
 * brought three new generation pages — all `draft`, all textless — and RETIRED two. Legacy
 * Kombi BP and H-1 Van TQ are still published in the export, with their text, but the
 * fitment tree no longer has their car; they answer through `redirects.json`. The other
 * 1 475 pages are unchanged, field for field.
 *
 * The join numbers are against `maky_roof_fitment_3.0.0-full-20260915.json`.
 */
const DELIVERED = {
	file: "maky_catalog_content_1.0.0-sk-20260915.json",
	bytes: 9_738_836,
	transport: "27852f7476eefef5bcbed2fb93c6f05dde2a3680941a6ab66e95d6d701c06607",
	selfSha256: "114c529278bec7a55e879eae94ba4245635f134c01795150048b34f9673ffb8e",
	language: "sk",
	pages: 1478,
	byKind: { vehicle_make: 62, vehicle_model: 557, vehicle_generation: 859 },
	withEditorialText: 1474,
	published: 1474,
	/**
	 * CFM leaves a page `draft` while it has no Slovak editorial text; `--allow-empty` was not
	 * used. `lynk-co/01` since 2026-09-12, and the three generations VOZIDLA-2 created, seeded
	 * with nothing but their code as a heading. All four are `indexable: true` like every
	 * page — which is exactly why `state`, not `indexable`, has to be the gate.
	 */
	draft: [
		"/stresne-nosice/hyundai/h-1-van/a1",
		"/stresne-nosice/lynk-co/01",
		"/stresne-nosice/subaru/legacy-kombi/bh",
		"/stresne-nosice/volkswagen/golf-variant/ba5",
	],
	textless: [
		"/stresne-nosice/hyundai/h-1-van/a1",
		"/stresne-nosice/lynk-co/01",
		"/stresne-nosice/subaru/legacy-kombi/bh",
		"/stresne-nosice/volkswagen/golf-variant/ba5",
	],
	/**
	 * Published, with text, and without a car: their generation left the fitment tree when
	 * its products turned out to fit a different one. Nothing renders them; the proxy
	 * redirects them. Named so that a page cannot lose its node silently.
	 */
	retired: ["/stresne-nosice/hyundai/h-1-van/tq", "/stresne-nosice/subaru/legacy-kombi/bp"],
	/** What the sitemap may list: visible, `indexable`, with text — and a node to render it. */
	indexed: 1472,
} as const;

/**
 * Loaded lazily. `describe.skipIf` still EVALUATES the describe body, so reading the
 * files at that level threw on every ordinary `pnpm test` run — the whole point of the
 * skip is that the suite must not need an 18 MB download.
 */
let loaded: {
	bytes: Buffer;
	snapshot: ReturnType<typeof parseContentSnapshot>;
	tree: ReturnType<typeof buildCatalogTree>;
} | null = null;

function fixture() {
	if (!loaded) {
		const bytes = readFileSync(CONTENT_PATH!);
		const snapshot = parseContentSnapshot(JSON.parse(bytes.toString("utf8")));
		const dataset = JSON.parse(readFileSync(FITMENT_PATH!, "utf8")) as FitmentDataset;
		loaded = { bytes, snapshot, tree: buildCatalogTree(snapshot, dataset) };
	}
	return loaded;
}

describe.skipIf(!available)("the delivered catalogue content, end to end", () => {
	it("is the artifact we accepted, byte for byte", () => {
		const f = fixture();
		expect(f.bytes.byteLength).toBe(DELIVERED.bytes);
		expect(createHash("sha256").update(f.bytes).digest("hex")).toBe(DELIVERED.transport);
		expect(f.snapshot.selfSha256).toBe(DELIVERED.selfSha256);
		expect(f.snapshot.language).toBe(DELIVERED.language);
		expect(f.snapshot.pages).toHaveLength(DELIVERED.pages);
	});

	it("carries the kinds we expect, and no others", () => {
		const f = fixture();
		const byKind: Record<string, number> = {};
		for (const page of f.snapshot.pages) byKind[page.kind] = (byKind[page.kind] ?? 0) + 1;
		expect(byKind).toEqual(DELIVERED.byKind);
	});

	it("joins to the fitment tree on vehicleId, leaving only the retired pages without a node", () => {
		const f = fixture();
		expect(f.tree.stats.pages).toBe(DELIVERED.pages);
		expect(f.tree.stats.joined).toBe(DELIVERED.pages - DELIVERED.retired.length);
		expect(f.tree.stats.nodesWithoutPage).toBe(0);
		expect(f.tree.stats.pagesWithoutNode).toBe(DELIVERED.retired.length);

		const withoutNode = f.snapshot.pages
			.filter((p) => !p.vehicleId || !f.tree.byVehicleId.has(p.vehicleId))
			.map((p) => p.urlPath)
			.sort();
		expect(withoutNode).toEqual([...DELIVERED.retired].sort());
	});

	it("has a unique URL and a unique identity per page", () => {
		const f = fixture();
		expect(new Set(f.snapshot.pages.map((p) => p.urlPath)).size).toBe(DELIVERED.pages);
		expect(new Set(f.snapshot.pages.map((p) => p.publicId)).size).toBe(DELIVERED.pages);
	});

	it("gives every model and generation a resolvable parent", () => {
		const f = fixture();
		for (const node of f.tree.byVehicleId.values()) {
			if (node.kind === "make") continue;
			expect(node.parentId, node.urlPath).toBeTruthy();
			expect(f.tree.byVehicleId.has(node.parentId!), node.urlPath).toBe(true);
			expect(ancestorsOf(f.tree, node).length, node.urlPath).toBe(node.kind === "model" ? 1 : 2);
		}
	});

	it("renders text for every page that claims to have it", () => {
		const f = fixture();
		const claimed = f.snapshot.pages.filter((p) => p.hasEditorialText);
		expect(claimed).toHaveLength(DELIVERED.withEditorialText);
		for (const page of claimed) expect(hasReadableText(page), page.urlPath).toBe(true);
	});

	it("names the pages without text, so they cannot grow silently", () => {
		const f = fixture();
		const textless = f.snapshot.pages
			.filter((p) => !p.hasEditorialText)
			.map((p) => p.urlPath)
			.sort();
		expect(textless).toEqual([...DELIVERED.textless].sort());
	});

	/**
	 * The pre-publish export shipped no split and this asserted that all 1473 were
	 * DERIVED. The post-publish export ships one, so the live path is now the export
	 * — and the derivation, which used to be the only path, is the fallback.
	 *
	 * Both are checked against each other rather than one being trusted: the cut at
	 * the first header reproduces the shipped split exactly, on every page. If CFM
	 * ever changes where it cuts, that is a real content change and this says so
	 * instead of quietly rendering something else.
	 */
	it("uses the split the export ships, and agrees with the derivation everywhere", () => {
		const f = fixture();
		let fromExport = 0;
		for (const page of f.snapshot.pages) {
			const split = splitContent(page);
			if (split.source === "export") fromExport++;
			// intro is never rendered alongside the split: the split IS the intro, cut once.
			expect(split.source === "export" && split.top.length + split.body.length === 0).toBe(false);

			const blocks = page.intro?.blocks ?? [];
			expect([...split.top, ...split.body], page.urlPath).toEqual([...blocks]);
			const cut = blocks.findIndex((block) => block.type === "header");
			expect(split.top, page.urlPath).toEqual(cut <= 0 ? [] : blocks.slice(0, cut));
		}
		expect(fromExport).toBe(DELIVERED.withEditorialText);
	});

	it("contains only block types the renderer handles", () => {
		const f = fixture();
		const types = new Set<string>();
		for (const page of f.snapshot.pages) {
			for (const block of [...splitContent(page).top, ...splitContent(page).body]) {
				types.add(block.type);
				if (block.type === "header") expect([2, 3]).toContain(block.data.level);
				if (block.type === "list") expect(["ordered", "unordered"]).toContain(block.data.style);
			}
		}
		expect([...types].sort()).toEqual(["header", "list", "paragraph"]);
	});

	it("links only to pages that exist in this same f.snapshot", () => {
		const f = fixture();
		const paths = new Set(f.snapshot.pages.map((p) => p.urlPath));
		const dangling: string[] = [];
		for (const page of f.snapshot.pages) {
			for (const block of [...splitContent(page).top, ...splitContent(page).body]) {
				const texts = block.type === "list" ? block.data.items : [block.data.text];
				for (const text of texts) {
					for (const node of parseInline(text)) {
						if (node.kind === "link" && !paths.has(node.href))
							dangling.push(`${page.urlPath} -> ${node.href}`);
					}
				}
			}
		}
		expect(dangling).toEqual([]);
	});

	/**
	 * The invariant the 2026-09-12 publication broke, and the reason it was worth finding.
	 *
	 * `links only to pages that exist` above tests EXISTENCE, and existence is not enough
	 * once some pages are published and others are not. CFM held back one page — a MODEL,
	 * `/stresne-nosice/lynk-co/01` — whose make above it and generation below it are both
	 * published. Measured on the served HTML, it was reachable from three directions:
	 * the make page's child tiles, the generation page's breadcrumb, and the inline copy
	 * of two published pages. Each one is a link, inside published prose, onto a body that
	 * says the page does not exist.
	 *
	 * Publication is not enough either since 2026-09-15: a RETIRED page is published and
	 * still does not render, because its car left the tree. So "renders" here is the route's
	 * own test — a node whose page is visible — and the Legacy Kombi and H-1 Van model pages
	 * show up linking to the generations CFM retired. The renderer drops those anchors
	 * because they are redirect sources; see `isLinkable` in the vehicle route.
	 *
	 * This asserts the copy half. The route halves are fixed where they are rendered: the
	 * tiles filter on visibility and an unpublished breadcrumb ancestor loses its href.
	 *
	 * It is stated as the exact known cases rather than `toEqual([])`, so the day CFM
	 * publishes those pages or rewrites that copy this test fails and gets updated, instead
	 * of passing quietly and leaving the renderer suppressing links that no longer need it.
	 */
	it("knows exactly which rendered copy points at a page that will not render", () => {
		const f = fixture();
		const renders = new Set(
			[...f.tree.byUrlPath.values()]
				.filter((node) => node.page && visibilityOf(node.page).visible)
				.map((node) => node.urlPath),
		);

		const dangling: string[] = [];
		for (const page of f.snapshot.pages) {
			if (!renders.has(page.urlPath)) continue;
			for (const block of [...splitContent(page).top, ...splitContent(page).body]) {
				const texts = block.type === "list" ? block.data.items : [block.data.text];
				for (const text of texts) {
					for (const node of parseInline(text)) {
						if (node.kind === "link" && !renders.has(node.href)) {
							dangling.push(`${page.urlPath} -> ${node.href}`);
						}
					}
				}
			}
		}

		expect(dangling.sort()).toEqual([
			"/stresne-nosice/hyundai/h-1-van -> /stresne-nosice/hyundai/h-1-van/tq",
			"/stresne-nosice/lynk-co -> /stresne-nosice/lynk-co/01",
			"/stresne-nosice/lynk-co/01/2020-2024 -> /stresne-nosice/lynk-co/01",
			"/stresne-nosice/subaru/legacy-kombi -> /stresne-nosice/subaru/legacy-kombi/bp",
		]);
	});

	it("accepts every href the export contains, so no link is silently dropped", () => {
		const f = fixture();
		for (const page of f.snapshot.pages) {
			for (const block of [...splitContent(page).top, ...splitContent(page).body]) {
				const texts = block.type === "list" ? block.data.items : [block.data.text];
				for (const text of texts) {
					for (const match of text.matchAll(/href="([^"]*)"/g)) {
						expect(safeInternalPath(match[1]), `${page.urlPath}: ${match[1]}`).not.toBeNull();
					}
				}
			}
		}
	});

	/**
	 * The state of the delivery, asserted rather than assumed. CFM published 1474 and
	 * deliberately held back the pages with no Slovak text.
	 */
	it("publishes 1 474 and keeps the four textless pages back", () => {
		const f = fixture();
		const visible = f.snapshot.pages.filter((p) => visibilityOf(p).visible);
		expect(visible).toHaveLength(DELIVERED.published);
		expect(new Set(f.snapshot.pages.map((p) => p.state))).toEqual(new Set(["draft", "published"]));

		const held = f.snapshot.pages
			.filter((p) => !visibilityOf(p).visible)
			.map((p) => p.urlPath)
			.sort();
		expect(held).toEqual([...DELIVERED.draft].sort());
	});

	/**
	 * The trap CFM called out explicitly: `indexable` is `true` on every page, the drafts
	 * included. A consumer that filtered on `indexable` would publish pages with no text.
	 * `state` is the gate; `indexable` only narrows what is already visible — and the
	 * sitemap narrows it once more, to what the tree can render, which keeps the retired
	 * pages out.
	 */
	it("indexes 1 472 — never a thin page, never a retired one", () => {
		const f = fixture();
		expect(f.snapshot.pages.every((p) => p.indexable === true)).toBe(true);

		// The walk `sitemap.ts` does: the tree's nodes, each asked `indexabilityOf`.
		const indexed = [...f.tree.byUrlPath.values()]
			.filter((node) => node.page && indexabilityOf(node.page).indexable)
			.map((node) => node.urlPath);
		expect(indexed).toHaveLength(DELIVERED.indexed);
		for (const path of [...DELIVERED.textless, ...DELIVERED.retired]) {
			expect(indexed.includes(path), path).toBe(false);
		}
	});

	/**
	 * `routeLanguage` is new in this export. In `sk` it is `sk` everywhere; in a
	 * translated artifact it marks the pages that borrowed the Slovak route because
	 * they have no text of their own. Asserted here so the field cannot appear, be
	 * ignored, and then start meaning something.
	 */
	it("says which language each route came from", () => {
		const f = fixture();
		for (const page of f.snapshot.pages) {
			expect(page.routeLanguage, page.urlPath).toBe(DELIVERED.language);
		}
	});
});
