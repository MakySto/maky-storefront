import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.test.ts"],
		// The deploy scripts against a box of small programs: real processes, a few minutes. deploy-production.sh
		// runs `pnpm vitest run` on the live box before every deploy, so these have their own command
		// (`pnpm test:deploy-box`, vitest.box.config.ts).
		exclude: [...configDefaults.exclude, "src/**/*.box.test.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			// See vitest.server-only-stub.ts — the real package throws on import outside
			// the react-server condition, which would make every server module untestable.
			"server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
		},
	},
});
