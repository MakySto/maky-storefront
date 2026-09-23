// No prerendered page may show the footer before its own content.
//
//   pnpm build && node scripts/checks/shell-outlining.mjs
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
// FAIL B  a boundary inside <main> is outlined with a segment id at or above the
//         `nextSegmentId` recorded in the postponed state. The request-time stream then
//         reuses that id, `$RC`/`$RS` grab the wrong element, and the page body can be
//         thrown away (HierarchyRequestError, React #419; seen on /sk/products). This is
//         a React bug, fixed upstream as "Finalize postponed nextSegmentId after the
//         prelude flush" — not in the React that Next 16.2 bundles.
// warn    the same id reuse on a boundary outside <main> (today: the header). It costs a
//         client re-render (#419) of whatever collides, not a layout shift, because the
//         header skeleton matches the header's height.
//
// A boundary whose content is only a script (the homepage JSON-LD) is ignored.
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const appDir = path.join(repoRoot, ".next/server/app");

if (!fs.existsSync(appDir)) {
	console.error("no prerendered pages at .next/server/app — run a build first");
	process.exit(2);
}

const shells = [];
(function walk(dir) {
	for (const name of fs.readdirSync(dir)) {
		const full = path.join(dir, name);
		if (fs.statSync(full).isDirectory()) walk(full);
		else if (name.endsWith(".html")) shells.push(full);
	}
})(appDir);

function postponedNextSegmentId(htmlPath) {
	const metaPath = htmlPath.replace(/\.html$/, ".meta");
	if (!fs.existsSync(metaPath)) return Infinity;
	const postponed = JSON.parse(fs.readFileSync(metaPath, "utf8")).postponed || "";
	const match = /"nextSegmentId":(\d+)/.exec(postponed);
	return match ? Number(match[1]) : Infinity;
}

let failures = 0;
let warnings = 0;
let checked = 0;

for (const shell of shells) {
	const html = fs.readFileSync(shell, "utf8");
	const rel = path.relative(appDir, shell);
	const main = html.indexOf('<main class="flex-1">');
	const footer = html.indexOf("<footer", main);
	if (main < 0 || footer < 0) continue;
	checked++;
	const nextSegmentId = postponedNextSegmentId(shell);

	for (const reveal of html.matchAll(/\$RC\("B:([0-9a-f]+)","S:([0-9a-f]+)"\)/g)) {
		const [, boundaryId, segmentId] = reveal;
		const template = `<template id="B:${boundaryId}"></template>`;
		const templateAt = html.indexOf(template);
		const segmentAt = html.indexOf(`<div hidden id="S:${segmentId}">`);
		if (templateAt < 0 || segmentAt < 0) continue;

		const content = html
			.slice(segmentAt, reveal.index)
			.replace(/^<div hidden[^>]*>/, "")
			.replace(/<script[\s\S]*?<\/script>/g, "");
		if (!/<(img|svg|section|div|p|h\d|ul|table|form|a)\b/.test(content)) continue;

		const inMain = templateAt > main && templateAt < footer;
		const reused = parseInt(boundaryId, 16) >= nextSegmentId;
		const emptyFallback = html.startsWith("<!--/$-->", templateAt + template.length);

		if (inMain && emptyFallback) {
			failures++;
			console.log(`FAIL A ${rel}: B:${boundaryId} is written after the footer with an empty fallback`);
		}
		if (inMain && reused) {
			failures++;
			console.log(
				`FAIL B ${rel}: B:${boundaryId} (page content) reuses an id from nextSegmentId ${nextSegmentId}`,
			);
		}
		if (!inMain && reused) {
			warnings++;
			console.log(
				`warn   ${rel}: B:${boundaryId} (outside <main>) reuses an id from nextSegmentId ${nextSegmentId}`,
			);
		}
	}
}

console.log(`${checked} shells checked: ${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures ? 1 : 0);
