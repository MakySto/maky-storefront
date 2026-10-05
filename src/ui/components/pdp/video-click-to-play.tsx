"use client";

import { useEffect } from "react";
import { youtubeIdFromWatchUrl, youtubePlayerUrl } from "@/lib/video-embed";

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
 * film comes from YouTube and loads only then.
 */
export function VideoClickToPlay() {
	useEffect(() => {
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
			frame.focus();
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);

	return null;
}
