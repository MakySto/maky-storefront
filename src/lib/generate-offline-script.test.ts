import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	GENERATED_FILES,
	SALEOR_SCHEMA,
	ensureSchema,
	missingGeneratedFiles,
} from "../../scripts/generate-offline.mjs";

/**
 * `scripts/generate-offline.mjs` (`pnpm generate:offline`) is what a checkout without the generated GraphQL
 * types uses to get them without a live Saleor, and `vitest.global-setup.ts` calls it before the first test.
 * What matters about it: it fetches the schema of the pinned Saleor commit, never accepts bytes that are not
 * the pinned ones, and does not go back to the network once it has them.
 */
const BODY = "type Query {\n  shop: String\n}\n";
const SCHEMA = {
	version: "9.9.9",
	commit: "c0ffee",
	sha256: createHash("sha256").update(BODY).digest("hex"),
};

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "generate-offline-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const answering = (body: string, status = 200) =>
	vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe("scripts/generate-offline.mjs", () => {
	it("is pinned to a commit and a hash, not to something that can move", () => {
		expect(SALEOR_SCHEMA.commit).toMatch(/^[0-9a-f]{40}$/);
		expect(SALEOR_SCHEMA.sha256).toMatch(/^[0-9a-f]{64}$/);
	});

	it("fetches the schema of the pinned commit once and then serves it from the cache", async () => {
		const fetchImpl = answering(BODY);

		const first = await ensureSchema({ cacheDir: join(dir, "cache"), schema: SCHEMA, fetchImpl });
		const second = await ensureSchema({ cacheDir: join(dir, "cache"), schema: SCHEMA, fetchImpl });

		expect(first).toBe(second);
		expect(readFileSync(first, "utf8")).toBe(BODY);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(vi.mocked(fetchImpl).mock.calls[0][0]).toBe(
			"https://raw.githubusercontent.com/saleor/saleor/c0ffee/saleor/graphql/schema.graphql",
		);
	});

	it("refuses bytes that are not the pinned ones and keeps nothing of them", async () => {
		const cacheDir = join(dir, "cache");

		await expect(
			ensureSchema({ cacheDir, schema: SCHEMA, fetchImpl: answering("<html>blocked</html>") }),
		).rejects.toThrow(/pinned to/);
		await expect(
			ensureSchema({ cacheDir, schema: SCHEMA, fetchImpl: answering("Not Found", 404) }),
		).rejects.toThrow(/answered 404/);

		expect(() => readdirSync(cacheDir)).toThrow(); // never created: nothing was fit to keep
	});

	it("fetches again when the cached file no longer matches the hash", async () => {
		const cacheDir = join(dir, "cache");
		mkdirSync(cacheDir);
		writeFileSync(join(cacheDir, `schema-${SCHEMA.version}.graphql`), "type Query {");
		const fetchImpl = answering(BODY);

		const file = await ensureSchema({ cacheDir, schema: SCHEMA, fetchImpl });

		expect(readFileSync(file, "utf8")).toBe(BODY);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("names the generated files a checkout lacks", () => {
		expect(missingGeneratedFiles(dir)).toEqual(GENERATED_FILES);

		mkdirSync(join(dir, "src/gql"), { recursive: true });
		writeFileSync(join(dir, "src/gql/graphql.ts"), "");

		expect(missingGeneratedFiles(dir)).toEqual(["src/checkout/graphql/generated/index.ts"]);
	});
});
