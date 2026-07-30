import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.test.ts"],
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
