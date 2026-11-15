import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import example from "./fixtures/manifest.example.json";
import exampleWithTyreSizes from "./fixtures/manifest-1.1.0.example.json";
import { FILE_MAX_BYTES, fileUrl, manifestSelfSha256, parseManifest } from "./manifest";

/**
 * The manifest, parsed at the boundary.
 *
 * `fixtures/manifest.example.json` is byte for byte the example CFM ships beside its contract
 * (`backend/docs/contracts/examples/`), and CFM's own tests pin its `selfSha256`. Reproducing that
 * number here, in JavaScript, is the cross-implementation test: it is what proves the two sides agree on
 * how a manifest is hashed. Everything else here is a reason a manifest must be refused.
 */

const POINTER = "https://cfm.example/media/fitment/releases/MANIFEST.json";

type Doc = Record<string, any>;

/** The example with one thing changed and `selfSha256` recomputed, so the change is the ONLY fault. */
function sealed(change: (doc: Doc) => void): Uint8Array {
	const doc = structuredClone(example) as Doc;
	change(doc);
	doc.selfSha256 = manifestSelfSha256(doc);
	return new TextEncoder().encode(JSON.stringify(doc, null, 1));
}

function codeOf(bytes: Uint8Array, pointer = POINTER): string | null {
	const parsed = parseManifest(bytes, pointer);
	return parsed.ok ? null : parsed.fault.code;
}

