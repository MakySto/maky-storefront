import { readFileSync } from "node:fs";
import { type IncomingMessage } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { defaultConfig } from "next/dist/server/config-shared.js";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer.js";

import { resolveNextConfig } from "../../next.config.js";
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

beforeAll(() => {
	// Resolve the production branch without querying the real PM2 process. Next normally
	// supplies these defaults after loading the config, so reproduce that merge here.
	vi.stubEnv("NODE_ENV", "production");
	const configured = resolveNextConfig(PHASE_PRODUCTION_BUILD, () => 0);
	productionConfig = {
		...defaultConfig,
		...configured,
		images: {
			...defaultConfig.images,
			...(configured.images ?? {}),
		},
	} as unknown as Parameters<typeof ImageOptimizerCache.validateParams>[2];
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

	// The widths `/_next/image` URLs used in production in the two days before the wildcard went
	// (nginx, 2026-09-25/26). Sizes were not part of that change: every one must still validate.
	const LOGGED_WIDTHS = [
		"3840",
		"96",
		"750",
		"640",
		"384",
		"828",
		"256",
		"1080",
		"1920",
		"48",
		"2048",
		"1200",
	];

	it.each(LOGGED_WIDTHS)("still accepts a product thumbnail at the logged width w=%s", (w) => {
		const result = ImageOptimizerCache.validateParams(
			request,
			{
				url: "https://cdn.maky.store/thumbnails/products/n15094-a-01_eca34cd3_thumbnail_4096.jpg",
				w,
				q: "75",
			},
			productionConfig,
			false,
		);
		expect(result).not.toHaveProperty("errorMessage");
	});

	// Owner GO 2026-09-26: the optimizer is no longer an image proxy for the whole internet.
	it.each([
		"https://example.com/photo.jpg",
		"https://cdn.maky.store.example.com/thumbnails/x.jpg",
		"http://cdn.maky.store/thumbnails/products/x.jpg",
	])("refuses %s", (url) => {
		expect(productionConfig.images.remotePatterns).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ hostname: "*" })]),
		);
		const result = ImageOptimizerCache.validateParams(
			request,
			{ url, w: "640", q: "75" },
			productionConfig,
			false,
		);
		expect(result).toHaveProperty("errorMessage");
	});

	it("keeps the parser and exact Next pattern aligned with the provider media fixture", () => {
		const parsedMedia = readMedia(PROVIDER_PAGE_IMAGE.docs[0].layout[0].media);
		expect(parsedMedia.kind).toBe("ok");
		if (parsedMedia.kind !== "ok") return;

		// Filtered anyway, should a broad wildcard ever come back: it would hide the exact
		// regression this guard exists to catch — parser and optimizer origins drifting apart
		// while an unrelated wildcard still happens to admit the URL.
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
