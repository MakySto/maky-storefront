import { readFileSync } from "node:fs";
import { type IncomingMessage } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import loadConfig from "next/dist/server/config.js";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer.js";

import { CMS_MEDIA_BASE_URL } from "@/config/cms-media";
import { readMedia } from "@/lib/cms/blocks";

const PRODUCTION_IMAGE_URLS = [
	"https://cdn.maky.store/thumbnails/products/example.webp",
	"https://api.maky.store/thumbnail/example/256/",
	"https://cms-media.maky.store/media/example.webp",
] as const;

const PROVIDER_PAGE_IMAGE = JSON.parse(
	readFileSync(
		new URL(
			"../lib/cms/__fixtures__/provider-v2/fixtures/rest/page-image.sk.published.depth-1.json",
			import.meta.url,
		),
		"utf8",
	),
) as { docs: [{ layout: [{ media: unknown }] }] };

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
	it("keeps the shared CMS media base canonical and prefix-safe", () => {
		const base = new URL(CMS_MEDIA_BASE_URL);
		expect({
			protocol: base.protocol,
			username: base.username,
			password: base.password,
			port: base.port,
			search: base.search,
			hash: base.hash,
			trailingSlash: base.pathname.endsWith("/"),
		}).toEqual({
			protocol: "https:",
			username: "",
			password: "",
			port: "",
			search: "",
			hash: "",
			trailingSlash: true,
		});
	});

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

	it("keeps the parser and exact Next pattern aligned with the provider media fixture", () => {
		const parsedMedia = readMedia(PROVIDER_PAGE_IMAGE.docs[0].layout[0].media);
		expect(parsedMedia.kind).toBe("ok");
		if (parsedMedia.kind !== "ok") return;

		// Remove the broad production wildcard for this assertion. Otherwise it would hide
		// the exact regression this guard exists to catch: parser and optimizer origins
		// drifting apart while an unrelated wildcard still happens to admit the URL.
		const strictConfig = {
			...productionConfig,
			images: {
				...productionConfig.images,
				remotePatterns: productionConfig.images.remotePatterns.filter((pattern) => pattern.hostname !== "*"),
			},
		};
		const width = String(strictConfig.images.deviceSizes[0] ?? 640);
		const result = ImageOptimizerCache.validateParams(
			request,
			{ url: parsedMedia.media.url, w: width, q: "75" },
			strictConfig,
			false,
		);

		expect(result).not.toHaveProperty("errorMessage");
	});
});
