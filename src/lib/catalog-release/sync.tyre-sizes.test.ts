import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { activeTyreLists } from "@/lib/tyre-size/active-lists";
import { fittingCodes } from "@/lib/tyre-size/choice";
import { tyreFamiliesSeal } from "@/lib/tyre-size/families-file";
import { resolveTyreSelection } from "@/lib/tyre-size/selection";
import { tyreSizeIndexSeal } from "@/lib/tyre-size/size-index-file";

import {
	type Doc,
	type Harness,
	type TyreFile,
	arrangeRelease,
	contentFile,
	status as httpStatus,
	tyreFile,
} from "./fixtures/fake-cfm";
import { type LegacyPeek, buildCatalogStatus } from "./status";
import { __resetReleaseState, inspectRelease, releaseSyncOnce, releasedContent } from "./sync";

/**
 * The tyre-size list and its model families, taken from CFM's release manifest while the shop runs.
 *
 * The owner's rule (2026-11-15): what is switched off in CFM goes off on the shop by itself, with no deploy. CFM
 * publishes the pair without the row, the manifest names it (section `tyreSizes`, manifest 1.1.0), and this process
 * downloads both files, verifies them and swaps them in as one. These cases run the real loader against a stand-in
 * for CFM and then ask what a shopper would meet: is the size still offered, and would the server still take it.
 *
 *   1. Until a manifest names a pair, the build's own copy answers and the status document says nothing about it.
 *   2. A published pair is in use after one pass, and the row it dropped is refused.
 *   3. Anything wrong with a pair (bytes, seal, a families file of another list) changes nothing and is reported.
 *   4. A mistake in the section never holds the catalogue text or the dataset back.
 *   5. A restart begins from the pair last verified, before CFM is asked anything.
 */

const DATA = join(__dirname, "..", "tyre-size", "data");
const buildIndex = (): Doc => JSON.parse(readFileSync(join(DATA, "velkosti_20261105.json"), "utf8")) as Doc;
const buildFamilies = (): Doc => JSON.parse(readFileSync(join(DATA, "rodiny_20261105.json"), "utf8")) as Doc;

// D0245 holds `225/60 R17`: the code whose `650/17 R17` the owner switched off in CFM on 2026-11-15.
const CODE = "D0245";
const SIZE = "225/60 R17";

/** The build's list without one row of one code, sealed, as CFM publishes it after a card was switched off. */
function listWithout(code: string, size: string): Doc {
	const index = buildIndex();
	const rows = index.products[code].sizes as [string, string, string][];
	index.products[code].sizes = rows.filter(([label]) => label !== size);
	expect(index.products[code].sizes.length).toBe(rows.length - 1);
	index.counts.sizes -= 1;
	return { ...index, self_sha256: tyreSizeIndexSeal(index) };
}

const indexFile = (document: Doc): TyreFile => tyreFile("maky_tyre_size_index_1", document);
const familiesFile = (document: Doc): TyreFile => tyreFile("maky_tyre_families_1", document);

const offered = (code = CODE, size = SIZE): boolean => fittingCodes(size).has(code);
const accepted = (code = CODE, size = SIZE): boolean =>
	resolveTyreSelection(code, { mode: "size", size, answer: "" }).ok;

const BUILD_PEEK: LegacyPeek = {
	content: () => null,
	fitment: () => null,
	tyreSizes: () => {
		const { index, seals } = activeTyreLists();
		return { id: index.id, indexSeal: seals.index, familiesSeal: seals.families };
	},
};
const statusNow = () => buildCatalogStatus(inspectRelease(), BUILD_PEEK, { operator: false });

const quiet = (method: "log" | "warn" | "error") =>
	vi.spyOn(console, method).mockImplementation(() => undefined);

let world: Harness;
let error: ReturnType<typeof quiet>;

const sk = contentFile("sk");
const targets = { sk: { file: sk, release: 1 } };

beforeEach(() => {
	world = arrangeRelease();
	quiet("log");
	quiet("warn");
	error = quiet("error");
});

