// Is the fitment dataset CFM is serving the one this build accepted?
//
//   pnpm check:fitment
//   pnpm check:fitment --url https://carfitmanager.com/media/fitment/<other>.json
//   pnpm check:fitment --file /path/to/local.json
//
// Downloads the snapshot to a temp file and runs `full-dataset-acceptance.test.ts`
// against it, so the numbers are checked by the build's OWN hash and contract modules
// rather than by a second implementation that can drift from them.
//
// It is a script and not part of `pnpm test` on purpose: the default suite must not
// depend on the network or on an 8 MB download. What makes that safe is that the
// accepted numbers are committed in the test — running this later re-proves the same
// claim rather than blessing whatever is being served today.
//
// Exit 0 = the artefact matches what was accepted. 1 = it does not. 2 = could not run.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};

const DEFAULT_URL = "https://carfitmanager.com/media/fitment/maky_roof_fitment_3.0.0-full-20260907.2.json";
const file = argOf("--file", null);
const url = argOf("--url", DEFAULT_URL);

let path = file;
let scratch = null;

if (!path) {
	console.log(`fetching ${url}`);
	let body;
	try {
		const res = await fetch(url);
		if (!res.ok) {
			console.error(`${url} returned ${res.status}`);
			process.exit(2);
		}
		body = Buffer.from(await res.arrayBuffer());
	} catch (err) {
		console.error(`could not fetch ${url}: ${err.message}`);
		process.exit(2);
	}
	scratch = mkdtempSync(join(tmpdir(), "maky-fitment-"));
	path = join(scratch, "dataset.json");
	writeFileSync(path, body);
	console.log(`${body.length.toLocaleString("en-US")} bytes\n`);
} else if (!existsSync(path)) {
	console.error(`no such file: ${path}`);
	process.exit(2);
}

const result = spawnSync("npx", ["vitest", "run", "src/lib/fitment/full-dataset-acceptance.test.ts"], {
	stdio: "inherit",
	env: { ...process.env, MAKY_FITMENT_DATASET_PATH: path },
});

if (scratch) rmSync(scratch, { recursive: true, force: true });
process.exit(result.status ?? 2);
