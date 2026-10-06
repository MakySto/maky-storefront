// GraphQL types without a live Saleor: `pnpm run generate:offline`.
//
// `pnpm generate:all` introspects NEXT_PUBLIC_SALEOR_API_URL. A sandbox, a fresh clone without the
// production environment and a machine that is offline cannot reach it, and the generated types are
// gitignored, so such a checkout has none: every test that imports a module touching `@/gql/graphql`,
// directly or through the code under test, fails on import. On 2026-10-06 that was 61 files and 212
// tests; a placeholder standing in for the types left "53 failures" that were then read as the baseline
// of the suite. With the real types the same suite has none.
//
// The schema of the Saleor Core that production runs is published with Saleor's source. This fetches
// that one file, pinned to a commit and to a SHA-256, keeps it under node_modules/.cache and points both
// codegens (storefront and checkout) at it, so the documents are validated against the schema they will
// meet. `vitest.global-setup.ts` calls it when the types are missing.
//
// Not for builds. `pnpm build` keeps `prebuild` -> `generate:all` against the live API, so what ships is
// generated from what production answers. Move SALEOR_SCHEMA with the Saleor upgrade (`{ shop { version } }`):
// version, commit and hash together.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The Saleor Core production runs. A commit cannot be moved the way a tag can, and the hash makes a
 * truncated or altered download fail instead of generating types from it.
 */
export const SALEOR_SCHEMA = {
	version: "3.23.31",
	commit: "a1ab3a23a3f5711bb74abb3a2972cf28454cb59e",
	sha256: "36a111ba8f822b25a62fa82df0d7e4477e1aebc611d70adb83f5006a5cf76624",
};

/** What the two codegens write. Both are gitignored. */
export const GENERATED_FILES = ["src/gql/graphql.ts", "src/checkout/graphql/generated/index.ts"];

/** @param {string} [root] */
export function missingGeneratedFiles(root = repoRoot) {
	return GENERATED_FILES.filter((file) => !existsSync(path.join(root, file)));
}

/** @param {Uint8Array} bytes */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * The pinned schema as a file in `cacheDir`, fetched on first use. A cached file that no longer matches
 * the hash is fetched again.
 *
 * @param {{ cacheDir: string, schema?: typeof SALEOR_SCHEMA, fetchImpl?: typeof fetch }} options
 * @returns {Promise<string>} the path of the schema file
 */
export async function ensureSchema({ cacheDir, schema = SALEOR_SCHEMA, fetchImpl = fetch }) {
	const file = path.join(cacheDir, `schema-${schema.version}.graphql`);
	if (existsSync(file) && sha256(readFileSync(file)) === schema.sha256) return file;

	const url = `https://raw.githubusercontent.com/saleor/saleor/${schema.commit}/saleor/graphql/schema.graphql`;
	const response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
	if (!response.ok) throw new Error(`${url} answered ${response.status}`);

	const body = Buffer.from(await response.arrayBuffer());
	const actual = sha256(body);
	if (actual !== schema.sha256) {
		throw new Error(
			`${url} has SHA-256 ${actual}, but Saleor ${schema.version} is pinned to ${schema.sha256}`,
		);
	}

	mkdirSync(cacheDir, { recursive: true });
	const partial = `${file}.${process.pid}.part`;
	writeFileSync(partial, body);
	renameSync(partial, file);
	return file;
}

/**
 * Both codegens, run through the package scripts, against the pinned schema file.
 *
 * @param {{ root?: string, schema?: typeof SALEOR_SCHEMA, fetchImpl?: typeof fetch, quiet?: boolean }} [options]
 */
export async function generateOffline({
	root = repoRoot,
	schema = SALEOR_SCHEMA,
	fetchImpl = fetch,
	quiet = false,
} = {}) {
	const schemaFile = await ensureSchema({
		cacheDir: path.join(root, "node_modules/.cache/saleor-schema"),
		schema,
		fetchImpl,
	});
	if (!quiet)
		console.log(`Generating the GraphQL types from the Saleor ${schema.version} schema (${schemaFile})`);

	for (const script of ["generate", "generate:checkout"]) {
		const result = spawnSync("pnpm", ["run", script], {
			cwd: root,
			// `.graphqlrc.ts` and `src/checkout/graphql/codegen.ts` read the schema from this variable, and a
			// value already in the environment wins over any .env file.
			env: { ...process.env, NEXT_PUBLIC_SALEOR_API_URL: schemaFile },
			encoding: "utf8",
			stdio: quiet ? "pipe" : "inherit",
			shell: process.platform === "win32",
		});
		if (result.status !== 0) {
			const output = quiet ? `\n${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd() : "";
			throw new Error(`pnpm run ${script} exited with ${result.status ?? result.error?.message}${output}`);
		}
	}

	const missing = missingGeneratedFiles(root);
	if (missing.length > 0) throw new Error(`codegen finished but did not write ${missing.join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	generateOffline().catch((error) => {
		console.error(`generate:offline failed: ${error.message}`);
		process.exit(1);
	});
}
