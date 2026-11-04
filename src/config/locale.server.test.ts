import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let incoming = new Headers();
vi.mock("next/headers", () => ({ headers: async () => incoming }));

import { getLocale, getMarket } from "./locale.server";

beforeEach(() => {
	incoming = new Headers();
});

describe("locale of a request", () => {
	it("trusts the headers the proxy set", async () => {
		incoming = new Headers({
			"x-locale": "de-DE",
			"x-market": "de",
			referer: "https://maky.store/pl/koszyk",
		});
		expect(await getLocale()).toBe("de-DE");
		expect(await getMarket()).toBe("de");
	});

	// A server action does not pass through the proxy, so nobody set those headers.
	it("falls back to the market of the page that sent the action", async () => {
		incoming = new Headers({ referer: "https://maky.store/de/dachtraeger/bmw?x=1", host: "maky.store" });
		expect(await getMarket()).toBe("de");
		expect(await getLocale()).toBe("de-DE");
	});

	it("reads Next-Url when there is no referer", async () => {
		incoming = new Headers({ "next-url": "/ro/cos" });
		expect(await getMarket()).toBe("ro");
		expect(await getLocale()).toBe("ro-RO");
	});

	it("keeps the defaults when the request names no market", async () => {
		incoming = new Headers({ referer: "https://elsewhere.example/de/x", host: "maky.store" });
		expect(await getMarket()).toBe("sk");
		incoming = new Headers({ referer: "not a url at all" });
		expect(await getLocale()).toBe("sk-SK");
	});
});
