import { beforeEach, describe, expect, it, vi } from "vitest";

const executePublicGraphQL = vi.fn();
const resolveFallbackLocale = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/graphql", () => ({
	executePublicGraphQL: (...args: unknown[]) => executePublicGraphQL(...args),
}));
vi.mock("@/checkout/lib/server/resolve-fallback-locale", () => ({
	resolveFallbackLocale: (...args: unknown[]) => resolveFallbackLocale(...args),
}));

import { fetchCheckoutOnServer } from "./fetch-checkout";

const answer = (channelSlug: string) => ({
	ok: true,
	data: { checkout: { id: "c1", channel: { id: "ch", slug: channelSlug } } },
});
const languageCodes = () => executePublicGraphQL.mock.calls.map((call) => call[1].variables.languageCode);

describe("fetchCheckoutOnServer locale", () => {
	beforeEach(() => {
		executePublicGraphQL.mockReset();
		resolveFallbackLocale.mockReset();
	});

	it("reads exactly the locale a caller names, with one request", async () => {
		executePublicGraphQL.mockResolvedValue(answer("de-eur"));
		await fetchCheckoutOnServer("c1", "sk-SK");
		expect(languageCodes()).toEqual(["SK"]);
		expect(resolveFallbackLocale).not.toHaveBeenCalled();
	});

	it("re-reads a localeless call in the language of the checkout's own channel", async () => {
		resolveFallbackLocale.mockResolvedValue("sk-SK");
		executePublicGraphQL.mockResolvedValue(answer("de-eur"));
		await fetchCheckoutOnServer("c1");
		expect(languageCodes()).toEqual(["SK", "DE"]);
	});

	it("does not read twice when the visitor's market already matches the channel", async () => {
		resolveFallbackLocale.mockResolvedValue("de-DE");
		executePublicGraphQL.mockResolvedValue(answer("de-eur"));
		await fetchCheckoutOnServer("c1");
		expect(languageCodes()).toEqual(["DE"]);
	});

	it("passes a failed read through without a second request", async () => {
		resolveFallbackLocale.mockResolvedValue("sk-SK");
		executePublicGraphQL.mockResolvedValue({ ok: false, error: { type: "network", message: "x" } });
		await expect(fetchCheckoutOnServer("c1")).resolves.toEqual({ ok: false });
		expect(executePublicGraphQL).toHaveBeenCalledTimes(1);
	});
});
