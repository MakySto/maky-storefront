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
 *     MAKY_CATALOG_CONTENT_PATH=… MAKY_FITMENT_DATASET_PATH=… pnpm vitest run whole-set
 */
const CONTENT_PATH = process.env.MAKY_CATALOG_CONTENT_PATH?.trim();
const FITMENT_PATH = process.env.MAKY_FITMENT_DATASET_PATH?.trim();
const available = Boolean(
	CONTENT_PATH && existsSync(CONTENT_PATH) && FITMENT_PATH && existsSync(FITMENT_PATH),
);

/**
 * The POST-PUBLISH delivery. Verified 2026-09-12 by downloading all ten artifacts and
 * `SHA256SUMS_CONTENT_20260912` from https://carfitmanager.com/media/fitment/ and
 * checking the DOWNLOADED BYTES against the published manifest — `sha256sum -c`, all OK.
 * Every number below was measured here, not transcribed from a handoff.
 *
 * What changed from the 2026-09-11 pre-publish copy the consumer was built against:
 * `state` went draft 1475 → published 1474 / draft 1; `hasEditorialText` 1473 → 1474
 * (`/stresne-nosice/seat/ateca` got its text); `routeLanguage` is new; and `top`/`body`
 * are materialised where they used to be empty.
 */
const DELIVERED = {
	file: "maky_catalog_content_1.0.0-sk-20260912.json",
	bytes: 9_737_293,
	transport: "5a8b9e48078935557cd57f43a7c40ddaf7878a8674015a3f9751986cb899acd5",
	selfSha256: "b9aa9774bf93f3a86ec99445c7fc340f52d969be7803f4f9052c6d71c4230874",
	language: "sk",
	pages: 1475,
	byKind: { vehicle_make: 62, vehicle_model: 557, vehicle_generation: 856 },
	withEditorialText: 1474,
	published: 1474,
	/**
	 * CFM left this one `draft` on purpose: it has no Slovak editorial text, and
	 * `--allow-empty` was not used. It is `indexable: true` like all 1475 — which is
	 * exactly why `state`, not `indexable`, has to be the gate.
	 */
	draft: ["/stresne-nosice/lynk-co/01"],
	textless: ["/stresne-nosice/lynk-co/01"],
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

	it("joins to the fitment f.tree on vehicleId with no orphans on either side", () => {
		const f = fixture();
		expect(f.tree.stats.pages).toBe(DELIVERED.pages);
		expect(f.tree.stats.joined).toBe(DELIVERED.pages);
		expect(f.tree.stats.nodesWithoutPage).toBe(0);
		expect(f.tree.stats.pagesWithoutNode).toBe(0);
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
	 * This asserts the copy half. The route halves are fixed where they are rendered: the
	 * tiles filter on visibility and an unpublished breadcrumb ancestor loses its href.
	 *
	 * It is stated as a COUNT of the known case rather than `toEqual([])`, so the day CFM
	 * publishes that page this test fails and gets deleted, instead of passing quietly and
	 * leaving the renderer suppressing links that no longer need suppressing.
	 */
	it("knows exactly which published copy points at a page that will not render", () => {
		const f = fixture();
		const visible = new Set(f.snapshot.pages.filter((p) => visibilityOf(p).visible).map((p) => p.urlPath));

		const dangling: string[] = [];
		for (const page of f.snapshot.pages) {
			if (!visibilityOf(page).visible) continue;
			for (const block of [...splitContent(page).top, ...splitContent(page).body]) {
				const texts = block.type === "list" ? block.data.items : [block.data.text];
				for (const text of texts) {
					for (const node of parseInline(text)) {
						if (node.kind === "link" && !visible.has(node.href)) {
							dangling.push(`${page.urlPath} -> ${node.href}`);
						}
					}
				}
			}
		}

		expect(dangling.sort()).toEqual([
			"/stresne-nosice/lynk-co -> /stresne-nosice/lynk-co/01",
			"/stresne-nosice/lynk-co/01/2020-2024 -> /stresne-nosice/lynk-co/01",
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
	 * deliberately held back the one page with no Slovak text.
	 */
	it("publishes 1 474 and keeps the textless page back", () => {
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
	 * The trap CFM called out explicitly: `indexable` is `true` on all 1475, the draft
	 * included. A consumer that filtered on `indexable` would publish a page with no
	 * text. `state` is the gate; `indexable` only narrows what is already visible.
	 */
	it("indexes 1 474 and never the thin one, because state is the gate", () => {
		const f = fixture();
		expect(f.snapshot.pages.every((p) => p.indexable === true)).toBe(true);

		const indexable = f.snapshot.pages.filter((p) => indexabilityOf(p).indexable);
		expect(indexable).toHaveLength(DELIVERED.withEditorialText);
		for (const path of DELIVERED.textless) {
			expect(
				indexable.some((p) => p.urlPath === path),
				path,
			).toBe(false);
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
