import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderModule } from "../../scripts/generate-public-assets.mjs";
import { PUBLIC_ASSET_PATHS, METADATA_ROUTE_PATHS } from "./public-assets.generated";

/**
 * The generated list is committed rather than produced during `next build`, so a
 * build never writes into the tree — `scripts/ops/deploy-production.sh` refuses
 * to deploy a dirty one. This is what keeps it honest instead.
 *
 * If this fails, run `pnpm generate:public-assets` and commit the result.
 */
describe("public asset manifest", () => {
	it("matches what is actually on disk", () => {
		const onDisk = renderModule();
		const committed = readFileSync(join(process.cwd(), "src/lib/public-assets.generated.ts"), "utf8");
		expect(committed).toBe(onDisk);
	});

	it("covers the files the site links to from every page", () => {
		// A regression here would 404 the logo sitewide, which is exactly the class
		// of mistake the proxy matcher change could introduce.
		for (const path of ["/logo.svg", "/logo-dark.svg", "/logo-deer.webp", "/llms.txt"]) {
			expect(PUBLIC_ASSET_PATHS.has(path), path).toBe(true);
		}
	});

	it("covers the root metadata routes Next generates", () => {
		for (const path of ["/robots.txt", "/sitemap.xml"]) {
			expect(METADATA_ROUTE_PATHS.has(path), path).toBe(true);
		}
	});
});
