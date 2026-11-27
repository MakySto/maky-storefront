import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useParams: vi.fn(), usePathname: vi.fn(), useRouter: vi.fn() }));

import { switchTargetFor } from "./header-market-controls";
import {
	MarketSwitchRegistrar,
	registerMarketSwitchTargets,
	registeredMarketTarget,
} from "./market-switch-registry";
import { MarketSwitchTargets, marketSitePaths } from "./market-switch-targets";

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
			de: "/de/dachtrager-nordrive-helio-black-cfmp-b-nor-9fbd74569243be-000000",
			cz: "/cz/stresni-nosic-nordrive-helio-black-cfmp-b-nor-9fbd74569243be-000000",
			sk: "/sk/stresny-nosic-nordrive-helio-black-alfa-romeo-156-crosswagon-2004-2007-klasicke-lyziny",
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
		const unregister = registerMarketSwitchTargets("/de/dachtraeger", { de: "/de/dachtraeger" });

		expect(switchTargetFor("at", "de", "de-eur", "/ignored")).toBe("/at");
		unregister();
	});

	it("a category root moves to the target's localized root", () => {
		at("/cz/stresni-nosice");
		const unregister = registerMarketSwitchTargets("/cz/stresni-nosice", {
			cz: "/cz/stresni-nosice",
			de: "/de/dachtraeger",
		});

		expect(switchTargetFor("de", "cz", "cz-czk", "/ignored")).toBe("/de/dachtraeger");
		unregister();
	});
});

describe("what a page writes into its HTML is a page that exists", () => {
	// Search Console, 14 to 27 November 2026: 46 240, then 60 500 "Not found (404)" at
	// `https://maky.store/<slug>` with no market, e.g. `/stresny-nosic-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-integrovane-lyziny`,
	// referred by the US page of the same product. The only place that HTML held the bare slug
	// was the RSC payload of the switcher's registration: `{"paths":{"us":"/roof-rack-…","sk":"/stresny-nosic-…"}}`.
	const counterparts = {
		us: "/roof-rack-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-flush-rails",
		sk: "/stresny-nosic-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-integrovane-lyziny",
		fr: "/barres-de-toit/renault/grand-scenic/jm",
	};

	it("the market prefix goes on before the paths reach the client component", () => {
		const element = MarketSwitchTargets({ paths: counterparts });
		expect(element.type).toBe(MarketSwitchRegistrar);
		expect(element.props).toEqual({
			sitePaths: {
				us: "/us/roof-rack-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-flush-rails",
				sk: "/sk/stresny-nosic-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-integrovane-lyziny",
				fr: "/fr/barres-de-toit/renault/grand-scenic/jm",
			},
		});
	});

	it("no value that crosses into the client starts outside its market", () => {
		const sitePaths = marketSitePaths(counterparts);
		for (const [market, path] of Object.entries(sitePaths)) {
			expect(path.startsWith(`/${market}/`)).toBe(true);
		}
		expect(JSON.stringify(sitePaths)).not.toContain('":"/stresny-nosic');
	});

	it("a market's home is the bare prefix, without a trailing slash", () => {
		expect(marketSitePaths({ cz: "/" })).toEqual({ cz: "/cz" });
	});

	it("the switcher lands on the registered site path as it is, without a second prefix", () => {
		at("/us/roof-rack-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-flush-rails");
		const unregister = registerMarketSwitchTargets(window.location.pathname, marketSitePaths(counterparts));
		expect(switchTargetFor("sk", "us", "us-usd", "/ignored")).toBe(
			"/sk/stresny-nosic-thule-slidebar-evo-silver-honda-cr-v-rw-2020-2023-integrovane-lyziny",
		);
		expect(switchTargetFor("de", "us", "us-usd", "/ignored")).toBe("/de");
		unregister();
	});
});

describe("a registration answers only for the page it was made on", () => {
	it("is ignored on another path, and gone after the page unmounts", () => {
		const unregister = registerMarketSwitchTargets("/de/a", { cz: "/cz/b" });
		expect(registeredMarketTarget("/de/other", "cz")).toBeUndefined();
		expect(registeredMarketTarget("/de/a", "cz")).toBe("/cz/b");
		unregister();
		expect(registeredMarketTarget("/de/a", "cz")).toBeUndefined();
	});

	it("an older page's cleanup never removes the newer page's registration", () => {
		const first = registerMarketSwitchTargets("/de/a", { cz: "/cz/a" });
		const second = registerMarketSwitchTargets("/de/b", { cz: "/cz/b" });
		first();
		expect(registeredMarketTarget("/de/b", "cz")).toBe("/cz/b");
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
