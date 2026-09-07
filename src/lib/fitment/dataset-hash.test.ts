import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalJson, datasetHashFromText, datasetHashFromValue, transportChecksum } from "./dataset-hash";

/**
 * The hash is a BILATERAL contract: CFM computes it in Python, we recompute it in
 * JavaScript, and the whole point collapses the moment the two disagree. So the golden
 * case below is not a self-consistency check — the expected string and digest were
 * produced by running CPython
 *
 *     json.dumps(doc, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
 *
 * over exactly this document, and pasting the result. If a change here makes this test
 * fail, this side is wrong, not the test.
 *
 * The document is deliberately nasty in the four ways that separate a correct
 * implementation from one that merely looks correct: a whole-valued float, a genuine
 * float, non-ASCII including an astral character, and control characters in a string.
 */
const GOLDEN_TEXT =
	'{"datasetHash":"IGNORED","generatedAt":"2026-01-01T00:00:00Z","zebra":1,"Alfa":"Škoda Octavia",' +
	'"confidence":1.0,"stale":30.5,"nested":{"b":[1.0,2,3.25],"a":null},"uni":"ěščřž — 車 🚗","ctl":"a\\nb\\tc"}';

const GOLDEN_CANONICAL =
	'{"Alfa":"Škoda Octavia","confidence":1.0,"ctl":"a\\nb\\tc","nested":{"a":null,"b":[1.0,2,3.25]},' +
	'"stale":30.5,"uni":"ěščřž — 車 🚗","zebra":1}';

const GOLDEN_SHA256 = "1ce42fc1c5236e64ea0f0c3ced9179bf48c54351160ce2ce6dfa3fd575f924cb";

describe("the canonical form CFM and this build must agree on", () => {
	it("reproduces Python's json.dumps byte for byte", () => {
		const parsed = JSON.parse(GOLDEN_TEXT) as Record<string, unknown>;
		delete parsed.datasetHash;
		delete parsed.generatedAt;
		// Value path: correct in every respect except the whole-valued floats, which is
		// exactly what the next test is about.
		expect(canonicalJson(parsed)).toBe(GOLDEN_CANONICAL.replaceAll("1.0", "1"));
	});

	it("matches Python's digest when the numbers are read from the source text", () => {
		expect(datasetHashFromText(GOLDEN_TEXT)).toBe(GOLDEN_SHA256);
	});

	it("would NOT match if numbers were re-serialised by JSON.stringify", () => {
		// The trap, pinned so nobody 'simplifies' the source-preserving parse away.
		// Python writes `1.0`; JSON.stringify writes `1`. The 3.0.0 schema has two
		// non-integer number fields, and `evidence.confidence: 1.0` is an entirely
		// ordinary value — so this divergence would be met on a real payload, not in
		// a thought experiment.
		expect(datasetHashFromValue(JSON.parse(GOLDEN_TEXT))).not.toBe(GOLDEN_SHA256);
	});

	it("excludes datasetHash AND generatedAt, so a rebuild of unchanged data hashes the same", () => {
		const a = '{"datasetHash":"aaa","generatedAt":"2026-01-01T00:00:00Z","x":1}';
		const b = '{"datasetHash":"bbb","generatedAt":"2027-06-30T23:59:59Z","x":1}';
		expect(datasetHashFromText(a)).toBe(datasetHashFromText(b));
	});

	it("excludes them only at the TOP level", () => {
		const nested = '{"datasetHash":"a","generatedAt":"t","meta":{"generatedAt":"kept"}}';
		expect(canonicalJson(JSON.parse('{"meta":{"generatedAt":"kept"}}'))).toContain("kept");
		expect(datasetHashFromText(nested)).not.toBe(
			datasetHashFromText('{"datasetHash":"a","generatedAt":"t"}'),
		);
	});

	it("sorts keys by code point, the way Python does, not by UTF-16 code unit", () => {
		// "￿" is one UTF-16 unit; "🚗" is a surrogate pair starting at \uD83D. A
		// default JS sort puts the pair FIRST because 0xD83D < 0xFFFF; Python puts it
		// last because U+1F697 > U+FFFF. Same bug class as sorting bytes as if signed.
		expect(canonicalJson({ "￿": 1, "🚗": 2 })).toBe('{"￿":1,"🚗":2}');
	});

	it("refuses a non-finite number rather than hashing something neither side can parse", () => {
		expect(() => canonicalJson({ x: Number.NaN })).toThrow();
	});
});

describe("the two hashes are different numbers and are never interchangeable", () => {
	it("separates the semantic hash from the transport checksum", () => {
		const text = '{"datasetHash":"x","generatedAt":"t","a":1}';
		const semantic = datasetHashFromText(text);
		const transport = transportChecksum(text);
		expect(semantic).not.toBe(transport);
		// Whitespace changes the bytes but not the meaning: the transport checksum moves,
		// the semantic hash does not.
		const spaced = '{"datasetHash":"x", "generatedAt":"t", "a":1}';
		expect(datasetHashFromText(spaced)).toBe(semantic);
		expect(transportChecksum(spaced)).not.toBe(transport);
	});
});

describe("the committed fixtures", () => {
	// `provider.ts` imports these as JSON modules, so their hash is taken over the parsed
	// value and there is no source text to preserve. That is only safe while they contain
	// no whole-valued float. This asserts it, rather than assuming it — the demo fixture
	// DOES contain `139.0` prices, which is precisely why it may not carry a real hash.
	//
	// The two-application excerpt this used to guard is gone: it existed only because the
	// full pilot was not available, and it carried bca2997617ae0cf9…, the hash of the
	// 77-product pilot it was cut from, under that pilot's own datasetVersion. The real
	// pilot is now committed and checked in `pilot-conformance.test.ts`, hashes and all.
	it("the delivered pilot hashes identically by value and by text", () => {
		const text = readFileSync("src/lib/fitment/fixtures/pilot-3.0.0-20260906.2.json", "utf8");
		expect(datasetHashFromValue(JSON.parse(text))).toBe(datasetHashFromText(text));
	});

	it("the delivered pilot's declared hash is the one recomputed from it", () => {
		const text = readFileSync("src/lib/fitment/fixtures/pilot-3.0.0-20260906.2.json", "utf8");
		const declared = (JSON.parse(text) as { datasetHash: string }).datasetHash;
		expect(declared).toBe(datasetHashFromText(text));
		// Two documents claiming one identity is the failure this whole gate exists to
		// catch, and the superseded pilot is the document that must never come back.
		expect(declared).not.toBe("bca2997617ae0cf9a594fae8bf6539a504069e66ac4a310761d91519e34ee5e4");
	});
});
