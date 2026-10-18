#!/usr/bin/env node
//
// Takes the weight of a running server out of a `.next` directory that is no longer served: a rollback
// snapshot (CLAUDE.md §13.3).
//
//   node scripts/ops/slim-next-dir.mjs <snapshot-dir>            says what it would remove, changes nothing
//   node scripts/ops/slim-next-dir.mjs <snapshot-dir> --apply    removes it
//
// A snapshot is there to be put back as `.next`. What that needs is the artifact the build made. What it
// does not need is what the server filled in while it ran, and that is most of the bytes: before the page
// cache was kept in memory (cache-handler.mjs), a server that had run for three days held 16 GB of pages
// it had rendered itself next to a 130 MB build. This removes
//
//   - the page-cache files under server/app whose route is neither a route nor a dynamic route of the
//     snapshot's own prerender-manifest.json: pages the build never made. Anything the build made is
//     kept, even where the server has since written a newer version of it in place;
//   - cache/images, the optimised images, which are made again on demand;
//   - cache/turbopack, the build's compile cache, which `next start` never reads.
//
// It keeps everything else, `cache/fetch-cache` included: what a restored snapshot answers from there is
// the behaviour it had, and the build's own entries are small (7 files, 69 KB). What is not small is the
// fetch-cache of a `.next` that a server with the stock cache ran in: that server had written 4 593 entries,
// 1.8 GB, into it in 9.6 hours, so the first snapshot after the handler went live was 1.8 GB, and this tool
// kept every byte of it. Later ones are the size of the build, because the handler keeps `fetch` in memory.
//
// Pages missing from a snapshot are rendered again when asked for, exactly as on a first visit, so a
// restore from a slimmed snapshot is correct, only colder. The tool still refuses a directory that does
// not look like a finished build, one named `.next` (that one is served), and one whose files do not
// match its manifest (a Next whose file names changed would otherwise look like "everything is runtime").
//
// Exit codes: 0 done (or dry run), 1 something could not be removed, 2 refused.
import { lstatSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, utimesSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The files the page cache writes for one route: `<route>.html`, `.meta`, `.body`, `.rsc` and `<route>.segments/**`. */
const PAGE_CACHE_FILE = /^(.*?)(\.segments\/.*|\.html|\.meta|\.body|\.rsc)$/s;

/** A manifest that matches its files has files for (nearly) every route. A real build has them for all of them. */
const MIN_ROUTES_WITH_FILES = 0.9;

class Refusal extends Error {}

function walkFiles(directory, visit) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) walkFiles(path, visit);
		else visit(path, entry);
	}
}

function sizeOf(directory) {
	let bytes = 0;
	let files = 0;
	try {
		walkFiles(directory, (path) => {
			bytes += lstatSync(path).size;
			files += 1;
		});
	} catch {
		// absent: nothing to remove
	}
	return { bytes, files };
}

