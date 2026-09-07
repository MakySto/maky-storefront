/**
 * The MAKY deer mark, recoloured on demand.
 *
 * `public/logo-deer.webp` is a single flat colour with an alpha channel, and it is
 * already the mark in the site header. Everything brand-shaped this repo generates —
 * favicons, app icons, the share card — is that same alpha, filled with a token colour.
 * Sharing the primitive is what keeps them from drifting apart.
 */
import sharp from "sharp";

export const SRC = "public/logo-deer.webp";

// sRGB of the OKLCH primitives in src/styles/brand.css. Hard-coded rather than parsed:
// these four are the only ones the brand assets use, and a CSS parse would be a lot of
// machinery to keep four numbers honest. If brand.css moves, these move with it.
export const COPPER_600 = { r: 0x8e, g: 0x5c, b: 0x30 }; // oklch(0.52 0.088 60) — brand
export const COPPER_300 = { r: 0xda, g: 0xb1, b: 0x91 }; // oklch(0.79 0.065 60) — on dark
export const SAND_50 = { r: 0xfe, g: 0xfc, b: 0xf9 }; // oklch(0.992 0.004 85) — surface
export const GRAY_900 = { r: 0x1e, g: 0x1a, b: 0x17 }; // oklch(0.220 0.010 60) — text

/**
 * The artwork's alpha, trimmed to the ink, scaled to `size` minus `padding`, then
 * EXTENDED back out to `size`. Extend, not a second `resize` — `resize` on an image
 * that is already square scales it back up and silently eats the padding, which is
 * how the first cut of the icon set came out with the antlers touching the tile edge.
 */
export async function silhouette(size, padding = 0) {
	const inner = Math.max(1, Math.round(size * (1 - padding * 2)));
	const border = size - inner;
	const left = Math.floor(border / 2);
	const top = Math.floor(border / 2);

	return sharp(SRC)
		.ensureAlpha()
		.trim({ threshold: 1 })
		.resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.extend({
			top,
			left,
			bottom: border - top,
			right: border - left,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.extractChannel("alpha")
		.toBuffer();
}

/** Flat `colour`, cut out by the artwork's alpha, on `background` (transparent if null). */
export async function deer({ size, colour, background = null, padding = 0.04 }) {
	const mask = await silhouette(size, padding);
	const ink = await sharp({
		create: { width: size, height: size, channels: 3, background: colour },
	})
		.joinChannel(mask)
		.png()
		.toBuffer();

	if (!background) return ink;

	return sharp({ create: { width: size, height: size, channels: 4, background } })
		.composite([{ input: ink }])
		.png()
		.toBuffer();
}

export const rgb = ({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