afterEach(() => {
	vi.restoreAllMocks();
	world.restore();
});

const pass = (): Promise<void> => releaseSyncOnce();
const iso = (ms: number): string => new Date(ms).toISOString();

describe("a manifest that names no pair", () => {
	it("leaves the build's own copy answering, and the status document as it was before pairs existed", async () => {
		world.cfm.publish({ version: 1, targets });
		await pass();

		expect(activeTyreLists().source).toEqual({ kind: "build" });
		expect(offered()).toBe(true);
		expect(inspectRelease().tyreSizes).toEqual({ desired: null, active: null, fault: null });
		expect("tyreSizes" in statusNow()).toBe(false);
	});

	it("is the same with the section written as null", async () => {
		world.cfm.publish({ version: 1, targets, tyreSizes: null });
		await pass();

		expect(activeTyreLists().source).toEqual({ kind: "build" });
		expect("tyreSizes" in statusNow()).toBe(false);
		// The 1.1.0 manifest itself was taken: the text it names is in use.
		expect(releasedContent("sk", "sk")).not.toBeNull();
	});
});

describe("a pair CFM published", () => {
	it("is in use after one pass: the row CFM dropped is no longer offered and the server refuses it", async () => {
		expect(offered()).toBe(true);
		expect(accepted()).toBe(true);

		const index = indexFile(listWithout(CODE, SIZE));
		const families = familiesFile(buildFamilies());
		world.cfm.publish({ version: 1, targets, tyreSizes: { release: 4, index, families } });
		await pass();

		expect(activeTyreLists().source).toEqual({ kind: "release", release: 4 });
		expect(offered()).toBe(false);
		expect(accepted()).toBe(false);
		// The other sizes of that code, and the other codes of that size, are untouched.
		expect(accepted(CODE, "235/70 R15")).toBe(true);
		expect(fittingCodes(SIZE).size).toBeGreaterThan(0);

		expect(statusNow().tyreSizes).toEqual({
			id: "snehove-retaze-20261105",
			release: 4,
			index: { file: index.name, sha256: index.sha256, selfSha256: index.selfSha256 },
			families: { file: families.name, sha256: families.sha256, selfSha256: families.selfSha256 },
			state: "active",
			source: "manifest",
			activatedAt: iso(world.clock.now),
			error: null,
		});
	});

	it("is fetched once: an unchanged pointer and an unchanged pair ask for neither file again", async () => {
		const index = indexFile(listWithout(CODE, SIZE));
		const families = familiesFile(buildFamilies());
		world.cfm.publish({ version: 1, targets, tyreSizes: { release: 1, index, families } });
		await pass();
		const served = activeTyreLists();
		world.cfm.forget();

		await pass();
		// A new manifest for another reason, the pair as it was.
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: contentFile("sk", "b"), release: 2 } },
			tyreSizes: { release: 1, index, families },
		});
		await pass();

		expect(world.cfm.count(index.name)).toBe(0);
		expect(world.cfm.count(families.name)).toBe(0);
		// The very same pair object: nothing a reader computed from it was thrown away.
		expect(activeTyreLists()).toBe(served);
	});

	it("is replaced by the next one, and a row that came back is offered again", async () => {
		const families = familiesFile(buildFamilies());
		world.cfm.publish({
			version: 1,
			targets,
			tyreSizes: { release: 1, index: indexFile(listWithout(CODE, SIZE)), families },
		});
		await pass();
		expect(offered()).toBe(false);

		world.cfm.publish({
			version: 2,
			targets,
			tyreSizes: { release: 2, index: indexFile(buildIndex()), families },
		});
		await pass();

		expect(activeTyreLists().source).toEqual({ kind: "release", release: 2 });
		expect(offered()).toBe(true);
		expect(statusNow().tyreSizes).toMatchObject({ release: 2, state: "active", source: "manifest" });
	});

	it("stays in use when a later manifest no longer names one", async () => {
		world.cfm.publish({
			version: 1,
			targets,
			tyreSizes: {
				release: 1,
				index: indexFile(listWithout(CODE, SIZE)),
				families: familiesFile(buildFamilies()),
			},
		});
		await pass();
		world.cfm.publish({ version: 2, targets, tyreSizes: null });
		await pass();

		// A size is taken away by a pair without it, never by a missing section.
		expect(activeTyreLists().source).toEqual({ kind: "release", release: 1 });
		expect(offered()).toBe(false);
		expect(statusNow().tyreSizes).toMatchObject({
			release: 1,
			state: "active",
			source: "manifest",
			error: null,
		});
	});
});

