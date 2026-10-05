/**
 * The video of a product page, by its identifier.
 *
 * A description names a video (`maky:video`, an Editor.js `embed` block, `docs/contracts/maky-content.md`)
 * and the page decides everything else: the host it is played from, the address of the player and
 * when anything is loaded. Nothing a document says is ever used as an address. The identifier is read
 * out of the watch address with a pattern that accepts only what YouTube issues (eleven characters of
 * a fixed alphabet), and every address is built here, on a fixed host.
 *
 * The server draws a link (`renderRole`), the browser turns it into the player on the click
 * (`VideoClickToPlay`); both read the identifier through this one function, so what the server
 * accepted is exactly what the browser will open.
 *
 * The preview carries the still YouTube keeps of the video. A shopper's browser never asks YouTube
 * or Google for it: it asks this site's own image optimizer (`videoPosterSrc`), which fetches the
 * still itself. So nothing of YouTube reaches the shopper before the click, as before.
 */

const WATCH = /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/;
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The host YouTube serves its stills from. `next.config.js` lets the image optimizer fetch exactly
 * `/vi/<identifier>/hqdefault.jpg` from it and nothing else (`next-image-allowlist.test.ts`).
 */
export const YOUTUBE_STILL_HOST = "i.ytimg.com";

/** The width and quality the preview asks the optimizer for: a `deviceSizes` entry and the one `qualities` entry. */
export const POSTER_WIDTH = 640;
export const POSTER_QUALITY = 75;

/** The watch page of a video: where the link goes without a script, and what the document names. */
export const youtubeWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** The embed address Editor.js writes beside the watch address. A record in the document, never opened. */
export const youtubeEmbedUrl = (id: string): string => `https://www.youtube.com/embed/${id}`;

/**
 * The identifier of a `youtube.com` watch address, or null for anything else: another host, a
 * scheme other than https, a missing or longer identifier, a second parameter, a fragment, a
 * trailing character. The address has to be exactly the form `youtubeWatchUrl` writes.
 */
export function youtubeIdFromWatchUrl(value: unknown): string | null {
	const found = typeof value === "string" ? WATCH.exec(value) : null;
	return found ? found[1] : null;
}

/**
 * The player a shopper opens: YouTube's privacy-enhanced host, started by the click that asked for it.
 * Throws for anything that is not an identifier, so an address can only be made from one.
 */
export function youtubePlayerUrl(id: string): string {
	if (!ID.test(id)) throw new Error("not a YouTube video identifier");
	return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}

/**
 * The still YouTube keeps of a video: `hqdefault.jpg`, 480 × 360, the one size every video has. For
 * a 16:9 film YouTube sets the picture in black bars above and below it; the preview crops exactly
 * those off (`object-fit: cover` in a 16:9 box). Throws for anything that is not an identifier.
 */
export function youtubeStillUrl(id: string): string {
	if (!ID.test(id)) throw new Error("not a YouTube video identifier");
	return `https://${YOUTUBE_STILL_HOST}/vi/${id}/hqdefault.jpg`;
}

/**
 * What the shopper's browser is given for the preview's picture: this site's image optimizer
 * (`/_next/image`), asked for the still. The optimizer fetches it from YouTube on the server, so the
 * shopper's address and browser never reach YouTube before the click. If the optimizer cannot get the
 * still, the picture does not draw and the preview stays what it is without one: the shop's own
 * card, still a link to the film.
 */
export function videoPosterSrc(id: string): string {
	return `/_next/image?url=${encodeURIComponent(youtubeStillUrl(id))}&w=${POSTER_WIDTH}&q=${POSTER_QUALITY}`;
}
