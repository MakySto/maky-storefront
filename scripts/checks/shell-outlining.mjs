// No prerendered page may show the footer before its own content, and no shell may hand the
// request-time stream an id it already used.
//
//   pnpm build && node scripts/checks/shell-outlining.mjs [appDir]
//
// Why this exists: React 19.2 does not write a finished Suspense boundary in place when
// that would take the flush past 12 800 bytes; it "outlines" it — an empty <template>
// where it belongs, the content after the footer, and a `$RC` script that moves it in,
// no sooner than 300 ms after the first frame once one has been painted. The market
// layout wrapped every page in such a boundary with a null fallback, so on 16 of the
// Slovak shells the first frame could be the header with the footer right under it:
// CLS 0.609 on a product page in PageSpeed Insights, 0.871 on /sk. `next build`, the
// test suite and every HTTP check were green the whole time. Only the built shells show
// it, so this reads them.
//
// FAIL A  a boundary inside <main> is outlined and its fallback is empty.
// FAIL B  an outlined boundary — anywhere on the page — has a segment id at or above the
//         `nextSegmentId` recorded in the postponed state. The request-time stream then
//         reuses that id, `$RC`/`$RS` grab the wrong element, and whatever collides is
//         thrown away or re-rendered on the client (HierarchyRequestError, React #419; the
//         page body on /sk/products, the header everywhere else). React bug, fixed upstream
//         as "Finalize postponed nextSegmentId after the prelude flush"; Next 16.2 bundles
//         a React without it, Next 16.3.6 one with it. Since 16.3.6 this is a failure outside
//         <main> too: there is no known collision left to tolerate.
// FAIL C  two boundaries or two segments in one shell carry the same id.
// FAIL U  anything this script cannot read with certainty: no shells at all, a market
//         shell without the `<main class="flex-1">` … `<footer` layout, a reveal instruction
//         other than `$RC("B:x","S:x")`, a reveal whose template or segment is missing, a
//         boundary id that differs from its segment id, or a postponed state whose
//         `nextSegmentId` cannot be found. Silence here would read as "0 failures" on a
//         React that changed the format, which is how the original bug stayed invisible.
//
// A boundary whose content is only a script (the homepage JSON-LD) is not a layout
// problem for A, but still counts for B and C.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = '<main class="flex-1">';
/** A shell of one concrete market channel (`sk-eur.html`, `sk-eur/...`), not `[channel]`. */
const MARKET_SHELL = /^[a-z]{2}-[a-z]{3}(\.html$|\/)/;
const ANY_REVEAL_CALL = /\$R[A-Z]{1,3}\(/g;
const RC_CALL = /^\$RC\("B:([0-9a-f]+)","S:([0-9a-f]+)"\)/;

/**
 * The postponed state is written as `<length>:<json>` followed by the serialized cache.
 * `null` (a redirect, a fully static route) means there is no resume and nothing to collide
 * with. Returns a number, Infinity for "no resume", or null when the format is unknown.
 */
export function postponedNextSegmentId(meta) {
	if (!meta || meta.postponed == null || meta.postponed === "") return Infinity;
	const postponed = String(meta.postponed);
	const head = /^(\d+):/.exec(postponed);
	if (!head) return null;
	const state = postponed.slice(head[0].length, head[0].length + Number(head[1]));
	if (state === "null") return Infinity;
	const match = /"nextSegmentId":(\d+)/.exec(state);
	return match ? Number(match[1]) : null;
}

/** Every finding for one shell: `{ code, message }`. Pure, so it can be tested on fixtures. */
export function inspectShell({ rel, html, meta }) {
	const findings = [];
	const fail = (code, message) => findings.push({ code, message: `FAIL ${code} ${rel}: ${message}` });

	const redirect = meta && /^3\d\d$/.test(String(meta.status ?? ""));
	const main = html.indexOf(MAIN);
	const footer = main < 0 ? -1 : html.indexOf("<footer", main);
	const hasLayout = main >= 0 && footer >= 0;
	if (MARKET_SHELL.test(rel) && !redirect && !hasLayout) {
		fail("U", `market shell without the ${MAIN} … <footer layout`);
	}
	if (main >= 0 && footer < 0) fail("U", `${MAIN} without a <footer> after it`);

	const nextSegmentId = postponedNextSegmentId(meta);
	if (nextSegmentId === null) fail("U", "postponed state without a readable nextSegmentId");

	const seen = { template: new Map(), segment: new Map() };
	for (const m of html.matchAll(/<template id="B:([0-9a-f]+)"/g)) {
		seen.template.set(m[1], (seen.template.get(m[1]) ?? 0) + 1);
	}
	for (const m of html.matchAll(/<div hidden id="S:([0-9a-f]+)"/g)) {
		seen.segment.set(m[1], (seen.segment.get(m[1]) ?? 0) + 1);
	}
	for (const [kind, ids] of Object.entries(seen)) {
		for (const [id, n] of ids) if (n > 1) fail("C", `${n} ${kind}s share the id ${id}`);
	}

	for (const call of html.matchAll(ANY_REVEAL_CALL)) {
		const rc = RC_CALL.exec(html.slice(call.index, call.index + 64));
		if (!rc) {
			fail("U", `unrecognised reveal instruction ${html.slice(call.index, call.index + 24)}…`);
			continue;
		}
		const [text, boundaryId, segmentId] = rc;
		if (boundaryId !== segmentId) {
			fail("U", `B:${boundaryId} is revealed from S:${segmentId}; this script assumes one id for both`);
		}
		const template = `<template id="B:${boundaryId}"></template>`;
		const templateAt = html.indexOf(template);
		const segmentAt = html.indexOf(`<div hidden id="S:${segmentId}">`);
		if (templateAt < 0 || segmentAt < 0) {
			fail("U", `${text} without its ${templateAt < 0 ? "template" : "segment"}`);
			continue;
		}

		const inMain = hasLayout && templateAt > main && templateAt < footer;
		const content = html
			.slice(segmentAt, call.index)
			.replace(/^<div hidden[^>]*>/, "")
			.replace(/<script[\s\S]*?<\/script>/g, "");
		const visible = /<(img|svg|section|div|p|h\d|ul|table|form|a)\b/.test(content);
		const emptyFallback = html.startsWith("<!--/$-->", templateAt + template.length);

		if (inMain && visible && emptyFallback) {
			fail("A", `B:${boundaryId} is written after the footer with an empty fallback`);
		}
		if (parseInt(segmentId, 16) >= nextSegmentId) {
			fail(
				"B",
				`S:${segmentId} (${
					inMain ? "page content" : "outside <main>"
				}) reuses an id from nextSegmentId ${nextSegmentId}`,
			);
		}
	}
	return findings;
}

function listShells(appDir) {
	const shells = [];
	(function walk(dir) {
		for (const name of fs.readdirSync(dir)) {
			const full = path.join(dir, name);
			if (fs.statSync(full).isDirectory()) walk(full);
			else if (name.endsWith(".html")) shells.push(full);
		}
	})(appDir);
	return shells.sort();
}

function readMeta(htmlPath) {
	const metaPath = htmlPath.replace(/\.html$/, ".meta");
	return fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
}

function main() {
	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
	const appDir = path.resolve(process.argv[2] || path.join(repoRoot, ".next/server/app"));
	if (!fs.existsSync(appDir)) {
		console.error(`no prerendered pages at ${appDir} — run a build first`);
		process.exit(2);
	}

	const shells = listShells(appDir);
	let failures = 0;
	let market = 0;
	for (const shell of shells) {
		const rel = path.relative(appDir, shell);
		if (MARKET_SHELL.test(rel)) market++;
		for (const f of inspectShell({ rel, html: fs.readFileSync(shell, "utf8"), meta: readMeta(shell) })) {
			failures++;
			console.log(f.message);
		}
	}
	if (shells.length === 0 || market === 0) {
		failures++;
		console.log(`FAIL U ${shells.length} shells, ${market} of them market shells: nothing was checked`);
	}
	console.log(`${shells.length} shells checked (${market} market): ${failures} failure(s)`);
	process.exit(failures ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