describe("a pair that must not be served", () => {
	const good = () => ({
		index: indexFile(listWithout(CODE, SIZE)),
		families: familiesFile(buildFamilies()),
	});

	/** Publish, pass, and expect the build's copy still answering with this fault reported. */
	async function refused(spec: Parameters<Harness["cfm"]["publish"]>[0], code: string): Promise<string> {
		const before = activeTyreLists();
		world.cfm.publish(spec);
		await pass();

		expect(activeTyreLists()).toBe(before);
		expect(offered()).toBe(true);
		const status = statusNow().tyreSizes;
		expect(status).toMatchObject({
			id: "snehove-retaze-20261105",
			release: null,
			state: "stale",
			source: "build",
			error: { code },
		});
		expect(status?.index.selfSha256).toBe(buildIndex().self_sha256);
		// Whatever is wrong with the pair, the text of the same manifest is in use.
		expect(releasedContent("sk", "sk")).not.toBeNull();
		return status?.error?.message ?? "";
	}

	it("a list whose bytes are not the ones the manifest names", async () => {
		const { index, families } = good();
		await refused(
			{
				version: 1,
				targets,
				tyreSizes: { release: 1, index: { ...index, sha256: indexFile(buildIndex()).sha256 }, families },
			},
			"file_hash_mismatch",
		);
	});

	it("a list that is shorter or longer than the manifest says", async () => {
		const { index, families } = good();
		await refused(
			{
				version: 1,
				targets,
				tyreSizes: { release: 1, index, families },
				edit: (document) => {
					document.tyreSizes.index.bytes += 1;
				},
			},
			"file_size_mismatch",
		);
	});

	it("a list that cannot be fetched", async () => {
		const { index, families } = good();
		world.cfm.override(index.name, () => httpStatus(404));
		await refused({ version: 1, targets, tyreSizes: { release: 1, index, families } }, "file_unreachable");
	});

	it("a list that carries a seal other than the one the manifest approved", async () => {
		const { index, families } = good();
		const message = await refused(
			{
				version: 1,
				targets,
				tyreSizes: { release: 1, index: { ...index, selfSha256: "0".repeat(64) }, families },
			},
			"tyre_sizes_invalid",
		);
		expect(message).toContain("seal");
	});

	it("a list changed after it was sealed, even when the manifest repeats its stale seal", async () => {
		const changed = buildIndex();
		changed.products[CODE].sizes.pop();
		changed.counts.sizes -= 1;
		await refused(
			{
				version: 1,
				targets,
				tyreSizes: { release: 1, index: indexFile(changed), families: familiesFile(buildFamilies()) },
			},
			"tyre_sizes_invalid",
		);
	});

	it("a list under another name than the manifest gives the pair", async () => {
		const { index, families } = good();
		await refused(
			{ version: 1, targets, tyreSizes: { release: 1, index, families, id: "snehove-retaze-20270101" } },
			"tyre_sizes_invalid",
		);
	});

	it("families that are not this list's: a code of the list has no family", async () => {
		const families = buildFamilies();
		const dropped = Object.keys(families.products)[0];
		delete families.products[dropped];
		const sealed = { ...families, self_sha256: tyreFamiliesSeal(families as never) };
		await refused(
			{
				version: 1,
				targets,
				tyreSizes: { release: 1, index: indexFile(listWithout(CODE, SIZE)), families: familiesFile(sealed) },
			},
			"tyre_sizes_invalid",
		);
	});

	it("a file that is not JSON, described by the manifest byte for byte", async () => {
		const { families } = good();
		const bytes = new TextEncoder().encode("<html>502 Bad Gateway</html>");
		const index: TyreFile = {
			name: "maky_tyre_size_index_1-0000000000000000.json",
			bytes,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			schema: "maky.tyre-size-index/1",
			selfSha256: "1".repeat(64),
		};
		// The hash and the size pass, so it is the content that is refused.
		const message = await refused(
			{ version: 1, targets, tyreSizes: { release: 1, index, families, id: "snehove-retaze-20261105" } },
			"tyre_sizes_invalid",
		);
		expect(message).toContain("not JSON");
	});

	it("keeps the pair in use, not the build's, when the pair after it fails", async () => {
		const first = good();
		world.cfm.publish({ version: 1, targets, tyreSizes: { release: 1, ...first } });
		await pass();
		const served = activeTyreLists();

		const next = indexFile(buildIndex());
		world.cfm.override(next.name, () => httpStatus(500));
		world.cfm.publish({
			version: 2,
			targets,
			tyreSizes: { release: 2, index: next, families: first.families },
		});
		await pass();

		expect(activeTyreLists()).toBe(served);
		expect(offered()).toBe(false);
		expect(statusNow().tyreSizes).toMatchObject({
			release: 1,
			state: "stale",
			source: "manifest",
			error: { code: "file_unreachable" },
		});
	});

	it("is tried again after a wait, not on every poll, and is taken once it is right", async () => {
		const { index, families } = good();
		world.cfm.override(index.name, () => httpStatus(503));
		world.cfm.publish({ version: 1, targets, tyreSizes: { release: 1, index, families } });
		await pass();
		expect(world.cfm.count(index.name)).toBe(1);

		world.cfm.restore(index.name);
		world.clock.now += 10_000;
		await pass();
		expect(world.cfm.count(index.name)).toBe(1);
		expect(offered()).toBe(true);

		world.clock.now += 30_000;
		await pass();
		expect(world.cfm.count(index.name)).toBe(2);
		expect(offered()).toBe(false);
		expect(statusNow().tyreSizes).toMatchObject({ release: 1, state: "active", error: null });
	});

	it("says it once in the log, not once per poll", async () => {
		const { index, families } = good();
		world.cfm.override(index.name, () => httpStatus(404));
		world.cfm.publish({ version: 1, targets, tyreSizes: { release: 1, index, families } });
		await pass();
		world.clock.now += 31_000;
		await pass();

		const lines = error.mock.calls
			.map((call) => String(call[0]))
			.filter((line) => line.includes("tyre sizes"));
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("keeping the build's own list");
	});
});

