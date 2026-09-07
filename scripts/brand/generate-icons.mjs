#!/usr/bin/env node
/**
 * Generates the whole favicon / app-icon set from `public/logo-deer.webp`.
 *
 * ## Why this script is in the tree
 *
 * Every icon this repo shipped until 2026-09-07 was Paper's — the Next.js template
 * MAKY.STORE was forked from. Nine files, plus a `site.webmanifest` that named the
 * installed app "Paper". Nobody chose that; it was simply never replaced. Keeping the
 * generator next to the output means the next person can re-cut the set from the
 * artwork instead of hand-editing PNGs, and can see exactly which source produced
 * which file.
 *
 * ## The two families
 *
 * - **Tab icons** (`favicon*.png`, `icon.png`, `favicon.ico`) — the deer alone on
 *   transparency, matching the header lockup. The `-dark-` variants are the same
 *   silhouette in copper-300 so it survives a dark browser chrome; the light ones
 *   keep the artwork's own copper.
 * - **Installed-app icons** (`apple-icon.png`, `android-chrome-*.png`) — a filled
 *   copper tile with a sand deer. iOS and Android composite transparent icons on
 *   backgrounds we do not control (black, most of the time), so these carry their
 *   own ground. CLAUDE.md §4 makes brown the brand colour; this is the one place it
 *   is used as a full field.
 *
 * Run: `node scripts/brand/generate-icons.mjs`
 */
import { writeFile } from "node:fs/promises";
import { deer, COPPER_600, COPPER_300, SAND_50 } from "./deer.mjs";

/**
 * A real .ico. The one this repo shipped was a PNG with an .ico extension — browsers
 * tolerate it, but `file(1)` disagreeing with the extension is the kind of small lie
 * that costs an hour later. ICO has allowed PNG-compressed entries since Vista, so the
 * container is a 6-byte header plus one 16-byte directory entry per image.
 */
function ico(images) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(images.length, 4);

	let offset = 6 + images.length * 16;
	const entries = [];
	for (const { size, data } of images) {
		const e = Buffer.alloc(16);
		e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
		e.writeUInt8(size >= 256 ? 0 : size, 1);
		e.writeUInt8(0, 2); // palette
		e.writeUInt8(0, 3); // reserved
		e.writeUInt16LE(1, 4); // colour planes
		e.writeUInt16LE(32, 6); // bits per pixel
		e.writeUInt32LE(data.length, 8);
		e.writeUInt32LE(offset, 12);
		offset += data.length;
		entries.push(e);
	}
	return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const written = [];
async function emit(path, data) {
	await writeFile(path, data);
	written.push(`${path}  ${data.length.toLocaleString("en-US")} B`);
}

const tab = (size) => deer({ size, colour: COPPER_600 });
const tabDark = (size) => deer({ size, colour: COPPER_300 });
const tile = (size, padding = 0.16) => deer({ size, colour: SAND_50, background: COPPER_600, padding });

await emit("public/favicon-16x16.png", await tab(16));
await emit("public/favicon-32x32.png", await tab(32));
await emit("public/favicon-dark-16x16.png", await tabDark(16));
await emit("public/favicon-dark-32x32.png", await tabDark(32));
await emit("src/app/icon.png", await tab(32));
await emit("src/app/apple-icon.png", await tile(180));
await emit("public/android-chrome-192x192.png", await tile(192));
await emit("public/android-chrome-512x512.png", await tile(512));
// Maskable: Android crops adaptive icons to a shape it chooses, so the mark has to
// sit inside the 40%-radius safe zone. Same tile, more air, declared separately in
// the manifest — a single icon cannot be both without losing the antlers to the crop.
await emit("public/android-chrome-maskable-512x512.png", await tile(512, 0.26));
await emit(
	"src/app/favicon.ico",
	ico([
		{ size: 16, data: await tab(16) },
		{ size: 32, data: await tab(32) },
		{ size: 48, data: await tab(48) },
	]),
);

console.log(written.join("\n"));
