import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	BASE,
	FakeCfm,
	POINTER,
	SALEOR_HOST,
	contentFile,
	fitmentFile,
	manifestDocument,
	rawContentFile,
	rawFitmentFile,
	redirect,
	respond,
	status,
	type FitmentFile,
	type ManifestSpec,
	type TargetSpec,
} from "./fixtures/fake-cfm";
import { MANIFEST_MAX_BYTES } from "./manifest";
import {
	__resetReleaseState,
	__setReleaseClock,
	__settleReleaseSync,
	inspectRelease,
	releaseSyncOnce,
	releasedContent,
	releasedFitment,
	startReleaseSync,
} from "./sync";

/**
 * The release loader, run against a stand-in for CFM.
 *
 * The loader's only seam is `fetch`, so these tests drive its real code from end to end: a manifest is
 * served, the files it names are fetched, verified and activated, and what a render would read is asserted
 * afterwards. Each group pins one promise of the contract (`MAKY_RELEASE_MANIFEST_CONTRACT.md` §5):
 *
 *   - activation is per target, so one market's bad file never holds another market back;
 *   - a refused manifest, a refused file and a dead origin all leave the last verified file serving;
 *   - Germany and Austria are two targets even when they share one file;
 *   - the dataset and the content are independent of each other;
 *   - nothing is ever half activated: a render sees the old file until the new one has fully verified.
 *
 * Time is the loader's own clock (`__setReleaseClock`), so a retry that waits half a minute is a sum here.
 */

const ENV = [
	"MAKY_RELEASE_MANIFEST_URL",
	"MAKY_RELEASE_POLL_SECONDS",
	"MAKY_RELEASE_MANIFEST_TIMEOUT_MS",
	"MAKY_RELEASE_FILE_TIMEOUT_MS",
	"MAKY_RELEASE_CACHE_DIR",
	"MAKY_CATALOG_CONTENT_PATH",
	"MAKY_CATALOG_CONTENT_URL",
	"NEXT_PUBLIC_SALEOR_API_URL",
] as const;
const SAVED = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));

const quiet = (method: "log" | "warn" | "error") =>
	vi.spyOn(console, method).mockImplementation(() => undefined);

let cfm: FakeCfm;
let now: number;
let log: ReturnType<typeof quiet>;
let warn: ReturnType<typeof quiet>;
let error: ReturnType<typeof quiet>;

beforeEach(() => {
	for (const key of ENV) delete process.env[key];
	process.env.MAKY_RELEASE_MANIFEST_URL = POINTER;
	process.env.NEXT_PUBLIC_SALEOR_API_URL = `https://${SALEOR_HOST}/graphql/`;
	__resetReleaseState();
	now = 1_800_000_000_000;
	__setReleaseClock(() => now);
	cfm = new FakeCfm();
	cfm.install();
	log = quiet("log");
	warn = quiet("warn");
	error = quiet("error");
});

afterEach(() => {
	__resetReleaseState();
	__setReleaseClock(null);
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	for (const key of ENV) {
		if (SAVED[key] === undefined) delete process.env[key];
		else process.env[key] = SAVED[key];
	}
});

/** One pass, to the end. */
async function pass(): Promise<void> {
	await releaseSyncOnce();
}

/** Lets what a settled promise queued behind it run: the next poll is scheduled from a `finally`. */
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function view(market: string) {
	const found = inspectRelease().targets.find((target) => target.market === market);
	if (!found) throw new Error(`the process holds no target ${market}`);
	return found;
}

/**
 * Which edition of the text a market is serving. `contentFile` writes `<language>/<edition>/<n>` into the
 * first page, so this is the one thing a visitor could actually read, not a field the loader sets itself.
 */
function serving(market: string, language: string): string | undefined {
	const block = releasedContent(market, language)?.snapshot?.pages[0]?.intro?.blocks[0] as
		| { data: { text: string } }
		| undefined;
	return block?.data.text;
}

/** Same length, different bytes. */
function flip(bytes: Uint8Array): Uint8Array {
	const copy = bytes.slice();
	copy[copy.length >> 1] ^= 1;
	return copy;
}

function longer(bytes: Uint8Array, extra: number): Uint8Array {
	const out = new Uint8Array(bytes.byteLength + extra);
	out.set(bytes);
	out.fill(32, bytes.byteLength);
	return out;
}

// ── following the manifest ───────────────────────────────────────────────────

