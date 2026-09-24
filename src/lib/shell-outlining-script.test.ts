import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * `scripts/checks/shell-outlining.mjs` (`pnpm check:shells`) reads built shells, so these run
 * it against hand-written ones. Each shape below is taken from a real `.next/server/app` build:
 * React writes an outlined boundary as an empty `<template id="B:x">` where it belongs, the
 * content in `<div hidden id="S:x">` after the footer, and `$RC("B:x","S:x")` to move it in.
 * The postponed state in `.meta` is `<length>:<json>` followed by the serialized cache.
 */
const SCRIPT = join(__dirname, "../../scripts/checks/shell-outlining.mjs");

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Shell = { html: string; meta?: Record<string, unknown> };

function run(shells: Record<string, Shell>) {
	const dir = mkdtempSync(join(tmpdir(), "shells-"));
	dirs.push(dir);
	for (const [rel, { html, meta }] of Object.entries(shells)) {
		const file = join(dir, rel);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);
		if (meta) writeFileSync(file.replace(/\.html$/, ".meta"), JSON.stringify(meta));
	}
	const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8", timeout: 20_000 });
	return { code: r.status, out: r.stdout + r.stderr };
}

const postponed = (nextSegmentId: number) => {
	const state = `[1,{"nextSegmentId":${nextSegmentId},"rootFormatContext":{}}]`;
	return { postponed: `${state.length}:${state}{"store":{}}` };
};

const hole = (id: string) => `<!--$?--><template id="B:${id}"></template><!--/$-->`;
const reveal = (id: string, content: string, seg = id) =>
	`<div hidden id="S:${seg}">${content}</div><script>$RC("B:${id}","S:${seg}")</script>`;

/** A market page with an outlined header boundary (the shape every page had on 16.2.9). */
const page = ({ header = hole("a"), main = "<h1>Obsah</h1>", after = reveal("a", "<div>Účet</div>") } = {}) =>
	`<html><body><header>${header}</header><main class="flex-1">${main}</main><footer>f</footer>${after}</body></html>`;

describe("pnpm check:shells", () => {
	it("passes a market shell whose outlined ids are all below nextSegmentId", () => {
		const r = run({ "sk-eur.html": { html: page(), meta: postponed(12) } });
		expect(r.out).toContain("1 shells checked (1 market): 0 failure(s)");
		expect(r.code).toBe(0);
	});

	it("fails an id the resume will reuse, outside <main> as well as inside", () => {
		const header = run({ "sk-eur.html": { html: page(), meta: postponed(10) } });
		expect(header.code).toBe(1);
		expect(header.out).toContain(
			"FAIL B sk-eur.html: S:a (outside <main>) reuses an id from nextSegmentId 10",
		);

		const body = run({
			"sk-eur/products.html": {
				html: page({ header: "", main: `<p>x</p>${hole("a")}` }),
				meta: postponed(10),
			},
		});
		expect(body.out).toContain("FAIL B sk-eur/products.html: S:a (page content)");
	});

	it("fails page content written after the footer with an empty fallback", () => {
		const r = run({
			"sk-eur.html": {
				html: page({ header: "", main: hole("b"), after: reveal("b", "<section>Produkty</section>") }),
				meta: postponed(99),
			},
		});
		expect(r.code).toBe(1);
		expect(r.out).toContain("FAIL A sk-eur.html: B:b is written after the footer with an empty fallback");
	});

	it("fails two boundaries that share an id", () => {
		const r = run({
			"sk-eur.html": { html: page({ main: hole("a") }), meta: postponed(99) },
		});
		expect(r.out).toContain("FAIL C sk-eur.html: 2 templates share the id a");
	});

	it("fails every format it cannot read instead of passing it", () => {
		const cases: Record<string, Shell> = {
			"sk-eur/unknown-call.html": {
				html: page({ after: `<div hidden id="S:a"><div>x</div></div><script>$RX("B:a","S:a")</script>` }),
				meta: postponed(99),
			},
			"sk-eur/mismatch.html": {
				html: page({ after: reveal("a", "<div>x</div>", "c") }),
				meta: postponed(99),
			},
			"sk-eur/no-template.html": { html: page({ header: "" }), meta: postponed(99) },
			"sk-eur/no-layout.html": { html: "<html><body><div>x</div></body></html>", meta: postponed(99) },
			"sk-eur/unprefixed-state.html": {
				html: page(),
				meta: { postponed: '[1,{"nextSegmentId":12}]' },
			},
			"sk-eur/no-segment-id.html": { html: page(), meta: { postponed: '6:[1,{}]{"store":{}}' } },
		};
		const r = run(cases);
		expect(r.code).toBe(1);
		expect(r.out).toContain('FAIL U sk-eur/unknown-call.html: unrecognised reveal instruction $RX("B:a"');
		expect(r.out).toContain("FAIL U sk-eur/mismatch.html: B:a is revealed from S:c");
		expect(r.out).toContain('FAIL U sk-eur/no-template.html: $RC("B:a","S:a") without its template');
		expect(r.out).toContain("FAIL U sk-eur/no-layout.html: market shell without the");
		expect(r.out).toContain(
			"FAIL U sk-eur/unprefixed-state.html: postponed state without a readable nextSegmentId",
		);
		expect(r.out).toContain(
			"FAIL U sk-eur/no-segment-id.html: postponed state without a readable nextSegmentId",
		);
	});

	it("accepts a redirect shell with no postponed state and no layout", () => {
		const r = run({
			"sk-eur.html": { html: page(), meta: postponed(12) },
			"sk-eur/orders.html": {
				html: "<html><body></body></html>",
				meta: { status: "307", postponed: '4:nulleJzt{"store":{}}' },
			},
		});
		expect(r.out).toContain("2 shells checked (2 market): 0 failure(s)");
		expect(r.code).toBe(0);
	});

	it("accepts route shells without the market layout, but still checks their ids", () => {
		const ok = run({
			"sk-eur.html": { html: page(), meta: postponed(12) },
			"[channel]/cart.html": { html: "<html><body><div>shell</div></body></html>", meta: postponed(0) },
			"checkout.html": {
				html: `<html><body>${hole("0")}${reveal("0", "<div>x</div>")}</body></html>`,
				meta: postponed(1),
			},
		});
		expect(ok.out).toContain("3 shells checked (1 market): 0 failure(s)");
		expect(ok.code).toBe(0);

		const reused = run({
			"sk-eur.html": { html: page(), meta: postponed(12) },
			"checkout.html": {
				html: `<html><body>${hole("0")}${reveal("0", "<div>x</div>")}</body></html>`,
				meta: postponed(0),
			},
		});
		expect(reused.out).toContain(
			"FAIL B checkout.html: S:0 (outside <main>) reuses an id from nextSegmentId 0",
		);
	});

	it("fails when there is nothing to check", () => {
		const none = run({});
		expect(none.code).toBe(1);
		expect(none.out).toContain("FAIL U 0 shells, 0 of them market shells: nothing was checked");

		const noMarket = run({ "_not-found.html": { html: "<html><body></body></html>" } });
		expect(noMarket.code).toBe(1);
		expect(noMarket.out).toContain("FAIL U 1 shells, 0 of them market shells");
	});
});
