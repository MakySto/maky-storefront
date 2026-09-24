// Every favicon and app icon of MAKY.STORE, rendered from the two vector deer marks.
//
//   node scripts/brand/make-icons.mjs
//
// The brown deer sits on an OPAQUE white square: a transparent icon inherits the tab strip's
// colour, and the thin brown outline all but vanished on a dark one. Small sizes get heavier
// strokes rather than a scaled-down large mark — at 16 px the full mark's 2.9-unit stroke is
// 0.7 of a device pixel and blurs into a brown smudge:
//
//   16 px          compact mark, stroke 6.8, no eyes or nose (sub-pixel noise at that size)
//   32, 48 px      compact mark (deer-compact.svg, stroke 4.73, two prongs a side)
//   96 px and up   full mark (deer-full.svg, stroke 2.9, three prongs a side)
//
// Colour: copper-600, the MAKY.STORE wordmark's brown (oklch(0.52 0.088 60) = #8e5c30).
// A hex value is fine here: these are raster files, not components (CLAUDE.md §4 covers
// components).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BROWN = "#8e5c30";
const WHITE = "#ffffff";

const markBody = (file) =>
	fs
		.readFileSync(path.join(HERE, file), "utf8")
		.replace(/^[\s\S]*?<svg[^>]*>/, "")
		.replace(/<\/svg>\s*$/, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replaceAll("currentColor", BROWN);

const tile = (body, scale) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${WHITE}"/>` +
	`<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${body}</g></svg>`;

/** The 16 px variant: the compact mark's three strokes, heavier, without eyes and nose. */
function tinyBody() {
	const paths = [
		...fs.readFileSync(path.join(HERE, "deer-compact.svg"), "utf8").matchAll(/<path d="([^"]+)"\s*\/>/g),
	]
		.map((m) => `<path d="${m[1]}"/>`)
		.slice(0, 3)
		.join("");
	return `<g stroke="${BROWN}" stroke-width="6.8" stroke-linecap="round" stroke-linejoin="round" fill="none"><g>${paths}</g><g transform="matrix(-1 0 0 1 64 0)">${paths}</g></g>`;
}

const FULL = markBody("deer-full.svg");
const COMPACT = markBody("deer-compact.svg");
const TINY = tinyBody();

/** Opaque RGBA PNG: every pixel's alpha is 255. */
const png = (svg, px) =>
	sharp(Buffer.from(svg), { density: 72 * 16 })
		.resize(px, px, { kernel: "lanczos3" })
		.flatten({ background: WHITE })
		.ensureAlpha(1)
		.png({ compressionLevel: 9 })
		.toBuffer();

/** A .ico holding PNG frames (supported by every current browser and by Windows since Vista). */
function ico(frames) {
	const header = Buffer.alloc(6 + 16 * frames.length);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(frames.length, 4);
	let offset = header.length;
	frames.forEach(({ px, data }, i) => {
		const e = 6 + 16 * i;
		header.writeUInt8(px >= 256 ? 0 : px, e);
		header.writeUInt8(px >= 256 ? 0 : px, e + 1);
		header.writeUInt8(0, e + 2);
		header.writeUInt8(0, e + 3);
		header.writeUInt16LE(1, e + 4);
		header.writeUInt16LE(32, e + 6);
		header.writeUInt32LE(data.length, e + 8);
		header.writeUInt32LE(offset, e + 12);
		offset += data.length;
	});
	return Buffer.concat([header, ...frames.map((f) => f.data)]);
}

const outputs = [
	// [file, body, scale, px]
	["public/favicon-16x16.png", TINY, 0.9, 16],
	["public/favicon-32x32.png", COMPACT, 0.92, 32],
	// The light/dark pair is no longer needed (an opaque tile reads on both), but cached pages
	// and bookmarks may still ask for these two names.
	["public/favicon-dark-16x16.png", TINY, 0.9, 16],
	["public/favicon-dark-32x32.png", COMPACT, 0.92, 32],
	["src/app/icon.png", FULL, 0.86, 96],
	["src/app/apple-icon.png", FULL, 0.76, 180],
	["public/android-chrome-192x192.png", FULL, 0.8, 192],
	["public/android-chrome-512x512.png", FULL, 0.8, 512],
	// Maskable: the launcher may crop to a circle of 80 % of the side; the deer's bounding box
	// (61 units square, 86 on the diagonal) has to fit inside it, hence 0.58.
	["public/android-chrome-maskable-512x512.png", FULL, 0.58, 512],
];

for (const [file, body, scale, px] of outputs) {
	fs.writeFileSync(path.join(ROOT, file), await png(tile(body, scale), px));
	console.log(`${file.padEnd(46)} ${px}px`);
}

const frames = [];
for (const [body, scale, px] of [
	[TINY, 0.9, 16],
	[COMPACT, 0.92, 32],
	[COMPACT, 0.92, 48],
]) {
	frames.push({ px, data: await png(tile(body, scale), px) });
}
fs.writeFileSync(path.join(ROOT, "src/app/favicon.ico"), ico(frames));
console.log("src/app/favicon.ico".padEnd(46), "16, 32, 48px");