function readManifestKeys(nextDir) {
	let manifest;
	try {
		manifest = JSON.parse(readFileSync(join(nextDir, "prerender-manifest.json"), "utf8"));
	} catch (error) {
		throw new Refusal(`prerender-manifest.json cannot be read (${error.message})`);
	}
	if (typeof manifest?.routes !== "object" || typeof manifest?.dynamicRoutes !== "object") {
		throw new Refusal("prerender-manifest.json has no routes and dynamicRoutes");
	}
	// `/` is written as `index`. The dynamic routes are in the set because the build leaves a shell for each
	// of them (`[channel]/account.html`, `sk-eur/[productSlug].html`).
	return new Set(
		[...Object.keys(manifest.routes), ...Object.keys(manifest.dynamicRoutes)].map((route) =>
			route === "/" ? "index" : route.replace(/^\//, ""),
		),
	);
}

/** What would be removed from `nextDir`, and why. Changes nothing. */
export function planSlim(nextDir) {
	const dir = resolve(nextDir);
	if (basename(dir) === ".next") {
		throw new Refusal(`${dir} is named .next: that is the directory a server serves, not a snapshot`);
	}
	let isDirectory = false;
	try {
		isDirectory = statSync(dir).isDirectory();
	} catch {
		// reported below
	}
	if (!isDirectory) throw new Refusal(`${dir} is not a directory`);
	try {
		statSync(join(dir, "BUILD_ID"));
	} catch {
		throw new Refusal(`${dir} has no BUILD_ID: not a finished build`);
	}
	const appDir = join(dir, "server", "app");
	try {
		if (!statSync(appDir).isDirectory()) throw new Error("not a directory");
	} catch {
		throw new Refusal(`${dir} has no server/app`);
	}

	const routeKeys = readManifestKeys(dir);
	const keptPages = { files: 0, bytes: 0 };
	const runtimePages = { paths: [], files: 0, bytes: 0 };
	const routesWithFiles = new Set();

	walkFiles(appDir, (path, entry) => {
		const match = PAGE_CACHE_FILE.exec(relative(appDir, path).split(sep).join("/"));
		if (!match) return;
		const size = lstatSync(path).size;
		if (routeKeys.has(match[1])) {
			routesWithFiles.add(match[1]);
			keptPages.files += 1;
			keptPages.bytes += size;
		} else if (entry.isFile()) {
			runtimePages.paths.push(path);
			runtimePages.files += 1;
			runtimePages.bytes += size;
		}
	});

	if (routesWithFiles.size < routeKeys.size * MIN_ROUTES_WITH_FILES) {
		throw new Refusal(
			`only ${routesWithFiles.size} of the ${routeKeys.size} routes in the manifest have files under server/app: ` +
				"the manifest and the files do not belong together, so nothing here can be called a runtime page",
		);
	}

	return {
		dir,
		appDir,
		keptPages,
		runtimePages,
		images: { path: join(dir, "cache", "images"), ...sizeOf(join(dir, "cache", "images")) },
		turbopack: { path: join(dir, "cache", "turbopack"), ...sizeOf(join(dir, "cache", "turbopack")) },
		fetchCache: sizeOf(join(dir, "cache", "fetch-cache")),
	};
}

export function bytesToRemove(plan) {
	return plan.runtimePages.bytes + plan.images.bytes + plan.turbopack.bytes;
}

/** Removes what `planSlim` found. Returns the paths that could not be removed. */
export function applySlim(plan) {
	const failures = [];
	// The snapshot's own mtime orders it among the snapshots (prune keeps the newest); slimming must not
	// make an old one look new.
	const before = statSync(plan.dir);

	const parents = new Set();
	for (const path of plan.runtimePages.paths) {
		try {
			rmSync(path, { force: true });
			parents.add(resolve(path, ".."));
		} catch (error) {
			failures.push(`${path}: ${error.message}`);
		}
	}
	// Directories the runtime pages leave empty (`cz-czk/`, `.segments`), bottom up, never server/app itself.
	const emptied = [...parents].sort((a, b) => b.length - a.length);
	for (let directory of emptied) {
		while (directory.startsWith(plan.appDir + sep)) {
			try {
				rmdirSync(directory);
			} catch {
				break; // not empty: it holds something of the build's
			}
			directory = resolve(directory, "..");
		}
	}
	for (const { path } of [plan.images, plan.turbopack]) {
		try {
			rmSync(path, { recursive: true, force: true });
		} catch (error) {
			failures.push(`${path}: ${error.message}`);
		}
	}

	utimesSync(plan.dir, before.atime, before.mtime);
	return failures;
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

export function main(argv, out = console.log, err = console.error) {
	const apply = argv.includes("--apply");
	const paths = argv.filter((argument) => !argument.startsWith("--"));
	const unknown = argv.filter((argument) => argument.startsWith("--") && argument !== "--apply");
	if (paths.length !== 1 || unknown.length > 0) {
		err("usage: slim-next-dir.mjs <snapshot-dir> [--apply]");
		return 2;
	}

	let plan;
	try {
		plan = planSlim(paths[0]);
	} catch (error) {
		if (!(error instanceof Refusal)) throw error;
		err(`slim-next-dir: refused: ${error.message}`);
		return 2;
	}

	const verb = apply ? "removed" : "would remove";
	out(`slim-next-dir: ${plan.dir}${apply ? "" : "   (dry run, nothing is removed)"}`);
	out(
		`  pages the build never made   ${verb} ${plan.runtimePages.files} files, ${mb(plan.runtimePages.bytes)}`,
	);
	out(`  cache/images                 ${verb} ${plan.images.files} files, ${mb(plan.images.bytes)}`);
	out(`  cache/turbopack              ${verb} ${plan.turbopack.files} files, ${mb(plan.turbopack.bytes)}`);
	out(`  pages the build made         kept ${plan.keptPages.files} files, ${mb(plan.keptPages.bytes)}`);
	out(`  cache/fetch-cache            kept ${plan.fetchCache.files} files, ${mb(plan.fetchCache.bytes)}`);

	if (!apply) {
		out(`slim-next-dir: would free ${mb(bytesToRemove(plan))}; run again with --apply to do it`);
		return 0;
	}
	const failures = applySlim(plan);
	if (failures.length > 0) {
		err(`slim-next-dir: ${failures.length} paths could not be removed, the first ones:`);
		for (const failure of failures.slice(0, 5)) err(`  ${failure}`);
		return 1;
	}
	out(`slim-next-dir: freed ${mb(bytesToRemove(plan))}`);
	return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	process.exitCode = main(process.argv.slice(2));
}