describe("following the manifest", () => {
	it("takes each target from the file the manifest names for it", async () => {
		const sk = contentFile("sk");
		const de = contentFile("de");
		const us = contentFile("en");
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 }, de: { file: de, release: 4 }, us: { file: us, release: 2 } },
		});

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(serving("de", "de")).toBe("de/a/0");
		expect(serving("us", "en")).toBe("en/a/0");
		expect(releasedContent("sk", "sk")?.status).toMatchObject({
			mode: "release",
			unavailableReason: null,
			language: "sk",
			pageCount: 3,
			sha256: sk.sha256,
		});
		expect(view("de").active?.entry.release).toBe(4);
		expect(inspectRelease().manifest).toMatchObject({ version: 1, outcome: "new", fault: null });
	});

	it("hands nothing to a market the manifest does not name, and nothing in a language the market does not read", async () => {
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });
		await pass();

		expect(releasedContent("hu", "hu")).toBeNull();
		expect(releasedContent("sk", "de")).toBeNull();
	});

	it("fetches identical bytes once and hands DE and AT one parsed snapshot", async () => {
		const de = contentFile("de");
		cfm.publish({ version: 1, targets: { de: { file: de, release: 2 }, at: { file: de, release: 3 } } });

		await pass();

		expect(cfm.count(de.name)).toBe(1);
		const germany = releasedContent("de", "de");
		expect(germany).not.toBeNull();
		expect(germany?.snapshot).toBe(releasedContent("at", "de")?.snapshot);
		// One file, still two targets: each reports the release CFM approved for it, and neither stands in for the other.
		expect([view("de").active?.entry.release, view("at").active?.entry.release]).toEqual([2, 3]);
	});

	it("gives a target that joins later the bytes another target already verified, without fetching them again", async () => {
		const de = contentFile("de");
		cfm.publish({ version: 1, targets: { de: { file: de, release: 1 } } });
		await pass();

		cfm.publish({ version: 2, targets: { de: { file: de, release: 1 }, at: { file: de, release: 4 } } });
		cfm.forget();
		await pass();

		expect(cfm.count(de.name)).toBe(0);
		expect(releasedContent("at", "de")?.snapshot).toBe(releasedContent("de", "de")?.snapshot);
		expect(releasedContent("at", "de")).not.toBeNull();
		expect(view("at").active?.entry.release).toBe(4);
	});

	it("lets Germany and Austria hold different files, and fetches only what changed", async () => {
		const germanyA = contentFile("de", "germany-a");
		const austria = contentFile("de", "austria");
		cfm.publish({
			version: 1,
			targets: { de: { file: germanyA, release: 1 }, at: { file: austria, release: 1 } },
		});
		await pass();
		expect(serving("de", "de")).toBe("de/germany-a/0");
		expect(serving("at", "de")).toBe("de/austria/0");

		// Germany moves on. Austria is not asked about, not refetched, and does not move.
		const germanyB = contentFile("de", "germany-b");
		cfm.publish({
			version: 2,
			targets: { de: { file: germanyB, release: 2 }, at: { file: austria, release: 1 } },
		});
		cfm.forget();
		await pass();

		expect(serving("de", "de")).toBe("de/germany-b/0");
		expect(serving("at", "de")).toBe("de/austria/0");
		expect(cfm.count(germanyB.name)).toBe(1);
		expect(cfm.count(austria.name)).toBe(0);
		expect(cfm.count(germanyA.name)).toBe(0);
	});

	it("does not fetch again when only a release number moves, but reports the new release", async () => {
		const sk = contentFile("sk");
		cfm.publish({ version: 1, targets: { sk: { file: sk, release: 1 } } });
		await pass();

		cfm.publish({ version: 2, targets: { sk: { file: sk, release: 2 } } });
		cfm.forget();
		await pass();

		expect(cfm.count(sk.name)).toBe(0);
		expect(view("sk").active?.entry.release).toBe(2);
		expect(serving("sk", "sk")).toBe("sk/a/0");
	});

	it("picks up a new version: new bytes for one target, nothing at all for the rest", async () => {
		const skA = contentFile("sk", "a");
		const skB = contentFile("sk", "b");
		const de = contentFile("de");
		cfm.publish({ version: 1, targets: { sk: { file: skA, release: 1 }, de: { file: de, release: 1 } } });
		await pass();

		cfm.publish({ version: 2, targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 } } });
		cfm.forget();
		await pass();

		expect(serving("sk", "sk")).toBe("sk/b/0");
		expect(serving("de", "de")).toBe("de/a/0");
		expect([cfm.count(skB.name), cfm.count(skA.name), cfm.count(de.name)]).toEqual([1, 0, 0]);
		expect(inspectRelease().manifest).toMatchObject({ version: 2, outcome: "new" });
	});

	it("asks for the pointer conditionally, and an unchanged pointer costs no downloads", async () => {
		cfm.publish({
			version: 1,
			targets: { sk: { file: contentFile("sk"), release: 1 } },
			fitment: { file: fitmentFile(), release: 1 },
		});
		await pass();
		// Nothing held yet, so there is nothing to validate against.
		expect(cfm.hits[0]?.headers["if-none-match"]).toBeUndefined();

		cfm.forget();
		await pass();

		expect(cfm.hits).toHaveLength(1);
		expect(cfm.hits[0]?.headers["if-none-match"]).toMatch(/^"[0-9a-f]{16}"$/);
		expect(inspectRelease().manifest).toMatchObject({ version: 1, outcome: "unchanged", fault: null });
	});

	it("takes the same manifest served again, byte for byte, as unchanged even when the server ignores validators", async () => {
		const document = cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });
		await pass();

		cfm.override("MANIFEST.json", () => respond(JSON.stringify(document, null, 1)));
		cfm.forget();
		await pass();

		expect(inspectRelease().manifest).toMatchObject({ version: 1, outcome: "unchanged", fault: null });
		expect(cfm.hits).toHaveLength(1);
	});

	it("keeps serving a market the manifest stops naming", async () => {
		const sk = contentFile("sk");
		const de = contentFile("de");
		cfm.publish({ version: 1, targets: { sk: { file: sk, release: 1 }, de: { file: de, release: 1 } } });
		await pass();

		// Taking content away from a market is a decision CFM sends as a new file. A missing line is not one.
		cfm.publish({ version: 2, targets: { sk: { file: sk, release: 1 } } });
		await pass();

		expect(serving("de", "de")).toBe("de/a/0");
		expect(serving("sk", "sk")).toBe("sk/a/0");
	});

	it("asks only the configured origin, explicitly uncached, and never lets fetch follow a redirect by itself", async () => {
		cfm.publish({
			version: 1,
			targets: { sk: { file: contentFile("sk"), release: 1 } },
			fitment: { file: fitmentFile(), release: 1 },
		});
		await pass();

		const calls = vi.mocked(fetch).mock.calls;
		expect(calls.length).toBeGreaterThanOrEqual(3);
		for (const [url, init] of calls) {
			expect(String(url).startsWith(BASE)).toBe(true);
			expect(init).toMatchObject({ cache: "no-store", redirect: "manual" });
		}
	});

	it("follows a redirect that stays on the origin, and refuses one that leaves it", async () => {
		const document = cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });
		const bytes = JSON.stringify(document, null, 1);
		cfm.override("MANIFEST.json", () => redirect("/media/fitment/releases/moved/MANIFEST.json"));
		cfm.override("moved/MANIFEST.json", () => respond(bytes));
		await pass();
		expect(inspectRelease().manifest).toMatchObject({ version: 1, outcome: "new" });
		expect(serving("sk", "sk")).toBe("sk/a/0");
	});

	it("shows a render the old file until the new one has fully verified", async () => {
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk", "a"), release: 1 } } });
		await pass();

		const next = contentFile("sk", "b");
		let open!: () => void;
		const gate = new Promise<void>((resolve) => (open = resolve));
		cfm.publish({ version: 2, targets: { sk: { file: next, release: 2 } } });
		cfm.override(next.name, async () => {
			await gate;
			return respond(next.bytes);
		});

		const running = releaseSyncOnce();
		await tick();
		await tick();
		expect(serving("sk", "sk")).toBe("sk/a/0");

		open();
		await running;
		expect(serving("sk", "sk")).toBe("sk/b/0");
	});

	it("joins a pass that is already running instead of doubling it", async () => {
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });

		const first = releaseSyncOnce();
		const second = releaseSyncOnce();
		expect(second).toBe(first);
		await Promise.all([first, second]);

		expect(cfm.count("MANIFEST.json")).toBe(1);
	});

	it("is one state for every module graph in the process, because the page, the routes and boot are separate bundles", async () => {
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });
		await pass();

		vi.resetModules();
		const other = await import("./sync");

		// A second copy of the module, as a second bundle would be, and still the same slots.
		expect(other.releasedContent).not.toBe(releasedContent);
		expect(other.releasedContent("sk", "sk")).not.toBeNull();
		expect(other.inspectRelease().bootId).toBe(inspectRelease().bootId);
	});

	it("never rejects, whatever fetch does", async () => {
		vi.stubGlobal("fetch", () => {
			throw new Error("boom");
		});

		await expect(releaseSyncOnce()).resolves.toBeUndefined();

		expect(inspectRelease().manifest.fault).toMatchObject({ code: "manifest_unreachable", message: "boom" });
	});
});

