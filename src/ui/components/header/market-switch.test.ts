import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useParams: vi.fn(), usePathname: vi.fn(), useRouter: vi.fn() }));

import { switchTargetFor } from "./header-market-controls";
import { registerMarketSwitchTargets, registeredMarketTarget } from "./market-switch-targets";

/**
 * The market switcher lands on the SAME thing in the other market — the product at that
 * market's translated slug, the category at its localized root — and never on a path the
 * target market's proxy does not route.
 */
function at(pathname: string, search = "") {
	vi.stubGlobal("window", { location: { pathname, search } });
}

afterEach(() => vi.unstubAllGlobals());

describe("entity pages go to the same entity, at the target market's own URL", () => {
	it("a product: from the German translated slug to the Czech one", () => {
		at("/de/dachtrager-nordrive-helio-black-cfmp-b-nor-9fbd74569243be-000000");
		const unregister = registerMarketSwitchTargets(window.location.pathname, {
			de: "/dachtrager-nordrive-helio-black-cfmp-b-nor-9fbd74569243be-000000",
			cz: "/stresni-nosic-nordrive-helio-black-cfmp-b-nor-9fbd74569243be-000000",
			sk: "/stresny-nosic-nordrive-helio-black-alfa-romeo-156-crosswagon-2004-2007-klasicke-lyziny",
		});

		expect(switchTargetFor("cz", "de", "de-eur", "/ignored")).toBe(
			"/cz/stresni-nosic-nordrive-helio-black-cfmp-b-nor-9fbd74569243be-000000",
		);
		expect(switchTargetFor("sk", "de", "de-eur", "/ignored")).toBe(
			"/sk/stresny-nosic-nordrive-helio-black-alfa-romeo-156-crosswagon-2004-2007-klasicke-lyziny",
		);
		unregister();
	});

	it("an entity that does not exist in the target market goes to that market's home, not to a not-found", () => {
		at("/de/dachtraeger");
		const unregister = registerMarketSwitchTargets("/de/dachtraeger", { de: "/dachtraeger" });

		expect(switchTargetFor("at", "de", "de-eur", "/ignored")).toBe("/at");
		unregister();
	});

	it("a category root moves to the target's localized root", () => {
		at("/cz/stresni-nosice");
		const unregister = registerMarketSwitchTargets("/cz/stresni-nosice", {
			cz: "/stresni-nosice",
			de: "/dachtraeger",
		});

		expect(switchTargetFor("de", "cz", "cz-czk", "/ignored")).toBe("/de/dachtraeger");
		unregister();
	});
});

describe("a registration answers only for the page it was made on", () => {
	it("is ignored on another path, and gone after the page unmounts", () => {
		const unregister = registerMarketSwitchTargets("/de/a", { cz: "/b" });
		expect(registeredMarketTarget("/de/other", "cz")).toBeUndefined();
		expect(registeredMarketTarget("/de/a", "cz")).toBe("/b");
		unregister();
		expect(registeredMarketTarget("/de/a", "cz")).toBeUndefined();
	});

	it("an older page's cleanup never removes the newer page's registration", () => {
		const first = registerMarketSwitchTargets("/de/a", { cz: "/a" });
		const second = registerMarketSwitchTargets("/de/b", { cz: "/b" });
		first();
		expect(registeredMarketTarget("/de/b", "cz")).toBe("/b");
		second();
	});
});

describe("pages without an entity keep their path", () => {
	it("keeps the path and the query in the target market", () => {
		at("/sk/search", "?query=thule");
		expect(switchTargetFor("cz", "sk", "sk-eur", "/ignored")).toBe("/cz/search?query=thule");
	});

	it("swaps the market's cart word, which each proxy accepts only in its own language", () => {
		at("/de/warenkorb");
		expect(switchTargetFor("cz", "de", "de-eur", "/ignored")).toBe("/cz/kosik");
		at("/sk/kosik");
		expect(switchTargetFor("us", "sk", "sk-eur", "/ignored")).toBe("/us/cart");
		at("/us/cart");
		expect(switchTargetFor("de", "us", "us-usd", "/ignored")).toBe("/de/warenkorb");
	});

	it("goes to the target's home from a home page", () => {
		at("/sk");
		expect(switchTargetFor("cz", "sk", "sk-eur", "/ignored")).toBe("/cz");
	});

	it("does not mistake a product slug that merely starts like a market for the market", () => {
		at("/sk/skrinka-na-lyze");
		expect(switchTargetFor("cz", "sk", "sk-eur", "/ignored")).toBe("/cz/skrinka-na-lyze");
	});
});
