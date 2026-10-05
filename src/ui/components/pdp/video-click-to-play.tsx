"use client";

import { useEffect } from "react";
import { youtubeIdFromWatchUrl, youtubePlayerUrl } from "@/lib/video-embed";

/** The still under the link: the picture of the preview, which the preview does not depend on. */
const STILL = ".maky-video > img";

/**
 * A product's video is drawn as a link to its watch page (`maky:video`, `renderRole`), and nothing
 * of YouTube is asked for until the shopper clicks it. This is the click: it replaces the link by the
 * player, started by the same click.
 *
 * The identifier is read out of the link's own address with the parser the server used, and the
 * player's address is built from it on YouTube's privacy-enhanced host (`youtube-nocookie.com`),
 * so what opens is only ever the film the server accepted. A click with a modifier key, a middle
 * click, a link that is not the exact watch address, and a browser without this script all keep the
 * link's own behaviour: the watch page opens in a new tab.
 *
 * The click is the whole of the consent the preview asks for. It says, before it is clicked, that the
 * film comes from YouTube and loads only then. The still the preview shows is asked of this site's
 * own image optimizer (`videoPosterSrc`), so the shopper's browser has asked YouTube for nothing.
 *
 * Where the still does not come (the optimizer could not fetch it), the browser would draw its
 * broken-image mark in a corner of the preview. The picture is taken out instead, and what is left
 * is the shop's own card, which was under it and is the same link.
 *
 * The player does not outlive its page. The router keeps a page the shopper has left, hidden, to give
 * it back unchanged on the way back, and everything in it stays alive, a player with it: a film behind
 * the next page that the shopper can neither see nor stop. So when this page's effects are cleaned up
 * (it is hidden, or removed) every player it opened is taken out and the preview it replaced is put
 * back. On the way back the shopper finds the preview, one click from the film.
 */
export function VideoClickToPlay() {
	useEffect(() => {
		// The players this page has opened, each with the preview link it took the place of.
		const opened = new Map<HTMLIFrameElement, Element>();

		// A still that failed before this script ran is already broken; one that fails later raises
		// `error`, which does not bubble and so is heard on the way down.
		for (const image of document.querySelectorAll<HTMLImageElement>(STILL)) {
			if (image.complete && image.naturalWidth === 0) image.remove();
		}
		const onStillError = (event: Event) => {
			if (event.target instanceof HTMLImageElement && event.target.matches(STILL)) event.target.remove();
		};
		document.addEventListener("error", onStillError, true);

		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const target = event.target instanceof Element ? event.target : null;
			const link = target?.closest("a.maky-video-a");
			if (!link) return;
			const id = youtubeIdFromWatchUrl(link.getAttribute("href"));
			if (!id) return;

			event.preventDefault();
			const frame = document.createElement("iframe");
			frame.className = "maky-video-f";
			frame.src = youtubePlayerUrl(id);
			frame.title = link.querySelector(".maky-video-t")?.textContent?.trim() || "YouTube";
			frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
			frame.allowFullscreen = true;
			frame.referrerPolicy = "strict-origin-when-cross-origin";
			link.replaceWith(frame);
			opened.set(frame, link);
			frame.focus();
		};
		document.addEventListener("click", onClick);
		return () => {
			document.removeEventListener("click", onClick);
			document.removeEventListener("error", onStillError, true);
			for (const [frame, link] of opened) {
				if (frame.isConnected) frame.replaceWith(link);
			}
			opened.clear();
		};
	}, []);

	return null;
}
