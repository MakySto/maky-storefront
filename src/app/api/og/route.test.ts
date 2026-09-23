import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

const require = createRequire(import.meta.url);

function sourceFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(full);
		return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
	});
}

function below(version: string, floor: [number, number, number]): boolean {
	const [major = 0, minor = 0, patch = 0] = version.split(/[.-]/).map(Number);
	const [fMajor, fMinor, fPatch] = floor;
	if (major !== fMajor) return major < fMajor;
	if (minor !== fMinor) return minor < fMinor;
	return patch < fPatch;
}

describe("/api/og", () => {
	it("answers 410 Gone with an empty body", async () => {
		const response = GET();
		expect(response.status).toBe(410);
		expect(await response.text()).toBe("");
	});

	// GHSA-vcvr-r3jv-pc5j: next/og's ImageResponse on Node, next >=16.2.0 <16.3.6. While the
	// installed next is in that range nothing in src may render with it. The check lifts
	// itself once next is upgraded.
	it("nothing in src imports next/og while next is below 16.3.6", () => {
		const version: string = require("next/package.json").version;
		if (!below(version, [16, 3, 6])) return;
		const srcDir = path.resolve(__dirname, "../../..");
		const offenders = sourceFiles(srcDir).filter((file) =>
			/from\s+["']next\/og["']|import\(\s*["']next\/og["']\s*\)/.test(fs.readFileSync(file, "utf8")),
		);
		expect(offenders).toEqual([]);
	});
});