describe("the manifest CFM publishes", () => {
	it("hashes to the number CFM computed: the same bytes, written by Python, read by JavaScript", () => {
		expect(manifestSelfSha256(example)).toBe(example.selfSha256);
		expect(example.selfSha256.startsWith("fa43a17a")).toBe(true);
	});

	it("parses the example as the exact bytes CFM would serve", () => {
		const bytes = readFileSync(join(__dirname, "fixtures", "manifest.example.json"));
		const parsed = parseManifest(bytes, POINTER);
		if (!parsed.ok) throw new Error(parsed.fault.message);
		expect(parsed.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
		expect(parsed.sha256).toBe("72203aac874b845c043de839fd09e5db354c73e1df80445b30fc4a67e652c9c0");
		const { manifest } = parsed;
		expect(manifest.manifestVersion).toBe(7);
		expect(Object.keys(manifest.content).sort()).toEqual(["at", "de", "sk", "us"]);
		expect(manifest.fitment?.datasetVersion).toBe("3.0.0-full-example.1");
	});

	it("keeps DE and AT on one file with their own release numbers", () => {
		const parsed = parseManifest(
			sealed(() => undefined),
			POINTER,
		);
		if (!parsed.ok) throw new Error(parsed.fault.message);
		const { de, at } = parsed.manifest.content;
		expect([de.file, de.sha256, de.bytes]).toEqual([at.file, at.sha256, at.bytes]);
		expect(de.release).not.toBe(at.release);
	});

	it("ignores fields it does not know inside the same major version", () => {
		expect(codeOf(sealed((doc) => (doc.note = "a field a later 1.x may add")))).toBeNull();
		expect(codeOf(sealed((doc) => (doc.content.targets.sk.extra = true)))).toBeNull();
	});

	it("accepts a manifest with no fitment yet and one with no pages count", () => {
		expect(codeOf(sealed((doc) => (doc.fitment = null)))).toBeNull();
		expect(codeOf(sealed((doc) => (doc.content.targets.sk.pages = null)))).toBeNull();
		expect(codeOf(sealed((doc) => (doc.content.targets = {})))).toBeNull();
	});
});

describe("a manifest is refused as a whole", () => {
	const refusals: Array<[string, string, (doc: Doc) => void]> = [
		["a different artifact", "manifest_invalid", (doc) => (doc.artifact = "MAKY_SOMETHING")],
		["another major version", "manifest_schema_unsupported", (doc) => (doc.schemaVersion = "2.0.0")],
		[
			"rules it does not know how to consume",
			"manifest_schema_unsupported",
			(doc) => (doc.rules.activation = "all-or-nothing"),
		],
		[
			"a content contract of another major",
			"manifest_schema_unsupported",
			(doc) => (doc.content.contract.schemaVersion = "2.0.0"),
		],
		[
			"a content contract for something else",
			"manifest_invalid",
			(doc) => (doc.content.contract.artifact = "OTHER"),
		],
		["version zero", "manifest_invalid", (doc) => (doc.manifestVersion = 0)],
		[
			"a base that is not https",
			"manifest_origin",
			(doc) => (doc.base = "http://cfm.example/media/fitment/releases/"),
		],
		[
			"a base on another origin",
			"manifest_origin",
			(doc) => (doc.base = "https://elsewhere.example/releases/"),
		],
		[
			"a base with no trailing slash",
			"manifest_origin",
			(doc) => (doc.base = "https://cfm.example/media/fitment/releases"),
		],
		[
			"a base with a query string",
			"manifest_origin",
			(doc) => (doc.base = "https://cfm.example/media/?x=1/"),
		],
		["a file name with a slash", "manifest_invalid", (doc) => (doc.content.targets.sk.file = "../maky.json")],
		[
			"a file name that is a URL",
			"manifest_invalid",
			(doc) => (doc.content.targets.sk.file = "https://evil.example/x.json"),
		],
		[
			"an upper-case hash",
			"manifest_invalid",
			(doc) => (doc.content.targets.sk.sha256 = doc.content.targets.sk.sha256.toUpperCase()),
		],
		["a short hash", "manifest_invalid", (doc) => (doc.content.targets.sk.sha256 = "abc123")],
		["a file of zero bytes", "manifest_invalid", (doc) => (doc.content.targets.sk.bytes = 0)],
		[
			"a file larger than any this process will read",
			"manifest_invalid",
			(doc) => (doc.content.targets.sk.bytes = FILE_MAX_BYTES + 1),
		],
		[
			"a market code in capitals",
			"manifest_invalid",
			(doc) => (doc.content.targets.DE = doc.content.targets.de),
		],
		[
			"an entry that names another market",
			"manifest_invalid",
			(doc) => (doc.content.targets.sk.market = "cz"),
		],
		["an entry with no release", "manifest_invalid", (doc) => delete doc.content.targets.sk.release],
		[
			"a language that is not a language",
			"manifest_invalid",
			(doc) => (doc.content.targets.sk.language = "s"),
		],
		["no fitment key at all", "manifest_invalid", (doc) => delete doc.fitment],
		["a fitment with no semantic hash", "manifest_invalid", (doc) => delete doc.fitment.datasetHash],
		["a fitment file that is a path", "manifest_invalid", (doc) => (doc.fitment.file = "a/b.json")],
	];

	it.each(refusals)("%s", (_what, code, change) => {
		expect(codeOf(sealed(change))).toBe(code);
	});

	it("when the body does not match its own digest (a truncated or mixed response)", () => {
		const doc = structuredClone(example) as Doc;
		doc.content.targets.sk.release = 99; // changed, digest left as it was
		expect(codeOf(new TextEncoder().encode(JSON.stringify(doc, null, 1)))).toBe("manifest_invalid");
	});

	it("when the pointer is not JSON, or JSON that is not an object", () => {
		expect(codeOf(new TextEncoder().encode("<html>502 Bad Gateway</html>"))).toBe("manifest_invalid");
		expect(codeOf(new TextEncoder().encode("[1,2,3]"))).toBe("manifest_invalid");
		expect(codeOf(readFileSync(join(__dirname, "fixtures", "manifest.example.json")).subarray(0, 900))).toBe(
			"manifest_invalid",
		);
	});

	it("names the pointer's own origin as the only one files may come from", () => {
		const bytes = sealed(() => undefined);
		expect(codeOf(bytes, "https://cfm.example/anything/MANIFEST.json")).toBeNull();
		expect(codeOf(bytes, "https://other.example/media/fitment/releases/MANIFEST.json")).toBe(
			"manifest_origin",
		);
	});
});

describe("the tyre-size pair (manifest 1.1.0)", () => {
	const SECTION = {
		release: 4,
		id: "snehove-retaze-20261105",
		index: {
			file: "maky_tyre_size_index_1-78ed7b5db8a1e4f8.json",
			sha256: "78ed7b5db8a1e4f8cb06598797c5f3f8d2b1b61baaceb2b18b26b3236758042d",
			bytes: 132926,
			contract: { schema: "maky.tyre-size-index/1" },
			selfSha256: "a66c5ac4fc757cbe1901321ff885e65980aec0ca96878bd728af7bcffcab0176",
		},
		families: {
			file: "maky_tyre_families_1-da88e92a46154cac.json",
			sha256: "da88e92a46154cac43a756f2f9d106b8850765b9abd30be5672dbc7702c6fa59",
			bytes: 11116,
			contract: { schema: "maky.tyre-families/1" },
			selfSha256: "a70652dc4b73902722ee294386bcc18550dcecbe9dff30a74d927ead2c47f70b",
		},
	};

	function withSection(change: (section: Doc) => void = () => undefined) {
		const parsed = parseManifest(
			sealed((doc) => {
				doc.schemaVersion = "1.1.0";
				doc.tyreSizes = structuredClone(SECTION);
				change(doc.tyreSizes as Doc);
			}),
			POINTER,
		);
		if (!parsed.ok) throw new Error(parsed.fault.message);
		return parsed.manifest;
	}

	it("is read from CFM's own 1.1.0 example, hashed to the number CFM computed", () => {
		// `fixtures/manifest-1.1.0.example.json` is byte for byte the example beside CFM's contract (CFM PR 117,
		// 2026-11-15). Its two files are the samples CFM built that day: the list with `pages`, the families with `name`.
		expect(manifestSelfSha256(exampleWithTyreSizes)).toBe(exampleWithTyreSizes.selfSha256);
		expect(exampleWithTyreSizes.selfSha256.startsWith("e35e1cc0")).toBe(true);

		const bytes = readFileSync(join(__dirname, "fixtures", "manifest-1.1.0.example.json"));
		const parsed = parseManifest(bytes, POINTER);
		if (!parsed.ok) throw new Error(parsed.fault.message);
		expect(parsed.sha256).toBe("83cb2c0164ff352340fbd5f8c734e98ce7378b2b0309acf42664f182e99fe370");
		const { manifest } = parsed;
		expect(manifest.manifestVersion).toBe(7);
		expect(manifest.tyreSizesFault).toBeNull();
		expect(manifest.tyreSizes).toMatchObject({
			release: 3,
			id: "snehove-retaze-20261105",
			index: {
				file: "maky_tyre_size_index_1-05a0eff62a893a13.json",
				sha256: "05a0eff62a893a133b21bbb2c39f0c9d520de993e3fe079229f2c3e90b317d37",
				bytes: 144169,
				schema: "maky.tyre-size-index/1",
			},
			families: {
				file: "maky_tyre_families_1-9215c71407e57f80.json",
				sha256: "9215c71407e57f8075a0a69bf72891d05940fe6bf1277b5295e39067f051b372",
				bytes: 11199,
				schema: "maky.tyre-families/1",
			},
		});
		// The 1.0 body beside it reads as before.
		expect(Object.keys(manifest.content).sort()).toEqual(["at", "de", "sk", "us"]);
		expect(manifest.fitment).not.toBeNull();
	});

	it("is absent from a 1.0.0 manifest, which names no pair and has no fault", () => {
		const parsed = parseManifest(
			sealed(() => undefined),
			POINTER,
		);
		if (!parsed.ok) throw new Error(parsed.fault.message);
		expect(parsed.manifest.tyreSizes).toBeNull();
		expect(parsed.manifest.tyreSizesFault).toBeNull();
	});

	it("is read as one release with two files", () => {
		const manifest = withSection();
		expect(manifest.tyreSizesFault).toBeNull();
		expect(manifest.tyreSizes).toEqual({
			release: 4,
			id: "snehove-retaze-20261105",
			index: {
				file: SECTION.index.file,
				sha256: SECTION.index.sha256,
				bytes: 132926,
				schema: "maky.tyre-size-index/1",
				selfSha256: SECTION.index.selfSha256,
			},
			families: {
				file: SECTION.families.file,
				sha256: SECTION.families.sha256,
				bytes: 11116,
				schema: "maky.tyre-families/1",
				selfSha256: SECTION.families.selfSha256,
			},
		});
	});

	it("may be null: CFM has not enrolled the pair yet", () => {
		const parsed = parseManifest(
			sealed((doc) => {
				doc.schemaVersion = "1.1.0";
				doc.tyreSizes = null;
			}),
			POINTER,
		);
		if (!parsed.ok) throw new Error(parsed.fault.message);
		expect(parsed.manifest.tyreSizes).toBeNull();
		expect(parsed.manifest.tyreSizesFault).toBeNull();
	});

	it.each([
		["a missing list", (section: Doc) => delete section.index],
		["a missing seal", (section: Doc) => delete section.families.selfSha256],
		[
			"a schema this build does not read",
			(section: Doc) => (section.families.contract.schema = "maky.tyre-families/2"),
		],
		["a release of zero", (section: Doc) => (section.release = 0)],
		["no id", (section: Doc) => delete section.id],
		["a file of a hundred megabytes", (section: Doc) => (section.index.bytes = 100 * 1_048_576)],
		["a file name that is a path", (section: Doc) => (section.families.file = "a/b.json")],
		["a section that is a list", (section: Doc) => (section.index = [])],
	])("with %s is a fault of the section, and the manifest around it is still read", (_what, change) => {
		const manifest = withSection(change);
		expect(manifest.tyreSizes).toBeNull();
		expect(manifest.tyreSizesFault?.code).toBe("tyre_sizes_invalid");
		expect(manifest.tyreSizesFault?.message).toContain("tyreSizes");
		// The 1.0 body is untouched by it.
		expect(Object.keys(manifest.content).sort()).toEqual(["at", "de", "sk", "us"]);
		expect(manifest.fitment?.datasetVersion).toBe("3.0.0-full-example.1");
	});
});

describe("where a file lives", () => {
	const base = "https://cfm.example/media/fitment/releases/";

	it("is the base plus the file name", () => {
		expect(fileUrl(base, "maky_catalog_content_1.0.0-de-abc.json")).toBe(
			`${base}maky_catalog_content_1.0.0-de-abc.json`,
		);
		expect(fileUrl(base, "a..b.json")).toBe(`${base}a..b.json`);
	});

	it("can never be made to leave the base", () => {
		expect(() => fileUrl(base, "https://evil.example/x.json")).toThrow(/outside/);
		expect(() => fileUrl(base, "//evil.example/x.json")).toThrow(/outside/);
		expect(() => fileUrl(base, "../x.json")).toThrow(/outside/);
	});
});