// ── a manifest that cannot be used ───────────────────────────────────────────

describe("a manifest that cannot be used", () => {
	const sk = contentFile("sk");
	const v1: ManifestSpec = {
		version: 1,
		targets: { sk: { file: sk, release: 1 } },
		fitment: { file: fitmentFile(), release: 1 },
	};

	const timeout = () => {
		throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
	};

	const FAULTS: Array<[what: string, code: string, arrange: (cfm: FakeCfm) => void]> = [
		[
			"the pointer answers 503",
			"manifest_unreachable",
			(c) => c.override("MANIFEST.json", () => status(503)),
		],
		[
			"the pointer is not there",
			"manifest_unreachable",
			(c) => c.override("MANIFEST.json", () => status(404)),
		],
		["the connection times out", "manifest_unreachable", (c) => c.override("MANIFEST.json", timeout)],
		[
			"the pointer is an HTML error page",
			"manifest_invalid",
			(c) => c.serve("<html><title>502 Bad Gateway</title></html>"),
		],
		[
			"the pointer is larger than any manifest can be",
			"manifest_invalid",
			(c) => c.serve(new Uint8Array(MANIFEST_MAX_BYTES + 1)),
		],
		[
			"the pointer is cut off half way",
			"manifest_invalid",
			(c) => c.serve(JSON.stringify(manifestDocument({ ...v1, version: 2 }), null, 1).slice(0, 400)),
		],
		[
			"the body does not match the manifest's own digest",
			"manifest_invalid",
			(c) => {
				const mixed = manifestDocument({ ...v1, version: 2 });
				mixed.content.targets.sk.release = 99;
				c.serve(JSON.stringify(mixed, null, 1));
			},
		],
		[
			"the manifest is of a major version this build does not know",
			"manifest_schema_unsupported",
			(c) => c.publish({ ...v1, version: 2, edit: (doc) => (doc.schemaVersion = "2.0.0") }),
		],
		[
			"the manifest asks to be consumed by rules this build does not implement",
			"manifest_schema_unsupported",
			(c) => c.publish({ ...v1, version: 2, edit: (doc) => (doc.rules.activation = "all-or-nothing") }),
		],
		[
			"the manifest sends the files to another origin",
			"manifest_origin",
			(c) =>
				c.publish({ ...v1, version: 2, edit: (doc) => (doc.base = "https://elsewhere.example/releases/") }),
		],
		[
			"the manifest sends the files over plain http",
			"manifest_origin",
			(c) => c.publish({ ...v1, version: 2, edit: (doc) => (doc.base = BASE.replace("https:", "http:")) }),
		],
		[
			"the pointer redirects to another origin",
			"manifest_origin",
			(c) => c.override("MANIFEST.json", () => redirect("https://elsewhere.example/MANIFEST.json")),
		],
	];

	it.each(FAULTS)(
		"%s: nothing is taken, the contract code says why, nothing leaves the origin, and the next good manifest recovers",
		async (_what, code, arrange) => {
			arrange(cfm);
			await pass();

			expect(inspectRelease().manifest).toMatchObject({ version: null, outcome: "failed", fault: { code } });
			expect(releasedContent("sk", "sk")).toBeNull();
			expect(releasedFitment()).toBeNull();
			expect(cfm.hits.every((hit) => hit.url.startsWith(BASE))).toBe(true);

			cfm.restore("MANIFEST.json");
			cfm.publish({ ...v1, version: 3 });
			await pass();

			expect(inspectRelease().manifest).toMatchObject({ version: 3, outcome: "new", fault: null });
			expect(serving("sk", "sk")).toBe("sk/a/0");
			expect(releasedFitment()).not.toBeNull();
		},
	);

	it.each(FAULTS)(
		"%s: what is already active keeps serving, and no file is fetched on the strength of it",
		async (_what, code, arrange) => {
			cfm.publish(v1);
			await pass();

			arrange(cfm);
			cfm.forget();
			await pass();

			expect(inspectRelease().manifest).toMatchObject({ version: 1, outcome: "failed", fault: { code } });
			expect(serving("sk", "sk")).toBe("sk/a/0");
			expect(releasedFitment()).not.toBeNull();
			expect(cfm.hits.filter((hit) => hit.url !== POINTER)).toEqual([]);
		},
	);

	it("refuses an older manifest than the one it holds, and fetches nothing from it", async () => {
		const older = contentFile("sk", "older");
		cfm.publish({ version: 5, targets: { sk: { file: sk, release: 2 } } });
		await pass();

		cfm.publish({ version: 4, targets: { sk: { file: older, release: 1 } } });
		cfm.forget();
		await pass();

		expect(inspectRelease().manifest).toMatchObject({
			version: 5,
			outcome: "failed",
			fault: { code: "manifest_downgrade" },
		});
		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(cfm.count(older.name)).toBe(0);
	});

	it("refuses two different manifests that claim the same version, then takes the next one", async () => {
		const other = contentFile("sk", "other");
		cfm.publish({ version: 5, targets: { sk: { file: sk, release: 2 } } });
		await pass();

		cfm.publish({ version: 5, targets: { sk: { file: other, release: 3 } } });
		cfm.forget();
		await pass();

		expect(inspectRelease().manifest).toMatchObject({
			version: 5,
			outcome: "failed",
			fault: { code: "manifest_conflict" },
		});
		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(cfm.count(other.name)).toBe(0);

		cfm.publish({ version: 6, targets: { sk: { file: other, release: 3 } } });
		await pass();
		expect(serving("sk", "sk")).toBe("sk/other/0");
		expect(inspectRelease().manifest.fault).toBeNull();
	});
});

