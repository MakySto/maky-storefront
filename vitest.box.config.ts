import { defineConfig } from "vitest/config";

// scripts/ops/deploy-production.sh and nginx-upstream.sh run for real against a box made of small programs
// (src/lib/__fixtures__/deploy-world). Real processes and several minutes, so this is not part of `pnpm vitest run`,
// which the deploy preflight runs on the live box: `pnpm test:deploy-box`.
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.box.test.ts"],
		testTimeout: 120_000,
		hookTimeout: 60_000,
	},
});