describe("a section this build cannot read", () => {
	const broken = (edit: (section: Doc) => void) => ({
		version: 1,
		targets,
		tyreSizes: {
			release: 1,
			index: indexFile(listWithout(CODE, SIZE)),
			families: familiesFile(buildFamilies()),
		},
		edit: (document: Doc) => edit(document.tyreSizes as Doc),
	});

	it.each([
		["no families file", (section: Doc) => delete section.families],
		[
			"a list of another schema",
			(section: Doc) => (section.index.contract.schema = "maky.tyre-size-index/2"),
		],
		["a release that is not a number", (section: Doc) => (section.release = "7")],
		["a file name with a path in it", (section: Doc) => (section.index.file = "../velkosti.json")],
		["one file named for both", (section: Doc) => (section.families.file = section.index.file)],
	])("%s: the rest of the manifest is taken and the fault is reported", async (_name, edit) => {
		world.cfm.publish(broken(edit));
		await pass();

		// The catalogue text does not wait for the tyre sizes.
		expect(inspectRelease().manifest).toMatchObject({ version: 1, outcome: "new", fault: null });
		expect(releasedContent("sk", "sk")).not.toBeNull();
		// And the pair is the build's own.
		expect(activeTyreLists().source).toEqual({ kind: "build" });
		expect(offered()).toBe(true);
		expect(statusNow().tyreSizes).toMatchObject({
			state: "stale",
			source: "build",
			error: { code: "tyre_sizes_invalid" },
		});
		// Neither file was asked for: nothing in an unreadable section is acted on.
		expect(world.cfm.hits.filter((hit) => hit.url.includes("maky_tyre_"))).toEqual([]);
	});

	it("is forgotten when the next manifest has a section that reads", async () => {
		world.cfm.publish(broken((section) => delete section.families));
		await pass();
		world.cfm.publish({
			version: 2,
			targets,
			tyreSizes: {
				release: 1,
				index: indexFile(listWithout(CODE, SIZE)),
				families: familiesFile(buildFamilies()),
			},
		});
		await pass();

		expect(offered()).toBe(false);
		expect(statusNow().tyreSizes).toMatchObject({ state: "active", source: "manifest", error: null });
	});
});