// ── a file that cannot be used ───────────────────────────────────────────────

describe("a content file that cannot be used", () => {
	const skA = contentFile("sk", "a");

	/** Each builds the one wrong delivery for the market `de`, release 2. */
	const FAULTS: Array<[what: string, code: string, make: (cfm: FakeCfm, edition: string) => TargetSpec]> = [
		[
			"bytes that are not the ones the manifest hashed",
			"file_hash_mismatch",
			(c, edition) => {
				const file = contentFile("de", edition);
				c.override(file.name, () => respond(flip(file.bytes)));
				return { file, release: 2 };
			},
		],
		[
			"a file shorter than the manifest says",
			"file_size_mismatch",
			(c, edition) => {
				const file = contentFile("de", edition);
				c.override(file.name, () => respond(file.bytes.slice(0, -5)));
				return { file, release: 2 };
			},
		],
		[
			"a file longer than the manifest says",
			"file_size_mismatch",
			(c, edition) => {
				const file = contentFile("de", edition);
				c.override(file.name, () => respond(longer(file.bytes, 2)));
				return { file, release: 2 };
			},
		],
		[
			"a file the server does not have",
			"file_unreachable",
			(c, edition) => {
				const file = contentFile("de", edition);
				c.override(file.name, () => status(404));
				return { file, release: 2 };
			},
		],
		[
			"a server that is unwell",
			"file_unreachable",
			(c, edition) => {
				const file = contentFile("de", edition);
				c.override(file.name, () => status(503));
				return { file, release: 2 };
			},
		],
		[
			"a connection that dies half way",
			"file_unreachable",
			(c, edition) => {
				const file = contentFile("de", edition);
				c.override(file.name, () => {
					throw new TypeError("fetch failed");
				});
				return { file, release: 2 };
			},
		],
		[
			"a file that is not JSON, with the hash the manifest expects",
			"file_invalid",
			(c, edition) => {
				const file = rawContentFile("de", `<html>${edition}</html>`);
				c.add(file);
				return { file, release: 2 };
			},
		],
		[
			"JSON that is not a content snapshot",
			"file_invalid",
			(c, edition) => {
				const file = rawContentFile("de", JSON.stringify({ artifact: "SOMETHING_ELSE", edition }));
				c.add(file);
				return { file, release: 2 };
			},
		],
		[
			"a snapshot with no pages",
			"file_invalid",
			(_c, edition) => ({ file: contentFile("de", edition, 0), release: 2 }),
		],
		[
			"a snapshot whose own language is not the one the manifest states",
			"file_language_mismatch",
			(_c, edition) => ({ file: contentFile("sk", edition), release: 2, language: "de" }),
		],
		[
			"a language the manifest gives the market but this storefront does not read there",
			"file_language_mismatch",
			(_c, edition) => ({ file: contentFile("sk", edition), release: 2 }),
		],
		[
			"a page count that is not the file's",
			"file_invalid",
			(_c, edition) => ({ file: contentFile("de", edition, 3), release: 2, pages: 99 }),
		],
	];

	it.each(FAULTS)(
		"%s: that market gets nothing from it, and the others are not held back",
		async (_what, code, make) => {
			cfm.publish({ version: 1, targets: { sk: { file: skA, release: 1 }, de: make(cfm, "bad") } });

			await pass();

			expect(serving("sk", "sk")).toBe("sk/a/0");
			expect(releasedContent("de", "de")).toBeNull();
			expect(view("de")).toMatchObject({ active: null, fault: { code }, desired: { release: 2 } });
		},
	);

	it.each(FAULTS)(
		"%s: even as the first target the manifest names, the others and the dataset still follow",
		async (_what, code, make) => {
			cfm.publish({
				version: 1,
				targets: { de: make(cfm, "bad"), sk: { file: skA, release: 1 } },
				fitment: { file: fitmentFile(), release: 1 },
			});

			await pass();

			expect(serving("sk", "sk")).toBe("sk/a/0");
			expect(releasedFitment()).not.toBeNull();
			expect(view("de").fault?.code).toBe(code);
		},
	);

	it.each(FAULTS)(
		"%s: the target keeps its last verified file, says so, and recovers on the next good one",
		async (_what, code, make) => {
			cfm.publish({
				version: 1,
				targets: { sk: { file: skA, release: 1 }, de: { file: contentFile("de", "good"), release: 1 } },
			});
			await pass();

			cfm.publish({
				version: 2,
				targets: { sk: { file: contentFile("sk", "next"), release: 2 }, de: make(cfm, "bad") },
			});
			await pass();

			// The healthy market moved on. The failing one neither moved nor was emptied.
			expect(serving("sk", "sk")).toBe("sk/next/0");
			expect(serving("de", "de")).toBe("de/good/0");
			expect(view("de")).toMatchObject({
				fault: { code },
				active: { entry: { release: 1 } },
				desired: { release: 2 },
			});

			// A corrected delivery is a new file, and it is attempted at once, whatever the wait for the bad one was.
			cfm.publish({
				version: 3,
				targets: {
					sk: { file: contentFile("sk", "next"), release: 2 },
					de: { file: contentFile("de", "fixed"), release: 3 },
				},
			});
			await pass();

			expect(serving("de", "de")).toBe("de/fixed/0");
			expect(view("de")).toMatchObject({ fault: null, active: { entry: { release: 3 } } });
		},
	);

	it("cuts a body off the moment it runs past the declared size, whatever Content-Length said", async () => {
		const sk = contentFile("sk");
		let cancelled = false;
		cfm.publish({ version: 1, targets: { sk: { file: sk, release: 1 } } });
		cfm.override(sk.name, () => {
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(sk.bytes);
					controller.enqueue(new Uint8Array(1024));
				},
				cancel() {
					cancelled = true;
				},
			});
			return new Response(stream, { status: 200, headers: { "content-length": "10" } });
		});

		await pass();

		expect(view("sk").fault?.code).toBe("file_size_mismatch");
		expect(cancelled).toBe(true);
	});

	it("never hands one market a file another market already verified for a language it does not read", async () => {
		// `de` is pointed at Slovak bytes that `sk` has already verified. Verifying once is for speed; the
		// language check is per target, and it is the one that stops Slovak text under a German hreflang.
		cfm.publish({ version: 1, targets: { sk: { file: skA, release: 1 } } });
		await pass();

		cfm.publish({ version: 2, targets: { sk: { file: skA, release: 1 }, de: { file: skA, release: 1 } } });
		cfm.forget();
		await pass();

		expect(cfm.count(skA.name)).toBe(0);
		expect(releasedContent("de", "de")).toBeNull();
		expect(releasedContent("de", "sk")).toBeNull();
		expect(view("de").fault?.code).toBe("file_language_mismatch");
		expect(serving("sk", "sk")).toBe("sk/a/0");
	});

	it("reports a market this storefront does not serve as unknown, without fetching its file or holding the others back", async () => {
		const stray = contentFile("en", "stray");
		cfm.publish({
			version: 1,
			targets: { sk: { file: skA, release: 1 }, xx: { file: stray, release: 1 } },
		});

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(cfm.count(stray.name)).toBe(0);
		expect(releasedContent("xx", "en")).toBeNull();
		expect(view("xx").fault?.code).toBe("target_unknown");
	});
});

