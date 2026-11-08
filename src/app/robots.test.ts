import { describe, expect, it } from "vitest";
import robots from "./robots";

type Rule = {
	userAgent?: string | string[];
	allow?: string | string[];
	disallow?: string | string[];
	crawlDelay?: number;
};

const rules = () => {
	const result = robots().rules;
	return (Array.isArray(result) ? result : [result]) as Rule[];
};
const group = (agent: string) => rules().find((rule) => rule.userAgent === agent);
const list = (value: string | string[] | undefined) => (value === undefined ? [] : [].concat(value as never));

describe("robots.txt", () => {
	it("keeps the catch-all group free of Crawl-delay (Bing honours it)", () => {
		expect(group("*")?.crawlDelay).toBeUndefined();
		expect(list(group("*")?.disallow)).toContain("/api/");
	});

	// Bingbot submits the header search form (a Server Action) as GET and was logged on
	// `/us?%24ACTION_3%3A0=…&search=2026` and its siblings: a URL space that changes with every build.
	it("keeps crawlers off the form-submission URLs of the search Server Action, encoded or not", () => {
		const disallow = list(group("*")?.disallow);
		expect(disallow).toContain("/*?*ACTION_");
		// The rule is a robots.txt pattern: `*` is any run of characters. Evaluate it the way a crawler does.
		const blocked = (path: string) =>
			new RegExp(`^${"/*?*ACTION_".replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`).test(path);
		expect(blocked("/us?%24ACTION_3%3A0=%7B%22id%22%3A%22a%22%7D&search=2026")).toBe(true);
		expect(blocked("/?%24ACTION_2%3A0=x&search=")).toBe(true);
		expect(blocked("/sk?$ACTION_2:0=x&search=")).toBe(true);
		// Real pages, and the search page itself, stay crawlable.
		expect(blocked("/sk/stresne-nosice/bmw/x3/g01")).toBe(false);
		expect(blocked("/sk/search?query=thule")).toBe(false);
		expect(blocked("/sk/stresny-nosic-thule-wingbar-evo-silver-bmw-x3-g01-2017-2024-fixacne-body")).toBe(
			false,
		);
	});

	it("slows ClaudeBot, SemrushBot and AhrefsBot without blocking them", () => {
		for (const agent of ["ClaudeBot", "SemrushBot", "AhrefsBot"]) {
			const rule = group(agent);
			expect(rule?.crawlDelay, agent).toBe(10);
			expect(list(rule?.allow), agent).toContain("/");
		}
	});

	it("repeats every catch-all Disallow in each named group — a bot reads only its own group", () => {
		const base = list(group("*")?.disallow);
		for (const rule of rules().filter((r) => r.userAgent !== "*" && r.crawlDelay !== undefined)) {
			expect(list(rule.disallow)).toEqual(base);
		}
	});

	it("keeps Amazonbot off the site, which is the only rule that covers the product pages", () => {
		expect(list(group("Amazonbot")?.disallow)).toEqual(["/"]);
		expect(group("Amazonbot")?.allow).toBeUndefined();
	});

	// Owner decision 2026-09-26: the training crawler is refused, ChatGPT's search is not.
	it("keeps GPTBot off the site without an Allow that would reopen part of it", () => {
		expect(list(group("GPTBot")?.disallow)).toEqual(["/"]);
		expect(group("GPTBot")?.allow).toBeUndefined();
		expect(group("GPTBot")?.crawlDelay).toBeUndefined();
	});

	it("does not name the search engines or the user-triggered AI agents", () => {
		const named = rules().map((rule) => rule.userAgent);
		for (const agent of [
			"Googlebot",
			"Bingbot",
			"Claude-SearchBot",
			"Claude-User",
			"OAI-SearchBot",
			"ChatGPT-User",
		]) {
			expect(named).not.toContain(agent);
		}
	});
});