describe("a restart", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "maky-release-tyre-sizes-"));
		process.env.MAKY_RELEASE_CACHE_DIR = join(root, "cache");
	});

	afterEach(async () => {
		delete process.env.MAKY_RELEASE_CACHE_DIR;
		await rm(root, { recursive: true, force: true });
	});

	/** What a restart does to a process: it forgets what it knew. The disk and the settings stay. */
	const restart = (): void => __resetReleaseState();
	const cfmDown = (): void =>
		world.cfm.override("MANIFEST.json", () => {
			throw new TypeError("fetch failed");
		});

	async function publishedAndTaken() {
		const index = indexFile(listWithout(CODE, SIZE));
		const families = familiesFile(buildFamilies());
		world.cfm.publish({ version: 1, targets, tyreSizes: { release: 3, index, families } });
		await pass();
		expect(offered()).toBe(false);
		return { index, families };
	}

	it("without a cache directory begins from the build's copy until the manifest answers", async () => {
		delete process.env.MAKY_RELEASE_CACHE_DIR;
		await publishedAndTaken();

		restart();
		expect(offered()).toBe(true);
		await pass();
		expect(offered()).toBe(false);
	});

	it("begins from the pair last verified, with CFM unreachable", async () => {
		const { index, families } = await publishedAndTaken();
		expect(await readdir(join(root, "cache", "maky-release-cache"))).toEqual(
			expect.arrayContaining([index.name, families.name, "ACTIVE.json"]),
		);

		restart();
		cfmDown();
		// The build's copy for the moment before the first pass, which is how every boot starts.
		expect(offered()).toBe(true);
		await pass();

		expect(activeTyreLists().source).toEqual({ kind: "release", release: 3 });
		expect(offered()).toBe(false);
		expect(accepted()).toBe(false);
		expect(statusNow().tyreSizes).toMatchObject({ release: 3, state: "active", source: "manifest" });
	});

	it("does not download a restored pair again when the manifest still names it", async () => {
		const { index, families } = await publishedAndTaken();
		restart();
		world.cfm.forget();
		await pass();

		expect(world.cfm.count(index.name)).toBe(0);
		expect(world.cfm.count(families.name)).toBe(0);
		expect(offered()).toBe(false);
	});

	it("does not restore a pair one of whose files was damaged on disk", async () => {
		const { index } = await publishedAndTaken();
		const { writeFile } = await import("node:fs/promises");
		const path = join(root, "cache", "maky-release-cache", index.name);
		const bytes = new Uint8Array(readFileSync(path));
		bytes[bytes.length >> 1] ^= 1;
		await writeFile(path, bytes);

		restart();
		cfmDown();
		await pass();

		// Not half a pair, and not a list nobody verified: the build's own copy answers.
		expect(activeTyreLists().source).toEqual({ kind: "build" });
		expect(offered()).toBe(true);
	});
});