// ── a target that fails is not hammered ──────────────────────────────────────

describe("a target that fails is not hammered", () => {
	it("is asked again after 30 s, then 60 s, and never later than 5 minutes apart", async () => {
		const sk = contentFile("sk");
		cfm.publish({ version: 1, targets: { sk: { file: sk, release: 1 } } });
		cfm.override(sk.name, () => status(503));

		await pass();
		expect(cfm.count(sk.name)).toBe(1);
		await pass(); // the same instant: not due
		now += 29_999; // just short of 30 s
		await pass();
		expect(cfm.count(sk.name)).toBe(1);

		now += 2;
		await pass();
		expect(cfm.count(sk.name)).toBe(2);

		now += 59_000; // the second failure doubled the wait
		await pass();
		expect(cfm.count(sk.name)).toBe(2);
		now += 1_001;
		await pass();
		expect(cfm.count(sk.name)).toBe(3);

		// However long it has been failing, the wait stops growing at 5 minutes.
		for (let attempt = 4; attempt <= 8; attempt++) {
			now += 400_000;
			await pass();
			expect(cfm.count(sk.name)).toBe(attempt);
		}
		now += 299_999;
		await pass();
		expect(cfm.count(sk.name)).toBe(8);
		now += 2;
		await pass();
		expect(cfm.count(sk.name)).toBe(9);

		cfm.restore(sk.name);
		now += 300_001;
		await pass();
		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(view("sk").fault).toBeNull();
	});

	it("is attempted at once when the manifest names a different file, whatever the wait for the old one was", async () => {
		const broken = contentFile("sk", "broken");
		cfm.publish({ version: 1, targets: { sk: { file: broken, release: 1 } } });
		cfm.override(broken.name, () => status(503));
		await pass();

		cfm.publish({ version: 2, targets: { sk: { file: contentFile("sk", "fixed"), release: 2 } } });
		await pass(); // no time has passed

		expect(serving("sk", "sk")).toBe("sk/fixed/0");
	});

	it("does not delay a healthy target because another one is waiting out a failure", async () => {
		const de = contentFile("de");
		const sk = contentFile("sk", "broken");
		cfm.publish({ version: 1, targets: { de: { file: de, release: 1 }, sk: { file: sk, release: 1 } } });
		cfm.override(sk.name, () => status(503));
		await pass();
		expect(serving("de", "de")).toBe("de/a/0");

		const deNext = contentFile("de", "b");
		cfm.publish({ version: 2, targets: { de: { file: deNext, release: 2 }, sk: { file: sk, release: 1 } } });
		await pass(); // sk is still within its wait; de is not waiting at all

		expect(serving("de", "de")).toBe("de/b/0");
		expect(cfm.count(sk.name)).toBe(1);
	});

	it("says what went wrong once, not once per poll, and again only when something changes", async () => {
		cfm.override("MANIFEST.json", () => status(503));
		await pass();
		await pass();
		await pass();
		expect(error).toHaveBeenCalledTimes(1);
		expect(String(error.mock.calls[0]?.[0])).toContain("manifest_unreachable");

		cfm.restore("MANIFEST.json");
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });
		await pass();
		expect(log).toHaveBeenCalledWith(expect.stringContaining("manifest v1 taken"));
		expect(error).toHaveBeenCalledTimes(1);

		// It broke again: that is news.
		cfm.override("MANIFEST.json", () => status(503));
		await pass();
		expect(error).toHaveBeenCalledTimes(2);
	});
});

