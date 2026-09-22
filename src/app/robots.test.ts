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
