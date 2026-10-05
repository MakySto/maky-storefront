import { describe, expect, it } from "vitest";

import { youtubeEmbedUrl, youtubeIdFromWatchUrl, youtubePlayerUrl, youtubeWatchUrl } from "./video-embed";

const ID = "D5lm_R-m3BA";

describe("the addresses of a video", () => {
	it("are built from the identifier on fixed hosts", () => {
		expect(youtubeWatchUrl(ID)).toBe("https://www.youtube.com/watch?v=D5lm_R-m3BA");
		expect(youtubeEmbedUrl(ID)).toBe("https://www.youtube.com/embed/D5lm_R-m3BA");
		expect(youtubePlayerUrl(ID)).toBe(
			"https://www.youtube-nocookie.com/embed/D5lm_R-m3BA?autoplay=1&rel=0&playsinline=1",
		);
	});

	it("the player's host is the privacy-enhanced one and never the plain embed host", () => {
		const player = new URL(youtubePlayerUrl(ID));
		expect(player.protocol).toBe("https:");
		expect(player.hostname).toBe("www.youtube-nocookie.com");
		expect(player.pathname).toBe(`/embed/${ID}`);
	});
});

describe("youtubeIdFromWatchUrl", () => {
	it("reads the identifier of the one form the page writes", () => {
		expect(youtubeIdFromWatchUrl(youtubeWatchUrl(ID))).toBe(ID);
		expect(youtubeIdFromWatchUrl("https://www.youtube.com/watch?v=AAAAAAAAAAA")).toBe("AAAAAAAAAAA");
		expect(youtubeIdFromWatchUrl("https://www.youtube.com/watch?v=a-_9Z0b1c2d")).toBe("a-_9Z0b1c2d");
	});

	it.each([
		["another host", "https://evil.example/watch?v=D5lm_R-m3BA"],
		["a look-alike host", "https://www.youtube.com.evil.example/watch?v=D5lm_R-m3BA"],
		["a user-info trick", "https://www.youtube.com@evil.example/watch?v=D5lm_R-m3BA"],
		["the short host", "https://youtu.be/D5lm_R-m3BA"],
		["the host without www", "https://youtube.com/watch?v=D5lm_R-m3BA"],
		["the nocookie host", "https://www.youtube-nocookie.com/watch?v=D5lm_R-m3BA"],
		["plain http", "http://www.youtube.com/watch?v=D5lm_R-m3BA"],
		["a protocol-relative address", "//www.youtube.com/watch?v=D5lm_R-m3BA"],
		["a script", "javascript:alert(1)//www.youtube.com/watch?v=D5lm_R-m3BA"],
		["a data address", "data:text/html,https://www.youtube.com/watch?v=D5lm_R-m3BA"],
		["the embed path", "https://www.youtube.com/embed/D5lm_R-m3BA"],
		["a second parameter", "https://www.youtube.com/watch?v=D5lm_R-m3BA&autoplay=1"],
		["a playlist", "https://www.youtube.com/watch?v=D5lm_R-m3BA&list=PL1234567890"],
		["the parameters the other way round", "https://www.youtube.com/watch?list=PL1&v=D5lm_R-m3BA"],
		["a fragment", "https://www.youtube.com/watch?v=D5lm_R-m3BA#t=10"],
		["ten characters", "https://www.youtube.com/watch?v=D5lm_R-m3B"],
		["twelve characters", "https://www.youtube.com/watch?v=D5lm_R-m3BAA"],
		["a dot in the identifier", "https://www.youtube.com/watch?v=D5lm_R-m3B."],
		["an escaped character", "https://www.youtube.com/watch?v=D5lm_R-m3B%41"],
		["a Cyrillic look-alike", "https://www.youtube.com/watch?v=Д5lm_R-m3BA"],
		["a trailing newline", "https://www.youtube.com/watch?v=D5lm_R-m3BA\n"],
		["a trailing space", "https://www.youtube.com/watch?v=D5lm_R-m3BA "],
		["a leading space", " https://www.youtube.com/watch?v=D5lm_R-m3BA"],
		["an empty value", ""],
	])("refuses %s", (_name, value) => {
		expect(youtubeIdFromWatchUrl(value)).toBeNull();
	});

	it.each([null, undefined, 7, {}, ["https://www.youtube.com/watch?v=D5lm_R-m3BA"]])(
		"reads only text: %j",
		(value) => {
			expect(youtubeIdFromWatchUrl(value)).toBeNull();
		},
	);
});

describe("youtubePlayerUrl", () => {
	it.each(["", "short", "D5lm_R-m3BAA", "D5lm_R-m3B/", "../../x", "D5lm_R-m3BA\n", "D5lm_R-m3BA?x=1"])(
		"is made only from an identifier, not from %j",
		(value) => {
			expect(() => youtubePlayerUrl(value)).toThrow();
		},
	);
});