// ── the fitment dataset ──────────────────────────────────────────────────────

describe("the fitment dataset", () => {
	const sk = contentFile("sk");
	const skNext = contentFile("sk", "next");

	it("is verified against the manifest, and only then taken", async () => {
		const fit = fitmentFile("3.0.0-test.1");
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 3 },
		});

		await pass();

		const held = releasedFitment();
		expect(held).toMatchObject({ file: fit.name, sha256: fit.sha256, release: 3 });
		expect(held?.dataset.datasetHash).toBe(fit.datasetHash);
		expect(held?.dataset.datasetVersion).toBe("3.0.0-test.1");
		expect(inspectRelease().fitment.active).toMatchObject({ datasetHash: fit.datasetHash });
	});

	/** Each builds the one wrong delivery. */
	const FAULTS: Array<
		[what: string, code: string, make: (cfm: FakeCfm) => { file: FitmentFile; edit?: ManifestSpec["edit"] }]
	> = [
		[
			"bytes that are not the ones the manifest hashed",
			"file_hash_mismatch",
			(c) => {
				const file = fitmentFile("3.0.0-bad.1");
				c.override(file.name, () => respond(flip(file.bytes)));
				return { file };
			},
		],
		[
			"a dataset whose semantic hash is not the one the manifest states",
			"fitment_hash_mismatch",
			() => ({ file: fitmentFile("3.0.0-bad.2"), edit: (doc) => (doc.fitment.datasetHash = "0".repeat(64)) }),
		],
		[
			"a dataset of another version than the manifest states",
			"fitment_invalid",
			() => ({
				file: fitmentFile("3.0.0-bad.3"),
				edit: (doc) => (doc.fitment.datasetVersion = "9.9.9-other"),
			}),
		],
		[
			"a dataset of another schema than the manifest states",
			"fitment_invalid",
			() => ({
				file: fitmentFile("3.0.0-bad.4"),
				edit: (doc) => (doc.fitment.contract.schemaVersion = "3.1.0"),
			}),
		],
		[
			"a dataset generated for another Saleor instance",
			"fitment_invalid",
			() => ({ file: fitmentFile("3.0.0-bad.5", { saleorInstance: "other.example" }) }),
		],
		[
			"a file that is not JSON",
			"fitment_invalid",
			(c) => {
				const file = rawFitmentFile("<html>502</html>");
				c.add(file);
				return { file };
			},
		],
		[
			"a file shorter than the manifest says",
			"file_size_mismatch",
			(c) => {
				const file = fitmentFile("3.0.0-bad.6");
				c.override(file.name, () => respond(file.bytes.slice(0, -10)));
				return { file };
			},
		],
		[
			"a file the server does not have",
			"file_unreachable",
			(c) => {
				const file = fitmentFile("3.0.0-bad.7");
				c.override(file.name, () => status(404));
				return { file };
			},
		],
	];

	it.each(FAULTS)(
		"%s: nothing is taken, the content is not held back, and the code says why",
		async (_what, code, make) => {
			const { file, edit } = make(cfm);
			cfm.publish({
				version: 1,
				targets: { sk: { file: sk, release: 1 } },
				fitment: { file, release: 1 },
				edit,
			});

			await pass();

			expect(releasedFitment()).toBeNull();
			expect(inspectRelease().fitment).toMatchObject({ active: null, fault: { code } });
			expect(serving("sk", "sk")).toBe("sk/a/0");
		},
	);

	it.each(FAULTS)(
		"%s: the dataset in use stays in use, and the content moves on",
		async (_what, code, make) => {
			const good = fitmentFile("3.0.0-good.1");
			cfm.publish({
				version: 1,
				targets: { sk: { file: sk, release: 1 } },
				fitment: { file: good, release: 1 },
			});
			await pass();

			const { file, edit } = make(cfm);
			cfm.publish({
				version: 2,
				targets: { sk: { file: skNext, release: 2 } },
				fitment: { file, release: 2 },
				edit,
			});
			await pass();

			expect(releasedFitment()?.dataset.datasetVersion).toBe("3.0.0-good.1");
			expect(serving("sk", "sk")).toBe("sk/next/0");
			expect(inspectRelease().fitment).toMatchObject({
				fault: { code },
				active: { entry: { release: 1 } },
				desired: { release: 2 },
			});
		},
	);

	it("does not take the content down with it, and the content failing does not take the dataset down", async () => {
		const fit = fitmentFile("3.0.0-test.1");
		const broken = contentFile("sk", "broken");
		cfm.publish({
			version: 1,
			targets: { sk: { file: broken, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		cfm.override(broken.name, () => respond(flip(broken.bytes)));

		await pass();

		expect(releasedContent("sk", "sk")).toBeNull();
		expect(view("sk").fault?.code).toBe("file_hash_mismatch");
		expect(releasedFitment()?.dataset.datasetHash).toBe(fit.datasetHash);
		expect(inspectRelease().fitment.fault).toBeNull();
	});

	it("is replaced by a newer one when the manifest names it", async () => {
		const first = fitmentFile("3.0.0-test.1");
		const second = fitmentFile("3.0.0-test.2");
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: first, release: 1 },
		});
		await pass();

		cfm.publish({
			version: 2,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: second, release: 2 },
		});
		cfm.forget();
		await pass();

		expect(releasedFitment()?.dataset.datasetVersion).toBe("3.0.0-test.2");
		expect([cfm.count(second.name), cfm.count(first.name)]).toEqual([1, 0]);
	});

	it("is not fetched again when only its release number moves", async () => {
		const fit = fitmentFile();
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		await pass();

		cfm.publish({
			version: 2,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 2 },
		});
		cfm.forget();
		await pass();

		expect(cfm.count(fit.name)).toBe(0);
		expect(releasedFitment()?.release).toBe(2);
		expect(inspectRelease().fitment.active?.entry.release).toBe(2);
	});

	it("stays in use when a later manifest names none: a missing line is not a withdrawal", async () => {
		const fit = fitmentFile();
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		await pass();

		cfm.publish({ version: 2, targets: { sk: { file: sk, release: 1 } }, fitment: null });
		await pass();

		expect(releasedFitment()?.dataset.datasetHash).toBe(fit.datasetHash);
	});

	it("reports what it last asked and what came of it", async () => {
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fitmentFile(), release: 1 },
		});
		await pass();
		expect(releasedFitment()?.lastCheck).toEqual({ at: now, outcome: "new", reason: null });

		now += 1_000;
		await pass();
		expect(releasedFitment()?.lastCheck).toEqual({ at: now, outcome: "unchanged", reason: null });

		// The manifest now names a newer dataset that cannot be had: the dataset in use is the old one, and the check failed.
		const missing = fitmentFile("3.0.0-missing.1");
		cfm.override(missing.name, () => status(404));
		cfm.publish({
			version: 2,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: missing, release: 2 },
		});
		now += 1_000;
		await pass();
		expect(releasedFitment()?.lastCheck).toEqual({ at: now, outcome: "failed", reason: "file_unreachable" });
		expect(releasedFitment()?.dataset.datasetVersion).toBe("3.0.0-test.1");
	});

	it("is retried on its own schedule, which is not the content's", async () => {
		const fit = fitmentFile();
		cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		cfm.override(fit.name, () => status(503));

		await pass();
		await pass();
		expect(cfm.count(fit.name)).toBe(1);

		now += 30_001;
		await pass();
		expect(cfm.count(fit.name)).toBe(2);
		expect(cfm.count(sk.name)).toBe(1);
	});
});

