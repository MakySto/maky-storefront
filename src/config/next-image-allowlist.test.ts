import { type IncomingMessage } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import loadConfig from "next/dist/server/config.js";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer.js";

const PRODUCTION_IMAGE_URLS = [
	"https://cdn.maky.store/thumbnails/products/example.webp",
	"https://api.maky.store/thumbnail/example/256/",
	"https://cms-media.maky.store/media/example.webp",
] as const;

const request = {
	headers: { accept: "image/avif,image/webp,image/*,*/*" },
} as IncomingMessage;

let productionConfig: Parameters<typeof ImageOptimizerCache.validateParams>[2];

beforeAll(async () => {
	// The regression existed only in `next build` / `next start`. Force the config's own
	// NODE_ENV branch to production before Next evaluates next.config.js.
	vi.stubEnv("NODE_ENV", "production");
	productionConfig = (await loadConfig(PHASE_PRODUCTION_BUILD, process.cwd(), {
		silent: true,
	})) as Parameters<typeof ImageOptimizerCache.validateParams>[2];
});

afterAll(() => {
	vi.unstubAllEnvs();
});

describe("next/image production optimizer", () => {
	it.each(PRODUCTION_IMAGE_URLS)("accepts %s through the exact 400 validation path", (url) => {
		const width = String(productionConfig.images.deviceSizes[0] ?? 640);
		const result = ImageOptimizerCache.validateParams(
			request,
			{ url, w: width, q: "75" },
			productionConfig,
			false,
		);

		expect(result).not.toHaveProperty("errorMessage");
	});

	it("keeps the pre-existing wildcard until a separately accepted config hardening", () => {
		expect(productionConfig.images.remotePatterns).toEqual(
			expect.arrayContaining([expect.objectContaining({ hostname: "*" })]),
		);
	});
});
