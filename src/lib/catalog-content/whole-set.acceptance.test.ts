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

/** Verified 2026-09-11 against https://carfitmanager.com/media/fitment/ */
const DELIVERED = {
	file: "maky_catalog_content_1.0.0-sk-20260911.json",
	bytes: 9_681_675,
	transport: "2833203a15256b699d3db3520a97f78bca90f475618cdca317b72ba40e5b98f0",
	selfSha256: "e5285deec0656ea9776cc115457a57a6bab6a1a426470903534b833afaa64bfe",
	language: "sk",
	pages: 1475,
	byKind: { vehicle_make: 62, vehicle_model: 557, vehicle_generation: 856 },
	withEditorialText: 1473,
	textless: ["/stresne-nosice/lynk-co/01", "/stresne-nosice/seat/ateca"],
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

	it("derives a split for every page, because the export ships none", () => {
		const f = fixture();
		let derived = 0;
		for (const page of f.snapshot.pages) {
			const split = splitContent(page);
			if (split.source === "derived") derived++;
			// intro is never rendered alongside the split: the split IS the intro, cut once.
			expect(split.source === "export" && split.top.length + split.body.length === 0).toBe(false);
		}
		expect(derived).toBe(DELIVERED.withEditorialText);
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
	 * The state of the delivery, asserted rather than assumed. Everything is `draft`, so a
	 * deploy of this f.snapshot publishes nothing — which is the intended order, not a fault.
	 */
	it("publishes nothing yet: every page is draft", () => {
		const f = fixture();
		const visible = f.snapshot.pages.filter((p) => visibilityOf(p).visible);
		expect(visible).toHaveLength(0);
		expect(new Set(f.snapshot.pages.map((p) => p.state))).toEqual(new Set(["draft"]));
	});

	it("would index 1 473 of them once published, and never the two thin ones", () => {
		const f = fixture();
		const asPublished = f.snapshot.pages.map((p) => ({ ...p, state: "published" as const }));
		const indexable = asPublished.filter((p) => indexabilityOf(p).indexable);
		expect(indexable).toHaveLength(DELIVERED.withEditorialText);
		for (const path of DELIVERED.textless) {
			expect(
				indexable.some((p) => p.urlPath === path),
				path,
			).toBe(false);
		}
	});
});
