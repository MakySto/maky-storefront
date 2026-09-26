import { describe, expect, it } from "vitest";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";
import { HTML_LIMITED_BOTS } from "./html-limited-bots.js";

/**
 * Google must receive canonical and hreflang in <head> — and nobody else may lose what Next
 * already gave them: a custom `htmlLimitedBots` REPLACES Next's list.
 */
const UA = {
	googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	googlebotSmartphone:
		"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	googleOther: "Mozilla/5.0 (compatible; GoogleOther)",
	inspectionTool: "Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)",
	storebot:
		"Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
	facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
	lighthouse:
		"Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
	chrome:
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	iphone:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
};

describe("HTML_LIMITED_BOTS", () => {
	it("keeps Next's whole list", () => {
		expect(HTML_LIMITED_BOTS.source.startsWith(HTML_LIMITED_BOT_UA_RE.source)).toBe(true);
		expect(HTML_LIMITED_BOTS.flags).toContain("i");
	});

	it("serves Google's search crawlers the metadata in <head>", () => {
		for (const ua of [UA.googlebot, UA.googlebotSmartphone, UA.googleOther, UA.inspectionTool, UA.storebot]) {
			expect(HTML_LIMITED_BOTS.test(ua), ua).toBe(true);
		}
	});

	it("still covers the bots Next already covered", () => {
		for (const ua of [UA.bingbot, UA.facebook, UA.lighthouse])
			expect(HTML_LIMITED_BOTS.test(ua), ua).toBe(true);
	});

	it("leaves visitors on the streamed path", () => {
		for (const ua of [UA.chrome, UA.iphone, UA.firefox]) expect(HTML_LIMITED_BOTS.test(ua), ua).toBe(false);
	});
});
