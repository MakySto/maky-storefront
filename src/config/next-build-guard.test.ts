import { readFileSync } from "node:fs";

import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { describe, expect, it, vi } from "vitest";

import { resolveNextConfig } from "../../next.config.js";

describe("Next production build guard", () => {
	it("refuses to resolve a production build when the guard fails", () => {
		const runLiveBuildGuard = vi.fn(() => 1 as const);

		expect(() => resolveNextConfig(PHASE_PRODUCTION_BUILD, runLiveBuildGuard)).toThrow(
			"Production build refused",
		);
		expect(runLiveBuildGuard).toHaveBeenCalledOnce();
	});

	it("returns the configured storefront after the guard proves the build is safe", () => {
		const runLiveBuildGuard = vi.fn(() => 0 as const);

		const configured = resolveNextConfig(PHASE_PRODUCTION_BUILD, runLiveBuildGuard);

		expect(runLiveBuildGuard).toHaveBeenCalledOnce();
		expect(configured.images?.formats).toEqual(["image/avif", "image/webp"]);
	});

	it("does not inspect PM2 for a development-server config", () => {
		const runLiveBuildGuard = vi.fn(() => 1 as const);

		expect(() => resolveNextConfig(PHASE_DEVELOPMENT_SERVER, runLiveBuildGuard)).not.toThrow();
		expect(runLiveBuildGuard).not.toHaveBeenCalled();
	});

	it("wires Next's default export to the real guard rather than an injectable override", () => {
		const source = readFileSync(new URL("../../next.config.js", import.meta.url), "utf8");

		expect(source).toMatch(
			/export default function nextConfig\(phase\)\s*{\s*return resolveNextConfig\(phase, guardLiveBuild\);\s*}/,
		);
	});
});
