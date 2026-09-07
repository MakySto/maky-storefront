#!/usr/bin/env node
/**
 * Generates the social share card: `src/app/opengraph-image.png` and its identical
 * twin `src/app/twitter-image.png`.
 *
 * ## Why this script is in the tree
 *
 * Until 2026-09-07 both files were Saleor's demo art — a 1200×630 card reading
 * "Acme Storefront · Storefront example powered by Saleor", with a mock shop selling
 * sneakers and hoodies. They shipped with the fork and nobody looked, because nothing
 * on the site itself renders them: they are only ever seen in someone else's feed.
 * Every share of maky.store on Facebook, Messenger, WhatsApp or Slack showed that card.
 *
 * ## Type
 *
 * The card is set in Geist, the same face the site loads, taken from the TTFs the
 * `geist` package already ships. librsvg finds fonts through fontconfig and nothing
 * else — no `@font-face`, no data URI — so the script writes a throwaway fontconfig
 * that points at that directory and only then loads sharp. The import is dynamic for
 * that reason: a static import is hoisted above the assignment and libvips would come
 * up with the system font set already resolved.
 *
 * Run: `node scripts/brand/generate-og-image.mjs`
 */
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";

// `geist` publishes an `exports` map that covers only ./font/*, so the package root
// and the TTFs under dist/ are both unreachable by specifier. Resolving the one entry
// point that IS exported and walking back up to the package root is the supported way
// in — dist/sans.js sits directly in dist/, next to fonts/.
const require = createRequire(import.meta.url);
const geistSansDir = join(dirname(require.resolve("geist/font/sans")), "fonts/geist-sans");

const fontDir = await mkdtemp(join(tmpdir(), "maky-fonts-"));
await writeFile(
	join(fontDir, "fonts.conf"),
	`<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${geistSansDir}</dir>
  <cachedir>${fontDir}/cache</cachedir>
  <include ignore_missing="yes">/etc/fonts/conf.d</include>
</fontconfig>
`,
);
process.env.FONTCONFIG_FILE = join(fontDir, "fonts.conf");

const { deer, COPPER_600, SAND_50, GRAY_900, rgb } = await import("./deer.mjs");
const { default: sharp } = await import("sharp");

const W = 1200;
const H = 630;
const MARGIN = 88;
const MARK = 124;
const BAND = 16;

const GRAY_600 = { r: 0x6b, g: 0x65, b: 0x60 }; // oklch(0.470 0.008 60) — --text-secondary

/**
 * Two lines, not one: at 70px the full sentence is wider than the card, and a share
 * card that wraps at render time wraps differently in every scaler. The break is
 * chosen here so it is the same everywhere.
 */
const HEADLINE = ["Strešné nosiče, boxy", "a nosiče bicyklov"];
const SUBLINE = "Kompletné zostavy pre vaše auto — tyče, pätky aj montážny kit.";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${rgb(SAND_50)}"/>
  <rect x="0" y="${H - BAND}" width="${W}" height="${BAND}" fill="${rgb(COPPER_600)}"/>
  <g font-family="Geist">
    <text x="${MARGIN + MARK + 36}" y="172" font-size="56" font-weight="700"
          letter-spacing="-1" fill="${rgb(COPPER_600)}">MAKY.STORE</text>
    <text x="${MARGIN}" y="356" font-size="70" font-weight="700"
          letter-spacing="-2" fill="${rgb(GRAY_900)}">${HEADLINE[0]}</text>
    <text x="${MARGIN}" y="440" font-size="70" font-weight="700"
          letter-spacing="-2" fill="${rgb(GRAY_900)}">${HEADLINE[1]}</text>
    <text x="${MARGIN}" y="522" font-size="30" font-weight="400"
          fill="${rgb(GRAY_600)}">${SUBLINE}</text>
  </g>
</svg>`;

const card = await sharp(Buffer.from(svg))
	.composite([{ input: await deer({ size: MARK, colour: COPPER_600, padding: 0 }), left: MARGIN, top: 80 }])
	.png()
	.toBuffer();

for (const path of ["src/app/opengraph-image.png", "src/app/twitter-image.png"]) {
	await writeFile(path, card);
	console.log(`${path}  ${card.length.toLocaleString("en-US")} B`);
}
