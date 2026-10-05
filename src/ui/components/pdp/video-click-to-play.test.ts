import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { youtubePlayerUrl, youtubeWatchUrl } from "@/lib/video-embed";
import { VideoClickToPlay } from "./video-click-to-play";

/**
 * The click that opens a product's video, and what becomes of the player when its page is left.
 *
 * The component draws nothing; its whole work is one effect. The router keeps a page the shopper has
 * left, hidden, with everything in it alive, and cleans that page's effects up. A player that stayed in
 * it would go on sounding behind the next page, with nothing on screen to stop it (a shopper heard the
 * first CoolZ's film behind the second). So the effect is run here, as React runs it, against a small
 * stand-in for the parts of the document it touches, and both ends are held: the click puts the player in
 * the preview's place, and cleaning the effect up takes it out and puts the preview back.
 */

const effects = vi.hoisted(() => ({ run: undefined as undefined | (() => void | (() => void)) }));
vi.mock("react", () => ({
	useEffect: (effect: () => void | (() => void)) => {
		effects.run = effect;
	},
}));

const ID = "D5lm_R-m3BA";

class FakeElement {
	isConnected = true;
	className = "";
	src = "";
	title = "";
	allow = "";
	allowFullscreen = false;
	referrerPolicy = "";
	focused = false;
	private readonly attributes = new Map<string, string>();

	constructor(
		readonly tag: string,
		attributes: Record<string, string> = {},
	) {
		for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}

	closest(selector: string): FakeElement | null {
		return selector === "a.maky-video-a" && this.tag === "a" ? this : null;
	}

	querySelector(selector: string): { textContent: string } | null {
		return selector === ".maky-video-t" ? { textContent: "  CoolZ video  " } : null;
	}

	replaceWith(next: FakeElement): void {
		this.isConnected = false;
		next.isConnected = true;
	}

	focus(): void {
		this.focused = true;
	}
}

type Listener = (event: unknown) => void;
const listeners = new Map<string, Set<Listener>>();
const created: FakeElement[] = [];

const fakeDocument = {
	querySelectorAll: () => [],
	addEventListener: (type: string, listener: Listener) => {
		if (!listeners.has(type)) listeners.set(type, new Set());
		listeners.get(type)!.add(listener);
	},
	removeEventListener: (type: string, listener: Listener) => {
		listeners.get(type)?.delete(listener);
	},
	createElement: (tag: string) => {
		const element = new FakeElement(tag);
		created.push(element);
		return element;
	},
};

type ClickOptions = Partial<{
	button: number;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
}>;

const click = (target: FakeElement, modifiers: ClickOptions = {}) => {
	const event = {
		defaultPrevented: false,
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		...modifiers,
		target,
		preventDefault() {
			this.defaultPrevented = true;
		},
	};
	for (const listener of [...(listeners.get("click") ?? [])]) listener(event);
	return event;
};

const previewLink = (href = youtubeWatchUrl(ID)) => new FakeElement("a", { href });

/** The page's effect, started the way React starts it; what it returns is the cleanup React runs when the page is hidden or removed. */
const startPage = (): (() => void) => {
	VideoClickToPlay();
	const cleanup = effects.run?.();
	if (typeof cleanup !== "function") throw new Error("the effect returned no cleanup");
	return cleanup;
};

beforeEach(() => {
	listeners.clear();
	created.length = 0;
	effects.run = undefined;
	vi.stubGlobal("document", fakeDocument);
	vi.stubGlobal("Element", FakeElement);
	vi.stubGlobal("HTMLImageElement", class {});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the click on a video's preview", () => {
	it("puts the player in the preview's place, started by the same click", () => {
		startPage();
		const link = previewLink();
		const event = click(link);

		expect(event.defaultPrevented).toBe(true);
		const [frame] = created;
		expect(frame.tag).toBe("iframe");
		expect(frame.src).toBe(youtubePlayerUrl(ID));
		expect(frame.title).toBe("CoolZ video");
		expect(frame.className).toBe("maky-video-f");
		expect(frame.allowFullscreen).toBe(true);
		expect(frame.isConnected).toBe(true);
		expect(link.isConnected).toBe(false);
		expect(frame.focused).toBe(true);
	});

	it("leaves the link to open the watch page for a click with a modifier key or one that is not the main button", () => {
		startPage();
		const link = previewLink();

		for (const modifiers of [
			{ metaKey: true },
			{ ctrlKey: true },
			{ shiftKey: true },
			{ altKey: true },
			{ button: 1 },
		]) {
			expect(click(link, modifiers).defaultPrevented).toBe(false);
		}
		expect(created).toHaveLength(0);
		expect(link.isConnected).toBe(true);
	});

	it("opens nothing for a link that is not the exact watch address", () => {
		startPage();
		const link = previewLink("https://www.youtube.com.evil.example/watch?v=D5lm_R-m3BA");

		expect(click(link).defaultPrevented).toBe(false);
		expect(created).toHaveLength(0);
	});
});

describe("leaving the page", () => {
	it("takes the player out and puts the preview back where it stood", () => {
		const cleanup = startPage();
		const link = previewLink();
		click(link);
		const [frame] = created;
		expect(frame.isConnected).toBe(true);

		cleanup();

		expect(frame.isConnected).toBe(false);
		expect(link.isConnected).toBe(true);
	});

	it("takes out every player the page opened", () => {
		const cleanup = startPage();
		const links = [previewLink(), previewLink(youtubeWatchUrl("AAAAAAAAAAA"))];
		for (const link of links) click(link);
		expect(created).toHaveLength(2);

		cleanup();

		expect(created.every((frame) => !frame.isConnected)).toBe(true);
		expect(links.every((link) => link.isConnected)).toBe(true);
	});

	it("stops listening for clicks, so a page that is hidden opens nothing on the next page", () => {
		const cleanup = startPage();
		expect(listeners.get("click")?.size).toBe(1);

		cleanup();

		expect(listeners.get("click")?.size).toBe(0);
		click(previewLink());
		expect(created).toHaveLength(0);
	});

	it("leaves a page that opened no player as it was", () => {
		const cleanup = startPage();
		const link = previewLink();

		expect(() => cleanup()).not.toThrow();
		expect(link.isConnected).toBe(true);
		expect(created).toHaveLength(0);
	});

	it("does not touch a player the page no longer holds", () => {
		const cleanup = startPage();
		const link = previewLink();
		click(link);
		const [frame] = created;
		frame.isConnected = false;

		cleanup();

		expect(link.isConnected).toBe(false);
	});

	it("gives the way back its preview, one click from the film", () => {
		const first = startPage();
		const link = previewLink();
		click(link);
		first();

		// the page is shown again: its effect starts afresh and the preview opens a new player
		const second = startPage();
		const event = click(link);

		expect(event.defaultPrevented).toBe(true);
		expect(created).toHaveLength(2);
		expect(created[1].isConnected).toBe(true);
		expect(created[0].isConnected).toBe(false);
		expect(link.isConnected).toBe(false);
		second();
		expect(created[1].isConnected).toBe(false);
		expect(link.isConnected).toBe(true);
	});
});
