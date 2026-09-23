import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

import { ACCESS_PARAMS, REDACTED_VALUE, analyticsUrlRedactionScript } from "./analytics-url-redaction";

/**
 * Runs the exact string the page inlines, in a sandbox that stands in for the browser: a
 * dataLayer with the gtag shim from document-shell.tsx, a location, a referrer and a history
 * that moves the location like the real one does.
 */
function boot(href: string, referrer = "") {
	const listeners: Record<string, Array<() => void>> = {};
	const location = { href };
	const history = {
		pushState(_state: unknown, _title: string, url: string) {
			location.href = new URL(url, location.href).href;
		},
		replaceState(_state: unknown, _title: string, url: string) {
			location.href = new URL(url, location.href).href;
		},
	};
	const sandbox: Record<string, unknown> = {
		URL,
		location,
		history,
		document: { referrer },
		addEventListener: (type: string, fn: () => void) => {
			(listeners[type] ??= []).push(fn);
		},
	};
	sandbox.window = sandbox;
	vm.createContext(sandbox);
	vm.runInContext(
		"window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}",
		sandbox,
	);
	vm.runInContext(analyticsUrlRedactionScript, sandbox);
	const dataLayer = sandbox.dataLayer as unknown[];
	const sets = () =>
		dataLayer
			.map((entry) => Array.from(entry as ArrayLike<unknown>))
			.filter((args) => args[0] === "set")
			.map((args) => args[1] as { page_location?: string; page_referrer?: string });
	const fire = (type: string) => listeners[type]?.forEach((fn) => fn());
	return { sandbox, dataLayer, sets, history, location, fire };
}

const ORIGIN = "https://maky.store";
const SECRET_VALUES = ["ORD1", "CHK2", "TOK3", "a@b.example", "pi_4", "pi_4_secret_5", "succeeded", "TXN6"];
const everyAccessParam = ACCESS_PARAMS.map(
	(key, i) => `${key}=${encodeURIComponent(SECRET_VALUES[i]!)}`,
).join("&");

describe("analytics URL redaction (inline, before the tag manager)", () => {
	it("covers every access parameter the storefront puts in a URL", () => {
		expect([...ACCESS_PARAMS].sort()).toEqual(
			[
				"checkout",
				"email",
				"order",
				"payment_intent",
				"payment_intent_client_secret",
				"redirect_status",
				"token",
				"transaction",
			].sort(),
		);
	});

	it("sets a redacted page_location when the address carries access values, and keeps everything else", () => {
		const { sets } = boot(`${ORIGIN}/checkout?step=payment&${everyAccessParam}&locale=sk-SK`);
		expect(sets()).toHaveLength(1);
		const url = new URL(sets()[0]!.page_location!);
		expect(url.pathname).toBe("/checkout");
		expect(url.searchParams.get("step")).toBe("payment");
		expect(url.searchParams.get("locale")).toBe("sk-SK");
		for (const key of ACCESS_PARAMS) expect(url.searchParams.get(key)).toBe(REDACTED_VALUE);
		for (const value of SECRET_VALUES)
			expect(sets()[0]!.page_location).not.toContain(encodeURIComponent(value));
		expect(sets()[0]).not.toHaveProperty("page_referrer");
	});

	it("redacts the referrer the next page would report", () => {
		const { sets } = boot(
			`${ORIGIN}/sk`,
			`${ORIGIN}/checkout?checkout=CHK2&payment_intent_client_secret=pi_4_secret_5`,
		);
		expect(sets()).toEqual([
			{
				page_referrer: `${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&payment_intent_client_secret=${REDACTED_VALUE}`,
			},
		]);
	});

	it("stays out of the way of an ordinary page", () => {
		const { sets, history, dataLayer } = boot(`${ORIGIN}/sk/stresne-nosice?page=2`, `${ORIGIN}/sk`);
		history.pushState(null, "", "/sk/stresne-boxy");
		expect(sets()).toEqual([]);
		expect(dataLayer).toHaveLength(0);
	});

	it("rewrites the URLs of a history change before the tag reads them", () => {
		const { dataLayer } = boot(`${ORIGIN}/checkout?checkout=CHK2&step=information`);
		const message = {
			event: "gtm.historyChange-v2",
			"gtm.oldUrl": `${ORIGIN}/checkout?checkout=CHK2&step=information`,
			"gtm.newUrl": `${ORIGIN}/checkout?checkout=CHK2&step=delivery`,
		};
		(dataLayer as unknown as { push: (m: unknown) => number }).push(message);
		expect(dataLayer.at(-1)).toBe(message);
		expect(message["gtm.oldUrl"]).toBe(`${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&step=information`);
		expect(message["gtm.newUrl"]).toBe(`${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&step=delivery`);
	});

	it("keeps the set values in step with the address bar after a history change", () => {
		const { sets, history, fire, location } = boot(`${ORIGIN}/checkout?checkout=CHK2&step=information`);
		history.pushState(null, "", "/checkout?checkout=CHK2&step=delivery");
		expect(sets().at(-1)).toEqual({
			page_location: `${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&step=delivery`,
			page_referrer: `${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&step=information`,
		});
		history.replaceState(null, "", "/checkout?checkout=CHK2&step=payment");
		expect(sets().at(-1)!.page_location).toBe(`${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&step=payment`);
		location.href = `${ORIGIN}/checkout?checkout=CHK2&step=information`;
		fire("popstate");
		expect(sets().at(-1)!.page_location).toBe(
			`${ORIGIN}/checkout?checkout=${REDACTED_VALUE}&step=information`,
		);
		for (const set of sets()) expect(JSON.stringify(set)).not.toContain("CHK2");
	});

	it("is inlined into the consent script, ahead of the tag manager", () => {
		const shell = fs.readFileSync(path.join(process.cwd(), "src/ui/components/document-shell.tsx"), "utf8");
		const consent = shell.indexOf("maky-consent-default");
		const redaction = shell.indexOf("${analyticsUrlRedactionScript}");
		const gtm = shell.indexOf('id="maky-gtm"');
		expect(consent).toBeGreaterThan(0);
		expect(redaction).toBeGreaterThan(consent);
		expect(gtm).toBeGreaterThan(redaction);
	});
});
