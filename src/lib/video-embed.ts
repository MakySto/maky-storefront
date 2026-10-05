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
 */

const WATCH = /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/;
const ID = /^[A-Za-z0-9_-]{11}$/;

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