// ── when nothing is configured ───────────────────────────────────────────────

describe("without a manifest address", () => {
	it("is off: no request is made, the older settings stay in charge, and boot says so", async () => {
		delete process.env.MAKY_RELEASE_MANIFEST_URL;
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });

		startReleaseSync();
		await pass();

		expect(cfm.hits).toHaveLength(0);
		expect(releasedContent("sk", "sk")).toBeNull();
		expect(releasedFitment()).toBeNull();
		expect(inspectRelease().setting).toEqual({ kind: "off" });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("mode=off"));
	});

	it("refuses an address that is not https, and says so", async () => {
		process.env.MAKY_RELEASE_MANIFEST_URL = "http://cfm.example/media/fitment/releases/MANIFEST.json";

		startReleaseSync();
		await pass();

		expect(cfm.hits).toHaveLength(0);
		expect(inspectRelease().setting).toMatchObject({ kind: "invalid" });
		expect(error).toHaveBeenCalledWith(expect.stringContaining("not https"));
	});
});

// ── the poll loop ────────────────────────────────────────────────────────────

describe("the poll loop", () => {
	/** Only the timers: `setImmediate` is what the loader yields on between files, and it must stay real. */
	const fakeTimers = () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		vi.spyOn(Math, "random").mockReturnValue(0.5); // a jitter factor of exactly 1
	};

	it("starts in the background, once, and keeps asking at the poll interval", async () => {
		fakeTimers();
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });

		startReleaseSync();
		startReleaseSync(); // idempotent
		// Boot starts nothing itself and waits for nothing.
		expect(cfm.hits).toHaveLength(0);
		expect(releasedContent("sk", "sk")).toBeNull();

		await vi.advanceTimersByTimeAsync(0);
		await __settleReleaseSync();
		await tick();
		expect(cfm.count("MANIFEST.json")).toBe(1);
		expect(serving("sk", "sk")).toBe("sk/a/0");

		await vi.advanceTimersByTimeAsync(29_999);
		expect(cfm.count("MANIFEST.json")).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		await __settleReleaseSync();
		expect(cfm.count("MANIFEST.json")).toBe(2);
		expect(cfm.hits.at(-1)?.headers["if-none-match"]).toBeDefined();
	});

	it("honours the configured interval, within its limits", async () => {
		fakeTimers();
		process.env.MAKY_RELEASE_POLL_SECONDS = "5"; // below the floor of 10 s
		cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });

		startReleaseSync();
		await vi.advanceTimersByTimeAsync(0);
		await __settleReleaseSync();
		await tick();

		await vi.advanceTimersByTimeAsync(9_999);
		expect(cfm.count("MANIFEST.json")).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		await __settleReleaseSync();
		expect(cfm.count("MANIFEST.json")).toBe(2);
	});

	it("slows down while the manifest cannot be read, rather than asking at full pace", async () => {
		fakeTimers();
		cfm.override("MANIFEST.json", () => status(503));

		startReleaseSync();
		await vi.advanceTimersByTimeAsync(0);
		await __settleReleaseSync();
		await tick();
		expect(cfm.count("MANIFEST.json")).toBe(1);

		await vi.advanceTimersByTimeAsync(59_999); // one failure: twice the interval
		expect(cfm.count("MANIFEST.json")).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		await __settleReleaseSync();
		expect(cfm.count("MANIFEST.json")).toBe(2);
	});

	it("says at boot which source is in charge, without the query string, and warns about the older settings", () => {
		fakeTimers();
		process.env.MAKY_CATALOG_CONTENT_PATH = "/srv/catalog/maky_catalog_content_{lang}.json";
		process.env.MAKY_RELEASE_MANIFEST_URL = `${POINTER}?token=not-for-logs`;

		startReleaseSync();

		const line = log.mock.calls.map((call) => String(call[0])).find((text) => text.includes("mode=manifest"));
		expect(line).toContain("cfm.example/media/fitment/releases/MANIFEST.json");
		expect(line).toContain("poll=30s");
		expect(line).toContain("older-content-setting=path");
		expect(line).not.toContain("token");
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("The manifest wins"));
	});

	it("stays quiet about the older settings when there are none", () => {
		fakeTimers();

		startReleaseSync();

		expect(warn).not.toHaveBeenCalled();
		expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toContain("older-content-setting=none");
	});
});
